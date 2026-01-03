from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from base import Base, engine, get_db
from models import House, Tenant, Occupancy, Invoice, Payment
from services import (
    get_or_create_house_invoice, create_payment, apply_payment_status,
    send_receipt_for_payment
)
from pydantic import BaseModel
from datetime import date, datetime

app = FastAPI(title="Murithi's Homes API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# create tables
Base.metadata.create_all(bind=engine)

# Root route to avoid 404 at "/"
@app.get("/")
def root():
    return {"name": "Murithi's Homes API", "status": "ok"}

# DTOs
class HouseCreate(BaseModel):
    number: int
    type: str  # 'bedsitter' or 'single'
    monthly_rent: int

class TenantCreate(BaseModel):
    full_name: str
    phone: str
    email: str | None = None

class OccupantAdd(BaseModel):
    tenant_id: int

class PaymentCreate(BaseModel):
    house_id: int
    tenant_id: int | None = None
    method: str
    amount: int
    tx_ref: str | None = None
    msisdn: str | None = None

@app.get("/stats")
def stats(db: Session = Depends(get_db)):
    houses = db.query(House).filter(House.is_active == True).all()
    units = len(houses)
    active_leases = db.query(Occupancy).filter(Occupancy.status == "active").count()
    expected = sum(h.monthly_rent for h in houses)
    # current month received
    start = date.today().replace(day=1)
    payments = db.query(Payment).all()
    received = sum(p.amount for p in payments if p.status == "confirmed" and p.paid_at.date() >= start)
    return {"units": units, "activeLeases": active_leases, "expected": expected, "received": received}

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
        occs = db.query(Occupancy).filter(Occupancy.house_id == h.id, Occupancy.status == "active").all()
        occupants = []
        for o in occs:
            t = db.query(Tenant).get(o.tenant_id)
            occupants.append({"id": t.id, "full_name": t.full_name, "phone": t.phone, "email": t.email})
        result.append({
            "id": h.id, "number": h.number, "type": h.type,
            "monthly_rent": h.monthly_rent, "occupants": occupants
        })
    return result

@app.get("/houses/{house_id}")
def get_house(house_id: int, db: Session = Depends(get_db)):
    h = db.query(House).get(house_id)
    if not h:
        raise HTTPException(404, "House not found")
    inv = get_or_create_house_invoice(db, h.id, date.today())
    occs = db.query(Occupancy).filter(Occupancy.house_id == h.id, Occupancy.status == "active").all()
    occupants = []
    for o in occs:
        t = db.query(Tenant).get(o.tenant_id)
        occupants.append({"id": t.id, "full_name": t.full_name, "phone": t.phone})
    return {
        "id": h.id, "number": h.number, "type": h.type,
        "monthly_rent": h.monthly_rent,
        "invoice": {
            "id": inv.id, "status": inv.status, "amount_due": inv.amount_due,
            "due_date": inv.due_date.isoformat()
        },
        "occupants": occupants
    }

@app.post("/houses/{house_id}/occupants")
def add_occupant(house_id: int, payload: OccupantAdd, db: Session = Depends(get_db)):
    h = db.query(House).get(house_id)
    t = db.query(Tenant).get(payload.tenant_id)
    if not h or not t:
        raise HTTPException(404, "House or tenant not found")
    occ = Occupancy(house_id=house_id, tenant_id=payload.tenant_id, status="active")
    db.add(occ); db.commit(); db.refresh(occ)
    return {"id": occ.id}

@app.delete("/houses/{house_id}/occupants/{tenant_id}")
def remove_occupant(house_id: int, tenant_id: int, db: Session = Depends(get_db)):
    occ = db.query(Occupancy).filter(
        Occupancy.house_id == house_id,
        Occupancy.tenant_id == tenant_id,
        Occupancy.status == "active"
    ).first()
    if not occ:
        raise HTTPException(404, "Occupancy not found")
    occ.status = "ended"
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
    ts = db.query(Tenant).filter(Tenant.is_active == True).all()
    return [{"id": t.id, "full_name": t.full_name, "phone": t.phone, "email": t.email} for t in ts]

# Payments
@app.get("/payments")
def list_payments(db: Session = Depends(get_db)):
    ps = db.query(Payment).order_by(Payment.paid_at.desc()).all()
    result = []
    for p in ps:
        h = db.query(House).get(p.house_id)
        t = db.query(Tenant).get(p.tenant_id) if p.tenant_id else None
        result.append({
            "id": p.id,
            "house_number": h.number,
            "tenant_name": t.full_name if t else None,
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
    if not h:
        raise HTTPException(404, "House not found")
    inv = get_or_create_house_invoice(db, h.id, date.today())
    pay = create_payment(db,
        house_id=h.id, invoice_id=inv.id, method=payload.method, amount=payload.amount,
        tenant_id=payload.tenant_id, tx_ref=payload.tx_ref, msisdn=payload.msisdn
    )
    inv = apply_payment_status(db, inv.id)
    send_receipt_for_payment(db, pay.id)
    return {"payment_id": pay.id, "invoice_status": inv.status}
