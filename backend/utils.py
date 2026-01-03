from datetime import date, datetime, timedelta
import calendar
import os

def month_bounds(dt: date):
    start = dt.replace(day=1)
    last_day = calendar.monthrange(dt.year, dt.month)[1]
    end = dt.replace(day=last_day)
    return start, end

def now_ts():
    return datetime.now()

def today_date():
    return date.today()

def due_date_for_month(dt: date):
    due_day = int(os.getenv("INVOICE_DUE_DAY", "5"))
    last_day = calendar.monthrange(dt.year, dt.month)[1]
    day = min(due_day, last_day)
    return dt.replace(day=day)

def settings_int(key, default):
    return int(os.getenv(key, str(default)))

def date_range(month_start: date, month_end: date):
    d = month_start
    while d <= month_end:
        yield d
        d += timedelta(days=1)
