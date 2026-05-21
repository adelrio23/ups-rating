import os
import tempfile
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json

from database import get_db, init_db, RateCard, Invoice, Scenario, AccessorialConfig
from invoice_parser import parse_invoice, parse_rate_card
from rate_engine import run_scenario, build_all_rate_source_maps
from export_generator import (
    generate_customer_excel, generate_internal_excel, generate_deal_brief
)

app = FastAPI(title="Parcel Pricing Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


# ── RATE CARDS ───────────────────────────────────────────────────────────────

@app.post("/rate-cards/upload")
async def upload_rate_card(
    file: UploadFile = File(...),
    name: str = Form(...),
    db: Session = Depends(get_db),
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        parsed = parse_rate_card(tmp_path)
    except Exception as e:
        raise HTTPException(400, f"Failed to parse rate card: {e}")
    finally:
        os.unlink(tmp_path)

    if not parsed:
        raise HTTPException(400, "No valid rate data found in file. Check format: rows=weights 1-150, columns=zones 2-8.")

    # Store one DB record per service found
    created = []
    for service_type, rates in parsed.items():
        existing = db.query(RateCard).filter_by(name=name, service_type=service_type).first()
        if existing:
            existing.rates = rates
        else:
            rc = RateCard(name=name, service_type=service_type, rates=rates)
            db.add(rc)
            db.flush()
            existing = rc
        db.commit()
        db.refresh(existing)
        created.append({
            "id": existing.id,
            "name": existing.name,
            "service_type": existing.service_type,
            "weight_count": len(rates),
            "zones": list({z for w in rates.values() for z in w.keys()}),
        })

    return {"rate_cards": created, "services_found": list(parsed.keys())}


@app.get("/rate-cards")
def list_rate_cards(db: Session = Depends(get_db)):
    cards = db.query(RateCard).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "service_type": c.service_type,
            "weight_count": len(c.rates) if c.rates else 0,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in cards
    ]


@app.delete("/rate-cards/{card_id}")
def delete_rate_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(RateCard).filter_by(id=card_id).first()
    if not card:
        raise HTTPException(404, "Rate card not found")
    db.delete(card)
    db.commit()
    return {"deleted": card_id}


@app.get("/rate-cards/{card_id}/preview")
def preview_rate_card(card_id: int, zone: int = 2, db: Session = Depends(get_db)):
    card = db.query(RateCard).filter_by(id=card_id).first()
    if not card:
        raise HTTPException(404, "Rate card not found")
    rates = card.rates or {}
    sample = {}
    for w in sorted(rates.keys(), key=lambda x: int(x))[:20]:
        sample[w] = rates[w]
    return {"name": card.name, "service_type": card.service_type, "sample": sample}


# ── INVOICES ─────────────────────────────────────────────────────────────────

@app.post("/invoices/upload")
async def upload_invoice(
    file: UploadFile = File(...),
    name: str = Form(...),
    db: Session = Depends(get_db),
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        parsed = parse_invoice(tmp_path)
    except Exception as e:
        raise HTTPException(400, f"Failed to parse invoice: {e}")
    finally:
        os.unlink(tmp_path)

    if not parsed["packages"]:
        raise HTTPException(400, "No package data found. Check that the invoice has weight, zone, and base charge columns.")

    inv = Invoice(
        name=name,
        packages=parsed["packages"],
        column_mapping=parsed["column_mapping"],
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    return {
        "id": inv.id,
        "name": inv.name,
        "total_packages": parsed["total_packages"],
        "corrections_flagged": parsed["corrections_flagged"],
        "auto_detected": parsed["auto_detected"],
        "column_mapping": parsed["column_mapping"],
        "raw_columns": parsed["raw_columns"],
        "fuel_pct_detected": parsed["fuel_pct_detected"],
        "service_breakdown": _count_services(parsed["packages"]),
        "zone_breakdown": _count_zones(parsed["packages"]),
    }


@app.post("/invoices/{invoice_id}/remap")
def remap_invoice_columns(
    invoice_id: int,
    mapping: dict,
    db: Session = Depends(get_db),
):
    inv = db.query(Invoice).filter_by(id=invoice_id).first()
    if not inv:
        raise HTTPException(404)
    inv.column_mapping = mapping
    db.commit()
    return {"updated": True}


@app.get("/invoices")
def list_invoices(db: Session = Depends(get_db)):
    invs = db.query(Invoice).all()
    return [
        {
            "id": i.id,
            "name": i.name,
            "total_packages": len(i.packages) if i.packages else 0,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in invs
    ]


@app.delete("/invoices/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter_by(id=invoice_id).first()
    if not inv:
        raise HTTPException(404)
    db.delete(inv)
    db.commit()
    return {"deleted": invoice_id}


def _count_services(packages):
    counts = {}
    for p in packages:
        s = p.get("service", "unknown")
        counts[s] = counts.get(s, 0) + 1
    return counts


def _count_zones(packages):
    counts = {}
    for p in packages:
        z = p.get("zone")
        if z:
            counts[str(z)] = counts.get(str(z), 0) + 1
    return counts


# ── SCENARIOS ────────────────────────────────────────────────────────────────

class ScenarioRequest(BaseModel):
    name: str
    invoice_id: int
    rate_card_ids: list[int]
    markup_pct: float = 5.0
    our_fuel_pct: float = 12.8
    published_fuel_pct: float = 17.1
    customer_fuel_pct: float = 17.1
    volume_multiplier: float = 1.0
    accessorial_config: dict = {}


@app.post("/scenarios/run")
def run_scenario_endpoint(req: ScenarioRequest, db: Session = Depends(get_db)):
    inv = db.query(Invoice).filter_by(id=req.invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")

    rate_cards = []
    for rc_id in req.rate_card_ids:
        rc = db.query(RateCard).filter_by(id=rc_id).first()
        if rc:
            rate_cards.append({
                "id": rc.id,
                "name": rc.name,
                "service_type": rc.service_type,
                "rates": rc.rates,
            })

    if not rate_cards:
        raise HTTPException(400, "No valid rate cards found")

    result = run_scenario(
        packages=inv.packages,
        rate_cards=rate_cards,
        our_fuel_pct=req.our_fuel_pct,
        published_fuel_pct=req.published_fuel_pct,
        customer_fuel_pct=req.customer_fuel_pct,
        markup_pct=req.markup_pct,
        accessorial_config=req.accessorial_config,
        volume_multiplier=req.volume_multiplier,
    )

    # Save scenario
    sc = Scenario(
        name=req.name,
        markup_pct=req.markup_pct,
        our_fuel_pct=req.our_fuel_pct,
        published_fuel_pct=req.published_fuel_pct,
        customer_fuel_pct=req.customer_fuel_pct,
        rate_card_ids=req.rate_card_ids,
        invoice_id=req.invoice_id,
        volume_multiplier=req.volume_multiplier,
        accessorial_config=req.accessorial_config,
        results=result["summary"],
    )
    db.add(sc)
    db.commit()
    db.refresh(sc)

    # Trim package audit for response size — keep full data but limit packages to 2000
    response_packages = result["packages"][:2000]

    return {
        "scenario_id": sc.id,
        "summary": result["summary"],
        "packages": response_packages,
        "rate_source_maps": result["rate_source_maps"],
        "truncated": len(result["packages"]) > 2000,
        "total_package_count": len(result["packages"]),
    }


@app.get("/scenarios")
def list_scenarios(db: Session = Depends(get_db)):
    scenarios = db.query(Scenario).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "markup_pct": s.markup_pct,
            "our_fuel_pct": s.our_fuel_pct,
            "customer_fuel_pct": s.customer_fuel_pct,
            "volume_multiplier": s.volume_multiplier,
            "results": s.results,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in scenarios
    ]


@app.delete("/scenarios/{scenario_id}")
def delete_scenario(scenario_id: int, db: Session = Depends(get_db)):
    sc = db.query(Scenario).filter_by(id=scenario_id).first()
    if not sc:
        raise HTTPException(404)
    db.delete(sc)
    db.commit()
    return {"deleted": scenario_id}


# ── EXPORTS ──────────────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    invoice_id: int
    rate_card_ids: list[int]
    markup_pct: float = 5.0
    our_fuel_pct: float = 12.8
    customer_fuel_pct: float = 17.1
    volume_multiplier: float = 1.0
    accessorial_config: dict = {}
    scenario_name: str = "Proposal"
    account_name: str = "Account"
    strategy_notes: str = ""
    risks: str = ""


def _build_export_result(req: ExportRequest, db: Session) -> dict:
    inv = db.query(Invoice).filter_by(id=req.invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    rate_cards = []
    for rc_id in req.rate_card_ids:
        rc = db.query(RateCard).filter_by(id=rc_id).first()
        if rc:
            rate_cards.append({"id": rc.id, "name": rc.name, "service_type": rc.service_type, "rates": rc.rates})
    if not rate_cards:
        raise HTTPException(400, "No rate cards")
    return run_scenario(
        packages=inv.packages,
        rate_cards=rate_cards,
        our_fuel_pct=req.our_fuel_pct,
        published_fuel_pct=req.our_fuel_pct,
        customer_fuel_pct=req.customer_fuel_pct,
        markup_pct=req.markup_pct,
        accessorial_config=req.accessorial_config,
        volume_multiplier=req.volume_multiplier,
    )


@app.post("/export/customer-excel")
def export_customer_excel(req: ExportRequest, db: Session = Depends(get_db)):
    result = _build_export_result(req, db)
    data = generate_customer_excel(result, req.scenario_name)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{req.scenario_name}_customer.xlsx"'},
    )


@app.post("/export/internal-excel")
def export_internal_excel(req: ExportRequest, db: Session = Depends(get_db)):
    result = _build_export_result(req, db)
    data = generate_internal_excel(result, req.scenario_name)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{req.scenario_name}_internal.xlsx"'},
    )


@app.post("/export/deal-brief")
def export_deal_brief(req: ExportRequest, db: Session = Depends(get_db)):
    result = _build_export_result(req, db)
    data = generate_deal_brief(result, req.account_name, req.strategy_notes, req.risks)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{req.account_name}_deal_brief.docx"'},
    )


# ── ACCESSORIAL CONFIG ───────────────────────────────────────────────────────

@app.post("/accessorials")
def save_accessorial_config(name: str, config: dict, db: Session = Depends(get_db)):
    ac = AccessorialConfig(name=name, config=config)
    db.add(ac)
    db.commit()
    db.refresh(ac)
    return {"id": ac.id, "name": ac.name}


@app.get("/accessorials")
def list_accessorial_configs(db: Session = Depends(get_db)):
    acs = db.query(AccessorialConfig).all()
    return [{"id": a.id, "name": a.name, "config": a.config} for a in acs]


# ── AUDIT ────────────────────────────────────────────────────────────────────

@app.post("/audit/cell")
def audit_cell(
    weight: int,
    zone: int,
    service: str,
    markup_pct: float,
    our_fuel_pct: float,
    customer_fuel_pct: float,
    rate_card_ids: list[int],
    db: Session = Depends(get_db),
):
    rate_cards = []
    for rc_id in rate_card_ids:
        rc = db.query(RateCard).filter_by(id=rc_id).first()
        if rc:
            rate_cards.append({"id": rc.id, "name": rc.name, "service_type": rc.service_type, "rates": rc.rates})

    rsm = build_all_rate_source_maps(rate_cards)
    svc_map = rsm.get(service, {})
    cell = svc_map.get(weight, {}).get(zone)

    if not cell:
        return {"found": False, "weight": weight, "zone": zone, "service": service}

    best_rate = cell["rate"]
    our_cost_base = best_rate * (1 + our_fuel_pct / 100)
    sell_base = best_rate * (1 + markup_pct / 100)
    sell_fuel = sell_base * customer_fuel_pct / 100

    # All carriers at this cell
    all_carriers = []
    for rc in rate_cards:
        if rc.get("service_type") != service:
            continue
        rates_data = rc.get("rates", {})
        if isinstance(rates_data, dict):
            w_data = rates_data.get(str(weight)) or rates_data.get(weight)
            if w_data:
                z_rate = w_data.get(str(zone)) or w_data.get(zone)
                if z_rate:
                    all_carriers.append({
                        "carrier_id": rc["id"],
                        "carrier_name": rc["name"],
                        "rate": z_rate,
                        "selected": rc["id"] == cell["carrier_id"],
                    })
    all_carriers.sort(key=lambda x: x["rate"])

    return {
        "found": True,
        "weight": weight,
        "zone": zone,
        "service": service,
        "best_rate": best_rate,
        "carrier_id": cell["carrier_id"],
        "carrier_name": cell["carrier_name"],
        "our_fuel_pct": our_fuel_pct,
        "our_cost_base": our_cost_base,
        "markup_pct": markup_pct,
        "sell_base": sell_base,
        "customer_fuel_pct": customer_fuel_pct,
        "sell_fuel": sell_fuel,
        "sell_total_before_accessorials": sell_base + sell_fuel,
        "all_carriers": all_carriers,
    }


@app.get("/health")
def health():
    return {"status": "ok"}
