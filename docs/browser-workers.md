# Browser workers

The [JavaScript and TypeScript guide](javascript-typescript.md#browser-workers) now contains worker messages, runtime ownership, and cleanup alongside the React application.

## Start with the installed React example

Run the [React fixture](javascript-typescript.md#react), then use its [browser-worker controls](javascript-typescript.md#browser-workers).

## Send data and receive results

See the [worker request and response example](javascript-typescript.md#send-inputs-and-return-results), including the source-relative worker URL and input validation.

## Terminate the worker when its owner leaves

Use [effect cleanup to terminate the worker](javascript-typescript.md#terminate-the-worker-with-its-owner) and discard its runtime.

## Verify worker ownership

The [installed-package acceptance command](contributing/testing.md#javascript-and-browser-acceptance) checks production and development StrictMode worker ownership, results, and asset URLs.
