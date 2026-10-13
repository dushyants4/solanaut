// SIG-1/6/8: memory-only synthetic key material; disk fixtures contain no valid key.
import { strict as assert } from "node:assert";
import { generateKeyPairSync, verify } from "node:crypto";
import { chmodSync, linkSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { encodeBase58 } from "@solanaut/sdk";

async function api() { return await import("../src/key.ts"); }
function memoryKey() {
  const pair = generateKeyPairSync("ed25519"), privateJwk = pair.privateKey.export({ format: "jwk" });
  const publicBytes = Buffer.from(privateJwk.x!, "base64url");
  return { pair, publicBytes, bytes: new Uint8Array(Buffer.concat([Buffer.from(privateJwk.d!, "base64url"), publicBytes])) };
}
test("SIG-1/6: imported synthetic key exposes only public identity/signing and signs exact bytes", async () => {
  const { createDevnetSigner } = await api(), f = memoryKey(), signer = createDevnetSigner(f.bytes);
  assert.deepEqual(Object.keys(signer).sort(), ["address", "sign"]); assert.equal(Object.isFrozen(signer), true);
  assert.equal(signer.address, encodeBase58(f.publicBytes));
  const message = Uint8Array.of(8, 4, 1), signature = await signer.sign(message);
  assert.equal(verify(null, message, f.pair.publicKey, signature), true);
  assert.equal(verify(null, Uint8Array.of(8, 4, 2), f.pair.publicKey, signature), false);
});
test("SIG-1/6: malformed lengths and a mismatched public half refuse without raw values", async () => {
  const { createDevnetSigner } = await api(), f = memoryKey();
  const wrong = new Uint8Array(f.bytes); wrong[63] = wrong[63]! ^ 1;
  for (const bytes of [new Uint8Array(0), new Uint8Array(63), new Uint8Array(65), wrong, null as unknown as Uint8Array]) {
    assert.throws(() => createDevnetSigner(bytes), (error: unknown) => error instanceof Error && error.message === "devnet key unavailable" && !("cause" in error));
  }
});
for (const fault of ["mode", "parent-mode", "symlink", "hardlink", "directory", "oversized", "malformed"] as const) {
  test(`SIG-1/8: protected loader refuses ${fault} without key or path disclosure`, async () => {
    const { loadDevnetKey } = await api(), root = mkdtempSync(join(tmpdir(), "solanaut-public-fixture-"));
    chmodSync(root, 0o700);
    const file = join(root, "public-placeholder.json"); writeFileSync(file, '{"public":"placeholder"}', { mode: 0o400 });
    let input = file;
    if (fault === "mode") chmodSync(file, 0o600);
    if (fault === "parent-mode") chmodSync(root, 0o750);
    if (fault === "symlink") { input += ".alias"; symlinkSync(file, input); }
    if (fault === "hardlink") { input += ".alias"; linkSync(file, input); }
    if (fault === "directory") { input = join(root, "dir"); mkdirSync(input, { mode: 0o400 }); }
    if (fault === "oversized") { chmodSync(file, 0o600); writeFileSync(file, "x".repeat(4097)); chmodSync(file, 0o400); }
    assert.throws(() => loadDevnetKey(input), (error: unknown) => error instanceof Error && error.message === "devnet key unavailable" && !error.message.includes(root) && !("cause" in error));
  });
}
