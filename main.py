from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi import Request
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel
import calendar

from database import init_db, get_db, Task, TaskCompletion

app = FastAPI(title="Daily To-Do Tracker")

init_db()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


class TaskOut(BaseModel):
    id: int
    name: str
    order: int
    class Config:
        from_attributes = True


class ToggleRequest(BaseModel):
    task_id: int
    date: str


class TaskCreate(BaseModel):
    name: str


class TaskRename(BaseModel):
    name: str


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/tasks", response_model=List[TaskOut])
def get_tasks(db: Session = Depends(get_db)):
    return db.query(Task).order_by(Task.order).all()


@app.post("/api/toggle")
def toggle_completion(body: ToggleRequest, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == body.task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    d = datetime.strptime(body.date, "%Y-%m-%d").date()
    existing = (
        db.query(TaskCompletion)
        .filter(TaskCompletion.task_id == body.task_id, TaskCompletion.completion_date == d)
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        return {"done": False}
    else:
        db.add(TaskCompletion(task_id=body.task_id, completion_date=d))
        db.commit()
        return {"done": True}


@app.get("/api/today")
def get_today_status(for_date: Optional[str] = None, db: Session = Depends(get_db)):
    d = datetime.strptime(for_date, "%Y-%m-%d").date() if for_date else date.today()
    tasks = db.query(Task).order_by(Task.order).all()
    completions = (
        db.query(TaskCompletion.task_id)
        .filter(TaskCompletion.completion_date == d)
        .all()
    )
    done_ids = {c.task_id for c in completions}
    return [
        {"task_id": t.id, "task_name": t.name, "done": t.id in done_ids}
        for t in tasks
    ]


@app.get("/api/week")
def get_week_view(week_offset: int = 0, db: Session = Depends(get_db)):
    today = date.today()
    monday = today - timedelta(days=today.weekday()) + timedelta(weeks=week_offset)
    sunday = monday + timedelta(days=6)
    week_dates = [monday + timedelta(days=i) for i in range(7)]
    tasks = db.query(Task).order_by(Task.order).all()
    completions = (
        db.query(TaskCompletion)
        .filter(TaskCompletion.completion_date >= monday, TaskCompletion.completion_date <= sunday)
        .all()
    )
    done_set = {(c.task_id, c.completion_date) for c in completions}
    day_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    rows = []
    for t in tasks:
        days = {}
        done_count = 0
        for i, wd in enumerate(week_dates):
            done = (t.id, wd) in done_set
            days[day_labels[i]] = done
            if done:
                done_count += 1
        rows.append({
            "task_id": t.id,
            "task_name": t.name,
            "days": days,
            "done_count": done_count,
            "total": 7,
        })
    return {
        "week_start": monday.isoformat(),
        "week_end": sunday.isoformat(),
        "date_headers": {day_labels[i]: week_dates[i].isoformat() for i in range(7)},
        "rows": rows,
    }


@app.get("/api/month")
def get_month_view(year: Optional[int] = None, month: Optional[int] = None, db: Session = Depends(get_db)):
    today = date.today()
    y = year or today.year
    m = month or today.month
    _, num_days = calendar.monthrange(y, m)
    first = date(y, m, 1)
    last = date(y, m, num_days)
    tasks = db.query(Task).order_by(Task.order).all()
    completions = (
        db.query(TaskCompletion)
        .filter(TaskCompletion.completion_date >= first, TaskCompletion.completion_date <= last)
        .all()
    )
    done_set = {(c.task_id, c.completion_date) for c in completions}
    rows = []
    for t in tasks:
        days = {}
        done_count = 0
        for d in range(1, num_days + 1):
            dt = date(y, m, d)
            done = (t.id, dt) in done_set
            days[d] = done
            if done:
                done_count += 1
        rows.append({
            "task_id": t.id,
            "task_name": t.name,
            "days": days,
            "done_count": done_count,
            "total": num_days,
        })
    return {
        "year": y,
        "month": m,
        "month_name": calendar.month_name[m],
        "num_days": num_days,
        "rows": rows,
    }


@app.post("/api/tasks", response_model=TaskOut)
def create_task(body: TaskCreate, db: Session = Depends(get_db)):
    max_order = db.query(Task).count()
    task = Task(name=body.name.strip(), order=max_order)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    db.delete(task)
    db.commit()
    return {"deleted": True}


@app.put("/api/tasks/{task_id}", response_model=TaskOut)
def rename_task(task_id: int, body: TaskRename, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    task.name = body.name.strip()
    db.commit()
    db.refresh(task)
    return task
