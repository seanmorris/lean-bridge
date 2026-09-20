# Compiled C and C++ options, results and products

VO1219 adds `Option`, `Except` and nested binary products to prepared C and C++
packages. Both ordinary-source and independently reviewed-IR builds compile the
same Lean fixture. The constructors can contain all nineteen primitives, arrays,
acyclic copied records and each other.

| Lean | C | C++ |
| --- | --- | --- |
| `Option T` | `has_value` (0 or 1), typed `value` | `std::optional<T>` |
| `Except E T` | `is_ok` (0 or 1), typed `ok` and `error` | `Result<T, E>` |
| `A × B` | typed `fst` and `snd` | `std::pair<A, B>` |

C++ `Result<T, E>` is `std::variant<Ok<T>, Err<E>>`. Both wrappers have a `value`
member. Success and error remain distinct when their payload types match. Unit
uses `std::monostate`, so none, some Unit and some none remain distinct.
Products retain their binary nesting. Domain errors return values; they do not
become boundary exceptions or failed C statuses.

The compiler reports the native C representation of every instantiated Lean
type. Generated Lean helpers construct and project values and identify active
branches. The C adapter never reads constructor tags or offsets. Existing native
ABI profiles remain unchanged, and helper symbols retain canonical type hashes.

Inputs and output share a 16 MiB conversion budget, including compound struct
storage, active payloads and array ownership headers. GMP facades additionally
budget their public/private conversion. Type nesting stops at 32. These limits
do not bound Lean's working heap. Returned values own independent copies.

C callers initialize every compound field, including inactive payloads. Packages
containing arbitrary integers supply recursive `_init` and `_clear` functions;
other packages use zero initialization and require clearing outputs before reuse.
Flags outside 0/1 reject. Only the active payload is validated and passed to Lean.
Cleanup visits initialized inactive fields too. Failed conversions leave outputs
unchanged and release partial copies. C++ wrappers handle cleanup automatically.

## Installed validation

```sh
LEAN_BRIDGE_NATIVE_COMPOUND_TEST=1 node --test tests/native-compounds.test.mjs
node --test tests/native-compound-contract.test.mjs
```

The [machine-readable record](native-compounds-20260920.json) includes exact
archive hashes, source identities and generated consumer hashes. Each release
installs offline after removing the author workspace and build staging. Consumer
PATH excludes Lean, and C/C++ consumers use only their compilers and the packaged
headers, libraries and pkg-config metadata.

Each source path passes 1,549 C checks and 1,008 C++ checks. Cases include all
nineteen primitives in options, results and products, mixed records and arrays,
asymmetric result branches, nested Unit options, 24 nested Options, Unicode/NUL,
exact large integers, signed zero, NaN, infinities and independent byte copies.
Oversized results fail, followed by successful calls on the same runtime.

Each source path also passes 306 private native allocation-failure checks and
11 public GMP facade checks. The probes fail each adapter allocation in turn,
check output preservation, release partial results, repeat cleanup and require
zero outstanding tracked allocations. They do not replace Lean's or GMP's
process-wide allocators.

This milestone promotes 36 profile/path/type/position cells: C and C++ options,
results and products in inputs, results and fields through both source paths.
Other native hosts and PHP-Wasm reject these constructors before packaging.
Lists, tagged variants, recursive copied values and compound callable signatures
remain separate work. Copied values cannot hide callbacks or identity resources.

The historical Shop/Telemetry native and PHP-Wasm corpus now adds an unsupported
`List UInt32` export only to its negative-build copy. Original oracle modules
remain unchanged; this compound suite supplies the installed evidence.
