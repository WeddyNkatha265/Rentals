from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from base import Base, engine, get_db
from models import House, Tenant, HouseTenant, Invoice, Payment
from services import (
    get_or_create_house_invoice, create_payment, apply_payment_status,
    send_receipt_for_payment, house_total_received
)
from pydantic import BaseModel
from datetime import date
from utils import today_date

app = FastAPI(title="Murithi's Homes API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"name": "Murithi's Homes API", "status": "ok"}

# DTOs
class HouseCreate(BaseModel):
    number: int
    type: str
    monthly_rent: int

class TenantCreate(BaseModel):
    full_name: str
    phone: str
    email: str | None = None

class HouseTenantAdd(BaseModel):
    tenant_id: int

class PaymentCreate(BaseModel):
    house_id: int
    tenant_id: int
    method: str
    amount: int
    tx_ref: str | None = None
    msisdn: str | None = None

# Stats for dashboard (finance only)
@app.get("/stats")
def stats(db: Session = Depends(get_db)):
    houses = db.query(House).filter(House.is_active == True).all()
    units = len(houses)
    expected = sum(h.monthly_rent for h in houses)

    start = today_date().replace(day=1)
    payments = db.query(Payment).all()
    received = sum(p.amount for p in payments if p.status == "confirmed" and p.paid_at.date() >= start)
    outstanding = max(expected - received, 0)

    # Top houses by revenue (current month)
    house_sums = {}
    for h in houses:
        house_sums[h.number] = sum(p.amount for p in db.query(Payment).filter(
            Payment.house_id == h.id,
            Payment.status == "confirmed",
            Payment.paid_at >= start
        ).all())
    top = sorted(house_sums.items(), key=lambda kv: kv[1], reverse=True)[:3]
    top_houses = [{"house_number": hn, "received": amt} for hn, amt in top]

    # Recent payments
    recent = []
    for p in db.query(Payment).order_by(Payment.paid_at.desc()).limit(10).all():
        h = db.query(House).get(p.house_id)
        t = db.query(Tenant).get(p.tenant_id)
        recent.append({
            "house_number": h.number, "tenant_name": t.full_name,
            "amount": p.amount, "method": p.method, "paid_at": p.paid_at.isoformat()
        })

    return {
        "units": units,
        "expected": expected,
        "received": received,
        "outstanding": outstanding,
        "top_houses": top_houses,
        "recent_payments": recent
    }

# Houses
@app.post("/houses")
def create_house(payload: HouseCreate, db: Session = Depends(get_db)):
    exists = db.query(House).filter(House.number == payload.number).first()
    if exists:
        raise HTTPException(400, "House number exists")
    h = House(number=payload.number, type=payload.type, monthly_rent=payload.monthly_rent, is_active=True)
    db.add(h); db.commit(); db.refresh(h)
    return {"id": h.id}

@app.get("/houses")
def list_houses(db: Session = Depends(get_db)):
    houses = db.query(House).order_by(House.number.asc()).all()
    result = []
    for h in houses:
        rels = db.query(HouseTenant).filter(HouseTenant.house_id == h.id, HouseTenant.status == "active").all()
        tenants = []
        for rel in rels:
            t = db.query(Tenant).get(rel.tenant_id)
            tenants.append({"id": t.id, "full_name": t.full_name, "phone": t.phone, "email": t.email})
        total_received = house_total_received(db, h.id)
        result.append({
            "id": h.id, "number": h.number, "type": h.type,
            "monthly_rent": h.monthly_rent, "tenants": tenants,
            "total_received": total_received
        })
    return result

@app.post("/houses/{house_id}/tenants")
def add_tenant_to_house(house_id: int, payload: HouseTenantAdd, db: Session = Depends(get_db)):
    h = db.query(House).get(house_id)
    t = db.query(Tenant).get(payload.tenant_id)
    if not h or not t:
        raise HTTPException(404, "House or tenant not found")
    existing = db.query(HouseTenant).filter(
        HouseTenant.house_id == house_id, HouseTenant.tenant_id == payload.tenant_id, HouseTenant.status == "active"
    ).first()
    if existing:
        raise HTTPException(400, "Tenant already assigned to this house")
    rel = HouseTenant(house_id=house_id, tenant_id=payload.tenant_id, status="active", start_date=today_date(), end_date=None)
    db.add(rel); db.commit(); db.refresh(rel)
    return {"id": rel.id, "status": "assigned"}

@app.delete("/houses/{house_id}/tenants/{tenant_id}")
def remove_tenant_from_house(house_id: int, tenant_id: int, db: Session = Depends(get_db)):
    rel = db.query(HouseTenant).filter(
        HouseTenant.house_id == house_id, HouseTenant.tenant_id == tenant_id, HouseTenant.status == "active"
    ).first()
    if not rel:
        raise HTTPException(404, "Assignment not found")
    rel.status = "ended"
    rel.end_date = today_date()
    db.commit()
    return {"status": "ended"}

# Tenants
@app.post("/tenants")
def create_tenant(payload: TenantCreate, db: Session = Depends(get_db)):
    t = Tenant(full_name=payload.full_name, phone=payload.phone, email=payload.email, is_active=True)
    db.add(t); db.commit(); db.refresh(t)
    return {"id": t.id}

@app.get("/tenants")
def list_tenants(db: Session = Depends(get_db)):
    # show active and former tenants with last known house assignment and end_date
    rels = db.query(HouseTenant).all()
    merged = []
    for rel in rels:
        t = db.query(Tenant).get(rel.tenant_id)
        h = db.query(House).get(rel.house_id)
        merged.append({
            "id": t.id,
            "full_name": t.full_name,
            "phone": t.phone,
            "email": t.email,
            "status": rel.status,             # 'active' or 'ended'
            "house_number": h.number,
            "start_date": rel.start_date.isoformat(),
            "end_date": rel.end_date.isoformat() if rel.end_date else None
        })
    # also include tenants never assigned to any house
    assigned_ids = {m["id"] for m in merged}
    unassigned = db.query(Tenant).filter(Tenant.id.notin_(assigned_ids)).all()
    for t in unassigned:
        merged.append({
            "id": t.id,
            "full_name": t.full_name,
            "phone": t.phone,
            "email": t.email,
            "status": "unassigned",
            "house_number": None,
            "start_date": None,
            "end_date": None
        })
    return merged

@app.delete("/tenants/{tenant_id}")
def soft_delete_tenant(tenant_id: int, db: Session = Depends(get_db)):
    t = db.query(Tenant).get(tenant_id)
    if not t:
        raise HTTPException(404, "Tenant not found")
    t.is_active = False
    # end any active house assignments
    rels = db.query(HouseTenant).filter(HouseTenant.tenant_id == tenant_id, HouseTenant.status == "active").all()
    for rel in rels:
        rel.status = "ended"
        rel.end_date = today_date()
    db.commit()
    return {"status": "inactive"}

# Payments
@app.get("/payments")
def list_payments(db: Session = Depends(get_db)):
    ps = db.query(Payment).order_by(Payment.paid_at.desc()).all()
    result = []
    for p in ps:
        h = db.query(House).get(p.house_id)
        t = db.query(Tenant).get(p.tenant_id)
        result.append({
            "id": p.id,
            "house_number": h.number,
            "tenant_name": t.full_name,
            "method": p.method,
            "amount": p.amount,
            "paid_at": p.paid_at.isoformat(),
            "tx_ref": p.tx_ref
        })
    return result

@app.post("/payments")
def record_payment(payload: PaymentCreate, db: Session = Depends(get_db)):
    if payload.method not in ("cash", "mpesa"):
        raise HTTPException(400, "Invalid method")
    h = db.query(House).get(payload.house_id)
    t = db.query(Tenant).get(payload.tenant_id)
    if not h or not t:
        raise HTTPException(404, "House or tenant not found")
    rel = db.query(HouseTenant).filter(HouseTenant.house_id == h.id, HouseTenant.tenant_id == t.id, HouseTenant.status == "active").first()
    if not rel:
        raise HTTPException(400, "Tenant is not assigned to this house")
    inv = get_or_create_house_invoice(db, h.id, today_date())
    try:
        pay = create_payment(
            db, house_id=h.id, invoice_id=inv.id, method=payload.method, amount=payload.amount,
            tenant_id=t.id, tx_ref=payload.tx_ref, msisdn=payload.msisdn
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    inv = apply_payment_status(db, inv.id)
    send_receipt_for_payment(db, pay.id)
    return {"payment_id": pay.id, "invoice_status": inv.status}
