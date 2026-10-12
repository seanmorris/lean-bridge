# Installed nominal Rust support and recurring CI

Predecessor: `d2d819205189ceaaf80d7e2cc80901111c778de2`.

This milestone adds the [four installed Rust selections](nominal-subtype-rust-acceptance-20261012.md)
to the support inventory, consumer guide, author guides and generated reference.
The original producer is `5f3dd63b943efa9d5e49d2683da8ab2ebc7d2e59`.
It used Rust and Cargo 1.90.0 on Linux x64/glibc 2.36 with an explicit 2.36
package floor.

Four installations and twelve executions passed 37,788 checks, 6,192 expected
rejections and 96 independent snapshot controls. Each selection reproduced its
crate in two author directories, removed the author sources, installed offline,
replayed after moving the installed tree and ran again after deleting all
consumer sources. The archive and original handoffs remain unchanged.

## Support inventory

The inventory contains 496 evidence entries and 583 observations. Four new Rust
evidence entries add ordinary-source and reviewed field observations and
supplement the four existing parameter/result cells. Earlier entries retain
their claims and records. Exact source-history transitions record refreshed
current-source pins without changing historical receipts.

The tested Nat Subtype records and variants use generated Rust structs and
enums with `BigUint` payloads. Input functions borrow values and retain each
parameter's constructor selection. Constructors can normalize inputs; copied
results project existing Lean payloads without input constructor calls.

Other primitive-base nominal fixtures, remaining host contexts, refined
callbacks, owned, recursive, dependent and broader generic Subtypes remain
pending. Constructor/source entry counts and memory remain unmeasured.

## Required CI

The Rust native-consumer job requires all four route/API selections after its
earlier corpus checks. The 45-minute step bootstraps Rust and Cargo 1.90.0 and
passes their absolute paths to the runner. Selections run serially with one
Cargo job and one Lean thread. The runner requires the explicit hosted package
floor 2.38 and refuses ambient floor overrides or stale output.

Each selection must finish one installed test with no failures or skips. The
checker queries the actual host glibc, hashes the selected compiler binaries
and checks their exact versions. It checks the original compiler models,
generated crate files, Cargo resolution graph, offline installation environment,
link-only controls and all three execution stages.

The checker derives checksum-manifest supplements from the original dependency
archive after verifying every member. It does not edit producer records or
reopen recorded historical absolute paths. An always-run artifact step retains
the entire output directory, including partial failures, for 30 days. Earlier
jobs, budgets and summary dependencies remain unchanged.

The focused CI controls include 25 weakened-workflow cases, 148 incomplete or
substituted TAP cases, 88 record/producer/runtime/tool cases and 22 dependency
handoff cases. The real shell also passes nine success/failure scenarios, nine
stale-output refusals and eight invalid argument/override cases. Synthetic
archives and stand-in shell tools test failure handling, not compiled acceptance.

The new checker also verified all four original retained dependency handoffs
using the actual local compiler binaries. These checks use floor 2.36. The new
hosted floor-2.38 gate has not yet run.

## Verification

The final focused promotion, CI and history regression passed 31 tests without
failures or skips. Log: `build/vo1444-nominal-rust-promotion-focused-r2.log`,
SHA-256 `5cfdc7743d15038e56a3ffa209fe33e3c9eefd922a0396447b129f99a490b8a2`.

The seven-root registered regression passed 280 tests with no failures and
25 explicit compiler/installed skips. It covers component refinements, checked
JavaScript, test registration, references, the support inventory, conversion
tables and consumer guides. Log:
`build/vo1444-nominal-rust-promotion-registered-r2.log`, SHA-256
`6f32cb3ba7db9d080d378736a50b7412e1194d159db3ff1a789d1ad7002cd495`.

The initial regression found one stale copied-value expectation, which omitted
Rust's newly accepted nominal field. The correction adds Rust to that test's
nominal profile selection and requires the matching installed evidence IDs.
The original failing log remains at
`build/vo1444-nominal-rust-promotion-registered-r1.log`, SHA-256
`950c3887965adc226551df95e70bbca5fa9f8d1ca8109db7c993eb437d97864a`.

The [source history](nominal-subtype-rust-promotion-source-history-20261012.json)
records 27 exact predecessor transitions and 236 source-pin updates. Its
SHA-256 is `089ced924d008eab71521c684529383d4057c0ddd67ca98c1e1b8826eb41ccdb`.
Full-repository ESLint, checked JavaScript, shell syntax and all sixteen
generated-reference checks passed. The serial verification record is
`build/vo1444-nominal-rust-promotion-verification-r2.json`.

The independent audit checks all 27 transitions, all 236 refreshed pins and
exactly six changed Rust cells. It matches all 351 archived originals against
their committed Git blobs and verifies that earlier tracked evidence is
unchanged. Audit: `build/vo1444-nominal-rust-promotion-audit-r1.json`, SHA-256
`d520e5d77423fb3235904766b94b95511aeb716fa8f2fa6404a930f87c5ed774`.

VO #1444 and #1220 remain open. C#, Java, Kotlin, native PHP and WIT/WASI are the
five remaining native nominal profiles after Rust. Browser contexts, PHP-Wasm
and the remaining refinement requirements continue after this milestone.
