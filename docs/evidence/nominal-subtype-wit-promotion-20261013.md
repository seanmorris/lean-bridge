# WIT nominal Subtype support

The [original installed archive](nominal-subtype-wit-20261013.md) verifies
ordinary-source and independently reviewed packages, each with a full API and
a standalone result-only API. Producer:
`9b39bd38db9165e95a948a6bbc8023409cc8b4ce`.

Each selection reproduced its complete archive from two author roots, installed
offline after deleting those roots, and ran the same compiled caller before
and after moving the installation. Caller compilation inputs were removed
before execution. Generated package sources remain installed.

The eight executions completed 54,240 checks, including 4,132 native/refinement
refusals, 68 host refusals and 120 snapshot controls. They exercised the actual
Component Model adapter with Wasmtime 42.0.1 and wasm-tools 1.245.1 on Linux
x64/glibc 2.36, using an explicit package floor of glibc 2.36. The adapter
requires its packaged native Lean host.

## Support changes

The inventory adds four original-evidence entries. It supplements WIT/WASI
input and result observations on both source routes, and adds one field
observation per route. Other profiles, shapes and positions retain their
previous support claims.

The table generator formats WIT Nat limb syntax as code. This also fixes two
older Fin conversion notes that the site parser treated as raw HTML, without
changing their recorded support claims. A rendered-page test checks the WIT
consumer guide, both author guides and the type reference.

The tested payloads are Nat Subtypes in acyclic records, variants, aliases and
nested copied containers. WIT uses exact little-endian `list<u32>` limbs,
including 100-bit values, without proof fields. Input sites retain distinct
checked constructors and normalization choices. Only active variant payloads
run their selected constructors. Rejection preserves caller inputs, and later
valid calls recover. Copied results require no input constructor selection.

Other primitive-base nominal fixtures, callbacks, owned values, recursive
graphs, dependent types and broader generic combinations have separate tasks.
These reports do not measure constructor/source-entry counts or memory, and
do not establish hosted glibc 2.38 acceptance. The retained archive includes
original text members, components and caller binaries; complete native archives
and libraries remain in the original build handoffs. Compiler and operating
system distributions remain trusted. The launcher did not capture its own
pre-launch digest, Node executable path or full ambient environment. Inventory
commands reconstruct the captured arguments and recorded tool/selection values.

## Recurring checks

The downstream consumer workflow requires all four nominal WIT selections in
its WIT/WASI job. It retains complete fresh or partial output trees and checks
zero-skip TAP, original package members, tools and installed/relocated reports.
Its gate cannot pass when a required step fails, is skipped or is cancelled.

Run the support and history tests with:

```sh
node --max-old-space-size=3072 --test --test-concurrency=1 \
  tests/helpers/nominal-subtype-wit-promotion-tests.mjs \
  tests/helpers/nominal-subtype-wit-promotion-history-tests.mjs
```

The history ledger records exact source transitions from
`c48bb1f5d4e5b7d62dd8497df2fcc43c0de83537`. Earlier evidence files and ledgers
remain unchanged. The original failed harness and disk-guard attempts remain
recorded as failures and contribute no accepted executions.
