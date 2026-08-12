# Browser package acceptance

Verified 2026-08-11 with Node 22, Vite 8, Playwright 1.62, and Chromium.

`npm run test:consumer:browser` installs the generated npm archive with lifecycle scripts disabled. The installed manifest must expose its public entry through the `browser` export condition. Vite bundles an ordinary bare-package import, then Chromium executes retained resources, copied values, a host callback, and a Lean closure through the generated API.

The test succeeds only when the installed package executes the real Lean Wasm component and returns the expected values.
