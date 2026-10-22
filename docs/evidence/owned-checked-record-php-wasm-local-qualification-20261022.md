# PHP-Wasm owned checked-record local qualification

Implementation: `d19542e89ab9b26db57ea3fdcd88ce135fecb30b`

Ordinary Lean source and independently reviewed Binding IR each produced a full package and a standalone result-only package. Every route reproduced its Composer API, npm component and npm shared-runtime archives, removed its author and build trees, installed offline, physically relocated the installation and verified the package-set receipt without its producer.

The full routes passed 137 checks in each of eight Node and eight Chromium executions. They cover a copied nested checked record, an owned checked record carrying a resource, borrowed and transferred inputs, leased results, exact constructor rejection before transfer, synchronous checked-record callback arguments and replies, invalid explicit recovery before callback entry, returned Lean closure checks, exception identity, explicit cleanup, finalizer fallback, zero live identities and later-request recovery. The result-only routes passed four checks in each context without checked-input, transfer or callback metadata.

The machine-readable [qualification record](owned-checked-record-php-wasm-local-qualification-20261022.json) pins the implementation, runtime, installed CLI, package hashes and exact route counts. The recurring workflow rebuilds all four routes and retains each original handoff. Recursive owned graphs, retained or asynchronous callbacks, other predicates, dispatch counts and peak memory remain separate work.
