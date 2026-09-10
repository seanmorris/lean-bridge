# Ruby

Install Alpha as a RubyGem and call its generated Ruby API. The gem includes the compiled Lean libraries and uses Ruby's `Fiddle` transport, with no native Ruby extension build during installation.

## Use a prepared release

### Prerequisites

Use MRI Ruby 3.3 and RubyGems on x86-64 Linux with glibc 2.38 or newer. Check `ruby -v`, `gem --version`, `uname -m`, and `ldd --version`. The [support contract](../consumer-support.v1.json) records the tested Ruby profile.

This guide uses `lean_bridge_alpha-0.0.0.gem`, the Alpha interoperability package. Follow [Receive a package](receive-package.md) to obtain and authenticate that archive. No RubyGems.org publication is assumed.

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

This Alpha release exposes no `Nat`, `Int`, floating-point, optional, or asynchronous operations. Ruby's arbitrary-precision `Integer` does not remove the `UInt32` bounds on this API.

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
