import { getSubjectRecord } from "./subjectCatalogStore";

// Representative module and career-outcome lists per field of study, used to fill out a course's
// "Modules" and "Careers" tabs. Illustrative, not any specific university's real syllabus — the
// fallback for any subject Data Management hasn't authored real modules for yet (see
// subjectCatalogStore.ts and curriculumFor below).
export const SUBJECT_CURRICULUM: Record<string, { modules: string[]; careers: string[] }> = {
  "Computer Science & IT": {
    modules: ["Algorithms & Data Structures", "Software Engineering", "Databases & Web Systems", "Operating Systems", "Artificial Intelligence Fundamentals", "Capstone Project"],
    careers: ["Software Engineer", "Systems Architect", "DevOps Engineer", "Product Manager", "IT Consultant"],
  },
  "Data Science & AI": {
    modules: ["Statistical Foundations", "Machine Learning", "Deep Learning", "Big Data Systems", "Data Visualisation", "Applied AI Project"],
    careers: ["Data Scientist", "Machine Learning Engineer", "Data Analyst", "AI Research Engineer", "Business Intelligence Analyst"],
  },
  "Business & Management": {
    modules: ["Strategic Management", "Financial Accounting", "Marketing Principles", "Operations Management", "Organisational Behaviour", "Business Consulting Project"],
    careers: ["Management Consultant", "Business Analyst", "Marketing Manager", "Operations Manager", "Entrepreneur"],
  },
  "Engineering": {
    modules: ["Engineering Mathematics", "Mechanics & Materials", "Thermodynamics", "Control Systems", "Design & Manufacturing", "Engineering Project"],
    careers: ["Design Engineer", "Project Engineer", "Manufacturing Engineer", "R&D Engineer", "Technical Consultant"],
  },
  "Law": {
    modules: ["Contract Law", "Constitutional Law", "International Law", "Commercial Law", "Legal Research & Writing", "Moot Court"],
    careers: ["Solicitor", "Legal Consultant", "Corporate Counsel", "Policy Advisor", "Compliance Officer"],
  },
  "Medicine & Health Sciences": {
    modules: ["Human Anatomy & Physiology", "Biochemistry", "Public Health", "Clinical Skills", "Pharmacology", "Research Methods"],
    careers: ["Clinical Researcher", "Public Health Analyst", "Healthcare Administrator", "Biomedical Scientist", "Health Policy Advisor"],
  },
  "Arts & Humanities": {
    modules: ["Critical Theory", "Literary Analysis", "Cultural History", "Creative Writing", "Media & Communication", "Independent Research Project"],
    careers: ["Writer / Editor", "Museum & Heritage Curator", "Media Producer", "Communications Specialist", "Academic Researcher"],
  },
  "Social Sciences": {
    modules: ["Research Methods", "Political Theory", "Economic Principles", "Social Policy", "Comparative Politics", "Dissertation"],
    careers: ["Policy Analyst", "Market Researcher", "Social Researcher", "NGO Programme Officer", "Public Affairs Consultant"],
  },
  "Architecture": {
    modules: ["Architectural Design Studio", "Building Technology", "History of Architecture", "Urban Planning", "Structures & Materials", "Design Thesis"],
    careers: ["Architect", "Urban Designer", "Architectural Technologist", "Interior Designer", "Construction Project Manager"],
  },
};

const DEFAULT_CURRICULUM = { modules: ["Core Modules", "Electives", "Research Methods", "Capstone Project"], careers: ["Graduate Roles in this Field"] };

/** Modules and career outcomes for a subject: Data Management's authored lists (see
 * subjectCatalogStore.ts) take priority per list once entered; the static tables above are the
 * fallback for whatever hasn't been authored yet. */
export function curriculumFor(subject: string): { modules: string[]; careers: string[] } {
  const authored = getSubjectRecord(subject);
  const generic = SUBJECT_CURRICULUM[subject] ?? DEFAULT_CURRICULUM;
  return {
    modules: authored?.modules.length ? authored.modules : generic.modules,
    careers: authored?.careers?.length ? authored.careers : generic.careers,
  };
}

/** What a specific course's Modules and Careers tabs show: the course's own lists when Data
 * Management entered them on the course itself, otherwise the subject-level curriculum above. */
export function curriculumForCourse(course: { subject: string; modules?: string[]; careers?: string[] }) {
  const subjectLevel = curriculumFor(course.subject);
  return {
    modules: course.modules?.length ? course.modules : subjectLevel.modules,
    careers: course.careers?.length ? course.careers : subjectLevel.careers,
  };
}
