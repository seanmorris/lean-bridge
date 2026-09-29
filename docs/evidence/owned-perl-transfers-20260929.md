# Perl input ownership transfers

VO task: 1219. This milestone adds explicit consuming arguments to Perl's
resource-containing values and returned Lean closures. Authors select transfers
in ordinary export configuration or independently reviewed Binding IR.

The [machine-readable receipt](owned-perl-transfers-20260929.json) records
compiler inputs, private allocation probes, installed CPAN archives and exact
documentation executions. It preserves the previous Java/Kotlin receipt and
records reversible source changes. No registry publication is part of this gate.

## Acceptance command

```sh
LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 \
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
npm run test:owned-perl-transfers
```

The glibc overrides select the local test host's existing floor. They do not
change the production package default. The suite uses Perl 5.36.3 and 5.38.2,
each threaded and unthreaded. Installed tests cover `prebuilt-only` and
`build-xs`, remove producer sources and archive handoffs, relocate each
installation and execute it twice with no compiler on PATH. Cold and warm
loaders reject changed XS, component and private GMP libraries.

## Ownership behavior

Callers pass ordinary generated Perl values. Conversion collects and reserves
the resource leases it visits. Tied scalar inputs are fetched once. Preparing
one consuming call cannot let a reentrant consuming call take the same lease.
Invalid input leaves the caller's owners usable.

The native adapter validates the complete set before consuming it. Shared
aliases and sibling resources from one result owner close at the Lean call
boundary, including during callback reentry. Independent retains survive.
Failures after handoff do not restore ownership. Callback borrows require an
explicit retain before transfer. Perl save-stack cleanup releases resources
when conversion, callbacks or result construction throw.

Private tests exercise single- and multiple-input handoffs under managed
allocation, native allocation and Perl exception injection. Exceptions stay
reachable while allocation and identity counters return to zero. Forked
processes and cloned interpreter threads cannot consume the parent's owners.

The installed documentation tests also compile a combined C/CPAN release.
That example exposed a strict optimized-C warning for the transfer batch array;
the generator now initializes it. Historical artifact checks reverse only that
initialization when the complete resulting digest matches a frozen receipt.
Current builds always use the initialized array.

## Remaining work

PHP/native-Wasm, JavaScript/TypeScript and WIT/WASI transfers, owner-anchored
borrowed results, owned Docker acceptance and the final cross-language support
audit remain open. This receipt does not promote unrelated type-support cells.
