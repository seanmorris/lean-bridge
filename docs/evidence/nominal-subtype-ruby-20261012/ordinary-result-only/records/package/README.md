# LeanBridge::Nominalsubtypes

Require "lean_bridge/nominalsubtypes" and call LeanBridge::Nominalsubtypes functions. Prepared gems include the native component and shared runtime, which load automatically. Requires MRI Ruby 3.3 on Linux x86-64. No Lean compiler or extension build is needed by consumers.

Unit is LeanBridge::Nominalsubtypes::UNIT in every position. Integers remain exact; fixed-width values are range checked and Nat rejects negatives. Float32 rounds to binary32. Strings require valid UTF-8 or US-ASCII, including embedded NUL; ByteArray uses binary String. Arrays and generated keyword-initialized record values are copied at each call. Nil is rejected outside Option positions; implicit numeric coercions are rejected. Copied types must be pure, acyclic and at most 32 levels deep. Native input/output copies share a 16 MiB budget; input scratch is separately bounded. Native buffers are freed on failure. Compatible gems share one runtime for the process lifetime. Ractors and native-library unloading are not supported.

- LeanBridge::Nominalsubtypes.array_values: lean:NominalSubtypes.arrayValues
- LeanBridge::Nominalsubtypes.branch: lean:NominalSubtypes.branch
- LeanBridge::Nominalsubtypes.event_choices: lean:NominalSubtypes.eventChoices
- LeanBridge::Nominalsubtypes.event_empty: lean:NominalSubtypes.eventEmpty
- LeanBridge::Nominalsubtypes.event_value: lean:NominalSubtypes.eventValue
- LeanBridge::Nominalsubtypes.group_values: lean:NominalSubtypes.groupValues
- LeanBridge::Nominalsubtypes.list_values: lean:NominalSubtypes.listValues
- LeanBridge::Nominalsubtypes.no_items: lean:NominalSubtypes.noItems
- LeanBridge::Nominalsubtypes.optional: lean:NominalSubtypes.optional
- LeanBridge::Nominalsubtypes.pair_values: lean:NominalSubtypes.pairValues
- LeanBridge::Nominalsubtypes.produce_envelope: lean:NominalSubtypes.produceEnvelope
- LeanBridge::Nominalsubtypes.product: lean:NominalSubtypes.product
- LeanBridge::Nominalsubtypes.scalar: lean:NominalSubtypes.scalar

Lean Fin n parameters and results are exact Integer values below n. The bundled native library compares each argument with its exact bound, including bounds wider than 64 bits, before any Lean code runs. A non-Integer argument raises TypeError and a negative Integer raises RangeError, as for Nat; an Integer at or above its bound raises RangeError whose message names the Lean parameter and bound. Fin 0 has no values, so every call to a function taking one is rejected. Results are Integer values below their declared bound. Fin inside arrays, lists, options, products, Except values, records and variants is checked before Lean runs: every array or list element, a present option value, both product components, only the active Except branch, every record field and only the fields of the active variant case. An empty array, an absent option or an inactive branch or case is valid even for Fin 0. Bounds below list every element as name[*], a present option value as name?, product components as name.0 and name.1, the active branch as name.ok or name.error, a record field as name.field and a field of the active variant case as name.Case.field. Fin inside callbacks or generic record instantiations is not supported in Ruby gems.

Lean Subtype parameters cross as their base value. The bundled native library runs the author's checked constructor, named below, before the export runs; a value the constructor rejects fails the call with the invalid-argument error naming the parameter and constructor, and the export receives the constructed value, which may differ from the input. Arrays, Lists, options, products and active result branches apply the same constructor checks to each Subtype leaf. Rejections identify the argument and nested element path. Subtype results are the base value. Reviewed APIs select the constructor and reconcile it with fresh Lean compilation. Copied plain records check each selected field; variants check only the active case. Repeated uses of one type retain their own constructor choices, and every Fin bound is checked before any constructor. Recursive, generic, owned and callback Subtype positions remain unsupported.

