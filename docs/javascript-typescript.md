# JavaScript and TypeScript

Install a prepared npm package and import its public functions. The examples use `onboarding-small@1.0.0`, which exports `add` and `isEmpty`, in Node.js, a browser, React, and module workers. Application consumers need no Lean, Lake, or C compiler.

## Use a prepared release

Use Node 22.22 or newer for all commands below, including the Vite 8.2.1 examples. The TypeScript examples use 5.9.3. Browser visitors need neither Node nor Lean.

Choose a setup: [JavaScript on Node](#javascript), [TypeScript on Node](#typescript), [plain browser JavaScript](#use-the-package-in-a-browser), or [React](#react). The React example also includes [browser workers](#browser-workers).

### Install from a registry

If the publisher has released the component and its runtime dependency to your configured registry, install only the component. Run this from your application directory, replacing the example coordinate with the publisher's package name and exact version:

```sh
npm install --save-exact --ignore-scripts --no-audit --no-fund \
  @your-org/your-component@1.0.0
```

npm resolves the declared runtime dependency. Keep the application's lockfile. Use the installed package's name and exports in your imports; the programs below use `onboarding-small`. No public registry publication of that example package is assumed.

For a release supplied as local archives, use the next two steps instead. Both archives go through one installation command; loading the runtime remains automatic.

### Install a local archive release

Use this option when the publisher supplies package files instead of a registry coordinate.

#### Verify the handoff

For a local archive release, [Receive a package](consume/receive-package.md#verify-the-local-npm-receipt) explains how to verify the supplied receipt and select its two archives. Keep `LEAN_BRIDGE_RUNTIME_ARCHIVE` and `LEAN_BRIDGE_COMPONENT_ARCHIVE` set to their absolute paths.

The component archive supplies its generated module, TypeScript declarations, metadata, and binary. The runtime archive satisfies its exact `@lean-bridge/runtime` dependency.

#### Install the exact archives

For the local archive option, each setup below creates its own application directory and `package.json`. After creating those files, run this command from that directory:

```sh
npm install --ignore-scripts --no-audit --no-fund \
  "$LEAN_BRIDGE_RUNTIME_ARCHIVE" "$LEAN_BRIDGE_COMPONENT_ARCHIVE"
```

Installing both archives together satisfies the component's runtime dependency. `--ignore-scripts` disables installation lifecycle scripts. In the browser and React setups, npm also installs the development dependencies declared by that setup's `package.json`.

### JavaScript

Create a Node.js application:

```sh
mkdir lean-javascript-example
cd lean-javascript-example
npm init --yes
npm pkg set type=module
```

Run the [registry](#install-from-a-registry) or [archive](#install-the-exact-archives) installation command, then save `index.mjs`:

```js file=javascript/index.mjs
/**
 * Call the installed Lean component from Node JavaScript.
 *
 * @file
 */
import { add, isEmpty } from "onboarding-small";

const result = { sum: String(add(100n, 23n)), empty: isEmpty(""), nonempty: isEmpty("Lean") };
if(result.sum !== "123" || !result.empty || result.nonempty)
{
	throw new Error("Unexpected Lean result");
}
console.log(JSON.stringify(result));
```

```sh
node index.mjs
```

Expected output:

```text
{"sum":"123","empty":true,"nonempty":false}
```

The import initializes the runtime and loads the component before the module body executes. Calls are synchronous after loading. `add` returns a `bigint`; `isEmpty` returns a `boolean`. Convert a `bigint` to a decimal string before JSON serialization.

Both functions return copied primitives, so no disposal step is required. Imports in one JavaScript realm share the runtime module.

### TypeScript

Create a separate Node.js application and install the compiler:

```sh
mkdir lean-typescript-example
cd lean-typescript-example
npm init --yes
npm pkg set type=module
npm install --save-dev --ignore-scripts --no-audit --no-fund typescript@5.9.3
```

Run the [registry](#install-from-a-registry) or [archive](#install-the-exact-archives) installation command, then create `index.ts`:

```ts file=typescript/index.ts
/**
 * Call the installed Lean component with strict generated types.
 *
 * @file
 */
import { add, isEmpty } from "onboarding-small";

const sum: bigint = add(20n, 22n);
const empty: boolean = isEmpty("");
if(sum !== 42n || !empty) throw new Error("Unexpected Lean result");
console.log(JSON.stringify({ sum: sum.toString(), empty }));
```

Create `tsconfig.json`. The optional `input.ts` and `typecheck.ts` files appear below:

```json file=typescript/tsconfig.json
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
  "include": ["index.ts", "input.ts", "typecheck.ts"]
}
```

```sh
npx tsc --project tsconfig.json
node dist/index.js
```

The program prints `{"sum":"42","empty":true}`. TypeScript resolves declarations from the installed package.

#### Check rejected types

Optionally save `typecheck.ts`:

```ts file=typescript/typecheck.ts
/**
 * Compile intentionally invalid calls to check the generated declarations.
 *
 * @file
 */
import { add, isEmpty } from "onboarding-small";

// Compiled but never executed: these errors check the generated declarations.
// @ts-expect-error Nat inputs use bigint.
add(20, 22);
// @ts-expect-error String inputs do not accept numbers.
isEmpty(0);
// @ts-expect-error Nat outputs are not JavaScript numbers.
const wrongResult: number = add(20n, 22n);
void wrongResult;
```

Run `npx tsc --project tsconfig.json` again, but do not execute `dist/typecheck.js`. If the generated declarations start accepting one of these invalid calls, TypeScript reports an unused `@ts-expect-error` directive.

### Type conversions

These mappings apply to the ordinary pure-function npm packages in Node.js, browsers, React, and workers. JavaScript and TypeScript use the same runtime values. `onboarding-small` uses `Nat`, `String`, and `Bool`; the [scalar reference](reference/types.md) covers the other supported exports.

| Lean type | JavaScript / TypeScript | Conversion rules |
| --- | --- | --- |
| `Unit` | `undefined` / `void` result | Pass `undefined` for a unit argument; no result value needs cleanup. |
| `Bool` | `boolean` | Pass `true` or `false`, not `0` or `1`. |
| `UInt8` | `number` | Integer from `0` through `255`. |
| `UInt16` | `number` | Integer from `0` through `65535`. |
| `UInt32` | `number` | Integer from `0` through `4294967295`. |
| `UInt64` | `bigint` | Integer from `0n` through `2n ** 64n - 1n`. |
| `Int8` | `number` | Integer from `-128` through `127`. |
| `Int16` | `number` | Integer from `-32768` through `32767`. |
| `Int32` | `number` | Integer from `-2147483648` through `2147483647`. |
| `Int64` | `bigint` | Integer from `-(2n ** 63n)` through `2n ** 63n - 1n`. |
| `Nat` | `bigint` | Nonnegative arbitrary-precision integer. Use `42n`, not `42`. |
| `Int` | `bigint` | Arbitrary-precision integer of either sign. |
| `Float32` | `number` | Rounds to IEEE single precision; NaN, infinities, and negative zero are accepted. |
| `Float` | `number` | IEEE double precision; NaN, infinities, and negative zero are accepted. |
| `String` | `string` | Copied as UTF-8. Embedded NUL is allowed; unpaired UTF-16 surrogates are rejected. |
| `ByteArray` | `Uint8Array` | Inputs and results are copied, not views into the Lean heap. |

The bindings validate integer types and ranges before calling Lean. Text, bytes, and arbitrary-precision integer payloads have a 16 MiB per-value copy limit. Use decimal strings when serializing `bigint` values to JSON; converting to `number` can lose precision.

Arrays, records, resources, callbacks, `IO`, and `Task` are not accepted by this ordinary component build path. Richer prepared profiles, including Alpha, have their own generated APIs. The [runtime reference](consumers.md) identifies those packages; a mapping in another profile does not add exports to this one.

### Validate numeric inputs

The installed Wasm runtime preserves arbitrary-precision `Nat` values as nonnegative `bigint`. The acceptance checks include values beyond `2^64` and 4,096-bit integers.

For user-entered text, save this validator as `input.ts` in the TypeScript application:

```ts file=typescript/input.ts
/**
 * Validate user input before calling the installed Lean component.
 *
 * @file
 */
import { add } from "onboarding-small";

/** Parse nonnegative decimal inputs without narrowing Lean natural numbers. */
export function addInput(leftText: string, rightText: string): bigint
{
	if(!/^\d+$/.test(leftText) || !/^\d+$/.test(rightText))
	{
		throw new RangeError("Enter nonnegative whole numbers.");
	}
	const left = BigInt(leftText);
	const right = BigInt(rightText);
	return add(left, right);
}
```

Invalid text throws `RangeError` before invoking Lean. The sum has no fixed-width integer bound; the runtime's copy limit still applies. The React and worker example applies the same text checks in its shared `lean.ts` helper. Use `sum.toString()` for display or JSON.

### Use the package in a browser

Create a separate application directory:

```sh
mkdir lean-browser-example
cd lean-browser-example
```

Save `package.json`:

```json file=browser/package.json
{
  "name": "lean-browser-guide",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "preview": "vite preview --host 127.0.0.1"
  },
  "devDependencies": { "vite": "8.2.1" }
}
```

Run the [registry](#install-from-a-registry) or [archive](#install-the-exact-archives) installation command, then add these files.

`index.html`:

```html file=browser/index.html
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lean browser example</title></head>
  <body>
    <h1>Call a Lean package</h1>
    <output id="result" role="status">Loading Lean component...</output>
    <script type="module" src="./main.js"></script>
  </body>
</html>
```

`main.js`:

```js file=browser/main.js
/**
 * Display a result from the installed Lean component.
 *
 * @file
 */
const output = document.querySelector("#result");
try
{
	const { add, isEmpty } = await import("onboarding-small");
	const sum = add(20n, 22n);
	const empty = isEmpty("");
	if(sum !== 42n || !empty) throw new Error("Unexpected Lean result");
	output.textContent = `Sum: ${sum}. Empty string: ${empty}.`;
	output.dataset.status = "ready";
} catch(error)
{
	output.textContent = `Could not load Lean: ${String(error)}`;
	output.dataset.status = "error";
}
```

The dynamic import lets the page display loading and failure states. Package initialization is asynchronous; exported calls are synchronous after it resolves.

`vite.config.js`:

```js file=browser/vite.config.js
/**
 * Keep the compiled runtime and component assets under the deployment prefix.
 *
 * @file
 */
import { defineConfig } from "vite";

export default defineConfig({
	base: "/consumer-example/"
	, build: { target: "esnext", assetsInlineLimit: 0 }
});
```

```sh
npm run dev
```

Open the printed local URL at `/consumer-example/`. The page displays `Sum: 42. Empty string: true.`

#### Build and serve browser assets

For either the plain browser application or the React application below:

```sh
npm run build
npm run preview
```

Deploy the whole `dist` directory, including its generated binary assets. Set Vite's `base` to the deployed prefix, including a GitHub project Pages prefix when applicable. The server should return `.wasm` files as `application/wasm`. Load the page through HTTP, not a `file:` URL.

### React

The checked-in React application includes editable inputs, mount/unmount controls, loading and error states, and a module-worker example. It pins React, Vite, and TypeScript.

Set the checkout path, then copy the complete fixture into a new application directory:

```sh
export LEAN_BRIDGE_CHECKOUT=/absolute/path/to/lean-bridge
mkdir lean-react-example
cp -R "$LEAN_BRIDGE_CHECKOUT/tests/fixtures/component-consumer/." lean-react-example/
cd lean-react-example
```

Run the [registry](#install-from-a-registry) or [archive](#install-the-exact-archives) installation command, then `npm run dev`. Open the printed URL at `/consumer-example/`. The initial result is `Sum: 42. Empty string: true.` Change the numbers or text and click Calculate. Unmount removes the result component; Mount restores it using the same loaded package.

The copied application imports the installed public package. It needs no compiler, repository runtime module, private symbol, or hand-written binary loader.

#### Load from an effect

A dynamic import allows the component to display loading and failure states. This effect skips the state update if its owner has already unmounted:

```tsx
import { useEffect, useState } from "react";

export function LeanSum() {
  const [message, setMessage] = useState("Loading Lean component...");

  useEffect(() => {
    let active = true;
    import("onboarding-small").then(api => {
      if (!active) return;
      setMessage(`Sum: ${api.add(20n, 22n)}`);
    }).catch(error => {
      if (active) setMessage(`Could not load Lean: ${String(error)}`);
    });
    return () => { active = false; };
  }, []);

  return <p role="status">{message}</p>;
}
```

React development StrictMode runs an extra effect setup and cleanup. ESM shares the import across those effects; the retired effect skips its update. The cleanup flag does not cancel initialization or a synchronous Lean call. The runtime remains available to other consumers in the page.

For editable inputs, validate the [numeric range](#validate-numeric-inputs) and include submitted input in the effect's dependency list. Keep browser-only computation in the effect instead of importing it from a server-rendered module.

#### Configure the React build

The copied fixture includes this Vite configuration, which retains both binaries and emits module workers:

```ts
/**
 * Keep the runtime and component as explicit browser assets, including workers.
 *
 * @file
 */

import { defineConfig } from "vite";

export default defineConfig({
	base: "/consumer-example/"
	, build: { target: "esnext", assetsInlineLimit: 0 }
	, worker: { format: "es" }
});
```

Use the shared [build and deployment steps](#build-and-serve-browser-assets). This fixture's build also type-checks the main-thread and worker programs separately.

### Browser workers

The React application's Start worker button sends its current inputs to `lean-worker.ts`. A module worker runs calls on its own JavaScript thread and loads its own runtime. It shares neither component objects nor runtime memory with the page.

The addition example demonstrates loading and ownership. Worker startup costs more than this single addition; use a worker when computation would delay page interaction.

#### Send inputs and return results

The worker source uses the fixture's local `lean.ts` helper to load the installed public API and validate inputs:

```ts
/**
 * Execute the same installed component in a separate JavaScript realm.
 *
 * @file
 */

import { calculate, loadLean } from "./lean";
import type { Inputs } from "./lean";

self.addEventListener("message", async (event: MessageEvent<Inputs>) => {
	try
	{
		const api = await loadLean();
		self.postMessage({ ok: true, result: calculate(api, event.data) });
	}
	catch(error)
	{ self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
});
```

[`lean.ts`](../tests/fixtures/component-consumer/lean.ts) imports `onboarding-small` and returns `{ sum: string, empty: boolean }`. The page sends `{ left: "20", right: "22", text: "" }`. Decimal strings also work with JSON; browser `postMessage` itself can copy `bigint` through structured cloning.

Create the worker through a source-relative URL so Vite discovers and bundles it:

```ts
const worker = new Worker(new URL("./lean-worker.ts", import.meta.url), {
  type: "module",
});

worker.onmessage = event => {
  if (event.data.ok) console.log(event.data.result);
  else console.error(event.data.error);
};
worker.onerror = event => console.error(event.message);
worker.postMessage({ left: "20", right: "22", text: "" });
```

#### Terminate the worker with its owner

In React, create the worker inside an effect and terminate it during cleanup:

```tsx
useEffect(() => {
  const worker = new Worker(new URL("./lean-worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = event => setResult(event.data);
  worker.onerror = event => setResult({ ok: false, error: event.message });
  worker.postMessage(input);
  return () => {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  };
}, [input]);
```

Termination stops that worker without waiting for its current computation and discards its runtime. Other workers and the page continue independently. A string or Boolean result needs no additional disposal.

The runnable fixture creates a new worker for each submitted input, so a retired worker cannot publish a result for newer input. For a long-lived worker handling overlapping requests, include a request ID and match replies before applying them. Terminate the worker when its application owner finishes.

### Diagnose an install or call failure

| Symptom | Action |
| --- | --- |
| npm fetches `@lean-bridge/runtime` | Install both verified archives together and compare their versions with the receipt. |
| TypeScript rejects a numeric argument | Use `bigint` instead of casting away the generated type check. |
| `JSON.stringify` rejects the result | Convert the `bigint` to a string first. |
| `Unsupported component private ABI` | Rebuild the component and use its exact runtime dependency. |
| Browser import fails | Inspect component and runtime requests in the network panel. |
| Assets return 404 after deployment | Match Vite's `base` to the deployment prefix and upload the complete `dist` directory. |
| A corrected asset still fails to load | Reload the page; failed ESM initialization can remain cached in that page. |
| A component leaves while loading | Ignore its pending result in effect cleanup, or terminate its worker when the work should stop. |

### Do I manage the shared runtime?

No. The component declares its exact runtime dependency, npm resolves it, and the generated import initializes it. Application code imports only the component's public API.

The local archive recipe supplies the runtime tarball alongside the component because that handoff does not depend on a registry copy. Both go through one install command; the application code stays the same.

[Combine Lean packages](concepts/shared-runtime.md) explains compatible runtime sharing and separate worker instances. [Types and values](reference/types.md) and [Ownership and cleanup](concepts/ownership.md) cover the call boundary.

## Start from a raw Lean package

A Lake project must be compiled and packaged before these applications can import it. Complete [author setup](lean/setup.md), check the project's [export shapes](lean/export-decisions.md), and commit the source you intend to build. The setup selects the matching Lean toolchain, isolated builder, and shared runtime.

Run these commands from the Lean project's root, using new output directories:

```sh
lean-bridge analyze --project . --check --output build/analysis
lean-bridge build --project . --target npm --output build/lean-bridge-release
lean-bridge publish --project . --target npm --dry-run \
  --output build/lean-bridge-dry-run
export LEAN_BRIDGE_RELEASE="$PWD/build/lean-bridge-dry-run/release/packages/npm"
```

The dry run produces the component and runtime archives, receipt, and verifier without publishing them. Follow [Verify the handoff](#verify-the-handoff), then return to the application setup above. [Share a local package](publish/local-handoff.md) explains the build outputs and reproducibility checks.

To build the exact `add` and `isEmpty` package used in these examples, follow [Build your first component](lean/first-component.md). For another Lean package, use its generated import name, declarations, and runtime requirements.

### Check the author's exact package

Contributors can run the [JavaScript and browser acceptance checks](contributing/testing.md#javascript-and-browser-acceptance) against the author's original archives. Those checks exercise the applications above without rebuilding the component or publishing it.

### Publish this package

See [Publish to npm](publish/npm.md) for package preparation, distribution, and verification after upload.
