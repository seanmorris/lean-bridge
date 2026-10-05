# Python owner-anchored results

VO1219. Python wheels now preserve the original owner selected by a borrowed
function-result contract. Both ordinary Lean exports and independently reviewed
IR use the shared compiled ownership adapter.

## API

Resource-containing outputs use `Value[T]`, including empty containers and
constructors. `get()` checks the whole owner. Shallow copies share storage and
ownership; closing one wrapper releases that wrapper. Borrowed results do not
keep their anchor alive. Releasing or transferring the original owner expires
all descendants. Public resource aliases extracted by `get()` can share an
owning lease. Copied fields remain ordinary Python data.

`Value.retain()` makes independent ownership. `copy_value` accepts nominal
records, variants and resources, or selects an exact container type through a
public function's `result_of` or `parameter_of` declaration. Resource equality
checks canonical identity and raises for expired values. Transferred parameters
consume original `Value` owners, including empty roots, before callback reentry.
Validation failures preserve inputs; errors after handoff leave them consumed.

The Python ownership and binding contracts use version 3; prepared-wheel
receipts use version 4. Shared native adapter version 5 authenticates both
`resultAnchors` and `inputTransfers`. Packages without result anchors preserve
their existing generated API and contract versions.

## Validation

Run with the pinned native and Python toolchains and offline typing wheels:

```sh
source scripts/env.sh
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-python-borrows
```

The glibc override matches this test host. It does not change the production
default or bypass native symbol-version checks.

The enabled gate requires eight tests with no skips. It covers Python 3.11 with
typing_extensions 4.6.0 and 4.16.0, plus Python 3.12. Each compiled source path
checks 19 anchored results and four consuming functions. Runtime probes exercise
empty and recursive values, original-owner transfers, bounded transitive
expiration, callbacks, closures and canonical equality. Native/Python allocation
failures retain exception tracebacks and require zero residual bridge allocations
or identities. Retained validation errors also cover borrowed-root transfers,
expired access/arguments and wrong-thread access. A regression caught a private
lease retained by those error frames; the adapter now clears those private
references before propagating the error. Four executable mutations must fail independent assertions.
Strict mypy checks reject malformed raw anchors, transfers and closure calls.

Installed-wheel tests remove producer sources before offline pip installation,
verify exact wheel and dependency hashes, check public-only callers and execute
the documented example. Loader checks cover compatible/concurrent imports,
conflicting runtime identities and fork while a loader lock is held. Tests
reject altered lifetime contracts and reproduce the original wheel byte for
byte. Installed environments run again after relocation and handoff deletion.
The reviewed combined build also installs C++ and Cargo consumers.

The JSON receipt binds exact sources, compiler inputs, observed logs, generated
contracts and installed package receipts. Authenticated source transitions keep
earlier evidence intact. No installed support-table cells are promoted here.

## Remaining scope

Docker acceptance, other consumer projections of result anchors, receiver
anchors and callback-result anchors are not covered by this receipt. The
borrow-only Python API compiles and executes separately on both source paths;
allocation-failure probes exercise the combined borrowed-result and transfer
fixture. No registry upload is performed.
