# Nominal Rust Subtype harness registration

This milestone adds an independent Rust caller, crate and dependency inspectors,
and ordinary/reviewed full/result-only installed test selections. No compiled
Rust selection has run yet. The support inventory remains at 492 evidence entries
and 581 observations.

The caller inspects fields, variants, containers and BigUint limbs directly.
Generated equality and serialization do not determine expected results. It checks
per-use normalization, aliases, active variant branches, 100-bit values, exact
rejection paths, Fin-before-Subtype ordering and complete unchanged inputs.
Full selections include 1,000 rejection/recovery rounds; result-only selections
include 1,000 repeated wide record results. Eight snapshot controls supplement
each execution. The synthetic model deliberately supplies dishonest record
equality, and the caller detects all 46 injected result and diagnostic faults
across four selections. The model uses u128 for these bounded samples and makes
no arbitrary-width or installed-package claim.

The installed producer requires explicit native glibc selection and Rust 1.90
or newer. It builds the crate in two independent author roots and removes those
roots before installation. The consumer uses an empty private Cargo home, locked
vendored dependencies, offline Cargo and a link-only C driver. Thirteen executable
controls reject C compilation inputs. Cargo metadata must identify the exact
installed crate and all vendored dependency roots. A compiler probe checks all
13 checked-input exports and the input-only Pair type: present in the full
package, absent with E0432 in the result-only package.

The producer runs the same binary installed, after physical relocation, and after
removing the complete consumer source tree. It checks crate and dependency files
around compilation and execution, authenticating the baseline against the
original archive. It checks executable identity and normal-exit loader cleanup.
Original crate and dependency handoffs are retained in build/ before temporary
author roots are removed. No constructor/source entry counts or memory
measurements are claimed.

## Validation

- Registered regression: 207 passed, zero failures, 25 explicit compiler/installed
  skips. `build/vo1444-nominal-rust-registration-regression-r2.tap`, SHA-256
  `d7b900b9fc5704f44ab762f63f5346f7e6fba7b6fe37c351d5b4e9ac6066b4ed`.
- Focused Rust and preceding Ruby history checks: 13 passed, zero failures or
  skips. `build/vo1444-nominal-rust-registration-focused-r1.tap`, SHA-256
  `98366a7b1085ee19ec2ecc86afa5525f7564aa617e3d14964303a320121d19b7`.
- Frozen reconstruction includes all 20 transitive generator modules and the
  dependency lock resource. The original lock generator runs before cleanup.
- Full repository ESLint and repository typecheck passed.
- Contract-only checkouts without Rust skip the executable synthetic controls.
  An explicitly selected missing Rust compiler fails. Installed acceptance
  requires its separate explicit test gate.

The immutable registration ledger records three exact transitions from
`587142a6387b908cd1209a8022d1d25e1766d771`, without changing existing evidence
or support claims. Ledger SHA-256:
`c21df1ded3d7a068f4ff4bff2ed78af5efee0c638e7dd6dfa9c401b59da297e5`.
An independent audit reverses those transitions against Git and verifies the
unchanged inventory. `build/vo1444-nominal-rust-registration-audit-r1.json`,
SHA-256 `b94317b9f26d7830b7e3a00fed09415ac19cd7cfe0715da59d0d94233f79d9e8`.

Four real compiled selections, archived original records with independent
corruption controls, documentation and required recurring CI remain for Rust
acceptance. The broader requirements of #1444 and #1220 remain open.
