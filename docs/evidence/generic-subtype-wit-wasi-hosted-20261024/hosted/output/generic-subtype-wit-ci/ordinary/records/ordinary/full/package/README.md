# nominalsubtypes 1.0.0

WIT API compiled from nominalsubtypes@1.0.0. Linux x86-64, glibc 2.38 or newer. The archive includes Wasmtime 42.0.1 and the compiled native Lean runtime. Consumers do not install Lean. Keep lib/ and include/ together.

Use pkg-config nominalsubtypes-wit, include nominalsubtypes_wasmtime.h, open a session with nominalsubtypes_wasmtime_open, and call a WIT function by name with nominalsubtypes_wasmtime_call. Calls cross the embedded Component Model component. nominalsubtypes_wasmtime_link supplies the native import to custom Wasmtime embeddings loading component/nominalsubtypes.wasm. The component requires its native host; it is not a standalone WASI command. The host helper embeds exactly the same component bytes.

Arguments borrow caller-owned Wasmtime C values. Delete each owned result with wasmtime_component_val_delete; results remain valid after closing the session. Errors return an owned wasmtime_error_t and leave the result unchanged. Delete errors with wasmtime_error_delete. Close sessions with nominalsubtypes_wasmtime_close. Do not call one session concurrently. Separate sessions and components share the native Lean runtime automatically.

Unit is enum { unit }, including arguments, results and fields. Nat is list<u32>, least-significant limb first; [] is zero. Int is { negative: bool, limbs: list<u32> }. Reject trailing zero limbs and negative zero. Fixed-width values use their WIT scalar widths. Float values preserve NaN classification, infinities and signed zero. Strings are UTF-8 including NUL; bytes are list<u8>. Options use option<T>, results use result<Success, Error>, and binary products use nested tuple<A, B>. Unit stays a single-case enum even inside an option or result, preserving present Unit and nested options. Lean Lists and Arrays both use canonical WIT `list<T>`, preserving order, duplicates and empty sequences. They retain distinct IR constructors and native C types. Returned sequences own independent storage. List parameters, results and record fields are supported; List callback payloads are not. Compound payloads compose with arrays, Lists and acyclic records, at most 32 types deep; empty records use a single-case enum { empty }. Record entries follow WIT field order. No resources, callbacks or effectful exports are admitted here.

The adapter enforces a 16 MiB conversion budget, counting Wasmtime slots and native scratch copies; the native C adapter also enforces its combined input/output budget. Canonical-ABI scratch memory is capped at 64 MiB and reset after each successful call. The session helper replaces a trapped store before reuse; custom embeddings must discard a trapped instance. These limits do not bound Lean algorithm or Wasmtime engine working memory. Native scratch allocation failures return errors and free scratch buffers. Wasmtime's allocation API does not expose recoverable out-of-memory errors.

- echo-generic-first: lean:NominalSubtypes.GenericCompositions.echoGenericFirst
- echo-generic-second: lean:NominalSubtypes.GenericCompositions.echoGenericSecond
- generic-use: lean:NominalSubtypes.GenericCompositions.genericUse
- aliases: lean:NominalSubtypes.aliases
- array-values: lean:NominalSubtypes.arrayValues
- branch: lean:NominalSubtypes.branch
- combine: lean:NominalSubtypes.combine
- echo: lean:NominalSubtypes.echo
- echo-event: lean:NominalSubtypes.echoEvent
- echo-groups: lean:NominalSubtypes.echoGroups
- echo-pair: lean:NominalSubtypes.echoPair
- event-choices: lean:NominalSubtypes.eventChoices
- event-empty: lean:NominalSubtypes.eventEmpty
- event-first: lean:NominalSubtypes.eventFirst
- event-second: lean:NominalSubtypes.eventSecond
- event-value: lean:NominalSubtypes.eventValue
- first: lean:NominalSubtypes.first
- group-values: lean:NominalSubtypes.groupValues
- inspect-alias-pair: lean:NominalSubtypes.inspectAliasPair
- list-values: lean:NominalSubtypes.listValues
- nested: lean:NominalSubtypes.nested
- no-items: lean:NominalSubtypes.noItems
- optional: lean:NominalSubtypes.optional
- pair-values: lean:NominalSubtypes.pairValues
- plain-fin: lean:NominalSubtypes.plainFin
- produce-envelope: lean:NominalSubtypes.produceEnvelope
- product: lean:NominalSubtypes.product
- scalar: lean:NominalSubtypes.scalar
- second: lean:NominalSubtypes.second

## Copied Lean aliases

The WIT source and compiled component retain named aliases, their chains and original parameter, result, record-field and variant-field references. binding-manifest.json records each Lean name and original target. Callers pass ordinary target values; aliases introduce no wrapper objects or resources. Conversion rules, independent result ownership and existing copy limits apply unchanged. USize and ISize use this native profile's 64-bit widths. Alias payloads inside callback signatures, recursive copied values and identity-bearing alias targets remain unsupported.

| Lean alias | Original target | WIT name |
| --- | --- | --- |
| `EnvelopeAlias` | `Envelope` | `envelope-alias` |

## Copied Lean variants

