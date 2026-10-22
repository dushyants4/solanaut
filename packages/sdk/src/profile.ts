// Stable history binds rules, decoder, sensor and the exact published controller bytes.
export const VERIFIED_KEEL_DIGEST = "834015d73e6576d6c597b5a32a62c24ac56a50c7023261bf84b96beb01ded7d8";
export const VERIFIED_KEEL_MODULE = "8f642684bf1dccbdaed1e35e0092e11d0cfc309c0491b1c79f6472616b9c7190";
export const EVALUATION_PROFILE = Object.freeze({
  record: 1,
  rules: "policy-v1-latch-c",
  decoder: "message-v1",
  sensor: "sensor-v1",
  keel: "1.0.1",
  wasm: VERIFIED_KEEL_DIGEST,
  module: VERIFIED_KEEL_MODULE,
});
