# Use an installed Lean package from React

The React example imports `add` and `isEmpty` from the same `onboarding-small` archives produced by the [Lean author tutorial](lean/first-component.md). The browser loads one shared runtime and the component per JavaScript realm. React components read the copied results.

## Run the example

First [verify and select both archives](javascript-typescript.md#verify-the-handoff). Keep `LEAN_BRIDGE_RUNTIME_ARCHIVE` and `LEAN_BRIDGE_COMPONENT_ARCHIVE` set to their absolute paths. Node 22.22 or newer supports the Vite version used by this example.

Copy the complete consumer fixture into a new directory:

```sh
export LEAN_BRIDGE_CHECKOUT=/path/to/lean-bridge
export LEAN_BRIDGE_REACT_APP=$(mktemp -d)
cp -R "$LEAN_BRIDGE_CHECKOUT/tests/fixtures/component-consumer/." \
  "$LEAN_BRIDGE_REACT_APP/"
cd "$LEAN_BRIDGE_REACT_APP"
npm install --ignore-scripts --no-audit --no-fund \
  "$LEAN_BRIDGE_RUNTIME_ARCHIVE" \
  "$LEAN_BRIDGE_COMPONENT_ARCHIVE"
npm run dev
```

Open Vite's printed local URL for `/consumer-example/`. The initial result is `Sum: 42. Empty string: true.` Change the numbers or text and click Calculate. Unmount removes the result component; Mount restores it using the same loaded package.

The fixture pins React, Vite, and TypeScript. Its application imports no Lean Bridge repository file, compiler, private symbol, or hand-written binary loader.

## Load from an effect

Use a dynamic import so the component can show loading and failure states. The effect below ignores a result after cleanup:

```tsx
import { useEffect, useState } from "react";

export function LeanSum() {
  const [message, setMessage] = useState("Loading Lean component…");

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

React development StrictMode runs an extra effect setup and cleanup. ESM shares the package import across those effects. The retired effect skips its result update; the active effect displays `42`.

The cleanup flag does not cancel the import or a synchronous Lean call. It prevents a stale UI update. The runtime and loaded component remain available to other consumers in the same page. `add` and `isEmpty` return copied values, so this effect has no resource handle to dispose.

For editable inputs, include the submitted input in the effect's dependency list and [validate the supported numeric range](javascript-typescript.md#validate-numeric-inputs) before the call. Avoid importing the package from a server-rendered module when the computation belongs in the browser; this example starts the import in an effect.

## Preserve binary asset URLs

The fixture's Vite configuration keeps both binaries as output files and emits module workers:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "/consumer-example/",
  build: { target: "esnext", assetsInlineLimit: 0 },
  worker: { format: "es" },
});
```

Set `base` to the path where you deploy the application. Serve the entire `dist` directory, including its `assets` directory. The server should return `.wasm` files with `Content-Type: application/wasm`. Do not open the HTML through a `file:` URL.

Build and preview the installed application:

```sh
npm run build
npm run preview
```

The build checks the main-thread and worker TypeScript separately. The fixture also includes compile-time failures for a `number` passed to `add`, a non-string passed to `isEmpty`, and a Nat result assigned to `number`.

## Handle load failures

The result component displays a failed import instead of leaving a permanent loading message. Check the browser's network panel for missing assets, an incorrect base path, or a mismatched runtime archive. After correcting the files, reload the page. An errored ESM module can remain cached for the current page.

For work that should stop when the component leaves, use a [module worker](browser-workers.md). Terminating the worker destroys its realm; unmounting a UI component alone does not destroy the page's shared runtime.

## Check the author's exact package

Run the consumer acceptance command from the Lean Bridge checkout, pointing it at the release directory used above:

```sh
node scripts/check-component-browser-consumer.mjs \
  --release "$LEAN_BRIDGE_RELEASE" \
  --output build/documentation-consumer-acceptance
```

The command verifies the supplied archives, installs them in an external temporary project, type-checks the fixture, and exercises production React, development StrictMode, and module workers in Chromium, Firefox, and WebKit. It also checks unmount during loading, invalid input, the supported numeric boundary, failed assets, and prefixed deployment. The report records the current runtime's failures just beyond the supported numeric boundary. It performs no component rebuild or publication.
