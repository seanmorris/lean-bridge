# Perl

Call compiled Lean functions through generated Perl modules. The package loads the shared Lean runtime automatically; application code needs no FFI declarations or runtime initialization.

## Use a prepared release

### Prerequisites

Use 64-bit Perl on x86-64 Linux with glibc 2.38 or newer. The tested ABI matrix is Perl 5.36.3 and 5.38.2, with both threaded and nonthreaded builds. These are compatibility test versions, not a recommendation to run an end-of-life Perl in production. Other compatible configurations can build the supplied XS against their own headers.

The installer matches Perl's API and `Config` fingerprint, including threading, integer sizes, floating-point representation, and binary compatibility options. It does not assume that matching version strings imply compatible binaries.

## Install the release

A published component declares an exact `LeanBridge::Runtime` dependency. Your CPAN client resolves that version when it is available from its configured sources:

```sh
cpanm "$LEAN_BRIDGE_PERL_MODULE"
```

Set that variable to the module name supplied by your publisher. No CPAN publication of the example below is assumed.

For an archive handoff, obtain and authenticate both archives using the publisher's checksums or signed release manifest. Set `LEAN_BRIDGE_PERL_RUNTIME_ARCHIVE` and `LEAN_BRIDGE_PERL_COMPONENT_ARCHIVE` to their absolute paths. Install the runtime first, then the component:

```sh
cpanm --local-lib-contained "$PWD/.perl5" "$LEAN_BRIDGE_PERL_RUNTIME_ARCHIVE"
cpanm --local-lib-contained "$PWD/.perl5" "$LEAN_BRIDGE_PERL_COMPONENT_ARCHIVE"
export PERL5LIB="$PWD/.perl5/lib/perl5"
```

The runtime's long decimal version identifies its complete package contents. A numerically higher version is not a substitute. If a mirror cannot resolve the pinned version, install the exact runtime archive supplied by the publisher first. Packages used together must require the same runtime version; loading and initialization remain automatic.

`auto`, the default install mode, uses compatible prebuilt XS when available. Otherwise it compiles only the supplied XS with a C compiler and headers matching this Perl. It never invokes Lean, Lake, Node, or a Lean runtime build.

| Mode | Behavior |
| --- | --- |
| `LEAN_BRIDGE_PERL_INSTALL_MODE=auto` | Prefer prebuilt XS; compile XS if there is no match. |
| `LEAN_BRIDGE_PERL_INSTALL_MODE=prebuilt-only` | Require a matching prebuilt binary; no compiler needed. |
| `LEAN_BRIDGE_PERL_INSTALL_MODE=build-xs` | Compile supplied XS against local Perl headers. |

Corrupt artifacts and incompatible runtime identities are errors in every mode. They do not trigger fallback compilation.

## Call Lean

The Workshop example comes from an ordinary Lean project. Save this as `consumer.pl`:

```perl file=perl/consumer.pl
use strict;
use warnings;
use Math::BigInt;
use LeanBridge::Workshop;

print LeanBridge::Workshop::add(19, 23), "\n";
my $large = Math::BigInt->new(2)->bpow(256)->badd(1);
die "integer conversion" unless LeanBridge::Workshop::echo_nat($large)->bcmp($large) == 0;

my $counter = LeanBridge::Workshop::new_counter(42);
my $adder = LeanBridge::Workshop::make_adder(7);
my $ok = eval {
  print LeanBridge::Workshop::read_counter($counter), "\n";
  print $adder->call(35), "\n";
  print LeanBridge::Workshop::with_callback(20, sub { $_[0] * 2 }), "\n";
  1;
};
my $error = $@;
$adder->close;
$counter->close;
die $error unless $ok;
```

Run `perl consumer.pl`. Expected output is `42`, `42`, `42`, then `41`, each on its own line. Imports and calls use the generated public API only.

### Options, results and products

