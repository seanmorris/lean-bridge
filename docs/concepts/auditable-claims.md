# Audit a correctness claim

Start with the behavior being claimed, then trace it to the implementation that runs. The demo's proof panel exposes the statement and source; its receipt and the site build identity identify the files delivered to the browser.

You do not need to accept a badge as the evidence. Each link below answers a different review question.

## Follow one claim

In [Dijkstra](dijkstra.md), the claim is that a returned route is a valid shortest path in the submitted weighted graph. The CSR theorem connects that statement to the implementation used by the adapter. It does not turn an empty result into a proved unreachability result.

| Review question | Inspect |
| --- | --- |
| What does the guarantee say? | The theorem statement and its assumptions in the proof panel. |
| Does it describe the exported implementation? | The implementation named by the theorem and the adapter's compiled call path. |
| Which source was checked? | The source files and hashes in `runtime/proof-audit.json`. |
| Which loader and binary reached the site? | File hashes and revision in the assembled `build-identity.json`. |
| Can I reproduce the check? | The demo's pinned build command and proof audit. |
| Does the application use the API correctly? | Adapter tests, boundary cases, and the real compiled-call tests. |

The [generated algorithm reference](../reference/algorithms.md) links these sources for all twelve demos. Its build rejects selected theorem names missing from a receipt and rejects changed Lean files whose hashes no longer match.

## Read the proof in either checker

The local proof viewer shows highlighted source and verifies it against the receipt. Its Lean WASM button opens a compiler-based checker; its playground button prepares the source for the separate Lean Web workflow. Both remain available.

Comparator compares a submitted solution with a supplied challenge. Read that challenge. A proof of a weakened statement can pass while failing to establish the claim you wanted to review. “No theorems to check” means the challenge supplies no useful comparison target.

The browser checker is an independent way to inspect the source. Normal algorithm calls run the compiled implementation; they do not re-run the proof on every input.

## Separate three records

A demo proof receipt records source hashes and required declarations after its proof build. The site identity records delivered file hashes and a repository revision. A signed package-release receipt additionally binds a publication decision to archive identities and a signer policy.

Matching a hash answers “are these the same bytes?” A trusted signature answers a separate question about who authorized those bytes. The [release workflow](../contributing/production-release.md#review-a-production-release) describes the latter check.

Ordinary-project analysis records discovered theorem relationships as `unverified`. A successful source analysis does not upgrade them to a demo's artifact-bound proof audit. See [the author assurance record](../lean/proofs-and-assurance.md).

## Record a review

Save the theorem and assumptions you reviewed, the source revision, the artifact hashes, the commands you ran, and the result. Link the adapter tests that establish your application's input model. Avoid recording only a screenshot of a successful checker.

Next, [check the integration](trust-boundaries.md) or [reproduce a demo build](../../demos/README.md#reproduce-a-demo).
