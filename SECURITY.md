# Security Policy

This repository is an architecture-testing proof of concept, not a production security boundary.

Do not process untrusted library descriptors, WebAssembly modules, proof metadata, or JavaScript capabilities with it yet. The POC will test integrity checks, decoder budgets, capability restrictions, lifecycle containment, and graph-lock enforcement, but those tests do not constitute a security audit.

Report suspected vulnerabilities privately to the project owner. Include the exact build lock, runtime profile, reproduction, and whether the issue crosses the Lean, bridge, Emscripten, JavaScript, WASI, or package-resolution boundary.

Never include secrets, private payloads, or arbitrary object stringifications in debug traces or issue reports.
