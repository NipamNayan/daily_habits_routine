from sqlalchemy import create_engine, Column, Integer, String, Date, ForeignKey, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

SQLALCHEMY_DATABASE_URL = "sqlite:///./habits.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    order = Column(Integer, default=0)

    completions = relationship("TaskCompletion", back_populates="task", cascade="all, delete-orphan")


class TaskCompletion(Base):
    __tablename__ = "task_completions"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    completion_date = Column(Date, nullable=False)

    __table_args__ = (UniqueConstraint("task_id", "completion_date", name="uq_task_date"),)

    task = relationship("Task", back_populates="completions")


DEFAULT_TASKS = [
    "Read DDIA - 30 mins",
    "Current Affairs Revision video",
    "DNA - Youtube",
    "Lakshmikant - 1 hour",
    "PYQ - Analysis - 30 mins",
    "pyspark - 30 mins",
    "Assam Part - 30 mins",
    "Jumprope and exercise - 30 mins",
]


def init_db():
    Base.metadata.create_all(bind=engine)
    # Seed default tasks if table is empty
    db = SessionLocal()
    try:
        if db.query(Task).count() == 0:
            for i, name in enumerate(DEFAULT_TASKS):
                db.add(Task(name=name, order=i))
            db.commit()
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
