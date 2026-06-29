# SensAI — Complete Project Documentation

SensAI is an **AI-powered career development platform** that helps professionals grow through personalized industry insights, mock technical interviews, resume building, and AI-generated cover letters. Everything is personalized from a single **career profile** (industry, skills, experience, bio) collected during onboarding.

This document explains the project **end to end**: architecture, database design, feature flows, SSR/CSR patterns, Gemini AI integration, and how every feature connects to the others.

---

## Table of Contents

1. [What SensAI Does](#1-what-sensai-does)
2. [Tech Stack](#2-tech-stack)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Low-Level Architecture](#4-low-level-architecture)
5. [Project Structure](#5-project-structure)
6. [Database Architecture](#6-database-architecture)
7. [Authentication & Authorization (Clerk)](#7-authentication--authorization-clerk)
8. [Next.js: SSR vs CSR in This Project](#8-nextjs-ssr-vs-csr-in-this-project)
9. [Gemini AI Integration](#9-gemini-ai-integration)
10. [Inngest Background Jobs](#10-inngest-background-jobs)
11. [Feature Walkthrough (Step by Step)](#11-feature-walkthrough-step-by-step)
12. [Feature Interconnections](#12-feature-interconnections)
13. [Sequence Diagrams](#13-sequence-diagrams)
14. [Server Actions Reference](#14-server-actions-reference)
15. [Styling & UI Components](#15-styling--ui-components)
16. [Environment Variables & Local Setup](#16-environment-variables--local-setup)
17. [End-to-End User Journey](#17-end-to-end-user-journey)
18. [Security Model](#18-security-model)
19. [Scalability & Design Decisions](#19-scalability--design-decisions)

---

## 1. What SensAI Does

| Area | Route | What It Does |
| --- | --- | --- |
| Landing | `/` | Public marketing page — features, FAQs, testimonials, CTA |
| Auth | `/sign-in`, `/sign-up` | Clerk-hosted authentication |
| Onboarding | `/onboarding` | Collect industry, specialization, experience, skills, bio |
| Dashboard | `/dashboard` | AI-generated industry insights — salary, trends, skills |
| Interview Prep | `/interview` | Assessment history, stats, performance chart |
| Mock Quiz | `/interview/mock` | 10 AI-generated MCQs with scoring and improvement tips |
| Resume | `/resume` | Form-based resume builder with AI improvement and PDF export |
| Cover Letters | `/ai-cover-letter` | List, create, and view AI-generated cover letters |

**Core idea:** The user's profile is the **single source of truth** for all AI personalization. Every Gemini prompt includes industry, skills, experience, and bio where relevant.

---

## 2. Tech Stack

| Layer | Technology | Role in SensAI |
| --- | --- | --- |
| **Full-stack framework** | Next.js 16 (App Router) | Routing, SSR, Server Components, Server Actions, API routes |
| **UI library** | React 19 | Component rendering, client interactivity |
| **Authentication** | Clerk (`@clerk/nextjs`) | Sign-in, sign-up, sessions, user menu |
| **Database** | Neon PostgreSQL | Centralized cloud Postgres (serverless) |
| **ORM** | Prisma 6 | Schema, migrations, type-safe queries |
| **AI** | Google Gemini (`@google/generative-ai`) | Industry insights, quizzes, tips, resume & cover letter text |
| **Background jobs** | Inngest | Weekly cron to refresh industry insights |
| **Styling** | Tailwind CSS 3 | Utility-first CSS, responsive design |
| **UI primitives** | Radix UI | Accessible dialogs, dropdowns, selects, tabs, etc. |
| **Component library** | shadcn/ui pattern | Pre-built components in `components/ui/` |
| **Forms** | React Hook Form + Zod | Validation and schema transforms |
| **Charts** | Recharts | Salary bar chart, quiz performance line chart |
| **Toasts** | Sonner | Success/error feedback |
| **Theming** | next-themes | Dark mode (forced dark in root layout) |
| **Markdown** | `@uiw/react-md-editor`, `react-markdown` | Resume editing and preview |
| **PDF export** | html2pdf.js | Download resume as PDF |

---

## 3. High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                        │
│  Landing │ Dashboard │ Quiz │ Resume │ Cover Letter │ Auth UI   │
│         (React Client Components + Server-rendered HTML)        │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / Server Actions
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS APP ROUTER (Server)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Server       │  │ Server       │  │ API Route            │  │
│  │ Components   │  │ Actions      │  │ /api/inngest         │  │
│  │ (SSR pages)  │  │ (business    │  │ (Inngest handler)    │  │
│  │              │  │  logic)      │  │                      │  │
│  └──────────────┘  └──────┬───────┘  └──────────┬───────────┘  │
│                           │                      │              │
│  ┌────────────────────────┴──────────────────────┴───────────┐  │
│  │                    middleware.js (Clerk)                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────┬───────────────────────────────┬────────────────────┘
             │                               │
             ▼                               ▼
┌────────────────────────┐     ┌────────────────────────────────┐
│   CLERK (Identity)     │     │   GOOGLE GEMINI API            │
│   Sessions, JWT, users   │     │   Content generation           │
└────────────────────────┘     └────────────────────────────────┘
             │
             ▼
┌────────────────────────┐     ┌────────────────────────────────┐
│   PRISMA ORM           │────▶│   NEON POSTGRESQL              │
│   Type-safe queries    │     │   Users, Insights, Assessments │
└────────────────────────┘     └────────────────────────────────┘
                                         ▲
                                         │
                               ┌─────────┴──────────┐
                               │   INNGEST (Cron)   │
                               │   Weekly refresh   │
                               └────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility |
| --- | --- |
| **Clerk** | Who is the user? (identity, session) |
| **Middleware** | Block unauthenticated access to protected routes |
| **Server Actions** | Business logic, auth checks, DB + AI calls |
| **Prisma + Neon** | Persistent storage with relational integrity |
| **Gemini** | Generate insights, questions, tips, resume/cover letter text |
| **Inngest** | Scheduled background refresh without blocking users |
| **Client Components** | Forms, quizzes, charts, interactive UI |

---

## 4. Low-Level Architecture

### 4.1 Request Flow (Protected Page)

```text
1. Browser requests /dashboard
2. middleware.js → clerkMiddleware checks session
3. If no userId → redirectToSignIn()
4. dashboard/page.jsx (Server Component) runs on server:
     a. getUserOnboardingStatus() → auth() + Prisma
     b. if !isOnboarded → redirect("/onboarding")
     c. getIndustryInsights() → Prisma (+ Gemini if missing)
     d. Renders DashboardView with insights prop
5. HTML sent to browser; client hydrates interactive parts
```

### 4.2 Server Action Flow (Client-Initiated)

```text
1. Client Component calls server action (e.g. generateQuiz)
2. Next.js POSTs to server with action ID
3. Server action runs:
     a. auth() from Clerk → userId
     b. db.user.findUnique({ clerkUserId: userId })
     c. model.generateContent(prompt) → Gemini
     d. Parse JSON, persist if needed
     e. Return result to client
4. useFetch hook updates loading/data/error state
5. Sonner toast on error; UI re-renders with new data
```

### 4.3 User Sync Bridge (Clerk → Database)

Clerk owns authentication; PostgreSQL owns application data. They are linked by `User.clerkUserId`.

```text
Every page load (Header Server Component):
  checkUser()
    → currentUser() from Clerk
    → db.user.findUnique({ clerkUserId })
    → if missing: db.user.create({ clerkUserId, email, name, imageUrl })
    → return User row
```

File: `lib/checkUser.js`

### 4.4 AI Response Pipeline

All Gemini calls follow the same pattern:

```text
Build prompt with user/industry context
  → model.generateContent(prompt)
  → response.text()
  → strip ```json fences
  → JSON.parse() (for structured outputs)
  → validate/transform
  → Prisma create/update
  → return to UI
```

File: `lib/gemini.js` — singleton model instance using `GEMINI_API_KEY` and `GEMINI_MODEL` (default: `gemini-2.5-flash-lite`).

---

## 5. Project Structure

```text
SensAI/
├── app/
│   ├── layout.js                    # Root: ClerkProvider, ThemeProvider, Header, Toaster
│   ├── page.js                      # Landing page (SSR)
│   ├── globals.css                  # Tailwind + CSS variables
│   ├── (auth)/                      # Clerk sign-in / sign-up
│   │   ├── layout.js
│   │   ├── sign-in/[[...sign-in]]/page.jsx
│   │   └── sign-up/[[...sign-up]]/page.jsx
│   ├── (main)/                      # Authenticated app shell
│   │   ├── layout.jsx               # Container wrapper
│   │   ├── onboarding/
│   │   ├── dashboard/
│   │   ├── interview/
│   │   ├── resume/
│   │   └── ai-cover-letter/
│   ├── api/inngest/route.js         # Inngest webhook handler
│   └── lib/
│       ├── schema.js                # Zod schemas
│       └── helper.js                # Markdown helpers
├── actions/                         # Server Actions ("use server")
│   ├── user.js
│   ├── dashboard.js
│   ├── interview.js
│   ├── resume.js
│   └── cover-letter.js
├── components/
│   ├── header.jsx                   # Nav + checkUser sync
│   ├── hero.jsx                     # Landing hero (client)
│   ├── theme-provider.jsx           # next-themes wrapper
│   └── ui/                          # shadcn/Radix components
├── data/                            # Static content (industries, FAQs, features)
├── hooks/use-fetch.js               # Client async wrapper for server actions
├── lib/
│   ├── prisma.js                    # Prisma singleton
│   ├── checkUser.js                 # Clerk ↔ DB sync
│   ├── gemini.js                    # Gemini client
│   ├── utils.js                     # cn() class merge
│   └── inngest/
│       ├── client.js
│       └── function.js
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── middleware.js                    # Clerk route protection
```

---

## 6. Database Architecture

### 6.1 Entity Relationship Diagram

```text
┌─────────────────────┐         ┌──────────────────────────┐
│   IndustryInsight   │         │          User            │
├─────────────────────┤         ├──────────────────────────┤
│ id (cuid)           │◄────────│ industry (FK, unique key)│
│ industry (unique)   │  1 : N  │ id (uuid)                │
│ salaryRanges (Json[])│        │ clerkUserId (unique)     │
│ growthRate          │         │ email (unique)           │
│ demandLevel         │         │ name, imageUrl           │
│ topSkills[]         │         │ bio, experience          │
│ marketOutlook       │         │ skills[]                 │
│ keyTrends[]         │         └───────────┬──────────────┘
│ recommendedSkills[] │                     │
│ lastUpdated         │         ┌───────────┼───────────────┐
│ nextUpdate          │         │           │               │
└─────────────────────┘         ▼           ▼               ▼
                          ┌──────────┐ ┌──────────┐  ┌─────────────┐
                          │Assessment│ │  Resume  │  │ CoverLetter │
                          ├──────────┤ ├──────────┤  ├─────────────┤
                          │ userId   │ │ userId   │  │ userId      │
                          │ quizScore│ │ content  │  │ content     │
                          │ questions│ │ atsScore?│  │ jobTitle    │
                          │   (Json[])│ │ feedback?│  │ companyName │
                          │ category │ └──────────┘  │ jobDescription│
                          │improvement│  1:1 unique │ status      │
                          │   Tip    │              └─────────────┘
                          └──────────┘                   1 : N
                               1 : N
```

### 6.2 Model Details

#### User
Central profile linked to Clerk. Created automatically on first visit via `checkUser()`.

| Field | Type | Purpose |
| --- | --- | --- |
| `clerkUserId` | String (unique) | Links to Clerk identity |
| `industry` | String? | Combined key: `{industry}-{sub-industry}` e.g. `tech-software-development` |
| `skills` | String[] | Postgres array — used in quiz & cover letter prompts |
| `experience` | Int? | Years — used in cover letter generation |
| `bio` | String? | Professional background — used in cover letters |

#### IndustryInsight
**Shared across users** in the same industry. When User A and User B both pick "tech-software-development", they read the same insight row. This avoids regenerating AI data per user.

| Field | Type | Purpose |
| --- | --- | --- |
| `salaryRanges` | Json[] | `{ role, min, max, median, location }` per role |
| `growthRate` | Float | Industry growth percentage |
| `demandLevel` | String | "High" / "Medium" / "Low" |
| `marketOutlook` | String | "Positive" / "Neutral" / "Negative" |
| `topSkills`, `keyTrends`, `recommendedSkills` | String[] | Market intelligence |
| `nextUpdate` | DateTime | When Inngest should refresh |

#### Assessment
Stores completed mock interview results.

| Field | Type | Purpose |
| --- | --- | --- |
| `questions` | Json[] | `{ question, answer, userAnswer, isCorrect, explanation }` |
| `quizScore` | Float | Percentage 0–100 |
| `improvementTip` | String? | Gemini-generated tip from wrong answers |

#### Resume
One resume per user (`userId` unique). Content stored as Markdown.

#### CoverLetter
Many per user. Includes job metadata and generated Markdown content.

### 6.3 Prisma Client Singleton

File: `lib/prisma.js`

```javascript
export const db = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = db;
```

Prevents connection exhaustion during Next.js hot reload in development.

### 6.4 Neon + Prisma Setup

- `DATABASE_URL` in `.env` points to Neon Postgres connection string
- Migrations in `prisma/migrations/` version the schema
- `postinstall` script runs `prisma generate` automatically

---

## 7. Authentication & Authorization (Clerk)

### 7.1 Clerk Configuration

| Env Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Client-side Clerk |
| `CLERK_SECRET_KEY` | Server-side Clerk |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/onboarding` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/onboarding` |

After sign-in/sign-up, Clerk redirects to `/onboarding`.

### 7.2 Route Protection (Middleware)

File: `middleware.js`

Protected routes (require signed-in user):
- `/dashboard`, `/onboarding`, `/interview`, `/resume`, `/ai-cover-letter`

```javascript
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)", "/resume(.*)", "/interview(.*)",
  "/ai-cover-letter(.*)", "/onboarding(.*)",
]);
```

If `!userId` on a protected route → `redirectToSignIn()`.

### 7.3 Authorization in Server Actions

Every server action follows this pattern:

```javascript
const { userId } = await auth();
if (!userId) throw new Error("Unauthorized");

const user = await db.user.findUnique({ where: { clerkUserId: userId } });
if (!user) throw new Error("User not found");
```

**Important:** The client never sends a trusted user ID. Identity always comes from the Clerk session on the server.

### 7.4 Clerk ↔ Database Sync Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Clerk
    participant H as Header (Server)
    participant DB as PostgreSQL

    U->>C: Sign in / Sign up
    C->>U: Session cookie set
    U->>H: Visit any page
    H->>C: currentUser()
    C-->>H: clerkUserId, email, name
    H->>DB: findUnique({ clerkUserId })
    alt User not in DB
        H->>DB: create({ clerkUserId, email, name, imageUrl })
    end
    DB-->>H: User row
    H-->>U: Render page with nav
```

---

## 8. Next.js: SSR vs CSR in This Project

Next.js App Router uses **React Server Components (RSC)** by default. Components are Server Components unless marked with `"use client"`.

### 8.1 Server-Side Rendering (SSR) — Server Components

These run **only on the server**. They can call Prisma, Clerk `auth()`, and server actions directly. No JavaScript bundle sent for their logic.

| File | What It Does (SSR) |
| --- | --- |
| `app/page.js` | Landing page — static sections, no client state |
| `components/header.jsx` | Calls `checkUser()`, renders Clerk SignedIn/SignedOut |
| `app/(main)/dashboard/page.jsx` | Fetches onboarding status + insights, redirects if needed |
| `app/(main)/onboarding/page.jsx` | Checks onboarded state, redirects to dashboard |
| `app/(main)/interview/page.jsx` | Fetches all assessments from DB |
| `app/(main)/resume/page.jsx` | Fetches saved resume content |
| `app/(main)/ai-cover-letter/page.jsx` | Fetches cover letter list |
| `app/(main)/ai-cover-letter/[id]/page.jsx` | Fetches single cover letter by ID |

**Example — Dashboard SSR:**

```javascript
// app/(main)/dashboard/page.jsx — Server Component
export default async function DashboardPage() {
  const { isOnboarded } = await getUserOnboardingStatus();
  if (!isOnboarded) redirect("/onboarding");

  const insights = await getIndustryInsights(); // DB + maybe Gemini
  return <DashboardView insights={insights} />;
}
```

**Benefits in SensAI:**
- Insights and assessments fetched before HTML reaches browser (faster first paint)
- Database credentials never exposed to client
- SEO for landing page

### 8.2 Client-Side Rendering (CSR) — Client Components

Marked with `"use client"`. Run in the browser. Handle forms, state, event handlers, and call server actions via hooks.

| File | Why Client? |
| --- | --- |
| `onboarding-form.jsx` | React Hook Form, submit handler, router navigation |
| `quiz.jsx` | Question state, answers, progress, async quiz generation |
| `dashboard-view.jsx` | Recharts needs browser DOM for charts |
| `resume-builder.jsx` | Form state, tabs, MD editor, PDF download |
| `cover-letter-generator.jsx` | Form submit → generate action |
| `entry-form.jsx` | Dynamic entries, AI improve button |
| `performace-chart.jsx` | Recharts line chart |
| `components/hero.jsx` | Scroll animation with useRef/useEffect |
| `theme-provider.jsx` | next-themes requires client context |

**Example — Quiz CSR calling Server Action:**

```javascript
"use client";
// quiz.jsx
const { fn: generateQuizFn, data: quizData } = useFetch(generateQuiz);
// User clicks "Start Quiz" → generateQuizFn() → Server Action on server → returns questions
```

### 8.3 Hybrid Pattern (Most Common in SensAI)

```text
Server Component (page.jsx)
  │
  ├── Fetches data from DB on server
  ├── Passes data as props ↓
  │
  └── Client Component (view/form)
        ├── Receives initial data as props (SSR hydration)
        ├── Manages interactive state locally (CSR)
        └── Calls Server Actions for mutations (CSR → Server)
```

| Page | Server Part | Client Part |
| --- | --- | --- |
| Dashboard | Fetch insights | Render charts/cards |
| Interview | Fetch assessments | Stats cards, chart, quiz list |
| Resume | Fetch saved content | Builder form, AI improve, PDF |
| Mock Quiz | Page shell only | Entire quiz flow |
| Onboarding | Redirect logic | Form submission |

### 8.4 Server Actions as the API Layer

Instead of REST endpoints, SensAI uses **Server Actions** (`"use server"`) for all mutations and some reads initiated from the client:

- `updateUser`, `generateQuiz`, `saveQuizResult`, `saveResume`, `improveWithAI`, `generateCoverLetter`

Client components import these directly — Next.js serializes the call over HTTP automatically.

---

## 9. Gemini AI Integration

### 9.1 Setup

File: `lib/gemini.js`

```javascript
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
export const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite"
});
```

### 9.2 All Gemini Touchpoints

| Feature | Action / Job | Input Context | Output | Persisted? |
| --- | --- | --- | --- | --- |
| **Industry Insights** | `generateAIInsights()` | Industry string | JSON: salary, growth, trends, skills | Yes → `IndustryInsight` |
| **Onboarding** | `updateUser()` | Industry (triggers insight if new) | Same as above | Yes |
| **Dashboard fallback** | `getIndustryInsights()` | User's industry | Same as above | Yes if missing |
| **Weekly refresh** | Inngest cron job | Each industry in DB | Same as above | Yes (update) |
| **Mock Quiz** | `generateQuiz()` | User industry + skills | 10 MCQs JSON | No (session only) |
| **Quiz feedback** | `saveQuizResult()` | Wrong answers + industry | Improvement tip text | Yes → `Assessment.improvementTip` |
| **Resume improve** | `improveWithAI()` | Entry description + industry | Improved paragraph | No (returned to form) |
| **Cover letter** | `generateCoverLetter()` | User profile + job details | Markdown letter | Yes → `CoverLetter` |

### 9.3 Prompt Strategy

All structured outputs use **strict JSON prompts**:

```text
Analyze the {industry} industry...
Return ONLY the following JSON format without any additional notes:
{ "salaryRanges": [...], "growthRate": number, ... }
IMPORTANT: Return ONLY the JSON. No markdown formatting.
```

Post-processing always strips markdown fences:

```javascript
const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();
const data = JSON.parse(cleanedText);
```

### 9.4 Personalization Chain

```text
User Profile (industry, skills, experience, bio)
        │
        ├──► Industry Insights  → market data for their industry
        ├──► Quiz Questions     → technical MCQs for industry + skills
        ├──► Improvement Tips   → based on wrong quiz answers
        ├──► Resume Improve     → industry-aware bullet rewrites
        └──► Cover Letter       → full letter using profile + job posting
```

---

## 10. Inngest Background Jobs

### 10.1 Purpose

Industry insights should stay fresh without users triggering regeneration. Inngest runs a **weekly cron** to refresh all industry records.

### 10.2 Components

| File | Role |
| --- | --- |
| `lib/inngest/client.js` | Inngest app client (`id: "career-coach"`) |
| `lib/inngest/function.js` | `generateIndustryInsights` cron function |
| `app/api/inngest/route.js` | Next.js API route — `serve()` exposes GET/POST/PUT |

### 10.3 Cron Schedule

```javascript
{ cron: "0 0 * * 0" }  // Every Sunday at midnight
```

### 10.4 Job Flow

```text
Inngest triggers cron
  → step.run("Fetch industries") → all IndustryInsight.industry values
  → for each industry:
      → build Gemini prompt
      → step.ai.wrap("gemini", model.generateContent, prompt)
      → parse JSON
      → step.run("Update insights") → db.industryInsight.update
      → set lastUpdated = now, nextUpdate = now + 7 days
```

### 10.5 Why Inngest Here?

- **Decouples** long AI calls from user HTTP requests
- **Retries** failed steps automatically
- **Observability** in Inngest dashboard
- **Scales** as industry count grows (can fan-out per industry)

---

## 11. Feature Walkthrough (Step by Step)

### 11.1 Landing Page (`/`)

**Type:** Server Component  
**Files:** `app/page.js`, `components/hero.jsx`, `data/features.js`, `data/faqs.js`, etc.

1. User visits `/` — no auth required
2. Server renders hero, feature cards, stats, how-it-works, testimonials, FAQ accordion, CTA
3. CTA links to `/dashboard` (middleware will redirect to sign-in if not authenticated)
4. Header shows Sign In button (SignedOut) or nav links (SignedIn)

---

### 11.2 Authentication

**Files:** `app/(auth)/sign-in/...`, `app/(auth)/sign-up/...`, `middleware.js`

1. User clicks Sign In → `/sign-in`
2. Clerk UI handles credentials/OAuth
3. On success → redirect to `/onboarding` (Clerk env config)
4. Session cookie set; middleware allows protected routes

---

### 11.3 Onboarding (`/onboarding`)

**Server:** `onboarding/page.jsx`  
**Client:** `onboarding-form.jsx`  
**Action:** `updateUser()` in `actions/user.js`

**Step-by-step:**

1. Server calls `checkUser()` — ensures DB user exists
2. Server calls `getUserOnboardingStatus()` — if already onboarded → redirect `/dashboard`
3. Client renders form with industry dropdown (from `data/industries.js`)
4. User selects industry → sub-industry options appear
5. User fills experience, skills (comma-separated), bio
6. Zod validates via `onboardingSchema` — skills transformed to array, experience to int
7. Industry formatted: `tech` + `Software Development` → `tech-software-development`
8. `updateUser()` server action:
   - Starts Prisma **transaction**
   - Checks if `IndustryInsight` exists for that industry
   - If not → calls `generateAIInsights()` → Gemini → creates insight row
   - Updates User with industry, experience, skills, bio
9. Client redirects to `/dashboard`

---

### 11.4 Industry Insights Dashboard (`/dashboard`)

**Server:** `dashboard/page.jsx`  
**Client:** `dashboard-view.jsx`  
**Actions:** `getIndustryInsights()`, `getUserOnboardingStatus()`

**Step-by-step:**

1. Check onboarded — else redirect onboarding
2. `getIndustryInsights()`:
   - Load user + `industryInsight` relation
   - If insight missing → generate via Gemini + create row
   - Return insight object
3. `DashboardView` renders:
   - Market outlook card (icon by Positive/Neutral/Negative)
   - Growth rate with progress bar
   - Demand level with color bar
   - Top skills badges
   - Salary ranges Recharts bar chart (min/median/max in $K)
   - Key trends list
   - Recommended skills badges
   - Last updated / next update dates

---

### 11.5 Interview Preparation (`/interview`)

**Server:** `interview/page.jsx`  
**Client:** `stats-cards.jsx`, `performace-chart.jsx`, `quiz-list.jsx`  
**Action:** `getAssessments()`

**Step-by-step:**

1. Server fetches all user's `Assessment` records ordered by date
2. **StatsCards** — average score, total questions practiced, latest score
3. **PerformanceChart** — line chart of scores over time (client-side Recharts)
4. **QuizList** — history of past quizzes with links to review
5. User navigates to `/interview/mock` for new quiz

---

### 11.6 Mock Interview Quiz (`/interview/mock`)

**Client:** `quiz.jsx`, `quiz-result.jsx`  
**Actions:** `generateQuiz()`, `saveQuizResult()`

**Step-by-step:**

1. Quiz shows "Start Quiz" card
2. User clicks Start → `generateQuiz()`:
   - Loads user industry + skills
   - Gemini generates 10 MCQs with 4 options each
   - Returns questions array (not persisted yet)
3. User answers one question at a time
4. Optional "Show Explanation" per question
5. On last question → `finishQuiz()`:
   - Client calculates score percentage
   - `saveQuizResult(questions, answers, score)`:
     - Builds result objects per question
     - If wrong answers → Gemini generates improvement tip
     - Creates `Assessment` row in DB
6. `QuizResult` shows score, tip, question-by-question review
7. "Start New Quiz" regenerates fresh questions

---

### 11.7 Resume Builder (`/resume`)

**Server:** `resume/page.jsx` — loads existing content  
**Client:** `resume-builder.jsx`, `entry-form.jsx`  
**Actions:** `saveResume()`, `improveWithAI()`, `getResume()`

**Step-by-step:**

1. Server loads saved resume Markdown (if any)
2. User fills contact info, summary, skills
3. Adds experience/education/project entries via `EntryForm`
4. Each entry can use **"Improve with AI"** → `improveWithAI({ current, type })`:
   - Gemini rewrites description for user's industry
   - Updated text fills the textarea
5. Live preview tab converts form → Markdown via `entriesToMarkdown()`
6. **Save** → `saveResume(content)` → upsert `Resume` row
7. **Download PDF** → html2pdf.js converts preview HTML to PDF

---

### 11.8 Cover Letter (`/ai-cover-letter`)

**Routes:**
- `/ai-cover-letter` — list all letters
- `/ai-cover-letter/new` — create form
- `/ai-cover-letter/[id]` — view generated letter

**Actions:** `generateCoverLetter()`, `getCoverLetters()`, `getCoverLetter()`, `deleteCoverLetter()`

**Step-by-step (create):**

1. User fills company name, job title, job description
2. Zod validates via `coverLetterSchema`
3. `generateCoverLetter(data)`:
   - Loads user profile (industry, experience, skills, bio)
   - Gemini writes tailored Markdown cover letter
   - Creates `CoverLetter` row with status `"completed"`
4. Redirect to `/ai-cover-letter/[id]` for preview
5. List page shows all past letters with delete option

---

## 12. Feature Interconnections

The user profile is the **hub**. Every feature reads from or writes to it.

```text
                    ┌─────────────────┐
                    │   Clerk Auth    │
                    └────────┬────────┘
                             │ checkUser()
                             ▼
                    ┌─────────────────┐
                    │   User Profile  │
                    │ industry        │
                    │ skills          │
                    │ experience      │
                    │ bio             │
                    └────────┬────────┘
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ IndustryInsight│  │  Assessment    │  │ Resume         │
│ (shared/industry)│ │  (quiz history)│  │ (1 per user)   │
└───────┬────────┘  └───────┬────────┘  └────────────────┘
        │                   │
        ▼                   ▼
   Dashboard            Interview Page
   (read insights)      (stats + chart)
        │                   │
        │                   ▼
        │              Mock Quiz
        │              (uses skills)
        │
        ▼
   Inngest Cron
   (refresh insights)

         User Profile ──► CoverLetter (many)
                    └──► improveWithAI (resume entries)
```

### Connection Matrix

| From → To | Relationship |
| --- | --- |
| Onboarding → User | Writes profile fields |
| Onboarding → IndustryInsight | Creates insight if industry is new |
| User → IndustryInsight | FK via `User.industry` = `IndustryInsight.industry` |
| User → Assessment | One user, many quiz attempts |
| User → Resume | One-to-one |
| User → CoverLetter | One-to-many |
| User profile → Gemini (all features) | Industry/skills/bio/experience in prompts |
| IndustryInsight → Dashboard | Primary data source for charts/cards |
| Assessment → Interview page | Stats, chart, history list |
| Inngest → IndustryInsight | Weekly refresh keeps dashboard current |

---

## 13. Sequence Diagrams

### 13.1 New User — Sign Up to Dashboard

```mermaid
sequenceDiagram
    actor User
    participant Clerk
    participant Middleware
    participant Onboarding as Onboarding Page
    participant Action as updateUser()
    participant Gemini
    participant DB as Neon DB
    participant Dashboard

    User->>Clerk: Sign up
    Clerk->>User: Redirect /onboarding
    User->>Middleware: GET /onboarding
    Middleware->>Clerk: Verify session ✓
    Onboarding->>DB: checkUser() — create User row
    User->>Onboarding: Fill profile form
    Onboarding->>Action: updateUser(data)
    Action->>DB: Transaction start
    Action->>DB: IndustryInsight exists?
    alt New industry
        Action->>Gemini: generateAIInsights(industry)
        Gemini-->>Action: JSON insights
        Action->>DB: Create IndustryInsight
    end
    Action->>DB: Update User profile
    Action-->>Onboarding: Success
    Onboarding->>Dashboard: router.push(/dashboard)
    Dashboard->>DB: getIndustryInsights()
    DB-->>Dashboard: IndustryInsight data
    Dashboard-->>User: Render charts & cards
```

### 13.2 Mock Interview Quiz

```mermaid
sequenceDiagram
    actor User
    participant Quiz as Quiz (Client)
    participant Gen as generateQuiz()
    participant Save as saveQuizResult()
    participant Gemini
    participant DB as Neon DB

    User->>Quiz: Click "Start Quiz"
    Quiz->>Gen: generateQuiz()
    Gen->>DB: Get user industry + skills
    Gen->>Gemini: Prompt: 10 MCQs
    Gemini-->>Gen: JSON questions
    Gen-->>Quiz: questions[]

    loop Each question
        User->>Quiz: Select answer
        Quiz->>Quiz: Store in answers[]
    end

    User->>Quiz: Finish Quiz
    Quiz->>Quiz: calculateScore()
    Quiz->>Save: saveQuizResult(questions, answers, score)

    alt Has wrong answers
        Save->>Gemini: Improvement tip prompt
        Gemini-->>Save: Tip text
    end

    Save->>DB: Create Assessment
    Save-->>Quiz: Assessment result
    Quiz-->>User: Show QuizResult
```

### 13.3 Cover Letter Generation

```mermaid
sequenceDiagram
    actor User
    participant Form as CoverLetterGenerator
    participant Action as generateCoverLetter()
    participant DB as Neon DB
    participant Gemini

    User->>Form: Enter company, title, job description
    Form->>Action: generateCoverLetter(data)
    Action->>DB: Get User (industry, skills, bio, experience)
    Action->>Gemini: Prompt with profile + job details
    Gemini-->>Action: Markdown cover letter
    Action->>DB: Create CoverLetter row
    Action-->>Form: coverLetter { id, content }
    Form->>User: Redirect /ai-cover-letter/[id]
```

### 13.4 Resume AI Improve

```mermaid
sequenceDiagram
    actor User
    participant Entry as EntryForm (Client)
    participant Action as improveWithAI()
    participant DB as Neon DB
    participant Gemini

    User->>Entry: Type experience description
    User->>Entry: Click "Improve with AI"
    Entry->>Action: improveWithAI({ current, type })
    Action->>DB: Get user industry
    Action->>Gemini: Rewrite prompt
    Gemini-->>Action: Improved paragraph
    Action-->>Entry: improvedContent
    Entry->>Entry: setValue("description", improved)
    Entry-->>User: Updated textarea
```

### 13.5 Weekly Industry Insight Refresh (Inngest)

```mermaid
sequenceDiagram
    participant Inngest
    participant Job as generateIndustryInsights
    participant DB as Neon DB
    participant Gemini

    Inngest->>Job: Cron: Sunday 00:00
    Job->>DB: findMany industries
    DB-->>Job: [{ industry: "tech-..." }, ...]

    loop Each industry
        Job->>Gemini: generateAIInsights prompt
        Gemini-->>Job: JSON insights
        Job->>DB: Update IndustryInsight
        Note over Job,DB: lastUpdated = now, nextUpdate = +7 days
    end
```

### 13.6 Server Action Call from Client Component

```mermaid
sequenceDiagram
    participant Browser
    participant Client as Client Component
    participant Next as Next.js Server
    participant Action as Server Action
    participant Clerk
    participant DB

    Browser->>Client: User action (submit/click)
    Client->>Next: POST (serialized action)
    Next->>Action: Execute on server
    Action->>Clerk: auth() → userId
    Action->>DB: Query/mutate
    Action-->>Next: Return value
    Next-->>Client: Serialized response
    Client->>Browser: Update UI + toast
```

---

## 14. Server Actions Reference

| Action | File | Auth | AI | DB Operation |
| --- | --- | --- | --- | --- |
| `updateUser` | `user.js` | ✓ | ✓ (new industry) | Transaction: insight + user update |
| `getUserOnboardingStatus` | `user.js` | ✓ | — | Read user.industry |
| `generateAIInsights` | `dashboard.js` | — | ✓ | — (helper, no auth) |
| `getIndustryInsights` | `dashboard.js` | ✓ | ✓ (fallback) | Read/create insight |
| `generateQuiz` | `interview.js` | ✓ | ✓ | Read user profile |
| `saveQuizResult` | `interview.js` | ✓ | ✓ (tips) | Create assessment |
| `getAssessments` | `interview.js` | ✓ | — | Read assessments |
| `saveResume` | `resume.js` | ✓ | — | Upsert resume |
| `getResume` | `resume.js` | ✓ | — | Read resume |
| `improveWithAI` | `resume.js` | ✓ | ✓ | Read user industry |
| `generateCoverLetter` | `cover-letter.js` | ✓ | ✓ | Create cover letter |
| `getCoverLetters` | `cover-letter.js` | ✓ | — | Read all |
| `getCoverLetter` | `cover-letter.js` | ✓ | — | Read one |
| `deleteCoverLetter` | `cover-letter.js` | ✓ | — | Delete one |

---

## 15. Styling & UI Components

### 15.1 Tailwind CSS

- Config: `tailwind.config.mjs`
- Global styles: `app/globals.css` — CSS variables for theme colors, gradient utilities (`.gradient-title`, `.gradient`)
- Dark theme forced via `ThemeProvider` with `forcedTheme="dark"`

### 15.2 Radix UI + shadcn/ui

Components in `components/ui/` follow the shadcn pattern:
- Built on Radix primitives for accessibility (keyboard nav, ARIA)
- Styled with Tailwind via `class-variance-authority` and `tailwind-merge`
- Config in `components.json`

| Component | Used For |
| --- | --- |
| `Button`, `Input`, `Textarea`, `Label` | Forms |
| `Card` | Dashboard cards, quiz, onboarding |
| `Select` | Industry/sub-industry dropdowns |
| `RadioGroup` | Quiz answer options |
| `Tabs` | Resume edit/preview |
| `Dialog`, `AlertDialog` | Confirmations |
| `DropdownMenu` | Growth Tools nav |
| `Accordion` | Landing page FAQ |
| `Badge`, `Progress` | Skills tags, scores |
| `Sonner` | Toast notifications |

### 15.3 Theme Provider

File: `components/theme-provider.jsx`

```jsx
export function ThemeProvider({ children, ...props }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

Wraps the app in `app/layout.js` for dark/light class switching (currently forced to dark).

---

## 16. Environment Variables & Local Setup

### 16.1 Required `.env`

```env
# Neon PostgreSQL
DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/onboarding
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Google Gemini
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash-lite   # optional, has default
```

### 16.2 Run Locally

```bash
# Install dependencies (runs prisma generate via postinstall)
npm install

# Apply database migrations to Neon
npx prisma migrate dev

# Start dev server (Turbopack)
npm run dev
```

App runs at `http://localhost:3000`.

For Inngest in local dev, run the Inngest dev server separately:

```bash
npx inngest-cli@latest dev
```

### 16.3 Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npx prisma studio` | Visual DB browser |

---

## 17. End-to-End User Journey

```text
1. DISCOVER
   User lands on / → reads features, FAQs, testimonials

2. SIGN UP
   Clicks CTA → Clerk sign-up → redirected to /onboarding

3. SYNC
   Header checkUser() creates User row in Neon (clerkUserId, email, name)

4. ONBOARD
   Selects Technology → Software Development
   Enters 5 years experience, "React, Node.js, Python", bio
   Submits → Gemini generates tech-software-development insights
   User profile saved → redirect /dashboard

5. EXPLORE INSIGHTS
   Dashboard shows salary chart, growth 8.2%, demand High,
   top skills, trends, recommended skills

6. PRACTICE INTERVIEW
   Goes to /interview → sees empty stats
   /interview/mock → Start Quiz → 10 AI questions
   Scores 70% → gets improvement tip → saved to Assessment
   Returns to /interview → sees stats, performance chart, history

7. BUILD RESUME
   /resume → adds experience entries
   Uses "Improve with AI" on bullet points
   Saves → Markdown stored in Resume table
   Downloads PDF

8. APPLY FOR JOB
   /ai-cover-letter/new → enters Google, Senior Engineer, job description
   Gemini generates personalized letter
   Views at /ai-cover-letter/[id]

9. ONGOING
   Every Sunday, Inngest refreshes industry insights
   User returns to dashboard for updated market data
   Takes more quizzes → performance chart trends upward
```

---

## 18. Security Model

| Concern | How SensAI Handles It |
| --- | --- |
| Authentication | Clerk sessions; middleware on protected routes |
| Authorization | Server actions use `auth()` — never trust client user ID |
| Data isolation | Queries scoped by `clerkUserId` → internal `user.id` |
| Cover letter access | `getCoverLetter(id)` filters by `userId` |
| API keys | `GEMINI_API_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL` server-only |
| SQL injection | Prisma parameterized queries |

---

## 19. Scalability & Design Decisions

### Smart Decisions

1. **Shared IndustryInsight** — One AI generation serves all users in the same industry
2. **Server Actions** — No separate REST API layer; simpler full-stack Next.js
3. **Prisma singleton** — Safe dev hot reload without connection leaks
4. **Inngest cron** — Insight refresh off the request path
5. **JSON columns for quiz questions** — Flexible schema for variable question counts

### Potential Improvements

- Validate Gemini JSON responses with Zod before DB writes
- Async insight generation during onboarding with loading UI
- Rate limiting on AI-heavy actions
- Fan-out Inngest jobs per industry for parallel refresh
- Normalize assessment questions for analytics queries

---

## Quick Reference: Where Does X Live?

| Question | Answer |
| --- | --- |
| Where is auth checked? | `middleware.js` + every server action |
| Where is user created in DB? | `lib/checkUser.js` (called from Header) |
| Where is Gemini configured? | `lib/gemini.js` |
| Where are prompts defined? | Inside each action in `actions/` + `lib/inngest/function.js` |
| How do client forms call the server? | Server Actions via `useFetch` hook |
| Where is the DB schema? | `prisma/schema.prisma` |
| Where is route protection? | `middleware.js` |
| Where is the cron job? | `lib/inngest/function.js` |
| What connects all features? | `User` profile (industry, skills, experience, bio) |

---

*This document reflects the current SensAI codebase. Use it for onboarding, interviews, and end-to-end understanding of the system.*
