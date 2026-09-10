# Ruby

Install Alpha as a RubyGem and call its generated Ruby API. The gem includes the compiled Lean libraries and uses Ruby's `Fiddle` transport, with no native Ruby extension build during installation.

## Use a prepared release

### Prerequisites

Use MRI Ruby 3.3 and RubyGems on x86-64 Linux with glibc 2.38 or newer. Check `ruby -v`, `gem --version`, `uname -m`, and `ldd --version`. The [support contract](../consumer-support.v1.json) records the tested Ruby profile.

This guide uses `lean_bridge_alpha-0.0.0.gem`, the Alpha interoperability package. Follow [Use a prepared release](receive-package.md) to obtain and authenticate that archive. No RubyGems.org publication is assumed.

### Install the gem

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

### Type conversions

Profiles: Ruby. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `true or false` (field) | Ordinary source: Not audited. Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: 0..255; reject overflow before narrowing. |
| `UInt16` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: -128..127; reject overflow before narrowing. |
| `Int16` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Inspected: no host mapping | Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `String (UTF-8)` (field) | Ordinary source: Not audited. Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `String (ASCII-8BIT)` (field) | Ordinary source: Not audited. Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `Array of Integer` (field) | Ordinary source: Not audited. Reviewed IR: Not audited (input, result, callback input, callback result); Generator inspected (field) | Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Payload` (input, result) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input, result); Not audited (field, callback input, callback result) | Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `Proc or block` (input) | Ordinary source: Not audited. Reviewed IR: Generator inspected (input); Not audited (result, field, callback input, callback result) | Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve order and elements without exposing list constructors; choose and test a lossless IR lowering. |
| `Char` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
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
| `Lean function returned to the host` | `OwnedTransform` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve captured state, call signature, errors and deterministic disposal. |
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

### Errors and troubleshooting

- Invalid argument types raise `TypeError`. Integers outside the unsigned range raise `RangeError`.
- Ruby exceptions raised by a callback propagate as the original exception. The example handles an `ArgumentError`.
- Other reported Lean/native failures raise `LeanBridgeError` or its generated subclasses.
- If `require "lean_bridge/alpha"` raises `LoadError`, check `GEM_HOME` and `GEM_PATH` in the same shell where you invoke Ruby. Confirm the install with `gem list lean_bridge_alpha`.
- A library-load failure can indicate an unsupported architecture, an older glibc, or a missing packaged library. Keep the original gem intact and leave `LEAN_BRIDGE_NATIVE_ROOT` unset to use its bundled native libraries.

## Start from a raw Lean package

For Alpha, [build the managed Ruby package](../contributing/testing.md#managed-packages) to produce `lean_bridge_alpha-0.0.0.gem`. Use the resulting archive with [Install the gem](#install-the-gem).

For another Lean library, check the [source workflow and supported targets](../consume.md#start-from-a-raw-lean-package). These Alpha builds use the repository's target-specific inputs.

### Related workflows and acceptance

Alpha's Ruby surface uses the [managed target profile](../architecture/adr/23-managed-runtime-target-profiles.md).

Contributors can [build the managed examples](../contributing/testing.md#managed-packages) and run the [installed consumer checks](../contributing/testing.md#consumer-acceptance). See the [managed acceptance evidence](../evidence/managed-consumer-acceptance.md).

### Publish this package

See [Publish to RubyGems](../publish/rubygems.md) for package preparation, distribution, and verification after upload.
