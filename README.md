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
- **Framework**: Next.js (App Router, TypeScript)
- **Styling**: Tailwind CSS, PostCSS
- **Backend**: Supabase (database, authentication, storage)
- **AI**: Google Gemini API
- **Authentication**: NextAuth.js (Google OAuth, credentials)
- **Other**: Framer Motion, React Icons, ESLint, Vercel

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
