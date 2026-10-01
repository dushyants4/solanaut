// A screenshot of a running cockpit, the evidence for milestone 2a.10. It drives the system's Chrome
// headless through puppeteer-core, loads the page, waits for both panels to draw, and saves a PNG.
//
//   node apps/cockpit/src/screenshot.ts --url http://127.0.0.1:8787 --out runs/<date>-cockpit-v0.png

import puppeteer from "puppeteer-core";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  const v = i > 0 ? process.argv[i + 1] : fallback;
  if (!v) throw new Error(`--${name} is required`);
  return v;
};
const url = arg("url", "http://127.0.0.1:8787");
const out = arg("out");

const browser = await puppeteer.launch({ executablePath: arg("chrome", "/usr/bin/google-chrome-stable"), headless: true, args: ["--no-first-run", "--no-default-browser-check"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelectorAll("#decisions tr").length > 0, { timeout: 15_000 });
  await page.waitForFunction(() => !document.querySelector("#chain p.muted")?.textContent?.startsWith("no chain configured"), { timeout: 15_000 });
  await page.screenshot({ path: out as `${string}.png`, fullPage: true });
  console.log(`saved ${out}`);
} finally {
  await browser.close();
}
