# SensAi - AI Career Coach

SensAi is an AI-powered career development platform built with Next.js. It helps professionals onboard with their career profile, view personalized industry insights, practice AI-generated technical interview quizzes, and prepare for future resume and cover-letter workflows.

This document explains the project at a low-level system design level so it can be used for interviews, walkthroughs, and revision.

## 1. Project Overview

SensAi solves a common career-growth problem: users need personalized guidance, market awareness, and practice material based on their own industry and skills. Instead of showing generic career advice, the app first collects the user's industry, specialization, experience, skills, and bio. That profile becomes the context for AI-generated insights and interview questions.

The current implemented product has these main areas:

- Public landing page with product positioning, feature sections, FAQs, testimonials, and CTA buttons.
- Clerk authentication for sign-in, sign-up, session handling, and user profile menu.
- Automatic local user creation after authentication.
- Onboarding flow that stores industry, specialization, experience, skills, and bio.
- Industry insights dashboard with market outlook, growth rate, demand level, top skills, salary ranges, trends, and recommended skills.
- AI-generated mock interview quiz based on the user's industry and skills.
- Quiz result persistence through the `Assessment` table.
- Inngest scheduled job scaffolding for weekly industry insight refreshes.
- Resume and cover-letter database models with placeholder UI routes for future implementation.

## 2. Tech Stack

| Layer | Technology | Why It Is Used | Benefits |
| --- | --- | --- | --- |
| Frontend and backend framework | Next.js 16 App Router | Provides routing, server components, server actions, API routes, layouts, and image optimization in one framework. | Full-stack development in a single codebase, better performance with server rendering, simple route-based architecture. |
| UI library | React 19 | Component-based UI rendering. | Reusable components, client-side interactivity, predictable state-driven rendering. |
| Styling | Tailwind CSS 4 | Utility-first styling across the app. | Fast UI development, consistent design tokens, responsive styling without large custom CSS files. |
| Component primitives | Radix UI and shadcn-style components | Used for accessible UI controls such as dialogs, dropdowns, selects, tabs, accordions, radio groups, progress bars, and cards. | Accessibility, keyboard support, consistent UI composition. |
| Icons | Lucide React | Icon set used across navigation, feature cards, dashboard cards, and buttons. | Lightweight, consistent visual language. |
| Authentication | Clerk | Handles sign-in, sign-up, session state, and user menu. | Avoids building auth from scratch, secure session management, simple Next.js integration. |
| Database ORM | Prisma | Type-safe database modeling and queries. | Clear schema, migrations, relations, safer query API. |
| Database | PostgreSQL | Stores users, industry insights, assessments, resumes, and cover letters. | Relational integrity, arrays, JSON fields, indexing, production-ready persistence. |
| AI provider | Google Gemini via `@google/generative-ai` | Generates industry insights, quiz questions, and improvement tips. | Personalized content generation from user context. |
| Background jobs | Inngest | Runs scheduled jobs, currently for weekly industry insight regeneration. | Reliable asynchronous workflows, cron scheduling, step-level observability. |
| Forms | React Hook Form and Zod | Handles onboarding form state and validation. | Fast forms, schema-based validation, transformed values before saving. |
| Charts | Recharts | Renders salary range visualization in the dashboard. | Declarative chart components with responsive layouts. |
| Notifications | Sonner | Shows success and error toasts. | Immediate user feedback for async operations. |
| Dates | date-fns | Formats dashboard dates and relative update times. | Small, readable date utilities. |
| Theming | next-themes | Applies dark/light theme support. | Simple class-based theme switching and system preference support. |

## 3. High-Level Architecture

```text
Browser
  |
  | Next.js pages, layouts, client components
  v
Next.js App Router
  |
  | Server Components call Server Actions
  | Client Components call Server Actions through hooks
  v
Server Actions
  |
  | auth() / currentUser()
  v
Clerk Authentication
  |
  | authenticated user id
  v
Prisma ORM
  |
  v
PostgreSQL Database

AI flows:
Server Actions / Inngest Jobs
  |
  v
Google Gemini API
  |
  v
Parsed JSON / text
  |
  v
Prisma persistence and dashboard UI
```

The architecture is intentionally full-stack Next.js. Pages, layouts, API routes, server actions, and UI components live in one repository. Server actions are the business logic layer. Prisma is the data access layer. Clerk is the identity layer. Gemini is the AI generation layer. Inngest is the scheduled background-processing layer.

