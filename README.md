# ID Card App

A full-stack application for managing and generating ID cards in bulk, with job tracking and SVG/photo processing. Built with Node.js, Express, PostgreSQL, React, and TypeScript.

## Features

- Upload CSV data and photos to generate ID cards
- Job queue and status tracking (with BullMQ and Redis)
- SVG template processing and image manipulation (Sharp)
- RESTful API backend (Express, Knex, PostgreSQL)
- Modern React frontend (Vite, TypeScript)
- Dockerized for easy local development
- Automated tests (Jest, Supertest)

## Tech Stack

- **Backend:** Node.js, Express, Knex, PostgreSQL, BullMQ, Redis
- **Frontend:** React, TypeScript, Vite
- **Image Processing:** Sharp
- **CSV Parsing:** csv-parser
- **Testing:** Jest, Supertest
- **Containerization:** Docker, Docker Compose

## Project Structure

```
idcard-app/
├── client/           # React frontend
├── server/           # Node.js/Express backend
├── docker-compose.yml
├── Dockerfile
├── TODO.md
└── README.md
```

## Getting Started

### Prerequisites
- **Recommended:** Docker & Docker Compose (for easiest setup)
- **Alternative:** Node.js (v18+), npm or yarn, PostgreSQL & Redis (if running locally without Docker)

### 1. Clone the repository
```bash
git clone <repo-url>
cd idcard-app
```

### 2. Environment Variables
- Copy `.env.example` to `.env` in both `server/` and `client/` (if present) and fill in required values.

#### Example: `server/.env` (create this file)
```
# PostgreSQL
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
POSTGRES_DB=idcard_db
DATABASE_URL=postgresql://myuser:mypassword@db:5432/idcard_db

# Redis
REDIS_URL=redis://redis:6379

# Node environment
NODE_ENV=development
```

#### Example: `client/.env.production` (required for Docker!)
```
# URL to the backend API (inside Docker, use the service name 'api')
VITE_API_BASE_URL=/api
```
- **Important:** For Docker Compose to work, you must create `client/.env.production` with the correct `VITE_API_BASE_URL` value. This is required for the frontend to communicate with the backend in production/Docker mode.
- For local (non-Docker) development, you can use a `.env` file in `client/` if needed, but it's not required by default.

### 3. Run with Docker (Recommended)

The easiest way to run the full stack is with Docker Compose. This will start the backend API, worker, frontend, PostgreSQL, and Redis containers.

```bash
docker-compose up --build
```

- The frontend will be available at [http://localhost:5173](http://localhost:5173)
- The backend API will be available at [http://localhost:3001](http://localhost:3001)
- PostgreSQL runs on port 5433 (host) → 5432 (container)
- Redis runs on port 6379

**Services launched:**
- `db`: PostgreSQL 15
- `redis`: Redis 7
- `api`: Node.js/Express backend (with migrations auto-run on startup)
- `worker`: BullMQ job processor
- `frontend`: React app served by nginx (with API proxy)

**Notes:**
- The frontend nginx is configured to proxy `/api/` requests to the backend API service.
- The backend and worker containers use a `wait-for-it.sh` script to ensure the database is ready before running migrations or starting the app.
- Volumes are used for persistent PostgreSQL and Redis data.
- You can stop all containers with `docker-compose down`.

#### Common Docker Commands
- Rebuild after code changes: `docker-compose up --build`
- Stop containers: `docker-compose down`
- View logs: `docker-compose logs -f`
- Run migrations manually: `docker-compose exec api npx knex migrate:latest`
- Access a container shell: `docker-compose exec api sh`

#### Troubleshooting
- If you get database connection errors, ensure no other service is using port 5433 on your host.
- If migrations fail, try restarting with `docker-compose down -v` (removes volumes/data!) then `docker-compose up --build`.
- For permission issues on volumes (rare on Windows), try running Docker Desktop as administrator.
- If you change environment variables, restart the affected containers.

### 4. Local Development (Without Docker)

#### Backend
```bash
cd server
npm install
# Set up your PostgreSQL and Redis instances
# Run migrations
npx knex migrate:latest
# (Optional) Seed the database
npx knex seed:run
# Start the server
npm run dev
```

#### Frontend
```bash
cd client
npm install
npm run dev
```

- The frontend will typically run on `http://localhost:5173`
- The backend will run on `http://localhost:3000` (default)

### 5. Running Tests

#### Backend
```bash
cd server
npm test
```

#### Frontend
```bash
cd client
npm test
```

## API Overview

- Upload CSV and photos to `/api/jobs`
- Check job status at `/api/jobs/:id`
- Download generated ID cards when jobs complete

(See `server/routes/jobRoutes.js` for full API details.)

## Contributing

1. Fork the repo and create your branch from `dev`.
2. Install dependencies and set up your environment.
3. Make your changes and add tests where appropriate.
4. Open a pull request with a clear description.

## License

This project is licensed under the MIT License. 