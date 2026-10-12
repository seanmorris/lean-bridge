# nominalsubtypes

Use the prepared crate through Cargo. Public functions borrow strings, slices, records and big integers and return owned Result values. Rust widths enforce fixed-width integer ranges. Nat and Int use re-exported num-bigint BigUint and BigInt; Unit is (). Arrays use Vec, text uses String, bytes use Vec<u8>, and records are generated structs.

The crate embeds its compiled native libraries. Runtime loading is automatic and compatible crates share one Lean runtime. Executables work after the Cargo source tree is removed. Native extraction uses private directories removed after loading; small process registry files are removed at normal exit. Native libraries remain loaded until process exit. Requires Rust 1.90+, Linux x86-64, glibc matching the packaged platform record and writable /tmp. Forked reuse is rejected; embedding beside a runtime loaded outside this Rust loader is not accepted.

Pure acyclic copied types, at most 32 levels deep. Synchronous primitive callbacks accept FnMut functions returning Result and receive owned values. Returned LeanClosure values provide typed call, close and is_closed methods and automatic Drop cleanup. They are neither Send, Sync nor Clone. Callback errors return unchanged; unwinding panics resume in Rust after the native call returns. Abort cannot be caught. Host callbacks are borrowed only for the call; retained callback invocations fail. Compound callables, resources and async remain unsupported. Rust and native conversions each use a 16 MiB accounting budget; Rust array bookkeeping counts at least eight bytes per element. These limits do not bound Lean working memory or every Rust allocation. Native outputs use RAII even on errors or unwinding. Process abort and allocation failure that aborts Rust cannot run destructors.

- aliases: lean:NominalSubtypes.aliases
- array_values: lean:NominalSubtypes.arrayValues
- branch: lean:NominalSubtypes.branch
- combine: lean:NominalSubtypes.combine
- echo: lean:NominalSubtypes.echo
- echo_event: lean:NominalSubtypes.echoEvent
- echo_groups: lean:NominalSubtypes.echoGroups
- echo_pair: lean:NominalSubtypes.echoPair
- event_choices: lean:NominalSubtypes.eventChoices
- event_empty: lean:NominalSubtypes.eventEmpty
- event_first: lean:NominalSubtypes.eventFirst
- event_second: lean:NominalSubtypes.eventSecond
- event_value: lean:NominalSubtypes.eventValue
- first: lean:NominalSubtypes.first
- group_values: lean:NominalSubtypes.groupValues
- inspect_alias_pair: lean:NominalSubtypes.inspectAliasPair
- list_values: lean:NominalSubtypes.listValues
- nested: lean:NominalSubtypes.nested
- no_items: lean:NominalSubtypes.noItems
- optional: lean:NominalSubtypes.optional
- pair_values: lean:NominalSubtypes.pairValues
- plain_fin: lean:NominalSubtypes.plainFin
- produce_envelope: lean:NominalSubtypes.produceEnvelope
- product: lean:NominalSubtypes.product
- scalar: lean:NominalSubtypes.scalar
- second: lean:NominalSubtypes.second

Lean Fin n parameters and results use BigUint values below n. The bundled native library compares each argument with its exact bound, including bounds wider than 64 bits, before any Lean code runs; an argument at or above its bound returns Err(Error::Native { code: 1, .. }) whose message names the parameter and bound. Negative values are unrepresentable in BigUint. Fin 0 has no values, so every call to a function taking one fails. Results are BigUint values below their declared bound. Fin inside arrays, lists, options, products, Except values, records and variants is checked before Lean runs: every array or list element, a present option value, both product components, only the active Except branch, every record field and only the fields of the active variant case. An empty array, an absent option or an inactive branch or case is valid even for Fin 0. Bounds below list every element as name[*], a present option value as name?, product components as name.0 and name.1, the active branch as name.ok or name.error, a record field as name.field and a field of the active variant case as name.Case.field. Fin inside callbacks or generic record instantiations is not supported in Rust crates.

