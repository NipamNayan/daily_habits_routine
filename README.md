# Daily Habits Routine

A simple daily habit & task tracker built with **FastAPI** and **SQLite**. Track your habits day by day, and review your progress in weekly and monthly views.

## Features

- Add, rename, and delete habits/tasks
- Toggle completion for any date
- **Daily view** — see what's done today
- **Weekly view** — Mon–Sun grid with completion counts
- **Monthly view** — full calendar grid per habit

## Tech Stack

- **Backend:** FastAPI, SQLAlchemy, SQLite
- **Frontend:** Vanilla JavaScript, HTML, CSS (Jinja2 templates)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/NipamNayan/daily_habits_routine.git
cd daily_habits_routine
```

### 2. Create a virtual environment and install dependencies

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Run the app

```bash
uvicorn main:app --reload
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create a task |
| PUT | `/api/tasks/{id}` | Rename a task |
| DELETE | `/api/tasks/{id}` | Delete a task |
| POST | `/api/toggle` | Toggle completion for a date |
| GET | `/api/today` | Today's completion status |
| GET | `/api/week` | Weekly view (supports `week_offset`) |
| GET | `/api/month` | Monthly view (supports `year` & `month`) |
