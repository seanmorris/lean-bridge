# LeanCheckedrecordvalueindices

Install the prepared Composer archive and require vendor/autoload.php. Call the generated LeanCheckedrecordvalueindices functions. The package includes the compiled Lean libraries and loads its runtime automatically. Consumers do not compile Lean or configure a package-specific Zend extension.

Requires PHP 8.2+ (below 9), NTS CLI, Linux x86-64, the packaged glibc floor, and FFI enabled. This copied-value profile does not cover FPM, Apache, cli-server, ZTS or PHP-Wasm. Compatible packages share one process runtime; post-fork calls and an already loaded foreign Lean runtime are rejected. No per-package or shared runtime files are written during use.

Unit is null. Fixed-width integers use range-checked PHP int except UInt64, which uses BigInteger. Nat and Int also use Brick\Math\BigInteger::of with decimal text. Composer installs brick/math 1.0.0 automatically. Lean Bridge accepts integer objects up to 16384 decimal digits. String requires UTF-8, including NUL. ByteArray uses Bytes::fromString. Floats require PHP float; Float32 rounds to binary32 and preserves NaN classification, infinities and signed zero. Arrays are consecutive-key lists; records are final readonly value classes.

Input parameters deliberately use mixed with precise PHPDoc: generated checks reject coercion even if the caller omits strict_types. Records and lists have independent copied results. Copied types must be pure and acyclic, at most 32 levels deep. Validation, FFI scratch/output conversion, and native input/output copies each have a 16 MiB limit; PHP lists account for at least 32 bytes per element. These budgets do not bound the Lean algorithm's working memory. Native output owners are released in finally.

- LeanCheckedrecordvalueindices\ab_string_index: lean:CheckedRecordValueIndices.abStringIndex
- LeanCheckedrecordvalueindices\empty_sized_index: lean:CheckedRecordValueIndices.emptySizedIndex
- LeanCheckedrecordvalueindices\empty_string_index: lean:CheckedRecordValueIndices.emptyStringIndex
- LeanCheckedrecordvalueindices\false_bool_index: lean:CheckedRecordValueIndices.falseBoolIndex
- LeanCheckedrecordvalueindices\produce_ab: lean:CheckedRecordValueIndices.produceAb
- LeanCheckedrecordvalueindices\produce_empty_sized: lean:CheckedRecordValueIndices.produceEmptySized
- LeanCheckedrecordvalueindices\produce_empty_string: lean:CheckedRecordValueIndices.produceEmptyString
- LeanCheckedrecordvalueindices\produce_false_bool: lean:CheckedRecordValueIndices.produceFalseBool
- LeanCheckedrecordvalueindices\produce_true_bool: lean:CheckedRecordValueIndices.produceTrueBool
- LeanCheckedrecordvalueindices\produce_unicode_string: lean:CheckedRecordValueIndices.produceUnicodeString
- LeanCheckedrecordvalueindices\produce_wide_nat: lean:CheckedRecordValueIndices.produceWideNat
- LeanCheckedrecordvalueindices\produce_zero_nat: lean:CheckedRecordValueIndices.produceZeroNat
- LeanCheckedrecordvalueindices\true_bool_index: lean:CheckedRecordValueIndices.trueBoolIndex
- LeanCheckedrecordvalueindices\unicode_string_index: lean:CheckedRecordValueIndices.unicodeStringIndex
- LeanCheckedrecordvalueindices\wide_nat_index: lean:CheckedRecordValueIndices.wideNatIndex
- LeanCheckedrecordvalueindices\zero_nat_index: lean:CheckedRecordValueIndices.zeroNatIndex

## Value comparison

Generated records, variant cases, Some/Ok/Err and Bytes expose equals($other) and hashCode(). equals compares nested copied contents without numeric-string or other weak coercion and keeps class/constructor identity distinct. NaNs compare equal and signed zeros differ. hashCode returns a matching 64-character hexadecimal value hash; hashes are not a proof of equality or a versioned serialization format. PHP == and === keep their built-in meanings. Comparisons and hashing have a 32-level nesting bound and a 16 MiB traversal budget. Cycles exceed that depth bound; uninitialized values, foreign objects, resources and non-list arrays reject. Do not mutate referenced payloads while using their hash as a lookup key.

## Bounded integers

Checked records cross as generated record values containing only their payload fields. The bundled native library validates each input through the constructor selected for that exact occurrence before calling the export. Nested arrays, Lists, options, products, Except values, plain records and active variant cases retain their own checked-record constructors. Fin and Subtype payload fields run their checks before the outer record constructor. A rejection names the argument, nested path and failing constructor or bound. A normalizing constructor changes the copied value received by Lean without changing the caller's record. Results recursively project the payload fields and refined base values of records whose proofs Lean has already constructed. No proof object or input constructor is needed for a result-only export. Ordinary and reviewed APIs retain every per-occurrence constructor choice. Recursive, generic, owned and callback checked-record positions remain unsupported.

- LeanCheckedrecordvalueindices\ab_string_index: $value0 checked by CheckedRecordValueIndices.mkAb
- LeanCheckedrecordvalueindices\empty_sized_index: $value0 checked by CheckedRecordValueIndices.mkEmptySized
- LeanCheckedrecordvalueindices\empty_string_index: $value0 checked by CheckedRecordValueIndices.mkEmptyToken
- LeanCheckedrecordvalueindices\false_bool_index: $value0 checked by CheckedRecordValueIndices.mkOff
- LeanCheckedrecordvalueindices\produce_ab: result projects proof-backed record payload fields
- LeanCheckedrecordvalueindices\produce_empty_sized: result projects proof-backed record payload fields
- LeanCheckedrecordvalueindices\produce_empty_string: result projects proof-backed record payload fields
- LeanCheckedrecordvalueindices\produce_false_bool: result projects proof-backed record payload fields
- LeanCheckedrecordvalueindices\produce_true_bool: result projects proof-backed record payload fields
- LeanCheckedrecordvalueindices\produce_unicode_string: result projects proof-backed record payload fields
- LeanCheckedrecordvalueindices\produce_wide_nat: result projects proof-backed record payload fields
- LeanCheckedrecordvalueindices\produce_zero_nat: result projects proof-backed record payload fields
- LeanCheckedrecordvalueindices\true_bool_index: $value0 checked by CheckedRecordValueIndices.mkOn
- LeanCheckedrecordvalueindices\unicode_string_index: $value0 checked by CheckedRecordValueIndices.mkUnicodeToken
- LeanCheckedrecordvalueindices\wide_nat_index: $value0 checked by CheckedRecordValueIndices.mkWideToken
- LeanCheckedrecordvalueindices\zero_nat_index: $value0 checked by CheckedRecordValueIndices.mkZeroToken