## 4. Folder Structure

```text
app/
  page.jsx                         Public landing page
  layout.js                        Root layout, Clerk provider, theme provider, header, footer
  globals.css                      Tailwind theme variables and custom styles
  (auth)/                          Clerk sign-in/sign-up route group
  (main)/                          Authenticated application route group
    dashboard/                     Industry insights dashboard
    onboarding/                    Profile completion flow
    interview/                     Interview prep and mock quiz flow
    ai-cover-letter/               Placeholder cover-letter routes
  api/inngest/route.js             Inngest API handler
  data/                            Static landing-page and onboarding data

actions/
  user.js                          Onboarding and user status server actions
  dashboard.js                     Industry insight AI generation and fetch actions
  interview.js                     Quiz generation and assessment persistence actions

components/
  header.jsx                       Main navigation and auth-aware menu
  hero.jsx                         Landing-page hero
  ui/                              Reusable shadcn/Radix UI components

hooks/
  use-fetch.js                     Client-side async wrapper for server actions

lib/
  prisma.js                        Prisma client singleton
  checkUser.js                     Clerk-to-database user synchronization
  inngest/                         Inngest client and background functions
  utils.ts                         Tailwind class merge helper

prisma/
  schema.prisma                    Database schema
  migrations/                      SQL migrations
```

## 5. Routing and Layout Design

The app uses the Next.js App Router.

### Root Layout

File: `app/layout.js`

The root layout wraps the entire application with:

- `ClerkProvider` for authentication.
- `ThemeProvider` from `next-themes` for dark mode.
- Global `Header`.
- Main content wrapper.
- `Toaster` for app-wide toast notifications.
- Footer.

Because the `Header` is rendered globally, every route gets the same navigation and user-state handling.

### Public Route

File: `app/page.jsx`

The landing page is publicly accessible. It renders:

- `HeroSection`
- Feature cards from `app/data/features.js`
- Static platform metrics
- How-it-works steps from `app/data/howItWorks.js`
- Testimonials from `app/data/testimonial.js`
- FAQs from `app/data/faqs.js`
- CTA linking to `/dashboard`

### Auth Routes

Files:

- `app/(auth)/sign-in/[[...sign-in]]/page.jsx`
- `app/(auth)/sign-up/[[...sign-up]]/page.jsx`
- `app/(auth)/layout.js`

These routes render Clerk's hosted UI components inside a centered auth layout.

### Main App Routes

Files under `app/(main)/` are the authenticated product area:

- `/onboarding` collects user career profile.
- `/dashboard` displays industry insights.
- `/interview` is the interview-prep landing route, currently a placeholder.
- `/interview/mock` contains the implemented mock quiz flow.
- `/ai-cover-letter` and `/ai-cover-letter/[id]` are currently placeholder routes.

## 6. Authentication and User Synchronization

Authentication is handled by Clerk.

The important bridge between Clerk and the application database is:

```text
components/header.jsx
  -> checkUser()
    -> currentUser() from Clerk
    -> db.user.findUnique({ clerkUserId })
    -> create User if missing
```

File: `lib/checkUser.js`

When a signed-in Clerk user visits the app, `checkUser()`:

1. Reads the current Clerk user using `currentUser()`.
2. Returns `null` if nobody is signed in.
3. Looks for an existing `User` row using `clerkUserId`.
4. If found, returns the existing database user.
5. If missing, creates a new user with:
   - `clerkUserId`
   - `name`
   - `imageUrl`
   - `email`

This is important because Clerk owns authentication, while PostgreSQL owns application-specific profile data such as industry, skills, assessments, resumes, and cover letters.

## 7. Database Design

File: `prisma/schema.prisma`

The database has five main models.

### User

Stores the application profile linked to Clerk.

Important fields:

- `clerkUserId`: unique Clerk identity.
- `email`: unique user email.
- `name`, `imageUrl`: copied from Clerk.
- `industry`: selected during onboarding.
- `bio`, `experience`, `skills`: career profile.
- Relations:
  - one user has many assessments.
  - one user has many cover letters.
  - one user has one resume.
  - one user belongs to one industry insight through `industry`.

### IndustryInsight

Stores AI-generated market data for an industry.

Important fields:

