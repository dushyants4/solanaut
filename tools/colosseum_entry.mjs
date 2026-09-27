// colosseum_entry.mjs — read and fill the Colosseum project form in the human's own Chrome window.
//
// The human launches nothing and types no password here: Chrome runs with its own profile
// (~/.cache/solanaut/chrome) and a DevTools port, the human logs in by hand, and this tool
// connects to that window over CDP.
//
//   node tools/colosseum_entry.mjs inspect             URL, title, every form field, a screenshot
//   node tools/colosseum_entry.mjs goto <url>
//   node tools/colosseum_entry.mjs fill <spec.json>    type values into fields; never submits
//   node tools/colosseum_entry.mjs click <text> --confirmed
//                                                     click a button or link by its visible text.
//                                                     Anything that creates, submits, saves or
//                                                     publishes refuses without --confirmed, which
//                                                     is passed only after the human says yes.
//
// Screenshots and field dumps go to .sandbox/colosseum/ (gitignored).

import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const OUT = join(import.meta.dirname, "..", ".sandbox", "colosseum");
mkdirSync(OUT, { recursive: true });
const [cmd, arg, flag] = process.argv.slice(2);
const COMMITTING = /\b(submit|create|save|publish|register|confirm|finish|done|send)\b/i;

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9333", defaultViewport: null });
const pages = (await browser.pages()).filter((p) => /colosseum/.test(p.url()));
const page = pages.at(-1) ?? (await browser.pages()).at(-1);
if (!page) throw new Error("no Chrome tab to work in");

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
async function shot(label) {
  const file = join(OUT, `${stamp()}-${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function fields() {
  return page.evaluate(() => {
    const labelFor = (el) => {
      if (el.id) {
        const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (l) return l.innerText.trim();
      }
      const wrap = el.closest("label");
      if (wrap) return wrap.innerText.trim();
      const prev = el.closest("div")?.querySelector("label, p, span");
      return el.getAttribute("aria-label") || prev?.innerText?.trim()?.slice(0, 80) || "";
    };
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const out = [];
    for (const el of document.querySelectorAll("input, textarea, select, [contenteditable=true], button, [role=button], a[href]")) {
      if (!visible(el)) continue;
      out.push({
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") || "",
        name: el.getAttribute("name") || "",
        id: el.id || "",
        placeholder: el.getAttribute("placeholder") || "",
        label: labelFor(el).slice(0, 100),
        text: (el.innerText || el.value || "").trim().slice(0, 80),
        href: el.tagName === "A" ? el.getAttribute("href") : "",
      });
    }
    return out;
  });
}

if (cmd === "inspect") {
  const f = await fields();
  const file = await shot("inspect");
  writeFileSync(join(OUT, "fields.json"), JSON.stringify({ url: page.url(), title: await page.title(), fields: f }, null, 2));
  console.log(`url    ${page.url()}\ntitle  ${await page.title()}\nshot   ${file}\nfields ${f.length} (${join(OUT, "fields.json")})`);
  for (const x of f) {
    if (["input", "textarea", "select"].includes(x.tag) || x.tag === "div") {
      console.log(`  [${x.tag}${x.type ? ":" + x.type : ""}] name=${x.name} id=${x.id} label="${x.label}" placeholder="${x.placeholder}"`);
    }
  }
  const actions = f.filter((x) => x.tag === "button" || x.tag === "a").map((x) => x.text).filter(Boolean);
  console.log(`  buttons/links: ${[...new Set(actions)].slice(0, 60).join(" | ")}`);
} else if (cmd === "options") {
  // Open a combobox and list what it offers. Selects nothing.
  await (await page.waitForSelector(arg, { timeout: 10000 })).click();
  await new Promise((r) => setTimeout(r, 800));
  const opts = await page.evaluate(() => [...document.querySelectorAll("[role=option], [role=listbox] li, ul[role=listbox] > *")]
    .map((el) => (el.innerText || "").trim()).filter(Boolean));
  console.log(`${opts.length} option(s):\n  ${[...new Set(opts)].join("\n  ")}`);
  await page.keyboard.press("Escape");
} else if (cmd === "goto") {
  await page.goto(arg, { waitUntil: "networkidle2", timeout: 60000 });
  console.log(`now at ${page.url()}`);
} else if (cmd === "fill") {
  const spec = JSON.parse(readFileSync(arg, "utf8"));
  for (const s of spec) {
    const el = await page.waitForSelector(s.selector, { timeout: 10000 });
    if (s.kind === "select") {
      await page.select(s.selector, s.value);
    } else {
      await el.click({ clickCount: 3 });
      await page.keyboard.press("Backspace");
      await el.type(s.value, { delay: 5 });
    }
    console.log(`  filled ${s.selector}`);
  }
  console.log(`shot   ${await shot("filled")}  (nothing was submitted)`);
} else if (cmd === "click") {
  if (COMMITTING.test(arg) && flag !== "--confirmed") {
    console.error(`refused: "${arg}" looks like it creates or submits something. Pass --confirmed only after the human says yes.`);
    process.exit(3);
  }
  const target = await page.evaluateHandle((t) => [...document.querySelectorAll("button, [role=button], a")]
    .find((el) => (el.innerText || "").trim().toLowerCase() === t.toLowerCase()), arg);
  const el = target.asElement();
  if (!el) throw new Error(`no button or link with the text "${arg}"`);
  await el.click();
  await new Promise((r) => setTimeout(r, 2500));
  console.log(`clicked "${arg}"; now at ${page.url()}\nshot   ${await shot("clicked")}`);
} else {
  console.error("usage: inspect | goto <url> | fill <spec.json> | click <text> [--confirmed]");
  process.exit(2);
}
browser.disconnect();
