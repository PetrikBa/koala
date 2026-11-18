# Koala · Business Registry (ARES)

A web application for seamless searching of Czech business entities, filtering companies, and displaying real statutory bodies directly from public registries (ARES / Public Register).

## Context & Architectural Approach (MVP)

- **Scope ("List all companies from the Czech Republic"):** Fetching the entire Czech business registry on initial load is not feasible due to extreme performance overhead and strict ARES API rate limits. Instead, the app bootstraps with a representative sample of multiple companies and provides dynamic, on-demand lookup for any registered Czech entity via its **IČO** (Company ID).
- **MVP Status:** This project serves as a functional Minimum Viable Product (MVP) with room for further UI/UX and data-pipeline enhancements.

---

## Key Features

- **Initial Dataset & Cache (`localStorage`):** On initial launch, the application fetches a sample of ~100 companies from ARES and caches them in the browser's local storage (`koala:companies:v1`) for instant loading without unnecessary load on the external API.
- **Local Filtering & Pagination:** Instant search by company name or IČO within the loaded dataset, filtering by location (region/municipality) and turnover, complete with pagination (20 records per page).
- **Live ARES Search:** If the entered IČO is not found in the local dataset, the application automatically queries the live ARES REST API.
- **Real Statutory Bodies from the Public Register (VR):** When searching by IČO or opening a company's detail modal, the application concurrently fetches data from the `/ekonomicke-subjekty-vr/{ico}` endpoint and parses statutory bodies and supervisory boards (managing directors, board members, etc.).
- **External Registry Verification:** Direct links to the company's profile on FinStat, Kurzy.cz, and the official ARES portal to look up turnover figures, statutory officers, or official filings and documents.

---

## Tech Stack

- **Framework:** Next.js (React Client Components)
- **Language:** TypeScript
- **Styling:** CSS + Tailwind CSS utility classes
- **Data Source:** ARES REST API (`ares.gov.cz`)

---

## Key File Structure

- `app/page.tsx` – Main page, data table, filters, pagination, and company detail modal.
- `src/services/companyBootstrap.ts` – ARES API integration, caching, data normalization, and Public Register (VR) parser.
- `src/types/company.ts` – TypeScript interfaces (`Company`, `ManagementContact`, `AresEkonomickySubjekt`).

---

## How ARES Data Fetching Works

1. **Bootstrap (`bootstrapCompanies` / `fetchAresCompanies`):**
   - Queries `POST /ekonomicke-subjekty/vyhledat` (100 records by default).
   - To ensure fast startup times and avoid ARES API rate-limiting, detailed statutory officer queries are skipped during the initial bulk load (turnover and contact details in the local dataset are illustrative placeholders).

2. **Live Search & Company Detail (`searchLiveAres` & `CompanyDetails`):**
   - When searching by a specific IČO or opening a company's detail view, two parallel requests are executed via `Promise.all`:
     - `GET /ekonomicke-subjekty/{ico}` – basic identification details and registered address.
     - `GET /ekonomicke-subjekty-vr/{ico}` – extract from the Public Register.
   - The `parseManagement` function processes the `statutarniOrgany` and `ostatniOrgany` sections, filters out historical records containing a `datumVymazu` (deletion date) attribute, and maps the active members' real names and roles.

---

## Edge Cases & Data Loading Considerations

1. **Graceful Fallback:** ARES errors do not crash the UI. On a `404` status, the service returns `null`, and the app displays *"Entity not found in ARES"*. For other errors, it returns an empty list, showing a no-results state (though it currently doesn't strictly distinguish between an API outage and a successful search with zero matches).
2. **LocalStorage Cache:** Caching speeds up subsequent loads, but in the current implementation, it does not auto-refresh or expire. If registry data changes, local data may remain stale until the cache is cleared.
3. **IČO vs. Name Search:** For numeric queries, the app targets the specific IČO endpoint since a precise IČO uniquely identifies an entity. When searching by name, it uses the ARES search endpoint because names are not unique. Note that ARES warns about automated query limitations and potential throttling or blocking upon excessive or improper usage.

---

## Why Live Name-Based Search in ARES Is Restricted

Sending live company name queries directly to the ARES API at this stage is suboptimal for several reasons:
1. **Too Many Results / Overload:** ARES returns a massive amount of matches that would require real-time processing, filtering, and parsing on the client side.
2. **Performance & UX:** Live searching for broad or ambiguous names would unnecessarily slow down the application and trigger excessive network requests (even with debouncing implemented).
3. **Complete Coverage via IČO:** Not all companies in the Czech Republic are loaded on initial startup, but searching or filtering via a specific IČO allows us to look up any Czech company dynamically.

---

## Known Issues, Trade-offs & Future Improvements (TODO)

- **UI Flicker on Detail Modal Load:** When opening a company's detail modal, the live fetch for statutory bodies causes a brief visual flicker as placeholder data gets replaced by live registry records.
  - *Future Solution:* Delay modal rendering until the initial VR fetch resolves, or introduce a dedicated loading skeleton state inside the modal or spinner/loader.
- **Missing Real Contact Details:** Phone numbers and emails for management are currently mocked due to GDPR restrictions in public registries.
  - *Future Solution (AI Agent Enrichment):* Implement an autonomous background agent that takes the company's IČO and name, finds its official website, crawls `/contact` or `/about-us` pages, and extracts real executive emails/phone numbers.
- **Turnover Data:** Real-time turnover is not directly available in ARES JSON responses (only buried in unstructured PDF financial statements in *Sbírka listin*).
  - *What I would do differently with more time:* Build an automated OCR/LLM pipeline to parse *Sbírka listin* PDFs or integrate a commercial/paid API (e.g., Merk).
- **Time Spent & Process:** ~3 hours total. The work included public API research and data acquisition strategies, integrating the functionality into a smooth and reasonable user experience, followed by core development and testing.

---

## Running the Project Locally

1. **Install dependencies:**
   `npm install`

2. **Start the development server:**
   `npm run dev`

3. **Open in your browser:**
   The application runs at `http://localhost:3000`.

4. **Linting and production build:**
   `npm run lint`
   `npm run build`

---

## Data Disclaimer

- **Business Name, IČO, Address, and Statutory Bodies (Names & Roles):** Real-time data sourced from the official ARES / Public Register.
- **Turnover (in the local dataset), E-mails, and Phone Numbers:** Illustrative/mock data, as the public ARES registry does not provide financial turnover or direct contact details in this scope.