- `industry`: unique identifier such as `tech-software-development`.
- `salaryRanges`: JSON array of salary objects.
- `growthRate`: percentage growth.
- `demandLevel`: enum: `HIGH`, `MEDIUM`, `LOW`.
- `marketOutlook`: enum: `POSITIVE`, `NEUTRAL`, `NEGATIVE`.
- `topSkills`, `keyTrends`, `recommendedSkills`: string arrays.
- `lastUpdated`, `nextUpdate`: refresh metadata.

This table is shared across users. If many users select the same industry, they can reuse the same generated insight record.

### Assessment

Stores completed interview quiz results.

Important fields:

- `userId`: owner.
- `quizScore`: percentage score.
- `questions`: JSON array containing question, correct answer, user answer, correctness, and explanation.
- `category`: currently `"Technical"`.
- `improvementTip`: optional Gemini-generated feedback.

### Resume

Stores one resume per user.

Important fields:

- `userId`: unique, enforcing one resume per user.
- `content`: resume content.

The schema exists, but the UI and server actions for resume generation are not implemented yet.

### CoverLetter

Stores generated cover letters.

Important fields:

- `userId`
- `content`
- `jobDescription`
- `companyName`
- `jobTitle`

The schema exists, but cover-letter UI and generation logic are currently placeholders.

## 8. Low-Level Feature Design

### 8.1 Landing Page

Files:

- `app/page.jsx`
- `components/hero.jsx`
- `app/data/features.js`
- `app/data/howItWorks.js`
- `app/data/faqs.js`
- `app/data/testimonial.js`

Implementation:

- The landing page is a server component.
- Reusable static content is stored in data files.
- Feature cards and FAQ accordions are rendered by mapping over arrays.
- The hero section is a client component because it uses `useRef` and `useEffect` to animate the hero image on scroll.
- `next/image` is used for optimized images.

Connection to rest of app:

- CTA buttons link to `/dashboard`.
- If a user is signed in and onboarded, dashboard data is shown.
- If a user is not onboarded, the dashboard page redirects to onboarding.
- If a user is signed out, Clerk sign-in flow is available through the header.

### 8.2 Header and Navigation

File: `components/header.jsx`

Implementation:

- Server component that calls `checkUser()`.
- Uses Clerk components:
  - `SignedIn`
  - `SignedOut`
  - `SignInButton`
  - `UserButton`
- Shows `Industry Insights` button for signed-in users.
- Shows `Growth Tools` dropdown with links for resume, cover letter, and interview prep.

Connection to rest of app:

- The header is mounted in the root layout, so user synchronization happens whenever the app shell renders.
- Navigation exposes the main feature routes.

Current note:

- The resume link points to `/resrume`, which appears to be a typo. The intended route is likely `/resume`, but that route does not currently exist.

### 8.3 Onboarding

Files:

- `app/(main)/onboarding/page.jsx`
- `app/(main)/onboarding/_components/onboarding-form.jsx`
- `app/lib/schema.js`
- `actions/user.js`
- `app/data/industries.js`

Purpose:

Onboarding converts a newly authenticated user into a personalized career profile.

Flow:

```text
User opens /onboarding
  |
  v
getUserOnboardingStatus()
  |
  | if industry exists
  v
redirect('/dashboard')

If not onboarded:
  |
  v
Render OnboardingForm
  |
  v
User selects industry and specialization
  |
  v
React Hook Form + Zod validate and transform data
  |
  v
updateUser(server action)
  |
  v
Find current user by Clerk id
  |
  v
Find or create IndustryInsight
  |
  v
Update User profile
  |
  v
Redirect to /dashboard
```

Implementation details:

- `industries.js` provides industry and sub-industry options.
- The selected industry and sub-industry are combined into one string:

```text
{industry}-{normalized-subIndustry}
```

Example:

```text
tech-software-development
```

- `onboardingSchema` validates:
  - industry
  - subIndustry
  - experience between 0 and 50
  - optional bio with max length 500
  - comma-separated skills transformed into a string array

- `useFetch(updateUser)` wraps the async server action and exposes:
  - `loading`
  - `data`
  - `error`
  - `fn`

- On success, the form shows a success toast, navigates to `/dashboard`, and refreshes the router.

### 8.4 Industry Insights Generation

Files:

- `actions/dashboard.js`
- `actions/user.js`
- `app/(main)/dashboard/page.jsx`
- `app/(main)/dashboard/_components/dashboard-view.jsx`

