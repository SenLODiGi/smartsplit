# SmartSplit — Smart Expense Splitter with OCR Receipts

📊 Smart expense splitting made easy with OCR-powered receipt scanning, automatic item assignments, fair bill splitting, and smart settlement minimization.

---

## 🚀 Tech Stack

- **Frontend**: React 18, Vite, React Router v6, Tailwind CSS & Lucide Icons
- **Backend**: Node.js, Express.js (ES Modules)
- **Database**: PostgreSQL 14+ with UUID primary keys, ENUMs, check constraints, indexes, views, and JSONB
- **Currency**: LKR (Sri Lankan Rupee, `NUMERIC(12,2)`)

---

## 🗄️ PostgreSQL Database Setup

### 1. Prerequisites
- [PostgreSQL 14+](https://www.postgresql.org/download/) installed and running.
- [Node.js 18+](https://nodejs.org/) installed.

### 2. Create the Database
Connect to your PostgreSQL server via `psql` or pgAdmin and run:

```sql
CREATE DATABASE smartsplit;
```

### 3. Configure Environment Variables
Copy the example environment configuration in `backend/`:

```bash
cp backend/.env.example backend/.env
```

Configure your PostgreSQL credentials in `backend/.env`:

```ini
DB_HOST=localhost
DB_PORT=5432
DB_NAME=smartsplit
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_SSL=false
```

### 4. Run Migrations & Seeds

```bash
# Run database migrations (creates all 24 tables, indexes, and views)
npm --prefix backend run migrate

# Run seed data (loads demo users, "Weekend in Ella" group, receipts, and splits)
npm --prefix backend run seed
```

### 5. Run Database Automated Tests

```bash
npm --prefix backend test
```

For complete database schema documentation, ER diagrams, balance calculation formulas, and smart settlement algorithm documentation, please review [`database/README.md`](database/README.md).

---

## 💻 Running the Application

### Frontend Development Server
```bash
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Backend API Server
```bash
cd backend
npm install
npm run dev
```
API running on [http://localhost:5000](http://localhost:5000) (Health check: [http://localhost:5000/api/health](http://localhost:5000/api/health)).
