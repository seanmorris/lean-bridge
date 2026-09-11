# Perl native package acceptance, 11 September 2026

VO1237 adds the `native-library-v1` Perl backend to the type-surface effort in VO1208. These checks used the working tree based on `e603b1cd70bb009a4ec0f4b47abb33a079707090`. The [type inventory](../type-surface.v1.json) pins the tested source files by SHA-256. No package was uploaded to CPAN or npm.

## Installed execution

`npm run test:consumer:perl` built and installed ordinary Workshop and Other projects on Perl 5.36.3 and 5.38.2, with threaded and nonthreaded builds. Each configuration ran 183 API checks. The two interpreter-thread checks are skipped on nonthreaded builds. The suite also tests prebuilt-only installation with compiler stubs, explicit XS-only installation with Lean/Lake/Node stubs, automatic XS fallback, mismatched runtime and ABI identities, missing compilers and corrupt artifacts.

The host has glibc 2.36, so the development matrix used:

```sh
LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 npm run test:consumer:perl
```

Separately prepared, four-ABI archives declare the production glibc 2.38 floor. They were installed in an `emscripten/emsdk:6.0.6` container running glibc 2.39, using both `prebuilt-only` and `build-xs` on all four Perls. Each installation passed the 173 Workshop checks and ran the documentation example unchanged, printing `42`, `42`, `42`, `41`. The ten additional matrix checks use the independently compiled Other project.

The two production archives matched byte-for-byte across independent native and XS builds:

| Archive | SHA-256 |
| --- | --- |
| `LeanBridge-Runtime-0.001.tar.gz` | `cc5e66b72119f02388f9daab902b76cd1467f3c3f8740e987aa5add4f356a582` |
| `LeanBridge-Workshop-0.001.tar.gz` | `0ffdab7d4c1787480beab4bb172d50bed1220dee7e75a7449ae8a8b642d1697a` |

Both distributions contain all four prebuilt ABI fingerprints. Production archive assembly reused the verified XS and native bytes, changed the target metadata to the production floor, and invoked no compiler. Native component SHA-256: `c7c0bf719bb6c7816a0bad4157e72dad738349f82a17037a854c2bf0ebd04bed`. Perl binding runtime identity: `8a394bdc579b6d4c7cc7da9f4e723aa05fd07cc739c4eaa14039264cb78583bd`.

## Type and lifetime checks

The installed fixture covers all sixteen scalar types as parameters, results, record fields and callback values. Integer checks include complete fixed-width endpoints and arbitrary integers through 4096-bit boundaries. Text checks distinguish Unicode with embedded NUL from binary octets. Float checks cover binary32 rounding and binary64 NaN, infinity and signed zero. The copy budget is 16 MiB per call.

Copied coverage includes nested Label/Packet records, the compiler-unboxed Reading record, arrays of records and `Array UInt32`. It does not establish every possible array element or record shape. A BigInt method and tied scalar release the caller's record or array reference during conversion; retained conversion storage keeps those calls valid.

Resource and closure checks cover canonical identity across components, wrong-kind and stale objects, explicit and repeated close, finalization, reentry, self-close during a callback, original exception objects and failed return conversion. A thousand create/close cycles leave no live conversion scopes, callbacks, wrappers or native identities. Retained host callbacks, calls from another interpreter thread and calls after fork are rejected.

The elaborator checks reject partial exports, partial dependencies behind opaque public declarations, admitted definitions, generic or dependent signatures, unreviewed foreign dependencies and unboxed records incorrectly selected as identity resources. The compiler compares generated C prototypes with Lean's emitted definitions before linking. Lean resolves import dependencies from the source snapshot.

## Timing

The Perl 5.38.2 threaded run on an Intel Core i7-7700K recorded these medians. Each steady-state case uses nine warmed samples. Perl performs 100,000 iterations per sample; direct C performs 1,000,000 calls into the same compiled Lean library.

| Operation | Installed Perl API | Direct C |
| --- | --- | --- |
| UInt32 addition | 688 ns | 1.38 ns |
| Copy 1024 bytes | 816 ns | 39.1 ns |
| Synchronous callback | 2,461 ns | 54.9 ns |

The scalar baseline is a tiny native operation, so its relative cost is about 500 times despite the sub-microsecond Perl call. These measurements include the Perl benchmark's dispatch loop. They are observations from this machine, not release budgets.

Fresh-process startup had a median of 775 ms across five samples, including process launch, imports, artifact hashing and runtime initialization. The OS page cache was not cleared. Startup remains separate from steady-state timing. The runtime archive is about 49 MiB compressed because it includes Lean's shared standard libraries.

## Remaining coverage

The native builder handles local Lean modules and the pinned standard libraries. External Lake package dependencies, open generics, dependent signatures, recursive copied types, identity fields, retained callbacks, asynchronous delivery and iterators remain outside this profile. Reviewed-IR-only Perl compilation is not supported. These gaps remain in VO1208 and its dependent work; the installed examples do not close them.

Nix syntax, derivation evaluation and the engine's source-file closure passed. Full Nix execution could not be completed: the shared Lean toolchain derivation exhausted the available disk while copying its installation. Its temporary container was removed. The shared PHP broker source is byte-identical to the previous implementation; native PHP integration could not run on this host without its libuv/PHP development environment.
