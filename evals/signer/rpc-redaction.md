# RPC diagnostic redaction finding

2026-10-11 Toronto · builder-authored local diagnostic, CLAIMS S156, defect D42.
Starting revision 32ddf3330cff60b59753938c1e30ccd0b374db8a. Product unchanged.
This is an unresolved finding, not a completed correction or release gate pass.

**Confirmed:** `apps/signer/src/rpc.ts` stores raw caught error messages in
provider health. Total read failure concatenates those messages into its thrown
error; send failure rethrows its raw error. A malformed fake HTTP body containing
only a short synthetic private marker makes JSON.parse put that body text into
the diagnostic. Both refusal and health expose it in both tested paths.

The separate diagnostic has a healthy-provider control and explicit read/send
redaction assertions under RPC-2/OPR-2. On existing Node 26.7.0 and 24.19.0, each
population executes three tests: one passes, two fail, with no skip, cancellation
or todo. The operation itself refuses in both negative cases. The fake send
path executes once and never retries; read failure executes no send. No actual
network request, key, signature, chain transaction or secret is involved.
This establishes provider-text propagation, not a real credential disclosure,
publicly exposed dashboard, deployed isolation failure or loss of funds.

```sh
node --test evals/signer/rpc-redaction.test.ts
/home/dashy/.local/share/mise/installs/node/24.19.0/bin/node --test evals/signer/rpc-redaction.test.ts
node_modules/.bin/tsc --ignoreConfig --noEmit --module NodeNext --moduleResolution NodeNext --target ESNext --allowImportingTsExtensions --strict --skipLibCheck --types node evals/signer/rpc-redaction.test.ts
git apply --check evals/signer/rpc-redaction/suggested.patch
uv run --script evals/signer/rpc-redaction-run.py
```

The first two commands intentionally exit one until the product is corrected.
The standalone fixture typecheck exits zero and its raw output is retained.
Root `npm run typecheck` also exits zero, but excludes this diagnostic directory;
it is not evidence for the fixture by itself. Source and fixture bindings plus
runtime results are in `rpc-redaction/inputs-final.json`; complete failing output
is `node26-response-red.txt` and `node24-response-red.txt`.

The first probe used a thrown fake-fetch exception instead of response bytes.
Its original source is preserved as `initial.test.ts`, with `inputs.json` and
`node26-red.txt`/`node24-red.txt`. That earlier test-path digest refers to the
saved initial fixture, before the deterministic response-body strengthening.
Both observations have the same result but are not pooled into a larger sample.

Suggested remediation, **prepared separately, not integrated**: at the provider catch
and send catch, retain health failure but store fixed bounded category text and
throw a new fixed error without the raw exception or cause. The exact contextual
diff is `rpc-redaction/suggested.patch`, which passes read-only validation.
An initial zero-context hand-written patch fails ordinary validation; preserve
it as `suggested-initial.patch`, then generate the corrected contextual diff
from the unchanged source. No patch is applied, and syntax validation alone
does not prove the suggested behaviour or compatibility.

The separate generated copy now passes all three unchanged diagnostic cases
on each existing runtime. Restoring either provider or send catch to its raw
error handling makes the corresponding assertion fail: each omission population
passes two/fails one. The relocated unchanged RPC battery passes all seventeen
cases on each runtime, with no skip/cancellation/todo. The first copied battery
keeps the original standalone deadline child; retain those outputs separately.
The final hash-bound reproducer relocates that child to the candidate as well,
retaining its assertions/deadline. It reproduces original red, copied green,
both caught omissions and the complete candidate RPC battery. Complete final
outputs/results and generated hashes are retained as `reproduced-*`; the earlier
copy bindings/results are `candidate-results.json`. Explicit strict no-emit
typecheck of the candidate and relocated maintained fixture exits zero.

Only catch handling changes in the suggested product diff; fixture copies
relocate imports/child paths without editing assertions, deadlines or populations.
The source tree stays at the failing original, with source/fixture hashes verified
before and after reproduction. These copied component passes do not integrate
D42 or clear full native, maintained faults, isolation, live or stable gates.

After H11 is resolved, the builder must correct the product, pass these unchanged
redaction assertions, retain all existing RPC validation/outage/single-send
checks and complete ordinary/type/maintained-fault qualification.
Check category diagnostics and privacy before provider health is wired into
operator or dashboard output. H9's line budget and independent/live/isolated
requirements remain; no scope, threshold, deadline, public API or milestone
changes through this finding. The existing full native H11 failure is retained.
