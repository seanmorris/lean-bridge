# Checkedrecordvalueindices.Api 1.0.0

Install this prepared NuGet archive and call LeanBridge.Checkedrecordvalueindices.Api. Requires .NET 8 and Linux x86-64 with glibc 2.38 or newer. The native component and compatible shared runtime are included and loaded automatically. Consumers do not need Lean, Node, a C compiler or handwritten marshalling.

# LeanBridge.Checkedrecordvalueindices

Generated C# API: LeanBridge.Checkedrecordvalueindices.Api. Nat and Int use System.Numerics.BigInteger; arrays and byte arrays own copied managed storage. Strings use strict UTF-8 and preserve embedded NUL. Unit parameters use default(Unit); Unit results return void. Native conversions share a 16 MiB per-call copy budget and accept nested arrays/acyclic records up to 32 types deep. Null records, strings and arrays, negative Nat values and invalid UTF-16 fail before invoking Lean. Callbacks use typed Func/Action delegates and borrow the synchronous call. Async delegates are rejected; callback arguments are independent managed copies. Callback exceptions retain identity and their original stack after native cleanup. Returned LeanClosure<TDelegate> values expose Invoke and IsClosed; use using/Dispose to release them. Invocation requires the creating thread; disposal can run on another thread and defers until active invocation finishes. Finalization is a fallback. Retaining Invoke retains the same lease, and all aliases reject after disposal. Calls after fork require a fresh process. The compiled NuGet release includes its runtime and checks native library hashes when loading.

Checked records cross as generated record values containing only their payload fields. The bundled native library validates each input through the constructor selected for that exact occurrence before calling the export. Nested arrays, Lists, options, products, Except values, plain records and active variant cases retain their own checked-record constructors. Fin and Subtype payload fields run their checks before the outer record constructor. A rejection names the argument, nested path and failing constructor or bound. A normalizing constructor changes the copied value received by Lean without changing the caller's record. Results recursively project the payload fields and refined base values of records whose proofs Lean has already constructed. No proof object or input constructor is needed for a result-only export. Ordinary and reviewed APIs retain every per-occurrence constructor choice. Recursive, generic, owned and callback checked-record positions remain unsupported.

- LeanBridge.Checkedrecordvalueindices.Api.AbStringIndex: value0 checked by CheckedRecordValueIndices.mkAb
- LeanBridge.Checkedrecordvalueindices.Api.EmptySizedIndex: value0 checked by CheckedRecordValueIndices.mkEmptySized
- LeanBridge.Checkedrecordvalueindices.Api.EmptyStringIndex: value0 checked by CheckedRecordValueIndices.mkEmptyToken
- LeanBridge.Checkedrecordvalueindices.Api.FalseBoolIndex: value0 checked by CheckedRecordValueIndices.mkOff
- LeanBridge.Checkedrecordvalueindices.Api.ProduceAb: result projects proof-backed record payload fields
- LeanBridge.Checkedrecordvalueindices.Api.ProduceEmptySized: result projects proof-backed record payload fields
- LeanBridge.Checkedrecordvalueindices.Api.ProduceEmptyString: result projects proof-backed record payload fields
- LeanBridge.Checkedrecordvalueindices.Api.ProduceFalseBool: result projects proof-backed record payload fields
- LeanBridge.Checkedrecordvalueindices.Api.ProduceTrueBool: result projects proof-backed record payload fields
- LeanBridge.Checkedrecordvalueindices.Api.ProduceUnicodeString: result projects proof-backed record payload fields
- LeanBridge.Checkedrecordvalueindices.Api.ProduceWideNat: result projects proof-backed record payload fields
- LeanBridge.Checkedrecordvalueindices.Api.ProduceZeroNat: result projects proof-backed record payload fields
- LeanBridge.Checkedrecordvalueindices.Api.TrueBoolIndex: value0 checked by CheckedRecordValueIndices.mkOn
- LeanBridge.Checkedrecordvalueindices.Api.UnicodeStringIndex: value0 checked by CheckedRecordValueIndices.mkUnicodeToken
- LeanBridge.Checkedrecordvalueindices.Api.WideNatIndex: value0 checked by CheckedRecordValueIndices.mkWideToken
- LeanBridge.Checkedrecordvalueindices.Api.ZeroNatIndex: value0 checked by CheckedRecordValueIndices.mkZeroToken

Lean Option uses Option<T>.None or Option<T>.Some(value); default(Option<T>) is None. Except E T uses Result<T, E>.Ok(value) or .Err(error); default(Result<T, E>) is invalid. Branches expose IsSome/Value or IsOk/IsError/Value/Error, and accessing an inactive payload throws. Domain errors return Err; bridge failures throw exceptions. Binary products use C# (A, B) tuples and retain their nesting. These values can nest with arrays and copied records. Active null reference payloads reject; a missing option never reads its inactive payload. Returned arrays own independent storage. Compound callable values and resource-containing copies remain unsupported.

Generated records, named cases, Option and Result compare copied payloads structurally, including nested arrays and tuples. Equality retains record type and branch identity; equal values have equal hash codes. Floating equality follows .NET, including equal NaNs and signed zeros. Direct arrays and tuples keep C# equality rules; use System.Collections.StructuralComparisons.StructuralEqualityComparer for a deep comparison. Contained arrays remain mutable. Do not mutate a value while it is a dictionary key or hash-set member.

