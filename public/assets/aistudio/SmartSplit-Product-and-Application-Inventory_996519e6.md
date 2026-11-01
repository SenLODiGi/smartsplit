# SmartSplit — Product Showcase and Application Inventory

**Repository:** [Smart-Expense-Splitter-with-OCR-Receipts](https://github.com/Chinthani-Munasinghe/Smart-Expense-Splitter-with-OCR-Receipts)  
**Reviewed from:** `Smart-Expense-Splitter-with-OCR-Receipts-main.zip`  
**Review date:** 28 October 2026  
**Purpose:** Describe the product story shown on the public-facing landing page, map the implemented web-app screens and reusable components, and distinguish working prototype behavior from backend capabilities and marketing claims.

---

## 1. Product at a glance

SmartSplit is presented as a group expense-splitting product for trips, shared homes, dinners, events, and other shared spending. Its central promise is to reduce manual receipt entry and simplify the final “who owes whom” calculation.

The intended workflow is:

1. Create an account and set up a group.
2. Enter an expense manually or start from a receipt.
3. Review receipt data and correct detected items.
4. Assign line items to the people who consumed them.
5. Calculate participant shares and balances.
6. Reduce circular debts to a smaller set of direct transfers.
7. Record a settlement and retain it in activity history.

The product is localized around Sri Lankan Rupees (LKR) and Sri Lankan example groups and scenarios. The landing page and prototype use fictional/sample names and receipt data.

---

## 2. Product showcase website

The showcase is the React page at `src/pages/01-Landing/LandingPage.jsx`. It is a single long landing page framed by the public navigation bar and footer.

### 2.1 Page structure and content

| Order | Section | What it communicates or shows |
|---|---|---|
| 1 | Navigation | SmartSplit identity, links into the product, login, and sign-up entry points. |
| 2 | Hero | “Stop doing the math. Start enjoying the moment.” Describes fair, transparent splitting for trips, dinners, and roommates. Primary CTA: **Start Splitting Free**; secondary CTA jumps to **How it works**. Displays social-proof/quality claims such as a 4.9 rating, 1,200+ groups, and 99.4% OCR precision. |
| 3 | Use-case ticker | Group trips, shared apartments, dinner parties, road trips, and roommate expenses. |
| 4 | Interactive architecture demo | An interactive 3D-style feature map with selectable hotspots and feature descriptions. |
| 5 | Problem statement | Positions spreadsheets, conflicting chat messages, and unclear balances as the problem. |
| 6 | How it works | Three interactive stages: receipt capture, item assignment/splitting, and settlement. |
| 7 | Receipt scanner | Shows a sample restaurant receipt and an example discrepancy resolution. CTA opens the receipt upload flow. |
| 8 | Itemized splitting | Shows a line item allocated to selected members so people only pay for what they ordered. |
| 9 | Smart settlement | Explains consolidating circular debts into fewer direct transfers; illustrates 7 IOUs reduced to 3 payments. |
| 10 | Settle up | Describes bank transfer, cash, or mobile payment and a recorded settlement history. |
| 11 | Visibility and analytics | Promotes group spend tracking, categories, budgets, and an illustrative category breakdown. |
| 12 | Real scenarios | Cards for Weekend in Ella, Apartment Expenses, and Birthday Dinner. |
| 13 | Privacy and security | Claims group isolation, no ads/data selling/trackers, cryptographic confidentiality, and an audit trail. |
| 14 | Final CTA | “More memories. Less mental math.” with a sign-up link. |
| 15 | Footer | Product/navigation links, including OCR scanner, Smart Split, analytics, and support. |

### 2.2 Showcase interactions and components

| Component | File | Behavior |
|---|---|---|
| Landing page | `src/pages/01-Landing/LandingPage.jsx` | Assembles the sections above and their links. |
| Navigation bar | `src/components/layout/Navbar.jsx` | Public-site brand and navigation, with login and sign-up actions. |
| Hero settlement widget | `src/components/landing/HeroInteractiveWidget.jsx` | Changes among Ella, Mirissa, and flat-share scenarios; toggles raw debts versus compressed settlements; opens a demo settlement modal, selects a payment method, and shows demo feedback. |
| 3D showcase | `src/components/landing/Hero3DShowcase.jsx` | Selectable hotspots change the displayed feature/architecture explanation. |
| How-it-works demo | `src/components/landing/HowItWorksInteractive.jsx` | Simulates receipt scanning, member assignment, debt optimization, and a settlement being recorded. |
| OCR scanner demo | `src/components/landing/InteractiveOCRScanner.jsx` | Contains sample detected items, avatar assignment toggles, service-charge control, and live share totals. **It is imported by the landing page but is not rendered there.** |
| Split calculator demo | `src/components/landing/InteractiveSplitCalculator.jsx` | Has bill presets, bill amount slider, group-size choices, service-charge choices, live equal-share calculation, and a copyable WhatsApp-style summary. **It is imported by the landing page but is not rendered there.** |
| Footer | `src/components/layout/Footer.jsx` | Footer navigation and product/support links. |

**Showcase status:** The live landing page uses the hero widget, 3D showcase, and How-it-works demo. The separate OCR scanner and split-calculator components exist in source but are currently dormant because they are never included in the landing page JSX.

### 2.3 Marketing copy versus demonstrated implementation

The landing page contains claims and illustrative figures (including “99.4% OCR precision,” “1,200+ groups,” “100% private,” no third-party trackers, and cryptographic confidentiality). The supplied code does not provide evidence that these are measured production metrics or deployed security properties. They should be treated as product copy until independently substantiated.

The showcase’s receipt discrepancies, scan animations, and sample payment confirmations are demo behavior. They do not demonstrate an OCR engine, real payment processing, or a deployed audit system.

---

## 3. Web application screens and routes

React Router is configured in `src/App.jsx`. Application pages use the shared `AppLayout` except the public landing page, sign-in/sign-up screens, and onboarding screens.

### 3.1 Public and onboarding routes

| Route | Page / component | Main purpose and visible features |
|---|---|---|
| `/` | `LandingPage` | Public product showcase. |
| `/signup` | `SignUpPage` (`defaultMode="signup"`) | Sign-up form and Google sign-in presentation. |
| `/login` | `SignUpPage` (`defaultMode="login"`) | Login mode in the same auth page. |
| `/onboarding` | Redirects to `/onboarding/1` | Entry to onboarding. |
| `/onboarding/1` | `OnboardingStep1` | Enter display name. |
| `/onboarding/2` | `OnboardingStep2` | Choose expense contexts: Friends, Travel, Roommates, Family, Events, Work. |
| `/onboarding/3` | `OnboardingStep3` | Set first group name/type/currency and show member invitation input and member preview. |

### 3.2 Core application routes

| Route | Page / component | Main purpose and visible features |
|---|---|---|
| `/dashboard` | `DashboardPage` | Summary metrics, quick actions, spending overview, groups, activity, outstanding balances, and recent expenses. |
| `/groups` | `GroupsListPage` | Browse group cards and navigate to a group or create one. |
| `/groups/create` | `CreateGroupPage` | Create a group with details and members. |
| `/groups/:groupId` | `GroupOverviewPage` | Group summary, members, expense/activity information, and links to add expenses or settle up. |
| `/expenses` | Redirects to `/expenses/add` | Expense entry shortcut. |
| `/expenses/add` | `AddExpensePage` | Manual expense form, payer/group/category details, and split-method state gallery. Split methods shown: Equal, Exact Amount, Percentage, Shares, and Items. |
| `/expenses/:expenseId` | `ExpenseDetailsPage` | Expense details, receipt snapshot, calculation details, and delete confirmation UI. |
| `/receipt/upload` | `ReceiptUploadPage` | Select/drop receipt photo and proceed to processing. |
| `/receipt/processing` | `OCRProcessingPage` | Animated, timed processing screen. |
| `/receipt/raw-review` | `RawOCRReviewPage` | Review sample raw OCR data and discrepancy flags. |
| `/receipt/corrected-review` | `CorrectedReviewPage` | Edit corrected merchant/item details and line items. |
| `/receipt/item-assignment` | `ItemAssignmentPage` | Assign each receipt line item to group members. |
| `/receipt/split-summary` | `SplitSummaryPage` | Review participant totals and save/navigate to expense details. |
| `/balances` | `BalancesPage` | Group/member balances and a comparison of individual debts with an optimized plan. |
| `/settlement/smart` | `SmartSettlementPage` | Recommended direct transfers and explanation of debt simplification. |
| `/settlement/settle` | `SettleUpPage` | Choose a settlement target/payment details. |
| `/settlement/confirm` | `ConfirmSettlementPage` | Confirm a transfer before recording it. |
| `/settlement/success` | `SettlementSuccessPage` | Show a settlement receipt/confirmation and next steps. |
| `/history` | `HistoryPage` | Activity and transaction history with filtering/search presentation. |
| `/settings` | `SettingsPage` | Profile fields, notification controls, theme/language/split/currency preferences, and account actions. |
| `/notifications` | `NotificationsPage` | Notification list and notification preferences presentation. |
| `/help` | `HelpSupportPage` | Help topics, FAQs, help centre, and support contact presentation. |
| `/about` | `AboutPage` | Product description and key-feature summary. |

Unknown paths redirect to `/`.

### 3.3 User-facing feature inventory

- **Accounts:** sign-up/login UI and a Google button component.
- **Onboarding:** profile display name, split-use categories, first group setup, currency selection, and member invitation presentation.
- **Groups:** group creation, group listing, group overview, member roster, and group-scoped balances/activity.
- **Expense creation:** manual expense form; five split methods are presented, including itemized allocation.
- **Receipt flow:** upload screen, progress animation, raw OCR review, corrected review, per-item member assignment, and final split summary.
- **Split calculation:** item shares are derived from assignments and participant counts; service/tax is incorporated in displayed totals.
- **Balances and settlement:** see who owes whom, view a simplified settlement suggestion, record a payment using a method, and display a confirmation/history record.
- **Dashboard and analytics:** totals, group activity, outstanding balances, recent expenses, and category/spending visualization.
- **History and notifications:** activity list and notification list/preferences.
- **Settings/help/about:** profile and preference controls, help content, and product information.

---

## 4. Component inventory

### 4.1 Shared layout and navigation

| Component | File | Responsibility |
|---|---|---|
| `AppLayout` | `src/components/layout/AppLayout.jsx` | Authenticated-style shell: sidebar, topbar, content outlet, mobile navigation. |
| `Sidebar` | `src/components/layout/Sidebar.jsx` | Desktop navigation for main product areas and settings. |
| `Topbar` | `src/components/layout/Topbar.jsx` | Page context/breadcrumbs, notifications, settings, and user controls. |
| `MobileNav` | `src/components/layout/MobileNav.jsx` | Compact bottom navigation for dashboard, active group, receipt, balances, and history. |
| `Navbar` | `src/components/layout/Navbar.jsx` | Public landing-page navigation. |
| `Footer` | `src/components/layout/Footer.jsx` | Landing-page footer navigation. |
| `BackToTop` | `src/components/layout/BackToTop.jsx` | Scroll-to-top affordance. |

### 4.2 Dashboard

| Component | File | Responsibility |
|---|---|---|
| `DashboardHeader` | `src/components/dashboard/DashboardHeader.jsx` | Greeting and add-expense CTA. |
| `BalanceSummary` | `src/components/dashboard/BalanceSummary.jsx` | High-level balance/expense metric cards. |
| `QuickActions` | `src/components/dashboard/QuickActions.jsx` | Shortcuts to common workflows. |
| `SpendingOverview` | `src/components/dashboard/SpendingOverview.jsx` | Spending chart/overview. |
| `GroupsSection` | `src/components/dashboard/GroupsSection.jsx` | Group list/summary block. |
| `RecentActivity` | `src/components/dashboard/RecentActivity.jsx` | Recent activity feed. |
| `OutstandingBalances` | `src/components/dashboard/OutstandingBalances.jsx` | Current debts/amounts owed. |
| `RecentExpenses` | `src/components/dashboard/RecentExpenses.jsx` | Recent expense list. |

### 4.3 Authentication, onboarding, and receipt flow

| Component | File | Responsibility |
|---|---|---|
| `AuthLeftHero` | `src/components/auth/AuthLeftHero.jsx` | Visual/benefit panel on auth page. |
| `GoogleButton` | `src/components/auth/GoogleButton.jsx` | Google sign-in button presentation. |
| `OnboardingLayout` | `src/components/onboarding/OnboardingLayout.jsx` | Shared progress, title, content, and footer for onboarding steps. |
| `ReceiptStepper` | `src/components/receipt/ReceiptStepper.jsx` | Progress indicator across receipt-processing/review steps. |

### 4.4 Product state and supporting code

| File | Responsibility |
|---|---|
| `src/context/AppContext.jsx` | In-memory React context for user/auth flag, onboarding data, groups, expenses, selected receipt, OCR review data, corrected items, item assignments, split calculation, settlements, and history. |
| `src/data/mockData.js` | Seed/demo users, groups, expenses, receipt/OCR data, dashboard content, balance data, and settlement suggestions. |
| `src/utils/currency.js` | Currency formatting helpers. |
| `src/index.css` | Global styles and design utilities. |
| `src/main.jsx` | React application entry point. |
| `vite.config.js` | Vite build/dev-server configuration. |
| `index.html` | Browser document shell. |

---

## 5. Backend and database

### 5.1 Technology

The repository describes a React 18 + Vite frontend using React Router, Tailwind CSS, and Lucide icons; a Node.js/Express backend using ES modules; and PostgreSQL 14+. The backend uses `pg`, `bcryptjs`, `dotenv`, and `cors`. The README describes LKR amounts as `NUMERIC(12,2)`.

### 5.2 API routes present in source

All routes are mounted below `/api`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | API and database connection status. |
| POST | `/auth/register` | Register a user. |
| POST | `/auth/login` | Verify credentials and create a session/refresh token. |
| GET | `/groups` | List a user’s groups (expects a user ID in query/header). |
| POST | `/groups` | Create a group. |
| GET | `/groups/:groupId` | Retrieve a group and members. |
| POST | `/groups/:groupId/members` | Add a group member. |
| GET | `/groups/:groupId/expenses` | List expenses for a group. |
| POST | `/expenses` | Create an expense with splits. |
| GET | `/expenses/:expenseId` | Retrieve an expense, item details, and shares. |
| GET | `/groups/:groupId/balances` | Get group balances. |
| GET | `/users/:userId/balances` | Get a user’s balances. |
| GET | `/groups/:groupId/settlements` | List group settlements. |
| GET | `/groups/:groupId/settlements/optimize` | Generate/read optimized settlement suggestions. |
| POST | `/settlements/payments` | Record a settlement payment. |
| GET | `/groups/:groupId/history` | List group activity history. |
| GET | `/notifications` | List notifications. |
| PATCH | `/notifications/:notificationId/read` | Mark a notification read. |

Backend source is organized into configuration, controllers, repositories, services, routes, and error middleware. Repositories cover users, groups, expenses, receipts, settlements, balances, activities, and notifications. Services include expense creation/splitting and settlement optimization/payment recording.

### 5.3 Database domain model

The database documentation describes 24 tables, grouped by these functions:

- Users, user preferences, sessions, password-reset tokens.
- Groups, group membership, invitations.
- Expenses, expense participants, expense items, item assignments, calculated expense shares.
- Receipts, OCR results, extracted OCR items.
- Current member balances and balance snapshots.
- Suggested settlements and settlement payments.
- Activity history and notifications.
- Categories, supported currencies, and attachments.

Sixteen numbered SQL migration files are present. They create extensions/enums and the schema, indexes, views, and functions. Seed scripts include reference data and a “Weekend in Ella” demo dataset.

---

## 6. Implementation status and important boundaries

### 6.1 Frontend/backend integration

The frontend source contains no `fetch` or Axios API calls. Page state is supplied by `AppContext` and `mockData.js`; several dashboard, group, expense, balance, and history views import mock data directly. The frontend demo therefore does not currently read/write through the Express API.

Most app data is React state in memory. It is not persisted across a browser reload in the frontend prototype. The backend and PostgreSQL schema form a separate implementation layer in this repository.

### 6.2 OCR and payment behavior

The receipt pages present a full upload-to-split workflow, but the supplied backend routes do not expose a receipt-upload or OCR-processing endpoint. The frontend initializes from sample receipt data and uses timed UI transitions for the “processing” screen. No OCR provider/engine is configured in the listed frontend/backend dependencies.

Settlement screens and landing-page settlement interactions are also demonstrations from seeded state. The backend does include a settlement optimizer and payment-recording service, but the frontend is not connected to those routes. Payment method selection/confirmation in the UI should not be interpreted as a real payment gateway transaction.

### 6.3 Authentication and security maturity

The UI auth flow uses local state and timed transitions; `AppContext` initializes `isAuthenticated` to `true`. The backend has password hashing and login/session creation code, but the visible API route list does not include a refresh/logout route or authentication middleware protecting the product routes. Treat the current state as a prototype, not a production-ready security design.

The showcase’s privacy/security statements are not verified by the frontend source. The backend configuration also contains development fallback values (including a development JWT secret and default database password) when environment values are absent. These must not be used in production.

### 6.4 Scope inconsistencies to resolve

- The application’s default/sample currency is LKR; the onboarding UI also presents USD, EUR, and GBP, while context helper functions default new groups/expenses to LKR.
- A five-method manual split gallery is presented, but the frontend’s live shared calculation centers on item assignments and tax allocation; not every method is backed by a unified persistent calculator.
- Landing-page OCR precision, privacy, usage, and debt-reduction numbers are sample claims or illustrative content, not audited metrics in this repository.
- The upload archive includes `backend/.env`. Its values are intentionally not reproduced here. If that file contains real credentials or tokens, revoke/rotate them and remove the file from the repository; keep only a placeholder such as `backend/.env.example`.

---

## 7. End-to-end user journey represented by the UI

```text
Landing page
  → Sign up / Login
  → Onboarding: name, expense contexts, first group
  → Dashboard
  → Create/select group
  → Add expense manually OR upload receipt
  → Receipt processing → raw review → corrected review
  → Assign each item to members
  → Review final split and create expense
  → Group balances → optimized settlement suggestion
  → Select payment method → confirm settlement
  → Settlement receipt and activity history
```

This is the intended prototype journey. The screens and local state transitions are present, but the frontend currently operates on demo data and is not connected to backend persistence.

---

## 8. Source files reviewed

Key files reviewed include:

- Product and routes: `README.md`, `src/App.jsx`, `src/pages/01-Landing/LandingPage.jsx`.
- Shared UI: `src/components/layout/*`, `src/components/dashboard/*`, `src/components/landing/*`, `src/components/auth/*`, `src/components/onboarding/*`, `src/components/receipt/*`.
- App behavior/data: `src/context/AppContext.jsx`, `src/data/mockData.js`, `src/utils/currency.js`.
- Backend: `backend/src/routes/apiRoutes.js`, `backend/src/controllers/apiControllers.js`, `backend/src/repositories/*`, `backend/src/services/*`, `backend/src/config/*`.
- Data model: `database/README.md`, `database/migrations/*`, and seed scripts.


