import urllib.request
import urllib.parse
import re
import os
import asyncio
import logging
import ssl
from datetime import datetime
from sqlalchemy.orm import Session

# Local imports
import models
import database
from claude_client import extract_structured_financials, generate_executive_summary
from financial_logic import compute_ratios

logger = logging.getLogger(__name__)

def extract_text_from_pdf_bytes(file_bytes: bytes) -> str:
    import pdfplumber
    import io
    text_pages = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_pages.append(t)
    if not text_pages:
        raise ValueError("PDF vide ou non lisible.")
    return "\n".join(text_pages)

def fetch_html(url: str) -> str:
    try:
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                'Connection': 'keep-alive',
            }
        )
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=15, context=context) as response:
            return response.read().decode('utf-8', errors='ignore')
    except Exception as e:
        logger.error(f"Error fetching URL {url}: {e}")
        return ""

def extract_pdf_links(html_content: str, base_url: str) -> list:
    # Match standard <a href="..."> links to .pdf files
    links = re.findall(r'href=["\']([^"\']+\.pdf)["\']', html_content, re.IGNORECASE)
    absolute_links = []
    for link in links:
        abs_link = urllib.parse.urljoin(base_url, link)
        if abs_link not in absolute_links:
            absolute_links.append(abs_link)
    return absolute_links

def download_file(url: str) -> bytes:
    try:
        # Handle spaces and special characters in URL path
        parts = urllib.parse.urlsplit(url)
        quoted_path = urllib.parse.quote(parts.path, safe='/')
        url = urllib.parse.urlunsplit((parts.scheme, parts.netloc, quoted_path, parts.query, parts.fragment))

        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/pdf,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                'Connection': 'keep-alive',
            }
        )
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=30, context=context) as response:
            return response.read()
    except Exception as e:
        logger.error(f"Error downloading file {url}: {e}")
        return b""

