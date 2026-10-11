# Nix historical-comparison CI repair

Predecessor: `6f4aeaf349a0b696650e43a5aa677a1f073e869d`.

Downstream run `38136049235`, Python job `114460014983`, failed the test named "Nix Fin boundary refreshes exactly eighteen source pins without changing support or observations." The original job log is retained in `build/ci-python-114460014983.log`, SHA-256 `e2db94d0dba421d0e183662dcf83dc9d142c3d916736b085e712b29b40c77baa`.

The test restored the inventory to the Nix-boundary milestone but hashed the current `nix/perl-engine-source-boundary.json`. That file has since changed. The historical milestone's hash is `2331c6db30414124da602f36cd76e854abfb1c2eb2f97c25a972350932f1b48f`; the current file's hash is `332929858f4f615f5798fa8ef4a92210da71bbd392a1c897a6df817759683f36`. Comparing them caused the failure.

The repair restores the boundary file and inventory to the same milestone. It also checks both boundary hashes against the original ledger and compares both predecessor files with their original Git blobs. The test still requires exactly 18 pin changes, complete inventory equality after those changes, and unchanged observations. Missing Git history or unrelated source changes remain errors.

The focused failure reproduced locally with one failed test and no passes or skips. Original TAP: `build/vo1220-python-nix-boundary-baseline-r1.tap`, SHA-256 `013ea16791902b941a19842ddd1f424d3d4c04e07d02743364b235b643c10cf2`. The full affected root reproduced the same sole failure: 76 passed, one failed, seven explicit installed gates skipped. Original TAP: `build/vo1220-python-nix-root-baseline-r1.tap`, SHA-256 `e55e4d1555fd5b3eeb2bc9ee5ff81c074eb339a1619d6b962b53ffb9049464c3`.

This is a test-only repair. Production code, Nix configuration and the complete support inventory remain unchanged. The three exact test-source transitions have a new history ledger; earlier ledgers and receipts remain immutable. No installed Python acceptance or fresh hosted success is claimed by this repair.

## Validation

The repaired focused suite passed five tests without failures or skips. TAP SHA-256: `11aab3905d0df75db04fd0d03e571123d6806e63d8b310b83d8d472023f2df9b`.

The four-root regression covered native Fin records, checked records, the earlier diagnostic CI repair and the complete type inventory. It passed 255 tests with zero failures and 36 explicit compiler/installed gates skipped. TAP: `build/vo1220-python-nix-repair-regression-r1.tap`, SHA-256 `31058cdf2c1c31b5da7f061306294f182618c88d8eaa2497d0ad29f598690df8`. All 133 documentation checks passed without skips, SHA-256 `2ee237ec9411239741780f30e43ce9a76520821b95b0fd7dc4f8cc728abe8ddd`. Full lint, checked JavaScript and all 16 generated-reference checks passed.

Ledger SHA-256: `f765ce2d488de0688500311e8d305d654ed138cef407be67f6efb062c41aa23e`. An independent audit restored all three source transitions to the exact predecessor, verified the byte-identical inventory of 464 evidence claims and 555 observations, and matched all 9,334 earlier evidence files to their original Git blob identities.

## Adjacent browser acceptance

Before this repair, the ordinary checked-record package passed its actual installed acceptance at the predecessor revision. Original prefix: `build/vo1446-checked-browser-ordinary-source-r1-6f4aeaf`. TAP SHA-256: `fc2403cc843ef75fa3b4746f214161b06349a9f776191d8de2077701390ea210`. One test passed without failures or skips in 654 seconds. The original-report checker verified two Node executions with strict TypeScript and installed-directory relocation, plus 12 browser executions and 51 lifecycle observations across Chromium, Firefox and WebKit. Minimum free space was 9,951 MiB.

The reviewed package and both result-only routes still require execution. Archival, recurring CI and support-table promotion remain separate work under #1446. This note does not close #1220 or remove any remaining type combinations.
