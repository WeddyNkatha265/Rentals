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
from datetime import date, datetime
from utils import today_date, month_bounds, date_range
import calendar

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

# Finance dashboard
@app.get("/stats")
def stats(db: Session = Depends(get_db)):
    houses = db.query(House).filter(House.is_active == True).all()
    units = len(houses)
    expected = sum(h.monthly_rent for h in houses)

    start = today_date().replace(day=1)
    payments = db.query(Payment).all()
    received = sum(p.amount for p in payments if p.status == "confirmed" and p.paid_at.date() >= start)
    outstanding = max(expected - received, 0)

    # Top houses (current month)
    house_sums = []
    for h in houses:
        house_month_received = sum(p.amount for p in db.query(Payment).filter(Payment.house_id == h.id, Payment.status == "confirmed").all() if p.paid_at.date() >= start)
        house_sums.append({"house_number": h.number, "received": house_month_received})
    top_houses = sorted(house_sums, key=lambda x: x["received"], reverse=True)[:3]

    # Recent payments (exact timestamps)
    recent = []
    for p in db.query(Payment).order_by(Payment.paid_at.desc()).limit(10).all():
        h = db.query(House).get(p.house_id)
        t = db.query(Tenant).get(p.tenant_id)
        recent.append({
            "house_number": h.number, "tenant_name": t.full_name,
            "amount": p.amount, "method": p.method,
            "paid_at": p.paid_at.strftime("%Y-%m-%d %H:%M:%S")
        })

    # Monthly trend (last 6 months)
    trend = []
    today = today_date()
    for i in range(5, -1, -1):
        year = (today.year if today.month - i > 0 else today.year - 1) if (today.month - i) <= 0 else today.year
        month = ((today.month - i - 1) % 12) + 1
        m_start = date(year, month, 1)
        m_end = date(year, month, calendar.monthrange(year, month)[1])
        m_received = sum(p.amount for p in db.query(Payment).all() if p.status == "confirmed" and m_start <= p.paid_at.date() <= m_end)
        trend.append({"year": year, "month": month, "received": m_received})

    return {
        "units": units,
        "expected": expected,
        "received": received,
        "outstanding": outstanding,
        "top_houses": top_houses,
        "recent_payments": recent,
        "trend": trend
    }

# Houses with today's summary
@app.get("/houses")
def list_houses(db: Session = Depends(get_db)):
    today = today_date()
    houses = db.query(House).order_by(House.number.asc()).all()
    result = []
    for h in houses:
        rels = db.query(HouseTenant).filter(HouseTenant.house_id == h.id, HouseTenant.status == "active").all()
        tenants = []
        for rel in rels:
            t = db.query(Tenant).get(rel.tenant_id)
            tenants.append({"id": t.id, "full_name": t.full_name, "phone": t.phone, "email": t.email})
        total_received = house_total_received(db, h.id)

        # Today's summary
        today_payments = db.query(Payment).filter(Payment.house_id == h.id).all()
        today_payments = [p for p in today_payments if p.paid_at.date() == today and p.status == "confirmed"]
        today_received = sum(p.amount for p in today_payments)
        paid_names = []
        for p in today_payments:
            tn = db.query(Tenant).get(p.tenant_id)
            paid_names.append(tn.full_name)
        tenant_names = [x["full_name"] for x in tenants]
        unpaid_names = [n for n in tenant_names if n not in paid_names]

        result.append({
            "id": h.id, "number": h.number, "type": h.type,
            "monthly_rent": h.monthly_rent, "tenants": tenants,
            "total_received": total_received,
            "today_received": today_received,
            "today_paid": paid_names,
            "today_unpaid": unpaid_names
        })
    return result

@app.post("/houses")
def create_house(payload: HouseCreate, db: Session = Depends(get_db)):
    exists = db.query(House).filter(House.number == payload.number).first()
    if exists:
        raise HTTPException(400, "House number exists")
    h = House(number=payload.number, type=payload.type, monthly_rent=payload.monthly_rent, is_active=True)
    db.add(h); db.commit(); db.refresh(h)
    return {"id": h.id}

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
            "status": rel.status,
            "house_number": h.number,
            "start_date": rel.start_date.isoformat(),
            "end_date": rel.end_date.isoformat() if rel.end_date else None
        })
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
            "paid_at": p.paid_at.strftime("%Y-%m-%d %H:%M:%S"),
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

# Reports: daily, monthly, yearly
@app.get("/reports/daily/{year}/{month}/{day}")
def daily_report(year: int, month: int, day: int, db: Session = Depends(get_db)):
    day_date = date(year, month, day)
    houses = db.query(House).all()
    expected = sum(h.monthly_rent for h in houses)  # per month, but we show expected daily context
    payments = [p for p in db.query(Payment).all() if p.paid_at.date() == day_date and p.status == "confirmed"]
    total_received = sum(p.amount for p in payments)
    by_house = {}
    for h in houses:
        by_house[h.number] = {"received": 0, "paid": [], "unpaid": []}
        rels = db.query(HouseTenant).filter(HouseTenant.house_id == h.id, HouseTenant.status == "active").all()
        names = []
        for rel in rels:
            t = db.query(Tenant).get(rel.tenant_id)
            names.append(t.full_name)
        paid_today = []
        for p in payments:
            if p.house_id == h.id:
                tn = db.query(Tenant).get(p.tenant_id)
                paid_today.append(tn.full_name)
                by_house[h.number]["received"] += p.amount
        by_house[h.number]["paid"] = paid_today
        by_house[h.number]["unpaid"] = [n for n in names if n not in paid_today]
    return {
        "date": day_date.isoformat(),
        "expected_monthly": expected,
        "received_today": total_received,
        "houses": by_house
    }

@app.get("/reports/monthly/{year}/{month}")
def monthly_report(year: int, month: int, db: Session = Depends(get_db)):
    m_start = date(year, month, 1)
    m_end = date(year, month, calendar.monthrange(year, month)[1])
    houses = db.query(House).all()
    expected = sum(h.monthly_rent for h in houses)
    payments = [p for p in db.query(Payment).all() if p.status == "confirmed" and m_start <= p.paid_at.date() <= m_end]
    total_received = sum(p.amount for p in payments)
    outstanding = max(expected - total_received, 0)
    items = []
    for p in payments:
        h = db.query(House).get(p.house_id)
        t = db.query(Tenant).get(p.tenant_id)
        items.append({
            "house": h.number,
            "tenant": t.full_name,
            "amount": p.amount,
            "method": p.method,
            "paid_at": p.paid_at.strftime("%Y-%m-%d %H:%M:%S"),
            "tx_ref": p.tx_ref
        })
    return {
        "year": year, "month": month,
        "expected": expected,
        "received": total_received,
        "outstanding": outstanding,
        "payments": items
    }

@app.get("/reports/yearly/{year}")
def yearly_report(year: int, db: Session = Depends(get_db)):
    houses = db.query(House).all()
    monthly = []
    total_year = 0
    for month in range(1, 12 + 1):
        m_start = date(year, month, 1)
        m_end = date(year, month, calendar.monthrange(year, month)[1])
        m_received = sum(p.amount for p in db.query(Payment).all() if p.status == "confirmed" and m_start <= p.paid_at.date() <= m_end)
        total_year += m_received
        monthly.append({"month": month, "received": m_received})
    return {"year": year, "monthly": monthly, "total_received": total_year}
