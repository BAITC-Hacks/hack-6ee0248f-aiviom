# Career Quest

**HackAlem AI 2026 — Halyk Bank Track**  
**Repository / Project ID:** `hack-6ee0248f-aiviom`

## Overview

Career Quest is an AI-assisted employee development navigator.

The goal is to help employees understand:

- their current skill profile;
- the requirements for their next career step;
- the most relevant development activities;
- why a specific activity is recommended;
- how completing an activity changes their progress.

The system also provides HR with a simple overview of skill gaps, participation, and employees who currently have no suitable recommended next step.

## Core Flow

```text
Employee profile + history + skill requirements
                    ↓
             Skill-gap analysis
                    ↓
        Eligible activity selection
                    ↓
       AI-assisted recommendation
                    ↓
          Explainable next steps
                    ↓
        Activity completion/update
                    ↓
          Recalculated progress
```

## Main Requirements

- Employee profile and career trajectory
- 1–3 recommended development activities
- Multi-factor recommendation explanation
- Skill progress update after activity completion
- Basic HR dashboard
- Support for additional employee profiles and history

## Dataset

The project uses the provided Career Quest dataset:

```text
employees.json
events.json
skills.json
activity_history.csv
```

The recommendation logic considers:

- current role and grade;
- target role or next grade;
- skill gaps;
- critical skills;
- activity eligibility;
- prerequisites;
- previous participation;
- expected skill gains.

## Planned Architecture

```text
Frontend
   ↓
Backend API
   ↓
Career / Recommendation Engine
   ├── Skill-state calculation
   ├── Gap analysis
   ├── Activity eligibility
   └── Recommendation evidence
   ↓
LLM layer
   ↓
Explainable recommendation
```

The exact technology stack and deployment instructions will be updated as development progresses.

## Running the Project

> Setup and launch instructions will be added after the initial implementation is complete.

## Project Status

🚧 **Work in progress — HackAlem AI hackathon prototype.**

The README will be updated together with the implementation so that the documented functionality matches the final project.
