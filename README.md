# Tarana.ai

**Tarana.ai** is an AI-powered travel platform that generates real-time, personalized itineraries for Baguio City. It leverages live data (traffic, crowd density, weather, mobility patterns) and user preferences to help tourists avoid congestion, discover hidden gems, and enjoy smoother, more meaningful trips. The platform aims to reduce overtourism, support local businesses, and make urban travel more sustainable—think of it as the "Waze of Tourism."

---

## 🚀 Features
- **Personalized Itinerary Generation**: Uses AI and real-time data (traffic, weather, crowd) to create unique travel plans.
- **User Authentication**: Email/password and Google OAuth via NextAuth.js and Supabase.
- **Itinerary Management**: Save, update, and delete itineraries (CRUD operations).
- **Weather-Aware Recommendations**: Suggests activities based on current weather.
- **Traffic-Smart Routing**: Optimizes routes to avoid congestion.
- **Support for Multiple Traveler Types**: Solo, family, couple, group.
- **Modern, Responsive UI**: Built with Tailwind CSS and React.

---

## 🛠️ Tech Stack

#### Frameworks & Core Libraries
-   **[Next.js](https://nextjs.org/)** (v15, App Router): Full-stack React framework for modern hybrid apps.
-   **[React 19](https://react.dev/)**: UI library powering both client and server components.
-   **[Node.js](https://nodejs.org/)**: The runtime environment for the backend.

#### Backend & Database
-   **[Supabase](https://supabase.com/)**: Managed PostgreSQL with built-in authentication & storage.
    -   `@supabase/supabase-js`: The official JavaScript client for Supabase.
    -   `pgvector`: Postgres extension enabling vector similarity search for semantic retrieval.
-   **[NextAuth.js](https://next-auth.js.org/)**: Handles user authentication (Google OAuth & Credentials).
-   **[bcryptjs](https://www.npmjs.com/package/bcryptjs)**: For hashing user passwords.

#### AI & APIs
-   **[Google Gemini API](https://ai.google.dev/)**: The AI model used for generating itineraries.
    -   `@google/generative-ai`: The official client library.
-   **[OpenWeatherMap API](https://openweathermap.org/api)**: Used to fetch real-time weather data.

#### UI & Styling
-   **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first styling framework.
    -   `autoprefixer`: Parses CSS and adds vendor prefixes.
    -   `postcss`: A tool for transforming CSS with JavaScript.
    -   `tailwind-merge`: A utility for merging Tailwind classes without style conflicts.
    -   `tailwindcss-animate`: A Tailwind CSS plugin for animations.
-   **Radix UI + shadcn/ui**: Accessible headless components with custom styling.
-   **[Framer Motion](https://www.framer.com/motion/)**: A library for creating animations.
-   **[clsx](https://github.com/lukeed/clsx)** & **[class-variance-authority](https://cva.style/)**: For constructing conditional and variant-based class names.
-   **Icons**:
    -   `lucide-react`: A library of simply designed icons.
    -   `@heroicons/react`: Icons from the Heroicons library.
    -   `react-icons`: A comprehensive icon library.

#### Utilities & Helper Libraries
- **date-fns**: Lightweight modern date utility library used for formatting and calculations.
- **react-day-picker**: Accessible calendar component for date-range selection in forms.
- **jsonrepair**: Small helper to fix malformed JSON returned by LLMs before parsing.

#### Development & Tooling
-   **[TypeScript](https://www.typescriptlang.org/)**: A typed superset of JavaScript.
-   **[ESLint](https://eslint.org/)**: Linting & code-style enforcement.
-   **Jest + ts-jest**: Unit / integration testing for TypeScript.
-   **tsx**: Run TypeScript scripts without pre-compilation (e.g., `npm run index-embeddings`).
-   **dotenv**: Loads environment variables from `.env.*` files.
-   **Vercel**: Serverless deployment & hosting.
-   **Supabase CLI**: Manage local Supabase dev & migrations.

---

## 🏗️ Architecture Overview

1. **Client (Next.js App Router)**  
   • React 19 components rendered on the edge or client.  
   • Tailwind CSS + Radix UI/shadcn for styling and headless components.  
   • Auth context provided by **NextAuth.js** via `components/providers/SessionProvider.tsx`.  

2. **API Routes (Next.js)**  
   • `/api/gemini` – Generates itineraries.  
   • `/api/weather` – Weather proxy.  
   • `/api/auth/*` – Credential / OAuth flow.  
   • `/api/reindex` – Secure endpoint that triggers embedding (vector-DB) re-indexing.  

3. **Embedding & Vector Storage**  
   • Script `scripts/indexSampleItinerary.ts` calls `upsertActivityEmbedding` → Gemini embedding → Supabase `activities` table with a `vector` column (`pgvector`).  
   • Runtime similarity search is handled by `src/lib/vectorSearch.ts` which wraps Supabase RPC queries.  

4. **Database (Supabase / Postgres)**  
   • Schema and migrations live in `supabase/migrations/*` (RLS, pgvector, extra columns).  
   • Row-level security enabled; service role used by backend scripts.  

5. **Authentication**  
   • NextAuth.js sessions persisted via Supabase.  
   • Passwords hashed with `bcryptjs`.  

6. **Deployment**  
   • Front/Back deployed on Vercel.  
   • Database managed by Supabase.  

Sequence diagram (high-level):
```
User → Next.js Page → calls /api/gemini
              │
              ├─ fetch real-time weather (/api/weather)
              ├─ vectorSearch (Supabase pgvector)
              └─ Gemini API (Google Generative AI)
                        │
                    JSON itinerary → Page renders
```

---

## 📁 Project Structure
- `src/app/` — Main Next.js app (pages, API routes, layouts)
- `src/components/` — Reusable UI and feature components
- `src/lib/` — Utility functions, Supabase clients, authentication logic
- `public/` — Static assets (images, fonts, etc.)
- `supabase/` — Database migrations and policies
- `DEPLOYMENT.md` — Deployment and environment variable setup
- `SUPABASE_IMPLEMENTATION_PLAN.md` — Supabase integration roadmap

---

## ⚡ Getting Started

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd tarana.ai
   ```
2. **Install dependencies**
   ```bash
   npm install
   # or
yarn install
   ```
3. **Set up environment variables**
   - Copy `.env.example` to `.env.local` and fill in the required keys (see `DEPLOYMENT.md`).
4. **Run the development server**
   ```bash
   npm run dev
   # or
yarn dev
   ```
5. **Open [http://localhost:3000](http://localhost:3000) in your browser**

---

## 🚢 Deployment
- Deploy easily to Vercel (see `DEPLOYMENT.md` for environment variable setup and best practices).
- Production build: `npm run build` and `npm start`.

---

## 🔌 API Overview
- `/api/gemini` — Generates itineraries using Google Gemini AI, considering user preferences and weather.
- `/api/weather` — Fetches weather data for Baguio City (server-side, protects API key).
- `/api/auth/*` — Handles user registration, login, and authentication (NextAuth.js + Supabase).

---

## 🤝 Contributing Guidelines

We're excited to have you contribute! To ensure a smooth and collaborative process, please follow these guidelines.

#### Development Workflow
1.  **Pick an issue**: Assign yourself to an existing issue or create a new one to discuss your proposed changes.
2.  **Create a branch**: Create a new branch from `main` using the following naming convention:
    -   `feature/<issue-number>-<short-description>` (e.g., `feature/12-add-user-profile-page`)
    -   `fix/<issue-number>-<short-description>` (e.g., `fix/15-fix-login-button-bug`)
3.  **Code**: Make your changes, following the project's code style.
4.  **Commit**: Use Conventional Commits for your commit messages (see below).
5.  **Lint**: Run the linter before pushing:
    ```bash
    npm run lint
    ```
6.  **Push**: Push your branch to the repository.
7.  **Create a Pull Request**: Open a PR from your branch to `main` and link it to the relevant issue.

#### Commit Message Convention
We use [**Conventional Commits**](https://www.conventionalcommits.org/en/v1.0.0/) to keep our commit history clean and readable. Each commit message should follow this format:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

-   **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`.
-   **Scope** (optional): The part of the codebase you're changing (e.g., `auth`, `itinerary`, `ui`).

**Example:**
```
feat(auth): add password reset functionality

Users can now request a password reset from the sign-in page. This adds the necessary API endpoint and UI components.

Resolves: #23
```

#### Pull Request Process
1.  **Create a PR**: Open a pull request from your feature/fix branch to the `main` branch.
2.  **Write a clear description**:
    -   Provide a concise summary of the changes.
    -   Explain the "why" behind your changes.
    -   Include screenshots or GIFs for UI changes.
    -   Link the PR to the issue it resolves (e.g., "Closes #12").
3.  **Request a review**: Assign at least one team member to review your PR.
4.  **Address feedback**: Make any necessary changes based on the feedback.
5.  **Merge**: Once approved, your PR will be squashed and merged into `main`.

#### Code Style
-   We use **ESLint** for linting and **Prettier** for code formatting.
-   Run `npm run lint` to check for and fix issues.
-   Follow the existing conventions in the codebase for consistency.

#### Reporting Bugs
-   Use the **"Bug Report"** issue template on GitHub.
-   Provide a clear title, a detailed description of the bug, steps to reproduce it, and what you expected to happen.

#### Acknowledgment

By contributing, you agree that your contributions will be licensed under the project's proprietary license.

---

## 📜 License

This project is **not open source**. All rights reserved by Doniele Arys Antonio and Tarana.ai. See `LICENSE` for details.

---

## 👥 Credits

- Doniele Arys Antonio (CTO, Lead Full Stack AI Engineer)
- Gemwil Salayog (CEO)
- Cedric Navalta (CMO)
- Leandro Gepila (CPO)
- Jasper Gubatan (Chief Architect)

---

For questions or licensing inquiries, contact: [daa6681@students.uc-bcf.edu.ph]

## Vector Search & Retrieval-Augmented Generation

This project uses **Supabase Postgres + pgvector** to provide semantic retrieval for Gemini prompts.

### Prerequisites

1. Environment variables

```
GOOGLE_GEMINI_API_KEY=your_google_key
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # server-side only
REINDEX_SECRET=some-long-random-string            # protects /api/reindex
```

2. Enable pgvector & create schema

```
supabase db push            # or run SQL in supabase/migrations/20240730000000_add_itinerary_embeddings_pgvector.sql
```

### Index existing activities

```bash
npm run index-embeddings     # generates embeddings for sample itinerary and upserts to Supabase
```

Or deploy and call the secured endpoint:

```bash
curl -X POST https://<deployment>/api/reindex \
     -H "X-ADMIN-TOKEN: $REINDEX_SECRET"
```

### Running similarity search locally

```ts
import { searchSimilarActivities } from "@/lib/vectorSearch";
const results = await searchSimilarActivities("budget-friendly food", 10);
```

### Adding or updating activities

1. Edit the seed file at `src/app/itinerary-generator/components/itineraryData.ts` (or create new JSON files under `scripts/data/`).
2. Run `npm run index-embeddings` again. The script will:
   - Generate embeddings for each activity using Gemini.
   - Upsert each row into Supabase’s `activities` table (existing `activity_id`s are updated; new ones are inserted).
3. Confirm the changes in Supabase (dashboard or SQL query).

The application now reads exclusively from the vector database; the seed file remains a version-controlled source of truth for local development and CI.

### Tests

```
npm test   # runs Jest + ts-jest unit tests for embeddings and vector search
```