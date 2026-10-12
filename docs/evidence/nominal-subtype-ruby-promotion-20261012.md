# Installed nominal Ruby support and recurring CI

Predecessor: `e5020a56b2750c42160567ca931d24772679e6e7`.

This milestone adds the [four installed Ruby selections](nominal-subtype-ruby-acceptance-20261012.md)
to the support inventory, consumer guide, author guides and generated reference.
The selections use the frozen producer
`d829cd1533907b9bf1f4a60a00e63c918655b2c7` and MRI Ruby 3.3.12 on
Linux x64/glibc 2.36 with an explicit 2.36 package floor.

Four installations and eight executions passed 25,192 checks and 4,128 expected
rejections. Each selection reproduced its gem from two independent author roots,
removed the author sources, installed offline and replayed the unchanged caller
after physically moving the installed tree. The archive and original gem
handoffs remain unchanged.

## Support inventory

The inventory contains 492 evidence entries and 581 observations. Four new
Ruby evidence entries add ordinary-source and reviewed field observations and
supplement the four existing parameter/result cells. Earlier entries retain
their claims and records; 232 current-source pins track exact checked changes.

The promoted scope covers the tested Nat Subtype acyclic records and variants,
aliases, structural containers, mixed Fin and constructor-free copied results.
Consumers pass Ruby `Integer` payloads in generated frozen classes. The selected
Lean constructors can normalize inputs, and each input site retains its own
choice. Copied results project existing values without input constructor calls.

Other primitive-base nominal fixtures, remaining host contexts, refined
callbacks, owned, recursive, dependent and broader generic Subtypes remain
pending. Constructor/source entry counts and memory remain unmeasured.

## Required CI

The existing Ruby managed-consumer job now requires all four route/API
selections after its earlier corpus checks. The 45-minute step selects the
installed MRI Ruby 3.3.12 and gem executables explicitly. Its shell runner
selects the hosted package floor 2.38, refuses ambient floor overrides and stale
output, and executes selections serially.

Each selection must produce a complete one-test TAP result with zero failures
or skips. The checker measures the actual interpreter and glibc version, then
checks the original compiler models, package bytes, installed closure and
relocated execution. Failure preserves the TAP and partial records. An always-run
artifact step uploads the entire output directory with 30-day retention.
Earlier jobs, budgets and summary dependencies remain unchanged.

The workflow, report and shell tests exercise 25 weakened-workflow controls,
148 incomplete or substituted TAP controls, 56 record/producer/runtime controls,
nine real-shell success/failure scenarios, nine stale-output refusals and eight
invalid argument/override cases. Shell controls use stand-ins, not compiled
package executions. The new hosted gate has not yet run.

## Verification

The focused promotion, CI and history regression passed 22 tests without
failures or skips. TAP: `build/vo1444-nominal-ruby-promotion-focused-r1.tap`,
SHA-256 `f956de3bd60ba0004000ae93771cc9187638e942c1d6057b7fce7136de0d0ea6`.

An independent audit verifies all 24 exact source transitions, the 232 pin
updates and the six changed Ruby cells. It compares every archived original
with its committed Git blob and preserves all earlier tracked evidence.
Audit SHA-256:
`03cd92b489ad834076de9d0ab342a85b8154bc24f9f0edd140a81e663ca5fbb1`.
[Source history](nominal-subtype-ruby-promotion-source-history-20261012.json)
SHA-256: `196864d8d7eccdc137153d690e92035b650dc622b38d4712c184e79e9f0d224d`.

The seven-root registered regression passed 262 tests with no failures and
21 explicit compiler/installed skips. It covers component refinements, checked
JavaScript, test registration, reference documentation, the support inventory,
conversion tables and consumer guides. TAP:
`build/vo1444-nominal-ruby-promotion-regression-r1.tap`, SHA-256
`58dd1caf93f765ef970d0776bc7fcc13e573bfb14eb44d39972f5fbd2e51e73c`.

Full-repository ESLint, JavaScript typechecking, shell syntax and all 16
generated-reference checks passed. The generated conversion tables and
reference pages match the updated inventory.

VO #1444 and #1220 remain open. Rust, C#, Java, Kotlin, native PHP and WIT/WASI
nominal acceptance and the original remaining refinement requirements continue
after this milestone.
