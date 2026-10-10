# Reviewed Subtype browser acceptance

Frozen producer `f07c86d23f75b9b07ae66f6e9c7101c47b29b58e` passed
two-root npm package reproduction, source-free offline installation, Node,
strict TypeScript and every browser selection. The original TAP records
one passing installed test, zero failures and zero skips in 364.53 seconds.
TAP SHA-256:
`54585691db38e20ecd2eaabe2b56ea449820ddf7db3a2e6ecd9c9e98eb1c51fe`.

| Consumer | Engine/build executions | Recorded lifecycle observations |
| --- | ---: | ---: |
| Browser page | 3 | 9 |
| React production and strict mode | 6 | 30 |
| Dedicated worker | 3 | 12 |

Chromium 151.0.7922.34, Firefox 153.0 and WebKit 26.5 each executed the
independent reviewed corpus. Every recorded phase completed 2,036 checks
and 2,024 rejections through public and raw installed APIs. The cases cover
twelve exports, distinct checked and normalizing constructors, generic
constructor choices, a result-only export, mixed Fin/Subtype arguments,
large integers, strings, byte arrays, late failures and repeated recovery.

The shared browser harness verified module reuse, missing-Wasm errors and
recovery, worker restart and termination, React remounts and pending
unmounts. Strict-mode counters were six effects, five cleanups, three
ignored results and three commits. Production counters were three effects,
two cleanups, zero ignored results and three commits. Workers ended with
two created, two terminated and none live.

Both author/build roots were deleted before installation. The bundler used
isolated offline installations. Only static deployments remained when
browsers ran, with external requests blocked. Served Wasm identities matched
the installed component and shared runtime. The installed runtime identity
binds its main Wasm hash to the package version. Original package manifests,
locks, callers, declarations and compiler records remain in the archive.

The local driver started with 2,059 MiB free and sampled a minimum of
1,918 MiB, above its 768 MiB stop floor. Node reported v22.23.2. The run
used the local compiler engine, not a hosted locked-Nix execution.
Package binaries and the complete toolchain closure are not archived.
Entry/constructor dispatch counts and a relocated browser replay were not
measured.

## Archive and checks

`reviewed-subtype-browser-runs-20261010/index.json` authenticates 114
original artifacts, including 27 Git source snapshots. Index SHA-256:
`f2992a5696da474d6dce426c4b6c4aaee5d6eb5f0f989723e9a68a77a0cc5b7a`.
The archive includes the original driver, independent checker, mutation
checker, archive writer, process records and all 75 package/browser records.

The independent checker accepted the originals and refused 151 missing or
altered-record cases. These include dropped engines/phases, changed counts,
substituted callers with updated hashes, lost isolation flags, incomplete
worker/React lifecycles and inconsistent Wasm assets. Its original result:
`build/vo1444-browser-independent-check-r1.json`, SHA-256
`f1dbc9d6bfbea7d493676dbb776cba6e7d324636fb7550686e3ce9adb8cdf870`.
Mutation result SHA-256:
`e14b8b6ef7615ed468172b043423b47142abf60907fe8d2d2611b53ff30e898f`.

Nine focused registered browser/history/archive tests passed without
failures or skips. Archive controls check every original record and reject
appended and same-length byte changes. Focused TAP SHA-256:
`4f40cbe55bbb15d16b2573dbaef45e1ed7aed5994f24d2dff0a85882c2adf9b9`.
The registered installed/type-surface/test-profile regression passed 155
tests with zero failures and four explicit installed gates in 110.14
seconds. TAP SHA-256:
`98535e431576eba69933903f302b2a4179d01ea121b05d4288de53b3b2c3de88`.
Full lint, checked JavaScript and all sixteen generated-reference checks
passed after archive registration.
The independent audit matched all 114 artifacts to originals and all 27
source snapshots to Git. All 5,907 older evidence files are byte-identical.
Audit SHA-256:
`f4e5d6eecba05936d99cc31df534eea50c987266f7e7a7659df547a6e5c365ea`.
The type-surface inventory is unchanged. Required recurring browser CI,
exact browser support promotion and consumer documentation are next.
Nested, nominal, callback and remaining generic Subtype combinations remain
open under #1444 and #1220.
