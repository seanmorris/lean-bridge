# Type-surface mapping audit, 10 September 2026

Source baseline: `78cbc7278fa0c2ffd2be09df5660f05628397310`. The [inventory](../type-surface.v1.json) separates ordinary-source and reviewed-IR paths, five pipeline stages, and each value position. Its source hashes identify the code inspected for every recorded observation.

## Current mappings

The ordinary npm path compiles 16 primitive input/result types. Its installed scalar tests cover exact integers, IEEE values, Unicode, copied bytes and shared-runtime composition. VO1195's accepted arbitrary-integer repair remains in effect; the inventory does not reopen that defect.

JavaScript's reviewed-IR coverage guard accepts arrays but rejects anonymous Option, result and tuple applications. Their renderer branches do not establish generation support. PHP's projection describes a Result class, but its generator rejects result applications. PHP rejects nested Option and Option Unit because its nullable representation loses cases. Python's nullable Option spelling needs the same distinction before general nested-option support can be claimed.

Rust rejects Nat and Int as unsupported arbitrary integers. C emits buffer structures for dynamic primitives; those declarations alone do not establish exact arbitrary-integer transport. C's constructed-value guard admits only arrays of fixed-width primitives.

C++, C#, Java, Kotlin and Ruby currently render fixed Alpha APIs. Their accepted Payload, Box and UInt32 callable cases do not establish mappings for unrelated scalar types or new signatures. In particular, C++ checks declaration IDs while retaining a fixed header; matching IDs are insufficient evidence that changed types are preserved.

The generated WIT declares more types than its packaged executable exposes. That executable implements a u32-to-u32 probe through a native Lean Box host. The Wasm wrapper's address width does not determine the native Lean runtime's word size.

## PHP-Wasm integer boundary

VO1206 records the existing reproduction on PHP-Wasm 0.1.0 / PHP 8.4: `PHP_INT_SIZE` is 4 and `PHP_INT_MAX` is 2147483647. Box reads at the maximum signed value succeed. Alpha's roundTrip increments that count and fails when its result enters the unsigned upper half. A strict PHP call cannot accept the numeric literal 4294967295 as an int on this host.

Native PHP on the documented 64-bit profile accepts the full UInt32 range. Node's bigint type does not change PHP's integer representation. The shared PHP generator's numeric metadata does not repair this defect. Input, result, field and callback boundary acceptance remains assigned to VO1206 and VO1218.

## Consumer execution evidence

Completed VO672 accepted cross-language parity from a shared fixture. VO939 accepted that fixture through both PHP transports. VO980 accepted installed managed packages and Alpha/Beta composition with declared capability gaps. VO1193 generated the CLI, npm scalar and algorithm references. None of those acceptance scopes covers every Lean type in every position; the new inventory preserves their results without treating them as full-surface delivery.

The [downstream CI run at 4349783](https://github.com/seanmorris/lean-bridge/actions/runs/34437505506) passed all consumer jobs. Its uploaded observations report package installation and real Lean execution for Node, browser, PHP, native, managed and WASI profiles. These consumer-level observations do not include per-type archive identities. They therefore do not promote every generator mapping to installed type support.

The [native acceptance](native-consumer-acceptance.md), [managed acceptance](managed-consumer-acceptance.md), [PHP release gate](php-release-gate.md) and [WASI acceptance](wasi-consumer-acceptance.md) retain their named fixture scopes. The language guides keep those executable examples separate from the generated full-surface tables.

## Reproduce the documentation checks

```sh
npm run types:check
npm run types:report -- --profile rust --shape nat
npm run docs:reference
npm run test:type-surface
npm run test:docs
```

These checks validate the inventory and documentation; they do not rerun installed consumer acceptance. Unreviewed cells, inspected generators and rejected mappings remain delivery work. No new runtime type support or package publication is claimed by this audit.
