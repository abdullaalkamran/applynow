// Runs one claimed job to completion and reports the outcome. Policy lives here: never click the final submit on a
// `submit` job (stop and wait for the counsellor), stop on CAPTCHA/MFA/unknown portals, and never act on a portal
// that has no playbook.
const { chromium } = require("playwright");
const { login } = require("./login");
const playbooks = require("./playbooks");

const log = (lines, msg) => { lines.push(msg); console.log(`[job] ${msg}`); };

async function run(payload, report) {
  const lines = [];
  const playbook = playbooks.find(payload.portal);
  if (!playbook) return report({ status: "needs_human", error: `No automation playbook exists for ${new URL(payload.portal.url).host} yet.`, log: lines });

  const browser = await chromium.launch({ headless: process.env.HEADLESS !== "false" });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);

    log(lines, `logging in to ${payload.portal.name}`);
    const auth = await login(page, payload.portal);
    if (!auth.ok) {
      log(lines, `login stopped: ${auth.reason}`);
      return report({
        status: auth.reason === "bad_credentials" || auth.reason === "no_form" ? "failed" : "needs_human",
        loginFailed: auth.reason === "bad_credentials", error: auth.message, log: lines,
      });
    }
    log(lines, "logged in");

    if (payload.job.kind === "submit") {
      const { draftRef } = await playbook.fillApplication(page, payload);
      log(lines, "application filled — stopping before final submit");
      const screenshotBase64 = (await page.screenshot({ fullPage: true })).toString("base64");
      return report({ status: "awaiting_confirm", loginOk: true, draftRef, screenshotBase64, log: lines });
    }
    if (payload.job.kind === "confirm_submit") {
      const { externalRef } = await playbook.finalSubmit(page, payload);
      log(lines, `submitted, ref ${externalRef}`);
      return report({ status: "done", loginOk: true, externalRef, log: lines });
    }
    if (payload.job.kind === "check") {
      const status = await playbook.readStatus(page, payload);
      log(lines, `status "${status.portalStatus}", ${status.comments.length} comments, ${status.requiredDocuments.length} required docs`);
      return report({ status: "done", loginOk: true, ...status, log: lines });
    }
    return report({ status: "failed", error: `Unknown job kind ${payload.job.kind}`, log: lines });
  } catch (err) {
    log(lines, `error: ${err.message}`);
    // An unexpected page/selector mismatch on a live portal is a human's call, not something to retry blindly.
    return report({ status: "needs_human", error: `The portal didn't behave as expected: ${err.message}`.slice(0, 900), log: lines });
  } finally {
    await browser.close().catch(() => undefined);
  }
}

module.exports = { run };
