// CI-2: frozen synthetic domains in evals/ci/properties.md. Kit is the external oracle.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import * as fc from "fast-check";
import { getAddressDecoder } from "@solana/kit";
import { checkProperty } from "../../../evals/ci/properties.ts";
import { decodeBase58, encodeBase58 } from "../src/base58.ts";
import { DecodeError, decodeMessage, resolveMessage } from "../src/message.ts";
import { buildMessage, kitDecode, kitResolve } from "./support/kit.ts";

function normalized(bytes: Uint8Array) {
  const message = decodeMessage(bytes);
  return { ...message, instructions: message.instructions.map((ix) => ({ ...ix, data: [...ix.data] })) };
}
test("CI-2 address property: canonical 32-byte base58 agrees with kit", () => {
  checkProperty("address", fc.property(fc.uint8Array({ minLength: 32, maxLength: 32 }), (bytes) => {
    const encoded = encodeBase58(bytes);
    assert.equal(encoded, getAddressDecoder().decode(bytes));
    assert.deepEqual(decodeBase58(encoded), bytes);
  }));
});
for (const version of ["legacy", 0, 1] as const) test(`CI-2 decoder property: ${version} bytes and resolved instructions agree with kit`, () => {
  checkProperty(`decoder-${version}`, fc.property(fc.integer(), (seed) => {
    const built = buildMessage(seed, version);
    assert.deepEqual(normalized(built.bytes), kitDecode(built.bytes));
    const resolved = resolveMessage(decodeMessage(built.bytes), built.tables);
    assert.deepEqual(resolved.instructions.map((ix) => ({ program: ix.program,
      accounts: ix.accounts.map((a) => ({ address: a.address, signer: a.signer, writable: a.writable })), data: [...ix.data] })), kitResolve(built.bytes, built.tables));
  }));
});
test("CI-2 malformed property: arbitrary bytes match kit or have a named decoder refusal", () => {
  checkProperty("arbitrary-bytes", fc.property(fc.uint8Array({ maxLength: 512 }), (bytes) => {
    let decoded;
    try { decoded = normalized(bytes); }
    catch (error) { assert.ok(error instanceof DecodeError); assert.ok(["malformed-proposal", "unsupported-version", "lookup-table-unpinned"].includes(error.rule)); return; }
    assert.deepEqual(decoded, kitDecode(bytes));
  }));
});
