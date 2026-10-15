// Generic username/password login with safe failure handling. Never guesses past a failure (no retries with
// variations — repeated bad logins can lock a real portal account) and hands over to a human on CAPTCHA / MFA.
const CAPTCHA = /captcha|i'?m not a robot|recaptcha|hcaptcha/i;
const MFA = /verification code|one-time|otp|two-factor|2fa|authenticator|security code/i;

async function firstVisible(page, selectors) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if (await loc.count() && await loc.isVisible().catch(() => false)) return loc;
  }
  return null;
}

/** @returns {{ok:true}|{ok:false,reason:"bad_credentials"|"captcha"|"mfa"|"no_form",message:string}} */
async function login(page, portal) {
  await page.goto(portal.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  const pass = await firstVisible(page, ['input[type="password"]']);
  if (!pass) return { ok: false, reason: "no_form", message: "Couldn't find a login form on the portal page." };
  if (CAPTCHA.test(await page.content())) return { ok: false, reason: "captcha", message: "The login page shows a CAPTCHA." };
  const user = await firstVisible(page, ['input[autocomplete="username"]', 'input[name*="user" i]', 'input[name*="email" i]', 'input[name*="login" i]', 'input[id*="user" i]', 'input[id*="email" i]', 'input[type="email"]', 'input[type="text"]']);
  if (!user) return { ok: false, reason: "no_form", message: "Couldn't find the username field." };
  await user.fill(portal.username);
  await pass.fill(portal.password);
  const submit = await firstVisible(page, ['button[type="submit"]', 'input[type="submit"]', 'button:has-text("Log in")', 'button:has-text("Login")', 'button:has-text("Sign in")']);
  if (submit) await submit.click(); else await pass.press("Enter");
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  const body = await page.content();
  if (CAPTCHA.test(body)) return { ok: false, reason: "captcha", message: "A CAPTCHA appeared after login." };
  if (MFA.test(await page.innerText("body").catch(() => ""))) return { ok: false, reason: "mfa", message: "The portal asked for a verification code." };
  if (await firstVisible(page, ['input[type="password"]'])) return { ok: false, reason: "bad_credentials", message: "The portal rejected the saved username/password." };
  return { ok: true };
}

module.exports = { login };