Each Lean family becomes a named WIT variant. Empty constructors have no payload. Every nonempty constructor carries a named record, even a single Unit field, so an empty case and a present Unit remain distinct. Payload records retain field names and order. WIT labels use lowercase kebab-case; keywords use a percent escape in WIT source. Names that cannot use that spelling receive an unambiguous encoded label. binding-manifest.json records each original Lean name, field type and WIT spelling.

Use named Wasmtime variant discriminants and the selected payload record. Constructor numbers, native C union layouts and Lean object layouts are not the public WIT contract. Conversions reject unknown cases, missing or extra payloads, wrong field names, types and order. Returned variants own independent copies and remain valid after closing the session. Compare constructor names and selected fields recursively, not allocation addresses. Only the selected constructor's payload is read or released.

Variants compose with named aliases, arrays, Lists, records, options, results and products under the existing 32-level shape limit and conversion budgets. Callable payloads, recursive copied values and identity-bearing fields are not admitted by this profile yet. The compiler's own datatype limits still apply: Lean 4.32.2 supports boxed constructor tags through 243; empty constructors can use higher tags.

| Lean family | WIT name | Constructors |
| --- | --- | --- |
| `Event` | `event` | 3 |

## Bounded integers

Lean Fin n parameters and results use the Nat representation, list<u32> little-endian limbs, with values below n. The bundled native library compares each argument with its exact bound, including bounds wider than 64 bits, before any Lean code runs; an argument at or above its bound fails the call with a Wasmtime error whose message names the Lean parameter and bound, leaving the result slot unchanged. Fin 0 has no values, so every call to an export taking one fails. Results are limb lists below their declared bound. Fin inside arrays, lists, options, products, Except values, records and variants is checked before Lean runs: every array or list element, a present option value, both product components, only the active Except branch, every record field and only the fields of the active variant case. An empty array, an absent option or an inactive branch or case is valid even for Fin 0. Bounds below list every element as name[*], a present option value as name?, product components as name.0 and name.1, the active branch as name.ok or name.error, a record field as name.field and a field of the active variant case as name.Case.field. Fin inside callbacks or generic record instantiations is not supported in WIT packages.

Lean Subtype parameters cross as their base value. The bundled native library runs the author's checked constructor, named below, before the export runs; a value the constructor rejects fails the call with the invalid-argument error naming the parameter and constructor, and the export receives the constructed value, which may differ from the input. Arrays, Lists, options, products and active result branches apply the same constructor checks to each Subtype leaf. Rejections identify the argument and nested element path. Subtype results are the base value. Reviewed APIs select the constructor and reconcile it with fresh Lean compilation. Copied plain records check each selected field; variants check only the active case. Repeated uses of one type retain their own constructor choices, and every Fin bound is checked before any constructor. Recursive, generic, owned and callback Subtype positions remain unsupported.

- echo-generic-first: arg0.value checked by NominalSubtypes.plusOne; result.value projects the Subtype base value
- echo-generic-second: arg0.value checked by NominalSubtypes.plusTwo; result.value projects the Subtype base value
- generic-use: arg0.value checked by NominalSubtypes.plusOne
- aliases: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit < 3; arg1[*]?.payload checked by NominalSubtypes.plusTwo; arg1[*]?.digit < 3
- array-values: result[*] projects the Subtype base value
- branch: result.ok projects the Subtype base value; result.error projects the Subtype base value
- combine: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3; arg1.payload checked by NominalSubtypes.plusTwo; arg1.digit < 3
- echo: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3; result.payload projects the Subtype base value; result.digit < 3
- echo-event: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo; result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value
- echo-groups: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit < 3; result[*]?.payload projects the Subtype base value; result[*]?.digit < 3
- echo-pair: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit < 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit < 3; result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3
- event-choices: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value
- event-empty: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value
- event-first: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo
- event-second: arg0.box.value.payload checked by NominalSubtypes.plusTwo; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusTwo; arg0.choices.values[*]?.error checked by NominalSubtypes.plusOne
- event-value: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value
- first: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3
- group-values: result[*]?.payload projects the Subtype base value; result[*]?.digit < 3
- inspect-alias-pair: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit < 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit < 3
- list-values: result[*] projects the Subtype base value
- nested: arg0.left.payload checked by NominalSubtypes.plusOne; arg0.left.digit < 3; arg0.right.payload checked by NominalSubtypes.plusTwo; arg0.right.digit < 3
- no-items: result[*] projects the Subtype base value
- optional: result? projects the Subtype base value
- pair-values: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3
- plain-fin: arg0 < 3
- produce-envelope: result.payload projects the Subtype base value; result.digit < 3
- product: result.0 projects the Subtype base value; result.1 projects the Subtype base value
- scalar: result projects the Subtype base value
- second: arg0.payload checked by NominalSubtypes.plusTwo; arg0.digit < 3

## Loaded-library identity

The host checks the loaded native adapter, Lean component, both runtime libraries and Wasmtime against the sizes and SHA-256 hashes in its compiler receipts. A conflicting library already loaded under the same name makes session opens, calls and custom-linker imports return an error. Keep the installed library files unchanged while loading hosts. Inherited hosts reject calls and session opens after fork; exec a fresh consumer process. Closing an inherited session in the child does nothing. The parent still owns its session.
