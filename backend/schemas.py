from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class RatioBase(BaseModel):
    year: int
    actif: Optional[float] = None
    passif: Optional[float] = None
    chiffre_affaires: Optional[float] = None
    resultat_net: Optional[float] = None
    roe: Optional[float] = None
    roa: Optional[float] = None
    ebitda_margin: Optional[float] = None
    debt_to_equity: Optional[float] = None
    current_ratio: Optional[float] = None
    net_margin: Optional[float] = None
    revenue_cagr: Optional[float] = None

class RatioCreate(RatioBase):
    company_id: int

class Ratio(RatioBase):
    id: int
    company_id: int
    
    class Config:
        from_attributes = True

class AnalysisBase(BaseModel):
    year: int
    summary: Optional[str] = None
    anomalies: Optional[str] = None
    peer_comparison: Optional[str] = None

class AnalysisCreate(AnalysisBase):
    company_id: int

class Analysis(AnalysisBase):
    id: int
    company_id: int
    
    class Config:
        from_attributes = True

class FinancialDataBase(BaseModel):
    year: int
    bilan: Optional[Dict[str, Any]] = None
    cpc: Optional[Dict[str, Any]] = None
    tableau_financement: Optional[Dict[str, Any]] = None

class FinancialDataCreate(FinancialDataBase):
    company_id: int

class FinancialData(FinancialDataBase):
    id: int
    company_id: int
    
    class Config:
        from_attributes = True

class DocumentBase(BaseModel):
    filename: str
    file_path: str
    source_url: Optional[str] = None
    created_at: str

class DocumentCreate(DocumentBase):
    company_id: int

class Document(DocumentBase):
    id: int
    company_id: int

    class Config:
        from_attributes = True

class CompanyBase(BaseModel):
    name: str
    sector: str
    ticker: str

class CompanyCreate(CompanyBase):
    pass

class Company(CompanyBase):
    id: int
    ratios: List[Ratio] = []
    analysis: List[Analysis] = []
    documents: List[Document] = []
    
    class Config:
        from_attributes = True

class LeaderboardEntry(BaseModel):
    company_name: str
    ticker: str
    sector: str
    year: int
    value: float
    metric: str

class LoginRequest(BaseModel):
    username: str
    password: str

class UserUpdate(BaseModel):
    username: str  # current username
    new_username: Optional[str] = None
    new_password: Optional[str] = None
    
    class Config:
        from_attributes = True

class LoginResponse(BaseModel):
    status: str
    username: str
    role: str
    message: str

class AlertSchema(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: int
    created_at: str

    class Config:
        from_attributes = True

class ManualIngestRequest(BaseModel):
    company_name: str
    ticker: str
    sector: str
    fiscal_year: int
    total_assets: float
    current_assets: Optional[float] = None
    non_current_assets: Optional[float] = None
    total_equity: float
    total_debt: float
    current_liabilities: Optional[float] = None
    non_current_liabilities: Optional[float] = None
    revenue: float
    ebitda: float
    ebit: Optional[float] = None
    net_income: float

class ScrapeSourceBase(BaseModel):
    name: str
    url: str

class ScrapeSourceCreate(ScrapeSourceBase):
    pass

class ScrapeSource(ScrapeSourceBase):
    id: int
    last_scraped: Optional[str] = None
    status: Optional[str] = None

    class Config:
        from_attributes = True