async def run_scraper(db: Session):
    logger.info("Starting automatic web-based financial report collection...")
    
    # Check/seed default scrape sources
    sources = db.query(models.ScrapeSource).all()
    if not sources:
        default_sources = [
            models.ScrapeSource(
                name="AMMC - États financiers", 
                url="https://www.ammc.ma/fr/liste-etats-financiers-emetteurs"
            )
        ]
        for src in default_sources:
            db.add(src)
        db.commit()
        sources = db.query(models.ScrapeSource).all()

    for source in sources:
        logger.info(f"Scraping source: {source.name} ({source.url})")
        html = await asyncio.to_thread(fetch_html, source.url)
        if not html:
            source.status = "failed"
            source.last_scraped = datetime.now().isoformat()
            db.commit()
            continue

        pdf_links = extract_pdf_links(html, source.url)
        
        # If no PDF links are found directly and it is the AMMC website, follow detail pages
        if not pdf_links and "ammc.ma" in source.url:
            detail_links = re.findall(r'href=["\']([^"\']+/espace-emetteurs/etats-financiers/[^"\']+)["\']', html, re.IGNORECASE)
            absolute_details = []
            for link in detail_links:
                abs_link = urllib.parse.urljoin(source.url, link)
                if abs_link not in absolute_details:
                    absolute_details.append(abs_link)
            
            logger.info(f"AMMC: Found {len(absolute_details)} detail pages. Fetching them to extract PDF links...")
            for detail_url in absolute_details:
                detail_html = await asyncio.to_thread(fetch_html, detail_url)
                if detail_html:
                    detail_pdfs = extract_pdf_links(detail_html, detail_url)
                    for pdf in detail_pdfs:
                        if pdf not in pdf_links:
                            pdf_links.append(pdf)

        logger.info(f"Found {len(pdf_links)} PDF links on {source.name}")
        
        processed_count = 0
        success_count = 0
        
        for pdf_url in pdf_links:
            # Parse URL path to get the filename
            parsed_url = urllib.parse.urlparse(pdf_url)
            filename = parsed_url.path.split("/")[-1].lower()
            
            # List of terms indicating the file is NOT an RFA (notices, press releases, instructions, etc.)
            exclude_terms = [
                "avis", "av-", "cp_", "cp-", "communique", "communiqu", "instruction", 
                "decision", "reglement", "convocation", "note_d_information", 
                "note_information", "prospectus", "limite_de_fluctuation", 
                "modalites_de_calcul", "calcul_des_montants"
            ]
            
            # Require at least one of these terms to identify it as a financial report/RFA
            positive_terms = ["rfa", "rapport", "comptes", "bilan", "etats_financiers", "etats-financiers", "financial_report", "annual_report"]
            
            # Check exclusions
            if any(term in filename for term in exclude_terms):
                logger.info(f"Skipping non-RFA PDF (excluded term): {pdf_url}")
                continue
                
            # Check positive indicators
            if not any(term in filename for term in positive_terms):
                logger.info(f"Skipping non-RFA PDF (no positive indicator): {pdf_url}")
                continue

            # Check if already ingested by checking source_url
            existing = db.query(models.Document).filter(models.Document.source_url == pdf_url).first()
            if existing:
                continue
                
            logger.info(f"Discovered new PDF: {pdf_url}")
            processed_count += 1
            
            pdf_bytes = await asyncio.to_thread(download_file, pdf_url)
            if not pdf_bytes:
                continue
                
            filename = pdf_url.split("/")[-1]
            if not filename.lower().endswith(".pdf"):
                filename = f"report_{int(datetime.utcnow().timestamp())}.pdf"
                
            try:
                # Ingest the PDF content
                raw_text = await asyncio.to_thread(extract_text_from_pdf_bytes, pdf_bytes)
                data = await extract_structured_financials(raw_text)
                
                company_name = data.company_name or "Unknown Company"
                fiscal_year = int(data.fiscal_year) if data.fiscal_year and data.fiscal_year.isdigit() else 2024
                
                # Compute ratios
                ratios_computed = compute_ratios(data)
                
                # Generate executive summary via Claude (Slow async API call - no DB transaction active!)
                analysis_data = await generate_executive_summary(data, ratios_computed)
                
                # NOW: perform all DB queries, updates, and inserts in rapid succession (under 5ms) without any intervening await/network calls.
                
                # 1. Check/Create Company
                company = db.query(models.Company).filter(models.Company.name == company_name).first()
                if not company:
                    company = models.Company(
                        name=company_name,
                        ticker=company_name[:4].upper(),
                        sector="Finance"
                    )
                    db.add(company)
                    db.commit()
                    db.refresh(company)
                
                # 2. Add Ratio
                existing_ratio = db.query(models.Ratio).filter(
                    models.Ratio.company_id == company.id,
                    models.Ratio.year == fiscal_year
                ).first()
                if existing_ratio:
                    db.delete(existing_ratio)
                    
                ratio = models.Ratio(
                    company_id=company.id,
                    year=fiscal_year,
                    actif=data.bilan.total_assets,
                    passif=data.bilan.total_assets,
                    capitaux_propres=data.bilan.total_equity,
                    dettes_totales=data.bilan.total_debt,
                    chiffre_affaires=data.cpc.revenue,
                    ebitda=data.cpc.ebitda,
                    resultat_net=data.cpc.net_income,
                    roe=ratios_computed["roe"]["value"],
                    roa=ratios_computed.get("roa", {}).get("value"),
                    ebitda_margin=ratios_computed.get("ebitda_margin", {}).get("value") or (data.cpc.ebitda / data.cpc.revenue if data.cpc.ebitda and data.cpc.revenue else 0),
                    debt_to_equity=ratios_computed["debt_to_equity"]["value"],
                    current_ratio=ratios_computed["liquidity_ratio"]["value"],
                    net_margin=ratios_computed["net_margin"]["value"],
                    revenue_cagr=0.0
                )
                db.add(ratio)
                
                # 3. Add Analysis
                existing_analysis = db.query(models.Analysis).filter(
                    models.Analysis.company_id == company.id,
                    models.Analysis.year == fiscal_year
                ).first()
                if existing_analysis:
                    db.delete(existing_analysis)
                    
                analysis = models.Analysis(
                    company_id=company.id,
                    year=fiscal_year,
                    summary=analysis_data.get("summary"),
                    anomalies=analysis_data.get("anomalies"),
                    peer_comparison=analysis_data.get("peer_comparison")
                )
                db.add(analysis)
                
                # 4. Store PDF file on disk
                stored_dir = "stored_pdfs"
                os.makedirs(stored_dir, exist_ok=True)
                safe_filename = f"{int(datetime.utcnow().timestamp())}_{filename}"
                file_path = os.path.join(stored_dir, safe_filename)
                with open(file_path, "wb") as f:
                    f.write(pdf_bytes)
                    
                # 5. Create Document Record
                doc = models.Document(
                    company_id=company.id,
                    filename=filename,
                    file_path=file_path,
                    source_url=pdf_url,
                    created_at=datetime.now().isoformat()
                )
                db.add(doc)
                
                # 6. Alerts
                alerts_to_add = [
                    models.Alert(
                        title="Collecte Automatique Réussie",
                        message=f"Rapport de {company_name} ({fiscal_year}) collecté automatiquement et importé.",
                        type="info",
                        created_at=datetime.utcnow().isoformat(),
                        is_read=0
                    )
                ]
                
                roe_val = ratios_computed["roe"]["value"]
                if roe_val is not None:
                    if roe_val < 0:
                        alerts_to_add.append(models.Alert(
                            title="Rentabilité Négative",
                            message=f"Collecte auto : ROE critique pour {company_name} ({fiscal_year}) : {roe_val * 100:.1f}%.",
                            type="danger",
                            created_at=datetime.utcnow().isoformat(),
                            is_read=0
                        ))
                    elif roe_val < 0.05:
                        alerts_to_add.append(models.Alert(
                            title="Faible Rentabilité",
                            message=f"Collecte auto : ROE inférieur aux objectifs ({roe_val * 100:.1f}%) pour {company_name} ({fiscal_year}).",
                            type="warning",
                            created_at=datetime.utcnow().isoformat(),
                            is_read=0
                        ))
                        
                de_val = ratios_computed["debt_to_equity"]["value"]
                if de_val is not None and de_val > 2.0:
                    alerts_to_add.append(models.Alert(
                        title="Levier Financier Élevé",
                        message=f"Collecte auto : Dette/Equity élevé ({de_val:.2f}x) pour {company_name} ({fiscal_year}).",
                        type="danger",
                        created_at=datetime.utcnow().isoformat(),
                        is_read=0
                    ))
                    
                for a in alerts_to_add:
                    db.add(a)
                    
                db.commit()
                success_count += 1
                logger.info(f"Successfully processed automated PDF: {pdf_url}")
                
                # Update source status progressively so the frontend receives real-time confirmation
                source.status = "success"
                source.last_scraped = datetime.now().isoformat()
                db.commit()
            except Exception as e:
                db.rollback()
                logger.error(f"Error processing automated PDF {pdf_url}: {e}")
                
        # Final source update at the end of the scrape loop to ensure it's finalized
        source.status = "success"
        source.last_scraped = datetime.now().isoformat()
        db.commit()
        
    logger.info("Automatic web-based financial report collection finished.")
