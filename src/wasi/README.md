# WIT/WASI native host

This directory contains the independent C host used by the clean WIT/WASI consumer path. It proves that a packaged component can be loaded and called through its generated WIT boundary without importing repository JavaScript runtime internals.

## Host flow

```text
WASI package archive
  |-- component Wasm
  |-- generated WIT
  `-- native-component-host.c
                |
                v
          compile with Wasmtime
                |
                v
       instantiate packaged component
                |
                v
        call generated native boundary
                |
                v
          verify the Lean result
```

[`native-component-host.c`](native-component-host.c) reads the component path supplied by the clean consumer, configures Wasmtime, instantiates the component, resolves the expected exported function, invokes it, and prints the typed result. The clean-consumer script checks the value. Runtime failures produce a nonzero native process status.

## Ownership boundaries

WIT declaration generation belongs to [`../backends/wit`](../backends/wit/). Component compilation and auditing belong to [`../build`](../build/README.md). Archive construction belongs to [`../release/wasi-package.mjs`](../release/wasi-package.mjs). This directory owns only the independent native host implementation used to exercise that package.

Keeping the host separate from the generator catches assumptions that a JavaScript loader might conceal. It also ensures the WIT package includes enough information for a native consumer to build against an ordinary Wasmtime installation.

## What the host verifies

- The package contains a component at the documented location.
- Wasmtime can load and instantiate that component.
- The generated WIT export resolves through the native component API.
- A call crosses the component boundary and emits a Lean value for the clean consumer to verify.
- Failure to load, resolve, invoke, or validate produces a nonzero process result.

The host is an acceptance fixture, not a general-purpose embedding library. New public WIT functions require generated bindings and consumer assertions rather than hand-written production wrappers here.

## Changing the host

Keep the source buildable from the packaged archive in a clean directory. Do not add repository-relative includes or private generated files. If a Wasmtime API update changes the source, update the pinned toolchain path, package contents, compile command, and clean-consumer evidence together.

## Verification and evidence

[`../../scripts/test-wasi-consumer.mjs`](../../scripts/test-wasi-consumer.mjs) builds and runs the clean native consumer. [`../../tests/wit-backend.test.mjs`](../../tests/wit-backend.test.mjs) covers WIT generation and component probes. The [WIT projection evidence](../../docs/evidence/wit-projection.md) and [WIT/WASI consumer acceptance](../../docs/evidence/wasi-consumer-acceptance.md) record the generated interface, executed call, environment, and current limitations.
