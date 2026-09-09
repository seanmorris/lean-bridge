# Installed React and worker consumer acceptance

Observed on 2026-09-08. The final run completed at 07:01:09 UTC.

The numeric limits below describe these historical archives. [Scalar ABI 2 acceptance on 9 September](npm-release-hardening-20260909.md) supersedes them with exact large-integer transport.

The consumer installed the exact `onboarding-small@1.0.0` archives from the Lean author tutorial into a temporary project outside the repository. It imported the public package without rebuilding the component, invoking package lifecycle scripts, or publishing an archive.

## Results

The repository verifier and the standalone verifier shipped with the archives accepted the same receipt. The installed package identity matched that receipt. npm installed one copy of the exact shared-runtime dependency. Reverification after the browser checks found unchanged archive bytes.

The installed Node package returned `123n` for `add(100n, 23n)`, `true` for `isEmpty("")`, and `false` for `isEmpty("Lean")`.

Strict TypeScript compilation passed for both the browser and worker projects. The generated declaration contained no public `any`. The fixture's expected type failures rejected numeric arguments instead of `bigint`, non-string text arguments, and assigning a Nat result to `number`.

| Browser | Version | Production React | Development StrictMode |
| --- | --- | --- | --- |
| Chromium | `152.0.7977.75` | Passed | Passed |
| Firefox | `153.0` | Passed | Passed |
| WebKit | `26.5` | Passed | Passed |

The fixture used Node `22.23.2`, React and React DOM `19.2.8`, TypeScript `5.9.3`, and Vite `8.2.1`.

Each browser and React variant checked:

- Initial results, edited inputs, and recovery after rejected inputs.
- An accepted input of `2147483647n` and an accepted sum of `2147483646n + 1n`.
- Rejection of negative inputs and sums beyond the supported range before the Lean call.
- Four unmount/remount cycles without another runtime or component asset request.
- A module worker returning the same result as the main-thread component.
- Termination of every owned worker when its component left: one in production, two under development StrictMode.
- Real runtime and component Wasm assets beneath `/consumer-example/`, served successfully as `application/wasm`.
- No uncaught page errors during successful calls and lifecycle checks.

Development StrictMode ran two initial effect setups and one cleanup. Only the active effect committed a result. A separate delayed-Wasm test unmounted the component before loading completed; both retired effects ignored their completions. Remounting then committed one result.

Each browser also received deliberately missing Wasm assets. The component displayed a failure, and a full reload recovered after the assets became available.

## Numeric boundary diagnostic

The exact installed package accepted both `add(2147483647n, 0n)` and `add(2147483646n, 1n)`. Direct Node calls beyond that boundary produced these raw results:

```json
[
  {
    "left": "2147483648",
    "right": "0",
    "error": "resolved is not a function"
  },
  {
    "left": "2147483647",
    "right": "1",
    "error": "resolved is not a function"
  }
]
```

VO task 1195 tracks this current packaged-runtime defect. The tutorials and fixture restrict nonnegative inputs and their sum to `2^31 - 1`, keeping calls on Lean's small-Nat representation. This acceptance did not change the runtime or claim arbitrary-precision transport.

## Exact archive identities

| Artifact | SHA-256 |
| --- | --- |
| Package receipt | `63e7a135df3714c203c77fb7fd43b5e2627c9a47072d58c92b34de86022cc660` |
| Component identity | `ca7b1b5d550194ea874c37f19c8c94e64782cbf2ab7e8402f5209c377c5b7d1b` |
| Component archive | `2e493b63a5581c7006704b236612f180ddbc60e2cab60e5e0a97815ef4c83383` |
| Runtime archive | `364eea29a4471c5f8cf3026e1f3b5e58b733ae932ba9e9e52f0ae4dacad5c6c1` |

The component archive is `onboarding-small-1.0.0.tgz`. The runtime archive is `lean-bridge-runtime-0.0.0-abi1.f3b06c705e6c.743765bf566f.tgz`.

## Reproduce

After producing the author tutorial's release directory, run:

```sh
node scripts/check-component-browser-consumer.mjs \
  --release build/documentation-author-acceptance/release/packages/npm \
  --output build/documentation-consumer-acceptance

node --test tests/component-consumer-docs.test.mjs
```

The three focused documentation and fixture tests passed. The browser runner writes `acceptance.json` and `numeric-boundary-diagnostic.json` beneath the supplied output directory only after all selected browser checks pass.

Read the [consumer acceptance runner](../../scripts/check-component-browser-consumer.mjs), [React fixture](../../tests/fixtures/component-consumer/main.tsx), and [worker fixture](../../tests/fixtures/component-consumer/lean-worker.ts). The tutorials cover [JavaScript and TypeScript](../javascript-typescript.md), [React](../react.md), and [browser workers](../browser-workers.md).
