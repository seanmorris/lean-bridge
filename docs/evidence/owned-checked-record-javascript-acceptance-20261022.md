# Installed owned checked-record JavaScript acceptance

Implementation: `87a41b9bb331be0f421ffc321a5f28e09d11e2ea`

The ordinary-source and independently reviewed Binding IR roots each produced full and result-only npm packages. All four packages were rebuilt byte-for-byte, installed offline after authored sources and build outputs were removed, relocated, and executed through Node.js and strict TypeScript.

Chromium, Firefox, and WebKit each executed a page, a React Strict Mode application, and a worker twice per package. Full packages completed 30 semantic checks; result-only packages completed 7. The full surface covers borrowed, retained, and transferred resources, a copied nested checked record, rejection before and after partial conversion, checked host callback replies, thrown callback identity, returned Lean closures, recovery, disposal, and engine shutdown.

Command: `LEAN_BRIDGE_OWNED_CHECKED_RECORD_JS_TEST=1 LEAN_BRIDGE_OWNED_CHECKED_RECORD_BROWSER_TEST=1 node --test --test-concurrency=1 tests/owned-checked-record-javascript-packaging.test.mjs`
