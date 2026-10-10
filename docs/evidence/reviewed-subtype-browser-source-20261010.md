# Reviewed Subtype browser harness

The opt-in browser gate consumes the same independently reviewed twelve-export
package as the installed npm and strict TypeScript test. It runs after both
author roots and their build outputs have been removed. Each browser profile
installs the archives offline with no compiler on its search path.

The page, React and dedicated-worker callers execute the original public/raw
corpus: 2,036 checks and 2,024 rejections. Chromium, Firefox and WebKit run
twelve engine/build combinations, including React production and strict mode.
The shared browser harness checks 51 lifecycle observations, missing-Wasm
failure and recovery, module reuse, worker shutdown/restart, React remounts
and pending unmounts. Bundling precedes removal of installed sources; browsers
receive only static deployments and cannot request external network resources.

Original caller files, package locks, installed declarations, Binding IR,
component/runtime manifests and runtime identity are retained. Original phase
observations survive failure. The runtime manifest binds the installed main
Wasm hash to the content-addressed runtime package version. The existing npm
report format remains unchanged. This source milestone does not claim actual
installed browser acceptance or add support observations.

## Checks

The seven-root regression passed 660 tests with zero failures and seven
explicit compiler/installed gates in 150.25 seconds:
`build/vo1444-browser-source-registered-r1.tap`, SHA-256
`c5a5708021196d0a3fc92136c7796f80049a99ff689781d8ad9d8accf2d35f5f`.
Full lint, checked JavaScript and all sixteen generated-reference checks
passed. After adding runtime-manifest retention, focused lint and all seven
browser/history controls passed again:
`build/vo1444-browser-source-focused-r2.tap`, SHA-256
`0580b502838f1f2007c8eec2d0a866880b3a98e752cbbef03b601c1e44ee2a77`.

The independent audit verifies seven exact source transitions and sixteen
source-pin refreshes. All 419 evidence entries, 518 observations and 5,905
older evidence files retain their claims and original bytes. Audit
`build/vo1444-browser-source-audit-r1.json`, SHA-256
`5a6ccad28502a798bd56ae8c5d35cce11c1afebe9276d8c56638d0f7a7f84392`.
Ledger SHA-256:
`2f17e2c885f7d82a38f1b5fa993b830d8d08e08a1693005ffbd59dff2ff6ea66`.

Actual launch preflights passed for Chromium 151.0.7922.34, Firefox 153.0
and WebKit 26.5 using the existing local Playwright cache. No download was
needed. These launches do not execute the Lean package. Original preflight:
`build/vo1444-browser-preflight-r1.jsonl`, SHA-256
`7f58be1abaa0fc1d637a37b132494d01b3f6b7e71a2a40408c00689de942634e`.

Next: freeze this source, execute both package builds and every browser
profile, independently check and archive the original results, then require
the browser gate in CI and update the exact supported cells. Nested,
nominal, callback and remaining generic Subtype requirements stay open.