Lean Subtype parameters cross as their base value. The bundled native library runs the author's checked constructor, named below, before the export runs; a value the constructor rejects fails the call with the invalid-argument error naming the parameter and constructor, and the export receives the constructed value, which may differ from the input. Arrays, Lists, options, products and active result branches apply the same constructor checks to each Subtype leaf. Rejections identify the argument and nested element path. Subtype results are the base value. Reviewed APIs select the constructor and reconcile it with fresh Lean compilation. Copied plain records check each selected field; variants check only the active case. Repeated uses of one type retain their own constructor choices, and every Fin bound is checked before any constructor. Recursive, generic, owned and callback Subtype positions remain unsupported.

- nominalsubtypes::aliases: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit < 3; arg1[*]?.payload checked by NominalSubtypes.plusTwo; arg1[*]?.digit < 3
- nominalsubtypes::array_values: result[*] projects the Subtype base value
- nominalsubtypes::branch: result.ok projects the Subtype base value; result.error projects the Subtype base value
- nominalsubtypes::combine: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3; arg1.payload checked by NominalSubtypes.plusTwo; arg1.digit < 3
- nominalsubtypes::echo: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3; result.payload projects the Subtype base value; result.digit < 3
- nominalsubtypes::echo_event: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo; result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value
- nominalsubtypes::echo_groups: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit < 3; result[*]?.payload projects the Subtype base value; result[*]?.digit < 3
- nominalsubtypes::echo_pair: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit < 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit < 3; result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3
- nominalsubtypes::event_choices: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value
- nominalsubtypes::event_empty: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value
- nominalsubtypes::event_first: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo
- nominalsubtypes::event_second: arg0.box.value.payload checked by NominalSubtypes.plusTwo; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusTwo; arg0.choices.values[*]?.error checked by NominalSubtypes.plusOne
- nominalsubtypes::event_value: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value
- nominalsubtypes::first: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3
- nominalsubtypes::group_values: result[*]?.payload projects the Subtype base value; result[*]?.digit < 3
- nominalsubtypes::inspect_alias_pair: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit < 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit < 3
- nominalsubtypes::list_values: result[*] projects the Subtype base value
- nominalsubtypes::nested: arg0.left.payload checked by NominalSubtypes.plusOne; arg0.left.digit < 3; arg0.right.payload checked by NominalSubtypes.plusTwo; arg0.right.digit < 3
- nominalsubtypes::no_items: result[*] projects the Subtype base value
- nominalsubtypes::optional: result? projects the Subtype base value
- nominalsubtypes::pair_values: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3
- nominalsubtypes::plain_fin: arg0 < 3
- nominalsubtypes::produce_envelope: result.payload projects the Subtype base value; result.digit < 3
- nominalsubtypes::product: result.0 projects the Subtype base value; result.1 projects the Subtype base value
- nominalsubtypes::scalar: result projects the Subtype base value
- nominalsubtypes::second: arg0.payload checked by NominalSubtypes.plusTwo; arg0.digit < 3

Lean Option uses Rust Option, Except E T uses Result<T, E>, and binary products use (A, B), preserving their nesting. None, Some(()) and Some(None) retain presence. Compound inputs are borrowed; returned contents are owned independent copies. An exported Except result has two Result layers: the outer Result reports bridge failures, while the inner Result preserves the Lean domain success or error. These copied types can nest with arrays and records; they cannot contain callbacks or resources.

Lean List inputs borrow Rust slices and return owned Vec values, including nested copied values and record fields. Empty Lists, order and duplicates are preserved. List and Array retain distinct contract identities. List callback payloads remain unsupported.

Concrete copied Lean aliases export named pub type declarations, retaining alias chains and named record fields. They use their targets' Rust values without newtype wrappers. String and byte inputs still borrow str and u8 slices; Array and List inputs borrow slices. Other aggregate inputs borrow their named aliases. Results own their copied contents. Aliases of Nat use BigUint, so negative inputs do not typecheck. Recursive and identity-bearing alias targets, and compound callable payloads remain unsupported.

Concrete copied Lean variants export named Rust enums. Empty cases are unit variants; payload cases have named fields. Construct and match these cases without numeric tags or unsafe code. Constructor names use PascalCase and fields use snake_case, with reserved words gaining a trailing underscore. Inputs borrow the enum and outputs own independent copied contents. Only the active payload is converted. Variants can contain supported copied records, containers and other non-recursive variants. Conversion errors and unwinding release temporary storage and native outputs through RAII. Recursive, callable and identity-bearing payloads remain unsupported.
