# RPC-1–4 — trusted devnet provider boundary

Measured 2026-10-05, starting revision `54ba32f`; implementation is the commit containing this
receipt. Node 26.7.0; builder-authored fake HTTP providers, no transaction send to a real cluster.

`node --test apps/signer/test/rpc.test.ts`: ten initially fail against a stub, then ten pass.
Raw logs: `rpc/rpc-red.txt`, `rpc/rpc-green.txt`. The battery covers genesis identity, commitment,
blockhash/lifetime, envelope identity, shape/context/size, outages, conflicts, absent/processed
outcomes, rate limits, deadlines and a single send with node retries disabled.

`node evals/signer/rpc-faults.ts`: seven faults caught after one initial integer-validation miss.
The fractional-height fixture also failed at BigInt conversion, masking the missing validator;
added a coherent fractional-context fixture. Added an ID fault with otherwise valid result shapes
so unrelated shape failures cannot mask it. Evidence: `rpc/rpc-fault-missed-integer.txt` and
`rpc/rpc-faults.txt`. The runner restores exact source and checks the restored battery.

| Fault | Rejection |
|---|---|
| wrong network accepted | genesis substitution |
| fractional integer accepted | coherent fractional context |
| stale context accepted | old validity/status context |
| one-provider final outcome | provider outage leaves unresolved |
| retry send | failed send counted once |
| ignore proposal blockhash | unmatched bounded lifetime denied |
| ignore envelope ID | wrong ID with valid result denied |

`npm test` passes 251 tests; typecheck exits zero. Run source mutators sequentially.

## Trust and operational limitations

Identity is checked against devnet genesis before each provider operation. Integer and base58
shapes, envelope version/ID, response size and observed context are validated. Reads use confirmed
commitment and a nondecreasing context floor. HTTP rate limits/unavailability back off within the
deadline; sends run once with `maxRetries: 0` and preflight enabled. A healthy provider can serve
admission reads during a peer outage. Total loss denies reads and reports degraded health.

Final landed/failed evidence requires both providers to agree on committed status, transaction slot
and error. Missing, stale, processed, conflicting or one-provider evidence returns unresolved.
Absence is never converted to expired: history completeness is not established by these providers.
This can retain reservations after expiry. No Byzantine quorum guarantee is claimed.

The initial lifetime implementation accepts only the currently returned blockhash, whose last valid
height is obtained from that provider. An older valid hash is conservatively refused rather than
trusting caller expiry metadata. Providers with differing last-valid heights deny. This availability
limitation must be evaluated in live integration and usability; no threshold is waived.

An injectable clock will use the service's monotonic wall anchor. Operational wiring, peer isolation,
actual outage drills, lookup-table reads and trustworthy expired-outcome evidence remain owed.
Fake fetchers honour the abort signal; no claim covers arbitrary replacement implementations.

## Primary sources and identity read

Protocol definitions checked on 2026-10-05: [genesis identity](https://solana.com/docs/rpc/http/getgenesishash),
[latest hash/lifetime](https://solana.com/docs/rpc/http/getlatestblockhash),
[blockhash validity](https://solana.com/docs/rpc/http/isblockhashvalid),
[height](https://solana.com/docs/rpc/http/getblockheight),
[statuses](https://solana.com/docs/rpc/http/getsignaturestatuses),
[send options](https://solana.com/docs/rpc/http/sendtransaction).

A single read-only `getGenesisHash` POST to `https://api.devnet.solana.com` returned
`EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`, matching the pin. Regenerate with that JSON-RPC
method and a bounded fetch deadline; no key or funding is needed. No other live qualification
is inferred from that identity read.
