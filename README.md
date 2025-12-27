# Tarana.ai

**Tarana.ai** is an enterprise-grade **Agentic AI RAG (Retrieval-Augmented Generation)** travel platform that generates real-time, personalized itineraries for Baguio City. It leverages sophisticated AI agents, vector embeddings, live traffic data, weather intelligence, and multi-modal search to create optimal travel experiences. The platform uses advanced machine learning to avoid congestion, discover hidden gems, and provide seamless, context-aware recommendations—think of it as the "Intelligent Waze of Tourism."

---

## 🚀 Key Features

### 🤖 **Agentic AI System**
- **Multi-Agent Architecture**: Four specialized AI agents work in coordination to generate personalized itineraries
- **Concierge Agent**: Handles authentication, credit management, and request validation
- **ContextScout Agent**: Gathers real-time weather and traffic data for contextual awareness
- **RetrievalStrategist Agent**: Performs intelligent activity search and scoring with traffic-aware filtering
- **ItineraryComposer Agent**: Generates the final itinerary using AI with structured output guarantees
- **Pipeline Coordinator**: Orchestrates the entire multi-agent workflow with session management
- **Autonomous Sub-Query Generation**: AI automatically generates targeted search queries for broader coverage
- **Real-Time Context Adaptation**: Dynamic adjustment based on traffic, weather, and temporal conditions
- **Intelligent Fallback Mechanisms**: Multi-tier AI strategies with graceful degradation

### 🔍 **Advanced RAG Pipeline**
- **Vector Similarity Search**: 768-dimension embeddings with cosine similarity matching via Supabase pgvector
- **Multi-Modal Retrieval**: Combines semantic, vector, fuzzy, contextual, temporal, and diversity scoring
- **Intelligent Search Engine**: 6-dimensional scoring system for optimal activity recommendations
- **Dynamic Query Expansion**: AI-powered search enhancement when initial results are insufficient

### 🚦 **Real-Time Intelligence**  
- **Live Traffic Integration**: TomTom API for real-time traffic analysis and optimal timing recommendations
- **Weather-Aware Planning**: Dynamic activity filtering based on current weather conditions
- **Peak Hours Optimization**: Manila timezone-aware temporal scoring for crowd avoidance
- **Traffic-Smart Routing**: Intelligent route optimization to minimize congestion impact

### 💡 **Smart Personalization**
- **Context-Aware Generation**: AI considers user preferences, weather, traffic, and time constraints
- **Interest-Based Filtering**: Dynamic personalization based on user interests and travel style
- **Budget-Aware Recommendations**: Intelligent cost optimization across different budget ranges
- **Group Size Optimization**: Tailored recommendations for solo, couple, family, or group travel

### 🏗️ **Enterprise Architecture**
- **Optimized Performance Pipeline**: 3-5x faster generation with intelligent caching and optimization
- **Structured JSON Generation**: Schema-validated outputs with comprehensive error handling
- **Memory-Efficient Design**: Smart caching with automatic cleanup and performance monitoring
- **Scalable Domain-Driven Design**: Clean architecture following enterprise patterns

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

