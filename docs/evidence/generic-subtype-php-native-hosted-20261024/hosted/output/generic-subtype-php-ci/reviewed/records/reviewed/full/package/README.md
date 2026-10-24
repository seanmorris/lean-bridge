# LeanNominalsubtypes

Install the prepared Composer archive and require vendor/autoload.php. Call the generated LeanNominalsubtypes functions. The package includes the compiled Lean libraries and loads its runtime automatically. Consumers do not compile Lean or configure a package-specific Zend extension.

Requires PHP 8.2+ (below 9), NTS CLI, Linux x86-64, the packaged glibc floor, and FFI enabled. This copied-value profile does not cover FPM, Apache, cli-server, ZTS or PHP-Wasm. Compatible packages share one process runtime; post-fork calls and an already loaded foreign Lean runtime are rejected. No per-package or shared runtime files are written during use.

Unit is null. Fixed-width integers use range-checked PHP int except UInt64, which uses BigInteger. Nat and Int also use Brick\Math\BigInteger::of with decimal text. Composer installs brick/math 1.0.0 automatically. Lean Bridge accepts integer objects up to 16384 decimal digits. String requires UTF-8, including NUL. ByteArray uses Bytes::fromString. Floats require PHP float; Float32 rounds to binary32 and preserves NaN classification, infinities and signed zero. Arrays are consecutive-key lists; records are final readonly value classes.

Input parameters deliberately use mixed with precise PHPDoc: generated checks reject coercion even if the caller omits strict_types. Records and lists have independent copied results. Copied types must be pure and acyclic, at most 32 levels deep. Validation, FFI scratch/output conversion, and native input/output copies each have a 16 MiB limit; PHP lists account for at least 32 bytes per element. These budgets do not bound the Lean algorithm's working memory. Native output owners are released in finally.

- LeanNominalsubtypes\echo_generic_first: lean:NominalSubtypes.GenericCompositions.echoGenericFirst
- LeanNominalsubtypes\echo_generic_second: lean:NominalSubtypes.GenericCompositions.echoGenericSecond
- LeanNominalsubtypes\generic_use: lean:NominalSubtypes.GenericCompositions.genericUse
- LeanNominalsubtypes\aliases: lean:NominalSubtypes.aliases
- LeanNominalsubtypes\array_values: lean:NominalSubtypes.arrayValues
- LeanNominalsubtypes\branch: lean:NominalSubtypes.branch
- LeanNominalsubtypes\combine: lean:NominalSubtypes.combine
- LeanNominalsubtypes\echo_envelope: lean:NominalSubtypes.echoEnvelope
- LeanNominalsubtypes\echo_event: lean:NominalSubtypes.echoEvent
- LeanNominalsubtypes\echo_groups: lean:NominalSubtypes.echoGroups
- LeanNominalsubtypes\echo_pair: lean:NominalSubtypes.echoPair
- LeanNominalsubtypes\event_choices: lean:NominalSubtypes.eventChoices
- LeanNominalsubtypes\event_empty: lean:NominalSubtypes.eventEmpty
- LeanNominalsubtypes\event_first: lean:NominalSubtypes.eventFirst
- LeanNominalsubtypes\event_second: lean:NominalSubtypes.eventSecond
- LeanNominalsubtypes\event_value: lean:NominalSubtypes.eventValue
- LeanNominalsubtypes\first: lean:NominalSubtypes.first
- LeanNominalsubtypes\group_values: lean:NominalSubtypes.groupValues
- LeanNominalsubtypes\inspect_alias_pair: lean:NominalSubtypes.inspectAliasPair
- LeanNominalsubtypes\list_values: lean:NominalSubtypes.listValues
- LeanNominalsubtypes\nested: lean:NominalSubtypes.nested
- LeanNominalsubtypes\no_items: lean:NominalSubtypes.noItems
- LeanNominalsubtypes\optional: lean:NominalSubtypes.optional
- LeanNominalsubtypes\pair_values: lean:NominalSubtypes.pairValues
- LeanNominalsubtypes\plain_fin: lean:NominalSubtypes.plainFin
- LeanNominalsubtypes\produce_envelope: lean:NominalSubtypes.produceEnvelope
- LeanNominalsubtypes\product: lean:NominalSubtypes.product
- LeanNominalsubtypes\scalar: lean:NominalSubtypes.scalar
- LeanNominalsubtypes\second: lean:NominalSubtypes.second

## Options, results and products

