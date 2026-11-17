import type { AresEkonomickySubjekt, Company, ManagementContact } from '../types/company';

const ARES_SEARCH_URL =
  'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat';
const ARES_ENTITY_URL = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty';
const ARES_VR_URL = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr';
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

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fieldText(record: JsonRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) return String(value).trim();
  }
  return '';
}

function illustrativeContactDetails(name: string, index: number): Pick<ManagementContact, 'email' | 'phone'> {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '') || 'statutar';
  const suffix = String(index + 1).padStart(3, '0');
  return { email: `${slug}.${suffix}@example.com`, phone: `+420 601 000 ${suffix}` };
}

function parseManagement(value: unknown): ManagementContact[] {
  if (!isRecord(value)) return [];
  const contacts: ManagementContact[] = [];
  const seen = new Set<string>();
  const addMembers = (members: unknown, orgRole: string) => {
    if (!Array.isArray(members)) return;
    for (const item of members) {
      if (!isRecord(item) || item.datumVymazu) continue;
      const person = isRecord(item.fyzickaOsoba) ? item.fyzickaOsoba :
        isRecord(item.osoba) ? item.osoba : item;
      const name = fieldText(person, 'textOsoba', 'osobaTextem', 'obchodniJmeno') ||
        [fieldText(person, 'jmeno'), fieldText(person, 'prijmeni')].filter(Boolean).join(' ');
      if (!name) continue;
      const membership = isRecord(item.clenstvi) ? item.clenstvi : {};
      const fn = item.funkce ?? membership.funkce;
      const role = (typeof fn === 'string' ? fn : isRecord(fn) ? fieldText(fn, 'nazev', 'text', 'hodnota') : '') ||
        fieldText(item, 'nazevAngazma', 'nazevFunkce') || orgRole || 'Člen orgánu';
      const key = `${name.toLocaleLowerCase('cs')}|${role.toLocaleLowerCase('cs')}`;
      if (!seen.has(key)) {
        seen.add(key);
        contacts.push({ name, role, ...illustrativeContactDetails(name, contacts.length) });
      }
    }
  };

  const records = Array.isArray(value.zaznamy) ? value.zaznamy.filter(isRecord) : [value];
  for (const record of records) {
    for (const key of ['statutarniOrgany', 'ostatniOrgany']) {
      const organs = record[key];
      if (!Array.isArray(organs)) continue;
      for (const entry of organs) {
        if (!isRecord(entry) || entry.datumVymazu) continue;
        const role = fieldText(entry, 'nazevOrganu', 'typOrganu') ||
          (key === 'ostatniOrgany' ? 'Dozorčí orgán' : 'Statutární orgán');
        addMembers(entry.clenoveOrganu, role);
      }
    }
  }
  return contacts;
}
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
    // The bootstrap search response does not include public-register management data.
    management: [{ ...mockManagers[index % mockManagers.length] }],
    source: 'local',
  };
}

function normalizeLiveCompany(subject: AresEkonomickySubjekt, management: ManagementContact[] = []): Company | null {
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
    management,
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
    ? `${ARES_ENTITY_URL}/${normalizedIco.padStart(8, '0')}`
    : ARES_SEARCH_URL;

  try {
    const response = await fetch(url, isIcoQuery ? { signal } : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ obchodniJmeno: trimmedQuery, pocet: 20, start: 0 }),
      signal,
    });
    if (response.status === 404) {
      console.info(`Subjekt nebyl v ARES nalezen pro dotaz: ${trimmedQuery}`);
      return null;
    }
    if (!response.ok) throw new Error(`Chyba ARES: HTTP ${response.status}`);

    if (isIcoQuery) {
      const [subjectData, vrResponse] = await Promise.all([
        response.json() as Promise<unknown>,
        fetch(`${ARES_VR_URL}/${normalizedIco.padStart(8, '0')}`, { signal }).catch(() => null),
      ]);
      const vrData: unknown = vrResponse?.ok ? await vrResponse.json().catch(() => null) : null;
      const subject = isRecord(subjectData) ? subjectData as AresEkonomickySubjekt : null;
      const company = subject ? normalizeLiveCompany(subject, parseManagement(vrData)) : null;
      return company ? [company] : [];
    }

    const data = (await response.json()) as AresSearchResponse;
    return (data.ekonomickeSubjekty ?? [])
      .map((subject) => normalizeLiveCompany(subject))
      .filter((company): company is Company => company !== null);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return [];
    console.error('Chyba při vyhledávání v ARES:', error);
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

    if (!response.ok) throw new Error(`Chyba ARES: HTTP ${response.status}`);

    const data = (await response.json()) as AresSearchResponse;
    return (data.ekonomickeSubjekty ?? [])
      .slice(0, COMPANY_COUNT)
      .map(normalizeCompany)
      .filter((company): company is Company => company !== null);
  } catch (error) {
    console.error('Chyba při stahování dat z ARES:', error);
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
      console.warn('Data společností ARES se nepodařilo uložit do localStorage:', error);
    }
  }
  return companies;
}
