import { strict as assert } from "node:assert";
import { test } from "node:test";
import { measureAdmissions, validateAdmissions, type AdmissionEvidence } from "./concurrency.ts";
const clean: AdmissionEvidence = { proposed: 1000, admitted: 7, denied: 993, recorded: 1000, destinations: 1000, identities: 1000, reserved: "7000000", deniedRules: ["over-window-cap"] };
test("CI-2 SDK concurrency gate rejects reduced budget and incorrect admission/outcome totals", () => {
  for (const result of [{ ...clean, proposed: 999, denied: 992, recorded: 999, destinations: 999, identities: 999 }, { ...clean, proposed: NaN }, { ...clean, admitted: 8, denied: 992 }, { ...clean, admitted: 6, denied: 994 }, { ...clean, denied: 992 }]) assert.throws(() => validateAdmissions(result));
});
test("CI-2 SDK concurrency gate rejects missing evidence, deduplicated work and wrong refusal rules", () => {
  for (const result of [{ ...clean, recorded: 999 }, { ...clean, destinations: 999 }, { ...clean, identities: 999 }, { ...clean, reserved: "8000000" }, { ...clean, deniedRules: [] }, { ...clean, deniedRules: ["latched"] }]) assert.throws(() => validateAdmissions(result));
});
test("CI-2 SDK concurrency gate accepts complete bounded admission evidence", () => validateAdmissions(clean));
test("CI-2 SDK concurrency: a thousand queued callers admit exactly the pending-window bound", async () => {
  const result = await measureAdmissions(); console.log(JSON.stringify(result)); validateAdmissions(result);
});
