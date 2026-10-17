import { COUNTRIES } from "../../data/countries";
import { getCountryByName } from "../../data/countryRegistry";

/** A country's round identity badge: the logo/flag image Data Management uploaded for it, falling back
 * to the flag emoji, then nothing. Used on every destination card so they all show the same artwork. */
export function CountryBadge({ name, className = "" }: { name: string; className?: string }) {
  const logo = getCountryByName(name)?.logoUrl;
  const flag = COUNTRIES.find((c) => c.name === name)?.flag;
  if (!logo && !flag) return null;
  return (
    <span className={`flex items-center justify-center overflow-hidden rounded-full bg-white shadow ${className}`}>
      {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <span className="leading-none">{flag}</span>}
    </span>
  );
}
