# Daily Habits Routine

A goal-aware daily habit & task tracker built with **FastAPI** and **SQLite**. Designed around the **APSC + Job Switch dual-track plan** — track daily blocks, visualise goal progress, and protect yourself from burnout.

## Features

- **Goals** — create, edit, and delete overarching goals (APSC 2025, Job Switch, Health, etc.) with emoji, colour, and description
- **Goal progress cards** — 7-day completion % and current streak per goal
- **Day Context Banner** — tells you what kind of day it is (Build Lane / Depth Lane / Review / Rest) based on your weekly schedule
- **Category colour coding** — tasks tagged as 📚 APSC · 💼 Job · 💪 Personal · General, each shown with a coloured dot
- **Task–Goal linking** — assign any task to a goal from the manage panel
- **Optional tasks** — mark tasks as optional (⚡); toggle "Light Day" mode to hide them on low-energy days
- **Alternate / Ad-hoc Tasks** — per-day scratch pad for one-off tasks
- **Weekly view** — Mon–Sun grid with completion counts and scores
- **Monthly view** — full calendar grid per habit

## Daily schedule built in (APSC Dual-Track Plan)

| Block | Time | What |
|-------|------|------|
| A | 30 min | APSC — Current Affairs + Assam GK (every day) |
| B | 30 min | APSC — PYQ Practice / active recall (every day) |
| Mon / Wed / Fri | — | 📚 **APSC Focus** — deep syllabus study, notes, revision |
| Tue / Thu | — | 💻 **Tech Prep** — DDIA + Design Patterns + DSA |
| Sat | — | 🚀 **Tech Prep + Project** — PySpark / LangChain / RAG build + weekly review |
| Sun | — | Full rest — protected |

## Tech Stack

- **Backend:** FastAPI, SQLAlchemy, SQLite
- **Frontend:** Vanilla JavaScript, HTML, CSS (Jinja2 templates)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/NipamNayan/daily_habits_routine.git
cd daily_habits_routine
```

### 2. Create / activate a Python environment and install dependencies

```bash
# conda
conda activate <your-env>
pip install -r requirements.txt

# or venv
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

### 3. Run the app

```bash
uvicorn main:app --reload
# or with the full conda env path:
/path/to/miniconda3/envs/<env>/bin/uvicorn main:app --reload
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

## API Endpoints

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List all tasks (includes `category`, `goal_id`, `optional`) |
| POST | `/api/tasks` | Create a task (`name`, `category`, `goal_id`, `optional`) |
| PUT | `/api/tasks/{id}` | Update name / category / goal / optional flag |
| DELETE | `/api/tasks/{id}` | Delete a task and all its history |
| POST | `/api/toggle` | Toggle completion for a date |
| GET | `/api/today?for_date=YYYY-MM-DD` | Today's status (includes category & goal colour) |
| GET | `/api/week?week_offset=0` | Weekly grid view |
| GET | `/api/month?year=&month=` | Monthly grid view |

### Goals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/goals` | List active goals |
| POST | `/api/goals` | Create a goal (`name`, `emoji`, `color`, `description`) |
| PUT | `/api/goals/{id}` | Update a goal |
| DELETE | `/api/goals/{id}` | Delete a goal (tasks unlinked, not deleted) |
| GET | `/api/goals/{id}/stats` | 7-day completion %, streak, task count |

### Misc / Ad-hoc Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/misc?date=YYYY-MM-DD` | List ad-hoc tasks for a date |
| POST | `/api/misc` | Add an ad-hoc task |
| POST | `/api/misc/toggle` | Toggle done/undone |
| DELETE | `/api/misc/{id}` | Delete an ad-hoc task |

## Database

SQLite file `habits.db` is auto-created on first run. The following default goals and tasks are seeded if the database is empty:

**Default Goals:** APSC 2025 📚 · Job Switch 💼 · Health 💪

**Default Tasks:**
- Current Affairs + Assam GK *(APSC)*
- PYQ Practice — active recall *(APSC)*
- Build Lane — PySpark / LangChain / RAG *(Job, optional)*
- Depth Lane — DDIA + Design Patterns *(Job, optional)*
- Exercise / Jumprope *(Personal)*

Existing databases are automatically migrated to add the `category`, `goal_id`, and `optional` columns.

## Burnout guardrails

- **Light Day mode** — one toggle hides all optional tasks so the list feels manageable
- **Sunday** — the day banner shows "Rest Day 🌿" and the plan explicitly blocks all study
- **Optional flag** — mark tasks as optional (⚡) so they never feel mandatory
- **Flexible goals** — add, edit, or delete any goal at any time without losing task history

