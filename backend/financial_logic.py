"""
financial_logic.py — Data models + ratio computation engine.
CDG Capital Financial Statement Agent.
"""

from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

class ActifPassif(BaseModel):
    """Bilan comptable — structure Actif/Passif."""
    total_assets: Optional[float] = Field(None, description="Total Actif (MAD)")
    current_assets: Optional[float] = Field(None, description="Actif Circulant (MAD)")
    non_current_assets: Optional[float] = Field(None, description="Actif Immobilisé (MAD)")
    total_equity: Optional[float] = Field(None, description="Capitaux Propres (MAD)")
    total_debt: Optional[float] = Field(None, description="Dettes Totales (MAD)")
    current_liabilities: Optional[float] = Field(None, description="Dettes Court Terme (MAD)")
    non_current_liabilities: Optional[float] = Field(None, description="Dettes Long Terme (MAD)")


class CPC(BaseModel):
    """Compte de Produits et Charges."""
    revenue: Optional[float] = Field(None, description="Chiffre d'Affaires (MAD)")
    ebitda: Optional[float] = Field(None, description="Excédent Brut d'Exploitation (MAD)")
    ebit: Optional[float] = Field(None, description="Résultat d'Exploitation (MAD)")
    net_income: Optional[float] = Field(None, description="Résultat Net (MAD)")


class FinancialData(BaseModel):
    """Consolidated financial structure returned by Claude extraction."""
    company_name: Optional[str] = None
    fiscal_year: Optional[str] = None
    currency: str = "MAD"
    bilan: ActifPassif = Field(default_factory=ActifPassif)
    cpc: CPC = Field(default_factory=CPC)


# ---------------------------------------------------------------------------
# Ratio Computation
# ---------------------------------------------------------------------------

def _safe_div(numerator: Optional[float], denominator: Optional[float]) -> Optional[float]:
    """Safe division returning None if either operand is missing or denominator is zero."""
    if numerator is None or denominator is None:
        return None
    if denominator == 0:
        return None
    return round(numerator / denominator, 4)


def compute_ratios(data: FinancialData) -> dict:
    """
    Compute key financial ratios from structured FinancialData.

    Returns:
        dict with:
          - liquidity_ratio    (Actif Circulant / Dettes CT)
          - solvency_ratio     (Capitaux Propres / Total Actif)
          - roe                (Résultat Net / Capitaux Propres)
          - net_margin         (Résultat Net / CA)
          - debt_to_equity     (Dettes Totales / Capitaux Propres)
          - coverage_ratio     (EBITDA / Dettes Totales)
    """
    b = data.bilan
    c = data.cpc

    liquidity = _safe_div(b.current_assets, b.current_liabilities)
    solvency = _safe_div(b.total_equity, b.total_assets)
    roe = _safe_div(c.net_income, b.total_equity)
    net_margin = _safe_div(c.net_income, c.revenue)
    debt_to_equity = _safe_div(b.total_debt, b.total_equity)
    coverage = _safe_div(c.ebitda, b.total_debt)

    def pct(v: Optional[float]) -> Optional[str]:
        return f"{v * 100:.2f}%" if v is not None else None

    return {
        "liquidity_ratio": {
            "value": liquidity,
            "label": "Ratio de Liquidité Générale",
            "formula": "Actif Circulant / Dettes CT",
            "interpretation": _interpret_liquidity(liquidity),
        },
        "solvency_ratio": {
            "value": solvency,
            "formatted": pct(solvency),
            "label": "Ratio de Solvabilité",
            "formula": "Capitaux Propres / Total Actif",
            "interpretation": _interpret_solvency(solvency),
        },
        "roe": {
            "value": roe,
            "formatted": pct(roe),
            "label": "Return on Equity (ROE)",
            "formula": "Résultat Net / Capitaux Propres",
            "interpretation": _interpret_roe(roe),
        },
        "net_margin": {
            "value": net_margin,
            "formatted": pct(net_margin),
            "label": "Marge Nette",
            "formula": "Résultat Net / Chiffre d'Affaires",
            "interpretation": _interpret_margin(net_margin),
        },
        "debt_to_equity": {
            "value": debt_to_equity,
            "label": "Levier Financier (D/E)",
            "formula": "Dettes Totales / Capitaux Propres",
        },
        "coverage_ratio": {
            "value": coverage,
            "label": "Taux de Couverture de la Dette",
            "formula": "EBITDA / Dettes Totales",
        },
    }


# ---------------------------------------------------------------------------
# Threshold-based interpretations (Moroccan market benchmarks)
# ---------------------------------------------------------------------------

def _interpret_liquidity(v: Optional[float]) -> str:
    if v is None:
        return "Données insuffisantes"
    if v >= 2.0:
        return "Très bonne liquidité"
    if v >= 1.0:
        return "Liquidité acceptable"
    return "Risque de liquidité — actif circulant insuffisant"


def _interpret_solvency(v: Optional[float]) -> str:
    if v is None:
        return "Données insuffisantes"
    if v >= 0.5:
        return "Structure financière solide"
    if v >= 0.3:
        return "Solvabilité correcte"
    return "Endettement élevé — vigilance requise"


def _interpret_roe(v: Optional[float]) -> str:
    if v is None:
        return "Données insuffisantes"
    if v >= 0.15:
        return "Rentabilité excellente pour les actionnaires"
    if v >= 0.08:
        return "Rentabilité satisfaisante"
    if v >= 0:
        return "Rentabilité faible"
    return "Résultat négatif — destruction de valeur"


def _interpret_margin(v: Optional[float]) -> str:
    if v is None:
        return "Données insuffisantes"
    if v >= 0.10:
        return "Marge nette solide (>10%)"
    if v >= 0.05:
        return "Marge nette correcte"
    if v >= 0:
        return "Marge nette faible"
    return "Entreprise déficitaire"


# ---------------------------------------------------------------------------
# Utility: extract_financials (fallback regex-based extractor, no LLM)
# ---------------------------------------------------------------------------

import re


def extract_financials(raw_text: str) -> FinancialData:
    """
    Lightweight regex fallback extractor.
    Used as a sanity check or when Claude is unavailable.
    Searches for common Moroccan bilan keywords + numeric values.
    """

    def find_amount(pattern: str) -> Optional[float]:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            raw = match.group(1).replace(" ", "").replace(",", "").replace("\u202f", "")
            try:
                return float(raw)
            except ValueError:
                return None
        return None

    bilan = ActifPassif(
        total_assets=find_amount(r"total\s+actif[^\d]*([\d\s,]+)"),
        current_assets=find_amount(r"actif\s+circulant[^\d]*([\d\s,]+)"),
        total_equity=find_amount(r"capitaux\s+propres[^\d]*([\d\s,]+)"),
        total_debt=find_amount(r"(?:dettes?\s+totales?|total\s+passif\s+exigible)[^\d]*([\d\s,]+)"),
        current_liabilities=find_amount(r"dettes?\s+(?:à\s+)?court\s+terme[^\d]*([\d\s,]+)"),
    )
    cpc = CPC(
        revenue=find_amount(r"chiffre\s+d.affaires[^\d]*([\d\s,]+)"),
        ebitda=find_amount(r"(?:EBE|excédent\s+brut\s+d.exploitation)[^\d]*([\d\s,]+)"),
        net_income=find_amount(r"résultat\s+net[^\d]*([\d\s,]+)"),
    )
    return FinancialData(bilan=bilan, cpc=cpc)