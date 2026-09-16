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

## Values and cleanup

### Type conversions

Profiles: Perl. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `undef` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `Native Perl boolean scalar; generated true()/false()` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Requires a native Boolean value; does not use Perl truthiness as a conversion. Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `Exact integer scalar (UV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `Exact integer scalar (UV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `Exact integer scalar (UV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `Exact 64-bit integer scalar (UV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Preserves the complete UInt64 range with UV; no intermediate floating point. Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `Exact integer scalar (IV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Required: -128..127; reject overflow before narrowing. |
| `Int16` | `Exact integer scalar (IV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `Exact integer scalar (IV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `Exact 64-bit integer scalar (IV)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Preserves signed 64-bit endpoints with IV; no intermediate floating point. Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `Math::BigInt (nonnegative)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Requires Math::BigInt; rejects negative values and nonfinite decimal text. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `Math::BigInt (signed)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Requires Math::BigInt; preserves sign and magnitude. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `Numeric scalar (NV), rounded to binary32` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `Numeric scalar (NV), binary64` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `Unicode scalar string` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Preserves Unicode scalar values and embedded NUL; rejects invalid Unicode. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `Octet scalar string, UTF-8 flag off` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Requires an unflagged octet string; copies owned result bytes. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `Array reference of generated copied element values` (input, result, field, callback input, callback result) | Ordinary source: Installed checks: limited. Reviewed IR: Not audited | Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated blessed record with named fields` (input, result, field, callback input, callback result) | Ordinary source: Installed checks: limited. Reviewed IR: Not audited | Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Generated resource object with close/closed and canonical identity` (input, result) | Ordinary source: Installed checks passed (input, result); Not audited (field, callback input, callback result). Reviewed IR: Not audited | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `CODE reference, valid for the synchronous call` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Not audited | Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve order and elements without exposing list constructors; choose and test a lossless IR lowering. |
| `Char` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
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
| `Lean function returned to the host` | `Generated closure object with call, close and closed` (result) | Ordinary source: Not audited (input, field, callback input, callback result); Installed checks passed (result). Reviewed IR: Not audited | Required: Preserve captured state, call signature, errors and deterministic disposal. |
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

## Ownership and failures

Arrays and finite acyclic records are copied. Identity resources remain in the shared Lean runtime and retain their nominal type across components. Call `close` when finished; finalization is a fallback. Closing twice is harmless.

Callbacks may reenter the generated API. A callback can close the resource or closure involved in its own call; the active call retains what it needs until it returns. Perl exceptions, including exception objects, are rethrown after native cleanup. Lean may not retain a host callback beyond that call. An expired callback fails safely when invoked later.

Keep calls and handles on the creating Perl interpreter and thread. Fork after loading, cross-interpreter handles, retained host callbacks, asynchronous calls and iterators are not supported. Start a fresh process before importing the module when process isolation is needed.

### Verify the installation

Use `perl -MLeanBridge::Workshop -e 'print LeanBridge::Workshop::add(19,23), "\n"'` to check the example release. `perldoc LeanBridge::Workshop` lists the generated functions. Installed packages retain a receipt identifying the chosen XS binary and, for fallback builds, the XS source, Perl ABI, compiler, linker and commands. Native Lean libraries must remain byte-identical to the release inputs.

## Start from a raw Lean package

Follow [the Perl build-and-publish guide](../publish/cpan.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](../lean/existing-package.md).

Maintainers can run the [installed consumer checks](../contributing/testing.md#consumer-acceptance).
