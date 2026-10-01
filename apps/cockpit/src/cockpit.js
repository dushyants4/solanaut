// The cockpit's page script. It polls the cockpit's own read-only endpoints and draws what they
// return. Everything is set with textContent, never innerHTML: a record's reasons and addresses
// are data, not markup.

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "style") Object.assign(node.style, v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c instanceof Node ? c : document.createTextNode(String(c ?? "")));
  return node;
}

const short = (s, n = 6) => (s && s.length > 2 * n + 1 ? `${s.slice(0, n)}…${s.slice(-n)}` : s ?? "");

/** Lamports as SOL, exactly: a decimal string divided by 10^9 with BigInt arithmetic. */
function sol(lamports) {
  if (lamports === null || lamports === undefined) return "";
  const n = BigInt(lamports);
  const whole = n / 1_000_000_000n;
  const frac = (n % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

function gauge(label, used, cap, unit = "SOL", fmt = sol) {
  const u = BigInt(used), c = BigInt(cap);
  const pct = c === 0n ? (u > 0n ? 100 : 0) : Number((u * 10_000n) / c) / 100;
  const level = pct >= 90 ? "high" : pct >= 60 ? "mid" : "low";
  return el("div", { class: "gauge" },
    el("div", { class: "gauge-head" }, el("span", {}, label), el("span", { class: "gauge-num" }, `${fmt(used)} of ${fmt(cap)} ${unit} · ${pct.toFixed(1)}%`)),
    el("div", { class: "bar" }, el("div", { class: `fill ${level}`, style: { width: `${Math.min(100, pct)}%` } })));
}

function renderState(s) {
  const updated = new Date().toLocaleTimeString();
  $("identity").replaceChildren(
    el("span", {}, `guard ${s.guardId}`), " · ", el("span", {}, s.cluster), " · ",
    el("span", { title: s.policyHash }, `policy ${short(s.policyHash, 4)}`), " · ",
    el("span", { class: s.keel?.verified === "bytes" ? "ok" : "warn" }, s.keel ? `Keel ${s.keel.version}, verified by ${s.keel.verified}` : "no decisions yet"), " · ",
    el("span", {}, `${s.entries} entries`), " · ", el("span", { class: "muted" }, `updated ${updated}`));

  const latch = $("latch");
  latch.hidden = !s.latched;
  if (s.latched) latch.textContent = `LATCHED at decision ${s.latched.seq}: every proposal is denied until the operator signs a release.`;

  $("window").textContent = `the last ${(s.window.windowMs / 1000).toLocaleString()} s`;
  $("spend").replaceChildren(
    gauge("SOL", s.window.sol.used, s.window.sol.cap),
    gauge("fees and tips", s.window.fees.used, s.window.fees.cap),
    ...s.window.tokens.map((t) => gauge(`token ${short(t.mint, 4)}`, t.used, t.cap, "units", (x) => BigInt(x).toLocaleString())),
    el("p", { class: "muted" }, `${s.consecutiveDenials} denials in a row`));

  const denies = Object.entries(s.counts.deny).sort((a, b) => b[1] - a[1]);
  const released = s.releases.length ? ` · ${s.releases.length} released by the operator: ${s.releases.map((r) => `the latch at ${r.latchSeq}`).join(", ")}` : "";
  $("counts").textContent = `${s.counts.allow} allowed · ${denies.reduce((t, [, n]) => t + n, 0)} denied${denies.length ? ": " + denies.map(([r, n]) => `${r} ${n}`).join(", ") : ""}${released}`;

  $("decisions").replaceChildren(...s.decisions.map((d) => el("tr", { class: d.allow ? "allow" : "deny" },
    el("td", {}, d.seq),
    el("td", {}, new Date(d.at).toISOString().slice(11, 19)),
    el("td", {}, el("span", { class: `pill ${d.allow ? "allow" : "deny"}` }, d.allow ? "ALLOW" : "DENY")),
    el("td", {}, d.rule ?? "", d.latch ? el("span", { class: "pill deny latch-mark" }, "latched the guard") : ""),
    el("td", {}, d.posture ?? "–"),
    el("td", { class: "num" }, d.telemetry ? `${d.telemetry.intensity.toFixed(2)} · ${d.telemetry.valence.toFixed(2)} · ${d.telemetry.repetition.toFixed(2)}` : "–"),
    el("td", { class: "num" }, sol(d.sol)),
    el("td", { class: "reason", title: d.reason }, d.reason))));

  $("inflight").textContent = `${s.inFlight} in flight`;
  const intents = [...s.intents].sort((a, b) => b.firstAt - a.firstAt).slice(0, 12);
  $("intents").replaceChildren(...intents.map((i) => el("tr", {},
    el("td", { title: i.key }, short(i.key, 6)),
    el("td", {}, new Date(i.firstAt).toISOString().slice(11, 19)),
    el("td", {}, ...i.attempts.map((a) => el("span", { class: `pill ${a.status}`, title: a.decision }, a.status))))));
}

function renderChain(c) {
  if (!c.configured) return $("chain").replaceChildren(el("p", { class: "muted" }, "no chain configured: start the cockpit with --rpc and --squads"));
  const parts = [];
  if (c.limit) {
    const spent = (BigInt(c.limit.amount) - BigInt(c.limit.remaining)).toString();
    parts.push(gauge(`spent this ${c.limit.period.toLowerCase()}`, spent, c.limit.amount),
      el("p", {}, `remaining ${sol(c.limit.remaining)} SOL · last reset ${new Date(Number(c.limit.lastReset) * 1000).toISOString().slice(0, 19)}Z`),
      el("p", { class: "muted" }, `the agent's key, on the limit: ${c.limit.members.map((m) => short(m)).join(", ")}`),
      el("p", { class: "muted" }, `destinations: ${c.limit.destinations.map((m) => short(m)).join(", ")}`));
  } else {
    parts.push(el("p", { class: "warn" }, "no spending limit: it was removed, or never set. The agent's key can move nothing from the vault."));
  }
  parts.push(el("p", {}, `vault ${sol(c.vault)} SOL`));
  parts.push(el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "agent's transactions"), el("th", {}, "slot"), el("th", {}, "result"), el("th", {}, "version"))),
    el("tbody", {}, ...c.recent.map((t) => el("tr", {}, el("td", { title: t.signature }, short(t.signature, 8)), el("td", {}, t.slot), el("td", {}, el("span", { class: `pill ${t.ok ? "allow" : "deny"}` }, t.ok ? "ok" : "refused"), t.error ? ` ${t.error}` : ""), el("td", {}, String(t.version)))))));
  $("chain").replaceChildren(...parts);
}

async function poll(path, render, every) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? res.status);
    render(body);
  } catch (e) {
    $("identity").textContent = `cannot read ${path}: ${e.message}`;
  }
  setTimeout(() => poll(path, render, every), every);
}

poll("/api/state", renderState, 1000);
poll("/api/chain", renderChain, 5000);
