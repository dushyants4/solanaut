// The pin command end to end, against a local stand-in for the RPC: it asks at finalized
// commitment, refuses an account the lookup table program does not own, and prints the pin.

import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { promisify } from "node:util";
import { getAddressDecoder } from "@solana/kit";
import { craftTableAccount, key } from "./support/craft.ts";

const run = promisify(execFile);
const b58 = (k: number[]) => getAddressDecoder().decode(Uint8Array.from(k)) as string;
const TABLE = b58(key(50));

async function rpc(answer: (params: unknown[]) => unknown) {
  const seen: unknown[] = [];
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const call = JSON.parse(raw);
    seen.push(call);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", id: call.id, result: { context: { slot: 1 }, value: answer(call.params) } }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as { port: number };
  return { url: `http://127.0.0.1:${port}`, seen, close: () => server.close() };
}

const pinTable = (...args: string[]) => run("node", ["packages/sdk/bin/pin-table.ts", ...args]);

test("pin-table prints the table's address and entries, read at finalized commitment", async () => {
  const data = Buffer.from(craftTableAccount({ entries: [key(3), key(4)] })).toString("base64");
  const s = await rpc(() => ({ owner: "AddressLookupTab1e1111111111111111111111111", data: [data, "base64"], lamports: 1, executable: false }));
  try {
    const { stdout } = await pinTable("--url", s.url, TABLE);
    assert.deepEqual(JSON.parse(stdout), { address: TABLE, entries: [b58(key(3)), b58(key(4))] });
    assert.deepEqual((s.seen[0] as { params: unknown[] }).params, [TABLE, { encoding: "base64", commitment: "finalized" }]);
  } finally {
    s.close();
  }
});

test("pin-table refuses: no --url, an account another program owns, no account, a deactivated table", async () => {
  await assert.rejects(pinTable(TABLE), (e: { code: number; stderr: string }) => e.code === 2 && /--url is required/.test(e.stderr));

  const data = Buffer.from(craftTableAccount({ entries: [key(3)] })).toString("base64");
  const cases: [unknown, RegExp][] = [
    [{ owner: "11111111111111111111111111111111", data: [data, "base64"] }, /not the lookup table program/],
    [null, /no account/],
    [{ owner: "AddressLookupTab1e1111111111111111111111111", data: [Buffer.from(craftTableAccount({ entries: [key(3)], deactivationSlot: 7n })).toString("base64"), "base64"] }, /deactivated/],
  ];
  for (const [value, why] of cases) {
    const s = await rpc(() => value);
    try {
      await assert.rejects(pinTable("--url", s.url, TABLE), (e: { code: number; stderr: string }) => e.code === 2 && why.test(e.stderr));
    } finally {
      s.close();
    }
  }
});
