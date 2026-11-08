// Public country pages: the list of countries and one country's guide + summary (GET /api/public/countries[/:slug]).
import { publicGet } from "./blogApi";
import type { CountryRecord } from "./countryRegistry";

export interface PublicCountryCard { id: string; slug: string; name: string; tagline?: string; photoUrl?: string; universityCount: number; courseCount: number }
export interface PublicCountryDetail {
  slug: string;
  country: CountryRecord;
  universityCount: number;
  courseCount: number;
  /** The exact `country` values to give the search so it matches this country's universities. */
  destinations: string[];
  subjectCounts: { subject: string; count: number }[];
  topUniversities: { id: string; slug?: string; name: string; worldRank: string }[];
  universities: { id: string; slug?: string; name: string; city: string; worldRank: string; courseCount: number }[];
}

export const fetchPublicCountries = (signal?: AbortSignal) => publicGet<PublicCountryCard[]>("/api/public/countries", signal);
export const fetchPublicCountry = (slug: string, signal?: AbortSignal) => publicGet<PublicCountryDetail>(`/api/public/countries/${encodeURIComponent(slug)}`, signal);
