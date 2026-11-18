# Project Context & AI Workflow Log

## 1. Project Overview & Architecture

- **Goal:** Web application listing Czech companies information with company/management details and filtering by location and turnover.
- **Tech Stack:** Next.js (React) + TypeScript + Tailwind CSS, no backend.
- **Data Strategy & Pipeline (Hybrid Approach):**
  - **0. Initial Runtime Data Seeding (Bootstrapping):** On initial startup, check `localStorage` for cached company data. If empty (or on manual refresh), execute a `POST` request to the official Czech ARES search endpoint (`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat`) to fetch cca 100 real Czech companies (IČO, official name, address, region, etc.), enrich them in memory with realistic dummy turnover and contact data, and save to `localStorage`.
  - **1. Local Search & Filtering (Primary):** Apply active filters (location dropdown, turnover range dropdown) and search query (company name or IČO) directly against the cached local dataset of 100 companies. Apply pagination (20 items per page) and reset `currentPage` to `1` whenever filters or search inputs change.
  - **2. Live ARES API Fallback (Secondary):** If the search query returns **0 results** locally (with a 500ms debounce) or when clicking _"Search all of ARES"_, query the live ARES REST API (`/ekonomicke-subjekty/{ico}` or `/vyhledat`) to cover any company in the Czech Republic.
  - **3. Handling Live ARES Results in UI:** Display a subtle _"Live data from ARES registry"_ badge. For missing fields, show clean fallbacks (_"Turnover: N/A in ARES"_, _"Direct contact: Not publicly available"_), direct external verification buttons linking using IČO (e.g., `https://finstat.cz/{ico}` or `https://rejstrik-firem.kurzy.cz/{ico}` for financial statements and turnover/profit info), and a _"Clear search / Back to local list"_ button.
  - **4. Data Enrichment & Mock Strategy:** Official company identity and address data come from ARES, while turnover and executive contacts in the base dataset are mocked because public registries do not expose management emails/phones (GDPR) or structured turnover via a single free API.

## 2. AI Coding Rules & Guidelines (System Context for AI)

- Keep components modular, clean, and strictly typed (`AresEkonomickySubjekt` for raw API responses, `Company` for normalized app state).
- Normalize IČO inputs (strip spaces, pad with leading zeros to 8 digits) before querying ARES.
- Prioritize UX speed: instant client-side filtering for the base dataset, debounced API calls for live ARES search, and graceful UI error states (no `alert()` popups).

## 3. Iteration & Prompt Log (What I solved with AI)

- **[Step 1] Architecture & Data Discovery:** Evaluated ARES REST API endpoints. Identified GDPR restrictions (no executive emails/phones) and missing structured turnover. Designed the runtime bootstrapping + `localStorage` + live ARES fallback architecture.
- **[Step 2] TypeScript Models & ARES Service:** Defined strict TypeScript interfaces and adapted existing ARES fetching/address-parsing logic into a clean service layer.
- **[Step 3] Core UI, Filtering & Pagination:** Built the company list/cards, region and turnover filters, 20-per-page paginator, and company detail view with external verification links (`kurzy.cz` / `finstat`).
- **[Step 4] Live ARES Fallback:** Added automatic fallback search when local results are empty, plus explicit ARES lookup.
- **[Step 5] Deployment & Documentation:** Deployed to free-tier hosting (GCP / Firebase Hosting) and documented known issues and trade-offs.
