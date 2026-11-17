import type { AresEkonomickySubjekt, Company, ManagementContact } from '../types/company';

const ARES_SEARCH_URL =
  'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat';
export const COMPANY_STORAGE_KEY = 'koala:companies:v1';
const COMPANY_COUNT = 100;

interface AresSearchResponse {
  ekonomickeSubjekty?: AresEkonomickySubjekt[];
}

const mockManagers: ManagementContact[] = [
  { name: 'Jan Novák', role: 'Jednatel', email: 'jan.novak@example.com', phone: '+420 601 234 567' },
  { name: 'Petra Svobodová', role: 'Jednatelka', email: 'petra.svobodova@example.com', phone: '+420 602 345 678' },
  { name: 'Tomáš Dvořák', role: 'Jednatel', email: 'tomas.dvorak@example.com', phone: '+420 603 456 789' },
];

function asText(value: number | string | undefined): string {
  return value == null ? '' : String(value).trim();
}

function normalizeCompany(subject: AresEkonomickySubjekt, index: number): Company | null {
  const ico = asText(subject.ico);
  const name = asText(subject.obchodniJmeno);
  if (!ico || !name) return null;

  const office = subject.sidlo ?? {};
  const houseNumber = asText(office.cisloDomovni);
  const orientationNumber = asText(office.cisloOrientacni);
  const street = [asText(office.nazevUlice), houseNumber]
    .filter(Boolean)
    .join(' ')
    .concat(orientationNumber ? `/${orientationNumber}` : '');

  return {
    ico,
    name,
    address: {
      street,
      city: asText(office.nazevObce),
      region: asText(office.nazevKraje),
      zip: asText(office.psc),
      country: asText(office.nazevStatu) || 'Česká republika',
    },
    // ARES does not provide turnover in this search response; this is demo data.
    turnoverCzk: (index % 5 + 1) * 2_500_000 + (index % 3) * 375_000,
    // Contacts are clearly synthetic placeholders, not registry data.
    management: [{ ...mockManagers[index % mockManagers.length] }],
    source: 'local',
  };
}

function normalizeLiveCompany(subject: AresEkonomickySubjekt): Company | null {
  const ico = asText(subject.ico);
  const name = asText(subject.obchodniJmeno);
  if (!ico || !name) return null;

  const office = subject.sidlo ?? {};
  const houseNumber = asText(office.cisloDomovni);
  const orientationNumber = asText(office.cisloOrientacni);
  const street = [asText(office.nazevUlice), houseNumber]
    .filter(Boolean)
    .join(' ')
    .concat(orientationNumber ? `/${orientationNumber}` : '');

  return {
    ico,
    name,
    address: {
      street,
      city: asText(office.nazevObce),
      region: asText(office.nazevKraje),
      zip: asText(office.psc),
      country: asText(office.nazevStatu) || 'Česká republika',
    },
    turnoverCzk: null,
    management: [],
    source: 'ares-live',
  };
}

/** Search ARES live by normalized IČO, or by company name for non-numeric queries. */
export async function searchLiveAres(query: string, signal?: AbortSignal): Promise<Company[] | null> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const normalizedIco = trimmedQuery.replace(/\s/g, '');
  const isIcoQuery = /^\d{1,8}$/.test(normalizedIco);
  const url = isIcoQuery
    ? `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${normalizedIco.padStart(8, '0')}`
    : ARES_SEARCH_URL;

  try {
    const response = await fetch(url, isIcoQuery ? { signal } : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ obchodniJmeno: trimmedQuery, pocet: 20, start: 0 }),
      signal,
    });
    if (response.status === 404) {
      console.info(`ARES entity not found for query: ${trimmedQuery}`);
      return null;
    }
    if (!response.ok) throw new Error(`ARES error: ${response.status}`);

    if (isIcoQuery) {
      const subject = (await response.json()) as AresEkonomickySubjekt;
      const company = normalizeLiveCompany(subject);
      return company ? [company] : [];
    }

    const data = (await response.json()) as AresSearchResponse;
    return (data.ekonomickeSubjekty ?? [])
      .map(normalizeLiveCompany)
      .filter((company): company is Company => company !== null);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return [];
    console.error('Chyba pri vyhľadávaní v ARES:', error);
    return [];
  }
}

/** Fetch and normalize up to 100 Czech companies from the ARES search endpoint. */
export async function fetchAresCompanies(): Promise<Company[]> {
  try {
    const response = await fetch(ARES_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ obchodniJmeno: 'Energie', pocet: COMPANY_COUNT, start: 0 }),
    });

    if (!response.ok) throw new Error(`ARES error: ${response.status}`);

    const data = (await response.json()) as AresSearchResponse;
    return (data.ekonomickeSubjekty ?? [])
      .slice(0, COMPANY_COUNT)
      .map(normalizeCompany)
      .filter((company): company is Company => company !== null);
  } catch (error) {
    console.error('Chyba pri sťahovaní z ARES:', error);
    return [];
  }
}

function readCachedCompanies(): Company[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = window.localStorage.getItem(COMPANY_STORAGE_KEY);
    if (!cached) return null;
    const parsed: unknown = JSON.parse(cached);
    return Array.isArray(parsed) ? (parsed as Company[]) : null;
  } catch {
    return null;
  }
}

/** Return the saved dataset, or seed localStorage from ARES when it is empty. */
export async function bootstrapCompanies(): Promise<Company[]> {
  if (typeof window === 'undefined') return [];

  const cached = readCachedCompanies();
  if (cached?.length) return cached;

  const companies = await fetchAresCompanies();
  if (companies.length) {
    try {
      window.localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(companies));
    } catch (error) {
      // Storage may be unavailable or full; callers can still use this session's data.
      console.warn('Could not cache ARES companies in localStorage:', error);
    }
  }
  return companies;
}
