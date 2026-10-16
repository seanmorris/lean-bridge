# LeanNestedcheckedrecords

Install the prepared Composer archive and require vendor/autoload.php. Call the generated LeanNestedcheckedrecords functions. The package includes the compiled Lean libraries and loads its runtime automatically. Consumers do not compile Lean or configure a package-specific Zend extension.

Requires PHP 8.2+ (below 9), NTS CLI, Linux x86-64, the packaged glibc floor, and FFI enabled. This copied-value profile does not cover FPM, Apache, cli-server, ZTS or PHP-Wasm. Compatible packages share one process runtime; post-fork calls and an already loaded foreign Lean runtime are rejected. No per-package or shared runtime files are written during use.

Unit is null. Fixed-width integers use range-checked PHP int except UInt64, which uses BigInteger. Nat and Int also use Brick\Math\BigInteger::of with decimal text. Composer installs brick/math 1.0.0 automatically. Lean Bridge accepts integer objects up to 16384 decimal digits. String requires UTF-8, including NUL. ByteArray uses Bytes::fromString. Floats require PHP float; Float32 rounds to binary32 and preserves NaN classification, infinities and signed zero. Arrays are consecutive-key lists; records are final readonly value classes.

Input parameters deliberately use mixed with precise PHPDoc: generated checks reject coercion even if the caller omits strict_types. Records and lists have independent copied results. Copied types must be pure and acyclic, at most 32 levels deep. Validation, FFI scratch/output conversion, and native input/output copies each have a 16 MiB limit; PHP lists account for at least 32 bytes per element. These budgets do not bound the Lean algorithm's working memory. Native output owners are released in finally.

- LeanNestedcheckedrecords\echo_array: lean:NestedCheckedRecords.echoArray
- LeanNestedcheckedrecords\first: lean:NestedCheckedRecords.first
- LeanNestedcheckedrecords\in_array: lean:NestedCheckedRecords.inArray
- LeanNestedcheckedrecords\in_choice: lean:NestedCheckedRecords.inChoice
- LeanNestedcheckedrecords\in_except: lean:NestedCheckedRecords.inExcept
- LeanNestedcheckedrecords\in_holder: lean:NestedCheckedRecords.inHolder
- LeanNestedcheckedrecords\in_list: lean:NestedCheckedRecords.inList
- LeanNestedcheckedrecords\in_option: lean:NestedCheckedRecords.inOption
- LeanNestedcheckedrecords\in_product: lean:NestedCheckedRecords.inProduct
- LeanNestedcheckedrecords\pair: lean:NestedCheckedRecords.pair
- LeanNestedcheckedrecords\produce_array: lean:NestedCheckedRecords.produceArray
- LeanNestedcheckedrecords\produce_option: lean:NestedCheckedRecords.produceOption
- LeanNestedcheckedrecords\second: lean:NestedCheckedRecords.second

## Options, results and products

Option uses null for None or new Some($value) for Some. Unit is null, so new Some(null) preserves a present Unit or an outer Some containing None, according to the declared type. Except uses new Ok($value) or new Err($error); both expose a readonly value property. Branch classes are final readonly classes in this component's namespace and require one payload. PHPDoc records the payload type; every call checks it recursively, including weak-mode callers. Domain errors return Err; bridge failures throw. Prod uses an exact two-element list, retaining nested binary products. These types compose with arrays and records. Returned values are independently copied. PHP === compares wrapper identity, while == follows PHP's property-comparison rules. Readonly wrappers do not make arbitrary constructor payloads deeply immutable; only values accepted by the declared copied type may cross a call. Compound callbacks, identity-bearing copied values and recursive copied schemas remain unsupported.

## Lean Lists

List inputs, results and record fields use consecutive-key PHP arrays with precise list<T> PHPDoc. Empty Lists, order, duplicates and nesting are preserved. Mutable array values and Bytes results are independently copied. List and Array keep distinct IR/native identities. Weak and strict callers get the same element and copy-budget checks. Native sequence lengths, missing buffers and alignment are checked before allocation or reads. List callback payloads remain unsupported.

## Tagged variants

Concrete copied variants use abstract readonly family classes and final readonly constructor classes, such as SignalData extends Signal. Constructors take named or positional payload arguments with the original Lean field names. All payload checks apply in weak and strict PHP callers. Empty constructors and null Unit payloads stay distinct. Calls accept only exact generated constructor classes with their initialized fields; unknown family subclasses and uninitialized reflection-created objects reject. The native tag and union layout are private. Returned tags are checked before reading the active payload.

Accepted payloads include all nineteen primitives, copied arrays, Lists, records, options, results, products and other admitted variants. Returned payloads have independent copied storage. Readonly properties cannot be reassigned; arrays and objects still follow PHP's value and object semantics. PHP === compares object identity, while == compares properties under PHP rules. PHP does not check branch exhaustiveness. The 32-level schema limit and separate 16 MiB validation, PHP conversion and native-copy budgets remain in effect. Generic, indexed, proof-bearing, recursive, callable and identity-bearing payloads remain unsupported.

## Value comparison

Generated records, variant cases, Some/Ok/Err and Bytes expose equals($other) and hashCode(). equals compares nested copied contents without numeric-string or other weak coercion and keeps class/constructor identity distinct. NaNs compare equal and signed zeros differ. hashCode returns a matching 64-character hexadecimal value hash; hashes are not a proof of equality or a versioned serialization format. PHP == and === keep their built-in meanings. Comparisons and hashing have a 32-level nesting bound and a 16 MiB traversal budget. Cycles exceed that depth bound; uninitialized values, foreign objects, resources and non-list arrays reject. Do not mutate referenced payloads while using their hash as a lookup key.

