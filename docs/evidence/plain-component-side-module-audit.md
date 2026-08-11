# Plain component side-module audit

## Result

The medium onboarding side module passes every structural gate in [`src/build/side-module-audit.mjs`](../../src/build/side-module-audit.mjs). Its canonical audit report has SHA-256 identity `fda8a87cc4ffe014c18f53f34da43bdf6c190184dff90a586a1ee083010dd282`.

The auditor reads the Wasm, link manifest, normalized link map, and generated initializer shim. It rejects the build unless all checks pass:

| Check | Required result |
| --- | --- |
| WebAssembly validation | valid |
| Artifact identity | byte count and SHA-256 match |
| Link evidence identity | link map and generated shim hashes match |
| Runtime archives | absent |
| Imported memory | exactly `env.memory` |
| Imported table | exactly `env.__indirect_function_table` |
| Defined memory and table | zero |
| Exported memory and table | zero |
| Runtime function imports | closed reviewed domains |
| Direct symbols | exact compiler adapter set |
| Initializers | generated initializer and private trampoline present |
| Other function exports | only reviewed Emscripten relocation functions |
| Host paths | absent |
| Public generic dispatch | absent |

The test suite mutates one artifact byte and confirms that identity validation blocks the artifact. A separate test adds a required direct symbol that the Wasm does not export and confirms that structural validation blocks it.

[`scripts/build-plain-component-side-module.mjs`](../../scripts/build-plain-component-side-module.mjs) now runs this audit before it returns a successful build. The report is stored at `side-module/audit/component-side-module-audit.json` and its hash is included in the top-level build report.