- LeanBridge::Nominalsubtypes.array_values: result[*] projects the Subtype base value
- LeanBridge::Nominalsubtypes.branch: result.ok projects the Subtype base value; result.error projects the Subtype base value
- LeanBridge::Nominalsubtypes.event_choices: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value
- LeanBridge::Nominalsubtypes.event_empty: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value
- LeanBridge::Nominalsubtypes.event_value: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value
- LeanBridge::Nominalsubtypes.group_values: result[*]?.payload projects the Subtype base value; result[*]?.digit < 3
- LeanBridge::Nominalsubtypes.list_values: result[*] projects the Subtype base value
- LeanBridge::Nominalsubtypes.no_items: result[*] projects the Subtype base value
- LeanBridge::Nominalsubtypes.optional: result? projects the Subtype base value
- LeanBridge::Nominalsubtypes.pair_values: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3
- LeanBridge::Nominalsubtypes.produce_envelope: result.payload projects the Subtype base value; result.digit < 3
- LeanBridge::Nominalsubtypes.product: result.0 projects the Subtype base value; result.1 projects the Subtype base value
- LeanBridge::Nominalsubtypes.scalar: result projects the Subtype base value

Options use nil or Some.new(value). Some.new(nil) is an outer Some containing an inner None; Some.new(UNIT) retains presence for Unit. Nil is admitted only at Option positions.

Results use Ok.new(value) or Err.new(error). Domain errors return Err; bridge failures raise.

Branch wrappers are frozen Data classes with value equality and pattern matching. Wrapper fields are frozen, but nested strings and arrays remain mutable.

Products use exactly two Array elements and preserve nesting.

Payloads are checked against the concrete Lean type when called; no implicit coercion is used. Returned values own independent storage.

Conversions use builtin exact-type checks and bounded snapshots of String bytes and Array slots. Overridden instance methods cannot change the native allocation size, copy length or element selection. Generated record and constructor fields are read from stored values, not overridden accessors. Inputs must not be mutated concurrently if a consistent snapshot of the entire nested value is required.

Generated records and variant constructors support field-by-field ==, eql?, hash and deconstruct_keys. Equality requires the same Ruby class and follows the contained values' Ruby semantics, including floating-point behavior. Objects are frozen; nested arrays and strings remain mutable. Do not mutate a nested payload while using its containing value as a Hash key.

Lean List inputs, results and record fields use copied Ruby Array values. Exact Array instances are required; no implicit to_ary conversion is used. Empty Lists, order, duplicates and nesting are preserved. Returned arrays and mutable payloads own independent storage. List and Array retain distinct IR/native identities. Native sequence lengths, missing buffers and alignment are checked before allocation or reads. List callback payloads remain unsupported.

## Copied Lean aliases

Call with ordinary Ruby target values. Alias names, original targets and chains remain in the binding manifest and public Ruby source comments. They do not create Ruby constants, wrapper classes or RBS declarations. Parameters, results and record fields retain the target checks: Nat rejects negative Integer values; fixed-width and machine-word integers retain their range; Char requires one Unicode scalar. Unit is the generated UNIT singleton, not nil. Arrays, strings and record contents copy independently. The existing copy budgets, type-depth bound and ownership rules apply. Recursion, compound callable payloads and identity-bearing targets remain unsupported.

| Lean alias | Contract target | Ruby value |
| --- | --- | --- |
| `EnvelopeAlias` | `Envelope` | `LeanBridge::Nominalsubtypes::Envelope` |

Concrete copied Lean variants use named constructor classes such as Signal::Data.new(count: 42, label: "ready"). Constructor payloads use required keyword arguments and read-only accessors; deconstruct_keys supports Ruby pattern matching. Constructor objects are frozen, but contained strings and arrays remain mutable and are copied at the boundary. The abstract family cannot be constructed with new. Unknown subclasses, nil cases, wrong field values and invalid native tags reject. Only the active payload is converted. Empty constructors and UNIT payloads remain distinct. Ruby does not check match exhaustiveness. Generic, indexed, recursive, proof-bearing, callable and identity-bearing payloads remain unsupported.
