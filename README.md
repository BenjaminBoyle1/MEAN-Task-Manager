# MEAN Task Planner Pro

A polished single-page MEAN stack application for planning tasks with:

- Angular SPA frontend
- Express + Node.js API
- MongoDB database with Mongoose
- Full CRUD support
- Task scheduling by day
- Duration estimates for each task
- Priority levels
- Board and calendar agenda views
- One-click complete action
- Search, filter, sort, and dashboard metrics

## Run the backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Update `backend/.env` with a valid MongoDB connection string, for example:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/mean_task_manager
PORT=5000
```

## Run the frontend

```bash
cd frontend
npm install
npm start
```

## App URLs

- Frontend: `http://localhost:4200`
- Backend health check: `http://localhost:5000/api/health`
- Tasks API: `http://localhost:5000/api/tasks`

## New fields and actions

Each task now includes:

- title
- description
- status
- priority
- scheduledDate
- durationMinutes

Extra action:

- `PATCH /api/tasks/:id/complete` marks a task as Done
