// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { STUDENT_EXPLORE } from "./UniversitySearch";
import { AGENT_EXPLORE } from "../agent/Universities";
import { COUNSELLOR_EXPLORE } from "../staff/counsellor/UniversityPartners";

describe("university links on the signed-in pages use the readable name", () => {
  const cases: [string, { universityPath: (id: string, slug?: string) => string }, string][] = [
    ["student", STUDENT_EXPLORE, "/student/universities"],
    ["agent", AGENT_EXPLORE, "/agent/universities"],
    ["counsellor", COUNSELLOR_EXPLORE, "/staff/counsellor/partners/universities"],
  ];
  for (const [role, variant, base] of cases) {
    it(`${role}: ${base}/<name>, falling back to the id when there is no name`, () => {
      expect(variant.universityPath("u-custom-mujsdlht", "bpp-university")).toBe(`${base}/bpp-university`);
      expect(variant.universityPath("u-custom-mujsdlht")).toBe(`${base}/u-custom-mujsdlht`);
    });
  }
});
