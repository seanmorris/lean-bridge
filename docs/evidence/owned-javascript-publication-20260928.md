# Owned npm publication

VO 1219. The owned npm release route uses the existing reproducibility gate,
signed publication transaction and standalone archive verifier. It retains its
own compiled ownership model and package-set receipt.

The gate clones a committed author repository twice and compiles both copies.
It compares the complete release inventory, including both npm archives, then
reconstructs the generated package bytes from verified compiler metadata.
The retained build plan binds the source, engine, model and package identities.
The SBOM, compiler assurance and provenance are regenerated during verification.
An undeclared license or missing license terms prevent publication.

The enabled acceptance uses ordinary source and an independently authored
schema-4 review. Each path signs a local transaction, checks missing-runtime
rejection, resumes without a second write, verifies the archive with a separately
trusted signer policy, and installs offline after producer removal. Eight
mutations per path exercise package metadata, extra files, all four evidence
documents, signer policy and archive bytes. A separate unlicensed compiled
package must be rejected. Registry calls use an in-memory adapter; no external
registry receives a write. The reviewed build injects the Nix transport and
does not establish actual Nix or Docker isolation.

The milestone also updates the stale analysis-schema assertion found in CI.
It now requires both copied and owned Binding IR and retains the requirement
that owned IR comes from compiler elaboration. The schema itself is unchanged.

Prior receipts remain unchanged. The successor receipt authenticates exact
source transitions and execution logs without promoting type-surface cells.
Actual isolated installed acceptance, WIT/WASI ownership, transferred inputs,
anchored borrowed results and final cross-language acceptance remain open.
