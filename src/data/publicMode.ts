// "Public mode": the student pages (Explore, Advanced Search, university and course detail) are also served to logged-out visitors
// at /universities and /courses. Same components, same information — only the data source differs: public mode reads the public
// endpoints (/api/public/…) and sends every signed-in action (apply, shortlist, cost planner…) to the sign-in page.
import { createContext, useContext } from "react";
import { publicGet } from "./blogApi";
import { seedCountries, type CountryRecord } from "./countryRegistry";
import { seedSubjectCatalog, type SubjectRecord } from "./subjectCatalogStore";

export const PublicModeContext = createContext(false);
export const usePublicMode = () => useContext(PublicModeContext);

let referenceLoad: Promise<void> | null = null;

/** The country guides and subject list the university pages draw on (signed-in users get these at login). Loaded once. */
export function loadPublicReference(): Promise<void> {
  if (!referenceLoad) {
    referenceLoad = publicGet<{ countries: CountryRecord[]; subjects: SubjectRecord[] }>("/api/public/reference")
      .then((ref) => { seedCountries(ref.countries); seedSubjectCatalog(ref.subjects); })
      .catch(() => { referenceLoad = null; /* the pages still work without guides; the next visit tries again */ });
  }
  return referenceLoad;
}
