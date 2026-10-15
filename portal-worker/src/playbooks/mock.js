// Playbook for the local mock portal (mock-portal/server.js) — exists so the whole submit/monitor loop can be
// exercised end-to-end without touching a real admissions system. Real portals get their own file next to this one.
const { downloadDocument } = require("../api");

const BASE = (portal) => new URL(portal.url).origin;

module.exports = {
  match: (portal) => /^(localhost|127\.0\.0\.1):4100$/.test(new URL(portal.url).host),

  async fillApplication(page, { portal, student, application, documents }) {
    const p = student.profile || {};
    const personal = p.personal || {};
    await page.goto(`${BASE(portal)}/apply`, { waitUntil: "domcontentloaded" });
    await page.fill('[name="firstName"]', personal.firstName || student.name.split(" ")[0]);
    await page.fill('[name="lastName"]', personal.lastName || student.name.split(" ").slice(1).join(" "));
    await page.fill('[name="email"]', student.email);
    await page.fill('[name="dob"]', personal.dob || "");
    await page.fill('[name="nationality"]', personal.nationality || student.country);
    await page.fill('[name="passportNumber"]', personal.passportNumber || "");
    await page.fill('[name="course"]', `${application.university} — ${application.course}`);
    const passport = documents.find((d) => /passport/i.test(d.type) || /passport/i.test(d.name));
    if (passport) {
      const buffer = await downloadDocument(passport.fileUrl);
      await page.setInputFiles('[name="passportFile"]', { name: `${passport.name}.pdf`, mimeType: "application/pdf", buffer });
    }
    await page.click('button[value="draft"]');
    await page.waitForSelector("[data-draft-ref]");
    return { draftRef: await page.getAttribute("[data-draft-ref]", "data-draft-ref") };
  },

  async finalSubmit(page, { portal, submission }) {
    const ref = submission.snapshot?.draftRef;
    if (!ref) throw new Error("No draft reference stored for this submission.");
    await page.goto(`${BASE(portal)}/draft/${encodeURIComponent(ref)}`, { waitUntil: "domcontentloaded" });
    await page.click('button[value="submit"]');
    await page.waitForSelector("[data-application-ref]");
    return { externalRef: await page.getAttribute("[data-application-ref]", "data-application-ref") };
  },

  async readStatus(page, { portal, submission }) {
    const ref = submission.externalRef;
    await page.goto(`${BASE(portal)}/status/${encodeURIComponent(ref)}`, { waitUntil: "domcontentloaded" });
    const portalStatus = (await page.textContent("[data-status]"))?.trim();
    const comments = await page.$$eval("[data-comment]", (els) => els.map((e) => ({ id: e.getAttribute("data-comment"), text: e.textContent.trim() })));
    const requiredDocuments = await page.$$eval("[data-required-doc]", (els) => els.map((e) => e.textContent.trim()));
    return { portalStatus, comments, requiredDocuments };
  },
};
