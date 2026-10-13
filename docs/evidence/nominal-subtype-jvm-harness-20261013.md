# Nominal Subtype JVM acceptance harness

Predecessor: `5a4386eac97306f1e4fa3b1097d9caf20ef2d608`.

## Scope

The Java and Kotlin callers retain all 26 full-API exports and all 13 exports
of the standalone result-only API. Both ordinary and independently reviewed
author configurations remain required. The fixture renames only the nominal
`Pair` record to `EnvelopePair`; the JVM product carrier remains `Pair`, and
the production generator still rejects that reserved-name collision.

The callers check complete nested values with independent binary snapshots.
They retain 100-bit natural numbers, empty and populated arrays, option/result
branches, aliases, nominal records and variants. Full callers also check
per-site constructor choices, Fin checks before Subtype reconstruction, late
rejection, recovery and unchanged accepted/rejected inputs.

## Completed compiler and caller controls

All eight profile/route/API combinations compile against genuine generated
Java and Kotlin APIs. Separate stand-ins pass the expected caller counters;
the callers reject all 112 deliberately faulty stand-ins. Four compiler probes
check full API presence and the absence of all thirteen input-only methods
and `EnvelopePair` from result-only packages. Four Kotlin compilations check
non-null parameters beside compiling controls against the same classpath.

The complete compiler-backed test passes once, with no failures or skips.
Original TAP SHA256:
`e2323816e71b9bc5d7b300789be4f789c31690ad9b71fcdd1652fb23e9689555`.
These are source-only and synthetic controls, not Lean execution or installed
package acceptance. The selected JDK and Kotlin distributions remain trusted
tools.

An earlier stand-in run caught an untyped Java empty-array expectation. Java
inferred `Object[]`, while the API returns `Option<Envelope>[]`. The expectation
now supplies its element type explicitly; the snapshot's class/type check
remains intact. Original failure log SHA256:
`def30b1d274f0a6f5281ee496c77edcf2b9804c67ede8a567df59e777bd470f7`.
The corrected standalone model run passes all eight selections and 112
mutation controls; log SHA256:
`11446bcebbfe118a906b944dd7744bdedf30d268eb95fd6a27443431663ee000`.

## Installed producer

The separately gated producer builds each route/API selection in two author
roots, compares the complete Maven handoffs and removes the author trees.
It verifies the original JAR and embedded inventory before compiling either
consumer. It then runs installed consumers, physically relocates them, and
replays unchanged bytecode after removing consumer sources and handoff/probe
directories. API-absence and Kotlin nullability probes use the same original
JAR. All original process records and output identities are retained.

This producer has not run at the harness checkpoint. Its four gated cases do
not supply acceptance when skipped. Later installed receipts, recurring CI
and scoped support/documentation promotion remain required. Constructor/source
entry counters and memory instrumentation are separate work.

## Registration and previous evidence

The registration ledger records three exact source transitions. It changes
only suite imports and the historical-source normalization chain. The support
inventory and earlier evidence files remain byte-identical to the predecessor.
The inventory still contains 500 evidence entries and 585 observations; no
Java/Kotlin support position is promoted by this harness.

Ledger SHA256:
`e021f93b103deba14459bd79881bdfd6a4f337cf8369fed3f55273959647ec62`.

## Final harness validation

The focused suite passes 16 tests, with zero failures and five explicit
compiler/installed gates skipped. Its original TAP SHA256 is
`136e868bfcb2193bf14236f9e5c171274df5cba6f33871445fc76e0f97fac751`.
The parent-suite registration check passes ten tests with the same five gates
skipped; TAP SHA256 is
`01e3604f303e65bf4e692c0f30079707c459f95bc0816bc68ddd2d72aec22a43`.
The compiler-backed caller test above ran its gate separately without skips.

The five-root regression passes all 138 tests, with zero failures or skips.
It covers the support inventory, native CI isolation, test-profile registration,
checked JavaScript and documentation. Original TAP SHA256:
`23f9242ee7d8c3623017df4a971b7be2cd1d55897e9bbe6321471c924ca67e50`.
Full lint, checked-JavaScript type checking and all sixteen contract-backed
reference checks pass.

The resource guard stopped the first static-check sequence after lint, before
type checking started, because host load stayed at or above six for five
minutes. The remaining commands ran after load fell below six. The successful
lint result and the interrupted attempt remain separate from that resumed run;
no resource floor was relaxed. All nineteen source and ledger files stayed
unchanged throughout the final validation phases.
