# Perl CI needs the historical source commits

At `841c06b8b1a26665e4f9d714e5f4c3347ba94117`, downstream job `114521820769` failed in `tests/helpers/perl-container-subtype-ci-history-tests.mjs`. Its depth-1 checkout did not contain the earlier source commit `ccc372392997ea0de2ef72a1b29474df96e3af39`. The test could not authenticate the original `tests/helpers/fin-refinement-source-history.mjs` bytes.

This was a checkout failure, not a Perl conversion failure. The original job log is retained at `build/ci-841c06b-perl-threaded-114521820769.log`, SHA256 `e458a5942e0d15eb8f6da178d1ef042879dc5a227675e2caa57ee7e72e3b20ff`.

## Local reproduction

The exact failing history test ran against a real depth-1 clone of `841c06b`, with no source changes. It failed with the same missing historical file. After `git fetch --unshallow origin`, the unchanged checkout and test passed. HEAD remained `841c06b` throughout.

- Failure TAP: `build/vo1444-perl-shallow-before-r1.tap`, SHA256 `09eff9ead8f8c6e33f89769242f1b0219dba04dd15fcba1edb10ff927ec28e0e`.
- Successful TAP: `build/vo1444-perl-shallow-after-r1.tap`, SHA256 `3a13195ec1c4ed6ccdbc350a3c9dd68b01a76b239c8ea36bb1b0a90cb2f0f16d`.

The temporary clone was removed after verification, reclaiming about 1 GiB. The original logs remain in `build/`.

## Repair

The `perl` matrix job in `.github/workflows/perl-consumer.yml` now uses `fetch-depth: 0` and checks that the checkout is not shallow before installing Node or building any of the four Perl ABIs. Existing runtime, package, proof, artifact and summary gates remain intact.

Two registered regression tests require the full-history checkout and early check, and reject missing, shallow or bypassed versions. Historical workflow comparisons reverse only this authenticated repair before checking the older workflow; separate tests check the live workflow.

The repair's immutable ledger records seven exact source transitions from `459fa8eaf0547d4f2cba488dbb135bb6adfc72f5` and refreshes 13 current-source pins. It changes no installed-support claim or observation. Production compilers and host adapters are unchanged.

The focused Perl, workflow and source-history regression passed all 68 tests without skips. The inventory suite passed 64 tests, and the documentation suite passed 133 tests, also without skips. Full ESLint, checked JavaScript types, workflow actionlint, the preflight's shell syntax and all 16 generated reference pages passed. ShellCheck and Pyflakes were not run.

- Focused regression TAP: `build/vo1444-perl-history-checkout-regression-r1.tap`, SHA256 `ab26d51f8e9a02dbf973cef3f6f1ce6657528357f173e0c4c786be6944f14145`.
- Inventory TAP: `build/vo1444-perl-history-checkout-inventory-r1.tap`, SHA256 `3d6a87a5028ca4314adc01d992d436dfd013925e50b8604c98b548c4997c04a7`.
- Documentation TAP: `build/vo1444-perl-history-checkout-docs-r1.tap`, SHA256 `c6280bbef1a1cffed7b822bdd010fe75ea8b9fff7cbda97d2e7acea9076bd006`.

The independent source audit preserves all 10,009 older evidence files and all 472 evidence entries and 571 observations. Hosted confirmation requires a run containing this repair.
