// Read-only qualification attempt with existing dependencies; no ignored formats.
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const pins = {
  "bom-1.5.schema.json": "067f7824b08653839ea050ae9e09ca48375eadc2652b0e2a299476e7db90335b",
  "spdx.schema.json": "4f6e2b05c05d26a4f2dc5879fbc2fca94b0a28db46289d0c51345621b71cfbfc",
  "jsf-0.82.schema.json": "8bae002c25e723db7ee1f26afde680ae1a2b1a8f6b4b4b0fd65dc3becb090aae",
};
const schemas = {};
for (const [name, hash] of Object.entries(pins)) {
  const bytes = readFileSync(`.sandbox/cyclonedx-schema/${name}`);
  if (createHash("sha256").update(bytes).digest("hex") !== hash) throw new Error("schema bytes differ from reviewed source");
  schemas[name] = JSON.parse(bytes.toString("utf8"));
}
const ajv = new Ajv({ strictSchema: true, strictTypes: false, strictTuples: false, strictRequired: false, allErrors: true, validateFormats: true });
addFormats(ajv);
ajv.addSchema(schemas["spdx.schema.json"]);
ajv.addSchema(schemas["jsf-0.82.schema.json"]);
const validate = ajv.compile(schemas["bom-1.5.schema.json"]);
const report = JSON.parse(readFileSync("evals/release/package-inventory/derived-package.cdx.json", "utf8"));
if (!validate(report)) throw new Error(JSON.stringify(validate.errors));
console.log("derived inventory passes the pinned schema with installed formats");
