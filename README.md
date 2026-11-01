# SmartSplit — Smart Expense Splitter with OCR & Debt Optimization

SmartSplit is a full-stack group expense-splitting application featuring Gemini AI OCR receipt scanning, individual line-item diner assignment, and graph-based debt minimization algorithms that consolidate circular debts into the minimum direct transfers.

---

## 🚀 Running Locally

### 1. Prerequisites
- Node.js 18+ or 22+
- npm (installed with Node)

### 2. Installation
```bash
git clone <your-repo-url>
cd smartsplit
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` in the project root, then add your own Gemini API key. Never commit `.env`.

```env
# Gemini AI API Key
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# Port (default: 3000)
PORT=3000
```

### 4. Start Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 5. Production Build
```bash
npm run build
npm start
```

---

## ☁️ Deploying to Vercel

SmartSplit is pre-configured for zero-config Vercel deployment with:
- `vercel.json` routing all API routes (`/api/*`) to the serverless function and serving the compiled frontend (`dist/`)
- `api/index.ts` exporting the Express backend as a Vercel Serverless Function

### Deploy via Vercel CLI
```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Deploy
vercel
```

### Deploy via GitHub on Vercel Dashboard
1. Push your repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/new), select **Add New Project** and import the repository.
3. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: your Gemini API key
4. Click **Deploy**. Vercel will automatically build the client with `npm run build` and deploy the serverless functions in `api/index.ts`.

---

## 🤖 Gemini AI API Integration

SmartSplit uses Google's `@google/genai` TypeScript SDK with model `gemini-3.8-flash` on the backend:
- **Receipt OCR**: Takes printed restaurant and supermarket receipts and automatically extracts dishes, prices, quantities, taxes, and service charges.
- **Direct Prompt Endpoint (`POST /api/gemini/generate`)**:
  ```bash
  curl -X POST http://localhost:3000/api/gemini/generate \
    -H "Content-Type: application/json" \
    -d '{"prompt": "Explain how AI works in a few words"}'
  ```

---

## 💡 Key Features
- **OCR Receipt Pipeline**: Upload receipts or select realistic Sri Lankan presets (*Cafe Chill Ella*, *Zephyr Mirissa*, *Keells Supermarket*).
- **Line-Item Assignment**: Assign each dish/drink to the specific people who shared it, with proportional tax and tip distribution.
- **Graph Debt Minimization**: Automatically simplifies circular debts into the minimum number of pairwise transfers.
- **Multi-currency Support**: Default Sri Lankan Rupees (LKR) alongside USD and EUR.
