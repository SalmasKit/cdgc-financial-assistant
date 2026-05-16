from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    ticker = Column(String, index=True)
    sector = Column(String)

    ratios = relationship("Ratio", back_populates="company")
    analysis = relationship("Analysis", back_populates="company")
    documents = relationship("Document", back_populates="company", cascade="all, delete-orphan")

class Ratio(Base):
    __tablename__ = "ratios"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    year = Column(Integer)
    
    # Financial Statements (Actif, Passif, CPC)
    actif = Column(Float, nullable=True)
    passif = Column(Float, nullable=True)
    capitaux_propres = Column(Float, nullable=True)
    dettes_totales = Column(Float, nullable=True)
    chiffre_affaires = Column(Float, nullable=True)
    ebitda = Column(Float, nullable=True)
    resultat_net = Column(Float, nullable=True)
    
    # Ratios
    roe = Column(Float, nullable=True)
    roa = Column(Float, nullable=True)
    ebitda_margin = Column(Float, nullable=True)
    debt_to_equity = Column(Float, nullable=True)
    current_ratio = Column(Float, nullable=True)
    net_margin = Column(Float, nullable=True)
    revenue_cagr = Column(Float, nullable=True)

    company = relationship("Company", back_populates="ratios")

class Analysis(Base):
    __tablename__ = "analysis"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    year = Column(Integer)
    
    summary = Column(Text)
    anomalies = Column(Text)
    peer_comparison = Column(Text)

    company = relationship("Company", back_populates="analysis")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String, default="analyste")

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    message = Column(Text)
    type = Column(String)  # "info", "warning", "danger"
    is_read = Column(Integer, default=0)  # 0 for unread, 1 for read
    created_at = Column(String)

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    filename = Column(String)
    file_path = Column(String)
    source_url = Column(String, nullable=True)
    created_at = Column(String, default=lambda: datetime.now().isoformat())

    company = relationship("Company", back_populates="documents")

class ScrapeSource(Base):
    __tablename__ = "scrape_sources"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    url = Column(String)
    last_scraped = Column(String, nullable=True)
    status = Column(String, nullable=True)  # 'success', 'failed'

