from sqlalchemy import create_engine, Column, Integer, String, Float, JSON, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./pricing_engine.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class RateCard(Base):
    __tablename__ = "rate_cards"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    service_type = Column(String)  # ground_commercial, ground_residential, 2da, nda
    rates = Column(JSON)  # {weight: {zone: rate}}
    created_at = Column(DateTime, default=datetime.utcnow)


class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    packages = Column(JSON)  # list of package dicts
    column_mapping = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class Scenario(Base):
    __tablename__ = "scenarios"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    markup_pct = Column(Float)
    our_fuel_pct = Column(Float)
    published_fuel_pct = Column(Float)
    customer_fuel_pct = Column(Float)
    rate_card_ids = Column(JSON)  # list of rate card ids used
    invoice_id = Column(Integer)
    volume_multiplier = Column(Float, default=1.0)
    accessorial_config = Column(JSON)
    results = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class AccessorialConfig(Base):
    __tablename__ = "accessorial_configs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    config = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
