// The portfolio photographer: books a flight the way a traveller would and
// photographs each step at phone size (390 × 844). Run by
// .github/workflows/screenshots.yml after every change to main; the pictures
// are published on the "screenshots" branch at fixed addresses, so a portfolio
// that links to them always shows the current app.
//
//   node scripts/screenshots.mjs <out-dir>     (the app must be served at BASE_URL)
// The traveller (Selam Bekele) is fictional; the payment is the app's demo checkout.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] || "screenshots";
const BASE = (process.env.BASE_URL || "http://localhost:4100").replace(/\/$/, "");
const DIR = `${OUT}/phone`;
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
// A demo account on this browser, so the app opens on its log-in screen.
await ctx.addInitScript(() => {
  try {
    if (!localStorage.getItem("hidgo_account")) {
      localStorage.setItem("hidgo_account", JSON.stringify({ name: "Selam Bekele", email: "selam@example.com", phone: "", password: "Demo@2026" }));
    }
  } catch { /* the app then starts at sign-up and the run fails loudly below */ }
});
const page = await ctx.newPage();
const shots = [];
const settle = () => page.waitForTimeout(1200); // the app's own screen transition
const shot = async (name, label) => {
  await settle();
  await page.screenshot({ path: `${DIR}/${name}.jpg`, type: "jpeg", quality: 76 });
  shots.push({ file: `phone/${name}.jpg`, label });
};

await page.goto(`${BASE}/index.html`);
await page.waitForSelector("#liPassword", { state: "visible" });
await page.fill("#liPassword", "Demo@2026");
await page.locator("#loginForm button[type=submit]").click();
await page.waitForSelector("#screen-home .search-submit", { state: "visible" });
await page.waitForLoadState("networkidle").catch(() => {});
await shot("home", "Search");

await page.locator("#screen-home .search-submit").click();
await page.waitForSelector("#screen-results .select-flight", { state: "visible" });
await shot("results", "Results");

await page.locator("#screen-results .select-flight").first().click();
await page.waitForSelector("#screen-fare .pax-name", { state: "attached" });
await page.locator("#screen-fare").getByText("Standard", { exact: true }).click();
await shot("fare", "Choose a fare");

await page.fill("#screen-fare .pax-name", "Selam Bekele");
await page.fill("#screen-fare .pax-email", "selam@example.com");
await page.locator("#screen-fare .seat-btn:not(.taken)").nth(8).click();
await page.locator("#screen-fare .seat-btn.selected").first().evaluate((el) => el.scrollIntoView({ block: "center" }));
await shot("seat", "Pick a seat");

await page.locator("#screen-fare button", { hasText: "Continue to payment" }).click();
await page.waitForSelector("#payBtn", { state: "visible" });
await page.locator("#screen-payment .pay-type-tile", { hasText: "Phone" }).click();
await page.fill("#payPhoneName", "Selam Bekele");
await page.fill("#payPhoneNumber", "0911 234 567");
await shot("payment", "Pay by phone");

await page.click("#payBtn");
await page.waitForSelector("#doneBtn", { state: "visible" });
await shot("confirm", "You're booked");

await page.click("#doneBtn");
await page.waitForSelector("#screen-trips", { state: "visible" });
await page.locator(".tab-btn[data-tab=checkin]").click();
await page.locator("#screen-checkin button.btn-primary").first().click();
await page.waitForSelector("#screen-boarding", { state: "visible" });
await shot("boarding", "Boarding pass");

await browser.close();
writeFileSync(`${OUT}/manifest.json`, JSON.stringify({
  app: "Guxo Flights", device: "phone", size: "390x844",
  taken_at: new Date().toISOString(), commit: process.env.GITHUB_SHA || null, shots,
}, null, 2));
console.log(`Saved ${shots.length} screenshots to ${OUT}/`);
