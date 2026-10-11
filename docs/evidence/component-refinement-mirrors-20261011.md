# Shared native and component refinement mirrors

The native generator and the private component generator now share typed Lean mirror definitions. Each input use retains its selected Subtype constructor. Lean-produced results erase their proofs without running an input constructor. Component mirrors cover copied acyclic records, variants, aliases and structural containers, including empty and inactive cases. Shared Fin bounds retain the same representation when a child appears independently and inside a Subtype-bearing record.

The component transport validates every argument's Fin bounds before calling any selected constructor. The generated C frame dispatcher performs this preflight across all parameters, and each generated Lean wrapper repeats it before conversion. These checks do not call Subtype constructors. Carriers assemble erased values; they do not invent proofs or assume a record's source constructor is named `mk`.

This milestone is generator support. Its private component fixtures are independently authored, not fresh public compiler metadata. Public component admission, original Binding IR provenance checks, package installation and downstream acceptance remain separate work. No support claim is promoted.

## Validation

Fresh Lean compilation checked 83 assertions: 40 for each export order and three for a result-only package. The assertions exercise per-use constructors, invalid Fin and Subtype payloads, active variants, aliases, mixed shared bounds, empty/malformed carriers and constructor-independent result projection. Lean emitted C for all three generated modules and produced no warnings. This probe did not separately compile that C for wasm32.

- TAP: `build/vo1444-component-mirror-source-r3.tap`, SHA256 `d107e45c1a78ba11a5bb9ee7aad5c389bdcacd09d2a17739f43e5e072eb5dd31`.
- Report: `build/vo1444-component-mirror-source-r3/report.json`, SHA256 `62d4af540391dd2bd1eeddbf73c0ad9f4d2d9a750b6616a83774b2b7818afc3a`.

The first source probe used `decide` for assertions involving Array operations that did not reduce. Those assertions now use `native_decide`; the failed probe remains recorded. The final assertions also check that Fin-only guards accept a numerically valid Fin payload even when its companion Subtype input would fail its selected constructor.

Focused generator and compatibility tests passed 42 checks, with zero failures and four explicitly gated tests. TAP: `build/vo1444-component-mirror-controls-r2.tap`, SHA256 `79edbfd597d4a29ebceda6f85aa54f10f6602e803e2dfdaa0aef7253b1b80752`. Native generated-object hashes remain byte-identical for both the nominal Subtype fixture and its Fin-only control.

Five existing fresh checked-record controls passed, including native C/C++ compilation, raw Lean rejection, reviewed reconciliation, component mirrors and result-only checked records. TAP: `build/vo1444-component-mirror-checked-controls-r1.tap`, SHA256 `9a411ac6381166a47433ac1b4b8b31ac6dc59b8798f0734bac6d095a1a01fa9f`.

The native Subtype and inventory/documentation roots passed 85 checks, with zero failures and seven gated tests. TAP: `build/vo1444-component-mirror-inventory-r1.tap`, SHA256 `48f6eb533279f830864001c130c7f8120c31d5c64d505f0d3c67ca7b6b780587`. Targeted lint passed. A broader historical-receipt run was deliberately stopped before completion and is not counted as a pass. Validation ran serially at low CPU and I/O priority after the host-load incident.

The final generator-only rerun passed ten checks, with one gated fresh-compiler check: `build/vo1444-component-mirror-final-r1.tap`, SHA256 `d9ea960fbd54a0064201d01681f2e5895891776f3c5daf38837cdd37fd83ed53`. Checked JavaScript and all sixteen generated reference pages passed.

## Source history

The ledger records ten exact transitions from `d667b896c507806d848d39b5053fed7fa8657ee8` and refreshes 313 source pins. It preserves the 472 evidence entries and 571 observations. Ledger SHA256: `a5e37d543835e2e52f506b6e9387471484f5d745434b1a59f62fed623cb6f6d9`. Earlier ledgers and receipts remain immutable.

An independent audit verified the inverse transitions, pin-only inventory changes and all 10,019 earlier evidence files against the predecessor commit.

The existing downstream CI run targets `b0cabee3ac47be0feeb4cf7154b3ce32ecfa56f5`, before these changes. Its JVM Fin edge observer failed after GDB reported `No unwaited-for children left` and supplied no normal process-exit event. The observer refused the run. This milestone neither relaxes that requirement nor treats the failed observation as a pass.
