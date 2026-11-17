'use client';

import { useEffect, useState } from 'react';
import { bootstrapCompanies, searchLiveAres } from '../src/services/companyBootstrap';
import type { Company } from '../src/types/company';

const currency = new Intl.NumberFormat('cs-CZ', {
  style: 'currency',
  currency: 'CZK',
  maximumFractionDigits: 0,
});
const PAGE_SIZE = 20;
const TURNOVER_FILTERS = [
  { value: 'all', label: 'Všechny obraty' },
  { value: 'under-5m', label: 'Do 5 mil. Kč' },
  { value: '5m-10m', label: '5–10 mil. Kč' },
  { value: 'over-10m', label: 'Nad 10 mil. Kč' },
] as const;

function companyAddress(company: Company): string {
  return [
    company.address.street,
    company.address.city,
    company.address.zip,
    company.address.region,
  ].filter(Boolean).join(', ') || 'Adresa není k dispozici';
}

function CompanyDetails({ company, onClose }: { company: Company; onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="company-modal" role="dialog" aria-modal="true" aria-labelledby="company-modal-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Detail společnosti</p>
            <h2 id="company-modal-title">{company.name}</h2>
            <p className="muted">IČO {company.ico}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Zavřít detail">×</button>
        </div>

        <div className="detail-grid">
          <div className="detail-block">
            <span className="detail-label">Sídlo</span>
            <p>{companyAddress(company)}</p>
            <span className="detail-label detail-label-spaced">Obrat</span>
            <p>{company.turnoverCzk == null ? 'Turnover: N/A in ARES' : currency.format(company.turnoverCzk)}</p>
          </div>

          <div className="detail-block">
            <span className="detail-label">Vedení a kontakty</span>
            {company.management.length ? company.management.map((contact, index) => (
              <div className="contact" key={`${contact.name}-${index}`}>
                <strong>{contact.name}</strong>
                <span>{contact.role}</span>
                {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
                {contact.phone && <a href={`tel:${contact.phone.replaceAll(' ', '')}`}>{contact.phone}</a>}
              </div>
            )) : <p className="muted">Direct contact: Not publicly available</p>}
            {company.source === 'local' && <p className="demo-note">Ukázkové kontakty a obrat jsou ilustrační údaje.</p>}
          </div>
        </div>

        <div className="verification">
          <h3>Ověřit společnost</h3>
          <div className="verification-links">
            <a href={`https://www.finstat.cz/${encodeURIComponent(company.ico)}`} target="_blank" rel="noreferrer">FinStat <span aria-hidden="true">↗</span></a>
            <a href={`https://rejstrik-firem.kurzy.cz/${encodeURIComponent(company.ico)}/`} target="_blank" rel="noreferrer">Kurzy.cz <span aria-hidden="true">↗</span></a>
            <a href={`https://ares.gov.cz/ekonomicke-subjekty?ico=${encodeURIComponent(company.ico)}`} target="_blank" rel="noreferrer">ARES <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveCompanies, setLiveCompanies] = useState<Company[]>([]);
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [liveNotFoundQuery, setLiveNotFoundQuery] = useState('');
  const [liveSearchLoading, setLiveSearchLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedTurnover, setSelectedTurnover] = useState<(typeof TURNOVER_FILTERS)[number]['value']>('all');

  const locations = Array.from(new Set(companies.map((company) => company.address.region || company.address.city).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'cs'));
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('cs-CZ');
  const icoQuery = searchQuery.replace(/\s/g, '');
  const filteredCompanies = companies.filter((company) => {
    const matchesSearch = !normalizedQuery
      || company.name.toLocaleLowerCase('cs-CZ').includes(normalizedQuery)
      || company.ico.replace(/\s/g, '').includes(icoQuery);
    const location = company.address.region || company.address.city;
    const matchesLocation = selectedLocation === 'all' || location === selectedLocation;
    const turnover = company.turnoverCzk;
    const matchesTurnover = selectedTurnover === 'all'
      || (turnover != null && selectedTurnover === 'under-5m' && turnover < 5_000_000)
      || (turnover != null && selectedTurnover === '5m-10m' && turnover >= 5_000_000 && turnover <= 10_000_000)
      || (turnover != null && selectedTurnover === 'over-10m' && turnover > 10_000_000);
    return matchesSearch && matchesLocation && matchesTurnover;
  });
  const isLoading = !mounted || loading;
  const normalizedIcoQuery = searchQuery.trim().replace(/\s/g, '');
  const isIcoQuery = /^\d{1,8}$/.test(normalizedIcoQuery);
  const currentLiveCompanies = liveSearchQuery === searchQuery.trim() ? liveCompanies : [];
  const liveEntityNotFound = Boolean(searchQuery.trim()) && liveNotFoundQuery === searchQuery.trim();
  const shouldUseLiveSearch = !isLoading && filteredCompanies.length === 0 && isIcoQuery;
  const showingLiveResults = shouldUseLiveSearch && currentLiveCompanies.length > 0;
  const displayCompanies = filteredCompanies.length > 0 ? filteredCompanies : currentLiveCompanies;
  const pageCount = Math.ceil(displayCompanies.length / PAGE_SIZE);
  const visibleCompanies = displayCompanies.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateSearch(value: string) {
    setSearchQuery(value);
    setCurrentPage(1);
  }

  function updateLocation(value: string) {
    setSelectedLocation(value);
    setCurrentPage(1);
  }

  function updateTurnover(value: (typeof TURNOVER_FILTERS)[number]['value']) {
    setSelectedTurnover(value);
    setCurrentPage(1);
  }

  useEffect(() => {
    let active = true;
    setMounted(true);
    bootstrapCompanies()
      .then((data) => { if (active) setCompanies(data); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const query = searchQuery.trim();
    setLiveCompanies([]);
    setLiveSearchQuery('');
    setLiveNotFoundQuery('');
    setLiveSearchLoading(false);

    if (!mounted || loading || filteredCompanies.length > 0 || !/^\d{1,8}$/.test(query.replace(/\s/g, ''))) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLiveSearchLoading(true);
      searchLiveAres(query, controller.signal)
        .then((results) => {
          if (active) {
            if (results === null) {
              setLiveNotFoundQuery(query);
            } else {
              setLiveCompanies(results);
              setLiveSearchQuery(query);
            }
          }
        })
        .finally(() => {
          if (active) setLiveSearchLoading(false);
        });
    }, 500);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [filteredCompanies.length, isIcoQuery, loading, mounted, searchQuery]);

  function clearSearch() {
    setSearchQuery('');
    setCurrentPage(1);
  }

  return (
    <main className="directory-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Koala, úvodní stránka"><span className="brand-mark">K</span> koala<span className="brand-dot">.</span></a>
        <span className="topbar-label">Firemní rejstřík</span>
      </header>

      <section className="directory-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Česká republika · ARES</p>
            <h1>Adresář společností</h1>
            <p className="page-description">Přehled firemních údajů a informací o vedení na jednom místě.</p>
          </div>
          <div className="dataset-pill"><span className="status-dot" />{isLoading ? 'Načítám data' : `${companies.length} společností`}</div>
        </div>

        <section className="table-card" aria-label="Seznam společností">
          <div className="table-toolbar">
            <div><h2>Společnosti</h2><p>Základní údaje z veřejného rejstříku</p></div>
            {!isLoading && <div className="toolbar-meta">
              {showingLiveResults && <span className="live-badge"><span className="live-dot" />Live data from ARES</span>}
              <span className="result-count">{displayCompanies.length} záznamů</span>
              {searchQuery && <button type="button" className="clear-search ml-auto cursor-pointer whitespace-nowrap rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900" onClick={clearSearch}>Clear search</button>}
            </div>}
          </div>
          {!isLoading && companies.length > 0 && (
            <div className="filter-bar flex flex-wrap items-center gap-3 border-b border-[#e5ebe7] bg-white px-[22px] py-3.5">
              <label className="search-field flex h-10 min-w-[260px] flex-[1_1_320px] items-center gap-2.5 rounded-lg border border-[#dfe7e2] bg-white px-3 text-[#819088] focus-within:border-[#8fbea2] focus-within:ring-2 focus-within:ring-[#187a55]/10">
                <svg className="search-icon h-4 w-4 shrink-0" aria-hidden="true" viewBox="0 0 20 20" fill="none">
                  <circle cx="8.75" cy="8.75" r="5.75" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="sr-only">Hledat podle názvu nebo IČO</span>
                <input
                  type="search"
                  className="h-full w-full min-w-0 border-0 bg-transparent p-0 text-[13px] text-[#1d2c27] outline-none placeholder:text-[#9aa69f]"
                  value={searchQuery}
                  onChange={(event) => updateSearch(event.target.value)}
                  placeholder="Hledat název nebo IČO…"
                />
              </label>
              <label className="filter-select relative h-10 min-w-[170px] flex-[0_1_200px] rounded-lg border border-[#dfe7e2] bg-white focus-within:border-[#8fbea2] focus-within:ring-2 focus-within:ring-[#187a55]/10">
                <span className="sr-only">Filtrovat podle lokality</span>
                <select className="h-full w-full appearance-none rounded-lg bg-transparent px-3 pr-9 text-[13px] text-[#43534a] outline-none" value={selectedLocation} onChange={(event) => updateLocation(event.target.value)}>
                  <option value="all">Všechny lokality</option>
                  {locations.map((location) => <option key={location} value={location}>{location}</option>)}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#819088]" aria-hidden="true">⌄</span>
              </label>
              <label className="filter-select relative h-10 min-w-[170px] flex-[0_1_200px] rounded-lg border border-[#dfe7e2] bg-white focus-within:border-[#8fbea2] focus-within:ring-2 focus-within:ring-[#187a55]/10">
                <span className="sr-only">Filtrovat podle obratu</span>
                <select className="h-full w-full appearance-none rounded-lg bg-transparent px-3 pr-9 text-[13px] text-[#43534a] outline-none" value={selectedTurnover} onChange={(event) => updateTurnover(event.target.value as (typeof TURNOVER_FILTERS)[number]['value'])}>
                  {TURNOVER_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#819088]" aria-hidden="true">⌄</span>
              </label>
            </div>
          )}
          {isLoading ? (
            <div className="table-state"><span className="loader" />Načítáme společnosti z ARES…</div>
          ) : companies.length === 0 ? (
            <div className="table-state">Data se nepodařilo načíst. Obnovte stránku a zkuste to znovu.</div>
          ) : shouldUseLiveSearch && liveSearchLoading ? (
            <div className="table-state"><span className="loader" />Searching ARES…</div>
          ) : displayCompanies.length === 0 ? (
            <div className="table-state">{liveEntityNotFound ? 'Entity not found in ARES.' : 'Pro zadané hledání a filtry jsme nic nenašli.'}</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Název</th><th>IČO</th><th>Adresa</th><th>Obrat</th><th><span className="sr-only">Detail</span></th></tr></thead>
                <tbody>{visibleCompanies.map((company) => (
                  <tr key={company.ico}>
                    <td className="company-name">{company.name}</td>
                    <td className="ico-cell">{company.ico}</td>
                    <td className="address-cell">{companyAddress(company)}</td>
                    <td className="turnover-cell">{company.turnoverCzk == null ? <span className="na-value">{company.source === 'ares-live' ? 'N/A in ARES' : 'Nedostupný'}</span> : currency.format(company.turnoverCzk)}</td>
                    <td className="action-cell"><button type="button" className="details-button" onClick={() => setSelectedCompany(company)}>Detail <span aria-hidden="true">→</span></button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div className="table-footnote">{showingLiveResults ? 'Live data from the ARES public registry. Turnover and direct contacts are not available.' : 'Obrat a kontakty vedení jsou u lokálního datasetu ukázkové údaje.'}</div>
        </section>
        {!isLoading && pageCount > 1 && (
          <nav className="pagination flex items-center justify-center gap-4 py-5" aria-label="Stránkování seznamu společností">
            <button
              type="button"
              className="page-control border border-solid rounded-lg bg-white px-3 h-9 text-[#53635a] disabled:bg-[#fafbfa] disabled:text-[#b4beb8]"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              ← <span>Předchozí</span>
            </button>
            <div className="page-numbers flex gap-1">
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`page-number border border-solid rounded-lg h-9 w-9 ${currentPage === page ? 'active bg-[#187a55] text-white border-[#187a55]' : 'bg-white text-[#53635a] border-[#e5ebe7]'}`}
                  aria-current={currentPage === page ? 'page' : undefined}
                  aria-label={`Stránka ${page}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="page-control border border-solid rounded-lg bg-white px-3 h-9 text-[#53635a] disabled:bg-[#fafbfa] disabled:text-[#b4beb8]"
              onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
              disabled={currentPage === pageCount}
            >
              <span>Další</span> →
            </button>
          </nav>
        )}
        <footer className="page-footer">Údaje o společnostech pocházejí z veřejného registru ARES.</footer>
      </section>
      {selectedCompany && <CompanyDetails company={selectedCompany} onClose={() => setSelectedCompany(null)} />}
    </main>
  );
}
