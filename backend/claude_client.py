"""
claude_client.py — Anthropic SDK wrapper.
Two responsibilities:
  1. extract_structured_financials(): parse raw PDF text -> FinancialData via Claude.
  2. generate_executive_summary(): produce a 3-sentence strategic commentary in French.
"""

import json
import logging
import os
import re
from pathlib import Path

from dotenv import load_dotenv
import anthropic
from financial_logic import FinancialData, ActifPassif, CPC

# Load .env from project root (works whether you run from project dir or elsewhere)
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

logger = logging.getLogger(__name__)

api_key = os.environ.get("ANTHROPIC_API_KEY")
if not api_key:
    raise EnvironmentError(
        "ANTHROPIC_API_KEY not found. "
        "Create a .env file with ANTHROPIC_API_KEY=sk-ant-... or export it in your shell."
    )

_client = anthropic.AsyncAnthropic(api_key=api_key)
FALLBACK_MODELS = [
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
    "claude-opus-4-7"
]

async def _create_message_with_fallback(system: str, messages: list, max_tokens: int = 1024):
    """
    Tries calling the Anthropic API sequentially using the models in FALLBACK_MODELS.
    """
    last_error = None
    for model in FALLBACK_MODELS:
        try:
            logger.info(f"Tentation d'appel API avec le modèle {model}...")
            response = await _client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
            )
            logger.info(f"Succès avec le modèle {model}.")
            return response
        except Exception as e:
            logger.warning(f"Échec avec le modèle {model}: {e}")
            last_error = e
    if last_error:
        raise last_error
    raise RuntimeError("Tous les modèles d'IA configurés ont échoué.")


EXTRACTION_SYSTEM = """Tu es un expert-comptable et analyste financier senior specialise dans les normes marocaines (PCGE).
Tu lis des etats financiers bruts (texte extrait de PDF) et tu extrais les donnees structurees.

REGLES ABSOLUES:
- Reponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans commentaires.
- Si une valeur est introuvable, utilise null.
- Les montants sont en MAD (dirhams). Normalise-les en chiffres flottants (ex: "2 345 678" -> 2345678.0).
- Pour les banques, utilise "Total de l'actif" ou "Total du bilan" pour total_assets.
- Utilise "Capitaux Propres Part du Groupe" ou "Fonds propres" pour total_equity.
- Utilise "Produit Net Bancaire" (PNB) comme synonyme de revenue si le chiffre d'affaires n'est pas explicite.
- Deduis le benefice net du compte de produits et charges (CPC), pas du bilan.

FORMAT JSON ATTENDU:
{
  "company_name": "string ou null",
  "fiscal_year": "string (ex: 2023) ou null",
  "currency": "MAD",
  "bilan": {
    "total_assets": float ou null,
    "current_assets": float ou null,
    "non_current_assets": float ou null,
    "total_equity": float ou null,
    "total_debt": float ou null,
    "current_liabilities": float ou null,
    "non_current_liabilities": float ou null
  },
  "cpc": {
    "revenue": float ou null,
    "ebitda": float ou null,
    "ebit": float ou null,
    "net_income": float ou null
  }
}"""

COMMENTARY_SYSTEM = """Tu es un directeur financier senior chez CDG Capital.
Analyse les donnees et ratios fournis et genere une synthese structuree.

FORMAT DE REPONSE (JSON UNIQUEMENT):
{
  "summary": "Synthese globale en 2-3 phrases sur la performance et la sante financiere.",
  "anomalies": "Identification precise d'une anomalie ou d'un risque majeur (si aucun, mentionne 'Aucune anomalie critique détectée').",
  "peer_comparison": "Positionnement strategique par rapport au secteur et recommandation d'investissement."
}"""


async def extract_structured_financials(raw_text: str) -> FinancialData:
    truncated = raw_text[:48_000]
    user_prompt = (
        "Voici le texte brut extrait d'un etat financier marocain.\n"
        "Extrais et structure les donnees selon le format demande.\n\n"
        "--- TEXTE FINANCIER ---\n" + truncated + "\n--- FIN ---"
    )

    response = await _create_message_with_fallback(
        system=EXTRACTION_SYSTEM,
        messages=[{"role": "user", "content": user_prompt}],
        max_tokens=1024,
    )

    raw_json = response.content[0].text.strip()
    raw_json = re.sub(r"^```(?:json)?\s*", "", raw_json)
    raw_json = re.sub(r"\s*```$", "", raw_json)

    try:
        data = json.loads(raw_json)
        return FinancialData(
            company_name=data.get("company_name"),
            fiscal_year=data.get("fiscal_year"),
            currency=data.get("currency", "MAD"),
            bilan=ActifPassif(**{k: v for k, v in data.get("bilan", {}).items() if v is not None}),
            cpc=CPC(**{k: v for k, v in data.get("cpc", {}).items() if v is not None}),
        )
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        logger.error(f"Echec parsing JSON Claude: {e}\nReponse brute: {raw_json[:500]}")
        return FinancialData()