#### AI & RAG Stack
-   **[Google Gemini API](https://ai.google.dev/)**: Core AI model for itinerary generation and embedding creation.
    -   `@google/generative-ai`: Official client library for structured output generation.
    -   **Model Used**: `gemini-1.5-flash` for generation, `gemini-embedding-001` for 768-dim embeddings.
-   **[Supabase pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)**: Vector similarity search for semantic retrieval.
    -   **Vector Dimensions**: 768-dimensional embeddings for optimal performance.
    -   **Search Algorithm**: Cosine similarity with intelligent caching.
-   **[TomTom Traffic API](https://developer.tomtom.com/)**: Real-time traffic data integration.
    -   Live traffic flow analysis and congestion scoring.
    -   Peak hours optimization with Manila timezone awareness.
-   **[OpenWeatherMap API](https://openweathermap.org/api)**: Real-time weather data for activity filtering.
    -   Weather-aware recommendations with dynamic activity filtering.

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

## 🏗️ Agentic AI RAG Architecture

### Core System Components

#### 1. **Agentic AI Layer** (`/src/app/api/gemini/itinerary-generator/agent/`)
- **Multi-Agent Architecture**: Four specialized agents work in coordination (Concierge, ContextScout, RetrievalStrategist, ItineraryComposer)
- **Pipeline Orchestration**: Pipeline Coordinator manages agent communication and session state
- **Autonomous Query Expansion**: AI agents automatically generate sub-queries for comprehensive retrieval
- **Context-Aware Decision Making**: Real-time adaptation based on traffic, weather, and user preferences
- **Multi-Modal Intelligence**: Combines vector search, traffic data, weather conditions, and temporal optimization
- **Intelligent Fallback Strategies**: Multi-tier approach with graceful degradation

#### 2. **RAG Pipeline** (`/src/lib/search/`)
- **Unified Intelligent Search**: 6-dimensional scoring combining semantic, vector, fuzzy, contextual, temporal, and diversity metrics
- **Vector Similarity Engine**: 768-dimensional embeddings with cosine similarity via Supabase pgvector
- **Search Orchestration**: Intelligent → Semantic → Basic search fallback with performance optimization
- **Dynamic Retrieval**: Query expansion and result enhancement based on context

#### 3. **Real-Time Intelligence Layer** (`/src/lib/`)
- **Traffic Analysis Service**: TomTom API integration with Manila timezone peak hours optimization
- **Weather Intelligence**: OpenWeatherMap integration for activity filtering and recommendations  
- **Context Builder**: Sophisticated prompt engineering with real-time data fusion
- **Performance Optimizer**: Multi-layer caching with 3-5x faster generation times

#### 4. **Data Storage & Retrieval**
- **Vector Database**: Supabase with pgvector extension for semantic search
- **Activity Embeddings**: `itinerary_embeddings` table with 768-dim vectors and metadata
- **Intelligent Caching**: Multi-tier cache system with LRU eviction and cache warming
- **Schema Validation**: Zod-based type safety with automatic error recovery

### RAG Pipeline Flow

```
User Query → Agentic AI Expansion → Multi-Modal Retrieval → Context Fusion → Structured Generation

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   User Input    │───▶│  AI Agent Layer  │───▶│  RAG Retrieval      │
│ • Query         │    │ • Sub-queries    │    │ • Vector Search     │
│ • Preferences   │    │ • Context Opt.   │    │ • Traffic Data      │
│ • Constraints   │    │ • Query Expand.  │    │ • Weather Data      │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                                                           │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│ Final Itinerary │◀───│ Structured Gen.  │◀───│ Context Fusion      │
│ • Activities    │    │ • Schema Valid.  │    │ • Multi-Modal       │
│ • Timing        │    │ • JSON Output    │    │ • Score Weighting   │
│ • Traffic Tips  │    │ • Error Recovery │    │ • Personalization   │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
```

### System Architecture Layers

#### **Presentation Layer** (Next.js App Router)
- React 19 server/client components with streaming responses
- Tailwind CSS + Radix UI for modern, accessible interfaces  
- NextAuth.js authentication with Google OAuth and credentials

#### **API Gateway Layer** (`/src/app/api/`)
- `/api/gemini/itinerary-generator/` - Main RAG-powered generation endpoint
- `/api/weather/` - Weather data proxy with caching
- `/api/traffic-test/` - TomTom traffic integration validation
- `/api/auth/*` - Authentication and user management

#### **Business Logic Layer** (`/src/lib/`)
- **Search Services**: Intelligent search orchestration and optimization
- **AI Services**: Agentic query expansion and context building  
- **Data Services**: Vector embeddings, caching, and database operations
- **Integration Services**: Traffic, weather, and external API management

#### **Data Access Layer** (Supabase)
- **Postgres + pgvector**: Vector similarity search with RLS policies
- **Authentication**: User management with secure session handling
- **Storage**: Activity data, embeddings, and user preferences
- **Migrations**: Schema evolution with proper versioning

---

## 📁 Project Structure

### Core Application Structure
```
src/
├── app/                              # Next.js App Router
│   ├── api/                         # API Routes
│   │   ├── gemini/                  # AI Generation APIs
│   │   │   └── itinerary-generator/ # Main RAG Pipeline
│   │   │       ├── agent/           # Agentic AI Components
│   │   │       ├── lib/             # Core Business Logic
│   │   │       └── route/           # API Route Handlers
│   │   ├── weather/                 # Weather Intelligence API
│   │   ├── traffic-test/            # Traffic Integration API
│   │   └── auth/                    # Authentication APIs
│   ├── auth/                        # Authentication Pages
│   ├── about/                       # About & Landing Pages
│   └── saved-trips/                 # User Itinerary Management
├── components/                       # React Components
│   ├── ui/                          # shadcn/ui Components
│   ├── providers/                   # Context Providers
│   └── about/                       # Feature-Specific Components
└── lib/                             # Core Libraries
    ├── search/                      # Intelligent Search System
    │   ├── intelligentSearch.ts     # Multi-Dimensional Search Engine
    │   ├── intelligentSearchIntegration.ts # Search Orchestrator
    │   └── vectorSearch.ts          # Vector Similarity Engine
    ├── traffic/                     # Traffic Intelligence
    ├── weather/                     # Weather Services
    ├── auth/                        # Authentication Logic
    └── database/                    # Database Operations
```

### Key RAG System Files
- **`/src/app/api/gemini/itinerary-generator/agent/agent.ts`** — Agentic AI query expansion
- **`/src/app/api/gemini/itinerary-generator/lib/activitySearch.ts`** — RAG activity retrieval
- **`/src/app/api/gemini/itinerary-generator/lib/contextBuilder.ts`** — Context fusion engine
- **`/src/app/api/gemini/itinerary-generator/lib/responseHandler.ts`** — Structured generation
- **`/src/lib/search/intelligentSearchIntegration.ts`** — Unified search orchestrator
- **`/src/lib/search/intelligentSearch.ts`** — Multi-dimensional scoring engine
- **`/src/lib/search/vectorSearch.ts`** — Vector similarity search
- **`/src/lib/tomtomTraffic.ts`** — Real-time traffic intelligence
- **`/src/lib/peakHours.ts`** — Temporal optimization system

### Documentation & Configuration
- **`DEPLOYMENT.md`** — Production deployment guide
- **`SUPABASE_IMPLEMENTATION_PLAN.md`** — Database architecture plan  
- **`ROUTE_OPTIMIZATION_IMPLEMENTATION.md`** — Traffic optimization guide
- **`JSON_PARSING_FIX_DOCUMENTATION.md`** — Error handling documentation
- **`ICP_IMPLEMENTATION_PLAN.md`** — Intelligent context processing
- **`GUARANTEED_JSON_IMPLEMENTATION.md`** — Structured output system

---

## ⚡ Getting Started

### Prerequisites
- **Node.js 18+** and **npm** or **yarn**
- **Supabase account** for database and authentication
- **API Keys** for Google Gemini, TomTom Traffic, and OpenWeatherMap

### Installation

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
   
   Copy `.env.example` to `.env.local` and configure:
   
   ```bash
   # Required Environment Variables
   
   # Google Gemini AI
   GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here
   
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # TomTom Traffic API
   TOMTOM_API_KEY=your_tomtom_api_key_here
   
   # OpenWeatherMap API
   OPENWEATHERMAP_API_KEY=your_openweathermap_api_key
   
   # NextAuth Configuration
   NEXTAUTH_SECRET=your_nextauth_secret_key
   NEXTAUTH_URL=http://localhost:3000
   
   # Google OAuth (optional)
   GOOGLE_CLIENT_ID=your_google_oauth_client_id
   GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
   
   # Vector Database Reindexing
   REINDEX_SECRET=your_secure_reindex_token
   ```

4. **Set up Supabase database**
   ```bash
   # Run database migrations
   npx supabase db reset
   
   # Index sample activities (optional)
   npm run index-embeddings
   ```

5. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000) in your browser**

### API Key Setup Guide

#### Google Gemini API
1. Visit [Google AI Studio](https://ai.google.dev/)
2. Create a new API key
3. Enable Gemini API access
4. Add key to `GOOGLE_GEMINI_API_KEY`

#### TomTom Traffic API  
1. Register at [TomTom Developer Portal](https://developer.tomtom.com/)
2. Create a new application
3. Generate API key with Traffic API access
4. Add key to `TOMTOM_API_KEY`

#### OpenWeatherMap API
1. Sign up at [OpenWeatherMap](https://openweathermap.org/api)
2. Subscribe to Current Weather Data API
3. Copy your API key to `OPENWEATHERMAP_API_KEY`

---

## 🚢 Deployment

### Production Deployment (Vercel)
1. **Connect to Vercel**
   ```bash
   npm install -g vercel
   vercel login
   vercel --prod
   ```

2. **Environment Variables**
   - Copy all variables from `.env.local` to Vercel dashboard
   - Update `NEXTAUTH_URL` to your production domain
   - Ensure all API keys are configured correctly

3. **Database Setup**
   - Use Supabase production instance
   - Run migrations: `npx supabase db push`  
   - Configure production RLS policies

### Manual Deployment
```bash
npm run build
npm start
```

For detailed deployment instructions and best practices, see `DEPLOYMENT.md`.

---

## 🔌 API Endpoints

### Core Generation APIs
- **`/api/gemini/itinerary-generator/`** — Main RAG-powered itinerary generation endpoint
  - **Agentic AI Processing**: Autonomous query expansion and context optimization
  - **Multi-Modal Retrieval**: Vector search + traffic data + weather intelligence
  - **Structured Output**: Schema-validated JSON with comprehensive error handling
  - **Real-Time Intelligence**: Live traffic and weather data integration

### Utility APIs
- **`/api/weather/`** — Weather data proxy with intelligent caching
  - Server-side API key protection with 15-minute cache TTL
  - Weather-aware activity filtering and recommendations

- **`/api/traffic-test/`** — TomTom traffic integration validation endpoint
  - Real-time traffic flow data and incident monitoring
  - Peak hours optimization with Manila timezone awareness

### Authentication & Management
- **`/api/auth/*`** — NextAuth.js authentication endpoints
  - Google OAuth and credential-based authentication
  - Secure session management with Supabase integration

- **`/api/reindex/`** — Secure vector database reindexing endpoint
  - Token-protected embedding regeneration for activity data
  - Batch processing with comprehensive error handling

### Development & Monitoring
- **`/api/gemini/itinerary-generator/?action=health`** — System health check
- **`/api/gemini/itinerary-generator/?action=metrics`** — Performance metrics
- **`/api/gemini/itinerary-generator/route/instant/`** — Instant activity suggestions
- **`/api/gemini/itinerary-generator/route/stream/`** — Real-time generation progress

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

---

For questions or licensing inquiries, contact: [daa6681@students.uc-bcf.edu.ph]

---

## 🧠 RAG System Deep Dive

### Vector Database Operations

**Embedding Generation & Storage**
```bash
# Generate and store activity embeddings
npm run index-embeddings

# Or use the secure API endpoint
curl -X POST https://your-deployment.vercel.app/api/reindex \
     -H "X-ADMIN-TOKEN: your_reindex_secret"
```

**Vector Search Usage**
```typescript
import { searchSimilarActivities } from "@/lib/search/vectorSearch";

// Semantic similarity search
const results = await searchSimilarActivities("budget food adventures", 10);
console.log(results); // Returns activities with similarity scores
```

### Agentic AI Query Expansion

**AI Sub-Query Generation**
```typescript
import { proposeSubqueries } from "@/app/api/gemini/itinerary-generator/agent/agent";

// AI automatically expands user queries for comprehensive retrieval
const subqueries = await proposeSubqueries({
  userPrompt: "romantic weekend getaway",
  interests: ["fine dining", "nature"],
  weatherType: "sunny",
  durationDays: 2
});
```

### Multi-Dimensional Search Scoring

The system combines 6 scoring dimensions:
- **Semantic Score (40%)**: Vector similarity matching
- **Vector Score (25%)**: Direct embedding distance  
- **Fuzzy Score (20%)**: Text matching with typo tolerance
- **Contextual Score (20%)**: User preference alignment
- **Temporal Score (15%)**: Peak hours and timing optimization
- **Diversity Score (5%)**: Result variety and uniqueness

### Real-Time Intelligence Integration

**Traffic-Aware Filtering**
- TomTom API integration with 5-minute cache
- Manila timezone peak hours detection
- Activity recommendations with traffic context
- Only LOW traffic activities included in final results

**Weather-Aware Recommendations**  
- OpenWeatherMap real-time data integration
- Dynamic activity filtering based on conditions
- Weather-specific activity suggestions

### Testing & Validation

```bash
# Run comprehensive test suite
npm test

# Test specific RAG components
npm run test -- --testPathPattern=vectorSearch
npm run test -- --testPathPattern=intelligentSearch
```

---

## 🤖 Multi-Agent System Architecture

### Multi-Agent System Flow

```
User Query → Concierge Agent → ContextScout Agent → RetrievalStrategist Agent → ItineraryComposer Agent → Final Itinerary

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐
│   User Input    │───▶│  Concierge Agent │───▶│ ContextScout Agent  │───▶│ RetrievalStrategist     │───▶│ ItineraryComposer   │
│ • Query         │    │ • Auth & Credit  │    │ • Weather Data      │    │ • Activity Search       │    │ • Structured        │
│ • Preferences   │    │ • Validation     │    │ • Traffic Data      │    │ • Traffic-Aware Filter  │    │ • JSON Generation   │
│ • Constraints   │    │ • Session Init   │    │ • Context Building  │    │ • Activity Scoring      │    │ • Schema Validation │
└─────────────────┘    └──────────────────┘    └─────────────────────┘    └─────────────────────────┘    └─────────────────────┘
         │                       │                        │                           │                           │
         └───────────────────────┼────────────────────────┼───────────────────────────┼───────────────────────────┘
                                 │                        │                           │
                                 ▼                        ▼                           ▼
                    ┌─────────────────────────┐    ┌──────────────────┐    ┌─────────────┐
                    │   Pipeline Coordinator  │    │  Session Store   │    │   Final Itinerary   │
                    │ • Agent Orchestration   │    │ • State Mgmt     │    │ • Activities        │
                    │ • Error Handling        │    │ • Error Tracking │    │ • Timing            │
                    │ • Status Management     │    │ • Agent Results  │    │ • Traffic Tips      │
                    └─────────────────────────┘    └──────────────────┘    └─────────────┘
```

### Multi-Agent Architecture Details

#### **Concierge Agent** ([`/src/agents/conciergeAgent.ts`](src/agents/conciergeAgent.ts:1))
- Handles user authentication and credit validation
- Initializes request sessions with user preferences
- Manages request validation and error handling
- Coordinates with credit management system

#### **ContextScout Agent** ([`/src/agents/contextScoutAgent.ts`](src/agents/contextScoutAgent.ts:1))
- Gathers real-time weather data from OpenWeatherMap API
- Fetches live traffic information from TomTom API for key Baguio locations
- Builds comprehensive context payload with temporal awareness
- Integrates Manila timezone peak hours analysis

#### **RetrievalStrategist Agent** ([`/src/agents/retrievalStrategistAgent.ts`](src/agents/retrievalStrategistAgent.ts:1))
- Performs intelligent activity search using vector embeddings
- Applies traffic-aware filtering to exclude high-traffic locations
- Scores and ranks activities based on user preferences and real-time conditions
- Generates expanded queries when initial results are insufficient
#### **ItineraryComposer Agent** ([`/src/agents/itineraryComposerAgent.ts`](src/agents/itineraryComposerAgent.ts:1))
- Builds detailed prompts incorporating all gathered context
- Uses GuaranteedJsonEngine for 100% reliable JSON output
- Processes and validates the final itinerary structure
- Ensures schema compliance and error recovery


#### **Pipeline Coordinator** ([`/src/agents/pipelineCoordinator.ts`](src/agents/pipelineCoordinator.ts:1))
- Orchestrates communication between all agents
- Manages the execution flow and error propagation
- Maintains session state throughout the process
- Ensures proper agent sequencing and data flow