Purpose:

Industry insights give the user a personalized market overview based on their selected industry.

AI prompt output contract:

Gemini is asked to return only JSON in this shape:

```json
{
  "salaryRanges": [
    {
      "role": "string",
      "min": 0,
      "max": 0,
      "median": 0,
      "location": "string"
    }
  ],
  "growthRate": 0,
  "demandLevel": "High",
  "topSkills": ["skill1"],
  "marketOutlook": "Positive",
  "keyTrends": ["trend1"],
  "recommendedSkills": ["skill1"]
}
```

Implementation:

1. `generateAIInsights(industry)` sends a structured prompt to Gemini.
2. The response text is cleaned to remove possible Markdown code fences.
3. The cleaned response is parsed with `JSON.parse`.
4. `demandLevel` and `marketOutlook` are converted to uppercase to match Prisma enums.
5. The result is stored in `IndustryInsight`.
6. `nextUpdate` is set to seven days after generation.

Connection to onboarding:

- When `updateUser()` runs, it checks whether an `IndustryInsight` already exists for the selected industry.
- If not, it generates one before updating the user profile.
- This keeps the dashboard ready immediately after onboarding.

Connection to dashboard:

- `getIndustryInsights()` fetches the authenticated user with their related `industryInsight`.
- If the insight is missing, it generates and stores one.
- The dashboard receives the insight object as a prop.

### 8.5 Dashboard

Files:

- `app/(main)/dashboard/page.jsx`
- `app/(main)/dashboard/layout.js`
- `app/(main)/dashboard/_components/dashboard-view.jsx`

Purpose:

The dashboard turns the `IndustryInsight` record into visual, interview-friendly career intelligence.

Flow:

```text
/dashboard request
  |
  v
getUserOnboardingStatus()
  |
  | if not onboarded
  v
redirect('/onboarding')
  |
  v
getIndustryInsights()
  |
  v
DashboardView(insights)
```

Dashboard sections:

- Last updated badge.
- Market outlook card with icon and next update distance.
- Industry growth card with progress bar.
- Demand level card with color indicator.
- Top skills card with badges.
- Salary ranges bar chart with min, median, and max salary.
- Key industry trends list.
- Recommended skills badges.

Implementation details:

- `date-fns` formats `lastUpdated` and relative `nextUpdate`.
- `recharts` renders salary ranges as a responsive bar chart.
- `lucide-react` icons change based on market outlook.
- Demand level color is derived from enum value.

### 8.6 Mock Interview Quiz

Files:

- `app/(main)/interview/mock/page.jsx`
- `app/(main)/interview/_components/quiz.jsx`
- `app/(main)/interview/_components/quiz-result.jsx`
- `actions/interview.js`

Purpose:

The quiz feature generates technical interview questions personalized to the user's industry and skills.

Flow:

```text
User opens /interview/mock
  |
  v
Quiz component shows "Start Quiz"
  |
  v
generatequiz(server action)
  |
  v
Gemini generates 10 MCQs
  |
  v
Client stores questions and selected answers
  |
  v
User answers one question at a time
  |
  v
Client calculates score
  |
  v
saveQuizResult(questions, answers, score)
  |
  v
Server builds question result objects
  |
  v
Gemini optionally generates improvement tip
  |
  v
Assessment row is saved
```

Question format:

```json
{
  "question": "string",
  "options": ["string", "string", "string", "string"],
  "correctAnswer": "string",
  "explanation": "string"
}
```

Client-side implementation:

- `currentQuestion` tracks quiz progress.
- `answers` stores selected answers by question index.
- `showExplanation` controls whether the current question's explanation is visible.
- `calculateScore()` compares selected answers to `correctAnswer`.
- `finishQuiz()` saves the result using a server action.

Server-side implementation:

- `generatequiz()` authenticates the user.
- It loads the user's industry and skills.
- It prompts Gemini for 10 multiple-choice technical questions.
- It cleans and parses the JSON response.
- `saveQuizResult()` creates a normalized result object for each question.
- Wrong answers are used to generate a short improvement tip.
- The final assessment is stored in PostgreSQL.

Current note:

- `quiz-result.jsx` is currently a placeholder component, so the saved result object is passed to it but not yet displayed in detail.
- `/interview` itself is also a placeholder page; `/interview/mock` contains the active quiz implementation.

