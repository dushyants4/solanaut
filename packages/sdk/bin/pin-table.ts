// Print a lookup table's pin for `policy.lookupTables` (ADR-009): its address and every entry it
// holds now, read at finalized commitment from the RPC the operator names.
//
//   npm run pin-table -- --url https://api.devnet.solana.com <table-address>
//
// --url is required: nothing here falls back to a default cluster or the Solana CLI's config.
// The output is JSON for the operator to review and paste into the policy; it is never applied.

import { decodeBase58 } from "../src/base58.ts";
import { pinFromAccount } from "../src/tables.ts";

const LOOKUP_TABLE_PROGRAM = "AddressLookupTab1e1111111111111111111111111";

function usage(why: string): never {
  console.error(`pin-table: ${why}\nusage: npm run pin-table -- --url <rpc-url> <table-address>`);
  process.exit(2);
}

const args = process.argv.slice(2);
const at = args.indexOf("--url");
const url = at >= 0 ? args[at + 1] : undefined;
const rest = args.filter((_, i) => i !== at && i !== at + 1);
if (!url) usage("--url is required");
if (rest.length !== 1) usage("name exactly one table address");
const address = rest[0]!;

const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "getAccountInfo",
    params: [address, { encoding: "base64", commitment: "finalized" }],
  }),
});
if (!res.ok) usage(`the RPC answered HTTP ${res.status}`);
const body = (await res.json()) as {
  error?: { message: string };
  result?: { value: { owner: string; data: [string, string] } | null };
};
if (body.error) usage(`the RPC refused: ${body.error.message}`);
const account = body.result?.value;
if (!account) usage(`no account at ${address}`);
if (account.owner !== LOOKUP_TABLE_PROGRAM)
  usage(`${address} is owned by ${account.owner}, not the lookup table program`);
if (account.data[1] !== "base64") usage(`the RPC returned ${account.data[1]}, not base64`);

try {
  decodeBase58(address);
  const pin = pinFromAccount(address, Buffer.from(account.data[0], "base64"));
  console.log(JSON.stringify(pin, null, 2));
} catch (e) {
  usage((e as Error).message);
}
