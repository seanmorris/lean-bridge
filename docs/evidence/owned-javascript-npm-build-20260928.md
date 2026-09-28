# Installed owned JavaScript packages

This milestone adds `javascript-wasm-owned-v1` compilation, npm archives and
the installed author CLI. It keeps the preceding
[runtime receipt](owned-javascript-wasm-integration-20260928.json) unchanged.

The compiler captures ordinary source or an independently reviewed v4 contract,
asks Lean for fresh type and carrier metadata, checks generated Lean adapters,
then compiles a wasm32 side module with the pinned Emscripten 6.0.6 SDK. The
module imports the existing runtime's memory, table and ownership broker. Its
only callable application export is the compiler-bound control function.
Emscripten's relocation functions and two EM_JS data globals are retained.

The artifact reader reconstructs the model and adapters, verifies the exact
inventory, target headers, compiler identities, source notices and binary
exports. Twelve tampering cases change both an artifact and its outer inventory;
the deeper checks reject each substitution.

## Installed execution

The gate builds ordinary and reviewed components, removes source trees, installs
the two npm archives offline, and runs Node plus strict TypeScript checks.
Repeated packaging must reproduce both archives byte for byte. Public functions
cover exact large integers, Unicode and NUL, tagged options and results,
recursive records, resource identity, callback borrow expiry, independent
retention, returned function leases and original exception identity.

Vite bundles only the isolated installation. The test then removes everything
except its static output and serves it beneath a nested deployment path.
Chromium, Firefox and WebKit each execute a page, React StrictMode and a module
worker. Every context runs sixteen checks three times, fetches the exact two
installed Wasm assets and rejects off-origin requests. The worker installs its
message handler before asynchronously importing the API; the initial version
lost the first request while top-level initialization was pending.

The author gate installs the standalone CLI offline with its shared runtime and
small target-header bundle. Producer directories are removed before the CLI
builds the ordinary and reviewed projects. The reviewed project also requests
native C, requiring both profiles to retain the same source and API identity.
Downstream npm installations execute after source and release-directory removal.

The [required CI gate](../contributing/testing.md#javascript-ownership-transport-and-generated-apis)
enables all compiler/browser tests, rejects skips, retains three logs and
propagates failure to the support summary. The successor JSON receipt binds
successful logs and exact source transitions; it does not rewrite earlier
execution records or promote type-surface support cells.

## Remaining work

Owned npm uses the pinned host author SDK. Nix/Docker compilation and signed
publication are not integrated for this profile. Installed owned/copied package
coexistence needs its full public-package acceptance matrix. WIT/WASI ownership,
transferred inputs, anchored borrowed results and final cross-language installed
acceptance remain part of task 1219.
