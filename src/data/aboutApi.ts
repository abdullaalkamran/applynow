// The editable About page: public read for visitors, read/write/reset for Data Management.
import { apiGet, apiPut, apiDelete } from "../utils/apiClient";
import { publicGet } from "./blogApi";
import defaults from "./aboutDefault.json";

export interface AboutContent {
  metaTitle: string;
  metaDescription: string;
  heading: string;
  subheading: string;
  /** Markdown: ## / ### headings, **bold**, *italic*, - lists, 1. lists, [links](https://… or /path), --- rules. */
  body: string;
  faqs: { q: string; a: string }[];
  company: { legalName: string; foundedYear: string; founders: string; address: string; email: string; phone: string };
  social: { instagram: string; facebook: string; linkedin: string; youtube: string };
}
export interface AboutEditable extends AboutContent { isDefault: boolean; updatedAt: string | null }

/** The built-in text — what shows if the server can't be reached, and what "reset" goes back to. */
export const DEFAULT_ABOUT: AboutContent = defaults as AboutContent;

export const fetchPublicAbout = (signal?: AbortSignal) => publicGet<AboutContent>("/api/public/about", signal);
export const getAbout = () => apiGet<AboutEditable>("/api/about");
export const saveAbout = (content: AboutContent) => apiPut<AboutEditable>("/api/about", content);
export const resetAbout = () => apiDelete<AboutEditable>("/api/about");

/** The company details that were actually filled in, labelled — nothing is shown for an empty field. */
export function companyRows(c: AboutContent["company"]): [string, string][] {
  return ([["Registered company", c.legalName], ["Founded", c.foundedYear], ["Founders", c.founders], ["Office", c.address], ["Email", c.email], ["Phone / WhatsApp", c.phone]] as [string, string][]).filter(([, v]) => v);
}
