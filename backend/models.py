from sqlalchemy import Column, Integer, String, Boolean, Date, ForeignKey, Text, TIMESTAMP
from sqlalchemy.orm import relationship
from base import Base

class House(Base):
    __tablename__ = "houses"
    id = Column(Integer, primary_key=True)
    number = Column(Integer, unique=True, nullable=False)  # 1..10
    type = Column(String(20), nullable=False)  # 'bedsitter' or 'single'
    monthly_rent = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    occupancies = relationship("Occupancy", back_populates="house")
    invoices = relationship("Invoice", back_populates="house")
    payments = relationship("Payment", back_populates="house")

class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(Integer, primary_key=True)
    full_name = Column(String(120), nullable=False)
    phone = Column(String(20), nullable=False)  # +2547xxxxxxx
    email = Column(String(120))
    is_active = Column(Boolean, default=True, nullable=False)
    occupancies = relationship("Occupancy", back_populates="tenant")
    payments = relationship("Payment", back_populates="tenant")

class Occupancy(Base):
    __tablename__ = "occupancies"
    id = Column(Integer, primary_key=True)
    house_id = Column(Integer, ForeignKey("houses.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    status = Column(String(20), nullable=False, default="active")  # 'active','ended'
    house = relationship("House", back_populates="occupancies")
    tenant = relationship("Tenant", back_populates="occupancies")

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True)
    house_id = Column(Integer, ForeignKey("houses.id"), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    amount_due = Column(Integer, nullable=False)
    due_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False)  # 'pending','partially_paid','paid','overdue'
    created_at = Column(TIMESTAMP, nullable=False)
    house = relationship("House", back_populates="invoices")
    payments = relationship("Payment", back_populates="invoice")

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"))
    house_id = Column(Integer, ForeignKey("houses.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"))  # optional: payer
    method = Column(String(20), nullable=False)  # 'cash','mpesa'
    amount = Column(Integer, nullable=False)
    tx_ref = Column(String(80))
    mpesa_msisdn = Column(String(20))
    paid_at = Column(TIMESTAMP, nullable=False)
    status = Column(String(20), nullable=False)  # 'confirmed','reversed'
    notes = Column(Text)
    invoice = relationship("Invoice", back_populates="payments")
    house = relationship("House", back_populates="payments")
    tenant = relationship("Tenant", back_populates="payments")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    type = Column(String(30), nullable=False)  # 'receipt','due','overdue'
    channel = Column(String(20), nullable=False)  # 'sms'
    message = Column(Text, nullable=False)
    status = Column(String(20), nullable=False)  # 'sent','failed'
    ref_entity = Column(String(40))
    sent_at = Column(TIMESTAMP, nullable=False)
