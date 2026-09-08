# Use a generated package from JavaScript or TypeScript

Install the author's runtime and component archives, then import the generated functions by package name. The example below calls `add` and `isEmpty` from `onboarding-small`. Node consumers need Node 22 or newer; they do not need Lean, Lake, or a C compiler.

Obtain a generated npm release directory from a package author or release handoff. The [author tutorial](lean/first-component.md) produces the two archives used by this consumer example.

## Verify the handoff

The author's [local dry run](lean/first-component.md) produces two npm archives, `component-package-receipt.json`, and `verify-component-package-receipt.mjs`. Keep those four files together. Point this variable at the directory you received:

```sh
export LEAN_BRIDGE_RELEASE=/absolute/path/to/release/packages/npm

node "$LEAN_BRIDGE_RELEASE/verify-component-package-receipt.mjs" \
  --receipt "$LEAN_BRIDGE_RELEASE/component-package-receipt.json"
```

The verifier checks both archive hashes and reports `verified: true`, the component identity, and the runtime package version. It imports only Node built-ins. Run a verifier received from an author or release channel you trust.

A local receipt checks package consistency. For a signed release download, also follow [Authenticate a release archive](consumers.md#authenticate-a-release-archive) with the separately trusted policy hash.

## Install the exact archives

Read the archive names from the verified receipt. This avoids selecting an older archive when the directory contains several versions:

```sh
export LEAN_BRIDGE_RUNTIME_ARCHIVE="$LEAN_BRIDGE_RELEASE/$(node -p \
  'require(process.argv[1]).runtime.archive' \
  "$LEAN_BRIDGE_RELEASE/component-package-receipt.json")"
export LEAN_BRIDGE_COMPONENT_ARCHIVE="$LEAN_BRIDGE_RELEASE/$(node -p \
  'require(process.argv[1]).package.archive' \
  "$LEAN_BRIDGE_RELEASE/component-package-receipt.json")"
export LEAN_BRIDGE_CONSUMER=$(mktemp -d)

cd "$LEAN_BRIDGE_CONSUMER"
npm init --yes
npm pkg set type=module
npm install --ignore-scripts --no-audit --no-fund \
  "$LEAN_BRIDGE_RUNTIME_ARCHIVE" \
  "$LEAN_BRIDGE_COMPONENT_ARCHIVE"
```

`--ignore-scripts` prevents install-time lifecycle scripts. The component archive contains generated JavaScript, declarations, metadata, and one component binary. Its `@lean-bridge/runtime` dependency supplies the runtime binary. npm resolves the component's exact runtime version from the supplied runtime archive.

## JavaScript

Create `index.mjs`:

```js
import { add, isEmpty } from "onboarding-small";

const result = {
  add: add(100n, 23n),
  empty: isEmpty(""),
  nonempty: isEmpty("Lean"),
};

if (result.add !== 123n || result.empty !== true || result.nonempty !== false) {
  throw new Error("Lean component returned an unexpected result");
}

console.log(result);
```

Run it:

```sh
node index.mjs
```

The import initializes the runtime and loads the component before the module body executes. The calls themselves are synchronous. `add` returns a `bigint`; `isEmpty` returns a `boolean`. Neither result owns a resource or needs disposal.

## TypeScript

Install the compiler with lifecycle scripts disabled:

```sh
npm install --save-dev --ignore-scripts --no-audit --no-fund typescript@5.9.3
```

Create `index.ts`:

```ts
import { add, isEmpty } from "onboarding-small";

const sum: bigint = add(20n, 22n);
const empty: boolean = isEmpty("");

if (sum !== 42n || !empty) {
  throw new Error("Lean component returned an unexpected result");
}

console.log({ sum, empty });
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitAny": true,
    "skipLibCheck": false,
    "outDir": "dist"
  },
  "include": ["index.ts"]
}
```

Compile and execute the generated JavaScript:

```sh
npx tsc --project tsconfig.json
node dist/index.js
```

The final command prints `{ sum: 42n, empty: true }`. The generated declaration for this component contains no public `any`. TypeScript rejects `add(20, 22)` because its inputs must be `bigint`.

## Validate numeric inputs

This example accepts nonnegative inputs whose sum is at most `2147483647n`, or `2^31 - 1`. The installed WebAssembly runtime currently fails on larger `Nat` values when it leaves Lean's small-integer representation. A `bigint` parameter does not establish arbitrary-precision support in the packaged runtime.

Validate text before calling `add`:

```ts
import { add } from "onboarding-small";

function addInput(leftText: string, rightText: string): bigint {
  if (!/^\d+$/.test(leftText) || !/^\d+$/.test(rightText)) {
    throw new RangeError("Enter nonnegative whole numbers.");
  }
  const left = BigInt(leftText);
  const right = BigInt(rightText);
  if (left + right > (1n << 31n) - 1n) {
    throw new RangeError("The sum exceeds this example's supported range.");
  }
  return add(left, right);
}
```

Convert a result to text with `sum.toString()`. `JSON.stringify` does not serialize `bigint` directly. Keep large integers as `bigint` or decimal strings; converting them to `number` can lose precision.

## Use the package in a browser

The same archives expose browser ESM entry points. [Use the package from React](react.md) covers loading, errors, remounts, and a runnable Vite project. [Run calls in a module worker](browser-workers.md) moves computation off the page's JavaScript thread and gives the worker an explicit lifetime.

Several imports in the same JavaScript realm share the installed runtime module. A worker has its own realm and runtime. The component loader retains initialized components for that realm's lifetime. Do not shut down the shared runtime when one React component unmounts.

## Diagnose an install or call failure

| Symptom | Check |
| --- | --- |
| Receipt verification rejects an archive | Obtain the archive named by that receipt. Do not regenerate or rename a different package to match it. |
| npm tries to fetch `@lean-bridge/runtime` | Install both local archives together and check that their versions match the receipt. |
| TypeScript rejects a numeric argument | Use a `bigint` literal such as `42n`, or parse a validated decimal string with `BigInt`. |
| A call rejects an argument at runtime | Check its generated declaration, input type, and the current numeric range above. |
| A browser import fails | Inspect requests for the runtime and component binaries, including their deployment prefix. Restore the assets and reload the page. |

The [plain project acceptance record](evidence/plain-project-package-acceptance.md) records the existing Node package path. Read the installed [React consumer fixture](../tests/fixtures/component-consumer/main.tsx) and its [module worker](../tests/fixtures/component-consumer/lean-worker.ts).
