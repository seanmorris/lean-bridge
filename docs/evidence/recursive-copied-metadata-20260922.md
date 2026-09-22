# Compiler-authenticated recursive type graphs

VO 1219, 2026-09-22. Lean extraction and semantic lowering now support finite
nominal graphs. This does not establish installed recursive package support.
Native graph adapters and npm recursive adapters remain gated until their
bounded conversions and cleanup are implemented.

## Extraction and validation

[`NativeExports.lean`](../../src/analyze/NativeExports.lean) collects each nominal
definition once. Recursive edges retain the checked Lean name and native
representation. Arrays, Lists, Option, Except, products, aliases, records and
variants retain their distinct meanings. Except's IR arguments remain
`[success, error]`.

Small acyclic types retain the existing inline metadata format. Bounded expansion
falls back to a graph for recursion, long nominal chains or heavily shared type
definitions. Each graph includes only definitions reachable from its root.
The extractor never chooses a constructor to manufacture a default value.

The closed wrapper has `kind: "graph"`, `root` and `types`. References have
`kind: "reference"` and a nominal `name`. Native reports also retain Lean names,
constructor/projection identities and compiler-owned ABI facts. Component
reports omit those native details. The existing report version and profiles
remain unchanged.

[`copied-metadata-graph.mjs`](../../src/analyze/copied-metadata-graph.mjs) validates
the finite table before either profile lowers it. References must resolve within
the graph; native reference representations must equal their definitions, and
the wrapper representation must equal its root. Definitions are limited to
copied aliases, records and variants. Inline nominal definitions inside a graph,
nested graph wrappers, identity-bearing payloads, alias-only cycles, duplicate
names, sparse tables and descriptor accessors reject.

Limits are 32 inline schema edges, 1,024 nominal definitions and 4,096 descriptor
nodes. Fields and constructors count toward the node budget. Nominal references
do not unfold to validate a graph. The extractor also bounds its traversal and
optional inline expansion.

Semantic lowering compares nominal definitions by their immediate edges. A type
can appear inline in one export and in a graph in another without changing its
identity. Conflicting nested definitions still reject. Reviewed-source
reconciliation checks recursive edges, constructor order, fields and container
identity against fresh Lean facts.

## Checks

The [compiler metadata suite](../../tests/compiler-variant-metadata.test.mjs)
covers both native and component reports and their JSON schemas. The
[Lean fixture](../../tests/fixtures/structured-types/Recursive.lean) exercises:

- A recursive-first Tree with all nineteen primitive types in its leaf record.
- Mutually recursive variants, including recursion through Array and List.
- Record wrappers, named aliases, nested Option and Except/product payloads.
- A recursive type with no finite inhabitant.
- Generated 48-alias chains and a 17-definition shared record graph whose
  expanded tree would contain over 100,000 record occurrences.

An independently written reviewed contract checks mutual recursion. Changed
recursive targets, constructor order, field names and Array/List substitutions
reject. Synthetic contract checks cover 1,000 aliases, exact inline-depth and
4,096-node limits, malformed/duplicate/unknown definitions, native ABI drift,
alias cycles, JavaScript descriptor cycles and accessors that must not execute.

Run the fresh compiler checks and existing metadata regressions:

```sh
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 node --test --test-concurrency=1 \
  tests/compiler-variant-metadata.test.mjs \
  tests/compiler-alias-metadata.test.mjs \
  tests/elaborated-metadata.test.mjs
```

The CLI package and both Nix engine source lists include the new validator and
its graph dependencies. Historical installed receipts and the consumer coverage
inventory's support claims are unchanged. The [source lineage](recursive-copied-metadata-20260922.json)
retains the old npm alias receipt and the exact previous/current compiler-test
digests. That test now requires all 34 aliases beyond the old inline limit to
survive in a graph; it still checks every original installed caller and archive.

Fresh compiler and metadata regressions pass all 31 checks. The existing npm
alias suite also passes from ordinary source and reviewed IR in Node, executed
strict TypeScript, and Chromium page, React and worker consumers. Full contracts
pass 1,781 tests with 68 explicit opt-in skips; docs pass 78 and site tests pass
111. Lint, root/site typechecks and the production site build pass.

Next are typed Lean carriers, bounded native conversion and ownership-aware
cleanup, then installed-package acceptance across all consumer targets.
