from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from base import Base, engine, get_db
from models import House, Tenant, HouseTenant, Invoice, Payment
from services import get_or_create_invoice_by_year_month, allocate_payment, house_total_received
from pydantic import BaseModel
from datetime import date
from utils import today_date, make_month
import calendar

app = FastAPI(title="Murithi's Homes API")

app.add_middleware(
    CORSMiddleware,
#    allow_origins=["http://localhost:5174"],
    allow_origins=["https://murithis-rentals.netlify.app/"]
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
    gov_id: str
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
    target_year: int
    target_month: int

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

    # Top houses (month-to-date)
    house_sums = []
    for h in houses:
        month_received = sum(p.amount for p in db.query(Payment).filter(Payment.house_id == h.id, Payment.status == "confirmed").all() if p.paid_at.date() >= start)
        house_sums.append({"house_number": h.number, "received": month_received})
    top_houses = sorted(house_sums, key=lambda x: x["received"], reverse=True)[:3]

    # Recent payments with timestamps and target month
    recent = []
    for p in db.query(Payment).order_by(Payment.paid_at.desc()).limit(10).all():
        h = db.query(House).get(p.house_id)
        t = db.query(Tenant).get(p.tenant_id)
        recent.append({
            "house_number": h.number, "tenant_name": t.full_name,
            "amount": p.amount, "method": p.method,
            "paid_at": p.paid_at.strftime("%Y-%m-%d %H:%M:%S"),
            "for_month": f"{p.target_year}-{str(p.target_month).zfill(2)}"
        })

    # Trend: last 6 months totals
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

# Houses with today summary and unpaid months
@app.get("/houses")
def list_houses(db: Session = Depends(get_db)):
    cur_year = today_date().year
    today = today_date()
    houses = db.query(House).order_by(House.number.asc()).all()
    out = []
    for h in houses:
        rels = db.query(HouseTenant).filter(HouseTenant.house_id == h.id, HouseTenant.status == "active").all()
        tenants = []
        for rel in rels:
            t = db.query(Tenant).get(rel.tenant_id)
            tenants.append({"id": t.id, "full_name": t.full_name, "phone": t.phone, "gov_id": t.gov_id, "email": t.email})
        total_received = house_total_received(db, h.id)

        # today's summary
        today_payments = [p for p in db.query(Payment).filter(Payment.house_id == h.id).all() if p.paid_at.date() == today and p.status == "confirmed"]
        today_received = sum(p.amount for p in today_payments)
        paid_names = [db.query(Tenant).get(p.tenant_id).full_name for p in today_payments]
        tenant_names = [x["full_name"] for x in tenants]
        unpaid_names = [n for n in tenant_names if n not in paid_names]

        # unpaid months current year
        unpaid_months = []
        for m in range(1, 13):
            start, end = make_month(cur_year, m)
            inv = db.query(Invoice).filter(Invoice.house_id == h.id, Invoice.period_start == start, Invoice.period_end == end).first()
            if not inv:
                unpaid_months.append(m)
                continue
            paid_total = sum(p.amount for p in inv.payments if p.status == "confirmed")
            if paid_total < inv.amount_due:
                unpaid_months.append(m)

        out.append({
            "id": h.id, "number": h.number, "type": h.type,
            "monthly_rent": h.monthly_rent, "tenants": tenants,
            "total_received": total_received,
            "today_received": today_received,
            "today_paid": paid_names,
            "today_unpaid": unpaid_names,
            "unpaid_months_year": cur_year,
            "unpaid_months": unpaid_months
        })
    return out

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
    existing = db.query(HouseTenant).filter(HouseTenant.house_id == house_id, HouseTenant.tenant_id == payload.tenant_id, HouseTenant.status == "active").first()
    if existing:
        raise HTTPException(400, "Tenant already assigned to this house")
    rel = HouseTenant(house_id=house_id, tenant_id=payload.tenant_id, status="active", start_date=today_date(), end_date=None)
    db.add(rel); db.commit(); db.refresh(rel)
    return {"id": rel.id, "status": "assigned"}

@app.delete("/houses/{house_id}/tenants/{tenant_id}")
def remove_tenant_from_house(house_id: int, tenant_id: int, db: Session = Depends(get_db)):
    rel = db.query(HouseTenant).filter(HouseTenant.house_id == house_id, HouseTenant.tenant_id == tenant_id, HouseTenant.status == "active").first()
    if not rel:
        raise HTTPException(404, "Assignment not found")
    rel.status = "ended"
    rel.end_date = today_date()
    db.commit()
    return {"status": "ended"}

# Tenants
@app.post("/tenants")
def create_tenant(payload: TenantCreate, db: Session = Depends(get_db)):
    t = Tenant(full_name=payload.full_name, phone=payload.phone, gov_id=payload.gov_id, email=payload.email, is_active=True)
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
            "gov_id": t.gov_id,
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
            "gov_id": t.gov_id,
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

# Payments (with allocation)
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

    try:
        allocations = allocate_payment(
            db, house_id=h.id, tenant_id=t.id, method=payload.method,
            amount=payload.amount, start_year=payload.target_year, start_month=payload.target_month,
            tx_ref=payload.tx_ref, msisdn=payload.msisdn
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    return {"allocations": allocations}

# House yearly ledger: month-by-month status, remaining, and earliest join date
@app.get("/houses/{house_id}/ledger/{year}")
def house_year_ledger(house_id: int, year: int, db: Session = Depends(get_db)):
    h = db.query(House).get(house_id)
    if not h:
        raise HTTPException(404, "House not found")

    # earliest tenant start date on this house
    rels_all = db.query(HouseTenant).filter(HouseTenant.house_id == h.id).all()
    earliest = None
    for rel in rels_all:
        if earliest is None or rel.start_date < earliest:
            earliest = rel.start_date
    earliest_str = earliest.isoformat() if earliest else None

    items = []
    for m in range(1, 13):
        start, end = make_month(year, m)
        inv = db.query(Invoice).filter(Invoice.house_id == h.id, Invoice.period_start == start, Invoice.period_end == end).first()
        if not inv:
            # no invoice means not paid/never generated
            items.append({
                "year": year, "month": m,
                "state": "not_paid",
                "amount_due": h.monthly_rent, "paid_total": 0, "balance": h.monthly_rent,
                "details": []
            })
            continue
        paid_total = sum(p.amount for p in inv.payments if p.status == "confirmed")
        balance = max(inv.amount_due - paid_total, 0)
        state = "paid" if balance == 0 and paid_total >= inv.amount_due else ("partially_paid" if paid_total > 0 else "not_paid")
        # payment details for this invoice
        details = [{
            "payer": db.query(Tenant).get(p.tenant_id).full_name,
            "amount": p.amount,
            "method": p.method,
            "paid_at": p.paid_at.strftime("%Y-%m-%d %H:%M:%S")
        } for p in inv.payments if p.status == "confirmed"]
        items.append({
            "year": year, "month": m,
            "state": state,
            "amount_due": inv.amount_due, "paid_total": paid_total, "balance": balance,
            "details": details
        })

    return {"house_number": h.number, "first_tenant_joined": earliest_str, "items": items}
