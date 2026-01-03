from base import Base, engine, SessionLocal
from models import House

def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing_numbers = {h.number for h in db.query(House).all()}
        to_add = []
        # Houses 1-6: bedsitter KES 3500; 7-10: single KES 3000
        for n in range(1, 7):
            if n not in existing_numbers:
                to_add.append(House(number=n, type="bedsitter", monthly_rent=3500, is_active=True))
        for n in range(7, 11):
            if n not in existing_numbers:
                to_add.append(House(number=n, type="single", monthly_rent=3000, is_active=True))
        if to_add:
            db.add_all(to_add)
            db.commit()
            print(f"Seeded {len(to_add)} houses.")
        else:
            print("Houses already seeded.")
    finally:
        db.close()

if __name__ == "__main__":
    run()
