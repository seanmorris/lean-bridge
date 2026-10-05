# Compiled npm aliases, 21 September 2026

Concrete copied aliases retain their qualified source names, target types and
chains in compiler metadata and Binding IR. Both `abbrev` and type-valued `def`
declarations are supported. Return-only aliases retain the same identities as
aliases in parameters and copied fields. Independently reviewed contracts must
match each target and reference; equivalent primitive representations do not
authorize renaming an alias or removing a link in its chain.

Private ABI 7 uses typed Lean helpers and transparent target codecs. Aliases add
no wire tag or host value wrapper. TypeScript exports named type aliases.
JavaScript callers pass ordinary target values. Aliases preserve the target's
validation, copied ownership and allocation limits: 32 descriptor levels, 4,096
descriptor nodes and a 16 MiB shared input/result budget. An over-depth alias
cannot fall back to scalar extraction.

The [installed package record](npm-aliases-20260921.json) covers 28 aliases over
all nineteen primitives in parameters, results and record fields, chains,
records, tagged variants and nested arrays, Lists, options, results and products.
Both source paths install their original
archives offline after producer relocation, with compilers absent from the
consumer PATH. Each JavaScript context passes 3,613 checks and 44 rejection cases
with recovery. Node, strict TypeScript, Chromium, Firefox and WebKit execute the
public API, including React and workers.

Checks include 5,121-bit integers, IEEE endpoints, Unicode/NUL, Unit versus absent
fields, independent returned buffers and objects, getters, malformed branches,
sparse sequences and repeated input/result budget failures. Typed defaults are
annotated with the alias target, so ordinary type-valued `def` aliases do not
require new numeral instances.

```sh
PLAYWRIGHT_BROWSERS_PATH=/app/.toolchains/playwright \
LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit \
node --test tests/component-aliases.test.mjs
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 \
node --test tests/compiler-alias-metadata.test.mjs
```

Native model and C conversion planning retain names in Binding IR while using
the checked target representation for private conversion helpers. Native metadata
validation rejects representation drift and identity-bearing alias targets.
The native probe compiles typed Lean adapters and checks their prototypes against
Lean-emitted C, together with the generated C conversion source.
Native language declarations and installed acceptance remain separate work;
this record promotes only the five npm profiles. Generic aliases, bounded
recursive values, compound callables and explicitly owned identity aggregates
remain in VO1219 and its related work.

Existing installed compound harnesses now use an independently specified
`Compounds.Deep` alias to match the source. Historical receipts retain their
original source and archive hashes. The evidence checks reconstruct the one
changed fixture import in five harnesses and verify every other byte against
the original hash. Separate rejection tests cover extra edits, duplicate
imports and changes outside the five named harnesses.

Validation: the full contract suite passes 1,535 tests with 65 explicitly gated
integration skips. All 34 compiler-analysis and metadata tests pass with their
compiler gates enabled, as do the three alias-metadata checks. The existing npm
compound suite passes its three installed checks. Documentation passes 76 tests;
the site passes 111. Lint, repository and site type checks, generated-reference
checks and the production site build pass. All 55 historical nonempty archive
inventories are unchanged. Inventory 0.45.0 adds 30 installed alias cells across
the five npm profiles, reaching 3,708 of 6,562 cells.
