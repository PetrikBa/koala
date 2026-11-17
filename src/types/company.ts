export interface AresSidlo {
  nazevUlice?: string;
  cisloDomovni?: number | string;
  cisloOrientacni?: number | string;
  nazevObce?: string;
  nazevKraje?: string; // Dôležité pre filter podľa lokality/kraja
  psc?: number | string;
  nazevStatu?: string;
}

export interface AresEkonomickySubjekt {
  ico?: string;
  obchodniJmeno?: string;
  sidlo?: AresSidlo;
  datumVzniku?: string;
  pravniForma?: string;
}

// 2. Model pre člena manažmentu / konateľa
export interface ManagementContact {
  name: string;
  role: string; // napr. "Jednatel", "Společník"
  email?: string;
  phone?: string;
}

// 3. Hlavný aplikačný model firmy (pre zoznam, filtre a detail)
export interface Company {
  ico: string;
  name: string;
  address: {
    street: string;
    city: string;
    region: string; // Kraj / Lokalita pre filter
    zip: string;
    country: string;
  };
  turnoverCzk?: number | null; // Obrat v Kč (pre lokálne firmy vyplnené, pre live ARES null)
  management: ManagementContact[];
  source: 'local' | 'ares-live'; // Odlíšenie, či ide o predpripravený dataset alebo živý ARES
}