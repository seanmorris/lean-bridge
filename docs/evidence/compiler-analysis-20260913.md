# Compiler-backed CLI analysis

VO1107 and VO1108 milestone, 2026-09-13.

## Implementation

`lean-bridge analyze` now captures source intent and runs the shared Lean metadata extractor inside the pinned engine. Its version-3 execution request authorizes a project-analysis report, not adapters or binaries. The version-2 public report retains fresh compiler types, documentation, source positions, theorem references, diagnostics and the complete invocation-bound elaboration record.

The host reconstructs the report from that metadata and checks the selected public roots, captured source hashes, interface identities, extractor hash, request, engine, backend and authorized output set. It verifies the source checkout and transported inputs again before returning. Unsupported meaning produces reviewable diagnostics; missing backends and extractor faults cannot select a source-scanner fallback.

Snapshot version 3 binds the absence of `lake-manifest.json` for a dependency-free project. Lake checks that no external dependencies require resolution. The engine never writes a fabricated lock into the source. Existing version-2 locked captures and configured generated entries use their established resolution and generator checks.

Explicit reviewed Binding IR remains valid without a compiler. Its report labels that origin and supplies no fresh compiler evidence. `requireCompiledExports` accepts fresh interfaces only; cached `.ilean` presence does not satisfy it. Resource and closure-arity configuration produces unsupported diagnostics in the public primitive profile rather than being silently ignored.

Cancellation waits for the subprocess to exit before deleting its workspace, with a five-second kill deadline. Owned staging is removed on completion, failure and cancellation. Author files, lockfiles and existing build caches remain unchanged in the acceptance cases.

## Checks

```sh
source scripts/env.sh
LEAN_BRIDGE_COMPILER_ANALYSIS_TEST=1 node --test tests/compiler-analysis.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test \
  --test-name-pattern='locked .* dependencies with default|captured entry metadata|captured APIs' \
  tests/lake-wasm.test.mjs
LEAN_BRIDGE_LAKE_WORKSPACE_TEST=1 \
LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl \
LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
  node --test --test-name-pattern='locked native builds' tests/lake-workspace.test.mjs
npm run lint
npm run typecheck
npm run test:contracts
npm run test:docs
npm run site:test
npm run site:typecheck
```

All 14 compiler-analysis checks pass using real Lean through an injected Nix-command transport. They cover lock-absent projects, two unrelated locked dependency trees with custom paths and aliases, byte-identical relocation, generated public entries, and a relocated CLI archive without a bundled Wasm runtime. Fault checks cover missing backends, unauthorized output, malformed output, symlinks, changed invocation and source identities, cancellation, unsupported effects and binders, and configured native shapes outside the primitive profile.

Fourteen focused Wasm checks pass, including installed relocated Shop and Telemetry packages, fresh target metadata mismatch, and ten unsupported selections. Five native checks pass, including both installed relocation cases, dependency drift during compilation, and unreviewed foreign implementation rejection. The local glibc override applies only to this host's native tests; the production minimum remains 2.38.

Nix is unavailable on this local host. Consumer CI is configured to exercise compiler-backed analysis through the tarball-installed CLI and the actual pinned Nix engine. Its acceptance runner now requires public report version 2, `lean-elaborated` origin, available compiler metadata and empty assurance arrays. The Lean-only CI job also runs the focused compiler-analysis suite. No package is uploaded by these local checks.

All 25 focused backend, engine-request, build-plan and input-transport checks pass. The Nix source list contains exactly the executable dependency graph; the host-only analysis launcher stays in the CLI package. Four selected checks also pass as `nobody`, including fresh compiler analysis and the relocated CLI archive.

The repository checks pass: 534 core contracts, 62 documentation checks, 111 site checks, 16 generated references, lint and checked JavaScript. The core profile skips 13 compiler-gated checks; those run separately with Lean. Site type checking and the production build succeed for 79 canonical documentation pages. The existing export-shape bookmark remains valid.

## Remaining work

Unlocked npm builds still use their existing source planner. The next cutover should send those projects through source-only build intent and fresh compiler metadata, preserving explicit reviewed Binding IR and existing target capability checks. Native CPAN still uses its existing metadata profile; shared native projection and finite specializations remain incomplete under VO1107 and VO1108.

No runtime type or profile coverage advances. Six existing source-evidence hashes are refreshed after the capture, native, Wasm and internal-planner checks. The inventory remains at 6,562 cells, 2,193 observed cells, 116 installed-tested cells and 32,230 required stage gaps. The theorem references in public analysis do not add artifact-bound assurance claims.
