// Builds REPORT.json from per-case metadata and the test names in tests/. Run after
// `node --test tests/*.test.mjs > run.txt 2>&1`.
import fs from "node:fs";

const dir = new URL("./tests/", import.meta.url);
const names = {};
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".test.mjs"))) {
  const src = fs.readFileSync(new URL(f, dir), "utf8");
  for (const m of src.matchAll(/test\("((?:[^"\\]|\\.)*)"/g)) {
    const name = m[1].replace(/\\"/g, '"');
    names[name.split(" ")[0]] = { file: f, name };
  }
}

const deny = (r) => `deny ${r}`;
// id: [spec, expected, verdict?, observed?]
const M = {
  D01: ["§5 rule 1; §11 fail-closed (garbage bytes)", deny("malformed-proposal")],
  D02: ["§4 Message versions; §5 rule 2; §11 fail-closed (an unknown version)", deny("unsupported-version")],
  D03: ["§5 rule 1; API decodeMessage ('every byte belongs to it')", "the message alone is allowed; with one trailing byte, deny malformed-proposal"],
  D04: ["§5 rule 1 ('a field is ... ill-typed'); §3 ProposalV1.at: number", deny("malformed-proposal")],
  D05: ["§4 v0; §5 rule 3; §11 fail-closed (an unpinned table)", deny("lookup-table-unpinned")],
  D06: ["§4 v0 ('an index at or past a pin's length is denied'); §5 rule 3; §11 fail-closed (an index past a pin)", "index length-1 allowed; index == length, deny lookup-table-unpinned"],
  D07: ["§4 v0; API ResolvedMessage.accounts order; §5 rule 10; §11 drain (a table index that points at an attacker)", deny("destination-not-allowed") + " (a table-by-table order would resolve to the allowed owner)"],
  D08: ["§4 v1 (config section); §4 Fees ('v1: the config's lamport total'); §3 computeUnitLimit, baseFee", "priorityFee 7777, computeUnitLimit 450, baseFee 5000; allowed; amounts.fees '12777'"],
  D09: ["§3 computeUnitLimit ('v1: the config's, 0 if unset')", "computeUnitLimit 0; priorityFee 10"],
  D10: ["§4 v1 ('Any ComputeBudget instruction in a v1 message is denied'); §5 rule 9; §11 drain (a v1 message with a ComputeBudget decoy)", deny("instruction-denied")],
  D11: ["§4 table, ComputeBudget row ('any ComputeBudget instruction in a v1 message')", deny("instruction-denied")],
  D12: ["§4 v1 ('at most 64 inline accounts'); §5 rule 1", "64 accounts allowed; 65, deny malformed-proposal"],
  D13: ["§4 Durable nonces ('in every version'); §5 rule 5", deny("durable-nonce-denied")],
  C01: ["§4 System row; §5 rule 10; §11 drain (a new recipient)", deny("destination-not-allowed")],
  C02: ["§4 System row (Transfer, value-moving); §3 amounts", "allowed; amounts.sol '123456'"],
  C03: ["§4 System row (TransferWithSeed, value-moving); §4 The principal; §5 rule 10", deny("destination-not-allowed")],
  C04: ["§4 System row (CreateAccountWithSeed: the new account must be an allowed destination); §5 rule 10", deny("destination-not-allowed")],
  C05: ["§4 System row (CreateAccount); §3 sol kind 'new-account'", "effects.sol [{A→K2, 2000000, new-account}]; allowed"],
  C06: ["§4 The principal; §5 rule 6 before rule 10; §11 drain (CreateAccount funding a counterparty's key)", deny("other-signer") + " (the new account must sign)"],
  C07: ["§4 Decided: CreateAccountAllowPrefund ('denied when the new account is a principal key'); §5 rule 9", deny("instruction-denied")],
  C08: ["§4 System row (Assign: denied); §5 rule 9", deny("instruction-denied")],
  C09: ["§4 ('Anything not listed is denied as instruction-denied'); §5 rule 9", deny("instruction-denied")],
  C10: ["§4 Durable nonces; §5 rule 5; §11 drain (a durable-nonce transfer)", deny("durable-nonce-denied")],
  C11: ["§4 Durable nonces ('as is every nonce instruction'); §5 rule 5", deny("durable-nonce-denied")],
  C12: ["§4 Decided ('short or trailing data ... is denied'); §5 rule 9", deny("instruction-denied")],
  C13: ["§4 Decided ('or too few accounts'); §5 rule 9", deny("instruction-denied")],
  C14: ["§4 SPL Token row (TransferChecked); §4 Rules for tokens; §3 amounts", "allowed; amounts.tokens [{M, '500000'}]"],
  C15: ["§4 Rules for tokens (Destination); §5 rule 10; §11 drain (a token sent to a non-associated account)", deny("destination-not-allowed")],
  C16: ["§4 SPL Token row (Approve: denied); §5 rule 9; §11 drain (Approve to an attacker)", deny("instruction-denied")],
  C17: ["§4 SPL Token row (SetAuthority: denied); §11 drain (SetAuthority)", deny("instruction-denied")],
  C18: ["§4 SPL Token row (CloseAccount: denied)", deny("instruction-denied")],
  C19: ["§4 SPL Token row (Revoke: benign)", "allowed"],
  C20: ["§4 Decided: p-token Batch (255) denied by not being listed", deny("instruction-denied")],
  C21: ["§4 Decided: p-token WithdrawExcessLamports (38)", deny("instruction-denied")],
  C22: ["§4 Rules for tokens (Mint inferred from the principal's ATA); §5 rule 12; §11 drain (an oversized send of a listed mint)", "at the cap allowed with mint M; cap+1, deny over-per-tx-cap"],
  C23: ["§4 Rules for tokens (Mint: 'Otherwise ... token-mint-unknown'); §5 rule 11", deny("token-mint-unknown")],
  C24: ["§3 PolicyV1.tokens ('any mint not listed is denied'); §5 rule 11", deny("mint-not-allowed")],
  C25: ["§4 Decided ('A token transfer whose authority does not sign ... is denied')", deny("instruction-denied")],
  C26: ["§4 Decided ('trailing data')", deny("instruction-denied")],
  C27: ["§4 Token-2022 row (TransferChecked); Rules for tokens (Token-2022 derivation)", "allowed"],
  C28: ["§4 Rules for tokens ('Token and Token-2022 derive different addresses'); §5 rule 10", deny("destination-not-allowed")],
  C29: ["§4 Token-2022 row ('plus every extension instruction')", deny("instruction-denied")],
  C30: ["§4 Memo row ('any')", "allowed"],
  C31: ["§4 'any other program' row; §5 rule 8", "opaque 'deny': deny opaque-program; opaque 'allow': allowed"],
  C32: ["§4 'any other program' row; §5 rule 7; §11 drain (an unlisted program)", deny("program-not-allowed")],
  C33: ["§4 The principal; §5 rule 6; §11 drain (another signer's instruction)", deny("other-signer")],
  E01: ["§3 signers ('every required signer'), otherSigners; §5 rule 6", "otherSigners [C]; deny other-signer"],
  E02: ["§3 amounts are bigint; §5 rule 12 (the SOL total); §10 D9", deny("over-per-tx-cap")],
  E03: ["§3 amounts are bigint; §10 D9; §5 rule 12", "2^53 allowed; 2^53+1, deny over-per-tx-cap"],
  E04: ["§5 rule 12 ('a mint's total')", deny("over-per-tx-cap")],
  E05: ["§5 rule 12 ('the SOL total'); §4 System row (new-account lamports count)", deny("over-per-tx-cap")],
  E06: ["§4 System row (TransferWithSeed: amount checked); §5 rule 12", deny("over-per-tx-cap")],
  E07: ["§4 Rules for tokens (the principal's ATA); §3 PolicyV1.principal is a list", "allowed; amounts.tokens [{M, '5'}]"],
  E08: ["§4 Rules for tokens (inference only from the principal's ATA, derived with the mint's token program); §5 rule 11", deny("token-mint-unknown")],
  E09: ["§4 ('Anything not listed is denied'); §5 rule 9", deny("instruction-denied")],
  E10: ["§4 Token-2022 row (TransferCheckedWithFee is Alpha; extension instructions denied)", deny("instruction-denied")],
  E11: ["§5 rule 1 ('the bytes do not parse')", deny("malformed-proposal")],
  E12: ["§5 rule 1; §3 feePayer", deny("malformed-proposal")],
  E13: ["§5 rule 1 ('ill-typed'); §3 ProposalV1.blockHeight: bigint", deny("malformed-proposal")],
  E14: ["§4 ComputeBudget row (RequestHeapFrame, SetLoadedAccountsDataSizeLimit: benign)", "allowed"],
  E15: ["§3 PolicyV1.destinations (owners); §5 rule 10", deny("destination-not-allowed")],
  F01: ["§4 Fees ('ceil(price × limit / 1,000,000)')", "computeUnitLimit 333333; priorityFee 1"],
  F02: ["§4 Fees (default limit; 3,000 per builtin)", "computeUnitLimit 6000; priorityFee 6000"],
  F03: ["§4 Fees ('only System and ComputeBudget are counted at 3,000')", "computeUnitLimit 206000; priorityFee 206000"],
  F04: ["§4 Fees ('at most 1,400,000')", "computeUnitLimit 1400000; priorityFee 1400000"],
  F05: ["§4 Fees; §5 rule 13; §11 drain (a price with no limit)", "priorityFee 10150; deny over-fee-cap"],
  F06: ["§5 rule 13 ('over fees.maxPriorityPerTx')", "fee at the cap allowed; cap+1, deny over-fee-cap"],
  F07: ["§4 Fees ('No price means no priority fee')", "priorityFee 0"],
  F08: ["§3 amounts are bigint; §5 rule 13", deny("over-fee-cap")],
  F09: ["§4 Fees (Base fee: 'counting each signature a precompile instruction ... verifies'); §3 baseFee", "baseFee 40000; allowed; amounts.fees '40000'"],
  F10: ["§4 Fees (Tips); §3 sol ('tips excluded'), tips", "tips 500000000; sol []; allowed under a 1000-lamport SOL cap; amounts.sol '0', amounts.fees '500005000'"],
  F11: ["§4 Fees ('The fee window counts priority fees, base fees and tips together'); §5 rule 16", "window 15000 allowed with amounts.fees '15000'; window 14999, deny over-window-cap"],
  F12: ["§4 Decided ('Two ComputeBudget instructions of the same kind are denied')", deny("instruction-denied")],
  F13: ["§4 Decided ('the deprecated RequestUnits')", deny("instruction-denied")],
  F14: ["§4 Decided ('any ComputeBudget instruction whose data is not its exact size')", deny("instruction-denied")],
  F15: ["§4 Decided ('... not its exact size')", deny("instruction-denied")],
  F16: ["§4 Decided (the intent key leaves out the blockhash, version, fees, tips, ComputeBudget and Memo); §3 intentKey", "same key; a different amount gives a different key"],
  F17: ["§4 Decided ('Two calls to the same opaque program share a key whatever their data')", "same key"],
  O01: ["§5 ('The first failing rule is the reason'): rule 3 before rule 5", deny("lookup-table-unpinned")],
  O02: ["§5: rule 5 before rule 6", deny("durable-nonce-denied")],
  O03: ["§5: rule 6 before rule 7", deny("other-signer")],
  O04: ["§5: rule 7 before rule 9", deny("program-not-allowed")],
  O05: ["§5: rule 8 before rule 9", deny("opaque-program")],
  O06: ["§5: rule 9 before rule 10", deny("instruction-denied")],
  O07: ["§5: rule 10 before rule 11", deny("destination-not-allowed")],
  O08: ["§5: rule 11 before rule 12", deny("mint-not-allowed")],
  O09: ["§5: rule 12 before rule 13", deny("over-per-tx-cap")],
  O10: ["§5: rule 1 before rule 7", deny("malformed-proposal")],
  P00: ["§5 rule 0 (precondition: a valid policy creates a guard)", "createPolicy and createGuard succeed"],
  P01: ["§5 rule 0 ('a non-finite ... cap'); §10 D2; §11 fail-closed (an invalid policy)", "createPolicy throws PolicyError (rule invalid-policy); createGuard rejects"],
  P02: ["§5 rule 0 ('a non-finite ... cap')", "PolicyError invalid-policy from both"],
  P03: ["§5 rule 0 ('a ... negative cap')", "PolicyError invalid-policy from both"],
  P04: ["§5 rule 0 ('a ... negative cap')", "PolicyError invalid-policy from both"],
  P05: ["§5 rule 0 ('an empty ... address')", "PolicyError invalid-policy from both"],
  P06: ["§5 rule 0 ('an ... invalid address')", "PolicyError invalid-policy from both"],
  P07: ["§5 rule 0 ('an ... invalid address')", "PolicyError invalid-policy from both"],
  P08: ["§5 rule 0 ('an empty principal')", "PolicyError invalid-policy from both"],
  P09: ["§5 rule 0 ('a release key that is ... in the principal')", "PolicyError invalid-policy from both"],
  P10: ["§5 rule 0 ('a pinned table with an invalid entry')", "PolicyError invalid-policy from both"],
  P11: ["§5 rule 0 ('an ... invalid address')", "PolicyError invalid-policy from both"],
  G01: ["§4 ('Anything not listed is denied'); §5 rule 9", deny("instruction-denied") + " (a reader of the low byte alone would see Transfer)"],
  G02: ["§4 Rules for tokens ('the associated token account of an allowed owner for that mint')", deny("destination-not-allowed")],
  G03: ["§5 rule 12 ('the SOL total, or a mint's total'): separate caps", "allowed; amounts.sol '1000000000'"],
  G04: ["§5 rule 10 (no amount exemption)", deny("destination-not-allowed")],
  G05: ["§4 System row (CreateAccountWithSeed); §4 Rules ('an address the policy names directly'); §3 sol", "effects.sol [{A→created, 3000000, new-account}]; allowed"],
  G06: ["§4 Rules for tokens (Mint inferred; Token-2022 derivation)", "allowed; amounts.tokens [{M22, '7'}]"],
  G07: ["§4 v1 (config section); §5 rule 1. The mask's bit layout is kit 8.4.0's (SIMD-0385), not stated in the spec", "mask 0b100 allowed; 0b101, deny malformed-proposal"],
  G08: ["§4 v0 ('every lookup table it uses must be pinned'); §5 rule 3", deny("lookup-table-unpinned")],
  G09: ["§4 The principal ('the fee payer's fees'); §5 rule 6", deny("other-signer")],
  G10: ["§4 Durable nonces ('in every version'); §5 rule 5", deny("durable-nonce-denied")],
  G11: ["§4 Decided ('short ... data')", deny("instruction-denied")],
  G12: ["§4 Decided ('short ... data')", deny("instruction-denied")],
  G13: ["§5 rule 1; API decodeMessage", "v1 alone allowed; with one trailing byte, deny malformed-proposal"],
  G14: ["§5 rule 1; API decodeMessage", "v0 alone allowed; with one trailing byte, deny malformed-proposal"],
  X01: ["§3 programs ('in order of first call'), signers ('in message order'), feePayer", "programs [Memo, System, ComputeBudget, Token]; signers [A, K2]"],
  X02: ["§3 denied ('Token.Approve', 'System.unknown(14)')", "[[1, Token.Approve, instruction-denied], [2, System.unknown(14), instruction-denied]]"],
  X03: ["§3 nonce; §4 Durable nonces", "nonce true; denied[0].rule durable-nonce-denied"],
  X04: ["§3 tokens (mint, fromAccount, authority, toAccount, toOwner, amount, decimals); §4 Rules for tokens", "both entries exact; plain Transfer: mint M inferred, decimals null"],
  X05: ["§3 opaque", "[OP]"],
  X06: ["§4 System row ('every nonce instruction (... Authorize ...)')", deny("durable-nonce-denied")],
  X07: ["§4 SPL Token row (InitializeAccount3: benign)", "allowed"],
  X08: ["§4 Token-2022 row (Revoke: benign)", "allowed"],
  X09: ["§4 Token-2022 row ('the SPL Token list': Approve)", deny("instruction-denied")],
  X10: ["§4 Rules for tokens ('derived offline with the mint's token program'); §5 rules 10, 11",
    "unclear: destination-not-allowed if 'the mint's token program' is the policy's listing; mint-not-allowed if it is the instruction's program",
    "unclear", "deny mint-not-allowed ('mint … under the token program is not listed')"],
  X11: ["§4 Decided (the intent key leaves out the version)", "same key, legacy and v1"],
  U01: ["§4 Rules for tokens; §5 rules 10, 11", "unclear: with the mint unknown, rule 10 cannot match an ATA for 'that mint'; the spec does not say whether rule 10 or rule 11 names it",
    "unclear", "deny destination-not-allowed ('neither an allowed owner's associated account nor an allowed address')"],
  U02: ["§4 Fees ('SetComputeUnitLimit's value if present, else the runtime default ..., at most 1,400,000')", "unclear: does 'at most 1,400,000' bind an explicit limit too?",
    "unclear", "computeUnitLimit 1400000, priorityFee 1400000 (explicit 2,000,000 capped); deny over-fee-cap"],
  U03: ["§4 table ('any other program: denied unless allowlisted'); §5 rule 7", "unclear: must the decoded programs (System, Token, ComputeBudget, Memo) be on programs.allow?",
    "unclear", "deny program-not-allowed for Memo, and for ComputeBudget, when absent from programs.allow"],
  U04: ["§5 rule 1 (silent on duplicate keys)", "unclear", "unclear", "deny malformed-proposal ('an account is listed twice')"],
  U05: ["§3 PolicyV1.destinations; §4 The principal (silent on a principal paying itself)", "unclear", "unclear", "deny destination-not-allowed"],
  U06: ["§5 rule 1 ('ill-typed'); §3 ProposalV1.at: number", "unclear: is NaN ill-typed?", "unclear", "deny malformed-proposal ('at must be a time in milliseconds')"],
  U07: ["§5 rule 1; §3 ProposalV1.intent?: string", "unclear: does rule 1 reach the optional, never-decisive intent field?", "unclear",
    "deny malformed-proposal ('intent must be text of at most 256 characters': a 256-character bound the spec does not state)"],
  U08: ["§5 rule 1 (silent on header counts that exceed the key list)", "unclear", "unclear", "deny malformed-proposal ('the header counts 1 signers and 5 read-only accounts, but the message lists 3 accounts')"],
};
// Later groups add their metadata here.
const extra = fs.existsSync(new URL("./meta-extra.json", import.meta.url))
  ? JSON.parse(fs.readFileSync(new URL("./meta-extra.json", import.meta.url), "utf8")) : {};
