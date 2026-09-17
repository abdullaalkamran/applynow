// A picklist of Bangladeshi UGC (University Grants Commission)-approved universities — used when
// Data Management marks a destination university as accepting Medium of Instruction (MOI)
// letters from specific home universities in place of a formal English test. Kept as a controlled
// list rather than free text since exact, consistent names matter for later matching a student's
// own university against what a destination accepts. Seeded from public UGC-listed public and
// private universities; not guaranteed exhaustive or perfectly current (the UGC's own list
// changes as new universities are approved) — same extensible pattern as subjectsStore.ts, so
// Data Management can add a missing one directly from the university form.
const SEED_UGC_UNIVERSITIES_BD = [
  // Public
  "University of Dhaka",
  "University of Rajshahi",
  "University of Chittagong",
  "Jahangirnagar University",
  "Islamic University, Bangladesh",
  "Khulna University",
  "Jagannath University",
  "Comilla University",
  "Jatiya Kabi Kazi Nazrul Islam University",
  "Bangladesh University of Professionals",
  "Begum Rokeya University, Rangpur",
  "University of Barishal",
  "Rabindra University, Bangladesh",
  "Netrokona University",
  "Kishoreganj University",
  "Naogaon University",
  "Meherpur University",
  "Thakurgaon University",
  "Shahjalal University of Science and Technology",
  "Hajee Mohammad Danesh Science and Technology University",
  "Mawlana Bhashani Science and Technology University",
  "Patuakhali Science and Technology University",
  "Noakhali Science and Technology University",
  "Jashore University of Science and Technology",
  "Pabna University of Science and Technology",
  "Gopalganj Science and Technology University",
  "Rangamati Science and Technology University",
  "Jamalpur Science and Technology University",
  "Chandpur Science and Technology University",
  "Sunamganj Science and Technology University",
  "Lakshmipur Science and Technology University",
  "Pirojpur Science and Technology University",
  "Narayanganj Science and Technology University",
  "Satkhira University of Science and Technology",
  "Bangladesh University of Engineering and Technology",
  "Chittagong University of Engineering and Technology",
  "Khulna University of Engineering and Technology",
  "Rajshahi University of Engineering and Technology",
  "Dhaka University of Engineering and Technology",
  "Bangladesh Agricultural University",
  "Sher-e-Bangla Agricultural University",
  "Sylhet Agricultural University",
  "Chittagong Veterinary and Animal Sciences University",
  "Bangladesh University of Textiles",
  "Bangabandhu Sheikh Mujibur Rahman Maritime University",
  "National University, Bangladesh",
  "Bangladesh Open University",
  "Islamic Arabic University",
  // Private
  "Ahsanullah University of Science and Technology",
  "American International University-Bangladesh",
  "Atish Dipankar University of Science & Technology",
  "ASA University Bangladesh",
  "Asian University of Bangladesh",
  "Anwer Khan Modern University",
  "BRAC University",
  "Bangladesh University of Business and Technology",
  "BGMEA University of Fashion & Technology",
  "Bandarban University",
  "BGC Trust University Bangladesh",
  "Britannia University",
  "Bangladesh Islami University",
  "Bangladesh University of Health Sciences",
  "Central Women's University",
  "City University",
  "Canadian University of Bangladesh",
  "Cox's Bazar International University",
  "CCN University of Science & Technology",
  "Chittagong Independent University",
  "Central University of Science and Technology",
  "Daffodil International University",
  "Dhaka International University",
  "East West University",
  "Eastern University",
  "East Delta University",
  "European University of Bangladesh",
  "Exim Bank Agricultural University",
  "Feni University",
  "Fareast International University",
  "First Capital University of Bangladesh",
  "Green University of Bangladesh",
  "Gono Bishwabidyalay",
  "German University Bangladesh",
  "Global University Bangladesh",
  "Hamdard University Bangladesh",
  "Independent University, Bangladesh",
  "International University of Business Agriculture and Technology",
  "International Islamic University Chittagong",
  "International Standard University",
  "Ishakha International University",
  "IBAIS University",
  "Khwaja Yunus Ali University",
  "Leading University, Sylhet",
  "Manarat International University",
  "Metropolitan University",
  "The Millennium University",
  "North South University",
  "Northern University Bangladesh",
  "North East University Bangladesh",
  "Notre Dame University Bangladesh",
  "North Western University",
  "Presidency University",
  "Prime University",
  "Primeasia University",
  "Premier University",
  "Pundra University of Science & Technology",
  "Port City International University",
  "Queens University",
  "Royal University of Dhaka",
  "Rabindra Maitree University",
  "Ranada Prasad Shaha University",
  "R.T.M Al-Kabir Technical University",
  "Stamford University Bangladesh",
  "Southeast University",
  "State University of Bangladesh",
  "Shanto-Mariam University of Creative Technology",
  "Sylhet International University",
  "Southern University Bangladesh",
  "Sonargaon University",
  "The University of Asia Pacific",
  "Trust University",
  "Times University Bangladesh",
  "United International University",
  "University of Liberal Arts Bangladesh",
  "Uttara University",
  "University of Science & Technology Chittagong",
  "University of Development Alternative",
  "University of Information Technology & Sciences",
  "University of South Asia",
  "University of Creative Technology, Chittagong",
  "University of Global Village",
  "Victoria University of Bangladesh",
  "Varendra University",
  "World University of Bangladesh",
  "Z.H. Sikder University of Science & Technology",
].sort((a, b) => a.localeCompare(b));

const STORAGE_KEY = "data-mgmt-custom-ugc-universities-bd";

function loadCustom(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveCustom(list: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getAllUgcUniversitiesBD(): string[] {
  return [...SEED_UGC_UNIVERSITIES_BD, ...loadCustom()];
}

/** Adds a university missing from the seed list — returns false without changing anything if
 * it's blank or already there (case-insensitively). */
export function addUgcUniversityBD(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (getAllUgcUniversitiesBD().some((u) => u.toLowerCase() === trimmed.toLowerCase())) return false;
  saveCustom([...loadCustom(), trimmed]);
  return true;
}
