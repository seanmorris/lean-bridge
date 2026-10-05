# WIT primitive callable projection, 2026-09-19

VO1218 now has a staged WIT contract for primitive callbacks and returned functions. The generated component executes against synthetic C imports through Wasmtime 42.0.1. This milestone does not execute Lean callables, build a callable package or advance installed type coverage.

## Contract and execution

Each callable signature has a named WIT resource. Callback arguments use `borrow<function-...>`; returned functions use `own<function-...>`. A typed `invoke-function-...` export accepts a borrow of that resource. The public API re-exports the native interface's resource identity. It does not expose an untyped integer handle.

The independent fixture has 61 declarations and 39 resource signatures. It covers all 19 primitives, a 16-argument function and two callbacks after mixed-width scalars, strings, limbs and byte lists. wasm-tools 1.245.1 parses and validates the component. The test compares every source WIT type and function against the decoded binary, including ownership and resource aliases.

The C probe compiles with `-std=c11 -Wall -Wextra -Werror`, then runs with compiler paths disabled. The test verifies the Wasmtime library, headers and license against the same pinned file inventory used by package builds.

| Observation | Result |
| --- | ---: |
| Primitive value cases | 114 |
| Component calls | 825 |
| Resources created and released | 236 / 236 |
| Returned-resource destructor calls | 115 |
| Callback re-entry cases | 2 |
| Maximum successful nesting depth | 64 |
| Deliberately broken components rejected | 2 |

Values include integer endpoints, a 4,097-bit natural, both signs of zero, infinities, NaNs, Unicode scalar boundaries, UTF-8 with embedded NUL, and byte lists. NaN payload bits are not compared. Returned functions select either a captured value or the supplied argument. Callbacks remain owned by their caller across repeated borrows. Deleting an alias wrapper does not dispose its logical resource; a second logical disposal fails.

## Bugs caught by the probe

The forwarding instance must drop its borrowed resource handles after the native import returns. Releasing the native host's borrow alone leaves guest handles live and causes Wasmtime to reject the completed call. Cleanup now handles direct parameters and byte offsets in indirect canonical records.

A nested call's post-return must preserve the outer call's scratch memory. Resetting the allocator after every call corrupted a large returned natural when a callback re-entered the component. Callable projections now keep up to 64 nested heap marks and reset memory only after the outermost successful call. The probe succeeds at depth 64 and traps at depth 65. The 64 MiB scratch-memory cap remains in place. Both bugs have mutation tests that compile a valid but deliberately broken component and require the runtime probe to reject it.

## Remaining work

A trapped callback bypasses guest borrow cleanup. The probe confirms that an outstanding borrow prevents reclaiming its owner through Wasmtime. It discards that store, reclaims the synthetic host registry, and verifies a fresh instance. The native Lean bridge still needs equivalent cleanup for real callback and closure leases, plus same-agent dispatch, identity checks, self-disposal and nested-failure handling.

After that integration, both ordinary-source and reviewed-IR packages need relocated, compiler-free installed execution against independent Lean results. Until those checks pass, the normal WIT generator rejects callable input. The native host generator also explicitly rejects the staged model.

The type inventory remains at 2,190 / 6,562 installed-tested cells. The callable pass has two target families left: WIT/WASI and npm's Node JavaScript, Node TypeScript, browser JavaScript, React and worker profiles. Compound values, generic resources and asynchronous operations belong to later work.

## Regression and reproduction

The copied-only WIT, WAT and manifest bytes match the previous generator for 76 models: 19 primitives, scalar/array values, and one/17 parameters. The existing Cobalt/Saffron installed suite checks real Lean copied values separately. Historical archive hashes in the type inventory remain historical; refreshing generator source hashes does not turn this probe into installed callback evidence.

The fresh installed regression passed all four tests with local glibc floor 2.36. It reproduced these archive hashes from relocated source trees:

| Archive | SHA-256 |
| --- | --- |
| `cobalt-api-2.0.0-rc.1-wit-wasi.tar.gz` | `dc55f17220818cd166c54656c0a9dfd260a0eae354d896561fdb91625d17ddc1` |
| `cobalt-0.0.0-local-c.tar.gz` | `81113e84a28d86435a4a862230f61b27b750cace10493ac54415ee36ee4b7ed1` |
| `saffron-api-2.0.0-rc.1-wit-wasi.tar.gz` | `64fe214bdac337498f8a34d9e0b3ec7223c61c3e7e5482d74cc1f2162b37e540` |
| `saffron-0.0.0-local-c.tar.gz` | `ec2ce42cedd5ae8dcc8aa52b52b682b494163d7ea94c60ef62354a295c0595fe` |

Follow the [test commands](../contributing/testing.md#staged-wit-callable-projection). The consumer CI job runs both the installed copied-value suite and this staged probe. No registry publication or push accompanies this milestone.

Resource semantics follow the [Component Model WIT specification](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md). Ownership checks use the pinned [Wasmtime 42 resource implementation](https://github.com/bytecodealliance/wasmtime/blob/v42.0.1/crates/wasmtime/src/runtime/component/resources/any.rs) and its C API.