Object.assign(M, extra);

const run = fs.readFileSync(new URL("./run.txt", import.meta.url), "utf8");
const failText = (name) => {
  const i = run.lastIndexOf(`✖ ${name} (`);
  if (i < 0) return "see REPORT.md";
  const block = run.slice(i).split("\n").slice(1, 4).join(" ").replace(/\s+/g, " ").trim();
  return block.slice(0, 300);
};
const cases = Object.entries(M).map(([id, [spec, expected, verdict, observed]]) => {
  const t = names[id];
  if (!t) throw new Error(`no test for ${id}`);
  const passed = run.includes(`✔ ${t.name} (`);
  const v = verdict ?? (passed ? "pass" : "fail");
  return {
    id, spec, case: t.name.slice(id.length + 1), expected,
    observed: observed ?? (passed ? `as expected: ${expected}` : failText(t.name)),
    verdict: v, test: `tests/${t.file}: ${t.name}`,
  };
});
const missing = Object.keys(names).filter((id) => !M[id]);
if (missing.length) throw new Error(`tests without metadata: ${missing}`);

const counts = cases.reduce((a, c) => ((a[c.verdict] = (a[c.verdict] ?? 0) + 1), a), {});
const report = {
  evaluator: "claude-opus-5-5",
  area: "decode",
  summary: `${cases.length} black-box cases over §3 EffectsV1, §4 and §5 rules 0 to 13, with §11's fail-closed and drain batteries: ${counts.pass ?? 0} pass, ${counts.fail ?? 0} fail, ${counts.unclear ?? 0} unclear; every decision the cases check (every §4 table row, every decided item, rule order, rule 0, fees, the twelve drain kinds) matched the spec. The one fail is definitional: §3's formula for the intent key, sha256(canonical {feePayer, signers, opaque, sol, tokens, nonce}), does not reproduce the key the guard computes, though the key behaves as specified (S02, low severity). Messages were built byte by byte (v1 from @solana/kit 8.4.0's SIMD-0385 codec, cross-checked with kit's decoder) under a neutral sensor holding Keel at DEFAULT. The nine unclear cases are places where the spec admits two readings, and each was denied or bounded on the safe side.`,
  counts,
  cases,
  spec_questions: [
    "§4 Rules for tokens: 'derived offline with the mint's token program'. Is that the program the policy lists for the mint, or the program the instruction runs under? A classic-Token TransferChecked of a mint listed as token-2022 is denied as mint-not-allowed (instruction's program); the other reading gives destination-not-allowed (X10).",
    "§5 rules 10 and 11: when a plain Transfer's mint cannot be inferred and its destination is an ATA, not an address named directly, which rule names the denial? Observed: destination-not-allowed (U01). The spec's token-mint-unknown is reachable only with a directly named destination.",
    "§4 table and §5 rule 7: must System, Token, Token-2022, ComputeBudget and Memo appear in programs.allow? The table's 'any other program: denied unless allowlisted' suggests not; the guard denies them as program-not-allowed when absent (U03). State it either way.",
    "§4 Fees: does 'at most 1,400,000' cap an explicit SetComputeUnitLimit as well as the default? The guard caps it (U02), which matches the runtime; the sentence reads as if it bound only the default.",
    "§5 rule 0: 'a release key that is the fee payer'. PolicyV1 has no fee-payer field, so at creation only principal membership can be checked, and a fee payer outside the principal is already other-signer. Is there a separate check, at creation or at decision time? Not testable from the spec as written.",
    "§5 rule 1: does 'a field is missing or ill-typed' cover NaN times, optional fields such as intent, and a length bound on intent? The guard denies at = NaN and a numeric intent, and enforces a 256-character intent bound the spec does not state (U06, U07).",
    "§4 v1: the wire layout (config mask bits, the two-bit priority-fee pair, instruction headers) is not in the spec, only its contents. These cases follow @solana/kit 8.4.0. Should the spec cite SIMD-0385's layout, so that a half-set fee pair (G07) and unknown mask bits have a stated rule?",
    "§5 rule 1: duplicate static keys (U04) and header counts that exceed the key list (U08) are denied as malformed-proposal. The spec says only 'the bytes do not parse'; worth listing the structural checks.",
  ],
  own_mistakes_fixed: [
    "X10 asserted destination-not-allowed, reading §4's 'the mint's token program' as the policy's listing. The sentence admits the instruction's program too, so the test now asserts only the denial and records the rule; verdict unclear.",
    "The first run used the brief's `node --test tests/`, which Node 26.7.0 rejects before running anything (a bare directory is loaded as a module). The suite runs with `node --test tests/*.test.mjs`. No test changed.",
    "After the reboot cleared /tmp, every test file was recreated in /home/dashy/.cache/solanaut/eval/e1-decode from the earlier writes, unchanged except X10 in its corrected form; the 133 recreated tests gave the same results and the same observations.",
  ],
  method_notes: [
    "Fresh guard per case, in memory, with a neutral sensor (intensity 0, valence 0.2, repetition 0) so Keel stays at DEFAULT; a probe with the default sensor gave the same allow.",
    "ATAs and seeded addresses come from @solana/addresses (kit), not from the SDK's own pda helpers, so a derivation bug in the SDK could not agree with itself.",
    "For denials whose rule could be reached for an unrelated cause, the guard's reason text was read and names the intended cause (AllowPrefund on a principal, multisig authority, layout mismatch, second SetComputeUnitPrice, deprecated RequestUnits, unknown discriminator).",
    `Aimed for 30 to 45 cases; went past it because the first 45 all passed, and the brief's own lists (every §4 row allowed and denied, every decided item, every rule-0 condition, rule-order pairs, the twelve drain kinds) need more.`,
  ],
};
fs.writeFileSync(new URL("./REPORT.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(counts, cases.length);