Option uses null for None or new Some($value) for Some. Unit is null, so new Some(null) preserves a present Unit or an outer Some containing None, according to the declared type. Except uses new Ok($value) or new Err($error); both expose a readonly value property. Branch classes are final readonly classes in this component's namespace and require one payload. PHPDoc records the payload type; every call checks it recursively, including weak-mode callers. Domain errors return Err; bridge failures throw. Prod uses an exact two-element list, retaining nested binary products. These types compose with arrays and records. Returned values are independently copied. PHP === compares wrapper identity, while == follows PHP's property-comparison rules. Readonly wrappers do not make arbitrary constructor payloads deeply immutable; only values accepted by the declared copied type may cross a call. Compound callbacks, identity-bearing copied values and recursive copied schemas remain unsupported.

## Lean Lists

List inputs, results and record fields use consecutive-key PHP arrays with precise list<T> PHPDoc. Empty Lists, order, duplicates and nesting are preserved. Mutable array values and Bytes results are independently copied. List and Array keep distinct IR/native identities. Weak and strict callers get the same element and copy-budget checks. Native sequence lengths, missing buffers and alignment are checked before allocation or reads. List callback payloads remain unsupported.

## Copied Lean aliases

Pass ordinary PHP target values. The binding manifest and installed public source retain alias names, original targets and chains. PHPDoc keeps the PHP target type; lean-bridge annotations record the original Lean contract at parameters, results and record fields. Aliases create no PHP wrapper classes or runtime type aliases. Nat requires a nonnegative Brick\Math\BigInteger, Unit uses null and Char requires one Unicode scalar. Weak and strict callers receive the same target checks. Copied values keep independent storage, the existing copy budgets and the 32-level type-depth bound. Recursive copied types, compound callable payloads and identity-bearing alias targets remain unsupported.

| Lean alias | Contract target | PHP value |
| --- | --- | --- |
| `EnvelopeAlias` | `Envelope` | `Envelope` |

## Tagged variants

Concrete copied variants use abstract readonly family classes and final readonly constructor classes, such as SignalData extends Signal. Constructors take named or positional payload arguments with the original Lean field names. All payload checks apply in weak and strict PHP callers. Empty constructors and null Unit payloads stay distinct. Calls accept only exact generated constructor classes with their initialized fields; unknown family subclasses and uninitialized reflection-created objects reject. The native tag and union layout are private. Returned tags are checked before reading the active payload.

Accepted payloads include all nineteen primitives, copied arrays, Lists, records, options, results, products and other admitted variants. Returned payloads have independent copied storage. Readonly properties cannot be reassigned; arrays and objects still follow PHP's value and object semantics. PHP === compares object identity, while == compares properties under PHP rules. PHP does not check branch exhaustiveness. The 32-level schema limit and separate 16 MiB validation, PHP conversion and native-copy budgets remain in effect. Generic, indexed, proof-bearing, recursive, callable and identity-bearing payloads remain unsupported.

## Value comparison

Generated records, variant cases, Some/Ok/Err and Bytes expose equals($other) and hashCode(). equals compares nested copied contents without numeric-string or other weak coercion and keeps class/constructor identity distinct. NaNs compare equal and signed zeros differ. hashCode returns a matching 64-character hexadecimal value hash; hashes are not a proof of equality or a versioned serialization format. PHP == and === keep their built-in meanings. Comparisons and hashing have a 32-level nesting bound and a 16 MiB traversal budget. Cycles exceed that depth bound; uninitialized values, foreign objects, resources and non-list arrays reject. Do not mutate referenced payloads while using their hash as a lookup key.

## Bounded integers

Lean Fin n parameters and results are Brick\Math\BigInteger values below n. The bundled native library compares each argument with its exact bound, including bounds wider than 64 bits, before any Lean code runs. A non-BigInteger argument throws TypeError and a negative value throws ValueError, as for Nat; a value at or above its bound throws LeanBridgeError with code 1 whose message names the Lean parameter and bound. Fin 0 has no values, so every call to a function taking one is rejected. Results are BigInteger values below their declared bound. Fin inside arrays, lists, options, products, Except values, records and variants is checked before Lean runs: every array or list element, a present option value, both product components, only the active Except branch, every record field and only the fields of the active variant case. An empty array, an absent option or an inactive branch or case is valid even for Fin 0. Bounds below list every element as name[*], a present option value as name?, product components as name.0 and name.1, the active branch as name.ok or name.error, a record field as name.field and a field of the active variant case as name.Case.field. Fin inside callbacks or generic record instantiations is not supported in native PHP packages.

