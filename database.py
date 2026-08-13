from sqlalchemy import create_engine, Column, Integer, String, Date, ForeignKey, UniqueConstraint, Boolean, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

SQLALCHEMY_DATABASE_URL = "sqlite:///./habits.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    emoji = Column(String, default="🎯")
    color = Column(String, default="#6c63ff")
    description = Column(String, default="")
    active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

    tasks = relationship("Task", back_populates="goal")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    order = Column(Integer, default=0)
    category = Column(String, default="general")   # "apsc" | "job" | "personal" | "general"
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=True)
    optional = Column(Boolean, default=False)

    completions = relationship("TaskCompletion", back_populates="task", cascade="all, delete-orphan")
    goal = relationship("Goal", back_populates="tasks")


class TaskCompletion(Base):
    __tablename__ = "task_completions"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    completion_date = Column(Date, nullable=False)

    __table_args__ = (UniqueConstraint("task_id", "completion_date", name="uq_task_date"),)

    task = relationship("Task", back_populates="completions")


class MiscTask(Base):
    __tablename__ = "misc_tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    task_date = Column(Date, nullable=False)
    done = Column(Boolean, default=False)


DEFAULT_GOALS = [
    {"name": "APSC 2025", "emoji": "📚", "color": "#e67e22",
     "description": "Assam PSC — 2×30 min daily maintenance (Current Affairs + PYQ)"},
    {"name": "Job Switch", "emoji": "💼", "color": "#3498db",
     "description": "Data Engineer — 13-week Build + Depth track (90 min/day)"},
    {"name": "Health", "emoji": "💪", "color": "#2ecc71",
     "description": "Daily movement & energy"},
]

DEFAULT_TASKS = [
    {"name": "Current Affairs + Assam GK", "category": "apsc", "goal_idx": 0},
    {"name": "PYQ Practice — active recall", "category": "apsc", "goal_idx": 0},
    {"name": "Build Lane — PySpark / LangChain / RAG", "category": "job", "goal_idx": 1, "optional": True},
    {"name": "Depth Lane — DDIA + Design Patterns", "category": "job", "goal_idx": 1, "optional": True},
    {"name": "Exercise / Jumprope", "category": "personal", "goal_idx": 2},
]


def init_db():
    Base.metadata.create_all(bind=engine)

    # Migrate existing tasks table — add new columns if absent
    with engine.connect() as conn:
        for col_sql in [
            "ALTER TABLE tasks ADD COLUMN category VARCHAR DEFAULT 'general'",
            "ALTER TABLE tasks ADD COLUMN goal_id INTEGER",
            "ALTER TABLE tasks ADD COLUMN optional BOOLEAN DEFAULT 0",
        ]:
            try:
                conn.execute(text(col_sql))
                conn.commit()
            except Exception:
                pass  # column already exists

    db = SessionLocal()
    try:
        if db.query(Goal).count() == 0:
            goals = []
            for i, g in enumerate(DEFAULT_GOALS):
                goal = Goal(
                    name=g["name"], emoji=g["emoji"],
                    color=g["color"], description=g["description"],
                    sort_order=i,
                )
                db.add(goal)
                goals.append(goal)
            db.commit()
            for g in goals:
                db.refresh(g)

            if db.query(Task).count() == 0:
                for i, t in enumerate(DEFAULT_TASKS):
                    gi = t.get("goal_idx")
                    db.add(Task(
                        name=t["name"], order=i,
                        category=t.get("category", "general"),
                        goal_id=goals[gi].id if gi is not None else None,
                        optional=t.get("optional", False),
                    ))
                db.commit()
        elif db.query(Task).count() == 0:
            for i, t in enumerate(DEFAULT_TASKS):
                db.add(Task(name=t["name"], order=i, category=t.get("category", "general")))
            db.commit()
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
