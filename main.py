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

from database import init_db, get_db, Task, TaskCompletion, MiscTask, Goal

app = FastAPI(title="Daily To-Do Tracker")

init_db()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


# ── Task Pydantic models ──────────────────────────────────────────────────────

class TaskOut(BaseModel):
    id: int
    name: str
    order: int
    category: str = "general"
    goal_id: Optional[int] = None
    optional: bool = False
    class Config:
        from_attributes = True


class ToggleRequest(BaseModel):
    task_id: int
    date: str


class TaskCreate(BaseModel):
    name: str
    category: str = "general"
    goal_id: Optional[int] = None
    optional: bool = False


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    goal_id: Optional[int] = None
    optional: Optional[bool] = None


class MiscTaskCreate(BaseModel):
    title: str
    date: str


class MiscTaskToggle(BaseModel):
    id: int


# ── Goal Pydantic models ──────────────────────────────────────────────────────

class GoalOut(BaseModel):
    id: int
    name: str
    emoji: str
    color: str
    description: str
    active: bool
    sort_order: int
    class Config:
        from_attributes = True


class GoalCreate(BaseModel):
    name: str
    emoji: str = "🎯"
    color: str = "#6c63ff"
    description: str = ""


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    emoji: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse(request, "index.html")


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
    # build goal lookup
    goals = {g.id: g for g in db.query(Goal).all()}
    result = []
    for t in tasks:
        g = goals.get(t.goal_id) if t.goal_id else None
        result.append({
            "task_id": t.id,
            "task_name": t.name,
            "done": t.id in done_ids,
            "category": t.category or "general",
            "goal_id": t.goal_id,
            "optional": bool(t.optional),
            "goal_color": g.color if g else None,
            "goal_emoji": g.emoji if g else None,
        })
    return result


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
            if day_labels[i] == "Sun":
                days["Sun"] = "rest"  # Sunday is always a rest day
            else:
                done = (t.id, wd) in done_set
                days[day_labels[i]] = done
                if done:
                    done_count += 1
        rows.append({
            "task_id": t.id,
            "task_name": t.name,
            "days": days,
            "done_count": done_count,
            "total": 6,
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
    # count active (non-Sunday) days in the month
    active_days = sum(1 for d in range(1, num_days + 1) if date(y, m, d).weekday() != 6)
    rows = []
    for t in tasks:
        days = {}
        done_count = 0
        for d in range(1, num_days + 1):
            dt = date(y, m, d)
            if dt.weekday() == 6:  # Sunday
                days[d] = "rest"
            else:
                done = (t.id, dt) in done_set
                days[d] = done
                if done:
                    done_count += 1
        rows.append({
            "task_id": t.id,
            "task_name": t.name,
            "days": days,
            "done_count": done_count,
            "total": active_days,
        })
    return {
        "year": y,
        "month": m,
        "month_name": calendar.month_name[m],
        "num_days": num_days,
        "active_days": active_days,
        "rows": rows,
    }


@app.post("/api/tasks", response_model=TaskOut)
def create_task(body: TaskCreate, db: Session = Depends(get_db)):
    max_order = db.query(Task).count()
    task = Task(
        name=body.name.strip(), order=max_order,
        category=body.category, goal_id=body.goal_id, optional=body.optional,
    )
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
def update_task(task_id: int, body: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    if body.name is not None:
        task.name = body.name.strip()
    if body.category is not None:
        task.category = body.category
    if body.goal_id is not None or body.goal_id == 0:
        task.goal_id = body.goal_id if body.goal_id != 0 else None
    if body.optional is not None:
        task.optional = body.optional
    db.commit()
    db.refresh(task)
    return task


# ── Goal endpoints ────────────────────────────────────────────────────────────

@app.get("/api/goals", response_model=List[GoalOut])
def get_goals(db: Session = Depends(get_db)):
    return db.query(Goal).filter(Goal.active == True).order_by(Goal.sort_order).all()


@app.post("/api/goals", response_model=GoalOut)
def create_goal(body: GoalCreate, db: Session = Depends(get_db)):
    max_order = db.query(Goal).count()
    goal = Goal(
        name=body.name.strip(), emoji=body.emoji,
        color=body.color, description=body.description, sort_order=max_order,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@app.put("/api/goals/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: int, body: GoalUpdate, db: Session = Depends(get_db)):
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(404, "Goal not found")
    if body.name is not None:
        goal.name = body.name.strip()
    if body.emoji is not None:
        goal.emoji = body.emoji
    if body.color is not None:
        goal.color = body.color
    if body.description is not None:
        goal.description = body.description
    if body.active is not None:
        goal.active = body.active
    db.commit()
    db.refresh(goal)
    return goal


@app.delete("/api/goals/{goal_id}")
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(404, "Goal not found")
    # unlink tasks before deleting
    db.query(Task).filter(Task.goal_id == goal_id).update({"goal_id": None})
    db.delete(goal)
    db.commit()
    return {"deleted": True}


@app.get("/api/goals/{goal_id}/stats")
def get_goal_stats(goal_id: int, db: Session = Depends(get_db)):
    today = date.today()
    week_ago = today - timedelta(days=6)
    tasks = db.query(Task).filter(Task.goal_id == goal_id).all()
    if not tasks:
        return {"goal_id": goal_id, "task_count": 0, "week_pct": 0, "streak": 0,
                "completed_last_7": 0, "possible_last_7": 0}
    task_ids = [t.id for t in tasks]
    completions = (
        db.query(TaskCompletion)
        .filter(TaskCompletion.task_id.in_(task_ids), TaskCompletion.completion_date >= week_ago)
        .all()
    )
    done_set = {(c.task_id, c.completion_date) for c in completions}
    total_possible = len(tasks) * 7
    total_done = len(done_set)
    week_pct = round(total_done / total_possible * 100) if total_possible else 0
    streak = 0
    for i in range(7):
        d = today - timedelta(days=i)
        if any((t.id, d) in done_set for t in tasks):
            streak += 1
        else:
            break
    return {
        "goal_id": goal_id, "task_count": len(tasks),
        "week_pct": week_pct, "streak": streak,
        "completed_last_7": total_done, "possible_last_7": total_possible,
    }


# ===================================================================
#  MISC TASKS
# ===================================================================

@app.get("/api/misc")
def get_misc_tasks(date: Optional[str] = None, db: Session = Depends(get_db)):
    d = datetime.strptime(date, "%Y-%m-%d").date() if date else datetime.today().date()
    tasks = db.query(MiscTask).filter(MiscTask.task_date == d).order_by(MiscTask.id).all()
    return [{"id": t.id, "title": t.title, "done": t.done} for t in tasks]


@app.post("/api/misc")
def create_misc_task(body: MiscTaskCreate, db: Session = Depends(get_db)):
    d = datetime.strptime(body.date, "%Y-%m-%d").date()
    task = MiscTask(title=body.title.strip(), task_date=d, done=False)
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"id": task.id, "title": task.title, "done": task.done}


@app.post("/api/misc/toggle")
def toggle_misc_task(body: MiscTaskToggle, db: Session = Depends(get_db)):
    task = db.query(MiscTask).filter(MiscTask.id == body.id).first()
    if not task:
        raise HTTPException(404, "Misc task not found")
    task.done = not task.done
    db.commit()
    return {"id": task.id, "done": task.done}


@app.delete("/api/misc/{task_id}")
def delete_misc_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(MiscTask).filter(MiscTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "Misc task not found")
    db.delete(task)
    db.commit()
    return {"deleted": True}