async def generate_executive_summary(data: FinancialData, ratios: dict) -> dict:
    def fmt(v) -> str:
        return "N/D" if v is None else str(v)

    ratio_lines = "\n".join([
        "- " + r["label"] + ": " + fmt(r.get("formatted") or r.get("value")) +
        (" — " + r["interpretation"] if r.get("interpretation") else "")
        for r in ratios.values()
    ])

    kpis_parts = []
    if data.cpc.revenue:
        kpis_parts.append("- CA: {:,.0f} {}".format(data.cpc.revenue, data.currency))
    if data.cpc.ebitda:
        kpis_parts.append("- EBE (EBITDA): {:,.0f} {}".format(data.cpc.ebitda, data.currency))
    if data.cpc.net_income:
        kpis_parts.append("- Resultat Net: {:,.0f} {}".format(data.cpc.net_income, data.currency))
    if data.bilan.total_assets:
        kpis_parts.append("- Total Actif: {:,.0f} {}".format(data.bilan.total_assets, data.currency))
    if data.bilan.total_equity:
        kpis_parts.append("- Capitaux Propres: {:,.0f} {}".format(data.bilan.total_equity, data.currency))
    if data.bilan.total_debt:
        kpis_parts.append("- Dettes Totales: {:,.0f} {}".format(data.bilan.total_debt, data.currency))

    kpis = "\n".join(kpis_parts) if kpis_parts else "Donnees non disponibles"

    user_prompt = (
        "Societe: " + (data.company_name or "Non identifiee") +
        " | Exercice: " + (data.fiscal_year or "N/D") + "\n\n"
        "DONNEES FINANCIERES CLES:\n" + kpis + "\n\n"
        "RATIOS CALCULES:\n" + ratio_lines + "\n\n"
        "Genere l'analyse structuree en JSON."
    )

    response = await _create_message_with_fallback(
        system=COMMENTARY_SYSTEM,
        messages=[{"role": "user", "content": user_prompt}],
        max_tokens=1024,
    )

    raw_json = response.content[0].text.strip()
    raw_json = re.sub(r"^```(?:json)?\s*", "", raw_json)
    raw_json = re.sub(r"\s*```$", "", raw_json)

    try:
        return json.loads(raw_json)
    except Exception as e:
        logger.error(f"Echec parsing JSON analyse: {e}")
        return {
            "summary": raw_json[:200],
            "anomalies": "N/D",
            "peer_comparison": "N/D"
        }


async def answer_financial_question(question: str, data: FinancialData, ratios: dict) -> str:
    """Answers a specific user question about the financial data."""
    def fmt(v) -> str:
        return "N/D" if v is None else str(v)

    ratio_lines = "\n".join([
        "- " + r["label"] + ": " + fmt(r.get("formatted") or r.get("value")) +
        (" — " + r["interpretation"] if r.get("interpretation") else "")
        for r in ratios.values()
    ])

    user_prompt = (
        f"Societe: {data.company_name or 'Non identifiee'} | Exercice: {data.fiscal_year or 'N/D'}\n\n"
        f"DONNEES FINANCIERES:\n"
        f"- CA: {fmt(data.cpc.revenue)}\n"
        f"- Resultat Net: {fmt(data.cpc.net_income)}\n"
        f"- Total Actif: {fmt(data.bilan.total_assets)}\n"
        f"- Capitaux Propres: {fmt(data.bilan.total_equity)}\n\n"
        f"RATIOS:\n{ratio_lines}\n\n"
        f"QUESTION DE L'UTILISATEUR: {question}\n\n"
        f"Reponds de maniere professionnelle, concise et analytique en tant qu'expert financier de CDG Capital."
    )

    response = await _create_message_with_fallback(
        system="Tu es l'assistant intelligent de CDG Capital, expert en analyse financiere.",
        messages=[{"role": "user", "content": user_prompt}],
        max_tokens=512,
    )
    return response.content[0].text.strip()