`Option` uses `undef` for None and the generated `Some->new($value)` for Some. Unit also uses `undef`: `Some->new(undef)` preserves a present Unit or an outer Some containing an inner None, according to the declared type. Nested options keep every layer.

`Except` uses distinct `Ok->new($value)` and `Err->new($error)` classes. Both expose `->value`. Domain errors return `Err`; invalid host values and bridge failures throw exceptions.

For the package in the [author example](../publish/cpan.md#export-options-results-and-products), save `compounds.pl`:

```perl
use strict;
use warnings;
use Math::BigInt;
use LeanBridge::Compounds;

my $some = 'LeanBridge::Compounds::Some';
print LeanBridge::Compounds::classify(undef), "\n";                   # 0
print LeanBridge::Compounds::classify($some->new(undef)), "\n";       # 1
print LeanBridge::Compounds::classify($some->new($some->new(undef))), "\n"; # 2

my $value = Math::BigInt->new(2)->bpow(200);
my $result = LeanBridge::Compounds::result_nat(
  LeanBridge::Compounds::Ok->new($value)
);
die "Expected Err" unless ref($result) eq 'LeanBridge::Compounds::Err';
print $result->value->bstr, "\n"; # the Lean function flips Ok to Err

my $pair = LeanBridge::Compounds::tuple_nat([
  Math::BigInt->new(10), Math::BigInt->new(20)
]);
print join(', ', map { $_->bstr } @$pair), "\n"; # 20, 10
```

Run `perl compounds.pl`. Products require a plain, dense two-element array reference. Nested products stay nested: `(a × b) × c` becomes `[[$a, $b], $c]`.

Branch classes live under the generated component namespace. They are mutable blessed hashes with exactly one `value` field; constructors require one payload even when it is `undef`. Calls check the exact class, fields and concrete payload type. Tied branches, tied products, subclass wrappers and sparse products are rejected. Calls copy nested arrays, records, bytes and `Math::BigInt` values. Mutating a returned value does not change the input or another returned copy. Perl reference equality is not deep value equality.

Input and output conversion share a 16 MiB copied-value budget. Type nesting is limited to 32 levels. These limits cover conversion payloads and slots, not all Perl allocations or Lean working memory. Resources and callbacks cannot appear inside copied values; compound callback arguments and results remain unsupported. The [installed checks](../evidence/perl-compounds-20260920.md) cover both source paths and all four pinned Perl ABIs.

### Tagged variants

Concrete copied Lean inductives use a named family and one Perl class per
constructor. Pass payloads as named fields and read them through the generated
accessors. For the prepared acceptance package, save `variants.pl`:

```perl
use strict;
use warnings;
use LeanBridge::Variants;

my $input = LeanBridge::Variants::Signal::Data->new(
  count => 42, label => 'ready'
);
my $result = LeanBridge::Variants::next($input);

if (ref($result) eq 'LeanBridge::Variants::Signal::Data') {
  print $result->count, ': ', $result->label, "\n"; # 43: ready!
} elsif (ref($result) eq 'LeanBridge::Variants::Signal::Idle') {
  print "idle\n";
} elsif (ref($result) eq 'LeanBridge::Variants::Signal::Stopped') {
  print "stopped\n";
} elsif (ref($result) eq 'LeanBridge::Variants::Signal::Marker') {
  die "Invalid Unit payload" if defined($result->value);
  print "marker\n";
} else {
  die "Unexpected constructor";
}
```

Run `perl variants.pl`. The family itself has no usable `new`; construct a named
case. Constructors reject missing, extra and duplicate fields. Calls check the
exact generated class, the field set and each payload type. Unknown subclasses,
unblessed hashes and tied constructor hashes reject. Empty constructors and a
constructor carrying `undef` for Unit remain distinct.

Payloads can contain all nineteen primitives, copied arrays and Lists, records,
options, results, products and other admitted variants. Calls convert only the
active payload through compiler-generated Lean helpers. Application code uses
no native constructor numbers or object layouts.

Fields and contained arrays remain mutable. Returned values own independent
copied storage; Perl reference equality does not compare payload contents.
Perl does not check that every constructor has a matching branch. Input fields
are pinned before converters can invoke Perl code, and scoped cleanup releases
partial conversions on failure. The existing 32-level schema limit and 16 MiB
conversion budget apply; they do not bound the entire Perl heap or Lean working
memory. Recursive, callable and identity-bearing payloads remain separate work.
The [installed variant checks](../evidence/perl-variants-20260921.md) cover both
source paths and all four pinned Perl ABIs.

### Lists

Lean `List T` uses a plain array reference for inputs, results and record fields.
Pass `[]` for an empty List. Elements keep their existing mappings, including
`Math::BigInt` for Nat/Int, `undef` for Unit and octet strings for ByteArray.
For the package in the [author example](../publish/cpan.md#export-lists), save
`lists.pl`:

```perl
use strict;
use warnings;
use LeanBridge::Lists;

my $input = [1, 2, 1, 3];
my $output = LeanBridge::Lists::reverse_uint32($input);
print join(', ', @$output), "\n"; # 3, 1, 2, 1
$output->[0] = 99;
print join(', ', @$input), "\n";  # 1, 2, 1, 3
```

Run `perl lists.pl`. Lists preserve order, duplicates and nesting with arrays,
records, options, results and products. Calls reject blessed, tied and sparse
array references, invalid elements and over-budget copies. Returned arrays and
mutable payloads own independent storage. Input and output conversion share the
16 MiB copied-value budget; schema nesting is limited to 32 levels. List and
Array remain distinct Lean and IR types even though both use array references.
List callback payloads remain unsupported. The [installed checks](../evidence/perl-lists-20260921.md)
cover both source paths and all four pinned Perl ABIs.

### Named copied aliases

Lean aliases use their target's ordinary Perl values. A `Count := UInt32`
argument takes an integer scalar; a `Values := List Count` argument takes an
array reference. The prepared archive retains alias names, original targets
and chains in `binding-manifest.json`. Installed POD documents the alias
catalog and the original parameter, result and record-field types. Aliases
do not create separate Perl packages or wrapper classes.

For the [author example](../publish/cpan.md#export-named-copied-aliases), save
`aliases.pl`:

```perl
use strict;
use warnings;
use LeanBridge::Scores;

my $scores = [10, 20, 30];
my $next = LeanBridge::Scores::increment_all($scores);
print join(', ', @$next), "\n";   # 11, 21, 31
print join(', ', @$scores), "\n"; # 10, 20, 30
```

Run `perl aliases.pl`. Target checks still apply: a Nat alias requires a
nonnegative `Math::BigInt`, Unit uses `undef`, and Char requires one Unicode
scalar. Integer aliases use the existing integer-scalar checks, which also
accept native Perl booleans as 0 or 1. Containers and record payloads copy
independently. Aliases retain the existing copy budget and schema-depth bound. See the
[installed alias checks](../evidence/perl-aliases-20260921.md).

## Values and cleanup

### Type conversions

Profiles: Perl. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `undef` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `Native Perl boolean scalar; generated true()/false()` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Requires a native Boolean value; does not use Perl truthiness as a conversion. Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `Exact integer scalar (UV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `Exact integer scalar (UV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `Exact integer scalar (UV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `Exact 64-bit integer scalar (UV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Preserves the complete UInt64 range with UV; no intermediate floating point. Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `Exact integer scalar (IV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `Exact integer scalar (IV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `Exact integer scalar (IV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `Exact 64-bit integer scalar (IV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Preserves signed 64-bit endpoints with IV; no intermediate floating point. Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `Math::BigInt (nonnegative)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Requires Math::BigInt; rejects negative values and nonfinite decimal text. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `Math::BigInt (signed)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Requires Math::BigInt; preserves sign and magnitude. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `Numeric scalar (NV), rounded to binary32` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `Numeric scalar (NV), binary64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `Unicode scalar string` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Preserves Unicode scalar values and embedded NUL; rejects invalid Unicode. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `Octet scalar string, UTF-8 flag off` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Not audited (field) | Requires an unflagged octet string; copies owned result bytes. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `Array reference of generated copied element values` (input, result, field, callback input, callback result) | Ordinary source: Installed checks: limited. Reviewed IR: Not audited | Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `undef or Some` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | None is undef; Some->new(value) retains presence. Some->new(undef) preserves present Unit or an outer Some containing None, according to the declared payload type. Some->new(Some->new(undef)) preserves two layers. Branches are exact generated classes with one mutable value field; subclasses, tied hashes and malformed field sets are rejected. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `Ok or Err` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | Lean Except E T becomes Ok->new(value) or Err->new(error), both exposing ->value. Exact classes preserve the success/error branch, including same-typed payloads. Payloads are copied and checked against the concrete Lean type. Domain errors return Err; bridge failures throw. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `Plain two-element array reference (nested binary products)` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Compilation rejected (callback input, callback result) | Exactly two dense elements in an unblessed, untied array reference, preserving binary nesting and per-position validation. Inputs and outputs share a 16 MiB copied-value budget. Returned arrays, records, branch payloads and Math::BigInt values are independently owned. Perl reference equality is not deep value equality. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated blessed record with named fields` (input, result, field, callback input, callback result) | Ordinary source: Installed checks: limited. Reviewed IR: Not audited | Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Perl target value; named Lean contract in archive metadata and installed POD` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Aliases preserve exact target conversion rules, original type names and independent copied storage. Nat requires nonnegative Math::BigInt; Unit uses undef; Char requires one Unicode scalar. Integer-scalar inputs include Perl native Boolean scalars as 0 or 1, matching the existing integer target checks. List/Array identity, Option/Result presence, 32-level schema depth and the 16 MiB shared copy budget remain unchanged. Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `named Perl constructor class with keyword payloads` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Construct values with Family::Case->new(field => value). Calls require exact generated classes and fields. Empty constructors and undef Unit payloads stay distinct. Inputs and outputs own independent copied storage. Input fields are pinned before child conversion can invoke Perl. Compiler-owned helpers construct variants and read active payloads without exposing native constructor numbers or object layouts. Invalid tags reject before getters; scoped cleanup releases partial conversions on exceptions. Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Generated resource object with close/closed and canonical identity` (input, result) | Ordinary source: Installed checks passed (input, result); Not audited (field, callback input, callback result). Reviewed IR: Not audited | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `CODE reference, valid for the synchronous call` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | `Plain array reference` (input, result, field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Plain dense unblessed, untied array references preserve empty Lists, order, duplicates and nesting. Returned arrays and mutable payloads own independent storage. Calls reject invalid containers, sparse elements, malformed payloads and oversized copies. Typed Lean helpers avoid cons-cell layout assumptions. Sequence slots are pinned before element conversion can invoke Perl code; exceptions release temporary values and preserve the original host error. Weak references to input arrays do not affect admission. Required: Preserve order, duplicates and nesting with a distinct list constructor. Validate all elements and copying limits; never expose Lean cons cells. |
| `Char` | `text scalar` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. Inputs must be text scalars; numeric-only values and references are rejected. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `unsigned integer scalar (UV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `signed integer scalar (IV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specialize or supply the selected dictionary without changing runtime behavior. |
| `Prop / theorem / proof arguments` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Record theorem identity and assumptions. Erasure does not remove the need to check a runtime refinement. |
| `Optional parameter with default` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Apply only the declared default; distinguish omitted input from a supplied Option.none. |
| `Explicit nullable host value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Select an explicit host projection; null does not stand for every missing, erased or unsupported value. |
| `IO α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Executing IO is not automatically asynchronous. Preserve effect order and exceptions. |
| `EIO ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve typed failures separately from transport validation and unexpected traps. |
| `Declared failure contract` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Project every declared error and payload; preserve trap or poisoned-runtime handling separately. |
| `Task α / asynchronous result` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep completion, rejection, cancellation and runtime lifetime distinct; do not block a browser event loop. |
| `Declared host object` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate typed members and preserve receiver identity, dynamic-access policy and lifetime. |
| `Lean function returned to the host` | `Generated closure object with call, close and closed` (result) | Ordinary source: Not audited (input, field, callback input, callback result); Installed checks passed (result). Reviewed IR: Not audited (input, field, callback input, callback result); Installed checks passed (result) | Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

### Workshop example API

| Lean type | Perl representation | Conversion |
| --- | --- | --- |
| `Bool` | Native boolean scalar; generated `true()` / `false()` | Strings and arbitrary truthy values are rejected. |
| `UInt32` | Exact integer scalar | Full range `0..4294967295`; no numeric-text coercion. |
| `String` | Unicode scalar string | Preserves embedded NUL and Unicode; rejects surrogates. |
| `ByteArray` | Unflagged octet string | Use `pack`; UTF-8-flagged strings are rejected. |
| `Array UInt32` | Array reference of exact integers | Copies each element and validates its range. |
| `Packet` | Generated `LeanBridge::Workshop::Packet` | A copied record containing another record, an array and a boolean. |
| `Counter` | Generated resource object | Canonical identity, `close`, and `closed`; a closed value is not `undef`. |
| `Nat` / `Int` | `Math::BigInt` | Exact sign and magnitude, with a 16 MiB per-call copy budget. |
| `UInt32 → UInt32` | CODE reference on input; generated callable object on output | Host callbacks are synchronous; returned Lean closures provide `call` and `close`. |

Fixed-width signed and unsigned integers use Perl's 64-bit integer representation, never an intermediate floating-point value. `Float32` rounds to binary32; `Float` uses binary64. NaN classification, infinities and signed zero are supported; NaN payload bits are not preserved as a contract.

Ordinary-source and reviewed CPAN packages support all nineteen primitives in synchronous callback arguments/results and returned-closure calls. The same host representations and checks apply there, including `Math::BigInt`, one-scalar `Char`, and 64-bit `USize`/`ISize`. [Installed tests](../evidence/perl-callables-20260918.md) check exact values, captured state, malformed callback returns, nested calls and cleanup. A returned closure's arguments are passed to `call`; release its captured Lean values with `close`.

Float parameters accept integer or floating-point scalars. Native boolean scalars also carry integer values and are accepted in fixed-width integer parameters. Numeric text such as `'12'` is rejected. `Bool` parameters still require native booleans, not arbitrary numbers or strings.

## Ownership and failures

Arrays, finite acyclic records, options, results and products are copied. Identity resources remain in the shared Lean runtime and retain their nominal type across components. Call `close` when finished; finalization is a fallback. Closing twice is harmless.

Callbacks may reenter the generated API. A callback can close the resource or closure involved in its own call; the active call retains what it needs until it returns. Perl exceptions, including exception objects, are rethrown after native cleanup. Lean may not retain a host callback beyond that call. An expired callback fails safely when invoked later.

Keep calls and handles on the creating Perl interpreter and thread. Fork after loading, cross-interpreter handles, retained host callbacks, asynchronous calls and iterators are not supported. Start a fresh process before importing the module when process isolation is needed.

### Verify the installation

Use `perl -MLeanBridge::Workshop -e 'print LeanBridge::Workshop::add(19,23), "\n"'` to check the example release. `perldoc LeanBridge::Workshop` lists the generated functions. Installed packages retain a receipt identifying the chosen XS binary and, for fallback builds, the XS source, Perl ABI, compiler, linker and commands. Native Lean libraries must remain byte-identical to the release inputs.

## Start from a raw Lean package

Follow [the Perl build-and-publish guide](../publish/cpan.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](../lean/existing-package.md).

Maintainers can run the [installed consumer checks](../contributing/testing.md#consumer-acceptance).
