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

Fixed-width integers use range-checked Ruby `Integer`. Nat and Int remain exact without a fixed bit-width limit; Nat rejects negatives. Floating-point values use `Float`, and Float32 rounds to binary32. Text must be valid UTF-8 or US-ASCII. ByteArray uses binary `String`, arrays and Lists use `Array`, and copied structures become keyword-initialized record classes. Unit uses the generated `UNIT` singleton in every position, including results; `nil` is not Unit.

Calls copy nested values. Invalid types, numeric ranges and encodings raise exceptions. `nil` is valid only at an `Option` position. Native input/output conversions share a 16 MiB budget; input scratch has its own bound. Generated cleanup releases temporary and owned output buffers even when a conversion raises. Native libraries load from the installed gem, verify their embedded hashes and share a compatible Lean runtime. No runtime-path setting is needed.

### Arrays and records

For an installed [Parcels package](../publish/rubygems.md#export-arrays-and-records),
save `parcels.rb`:

```ruby
require "lean_bridge/parcels"

API = LeanBridge::Parcels
input = API::Parcel.new(label: "Seeds", counts: [2, 7])
result = API.reverse(input)
puts "#{result.label}: #{result.counts.join(', ')}"

expected = API::Parcel.new(label: "Seeds", counts: [7, 2])
raise "Unexpected result" unless result == expected
result.counts[0] = 99
p input.counts
```

Run `ruby parcels.rb`. It prints `Seeds: 7, 2` and `[2, 7]`. Returned arrays,
strings and nested records own independent copies. Record objects are frozen;
contained arrays and strings remain mutable.

Generated records and variant constructors implement field-by-field `==`,
`eql?`, `hash` and `deconstruct_keys`. They require the same Ruby class and use
Ruby's equality rules for their contents, including floating-point values.
Do not mutate a nested payload while using its containing record as a Hash key.

Conversions use built-in type checks and bounded snapshots of String bytes
and Array slots. Overridden instance methods cannot change native buffer sizes
or element selection. Record fields come from stored values, not overridden
accessors. Do not mutate inputs concurrently when you need a consistent snapshot
of an entire nested value. C/C++ keyword field names gain a trailing underscore,
such as `char_`, in this native-backed Ruby API.

The [installed collection checks](../evidence/ruby-collections-20260922.md)
cover every primitive element and field, nested arrays and seven record types
on ordinary-source and reviewed-IR builds.

### Tagged variants

Concrete copied Lean inductives use a named family and one constructor class per
case. Payloads use required keyword arguments and read-only accessors. For the
prepared `variants-api` acceptance gem, save `variants.rb`:

```ruby
require "lean_bridge/variants"

API = LeanBridge::Variants
input = API::Signal::Data.new(count: 42, label: "ready")
result = API.next(input)

case result
in API::Signal::Data(count:, label:)
  puts "#{count}: #{label}" # 43: ready!
in API::Signal::Idle
  puts "idle"
in API::Signal::Stopped
  puts "stopped"
in API::Signal::Marker(value:)
  puts "marker" if value.equal?(API::UNIT)
end
```

Run `ruby variants.rb`. `deconstruct_keys` supports pattern matching; Ruby does
not check exhaustiveness. Constructor families stay inside the package module,
so this `Signal` does not replace Ruby's standard `::Signal` module.

Calls accept only the exact generated case classes, not unknown subclasses,
hashes with tags or `nil`. Only the active payload is converted. Empty cases
and cases carrying `UNIT` remain distinct. Payloads can contain all nineteen
primitives, supported copied containers, records and other admitted variants.

Constructor objects are frozen. Contained strings and arrays remain mutable,
and the bridge copies them at the boundary. Generated value equality compares
the constructor class and its fields. The
existing 32-level type limit and conversion budgets apply. Scoped cleanup
releases partial conversions on failure. See the
[installed variant checks](../evidence/ruby-variants-20260921.md).
For recursive families, use the [recursive value profile](#recursive-values).
Callable and identity-bearing payloads remain unsupported.

### Named copied aliases

An alias uses its target's Ruby value. Pass an `Integer` to an alias of Nat or
UInt32, a `String` to an alias of String, and the generated record class to an
alias of that record. The gem's `binding-manifest.json`, README and public Ruby
source comments retain alias names, original targets and chains. Aliases do not
add separate Ruby constants, wrapper classes or RBS declarations.

For the prepared `aliases-api` acceptance gem, save `aliases.rb`:

```ruby
require "lean_bridge/aliases"

api = LeanBridge::Aliases
p api.increment(41)                      # 42; Count and OtherCount use Integer
p api.reverse_rows([[1, 2], [], [3]])     # [[2, 1], [], [3]]
p api.echo_maybe(api::Some.new(nil))      # Some containing None
p api.echo_maybe(api::Some.new(api::Some.new(api::UNIT)))

begin
  api.echo_nat(-1)
rescue RangeError
  puts "Nat cannot be negative"
end
p api.echo_int(-1)                       # -1
```

Run `ruby aliases.rb`. Alias parameters, results and record fields keep their
target checks, including unsigned ranges, exact large integers and one-scalar
characters. Unit remains `UNIT`, not `nil`. Returned arrays, strings and record
contents own independent copies. The existing copy budgets and 32-level type
limit apply. [Installed alias checks](../evidence/ruby-aliases-20260921.md) cover
both source paths, cleanup failures and relocated gems without producer sources.

### Lists

Lean `List T` uses a Ruby `Array` in inputs, results and copied record fields. Lists can nest with arrays, records, `Option`, `Except` and binary products. The adapter preserves empty Lists, order, duplicates and every nesting level. List and Array retain distinct Lean and Binding IR identities.

For the `lists-api` acceptance gem, install its prepared archive and save `lists.rb`:

```ruby
require "lean_bridge/lists"

api = LeanBridge::Lists
input = [1, 2, 2, 3]
reversed = api.reverse_uint32(input)
p reversed # [3, 2, 2, 1]
reversed[0] = 99
p input # [1, 2, 2, 3]
p api.reverse_uint32([]) # []
```

Run `ruby lists.rb`. Pass exact `Array` instances, including frozen arrays. Array subclasses, enumerators, `nil` and objects implementing `to_ary` are not accepted as Lists. Each element must match its declared Lean type. Returned arrays and mutable payloads own independent storage.

The existing copy budgets and 32-level type limit apply. Native sequence lengths, missing buffers and alignment are checked before output allocation or reads. [Installed List checks](../evidence/ruby-lists-20260921.md) cover both source paths, invalid inputs, cleanup failures, GC compaction and relocated gems without producer inputs. Lists also work in [structured callbacks and closures](#structured-callback-values).

### Options, results and products

`Option` uses `nil` for None and the generated `Some.new(value)` for Some. `Some.new(nil)` preserves an outer Some containing an inner None. `Some.new(UNIT)` preserves a present Unit value. These are three different values, not interchangeable spellings of absence.

`Except` uses `Ok.new(value)` or `Err.new(error)`. Both expose `value`; the class identifies the branch even when their payload types match. Domain errors return `Err`. Invalid host values and bridge failures raise exceptions.

For the package in the [author example](../publish/rubygems.md#export-options-results-and-products), save `compounds.rb`:

```ruby
require "lean_bridge/compounds"

API = LeanBridge::Compounds
Some, Ok, Err = API::Some, API::Ok, API::Err

p API.classify(nil)                          # 0
p API.classify(Some.new(nil))                # 1
p API.classify(Some.new(Some.new(API::UNIT))) # 2

case API.result_nat(Ok.new(2**200))
in Err(value)
  puts value # the Lean function flips Ok to Err, preserving the exact Nat
else
  raise "Expected Err"
end

p API.tuple_nat([10, 20]) # [20, 10]
```

Run `ruby compounds.rb`. Products use exactly two `Array` elements. Nested products keep their binary structure: `(a × b) × c` becomes `[[a, b], c]`, not `[a, b, c]`. Every element is validated against its Lean type when the function is called.

`Some`, `Ok` and `Err` are frozen Ruby `Data` classes with value equality, hashing and positional or keyword pattern matching. Freezing the wrapper does not freeze its nested arrays or strings. Calls copy those payloads, and returned buffers do not alias the input or one another. Generated record classes are also frozen and compare their fields by value.

The acyclic profile supports up to 32 type levels. Packages with recursive types use the limits below. The budgets cover conversion storage, not all Ruby allocations or Lean working memory. Resources and callback identities cannot be stored inside copied compounds. Acyclic copied compounds work as [callback arguments and results](#structured-callback-values). The [installed compound checks](../evidence/ruby-compounds-20260920.md) cover ordinary-source and reviewed-IR builds.

### Recursive values

Recursive Lean records and inductives use the same generated Ruby classes.
For the prepared `recursive-api` gem, save `recursive.rb`:

```ruby
require "lean_bridge/recursive"

API = LeanBridge::Recursive
input = API::Spine::Next.new(value: API::Spine::Leaf.new(value: 7))
result = API.spine(input)

raise "Wrong value" unless result == input
raise "Shared result" if result.equal?(input) || result.value.equal?(input.value)
case result
in API::Spine::Next(value: API::Spine::Leaf(value: value))
  puts value
else
  raise "Unexpected constructor"
end
```

Run `ruby recursive.rb`. It prints `7`. The
[author example](../publish/rubygems.md#export-recursive-values) defines this API.
Direct and mutual recursion can combine with arrays, Lists, records, aliases,
variants, nested options, results and products. Each returned value owns its
copies; shared input branches do not create shared mutable output payloads.

Recursive packages allow a maximum depth of 128 and 262,144 nodes. Input and
output share a 16 MiB native-copy budget and a separate 16 MiB accounted
conversion-storage budget. These limits do not include Lean working memory or
every Ruby allocation overhead. Cyclic object graphs and values of uninhabited
types raise exceptions. The adapter validates all arguments before native
allocation or runtime initialization.

Cleanup releases native outputs and temporary storage even when allocation
fails or another Ruby thread interrupts the call. Invalid native output retires
the shared runtime; further calls fail, but already returned Ruby values remain
usable. Independent calls can use Ruby threads. Native execution holds the GVL.
Calls after `fork`, calls from Ractors and `RUBY_MN_THREADS` are rejected; use a
fresh process after forking. Compatible packages share the runtime automatically.
Callbacks, closures, resources and asynchronous operations cannot be nested in
this copied profile.

### Callbacks and returned Lean closures

Ordinary gems accept synchronous callable objects, `Proc` values, method objects and a final Ruby block. Callback arguments and results support all nineteen primitives, [acyclic copied structures](#structured-callback-values) and [recursive copied values](#recursive-callback-values), with the same conversions as direct calls.

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

### Structured callback values

Callbacks and returned closures also accept acyclic copied arrays, Lists,
options, results, products, records, variants and aliases. They use the same
Ruby values as direct calls. Each argument and result owns its copied storage.

For the prepared `structured-api` gem, save `structured.rb`:

```ruby
require "lean_bridge/structured"

API = LeanBridge::Structured
rows = [nil, API::Some.new("first")]
result = API.call_array(rows) do |items|
  items + [API::Some.new("added λ")]
end
raise "Callback result" unless result == [nil, API::Some.new("first"), API::Some.new("added λ")]
raise "Changed input" unless rows == [nil, API::Some.new("first")]

API.make_array(rows).with do |choose|
  rows.clear
  raise "Captured copy" unless choose.call(true, []) == [nil, API::Some.new("first")]
  raise "Argument copy" unless choose.call(false, []) == []
end
```

Run `ruby structured.rb`. Arrays and Lists use exact Ruby `Array` values.
`Some.new(nil)` preserves nested presence, and a present Unit uses
`Some.new(API::UNIT)`. Records and constructor objects are frozen; their nested
strings and arrays remain mutable independent copies. Aliases use their target
values without extra Ruby constants.

The same lifetime and exception rules apply. Scoped buffers retain nested
callback results until native copying finishes. Resources inside copied values
and asynchronous callbacks remain unsupported.
The [installed checks](../evidence/ruby-structured-callables-20260924.md) cover
both source paths, the example above, nested mutation and exception cleanup.

### Recursive callback values

Recursive records and variants also work in callbacks and returned closures.
Use the same generated classes and exact Ruby arrays as direct calls. For the
prepared `structured-api` gem, save `recursive-callbacks.rb`:

```ruby
require "lean_bridge/structured"

API = LeanBridge::Structured
leaf = API::Tree::Leaf.new(value: 7)
tree = API::Tree::Branch.new(children: [leaf])

wrapped = API.call_recursive(tree) do |value|
  API::Tree::Branch.new(children: [value])
end
raise "unexpected callback result" unless wrapped == API::Tree::Branch.new(children: [tree])

empty = API::Tree::Branch.new(children: [])
choose = API.make_recursive(tree)
choose.with do |closure|
  raise "lost captured tree" unless closure.call(true, empty) == tree
  raise "unexpected input result" unless closure.call(false, empty) == empty
end
raise "closure was not closed" unless choose.closed?
```

Run `ruby recursive-callbacks.rb`. The
[Lean example](../publish/rubygems.md#export-recursive-callbacks-and-closures)
defines these exports. Installation loads the gem's compiled Lean libraries;
the application needs no native declarations or Lean compiler.

The [installed checks](../evidence/ruby-recursive-callables-20260925.md) cover
both source paths, these exact examples, failure cleanup and closure ownership.

Each argument, callback reply and captured result owns an independent copy.
Closures invoke only on their creating thread's lifetime, even if Ruby later
reuses the native thread ID. Use `with` or `close` to release captures; garbage
collection provides fallback cleanup. Callback exceptions return after native
cleanup. Non-local block exits raise `LocalJumpError`.

The [recursive conversion limits](#recursive-values) apply to callback values.
Native reentry allows at most 64 active calls, with 4,096 shared closure slots.
Callbacks cannot be retained after the exporting call, and resources or callable
identities cannot appear inside copied fields. Asynchronous delivery, post-fork
reuse, Ractors and M:N threads remain unsupported.

### Resource-containing values

An author can export records, variants and recursive values that contain
resources using the [explicit ownership profile](../publish/rubygems.md#export-resource-containing-values).
Install the prepared gem normally. It loads Lean and its private GMP dependency
automatically; applications need no Fiddle declarations or library paths.

For the `owned-values` gem built from a Lake package named `owned-aggregates`,
save `owned.rb`:

```ruby
require "lean_bridge/owned_aggregates"
API = LeanBridge::OwnedAggregates

retained = nil
begin
  API.new_ticket(42, "receipt").with do |ticket|
    payload = API::Payload.new(count: -7, bytes: "\0\xff".b)
    bundle = API::Bundle.new(
      primary: ticket, spare: nil, peers: [], history: [], payload: payload
    )
    result = API.callback_record(bundle, ->(value) {
      retained = value.primary.retain
      value
    })
    begin
      puts API.serial(result.primary)
    ensure
      result.primary.close
    end
  end
  puts API.serial(retained)
ensure
  retained&.close
end
```

Run `ruby owned.rb`. It prints `42` twice. `retain` keeps the callback's resource
alive after the callback returns and after the original ticket closes.
Unretained callback resources, including their duplicates, expire on return.

Use `with`, `close`, or an `ensure` block for deterministic cleanup. Each `dup`
or `clone` has an independent close guard over the shared result owner. Closing
one wrapper does not close its duplicates. `retain` creates an independent
native owner. Resource equality preserves identity; serialization and hashing
of resource wrappers reject.

Copied contents remain independent Ruby values. Options use `nil` or `Some`,
results use `Ok` or `Err`, and products use nested two-element Arrays. Original
callback exceptions return after native cleanup. Nonlocal exits cannot cross
the native call; attempted Fiber switches raise `FiberError`. A callback without
an argument-derived recovery value uses `API.with_recovery(callable, value)`.
Recovery values let Lean finish cleanup; they are never returned as successful
results of a failed callback.

This profile requires MRI Ruby 3.3 on little-endian Linux x86-64 with 1:1 native
threads. Resource calls belong to their creating Ruby thread and process. Thread
exit closes remaining owners; Ractors, M:N threads and calls after fork reject.
Inputs, callbacks and results share depth 128, 262,144 visits and a 16 MiB native
conversion budget, with a separate 16 MiB Ruby conversion-storage budget.
Packages with parameter-anchored results use the whole-owner API below.
Asynchronous callbacks remain unsupported.

### Transferred inputs

An author can declare a parameter as consuming its resource ownership. In a
package without result anchors, pass the ordinary Ruby value. At the Lean call boundary, its resource
leases close, including `dup`, `clone` and sibling resources sharing the same
result owner. Copied fields remain Ruby values. Call `retain` first when another
part of the application needs independent ownership.

For the transfer acceptance gem, save `owned-transfers.rb`:

```ruby file=ruby/owned-transfers.rb
require "lean_bridge/owned_aggregates"

api = LeanBridge::OwnedAggregates
original = api.new_ticket(42, "shipment")
duplicate = original.dup
independent = original.retain

begin
  api.retain_ticket(original).with do |received|
    raise "Alias stayed open" unless original.closed? && duplicate.closed?
    raise "Changed value" unless api.serial(received) == 42
    raise "Independent owner closed" unless api.serial(independent) == 42
  end
ensure
  independent.close
end
puts "transferred"
```

Run `ruby owned-transfers.rb`. This fixture declares `retain_ticket`'s parameter
as transferred. Ownership follows the publisher's contract, not the function's
name. Generated function comments name the consuming arguments.

Validation and preparation failures preserve the inputs. After handoff, callback
exceptions and result-conversion failures leave them consumed. Reentrant
callbacks see caller aliases as closed while callback-local borrows remain
usable. Retain a callback borrow before transferring it. Two consuming arguments
cannot share a resource lease; use independent retains. Borrow-only functions
keep their existing behavior.

### Results borrowed from an input

A publisher can tie a result to an input's original owner. In these packages,
every resource-containing result uses `Value`, including empty containers and
variants. `get` checks the owner before returning its Ruby value. Parameters
used as result anchors or transferred inputs require the `Value` itself;
other parameters accept ordinary Ruby values.

For the prepared `owned-borrows` gem, save `owned-borrows.rb`:

```ruby file=ruby/owned-borrows.rb
require "lean_bridge/owned_aggregates"

api = LeanBridge::OwnedAggregates
owner = api.new_ticket(42, "owner")
view = api.retain_ticket(owner)
independent = view.retain
puts api.serial(view.get)

owner.close
raise "Borrowed result outlived its owner" unless view.closed?
raise "Independent owner was lost" unless api.serial(independent.get) == 42
view.close
independent.close
```

Run `ruby owned-borrows.rb`. It prints `42`. Releasing or transferring the
original owner expires its borrowed results and all their descendants.
`view.get` then raises `LeanBridgeError`. An independent retain stays usable.

`dup` and `clone` share a whole owner with separate close guards. Closing one
wrapper leaves the others usable. Closing the last whole-owner wrapper also
expires raw resource views obtained through `get`; those views do not keep the
owner alive. Use `retain` on the wrapper or a resource to create independent
ownership. Copied Ruby fields remain ordinary data after their owner closes.
`with` and `ensure` provide deterministic cleanup; GC queues fallback release
on the creating thread.

Whole-value reads, retains, `dup` and `clone` capture their payload before
validation. If another thread closes the wrapper during an operation, that
operation uses its captured payload or raises `LeanBridgeError` for expiration.
Resource calls still run on the creating thread.

Use `api.copy_value(record_or_resource)` for a nominal value. For an empty or
ambiguous container, choose its declared type with
`api.copy_value([], result_of: :echo_array)` or
`api.copy_value([], parameter_of: [:bundle, :arg2])`. These symbols select a
type without calling the named function. `Value#retain` copies its known type.

Transferred parameters consume the original `Value` owner, including an empty
one, before callback reentry. Borrowed roots, duplicate consuming owners and
conflicting anchors reject before handoff. Preflight errors preserve inputs;
errors after handoff leave them consumed. Resource equality compares canonical
native identity and raises on expired values. Owners and resource wrappers
cannot be serialized or used as Hash keys.

### Methods and properties

Publishers can expose Lean functions as members of their declared receiver
type. Call methods on the returned `Value` owner. Read-only properties use
zero-argument Ruby methods, such as `owner.serial`; they have no setter.
The module-level function remains available.

For the prepared `owned-receivers` acceptance gem, save `owned-receivers.rb`:

```ruby file=ruby/owned-receivers.rb
require "lean_bridge/owned_aggregates"

api = LeanBridge::OwnedAggregates
owner = api.new_ticket(42, "owner")
view = owner.retain_ticket
independent = view.retain
begin
  puts owner.serial
  owner.close
  raise "Borrowed result outlived its owner" unless view.closed?
  puts independent.serial
ensure
  [owner, view, independent].each(&:close)
end
```

Run `ruby owned-receivers.rb`. It prints `42` twice. The member call preserves
the publisher's ownership contract: receiver-anchored results expire with the
original owner; `retain` creates independent ownership. A result anchored to a
different argument follows that argument, not the receiver. Consuming members
transfer the original owner and invalidate its aliases before callback reentry.

Each member checks the receiver's exact generated type and lifetime. Calling a
Ticket member on a record owner raises `NoMethodError`. A raw resource from
`get` exposes only members that neither consume nor borrow from its receiver.
Methods on records, variants and recursive values belong to the `Value` owner;
`owner.get.primary` still reads the record field, while `owner.primary` calls
the exported Lean property. Ordinary Ruby class-level introspection and unbound
method calls work, including `api::Value.instance_method(:serial)`.

These APIs do not require callbacks or result anchors when the exported Lean
functions do not use them. See the [author configuration](../publish/rubygems.md#export-methods-and-properties).

### Results borrowed from a callback argument

A returned Lean function can tie its result to one of that function's arguments.
Pass the selected argument as its whole `Value` owner. Callback argument numbers
start at zero inside the returned function; they do not include its closure or
the outer export's arguments.

For the `owned-callback-results` acceptance gem, save `owned-callback-results.rb`:

```ruby file=ruby/owned-callback-results.rb
require "lean_bridge/owned_aggregates"

api = LeanBridge::OwnedAggregates
ticket = api.new_ticket(42, "owner")
owner = api.copy_value(api::Tree::Leaf.new(ticket: ticket.get))
callback = api.make_recursive(owner.get)
view = callback.call(false, owner)
independent = view.retain
begin
  puts api.serial(view.get.ticket)
  owner.close
  raise "Callback result outlived its owner" unless view.closed?
  puts api.serial(independent.get.ticket)
ensure
  [ticket, owner, callback, view, independent].each(&:close)
end
```

The declared callback result follows `owner`, the second argument to `call`.
The original owner's last alias closing, its thread exiting, or a consuming
handoff expires the result and its descendants. Closing the callback itself does
not substitute a different owner. Empty recursive values obey the same contract.
An explicit `retain` or `copy_value` creates independent ownership.

These callback-local anchors work without host callbacks, export-result anchors
or receiver methods. A package that also accepts Ruby callbacks can receive raw
argument values or a correctly typed whole `Value` as the reply or recovery
value. The bridge converts the reply before expiring its callback-local views.
Returned Lean functions can be passed back as callbacks using either their
whole owner or their checked `get` value. Asynchronous delivery remains unsupported.

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

### Bounded integers

A Lean `Fin n` parameter or result is an `Integer`, the same as `Nat`. For `Library.mirror (value : Fin 10) : Fin 10`, `mirror(3)` returns `6`. `mirror(10)` raises `RangeError` with the message `arg0 is not below its Fin 10 bound`. A negative value raises the `RangeError` that `Nat` raises, and a non-Integer raises `TypeError`. Caller data stays unchanged after rejection, and a later valid call still works. `Fin 0` parameters reject every value; bounds wider than 64 bits are compared exactly. A comment on each generated method and the gem README state the bound.

Ordinary-source and reviewed-IR packages also check bounds inside `Array`, `List`, `Option`, binary products, the active `Except` branch, and nonrecursive, nongeneric record or variant fields. Products use two-element Arrays, `Option` uses `nil` or `Some`, and `Except` uses `Err` or `Ok`. Every present constrained value is checked; empty containers, absent options and inactive branches remain valid for `Fin 0`.

The [structural Fin receipt](../evidence/fin-python-ruby-20261008/receipt-v2.json) records ordinary-source and reviewed-IR checks on Ruby 3.3.12, including arrays of products, nested records, invalid inputs, unchanged caller data and recovery. It supplements the [scalar](../evidence/native-fin-hosts-20261006.md) and [container](../evidence/native-fin-containers-20261006.md) checks. These runs do not measure dispatch or establish recursive, generic or indexed refined fields, Subtype fields or callbacks.

The separate [scalar entry-counter receipt](../evidence/ruby-fin-dispatch-20261009/receipt.json) records both ordinary-source and reviewed-IR gems after source removal, offline installation and relocation. GDB counted the actual Lean source and adapter entries: rejected `mirror`, `impossible` and `label` calls entered neither; valid and recovery calls entered their own source and adapter once. Both consumers passed 2,029 checks on Ruby 3.3.12 with GDB 13.1 on x86-64 Linux and a glibc 2.36 package floor. The measurement leaves the generated loader and installed files unchanged and instruments process memory. It covers these top-level scalar calls, not nested refinements or other platforms.

## Values and cleanup

### Checked values

A Lean `Subtype` parameter or result over a primitive base, such as `{ value : String // value.length > 0 }`, uses the base's usual type. The package runs the author's checked constructor from the export contract before the exported function; a rejected value fails the call with the same invalid-argument error as a `Fin` bound, with the message naming the parameter and constructor (`arg0 was rejected by Library.checkedWord`), and caller data stays unchanged. The exported function receives the constructed value, which a normalizing constructor may change. The package README names each constructor. Only top-level parameters and results are supported; see the [installed checks](../evidence/native-subtype-20261007.md).

### Type conversions

Profiles: Ruby. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `UNIT singleton` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Use the generated UNIT singleton in every position, including results. Nil is rejected. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `true or false` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Integer in 0..255; invalid range or implicit coercion throws. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Integer in 0..65535; invalid range or implicit coercion throws. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Integer in 0..4294967295, with no floating-point conversion. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Integer in 0..18446744073709551615, with no narrowing. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: -128..127; reject overflow before narrowing. |
| `Int16` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact Integer magnitude; negative input throws. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact signed Integer without a fixed bit-width limit. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `Float` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Float inputs round to binary32; NaN classification, infinities and signed zero are tested. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `Float` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `String` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Require valid UTF-8 or US-ASCII, preserving embedded NUL. Nil, malformed text and incompatible encodings throw. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `Binary String` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Binary String with independent returned storage; no text decoding. The same exact Ruby representation and validation apply to direct calls, callback arguments/results and returned-closure arguments/results. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `Array` (input, result, field); `Array with independently copied contents` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Array elements are recursively checked and copied. Nil is admitted only at Option positions. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows, post-fork use and over-budget values reject without retaining partial owners or closure leases. Exact Array instances preserve every primitive, order, empty and nested arrays and records. Builtin-bound slot snapshots ignore overridden length/index methods. Returned mutable values own independent storage. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `nil or Some` (input, result, field); `nil or Some(value), preserving nested presence` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | None is nil; Some.new(value) retains presence. Some.new(nil) represents an outer Some of an inner None; Some.new(UNIT) preserves present Unit. Some is a frozen Data class with equality and pattern matching. Concrete payload types are validated at the call; nil is valid only in Option positions. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows, post-fork use and over-budget values reject without retaining partial owners or closure leases. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `Ok or Err` (input, result, field); `Ok(value) or Err(value)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Lean `Except E T` becomes Ok.new(value) or Err.new(error), both exposing value. Exact branch classes preserve success/error identity, including same-typed payloads. Frozen Data wrappers support equality and patterns. Domain errors return Err; bridge failures raise. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows, post-fork use and over-budget values reject without retaining partial owners or closure leases. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `Array (exactly two elements, nested binary products)` (input, result, field); `two-element Array (nested binary products)` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly two Array elements, preserving binary nesting and per-position validation. Inputs are copied; returned arrays and strings own independent storage. Branch wrapper fields are frozen, but nested mutable payloads are not. Generated record classes compare fields by value within the same record class. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows, post-fork use and over-budget values reject without retaining partial owners or closure leases. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `Generated Ruby record` (input, result, field); `Generated frozen record class` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Generated keyword-initialized record classes preserve field order through compiler-owned accessors. Nested returned arrays and strings are independent copies. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows, post-fork use and over-budget values reject without retaining partial owners or closure leases. Generated keyword-initialized record classes preserve stored field values and nested copies. Records support nominal field-by-field ==, eql?, hash and deconstruct_keys. Objects are frozen; contained arrays and strings remain mutable. C/C++ keyword fields gain a trailing underscore, such as char_. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Ruby target value; named Lean contract in gem metadata and API comments` (input, result, field); `Target Ruby value without an extra wrapper or constant` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Aliases retain exact target checks and independent copied storage. Nat rejects negative Integer values; Int accepts them. Char requires a one-scalar string, Unit uses UNIT rather than nil, and fixed-width and machine-word integers retain their ranges. List/Array identities, Option/Result presence, type depth and copy limits remain unchanged. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows, post-fork use and over-budget values reject without retaining partial owners or closure leases. Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `named Ruby constructor class with keyword payloads` (input, result, field); `Generated frozen constructor class` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Construct values with Family::Case.new(field: value) and match using deconstruct_keys. Empty constructors and UNIT payloads stay distinct. Only exact generated case classes are accepted; nil and tagged hashes reject. Inputs and outputs have independent copied payload storage. Native tags and union layouts remain private, and invalid tags reject before active payload reads. Scoped scratch and output cleanup release partial conversions on errors. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows, post-fork use and over-budget values reject without retaining partial owners or closure leases. Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `Proc, method, callable object or block` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | `Array` (input, result, field); `Array with independently copied contents` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact Ruby Arrays preserve empty Lists, order, duplicates and nesting; frozen inputs are accepted. Returned arrays and mutable payloads own independent storage. Subclasses, coercion objects, nil containers, invalid payloads and oversized copies reject. Native lengths, missing buffers and alignment are checked before allocation or reads; scratch and native output cleanup runs on conversion failure. Generated values preserve option presence, domain branches, constructor identity and independent storage. Scoped owners retain callback result buffers through native copying. Callback exceptions propagate after native cleanup. Faults, expired borrows, post-fork use and over-budget values reject without retaining partial owners or closure leases. Required: Preserve order, duplicates and nesting with a distinct list constructor. Validate all elements and copying limits; never expose Lean cons cells. |
| `Char` | `String` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. Inputs require valid UTF-8 or US-ASCII encoding. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, 0..18446744073709551615. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `Integer` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. The range follows the compiled core, not the consuming process. Reject wrong types and out-of-range inputs before narrowing. Lean arithmetic retains word-width wraparound. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | `Integer checked against the declared bound` (input); `Integer below the declared bound` (result); `Integer checked against the field's closed bound` (field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Use Integer values with exact closed bounds. Arrays/Lists use Array, products use two-element Arrays, Option uses nil/Some, and Except uses Err/Ok. Record and active variant fields retain their declared bounds. Empty, absent and inactive Fin 0 payloads are valid; every present Fin 0 value is rejected. Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | `Integer, String and binary String, checked by the exported Lean validator and constructed by the adapter before dispatch` (input); `the base value projected from the proof-backed Lean result` (result) | Ordinary source: Installed checks passed (input, result); Not audited (field, callback input, callback result). Reviewed IR: Not audited | Values cross as their base. The exported validator and the adapter each run the author's checked constructor independently; the export receives the constructed value. Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Checked records and closed Nat indices` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Construct inputs only through the selected safe Lean constructor over the exact payload fields. Preserve closed indices and per-site choices; project proof-backed results without fabricating proofs. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | `Named frozen keyword-initialized records and constructors, exact Arrays and Strings, explicit UNIT/Some/Ok/Err` (input, result, field); `Named frozen records and constructors, exact Arrays and Strings, synchronous Ruby callables and owned LeanClosure values` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Pass exact generated classes with required keywords. Arrays and Lists use exact Ruby Arrays. Returned mutable payloads own independent storage. All arguments validate before native allocation or runtime initialization; ensure blocks release temporary storage and owned native results on failures and interruptions. Malformed output retires the shared runtime. Native calls hold the GVL; post-fork reuse, Ractors and M:N threads reject. Recursive values and aliases retain their public representations and independent copied storage. Callback frames keep replies alive until native copying finishes. Original callback exceptions return after cleanup; non-local block exits raise LocalJumpError. Malformed native output retires the runtime. Closure identities release on close, scoped with cleanup or finalization, with deferred release during an active invocation. Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | `Concrete Ruby module method for each configured specialization` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Generation rejected | Each configured type application becomes a distinct monomorphic host function. The unspecialized Lean declaration is absent. Name a closed generic structure application with an abbrev to get a host record with instantiated fields. Configured functions over these records, List aliases and Option aliases use ordinary concrete signatures. Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | `Concrete host signature with no runtime type argument` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Lean elaboration supplies configured type arguments before native compilation; the host passes no placeholder value. Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | `Concrete host signature with the Lean-selected instance dictionary erased` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Lean synthesizes the selected dictionary before native compilation. The host cannot provide or replace it. Required: Specialize or supply the selected dictionary without changing runtime behavior. |
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
