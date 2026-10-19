// Average student rent per month, by the UK region a university city sits in.
// Source: Save the Student, National Student Accommodation Survey 2025 (2024/25 rents), regional averages —
// https://www.savethestudent.org/money/surveys/national-student-accommodation-survey-2025.html
// These are regional averages, not quotes for a particular hall: real rent depends on the room type and the provider, so the UI
// always labels the figure as an estimate. Update the numbers here when a newer survey is published.
export const UK_RENT_AVERAGE = 563; // UK-wide average, £ per month

export const UK_RENT_BY_REGION: Record<string, number> = {
  London: 812,
  Scotland: 663,
  "South East": 644,
  East: 580,
  "South West": 565,
  "East Midlands": 538,
  Yorkshire: 510,
  "North East": 508,
  "North West": 486,
  Wales: 473,
  "West Midlands": 466,
};

// City → region. Anything not listed falls back to the UK-wide average.
const REGION_CITIES: Record<string, string[]> = {
  London: ["london"],
  Scotland: ["edinburgh", "glasgow", "aberdeen", "dundee", "stirling", "inverness", "st andrews", "paisley"],
  "South East": ["oxford", "reading", "brighton", "southampton", "canterbury", "guildford", "portsmouth", "kent", "surrey", "milton keynes", "winchester", "egham", "falmer", "chatham", "medway"],
  East: ["cambridge", "norwich", "colchester", "chelmsford", "essex", "hatfield", "luton", "bedford", "ipswich", "peterborough", "chelmsford"],
  "South West": ["bristol", "bath", "exeter", "plymouth", "bournemouth", "gloucester", "cheltenham", "falmouth", "poole"],
  "East Midlands": ["nottingham", "leicester", "derby", "loughborough", "lincoln", "northampton"],
  Yorkshire: ["leeds", "sheffield", "york", "hull", "bradford", "huddersfield", "wakefield", "halifax"],
  "North East": ["newcastle", "durham", "sunderland", "middlesbrough", "gateshead", "teesside"],
  "North West": ["manchester", "liverpool", "lancaster", "preston", "salford", "chester", "bolton", "keele", "stockport", "wigan", "blackburn"],
  Wales: ["cardiff", "swansea", "newport", "bangor", "aberystwyth", "wrexham"],
  "West Midlands": ["birmingham", "coventry", "warwick", "wolverhampton", "stoke", "worcester", "walsall", "telford", "dudley"],
};

export interface UkRent { monthly: number; region: string | null }

/** Average monthly student rent for a university city (matches the city text loosely, e.g. "Central London" or "Leeds, UK"). */
export function ukRentFor(city?: string): UkRent {
  const text = (city ?? "").toLowerCase();
  for (const [region, cities] of Object.entries(REGION_CITIES)) {
    if (cities.some((c) => text.includes(c))) return { monthly: UK_RENT_BY_REGION[region], region };
  }
  return { monthly: UK_RENT_AVERAGE, region: null };
}