### 8.7 Background Industry Refresh

Files:

- `lib/inngest/client.js`
- `lib/inngest/functions.js`
- `app/api/inngest/route.js`

Purpose:

Industry insight data should not become stale. Inngest is used to schedule a weekly regeneration job.

Flow:

```text
Inngest cron: every Sunday at 00:00
  |
  v
Fetch all IndustryInsight industries
  |
  v
For each industry:
    Generate fresh insights with Gemini
    Parse JSON
    Convert enums
    Update IndustryInsight row
```

Benefits:

- Keeps user dashboards fresh without requiring user interaction.
- Moves long-running scheduled work outside the request-response path.
- Allows step-level retries and observability through Inngest.

Current note:

- The update code uses `nextUpdated`, but the Prisma model field is `nextUpdate`. This should be corrected before relying on the scheduled job.
- The `step.ai.wrap` callback currently calls `model.generateContent(p)` without returning the result. It should return the Gemini response so parsing works reliably.

### 8.8 Resume and Cover Letter

Files:

- `prisma/schema.prisma`
- `app/(main)/ai-cover-letter/page.jsx`
- `app/(main)/ai-cover-letter/[id]/page.jsx`
- Header link for resume and cover letter

Current implementation:

- Database models exist for `Resume` and `CoverLetter`.
- Cover-letter pages are placeholders.
- Resume route/actions are not implemented.

Expected future design:

- Resume generation would use user profile context: industry, experience, skills, and bio.
- Cover-letter generation would combine user profile context with job title, company name, and job description.
- Generated content would be stored in PostgreSQL for later viewing and editing.

## 9. Data Flow Summary

### New User Flow

```text
User signs in with Clerk
  |
  v
Header calls checkUser()
  |
  v
User row is created if it does not exist
  |
  v
User visits /dashboard
  |
  v
No industry found
  |
  v
Redirect to /onboarding
  |
  v
User completes career profile
  |
  v
IndustryInsight is found or generated
  |
  v
User row is updated
  |
  v
Dashboard shows personalized insights
```

### Dashboard Data Flow

```text
Dashboard page
  |
  v
Server action authenticates Clerk user
  |
  v
Prisma fetches User + IndustryInsight
  |
  v
Missing insight triggers Gemini generation
  |
  v
Insight is stored in PostgreSQL
  |
  v
DashboardView renders charts and cards
```

### Quiz Data Flow

```text
Quiz client component
  |
  v
generatequiz()
  |
  v
Gemini returns MCQ JSON
  |
  v
User answers questions in browser
  |
  v
Client calculates percentage score
  |
  v
saveQuizResult()
  |
  v
Assessment is created in PostgreSQL
```

## 10. Important Implementation Patterns

### Server Actions as Business Logic

The app uses server actions instead of separate REST endpoints for most business operations:

- `updateUser`
- `getUserOnboardingStatus`
- `getIndustryInsights`
- `generatequiz`
- `saveQuizResult`

This keeps business logic close to the app and avoids manually creating API routes for internal mutations.

### Prisma Client Singleton

File: `lib/prisma.js`

The Prisma client is cached on `globalThis` in development. This prevents multiple Prisma clients from being created during hot reloads, which can otherwise exhaust database connections.

### Shared Async Hook

File: `hooks/use-fetch.js`

`useFetch` centralizes client-side async state:

- starts loading
- clears previous error
- runs callback
- stores response data
- stores error
- shows toast error
- stops loading

This is used by onboarding and quiz flows to call server actions from client components.

### AI JSON Contract

Both insight generation and quiz generation rely on strict prompt instructions that ask Gemini to return only JSON. The app then removes Markdown fences and parses the result.

This works well for rapid development, but production hardening should include:

- schema validation of AI responses
- retry on invalid JSON
- better error handling for malformed model output
- safer prompt boundaries

## 11. Security and Access Control

Current security design:

- Clerk manages authentication.
- Server actions call `auth()` before accessing protected data.
- User records are queried by `clerkUserId`, not by client-provided user id.
- Prisma relations enforce ownership between users and assessments, resumes, and cover letters.

Important interview point:

The client never sends a trusted user id for protected operations. The server derives identity from the Clerk session, then loads the matching database user.

Recommended improvements:

