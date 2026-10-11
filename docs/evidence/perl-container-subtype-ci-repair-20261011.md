# Perl container Subtype CI assertion repair

Predecessor: `ccc372392997ea0de2ef72a1b29474df96e3af39`.

Downstream run `38136049235` failed the same source assertion in Perl 5.38.2-unthreaded job `114460015361` and Perl 5.36.3-threaded job `114460015390`. Both logs show their ordinary and reviewed installed Fin-container tests passing before `tests/perl-fin-containers.test.mjs:119` expected array-contained Subtypes to be rejected.

Structural Subtypes are now implemented. The old rejection assertion contradicts the generated code and the installed structural acceptance already recorded under #1444. The replacement checks the array walk, each element's retained reference, the selected leaf validator, its indexed error message, and validation before guarded source dispatch. It checks the matching C header and generated Lean constructor call, and rejects a substituted whole-array validator name. Existing Fin-bound ordering, unboxed scalar constructor and dispatch-prototype assertions remain.

No production generator, compiler admission, installed caller or support-inventory change is included. The repair records three exact test-source transitions and preserves earlier receipts and ledgers.

## Original failures

- `build/ci-job-114460015361.log`: SHA-256 `42c22bec3aedf4fea136df144d93f038de6c140f8454e1270cba38d69c468e0a`.
- `build/ci-job-114460015390.log`: SHA-256 `852de7a66f0f0bb30a9d0c41377c44f96f1616ff15d26dbd1ffd1bfead00eb76`.
- Local reproduction `build/vo1444-perl-container-baseline-r1.tap`: two passed, one failed, no skips; SHA-256 `4768667665f68b3dbdd5654ea303a7ed55091a3049bd9e786364f012cb46b086`.

Scratch candidate attempts 1 and 2 used an incorrect space in the expected C pointer declaration. The actual generated signature is `uint8_t lb_odd_refinement_1_0(lean_object * value);`. Those failed logs remain separate from the passing candidate and repository tests.

The WIT and Rust hosted failures are the Nix historical-comparison defect repaired separately in `ccc3723`. Original logs remain in `build/ci-job-114460015016.log` (SHA-256 `3c3d40925427049c69c34781f8f1ef9ab43d9f28eed6dd14ca47ba1605a58dfe`) and `build/ci-rust-114460014930.log` (SHA-256 `610215fca838bc2475eb93538bfb7ee10e7123ffb90f38981f675826430c76d8`). Fresh hosted confirmation remains required.

## Validation

The repaired focused suite passed five tests without failures or skips, TAP SHA-256 `f2e0b29dbb6b3e56e7ee63139b77427b62223a4602b297b01f9d42ad1d9a83f8`. The eight-root regression passed 108 tests with zero failures and four explicit installed gates skipped. TAP: `build/vo1444-perl-container-ci-regression-r1.tap`, SHA-256 `12f35126777c3763bb7f15b7028839e1a52d4f193be8548f68509bc614f081e4`. All 133 documentation tests passed without skips, SHA-256 `e1cd957b59606bc07656945c895f5e8438b62fb72fc5fb62fcd3db171c2f685f`. Full lint, checked JavaScript and all 16 generated-reference checks passed.

The ledger (`049286ea7b25874dc52ef785954c51b9b6f0e702a0a8691441a0a14d33b2b9a9`) authenticates three exact transitions. An independent audit restores each changed file to the Git predecessor, verifies the byte-identical inventory of 464 evidence claims and 555 observations, and checks all 9,336 earlier evidence files against their original Git blob identities.

## Browser acceptance alongside this repair

The reviewed full and ordinary result-only packages both passed their actual browser runs at the predecessor revision. Reviewed TAP SHA-256: `c68ada9d98e6d23f22612092139097b02cb4646767d9528a77cda2d6fc0e5939`. Ordinary result-only TAP SHA-256: `0e639773e2efd7caaa5854bb5da68f2b9e33a41be6d0827109dd3311b0163845`. Each ran two Node executions with strict TypeScript and installed-directory relocation, plus 12 browser executions and 51 lifecycle observations. The result-only corpus performs 2,011 checks and 1,002 calls per observation, including exact wide integers and the absence of checked-input exports.

All three completed routes passed 241 original-record negative controls each: 74 missing records, 34 npm/compiler/caller substitutions and 133 browser/package/lifecycle substitutions. The final reviewed result-only route remains next. These local results do not establish hosted acceptance, dispatch counts, broader type combinations or support-inventory promotion.
