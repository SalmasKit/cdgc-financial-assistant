"""
AI Financial Statement Agent — CDG Capital Ultimate Backend
Consolidates the new Agent logic with the existing Dashboard functionality.
"""

import io
import os
import logging
import shutil
import tempfile
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import pdfplumber
import hashlib
from datetime import datetime
import asyncio

# Existing project imports
import models
import schemas
import database
import scraper

# New repo imports
from financial_logic import extract_financials, compute_ratios, FinancialData, ActifPassif, CPC
from claude_client import extract_structured_financials, generate_executive_summary, answer_financial_question

# Initialize DB
models.Base.metadata.create_all(bind=database.engine)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def periodic_scraper():
    # Wait a bit after startup
    await asyncio.sleep(10)
    while True:
        try:
            logger.info("Running scheduled background scraper...")
            db = database.SessionLocal()
            try:
                await scraper.run_scraper(db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error in periodic scraper: {e}")
        # Run every 6 hours
        await asyncio.sleep(6 * 3600)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: launch the periodic scraper
    scraper_task = asyncio.create_task(periodic_scraper())
    yield
    # Shutdown: clean up background tasks
    scraper_task.cancel()
    try:
        await scraper_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="CDG Capital Financial Intelligence API",
    description="Unified API for Financial Intelligence Dashboard and AI Agent",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def extract_text_from_pdf_bytes(file_bytes: bytes) -> str:
    text_pages = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_pages.append(t)
    if not text_pages:
        raise ValueError("PDF vide ou non lisible.")
    return "\n".join(text_pages)

# --- AI AGENT ENDPOINTS ---

@app.post("/analyze", summary="Analyser un bilan financier (PDF) - Logic New")
async def analyze_financial_statement(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont acceptés.")

    file_bytes = await file.read()
    try:
        raw_text = extract_text_from_pdf_bytes(file_bytes)
        financial_data: FinancialData = await extract_structured_financials(raw_text)
        ratios = compute_ratios(financial_data)
        analysis_data = await generate_executive_summary(financial_data, ratios)
        
        return JSONResponse(content={
            "source_file": file.filename,
            "financials": financial_data.model_dump(),
            "ratios": ratios,
            "executive_summary": analysis_data,
        })
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- DASHBOARD ENDPOINTS ---

@app.get("/companies")
def get_companies(db: Session = Depends(database.get_db)):
    """List all companies with their latest ROE value for the sidebar/leaderboard."""
    companies = db.query(models.Company).all()
    result = []
    for c in companies:
        latest_ratio = db.query(models.Ratio).filter(
            models.Ratio.company_id == c.id
        ).order_by(models.Ratio.year.desc()).first()
        result.append({
            "company_name": c.name,
            "ticker": c.ticker,
            "sector": c.sector,
            "value": latest_ratio.roe if latest_ratio else 0.0
        })
    result.sort(key=lambda x: x["value"] or 0, reverse=True)
    return result

@app.get("/analysis/{name}")
def get_analysis(name: str, db: Session = Depends(database.get_db)):
    """Get full company data: ratios history + AI analysis for the dashboard."""
    company = db.query(models.Company).filter(models.Company.name == name).first()
    if not company:
        raise HTTPException(status_code=404, detail=f"Company '{name}' not found")
    
    ratios = db.query(models.Ratio).filter(
        models.Ratio.company_id == company.id
    ).order_by(models.Ratio.year).all()
    
    latest_analysis = db.query(models.Analysis).filter(
        models.Analysis.company_id == company.id
    ).order_by(models.Analysis.year.desc()).first()
    
    ratios_list = []
    for r in ratios:
        ratios_list.append({
            "year": r.year,
            "actif": r.actif,
            "passif": r.passif,
            "capitaux_propres": r.capitaux_propres,
            "dettes_totales": r.dettes_totales,
            "chiffre_affaires": r.chiffre_affaires,
            "ebitda": r.ebitda,
            "resultat_net": r.resultat_net,
            "roe": r.roe,
            "roa": r.roa,
            "ebitda_margin": r.ebitda_margin,
            "debt_to_equity": r.debt_to_equity,
            "current_ratio": r.current_ratio,
            "net_margin": r.net_margin,
        })
    
    ai_analysis = None
    if latest_analysis:
        ai_analysis = {
            "summary": latest_analysis.summary,
            "anomalies": latest_analysis.anomalies,
            "peer_comparison": latest_analysis.peer_comparison,
        }
    
    return {
        "name": company.name,
        "ticker": company.ticker,
        "sector": company.sector,
        "ratios": ratios_list,
        "ai_analysis": ai_analysis,
    }

@app.delete("/analysis/{name}", summary="Supprimer une analyse")
def delete_analysis(name: str, db: Session = Depends(database.get_db)):
    company = db.query(models.Company).filter(models.Company.name == name).first()
    if not company:
        raise HTTPException(status_code=404, detail="Société non trouvée")
    
    # Cascade delete is handled by relationship or manual
    db.query(models.Ratio).filter(models.Ratio.company_id == company.id).delete()
    db.query(models.Analysis).filter(models.Analysis.company_id == company.id).delete()
    db.query(models.Company).filter(models.Company.id == company.id).delete()
    db.commit()
    return {"status": "success", "message": f"Analyse de {name} supprimée"}

@app.get("/api/leaderboard", response_model=List[schemas.LeaderboardEntry])
def get_leaderboard(metric: str = "roe", year: int = 2024, db: Session = Depends(database.get_db)):
    query = db.query(models.Company, models.Ratio).join(models.Ratio).filter(models.Ratio.year == year)
    results = query.all()
    
    leaderboard = []
    for company, ratio in results:
        value = getattr(ratio, metric, 0.0)
        if value is None: value = 0.0
        leaderboard.append({
            "company_name": company.name,
            "ticker": company.ticker,
            "sector": company.sector,
            "year": year,
            "value": value,
            "metric": metric
        })
    
    leaderboard.sort(key=lambda x: x["value"], reverse=True)
    return leaderboard

@app.get("/api/companies/search/{name}", response_model=List[schemas.Company])
def search_companies(name: str, db: Session = Depends(database.get_db)):
    companies = db.query(models.Company).filter(models.Company.name.ilike(f"%{name}%")).all()
    return companies

@app.post("/api/ingest/pdf")
async def ingest_pdf(file: UploadFile = File(...), db: Session = Depends(database.get_db)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    
    file_bytes = await file.read()
    try:
        # Use new extraction logic
        raw_text = extract_text_from_pdf_bytes(file_bytes)
        data: FinancialData = await extract_structured_financials(raw_text)
        ratios_computed = compute_ratios(data)
        
        # Prepare data for DB (mapping FinancialData to old schemas)
        company_name = data.company_name or "Unknown Company"
        fiscal_year = int(data.fiscal_year) if data.fiscal_year and data.fiscal_year.isdigit() else 2024
        
        # Save to DB
        company = db.query(models.Company).filter(models.Company.name == company_name).first()
        if not company:
            company = models.Company(
                name=company_name,
                ticker=company_name[:4].upper(), # Fallback ticker
                sector="Finance" # Fallback sector
            )
            db.add(company)
            db.commit()
            db.refresh(company)
        
        # Add Ratio
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
            passif=data.bilan.total_assets, # Simplification
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
            revenue_cagr=0.0 # Placeholder
        )
        db.add(ratio)
        
        # Add Analysis
        analysis_data = await generate_executive_summary(data, ratios_computed)
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
        
        # Save physical PDF file to disk
        stored_dir = "stored_pdfs"
        os.makedirs(stored_dir, exist_ok=True)
        safe_filename = f"{int(datetime.utcnow().timestamp())}_{file.filename}"
        file_path = os.path.join(stored_dir, safe_filename)
        with open(file_path, "wb") as f:
            f.write(file_bytes)
            
        # Create Document Record
        doc = models.Document(
            company_id=company.id,
            filename=file.filename,
            file_path=file_path,
            source_url=None,
            created_at=datetime.now().isoformat()
        )
        db.add(doc)
        
        # Generate automated alerts based on computed ratios
        alerts_to_add = []
        
        # 1. Info Alert: Data successfully ingested
        alerts_to_add.append(models.Alert(
            title="Import Réussi",
            message=f"Le rapport financier de {company_name} ({fiscal_year}) a été importé et analysé.",
            type="info",
            created_at=datetime.utcnow().isoformat(),
            is_read=0
        ))
        
        roe_val = ratios_computed["roe"]["value"]
        if roe_val is not None:
            if roe_val < 0:
                alerts_to_add.append(models.Alert(
                    title="Rentabilité Négative",
                    message=f"ROE critique détecté pour {company_name} ({fiscal_year}) : {roe_val * 100:.1f}%.",
                    type="danger",
                    created_at=datetime.utcnow().isoformat(),
                    is_read=0
                ))
            elif roe_val < 0.05:
                alerts_to_add.append(models.Alert(
                    title="Faible Rentabilité",
                    message=f"ROE inférieur aux objectifs ({roe_val * 100:.1f}%) pour {company_name} ({fiscal_year}).",
                    type="warning",
                    created_at=datetime.utcnow().isoformat(),
                    is_read=0
                ))
                
        de_val = ratios_computed["debt_to_equity"]["value"]
        if de_val is not None and de_val > 2.0:
            alerts_to_add.append(models.Alert(
                title="Levier Financier Élevé",
                message=f"Dette/Fonds propres élevé ({de_val:.2f}x) pour {company_name} ({fiscal_year}).",
                type="danger",
                created_at=datetime.utcnow().isoformat(),
                is_read=0
            ))
            
        liq_val = ratios_computed["liquidity_ratio"]["value"]
        if liq_val is not None and liq_val < 1.0:
            alerts_to_add.append(models.Alert(
                title="Liquidité Insuffisante",
                message=f"Ratio de liquidité générale sous la limite ({liq_val:.2f}x) pour {company_name} ({fiscal_year}).",
                type="warning",
                created_at=datetime.utcnow().isoformat(),
                is_read=0
            ))
            
        for alert_obj in alerts_to_add:
            db.add(alert_obj)
            
        db.commit()
        return {"company_name": company.name, "status": "success"}
    except Exception as e:
        logger.error(f"Ingestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
@app.post("/api/ingest/manual")
async def ingest_manual(req: schemas.ManualIngestRequest, db: Session = Depends(database.get_db)):
    try:
        # Construct standard FinancialData
        data = FinancialData(
            company_name=req.company_name,
            fiscal_year=str(req.fiscal_year),
            currency="MAD",
            bilan=ActifPassif(
                total_assets=req.total_assets,
                current_assets=req.current_assets if req.current_assets is not None else req.total_assets,
                non_current_assets=req.non_current_assets if req.non_current_assets is not None else 0.0,
                total_equity=req.total_equity,
                total_debt=req.total_debt,
                current_liabilities=req.current_liabilities if req.current_liabilities is not None else req.total_debt,
                non_current_liabilities=req.non_current_liabilities if req.non_current_liabilities is not None else 0.0,
            ),
            cpc=CPC(
                revenue=req.revenue,
                ebitda=req.ebitda,
                ebit=req.ebit if req.ebit is not None else req.net_income,
                net_income=req.net_income
            )
        )
        
        # Calculate ratios
        ratios_computed = compute_ratios(data)
        
        # Save to DB
        company = db.query(models.Company).filter(models.Company.name == req.company_name).first()
        if not company:
            company = models.Company(
                name=req.company_name,
                ticker=req.ticker or req.company_name[:4].upper(),
                sector=req.sector or "Finance"
            )
            db.add(company)
            db.commit()
            db.refresh(company)
        else:
            # Update sector & ticker if provided
            if req.ticker:
                company.ticker = req.ticker
            if req.sector:
                company.sector = req.sector
            db.commit()
            db.refresh(company)
            
        # Add or update Ratio
        existing_ratio = db.query(models.Ratio).filter(
            models.Ratio.company_id == company.id,
            models.Ratio.year == req.fiscal_year
        ).first()
        
        if existing_ratio:
            db.delete(existing_ratio)
            db.commit()
            
        ratio = models.Ratio(
            company_id=company.id,
            year=req.fiscal_year,
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
        
        # Generate executive summary via Claude or fallback if fail
        try:
            analysis_data = await generate_executive_summary(data, ratios_computed)
        except Exception as e:
            logger.error(f"Claude analysis fail: {e}")
            analysis_data = {
                "summary": "Synthèse exécutive générée manuellement. Performance générale stable.",
                "anomalies": "Aucune anomalie majeure identifiée.",
                "peer_comparison": "Positionnement conforme aux moyennes sectorielles."
            }
            
        existing_analysis = db.query(models.Analysis).filter(
            models.Analysis.company_id == company.id,
            models.Analysis.year == req.fiscal_year
        ).first()
        
        if existing_analysis:
            db.delete(existing_analysis)
            db.commit()
            
        analysis = models.Analysis(
            company_id=company.id,
            year=req.fiscal_year,
            summary=analysis_data.get("summary"),
            anomalies=analysis_data.get("anomalies"),
            peer_comparison=analysis_data.get("peer_comparison")
        )
        db.add(analysis)
        
        # Generate automated alerts
        alerts_to_add = []
        alerts_to_add.append(models.Alert(
            title="Saisie Manuelle Réussie",
            message=f"Les données financières de {req.company_name} ({req.fiscal_year}) ont été saisies manuellement et analysées.",
            type="info",
            created_at=datetime.utcnow().isoformat(),
            is_read=0
        ))
        
        roe_val = ratios_computed["roe"]["value"]
        if roe_val is not None:
            if roe_val < 0:
                alerts_to_add.append(models.Alert(
                    title="Rentabilité Négative",
                    message=f"ROE critique détecté pour {req.company_name} ({req.fiscal_year}) : {roe_val * 100:.1f}%.",
                    type="danger",
                    created_at=datetime.utcnow().isoformat(),
                    is_read=0
                ))
            elif roe_val < 0.05:
                alerts_to_add.append(models.Alert(
                    title="Faible Rentabilité",
                    message=f"ROE inférieur aux objectifs ({roe_val * 100:.1f}%) pour {req.company_name} ({req.fiscal_year}).",
                    type="warning",
                    created_at=datetime.utcnow().isoformat(),
                    is_read=0
                ))
                
        de_val = ratios_computed["debt_to_equity"]["value"]
        if de_val is not None and de_val > 2.0:
            alerts_to_add.append(models.Alert(
                title="Levier Financier Élevé",
                message=f"Dette/Fonds propres élevé ({de_val:.2f}x) pour {req.company_name} ({req.fiscal_year}).",
                type="danger",
                created_at=datetime.utcnow().isoformat(),
                is_read=0
            ))
            
        liq_val = ratios_computed["liquidity_ratio"]["value"]
        if liq_val is not None and liq_val < 1.0:
            alerts_to_add.append(models.Alert(
                title="Liquidité Insuffisante",
                message=f"Ratio de liquidité générale sous la limite ({liq_val:.2f}x) pour {req.company_name} ({req.fiscal_year}).",
                type="warning",
                created_at=datetime.utcnow().isoformat(),
                is_read=0
            ))
            
        for alert_obj in alerts_to_add:
            db.add(alert_obj)
            
        db.commit()
        return {"company_name": company.name, "status": "success"}
    except Exception as e:
        logger.error(f"Manual Ingestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat", summary="Poser une question à l'assistant financier")
async def chat_with_agent(question: str, company_name: str, db: Session = Depends(database.get_db)):
    company = db.query(models.Company).filter(models.Company.name == company_name).first()
    if not company:
        raise HTTPException(status_code=404, detail="Société non trouvée")

    latest_ratio = db.query(models.Ratio).filter(models.Ratio.company_id == company.id).order_by(models.Ratio.year.desc()).first()
    if not latest_ratio:
        raise HTTPException(status_code=404, detail="Données financières non trouvées")

    # Reconstruct FinancialData for the prompt
    data = FinancialData(
        company_name=company.name,
        fiscal_year=str(latest_ratio.year),
        bilan=ActifPassif(
            total_assets=latest_ratio.actif,
            total_equity=latest_ratio.capitaux_propres,
            total_debt=latest_ratio.dettes_totales
        ),
        cpc=CPC(
            revenue=latest_ratio.chiffre_affaires,
            ebitda=latest_ratio.ebitda,
            net_income=latest_ratio.resultat_net
        )
    )

    # Re-compute ratios for the prompt (or use values from DB)
    ratios_dict = {
        "roe": {"label": "ROE", "value": latest_ratio.roe, "formatted": f"{latest_ratio.roe*100:.2f}%" if latest_ratio.roe else None},
        "net_margin": {"label": "Marge Nette", "value": latest_ratio.net_margin, "formatted": f"{latest_ratio.net_margin*100:.2f}%" if latest_ratio.net_margin else None},
        "current_ratio": {"label": "Liquidité", "value": latest_ratio.current_ratio},
        "debt_to_equity": {"label": "Dette/Equity", "value": latest_ratio.debt_to_equity}
    }

    try:
        answer = await answer_financial_question(question, data, ratios_dict)
        return {"answer": answer}
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/login", response_model=schemas.LoginResponse)
def login(req: schemas.LoginRequest, db: Session = Depends(database.get_db)):
    pwd_hash = hashlib.sha256(req.password.encode()).hexdigest()
    user = db.query(models.User).filter(
        models.User.username == req.username,
        models.User.password_hash == pwd_hash
    ).first()
    if not user:
        raise HTTPException(status_code=400, detail="Identifiants incorrects.")
    return {
        "status": "success",
        "username": user.username,
        "role": user.role,
        "message": "Connexion réussie"
    }

@app.post("/api/signup", response_model=schemas.LoginResponse)
def signup(req: schemas.LoginRequest, db: Session = Depends(database.get_db)):
    existing = db.query(models.User).filter(models.User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ce nom d'utilisateur est déjà pris.")
    
    pwd_hash = hashlib.sha256(req.password.encode()).hexdigest()
    user = models.User(
        username=req.username,
        password_hash=pwd_hash,
        role="analyste"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "status": "success",
        "username": user.username,
        "role": user.role,
        "message": "Inscription réussie"
    }

@app.post("/api/user/update", response_model=schemas.LoginResponse)
def update_user(req: schemas.UserUpdate, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé.")
    
    if req.new_username and req.new_username != req.username:
        existing = db.query(models.User).filter(models.User.username == req.new_username).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ce nouveau nom d'utilisateur est déjà pris.")
        user.username = req.new_username
        
    if req.new_password:
        pwd_hash = hashlib.sha256(req.new_password.encode()).hexdigest()
        user.password_hash = pwd_hash
        
    db.commit()
    db.refresh(user)
    return {
        "status": "success",
        "username": user.username,
        "role": user.role,
        "message": "Profil mis à jour avec succès"
    }


@app.get("/api/alerts", response_model=List[schemas.AlertSchema])
def get_alerts(db: Session = Depends(database.get_db)):
    return db.query(models.Alert).order_by(models.Alert.id.desc()).all()

@app.post("/api/alerts/read-all")
def read_all_alerts(db: Session = Depends(database.get_db)):
    db.query(models.Alert).filter(models.Alert.is_read == 0).update({models.Alert.is_read: 1})
    db.commit()
    return {"status": "success", "message": "Toutes les alertes ont été marquées comme lues."}

@app.post("/api/alerts/{alert_id}/read")
def read_alert(alert_id: int, db: Session = Depends(database.get_db)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte non trouvée")
    alert.is_read = 1
    db.commit()
    return {"status": "success", "message": f"Alerte {alert_id} marquée comme lue."}

@app.delete("/api/alerts/{alert_id}")
def delete_alert(alert_id: int, db: Session = Depends(database.get_db)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte non trouvée")
    db.delete(alert)
    db.commit()
    return {"status": "success", "message": f"Alerte {alert_id} supprimée."}

@app.delete("/api/alerts")
def delete_alerts(only_read: bool = False, db: Session = Depends(database.get_db)):
    query = db.query(models.Alert)
    if only_read:
        query = query.filter(models.Alert.is_read == 1)
    deleted_count = query.delete(synchronize_session=False)
    db.commit()
    return {"status": "success", "message": f"{deleted_count} alertes supprimées."}






# --- DOCUMENTS & AUTO-COLLECTION ENDPOINTS ---

@app.get("/api/documents")
def get_documents(db: Session = Depends(database.get_db)):
    docs = db.query(models.Document).order_by(models.Document.id.desc()).all()
    result = []
    for d in docs:
        result.append({
            "id": d.id,
            "filename": d.filename,
            "file_path": d.file_path,
            "source_url": d.source_url,
            "created_at": d.created_at,
            "company_name": d.company.name if d.company else "Unknown Company",
            "ticker": d.company.ticker if d.company else "N/A"
        })
    return result

@app.get("/api/documents/{doc_id}/download")
def download_document(doc_id: int, db: Session = Depends(database.get_db)):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Fichier PDF introuvable sur le disque")
    return FileResponse(doc.file_path, filename=doc.filename, media_type="application/pdf")

@app.get("/api/sources", response_model=List[schemas.ScrapeSource])
def get_sources(db: Session = Depends(database.get_db)):
    sources = db.query(models.ScrapeSource).all()
    if not sources:
        # Seed default sources if empty
        default_sources = [
            models.ScrapeSource(name="AMMC - États financiers", url="https://www.ammc.ma/fr/liste-etats-financiers-emetteurs")
        ]
        for src in default_sources:
            db.add(src)
        db.commit()
        sources = db.query(models.ScrapeSource).all()
    return sources

@app.post("/api/sources", response_model=schemas.ScrapeSource)
def create_source(source: schemas.ScrapeSourceCreate, db: Session = Depends(database.get_db)):
    existing = db.query(models.ScrapeSource).filter(models.ScrapeSource.url == source.url).first()
    if existing:
        raise HTTPException(status_code=400, detail="Cette source existe déjà.")
    new_src = models.ScrapeSource(name=source.name, url=source.url)
    db.add(new_src)
    db.commit()
    db.refresh(new_src)
    return new_src

@app.delete("/api/sources/{source_id}")
def delete_source(source_id: int, db: Session = Depends(database.get_db)):
    src = db.query(models.ScrapeSource).filter(models.ScrapeSource.id == source_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Source non trouvée")
    db.delete(src)
    db.commit()
    return {"status": "success", "message": "Source de collecte supprimée"}

async def run_scraper_bg():
    db = database.SessionLocal()
    try:
        await scraper.run_scraper(db)
    finally:
        db.close()

@app.post("/api/sources/trigger")
def trigger_scraping(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_scraper_bg)
    return {"status": "success", "message": "La collecte automatique en arrière-plan a été lancée."}


@app.get("/health")
def health():
    return {"status": "ok", "service": "Unified CDG Financial Agent"}

# --- STATIC FILES ---

@app.get("/")
def read_index():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return {"message": "CDG Capital API is running. Visit /docs for API documentation."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)