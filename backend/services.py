from datetime import date
from sqlalchemy.orm import Session
from models import House, Tenant, HouseTenant, Invoice, Payment, Notification
from utils import month_bounds, make_month, now_ts, due_date_for_month, today_date

def get_or_create_invoice_by_year_month(db: Session, house_id: int, year: int, month: int):
    start, end = make_month(year, month)
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

def record_payment_chunk(db: Session, house_id: int, tenant_id: int, invoice_id: int, method: str, amount: int, tx_ref: str | None, msisdn: str | None, year: int, month: int):
    pay = Payment(
        house_id=house_id,
        invoice_id=invoice_id,
        tenant_id=tenant_id,
        method=method,
        amount=amount,
        tx_ref=tx_ref,
        mpesa_msisdn=msisdn,
        target_year=year,
        target_month=month,
        paid_at=now_ts(),
        status="confirmed",
        notes=None
    )
    db.add(pay)
    db.commit()
    db.refresh(pay)
    return pay

def allocate_payment(db: Session, house_id: int, tenant_id: int, method: str, amount: int, start_year: int, start_month: int, tx_ref: str | None, msisdn: str | None):
    # verify tenant-house relation
    rel = db.query(HouseTenant).filter(HouseTenant.house_id == house_id, HouseTenant.tenant_id == tenant_id, HouseTenant.status == "active").first()
    if not rel:
        raise ValueError("Tenant is not assigned to this house")

    allocations = []
    year, month = start_year, start_month
    remaining = amount

    while remaining > 0:
        inv = get_or_create_invoice_by_year_month(db, house_id, year, month)
        paid_so_far = sum(p.amount for p in inv.payments if p.status == "confirmed")
        due_here = max(inv.amount_due - paid_so_far, 0)

        if due_here == 0:
            # already fully paid; roll forward
            if month == 12:
                year += 1; month = 1
            else:
                month += 1
            continue

        to_apply = min(remaining, due_here)
        record_payment_chunk(db, house_id, tenant_id, inv.id, method, to_apply, tx_ref, msisdn, year, month)
        inv = apply_payment_status(db, inv.id)

        balance_after = max(inv.amount_due - sum(p.amount for p in inv.payments if p.status == "confirmed"), 0)
        allocations.append({
            "year": year,
            "month": month,
            "applied": to_apply,
            "status_after": inv.status,
            "remaining_balance": balance_after,
            "invoice_id": inv.id
        })
        remaining -= to_apply

        if remaining > 0:
            if month == 12:
                year += 1; month = 1
            else:
                month += 1

    # Combined receipt message (stubbed to notifications)
    tenant = db.query(Tenant).get(tenant_id)
    house = db.query(House).get(house_id)
    summary = ", ".join([f"{a['year']}-{str(a['month']).zfill(2)}: KES {a['applied']}" for a in allocations])
    msg = (
        f"Murithi's Homes: Payment for House {house.number}.\n"
        f"Payer: {tenant.full_name}\n"
        f"Allocations: {summary}\n"
        f"Ref: {tx_ref or 'N/A'}\n"
        f"Time: {now_ts().strftime('%Y-%m-%d %H:%M:%S')}"
    )
    save_notification(db, tenant_id, msg, "receipt", f"house:{house_id}")

    return allocations

def save_notification(db: Session, tenant_id: int, msg: str, type_: str, ref_entity: str | None):
    # Stub: saves to notifications; replace with actual SMS provider integration
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

def house_total_received(db: Session, house_id: int):
    return sum(p.amount for p in db.query(Payment).filter(Payment.house_id == house_id, Payment.status == "confirmed").all())