Lean Subtype parameters cross as their base value. The bundled native library runs the author's checked constructor, named below, before the export runs; a value the constructor rejects fails the call with the invalid-argument error naming the parameter and constructor, and the export receives the constructed value, which may differ from the input. Arrays, Lists, options, products and active result branches apply the same constructor checks to each Subtype leaf. Rejections identify the argument and nested element path. Subtype results are the base value. Reviewed APIs select the constructor and reconcile it with fresh Lean compilation. Copied plain records check each selected field; variants check only the active case. Repeated uses of one type retain their own constructor choices, and every Fin bound is checked before any constructor. Recursive, generic, owned and callback Subtype positions remain unsupported.

- LeanNominalsubtypes\echo_generic_first: $value0.value checked by NominalSubtypes.plusOne; result.value projects the Subtype base value
- LeanNominalsubtypes\echo_generic_second: $value0.value checked by NominalSubtypes.plusTwo; result.value projects the Subtype base value
- LeanNominalsubtypes\generic_use: $value0.value checked by NominalSubtypes.plusOne
- LeanNominalsubtypes\aliases: $value0[*]?.payload checked by NominalSubtypes.plusOne; $value0[*]?.digit < 3; $value1[*]?.payload checked by NominalSubtypes.plusTwo; $value1[*]?.digit < 3
- LeanNominalsubtypes\array_values: result[*] projects the Subtype base value
- LeanNominalsubtypes\branch: result.ok projects the Subtype base value; result.error projects the Subtype base value
- LeanNominalsubtypes\combine: $value0.payload checked by NominalSubtypes.plusOne; $value0.digit < 3; $value1.payload checked by NominalSubtypes.plusTwo; $value1.digit < 3
- LeanNominalsubtypes\echo_envelope: $value0.payload checked by NominalSubtypes.plusOne; $value0.digit < 3; result.payload projects the Subtype base value; result.digit < 3
- LeanNominalsubtypes\echo_event: $value0.box.value.payload checked by NominalSubtypes.plusOne; $value0.box.value.digit < 3; $value0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; $value0.choices.values[*]?.error checked by NominalSubtypes.plusTwo; result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value
- LeanNominalsubtypes\echo_groups: $value0[*]?.payload checked by NominalSubtypes.plusOne; $value0[*]?.digit < 3; result[*]?.payload projects the Subtype base value; result[*]?.digit < 3
- LeanNominalsubtypes\echo_pair: $value0.left[*]?.payload checked by NominalSubtypes.plusOne; $value0.left[*]?.digit < 3; $value0.right[*]?.payload checked by NominalSubtypes.plusTwo; $value0.right[*]?.digit < 3; result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3
- LeanNominalsubtypes\event_choices: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value
- LeanNominalsubtypes\event_empty: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value
- LeanNominalsubtypes\event_first: $value0.box.value.payload checked by NominalSubtypes.plusOne; $value0.box.value.digit < 3; $value0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; $value0.choices.values[*]?.error checked by NominalSubtypes.plusTwo
- LeanNominalsubtypes\event_second: $value0.box.value.payload checked by NominalSubtypes.plusTwo; $value0.box.value.digit < 3; $value0.choices.values[*]?.ok checked by NominalSubtypes.plusTwo; $value0.choices.values[*]?.error checked by NominalSubtypes.plusOne
- LeanNominalsubtypes\event_value: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value
- LeanNominalsubtypes\first: $value0.payload checked by NominalSubtypes.plusOne; $value0.digit < 3
- LeanNominalsubtypes\group_values: result[*]?.payload projects the Subtype base value; result[*]?.digit < 3
- LeanNominalsubtypes\inspect_alias_pair: $value0.left[*]?.payload checked by NominalSubtypes.plusOne; $value0.left[*]?.digit < 3; $value0.right[*]?.payload checked by NominalSubtypes.plusTwo; $value0.right[*]?.digit < 3
- LeanNominalsubtypes\list_values: result[*] projects the Subtype base value
- LeanNominalsubtypes\nested: $value0.left.payload checked by NominalSubtypes.plusOne; $value0.left.digit < 3; $value0.right.payload checked by NominalSubtypes.plusTwo; $value0.right.digit < 3
- LeanNominalsubtypes\no_items: result[*] projects the Subtype base value
- LeanNominalsubtypes\optional: result? projects the Subtype base value
- LeanNominalsubtypes\pair_values: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3
- LeanNominalsubtypes\plain_fin: $value0 < 3
- LeanNominalsubtypes\produce_envelope: result.payload projects the Subtype base value; result.digit < 3
- LeanNominalsubtypes\product: result.0 projects the Subtype base value; result.1 projects the Subtype base value
- LeanNominalsubtypes\scalar: result projects the Subtype base value
- LeanNominalsubtypes\second: $value0.payload checked by NominalSubtypes.plusTwo; $value0.digit < 3
