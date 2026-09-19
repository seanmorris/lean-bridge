# Ruby

Install a prepared RubyGem and call its generated Ruby API. The gem includes the compiled Lean component and shared runtime. Installation needs no Lean compiler or native Ruby extension build.

## Use a prepared release

### Prerequisites

Use MRI Ruby 3.3 and RubyGems on x86-64 Linux with glibc 2.38 or newer. Check `ruby -v`, `gem --version`, `uname -m`, and `ldd --version`. The [support contract](../consumer-support.v1.json) records the tested Ruby profile.

Follow [Use a prepared release](receive-package.md) to obtain and authenticate the archive. No RubyGems.org publication is assumed.

### Call an ordinary Lean package

The package README names its require path, module and functions. The local acceptance package is `willow-api-2.0.0.rc.1-x86_64-linux.gem`, with `LeanBridge::Willow` as its public module. This is a test archive, not a RubyGems.org release.

```sh
export LEAN_BRIDGE_GEM_ARCHIVE=/absolute/path/to/willow-api-2.0.0.rc.1-x86_64-linux.gem
export GEM_HOME="$PWD/.gems"
export GEM_PATH="$GEM_HOME"
gem install "$LEAN_BRIDGE_GEM_ARCHIVE" --local --install-dir "$GEM_HOME" --no-document
```

Save `example.rb`:

```ruby
require "lean_bridge/willow"

api = LeanBridge::Willow
puts api.echo_nat(2**200)
puts api.echo_text("Lean λ🌿")
p api.matrix([1, 2, 3])
```

```sh
ruby example.rb
```

Fixed-width integers use range-checked Ruby `Integer`. Nat and Int remain exact without a fixed bit-width limit; Nat rejects negatives. Floating-point values use `Float`, and Float32 rounds to binary32. Text must be valid UTF-8 or US-ASCII. ByteArray uses binary `String`, arrays use `Array`, and copied structures become keyword-initialized record classes. Unit uses the generated `UNIT` singleton in every position, including results; `nil` is not Unit.

Calls copy nested values. Invalid types, numeric ranges, encodings and nested `nil` values throw. Native input/output conversions share a 16 MiB budget; input scratch has its own bound. Generated cleanup releases temporary and owned output buffers even when a conversion raises. Native libraries load from the installed gem, verify their embedded hashes and share a compatible Lean runtime. No runtime-path setting is needed.

### Callbacks and returned Lean closures

Ordinary gems accept synchronous callable objects, `Proc` values, method objects and a final Ruby block. Callback arguments and results support all nineteen primitives with the same conversions as direct calls.

For a prepared package exporting `Callables.callNat` and `Callables.makeString`, save `callbacks.rb`:

```ruby
require "lean_bridge/callables"

api = LeanBridge::Callables
puts api.call_nat(2**200) { |value| value + 1 }

api.make_string("captured λ").with do |choose|
  puts choose.call(true, "argument")  # captured λ
  puts choose.call(false, "argument") # argument
end
```

