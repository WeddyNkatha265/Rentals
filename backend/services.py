from datetime import date
from sqlalchemy.orm import Session
from models import House, Tenant, HouseTenant, Invoice, Payment, Notification
from utils import month_bounds, now_ts, due_date_for_month, today_date, settings_int

def get_or_create_house_invoice(db: Session, house_id: int, for_date: date):
    start, end = month_bounds(for_date)
    inv = db.query(Invoice).filter(
        Invoice.house_id == house_id,
        Invoice.period_start == start,
        Invoice.period_end == end
    ).first()
    if inv:
        return inv
    house = db.query(House).get(house_id)
    inv = Invoice(
        house_id=house_id,
        period_start=start,
        period_end=end,
        amount_due=house.monthly_rent,
        due_date=due_date_for_month(start),
        status="pending",
        created_at=now_ts()
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv

def apply_payment_status(db: Session, invoice_id: int):
    inv = db.query(Invoice).get(invoice_id)
    total = sum(p.amount for p in inv.payments if p.status == "confirmed")
    inv.status = "paid" if total >= inv.amount_due else ("partially_paid" if total > 0 else "pending")
    db.commit()
    return inv

def create_payment(db: Session, house_id: int, invoice_id: int, method: str, amount: int, tenant_id: int, tx_ref: str | None, msisdn: str | None):
    rel = db.query(HouseTenant).filter(HouseTenant.house_id == house_id, HouseTenant.tenant_id == tenant_id, HouseTenant.status == "active").first()
    if not rel:
        raise ValueError("Tenant is not assigned to this house")
    pay = Payment(
        house_id=house_id,
        invoice_id=invoice_id,
        tenant_id=tenant_id,
        method=method,
        amount=amount,
        tx_ref=tx_ref,
        mpesa_msisdn=msisdn,
        paid_at=now_ts(),
        status="confirmed",
        notes=None
    )
    db.add(pay)
    db.commit()
    db.refresh(pay)
    return pay

def send_sms(db: Session, tenant_id: int, msg: str, type_: str, ref_entity: str | None):
    print(f"SMS to tenant {tenant_id}: {msg}")
    notif = Notification(
        tenant_id=tenant_id,
        type=type_,
        channel="sms",
        message=msg,
        status="sent",
        ref_entity=ref_entity,
        sent_at=now_ts()
    )
    db.add(notif)
    db.commit()
    return notif

def send_receipt_for_payment(db: Session, payment_id: int):
    pay = db.query(Payment).get(payment_id)
    house = db.query(House).get(pay.house_id)
    tenant = db.query(Tenant).get(pay.tenant_id)
    msg = (
        f"Murithi's Homes: Payment received.\n"
        f"House: {house.number}\nPayer: {tenant.full_name}\n"
        f"Amount: KES {pay.amount}\nMethod: {pay.method.title()}\nRef: {pay.tx_ref or 'N/A'}"
    )
    send_sms(db, tenant.id, msg, "receipt", f"payment:{payment_id}")

def house_total_received(db: Session, house_id: int):
    return sum(p.amount for p in db.query(Payment).filter(Payment.house_id == house_id, Payment.status == "confirmed").all())