- Add route middleware to protect all `(main)` routes consistently.
- Add authorization checks for future resume and cover-letter detail pages.
- Validate all AI-generated JSON with Zod before inserting into the database.
- Add rate limiting for AI-heavy actions such as quiz and insight generation.

## 12. Scalability Considerations

The current design has good early-stage scalability because:

- Industry insights are shared per industry instead of regenerated per user.
- Background refresh is separated from page requests with Inngest.
- Dashboard reads are simple relational queries.
- AI generation happens only when insight data is missing or when the quiz starts.

Potential bottlenecks:

- AI API latency during onboarding if a new industry insight must be generated.
- Invalid AI JSON can break the request unless validated and retried.
- Large numbers of industries could make the weekly refresh job slow if processed sequentially.
- `Assessment.questions` as JSON is flexible, but harder to query analytically than normalized question rows.

Possible improvements:

- Generate industry insights asynchronously and show a loading state.
- Cache common industries.
- Add background queue for quiz generation.
- Add indexes or normalized tables for analytics-heavy assessment reports.
- Process Inngest refreshes with fan-out jobs per industry.

## 13. Error Handling

Current approach:

- Server actions throw errors for unauthenticated users and missing user records.
- Client components use `useFetch` to catch errors and display Sonner toasts.
- AI parsing errors are caught in quiz generation and rethrown as user-friendly errors.
- Improvement tip generation failure does not block assessment saving.

Recommended production improvements:

- Add structured logging.
- Add monitoring for Gemini failures and malformed responses.
- Add fallback UI for dashboard insight generation failures.
- Add retries for transient AI/API errors.

## 14. Environment Variables

The project requires environment variables similar to:

```env
DATABASE_URL="postgresql://..."
GEMINI_API_KEY="..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="..."
CLERK_SECRET_KEY="..."
```

Depending on Clerk setup, sign-in/sign-up URL variables may also be configured.

## 15. How to Run Locally

Install dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npx prisma generate
```

Apply database migrations:

```bash
npx prisma migrate dev
```

Start the development server:

```bash
npm run dev
```

Other scripts:

```bash
npm run build
npm run start
npm run lint
```

## 16. Current Known Gaps

These are useful to know for an interview because they show awareness of the real system state:

- `/interview` page is a placeholder.
- `quiz-result.jsx` is a placeholder and does not yet render score, answers, or improvement tips.
- `/ai-cover-letter` and `/ai-cover-letter/[id]` are placeholders.
- Resume schema exists, but resume UI/actions are missing.
- Header resume link has a typo: `/resrume`.
- Onboarding page imports `redirect` from `next/dist/server/api-utils`; it should use `next/navigation`.
- Inngest refresh function should update `nextUpdate`, not `nextUpdated`.
- Inngest AI wrapper should return the Gemini result.
- AI JSON responses should be validated before database writes.

## 17. Interview-Ready Explanation

SensAi is a full-stack AI career coach built on Next.js App Router. The app uses Clerk for authentication and Prisma with PostgreSQL for persistent user and career data. When a user signs in, the global header synchronizes the Clerk identity into the local `User` table. The user then completes onboarding by selecting an industry, specialization, experience, skills, and bio. That profile becomes the core personalization context for the rest of the app.

The dashboard feature is powered by an `IndustryInsight` model. When a user selects an industry, the system checks whether insights already exist for that industry. If not, it calls Gemini with a strict JSON prompt asking for salary ranges, demand level, growth rate, trends, top skills, recommended skills, and market outlook. The response is parsed, converted into Prisma-compatible enum values, stored in PostgreSQL, and shown in a dashboard with cards, badges, progress bars, and Recharts salary visualizations.

The interview feature uses the same user profile context. The client starts a quiz, calls a server action, and Gemini generates 10 multiple-choice technical questions for the user's industry and skills. The client tracks answers and calculates the score. On completion, the server stores an `Assessment` record with question-level results. If the user answered questions incorrectly, Gemini generates a short improvement tip based on those knowledge gaps.

The architecture keeps sensitive work on the server. Client components never decide user identity; server actions use Clerk's `auth()` and query the user by `clerkUserId`. Prisma handles relational persistence, and Inngest is introduced for scheduled weekly refreshes of industry insights so data can stay updated without blocking user requests.

The project is designed around a practical separation of concerns: Clerk owns identity, Prisma owns persistence, server actions own business logic, Gemini owns content generation, Inngest owns scheduled background workflows, and React components own user experience.