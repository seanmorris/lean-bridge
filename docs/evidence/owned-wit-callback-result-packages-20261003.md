# Installed WIT callback-result acceptance — 2026-10-03

Lean Bridge built and exercised six `wit-wasi` packages from actual Lean 4.32.2
code: ordinary source and independently reviewed Binding IR, each in no-host,
host-callback and combined ownership configurations.

The package test removed the author project and producer output before compiling
the consumer. It authenticated and extracted the original archive, compiled only
against the installed public header and pkg-config metadata, executed the public
API, deleted the handoff, relocated the package and repeated the execution. The
six cases completed 1,582 public checks with no live owners or identities.

The combined reviewed case also loaded the relocated host with local and global
visibility, checked compatible load/fork behavior, and rejected altered versions
of each of its five native dependencies. Deterministic package reassembly and
closed installed inventories were checked before source removal.

The frozen receipt is
[`owned-wit-callback-result-packages-20261003.json`](owned-wit-callback-result-packages-20261003.json).
It contains the six reports, both raw public executions for each report, the
complete successful TAP stream, source identities, package archive identities,
ownership contracts and loader observations. The contract test reconstructs the
receipt without retaining a producer directory.

This acceptance covers synchronous callback-result lifetimes in the bundled
Linux x86-64 Wasmtime host. It does not claim retained host callbacks,
asynchronous delivery, a standalone WASI command, registry publication or
PHP-Wasm callback-result support.