Run `ruby callbacks.rb`. The [author example](../publish/rubygems.md#export-callbacks-and-closures) builds this API.

Host callbacks expire when the exporting call returns. Returned `LeanClosure` values retain their captured Lean state until `close` or the end of `with`. Repeated `close` is harmless; `closed?` reports it. Garbage collection is a fallback, not timely cleanup. Closures reject copying and serialization.

Invoke a closure on its creating thread. Nested calls are supported up to 64 native calls. Closing an active closure on the same thread defers disposal until it returns; a close from another thread waits. A callback suspended in a Fiber must resume before another Fiber on that thread enters Lean. Post-fork calls, Ractors and the experimental `RUBY_MN_THREADS` mode are unsupported.

The original exception object is re-raised after native cleanup. A failing callback stops later callbacks in that native call. Non-local `return`, `break` and `throw` raise `LocalJumpError`; use a normal block result or raise an exception. The [installed acceptance record](../evidence/ruby-callables-20260919.md) covers both ordinary source and reviewed contracts.

### Alpha interoperability example

The remaining example uses `lean_bridge_alpha-0.0.0.gem`. It exercises resources and callbacks through the separate Alpha fixture API. Resource identities remain separate from ordinary copied values and primitive callables.

## Install the gem

From an empty application directory, install the authenticated archive into a local gem home:

```sh
export LEAN_BRIDGE_GEM_ARCHIVE=/absolute/path/to/lean_bridge_alpha-0.0.0.gem
export GEM_HOME="$PWD/.gems"
export GEM_PATH="$GEM_HOME"
gem install "$LEAN_BRIDGE_GEM_ARCHIVE" --local --install-dir "$GEM_HOME" --no-document
```

Keep these variables set when you run the program so Ruby finds the isolated installation.

### Write the application

Save this complete program as `consumer.rb`:

```ruby file=ruby/consumer.rb
require "lean_bridge/alpha"

alpha = LeanBridge::Alpha
box = alpha::Box.new(42)
adder = nil
begin
  raise "Box identity" unless box.read == 42 && box.identity.equal?(box)
  puts "Box: #{box.read}"

  payload = alpha.round_trip(alpha::Payload.new(
    enabled: true, count: 41, label: "Lean λ", bytes: "\x00\xff".b, values: [0, 2**32 - 1]))
  raise "Payload" unless !payload.enabled && payload.count == 42 && payload.label == "Lean λ" &&
    payload.bytes.bytes == [0, 255] && payload.values == [0, 2**32 - 1]
  puts "Payload count: #{payload.count}"

  callback = alpha.with_callback(40) { |value| value + 2 }
  raise "Callback result" unless callback == 44
  puts "Callback: #{callback}"
  adder = alpha.make_adder(2)
  raise "Returned callable" unless adder.call(40) == 42
  puts "Callable: #{adder.call(40)}"

  begin
    alpha.with_callback(40) { raise ArgumentError, "callback marker" }
    raise "Callback failure was accepted"
  rescue ArgumentError => error
    raise unless error.message == "callback marker"
  end

  adder.close
  adder.close
  box.close
  box.close
  begin
    box.read
    raise "Closed Box was accepted"
  rescue alpha::DisposedResourceError
  end
  begin
    adder.call(40)
    raise "Closed callable was accepted"
  rescue alpha::DisposedResourceError
  end
  puts "Errors and cleanup: passed"
ensure
  adder&.close
  box.close
end
```

### Run

```sh
ruby consumer.rb
```

Expected output:

```text
Box: 42
Payload count: 42
Callback: 44
Callable: 42
Errors and cleanup: passed
```

## Values and cleanup

### Type conversions

Profiles: Ruby. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `UNIT singleton` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Use the generated UNIT singleton in every position, including results. Nil is rejected. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `true or false` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Integer in 0..255; invalid range or implicit coercion throws. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Integer in 0..65535; invalid range or implicit coercion throws. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Integer in 0..4294967295, with no floating-point conversion. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Integer in 0..18446744073709551615, with no narrowing. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: -128..127; reject overflow before narrowing. |
| `Int16` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Exact Integer magnitude; negative input throws. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Exact signed Integer without a fixed bit-width limit. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `Float` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | Float inputs round to binary32; NaN classification, infinities and signed zero are tested. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `Float` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Inspected: no host mapping (field) | The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `String` (input, result, field, callback input, callback result); `String (UTF-8)` (field) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Require valid UTF-8 or US-ASCII, preserving embedded NUL. Nil, malformed text and incompatible encodings throw. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `Binary String` (input, result, field, callback input, callback result); `String (ASCII-8BIT)` (field) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed (input, result, callback input, callback result); Generator inspected (field) | Binary String with independent returned storage; no text decoding. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `Array` (input, result, field); `Array of Integer` (field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Array elements are recursively checked and copied. Nested nil values throw. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated Ruby record` (input, result, field); `Payload` (input, result) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Generator inspected (input, result); Not audited (field, callback input, callback result) | Generated keyword-initialized record classes preserve field order through compiler-owned accessors. Nested returned arrays and strings are independent copies. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `Proc, method, callable object or block` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve order and elements without exposing list constructors; choose and test a lossless IR lowering. |
| `Char` | `String` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. Inputs require valid UTF-8 or US-ASCII encoding. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specialize or supply the selected dictionary without changing runtime behavior. |
| `Prop / theorem / proof arguments` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Record theorem identity and assumptions. Erasure does not remove the need to check a runtime refinement. |
| `Optional parameter with default` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Apply only the declared default; distinguish omitted input from a supplied Option.none. |
| `Explicit nullable host value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Select an explicit host projection; null does not stand for every missing, erased or unsupported value. |
| `IO α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Executing IO is not automatically asynchronous. Preserve effect order and exceptions. |
| `EIO ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve typed failures separately from transport validation and unexpected traps. |
| `Declared failure contract` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Project every declared error and payload; preserve trap or poisoned-runtime handling separately. |
| `Task α / asynchronous result` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Keep completion, rejection, cancellation and runtime lifetime distinct; do not block a browser event loop. |
| `Declared host object` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate typed members and preserve receiver identity, dynamic-access policy and lifetime. |
| `Lean function returned to the host` | `LeanClosure` (result) | Ordinary source: Not audited (input, field, callback input, callback result); Installed checks passed (result). Reviewed IR: Not audited (input, field, callback input, callback result); Installed checks passed (result) | Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Generation rejected | Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

### Alpha example API

These mappings describe the prepared Alpha gem's `LeanBridge::Alpha` API.

| Lean type | Ruby type | Conversion rules |
| --- | --- | --- |
| `Bool` | `true` or `false` | Ordinary Ruby truthiness is not accepted as a Boolean conversion. |
| `UInt32` | `Integer` | Range `0..2**32 - 1`; invalid types raise `TypeError`, out-of-range integers raise `RangeError`. |
| `String` | `String` | UTF-8 text; `Payload` duplicates and freezes the label. |
| `ByteArray` | Binary `String` | Use `.b` for binary data. `Payload` copies the bytes and freezes the result. |
| `Array UInt32` | `Array` of `Integer` | Every element is range-checked; `Payload` copies and freezes the array. |
| `Payload` | `Payload` | Frozen value object with named fields. |
| `Box` | `Box` | Identity-bearing resource; `identity` returns the same wrapper. Close it in `ensure`. |
| `UInt32 → UInt32` callback | Block or object responding to `call` | Synchronous; input and result obey the `UInt32` range. |
| Returned Lean closure | `OwnedTransform` | Resource with `call`, `close`, and `closed?`; close it in `ensure`. |

Ruby's arbitrary-precision `Integer` does not remove the `UInt32` bounds on this API.

### Values and resource ownership

Lean `UInt32` maps to Ruby `Integer` values in the range `0..2**32 - 1`. Supply bytes as a binary `String` and integer sequences as an `Array`. `Payload` copies and freezes the label, bytes, and values, then freezes itself.

Alpha's `round_trip` flips `enabled` and increments `count`, preserving the other fields. `with_callback(40) { |value| value + 2 }` returns `44`: Lean passes `41` to the block and adds one to the returned `43`. The block runs synchronously. `make_adder(2)` returns an owned callable with a `call` method.

Call `close` on each `Box` and `OwnedTransform`. The `ensure` block releases resources if any assertion or callback throws, including when creation of the second resource fails. Repeated close is harmless. `closed?` reports the state, and operations after close raise `DisposedResourceError`. Do not rely on the garbage collector for timely cleanup.

## Errors and troubleshooting

- Invalid argument types raise `TypeError`. Integers outside the unsigned range raise `RangeError`.
- Ruby exceptions raised by a callback propagate as the original exception. The example handles an `ArgumentError`.
- Other reported Lean/native failures raise `LeanBridgeError` or its generated subclasses.
- If `require "lean_bridge/alpha"` raises `LoadError`, check `GEM_HOME` and `GEM_PATH` in the same shell where you invoke Ruby. Confirm the install with `gem list lean_bridge_alpha`.
- A library-load failure can indicate an unsupported architecture, an older glibc, or a missing packaged library. Keep the original gem intact and leave `LEAN_BRIDGE_NATIVE_ROOT` unset to use its bundled native libraries.

## Start from a raw Lean package

Follow [the Ruby build-and-publish guide](../publish/rubygems.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](../lean/existing-package.md).

### Related workflows and acceptance

Repository checks live in [Contributing](../contributing/testing.md#consumer-acceptance).

### Publish this package

Continue in the [build-and-publish workflow](../publish/rubygems.md).
