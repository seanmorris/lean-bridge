# Historical synthesis: from research to installed software

Lean Bridge combines four records that software distribution usually keeps separate:

```text
semantic evidence       What does this component guarantee?
typed composition       Can these components connect correctly?
artifact provenance     Which binary came from which inputs?
ordinary packaging      Can an application developer use it directly?
```

The result is proof-aware package management. The theorem, assumptions, generated host API, dependency graph, toolchain, and artifact hashes remain connected as one component moves from Lean source into npm, PyPI, Cargo, Nix, C, or C++ distribution.

## Earlier work supplied the layers

[Proof-carrying code](https://doi.org/10.1145/263699.263712) described untrusted executable code accompanied by a proof that a receiving system could validate against a safety policy. George Necula's POPL paper appeared in 1997. Classical proof-carrying code puts a checkable certificate close to low-level code and makes the receiver responsible for validating it.

The [WebAssembly Component Model](https://github.com/WebAssembly/component-model) defines typed imports, exports, interfaces, worlds, and package names through WIT. Its type system supports language-independent binding generation and checks whether imports and exports compose. WIT describes interface shape. It does not ordinarily establish behavioral properties such as sorting stability, invariant preservation, or complexity.

[SLSA provenance](https://slsa.dev/spec/v1.2/provenance) records the builder, invocation, inputs, and outputs of a build. [in-toto](https://in-toto.io/) provides a framework for software supply-chain integrity. [Reproducible Builds](https://reproducible-builds.org/docs/definition/) defines a build process that produces bit-for-bit identical output from the same source, environment, and instructions. These systems answer origin and reconstruction questions. Behavioral correctness requires another record.

Large verification projects show what strong semantic evidence can establish. [CompCert](https://compcert.org/man/manual001.html) proves semantic preservation for its verified compilation passes. [seL4](https://sel4.systems/Verification/proofs.html) publishes machine-checked functional-correctness and security results, with binary correctness on supported configurations. [Project Everest](https://project-everest.github.io/) produced verified cryptographic and communication software that entered systems including Linux, Firefox, Python, Windows, and Hyper-V.

Lean Bridge focuses on distribution and composition around that evidence. A theorem becomes more useful to application teams when a normal package carries it into a normal dependency graph.

## Current position relative to proof-carrying code

The current POC does not attach a low-level safety certificate that a browser validates before executing machine code. It connects Lean theorem provenance, declared assumptions, generated-wrapper contracts, exact toolchain inputs, graph locks, and artifact hashes.

That identity chain can support proof-carrying components later. A verifier could check a component's semantic certificate, interface compatibility, dependency assumptions, and artifact identity before authorizing it. The current work establishes the package, binding, runtime, and reproducibility substrate needed for that progression.

## Verified components become distributable units

Formal verification has often required a specialist team to build and integrate a specialized system. Package generation changes the unit delivered by that work.

A sequence package could expose:

```ts
import { stableSort } from "@verified/sequence";
```

Its machine-readable assurance record could state:

- the output is sorted;
- the output is a permutation of the input;
- equal elements preserve their input order;
- the proof applies under named assumptions;
- the generated binding preserves the relevant representation; and
- the release report identifies the exact artifact hash.

The consumer uses an ordinary function. The package documentation and tooling expose the proof when a developer, auditor, resolver, or agent needs it.

## Package resolution gains semantic constraints

Current package managers resolve names, versions, platforms, features, and dependency conflicts. A proof-aware resolver can also evaluate:

- whether a component establishes a required property;
- whether its assumptions fit the application policy;
- whether composition preserves those assumptions;
- whether an upgrade still proves the contracts required by dependants;
- whether a complexity claim applies to the selected implementation and target; and
- whether the theorem metadata identifies the artifact selected by the lock.

The semantic lock records exact code, proof dependencies, assumptions, toolchain, target, generated bindings, package graph, and artifacts. Semantic versioning remains useful for release coordination. Machine-readable contracts carry facts that three version integers cannot express.

The current capsule graph implements an early structural subset. It locks Lean and patch identities, target profiles, source and artifact hashes, dependencies, initialization order, and symbols. The resolver rejects drift and incompatible graphs before linking.

## Semantic provenance makes assurance boundaries visible

An SBOM lists components. Build provenance records how artifacts were produced. A proof bill of materials records which properties depend on which evidence and assumptions.

```text
application property
├── sorting theorem
│   ├── proved by package A
│   └── assumes a finite input
├── parser theorem
│   ├── proved by package B
│   └── trusts UTF-8 decoder C
├── trusts the Lean compiler
├── trusts the bridge generator
├── trusts the Wasm engine
└── identifies artifact hash 8f...
```

The `proved`, `trusted boundary`, and `unverified` states prevent a small verified core from silently extending its label over a larger unverified application. They also support targeted impact analysis. A compiler, runtime, host API, theorem, or dependency change identifies the assurance claims that depend on it.

## Agents can compose before generating

A component index can accept constraints instead of source-text keywords:

```text
stable topological sort
cycles returned as structured errors
deterministic ordering
O(V + E) complexity claim
browser Wasm target
single-threaded profile
compatible license and assumptions
```

An agent can select a component whose contract matches, compose its dependency and proof graphs, and generate only the remaining adapter or application logic.

```text
request
  ↓
required contract
  ↓
property-indexed search
  ↓
compatible component graph
  ↓
residual proof and implementation obligations
  ↓
generated application glue
```

The proof checker supplies a hard acceptance boundary once the intended contract has been formalized. Human review remains responsible for deciding whether the contract captures the real requirement and whether its trusted boundaries are acceptable.

## Assurance can accumulate across applications

Reusable packages let a theorem support more than one product. A verified algorithm can acquire JavaScript, Python, Rust, and C projections without recreating its mathematical core. Independent auditors can validate a shared evidence package instead of repeating the same source review for each integration.

This creates concrete work for contract authors, proof maintainers, assurance auditors, registry operators, build-attestation services, and language-backend maintainers. Funding can target proofs for widely used components whose evidence remains available to every dependant.

Procurement can request a narrower claim:

```text
For every input satisfying P, artifact H produces an output satisfying Q.
The claim assumes runtime R, compiler C, host behavior J, and primitive K.
```

That statement separates a proved property from tested behavior, trusted infrastructure, and deployment assumptions. It does not resolve incomplete requirements, unsafe configuration, incorrect operating procedures, or behavior outside the theorem.

## Producer and consumer languages can separate

A component has three identities:

- semantic identity, including its contract and theorem dependencies;
- implementation identity, including Lean source and compilation inputs; and
- consumer projection, including JavaScript, Python, Rust, C, C++, or WASI bindings.

The host-neutral binding IR and capsule format keep those identities connected without making them identical. Lean is the first producer target. A durable component format could later accept compatible evidence from Rocq, F*, Isabelle, Dafny, Agda, or another verification system.

The WebAssembly Component Model provides a typed interface foundation for the portable subset. Lean Bridge adds theorem identity, assumptions, ownership, reproducible closure, and host package projections around it.

## Tests and review move to the remaining uncertainty

Proofs reduce the value of repeatedly sampling a pure function's already-proved input space. Tests remain necessary for:

- whether the specification expresses the application's actual requirement;
- bridge representation and ownership;
- foreign APIs and host behavior;
- performance and resource limits;
- concurrency, scheduling, cancellation, and timing;
- browsers, operating systems, and hardware;
- user interfaces and accessibility;
- unverified dependencies and trusted assumptions; and
- deployment configuration.

Reviewers can focus on the theorem, its assumptions, the boundary mapping, the artifact identity chain, and the behavior outside the proof. Machines check derivations. Humans judge intent and system boundaries.

## The shared runtime makes the economics possible

A package ecosystem cannot afford a complete Lean runtime, heap, memory, initialization closure, and bridge kernel for every library. That structure would also split object identity and make direct library composition unsafe.

The POC loads three independently compiled Lean libraries into one runtime, one memory, one table, one initialization domain, and one ownership domain. One Lean object retains its identity while Alpha, Beta, and Gamma call across startup, lazy, and final-static profiles.

That result removes a fixed cost from every additional package. A verified component can become another library in an application instead of another isolated Wasm system.