## Bounded integers

Lean Fin n parameters and results are Brick\Math\BigInteger values below n. The bundled native library compares each argument with its exact bound, including bounds wider than 64 bits, before any Lean code runs. A non-BigInteger argument throws TypeError and a negative value throws ValueError, as for Nat; a value at or above its bound throws LeanBridgeError with code 1 whose message names the Lean parameter and bound. Fin 0 has no values, so every call to a function taking one is rejected. Results are BigInteger values below their declared bound. Fin inside arrays, lists, options, products, Except values, records and variants is checked before Lean runs: every array or list element, a present option value, both product components, only the active Except branch, every record field and only the fields of the active variant case. An empty array, an absent option or an inactive branch or case is valid even for Fin 0. Bounds below list every element as name[*], a present option value as name?, product components as name.0 and name.1, the active branch as name.ok or name.error, a record field as name.field and a field of the active variant case as name.Case.field. Fin inside callbacks or generic record instantiations is not supported in native PHP packages.

Lean Subtype parameters cross as their base value. The bundled native library runs the author's checked constructor, named below, before the export runs; a value the constructor rejects fails the call with the invalid-argument error naming the parameter and constructor, and the export receives the constructed value, which may differ from the input. Arrays, Lists, options, products and active result branches apply the same constructor checks to each Subtype leaf. Rejections identify the argument and nested element path. Subtype results are the base value. Reviewed APIs select the constructor and reconcile it with fresh Lean compilation. Copied plain records check each selected field; variants check only the active case. Repeated uses of one type retain their own constructor choices, and every Fin bound is checked before any constructor. Recursive, generic, owned and callback Subtype positions remain unsupported.

Checked records cross as generated record values containing only their payload fields. The bundled native library validates each input through the constructor selected for that exact occurrence before calling the export. Nested arrays, Lists, options, products, Except values, plain records and active variant cases retain their own checked-record constructors. Fin and Subtype payload fields run their checks before the outer record constructor. A rejection names the argument, nested path and failing constructor or bound. A normalizing constructor changes the copied value received by Lean without changing the caller's record. Results recursively project the payload fields and refined base values of records whose proofs Lean has already constructed. No proof object or input constructor is needed for a result-only export. Ordinary and reviewed APIs retain every per-occurrence constructor choice. Recursive, generic, owned and callback checked-record positions remain unsupported.

- LeanNestedcheckedrecords\echo_array: $arg0[*] checked by NestedCheckedRecords.mkPacket; $arg0[*].digit < 10; $arg0[*].word checked by NestedCheckedRecords.mkWord; result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value
- LeanNestedcheckedrecords\first: $arg0 checked by NestedCheckedRecords.mkPacket; $arg0.digit < 10; $arg0.word checked by NestedCheckedRecords.mkWord
- LeanNestedcheckedrecords\in_array: $arg0[*] checked by NestedCheckedRecords.mkPacket; $arg0[*].digit < 10; $arg0[*].word checked by NestedCheckedRecords.mkWord
- LeanNestedcheckedrecords\in_choice: $arg0.packet.value checked by NestedCheckedRecords.mkPacket; $arg0.packet.value.digit < 10; $arg0.packet.value.word checked by NestedCheckedRecords.normalizeWord
- LeanNestedcheckedrecords\in_except: $arg0.ok checked by NestedCheckedRecords.normalizePacket; $arg0.ok.digit < 10; $arg0.ok.word checked by NestedCheckedRecords.mkWord; $arg0.error checked by NestedCheckedRecords.mkPacket; $arg0.error.digit < 10; $arg0.error.word checked by NestedCheckedRecords.normalizeWord
- LeanNestedcheckedrecords\in_holder: $arg0.packet checked by NestedCheckedRecords.normalizePacket; $arg0.packet.digit < 10; $arg0.packet.word checked by NestedCheckedRecords.mkWord
- LeanNestedcheckedrecords\in_list: $arg0[*] checked by NestedCheckedRecords.normalizePacket; $arg0[*].digit < 10; $arg0[*].word checked by NestedCheckedRecords.normalizeWord
- LeanNestedcheckedrecords\in_option: $arg0? checked by NestedCheckedRecords.mkPacket; $arg0?.digit < 10; $arg0?.word checked by NestedCheckedRecords.normalizeWord
- LeanNestedcheckedrecords\in_product: $arg0.0 checked by NestedCheckedRecords.mkPacket; $arg0.0.digit < 10; $arg0.0.word checked by NestedCheckedRecords.mkWord; $arg0.1 checked by NestedCheckedRecords.normalizePacket; $arg0.1.digit < 10; $arg0.1.word checked by NestedCheckedRecords.normalizeWord
- LeanNestedcheckedrecords\pair: $arg0 checked by NestedCheckedRecords.mkPacket; $arg0.digit < 10; $arg0.word checked by NestedCheckedRecords.mkWord; $arg1 checked by NestedCheckedRecords.normalizePacket; $arg1.digit < 10; $arg1.word checked by NestedCheckedRecords.normalizeWord
- LeanNestedcheckedrecords\produce_array: result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value
- LeanNestedcheckedrecords\produce_option: result? projects proof-backed record payload fields; result?.digit < 10; result?.word projects the Subtype base value
- LeanNestedcheckedrecords\second: $arg0 checked by NestedCheckedRecords.normalizePacket; $arg0.digit < 10; $arg0.word checked by NestedCheckedRecords.normalizeWord
