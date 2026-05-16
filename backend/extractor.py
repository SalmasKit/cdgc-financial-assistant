import pdfplumber
import anthropic
import json
import os
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages[:15]:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
    except Exception as e:
        print(f"Error reading PDF: {e}")
    return text

def analyze_financials_with_claude(text: str) -> Dict[str, Any]:
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set.")
        
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    
    prompt = f"""
    Tu es un analyste financier senior. Voici un rapport financier.
    TEXTE DU RAPPORT:
    {text[:45000]}
    
    Réponds UNIQUEMENT au format JSON strict.
    Structure:
    {{
      "company_name": "Nom",
      "ticker": "Ticker",
      "sector": "Secteur",
      "year": 2024,
      "etats_financiers": {{
        "actif": 1000000.0,
        "passif": 800000.0,
        "chiffre_affaires": 500000.0,
        "resultat_net": 50000.0
      }},
      "ratios": {{
        "roe": 0.15,
        "roa": 0.05,
        "ebitda_margin": 0.22,
        "debt_to_equity": 1.2,
        "current_ratio": 1.5,
        "net_margin": 0.10,
        "revenue_cagr": 0.05
      }},
      "analysis": {{
        "summary": "Résumé de l'interprétation des résultats.",
        "anomalies": "Commentaires explicatifs sur les anomalies.",
        "peer_comparison": "Analyse comparative par secteur et par période."
      }}
    }}
    """
    
    try:
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1500,
            temperature=0.1,
            timeout=120.0,
            system="Tu ne génères QUE du JSON valide.",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        content = response.content[0].text.strip()
        if content.startswith("```json"): content = content[7:-3]
        elif content.startswith("```"): content = content[3:-3]
        return json.loads(content)
    except Exception as e:
        print(f"Claude API Error: {e}")
        raise e
