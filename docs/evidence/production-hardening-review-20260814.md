# Production-hardening review, 14 August 2026

This review reconciles the implemented proof of concept with the eight permanent architecture lenses. It records automated evidence at revision `fdd33f73de7c488f1f14e7b62e51c515d54111a4`. It does not grant production approval.

## Executed evidence

| Workflow | Result | Scope |
|---|---|---|
| [Downstream consumer contract](https://github.com/seanmorris/lean-bridge/actions/runs/31795459610) | Passed | Documentation, Node JavaScript and TypeScript, browser npm, native PHP, PHP-Wasm, Python, Rust, C, C++, .NET, JVM, Ruby, WIT/WASI, Docker, and the complete consumer summary. |
| [Reproducible release authorization](https://github.com/seanmorris/lean-bridge/actions/runs/31795459607) | Passed | Two isolated clean builds, complete byte and mode comparison, release authorization, artifact upload, and independent authorization verification in a second job. |
| [Complete performance evidence](https://github.com/seanmorris/lean-bridge/actions/runs/31795454820) | Passed | Locked workload graph, startup and composition, 1/3/10/50-library scaling, generated-call overhead, lifecycle and memory, clean-build reproducibility, and aggregate reporting. |
| `npm run test:docs` | 10 of 10 passed | Local links, support contract, public examples, package evidence, consumer result evaluation, directory explainers, and CI coverage. |
| `npm run lint` | Passed with zero warnings | Repository JavaScript and TypeScript style and documentation contract. |
| `npm run typecheck` | Passed | JavaScript project analysis through the checked TypeScript configuration. |

The [consumer support contract](../consumer-support.v1.json) remains the authority for supported targets. The [implementation status](../status.md) records the current platform limits. Raw measurement and package records remain under this evidence index.

## Eight-lens result

| Lens | POC result | Production consequence |
|---|---|---|
| One shared Lean runtime | Pass | Node, browser, PHP transports, native consumers, managed runtimes, and WIT/WASI execute independently built components against the declared shared-runtime identity. [Runtime evidence](lean-runtime-link-spike.md), [native consumer evidence](native-consumer-acceptance.md), and [managed consumer evidence](managed-consumer-acceptance.md) record the paths. |
| Generated native public APIs | Pass for the declared export surface | Public-surface and semantic-parity gates reject private dispatch, pointers, handles, transport objects, and public `any`. Broader Lean declaration shapes still require reviewed adapters. [Direct-call conformance](direct-call-conformance.md) and [semantic parity](cross-language-semantic-parity.md) define the tested surface. |
| Assurance and artifact identity | Partial | Packages retain source, Binding IR, assurance, graph, toolchain, and artifact identities. The analyzer still records theorem references as unverified candidates, and no independent assurance reviewer has accepted the complete shipped chain. [Canonical manifest evidence](canonical-package-manifest.md) records the current identity boundary. |
| Reproducibility | Pass inside project CI | Two clean builds produce an authorized byte-identical inventory, and a second job rechecks the authorization. Production approval still requires an independent confirmation produced outside this repository's workflow and administration boundary. [Reproducibility evidence](reproducibility-release-gate.md) defines that path. |
| Host-neutral core | Pass for supported profiles | One Binding IR drives JavaScript, PHP, Python, Rust, C, C++, .NET, JVM, Ruby, and WIT projections. Native package support currently covers x86-64 Linux with the documented runtime constraints. |
| AI-native verified reuse metadata | Partial by design | Canonical semantic, assurance, provenance, compatibility, and artifact identities are retained. Component search and selection tooling remains deferred and is not part of the supported product surface. |
| Accessible adoption | Blocked for production | The automated clean-room role passed. Real Lean-author, JavaScript-consumer, and Python-consumer sessions remain pending. [The clean-room protocol](clean-room-usability-protocol.md) forbids agent-synthesized human results. |
| Universal composition | Pass inside current fixtures | Startup, lazy, final-static, native, managed, browser, and WIT/WASI paths use reviewed package and graph identities. Production approval still requires the external reconstruction above and an explicit supported deployment profile. |

## Risk, patch, and decision reconciliation

The [risk register](../architecture/risks.md) now records observed POC state and remaining production action instead of pre-implementation likelihood guesses. Controlled risks remain open to regression and stay covered by executable gates.

The pinned Lean 4.32.2 toolchain still applies two Emscripten runtime patches and one offline libuv source patch. The [patch policy](../architecture/patches.md) identifies each patch and its removal condition. This review found no additional source patch requirement.

ADRs 15, 20, and 22 now record the implemented WIT/WASI projection, the C++ backend, and completed compile-once package evidence. These updates do not change the shared-runtime, Binding IR, or compiler-free packaging decisions.

## Production decision

Production approval remains withheld. The following evidence or authority is still required:

1. Passing clean-room sessions from a real Lean author, JavaScript consumer, and Python consumer.
2. An independent release reconstruction and confirmation produced outside this repository's workflow boundary.
3. A reviewed production deployment profile that states supported operating systems, architectures, runtimes, and excluded capabilities.
4. An operated registry adapter, credential boundary, and signer policy before any live registry write.
5. Human review of the assurance chain, trusted boundaries, remaining risks, and this production decision.

The repository may continue architecture testing, local package rehearsal, and clean consumer CI. It does not claim production stability or authorize live publication.
