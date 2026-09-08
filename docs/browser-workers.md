# Run a Lean package in a browser worker

A module worker runs Lean calls on its own JavaScript thread. The page remains available for input while that worker computes. The worker loads its own instance of `@lean-bridge/runtime`; it does not share the page's component objects or memory.

## Start with the installed React example

[Install and run the React consumer](react.md#run-the-example). Its Start worker button sends the current numbers and text to `lean-worker.ts`. The worker imports the same installed `onboarding-small` package and returns copied results.

The small `add` example demonstrates package loading and ownership. Moving one addition to a worker costs more than performing that addition on the main thread. Use this pattern when a component performs enough work to delay page interaction.

## Send data and receive results

Create a module worker through a source-relative URL so Vite can discover and bundle it:

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

The fixture sends decimal strings, validates them inside the worker, and returns a decimal string plus a boolean. This avoids JSON's lack of `bigint` support. Browser `postMessage` itself can also copy `bigint` values through structured cloning.

The worker uses only the installed public API:

```ts
import { calculate, loadLean } from "./lean";
import type { Inputs } from "./lean";

self.addEventListener("message", async (event: MessageEvent<Inputs>) => {
  try {
    const api = await loadLean();
    self.postMessage({ ok: true, result: calculate(api, event.data) });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
```

[`lean.ts`](../tests/fixtures/component-consumer/lean.ts) dynamically imports `onboarding-small` and validates nonnegative inputs whose sum is no greater than `2^31 - 1`. Each call returns copied primitives. The author archive supplies the actual implementation.

For overlapping requests, include a request ID and match it when applying replies. The runnable fixture starts a new worker for each submitted input, so an old worker cannot publish a result for a newer input.

## Terminate the worker when its owner leaves

React effect cleanup removes handlers and terminates the worker:

```tsx
useEffect(() => {
  const worker = new Worker(new URL("./lean-worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = event => setResult(event.data);
  worker.postMessage(input);
  return () => {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  };
}, [input]);
```

Termination stops that worker without waiting for its current computation and discards its runtime. Other workers and the page's runtime continue independently. For the simple package used here, no extra disposal method belongs to the returned string or boolean.

The fixture's Vite configuration sets `worker.format` to `"es"` and keeps binary assets outside data URLs. Keep the generated worker chunks and both binary assets under the application's configured deployment prefix.

## Verify worker ownership

The [installed consumer acceptance command](react.md#check-the-authors-exact-package) runs the worker in production and development StrictMode builds. It checks that the worker result matches the main-thread result, that every created worker is terminated when its component leaves, and that asset requests retain the deployment prefix.

Worker creation and runtime initialization are startup costs. Reuse a worker for repeated heavy requests when that matches the application's lifetime, then terminate it when that owner is finished.
