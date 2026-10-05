# Independent installed-gem acceptance. No Lean or C compiler is available.
require "lean_bridge/callables"
require "weakref"
at_exit { $!.set_backtrace($!.backtrace.first(8)) if $! && $!.backtrace }
API = LeanBridge::Callables
NATIVE = API.const_get(:Native)
$checks = 0
def check(value)
  $checks += 1
  raise "check #{$checks} failed" unless value
end
def same(actual, expected)
  check(actual.class == expected.class)
  if expected.is_a?(Float)
    check(expected.nan? ? actual.nan? : actual == expected)
    check(1.0 / actual == 1.0 / expected) if expected.zero?
  else
    check(actual == expected)
  end
  check(actual.encoding == expected.encoding) if expected.is_a?(String)
end
def rejects(kind)
  begin
    yield
  rescue kind => failure
    check(true)
    return failure
  end
  raise "expected #{kind}"
end
SNAPSHOT = Fiddle::Function.new(NATIVE::LIBRARY["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
def live
  Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) do |memory|
    SNAPSHOT.call(memory)
    memory[20, 4].unpack1("L<")
  end
end
check(API.word_bits == 64)
baseline = live
huge = (1 << 5120) + (1 << 255) + 17
cases = {
  unit: [API::UNIT], bool: [false, true],
  nat: [0, 1, 2**31, 2**32, 2**53 - 1, 2**53 + 1, 2**64, huge],
  int: [0, -1, 2**31, -(2**32), 2**53 + 1, -(2**64), huge, -huge],
  float32: [0.0, -0.0, 1.25, -1.25, 1.0 / 3, 2.0**-149, -2.0**-149,
            Float::INFINITY, -Float::INFINITY, Float::NAN, 1e300],
  float: [0.0, -0.0, 1.0 / 3, -1.25, 2.0**-1074, -2.0**-1074,
          Float::INFINITY, -Float::INFINITY, Float::NAN],
  string: ["", "a\0λ🌿", "\0", "\u{10ffff}", "e\u0301"],
  bytes: ["".b, "\0\xff\x80".b, (0..255).to_a.pack("C*")],
  char: ["\0", "\x7f", "\u{d7ff}", "\u{e000}", "\u{ffff}", "\u{10000}", "🌿", "\u{10ffff}"]
}
[8, 16, 32, 64].each do |bits|
  cases["uint#{bits}".to_sym] = [0, 1, 2**bits - 1]
  cases["int#{bits}".to_sym] = [-(2**(bits - 1)), -1, 0, 2**(bits - 1) - 1]
end
cases[:uint64] += [2**31, 2**32, 2**53 - 1, 2**53 + 1]
cases[:int64] += [2**31, -(2**32), 2**53 + 1]
cases[:usize] = cases[:uint64]
cases[:isize] = cases[:int64]
check(cases.length == 19)
cases.each do |name, values|
  normalize = name == :float32 ? ->(x) { [x].pack("e").unpack1("e") } : ->(x) { x }
  128.times do |index|
    value, other = values[index % values.length], values[(index + 1) % values.length]
    expected, replacement = normalize.call(value), normalize.call(other)
    seen = []
    result = API.public_send("call_#{name}", value) { |item| same(item, expected); seen << item; other }
    same(result, replacement)
    check(seen.length == 1)
    seen.clear
    result = API.public_send("twice_#{name}", value, ->(item) {
      same(item, seen.empty? ? expected : replacement)
      seen << item
      other
    })
    same(result, replacement)
    check(seen.length == 2)
    closure = API.public_send("make_#{name}", value)
    check(!closure.closed?)
    same(closure.with { |fn| same(fn.call(true, other), expected); fn.call(false, other) }, replacement)
    check(closure.closed?)
    closure.close
    rejects(API::LeanBridgeError) { closure.call(true, other) }
  end
end
check(live == baseline)

# Objects with call, method objects, and a final block are ordinary Ruby APIs.
object = Object.new
def object.call(x); x + 1; end
check(API.call_uint32(4, object) == 5)
check(API.call_uint32(4, object.method(:call)) == 5)
rejects(ArgumentError) { API.call_uint32(1, object) { |v| v } }
rejects(TypeError) { API.call_uint32(1, nil) }
rejects(TypeError) { API.call_uint32(1, false) }
check(API.combine("λ\0", 2**64 - 1, ->(s, n) { s + n.to_s }) { |s| s + "🌿" } == "λ\0#{2**64 - 1}🌿")

invalid = { unit: [[nil, TypeError]], bool: [[0, TypeError]], nat: [[-1, RangeError], [1.0, TypeError]],
  int: [[false, TypeError]], float32: [[1, TypeError]], float: [[nil, TypeError]],
  string: [[nil, TypeError], ["\xff".force_encoding("UTF-8"), EncodingError]],
  bytes: [[[], TypeError]], char: [["", RangeError], ["ab", RangeError], ["\xed\xa0\x80".force_encoding("UTF-8"), EncodingError], [0, TypeError]] }
[8, 16, 32, 64].each do |bits|
  invalid["uint#{bits}".to_sym] = [[-1, RangeError], [2**bits, RangeError], [true, TypeError]]
  invalid["int#{bits}".to_sym] = [[-(2**(bits - 1)) - 1, RangeError], [2**(bits - 1), RangeError], [1.0, TypeError]]
end
invalid[:usize], invalid[:isize] = invalid[:uint64], invalid[:int64]
invalid.each do |name, entries|
  valid = cases[name][0]
  entries.each do |bad, error|
    rejects(error) { API.public_send("call_#{name}", bad) { raise "must not run" } }
    rejects(error) { API.public_send("twice_#{name}", valid) { bad } }
    rejects(error) { API.public_send("make_#{name}", bad) }
    API.public_send("make_#{name}", valid).with do |fn|
      rejects(error) { fn.call(false, bad) }
      rejects(TypeError) { fn.call(nil, valid) }
      rejects(ArgumentError) { fn.call }
    end
  end
end

# Every exception stays inside the Ruby trampoline until native cleanup finishes.
[RuntimeError, Exception, NoMemoryError, SystemExit].each do |type|
  failure, count = type.new("original\0failure"), 0
  caught = rejects(type) { API.twice_string("a") { count += 1; raise failure } }
  check(caught.equal?(failure) && count == 1)
  check(API.call_uint32(2) { |n| n + 1 } == 3)
end
check(API.call_uint32(3) { |n| rejects(RuntimeError) { API.call_uint32(n) { raise "inner" } }; n + 1 } == 4)
check(API.call_uint32(3) { |n| API.call_uint32(n) { |m| m + 2 } } == 5)
def nested(depth)
  API.call_uint32(depth) { |n| n.zero? ? 0 : nested(n - 1) }
end
check(nested(12) == 0)
check(rejects(API::LeanBridgeError) { nested(65) }.message.include?("64"))
check(nested(3) == 0)
def nonlocal_return
  API.twice_uint32(1) { return 123 }
end
rejects(LocalJumpError) { nonlocal_return }
rejects(LocalJumpError) { API.twice_uint32(1) { break 123 } }
rejects(LocalJumpError) { catch(:escape) { API.twice_uint32(1) { throw :escape, 123 } } }
check(API.call_uint32(1) { |n| n } == 1)

# A suspended callback cannot interleave another native call on the same thread.
fiber = Fiber.new { API.call_uint32(2) { |n| Fiber.yield(:paused); n + 1 } }
check(fiber.resume == :paused)
rejects(API::LeanBridgeError) { API.call_uint32(1) { |n| n } }
check(fiber.resume == 3)
check(API.call_uint32(1) { |n| n } == 1)

escaped = API.retain_callback { |n| n + 1 }
rejects(RangeError) { escaped.call(3) }
100.times { check(API.call_uint32(1) { |n| n + 1 } == 2) }
rejects(RangeError) { escaped.call(3) }
escaped.close
check(live == baseline)

API.make_uint32(42).with do |closure|
  rejects(TypeError) { closure.dup }
  rejects(TypeError) { closure.clone }
  rejects(TypeError) { Marshal.dump(closure) }
  Thread.new { rejects(API::LeanBridgeError) { closure.call(true, 0) } }.value
end
4.times.map { Thread.new {
  100.times {
    API.make_unit(API::UNIT).with { |fn| check(fn.call(true, API::UNIT).equal?(API::UNIT)) }
    API.make_nat(huge).with { |fn| check(fn.call(false, 7) == 7) }
    check(API.call_uint64(2**64 - 1) { |v| v } == 2**64 - 1)
  }
} }.each(&:value)
check(live == baseline)

# Scope scratch, callback return and owned result cleanup under allocation faults.
scope = NATIVE.const_get(:Scope)
allocated, callbacks, allocation = [], [], 0
tracking = true
inject_at = nil
scope.prepend(Module.new do
  define_method(:allocate) do |*args, **kwargs|
    pointer = super(*args, **kwargs)
    allocated << pointer if tracking
    allocation += 1
    raise NoMemoryError, "injected scratch failure" if allocation == inject_at
    pointer
  end
  define_method(:retain_callback) do |function|
    callbacks << function if tracking
    super(function)
  end
end)
API.call_string("input") { "output" }
allocation_count = allocation
check(allocation_count >= 7)
allocated.clear; callbacks.clear
allocation_count.times do |i|
  allocation, inject_at = 0, i + 1
  rejects(NoMemoryError) { API.call_string("input") { "output" } }
  check(allocated.all?(&:freed?) && callbacks.all?(&:freed?))
  allocated.clear; callbacks.clear
end
inject_at = nil
rejects(RangeError) { API.call_string("x" * (16 * 1024 * 1024 + 1)) { |s| s } }
rejects(RangeError) { API.twice_string("x") { "x" * (16 * 1024 * 1024 + 1) } }
check(allocated.all?(&:freed?) && callbacks.all?(&:freed?))
allocated.clear; callbacks.clear
tracking = false

# A Ruby result-conversion exception still clears the C-owned output.
cleared, fail_conversion = 0, true
NATIVE.constants.grep(/^CLEAR\d+$/).each do |name|
  NATIVE.const_get(name).define_singleton_method(:call) do |*args|
    cleared += 1
    super(*args)
  end
end
from_methods = NATIVE.methods.grep(/^from\d+$/)
NATIVE.singleton_class.prepend(Module.new do
  from_methods.each do |name|
    define_method(name) do |*args|
      value = super(*args)
      raise NoMemoryError, "injected result conversion failure" if fail_conversion && value == "owned result"
      value
    end
  end
end)
rejects(NoMemoryError) { API.call_string("input") { "owned result" } }
check(cleared == 1 && live == baseline)
fail_conversion = false

# A box is not an owned output until its null pointer has been initialized.
fail_owned_zero, failed_box = true, nil
Fiddle::Pointer.singleton_class.prepend(Module.new do
  define_method(:malloc) do |*args, &block|
    pointer = super(*args, &block)
    if fail_owned_zero && args[0] == 8
      failed_box = pointer
      pointer.define_singleton_method(:[]=) { |*| raise NoMemoryError, "injected output initialization failure" }
    end
    pointer
  end
end)
rejects(NoMemoryError) { API.make_nat(huge) }
check(failed_box.freed? && live == baseline)
fail_owned_zero = false

# Failure immediately before or after ownership transfer must drop one lease.
lease_class = NATIVE.const_get(:Lease)
fail_lease = true
lease_class.prepend(Module.new do
  define_method(:initialize) do |*args|
    raise NoMemoryError, "injected lease allocation failure" if fail_lease
    super(*args)
  end
end)
rejects(NoMemoryError) { API.make_nat(huge) }
check(live == baseline)
fail_lease = false
own_methods = NATIVE.methods.grep(/^own\d+$/)
fail_after_wrap = true
NATIVE.singleton_class.prepend(Module.new do
  own_methods.each do |name|
    define_method(name) do |*args|
      result = super(*args)
      raise NoMemoryError, "injected post-wrap failure" if fail_after_wrap
      result
    end
  end
end)
rejects(NoMemoryError) { API.make_nat(huge) }
GC.start
check(live == baseline)
fail_after_wrap = false

# Deferred self-close during conversion and a concurrent close during an active call.
to_bool = NATIVE.methods.grep(/^to\d+$/).find do |name|
  begin
    NATIVE.public_send(name, true) == 1
  rescue TypeError, ArgumentError
    false
  end
end
hook = nil
NATIVE.singleton_class.prepend(Module.new do
  define_method(to_bool) do |*args|
    action = hook; hook = nil
    action.call if action
    super(*args)
  end
end)
closure = API.make_uint32(42)
hook = -> { closure.close; check(closure.closed?) }
check(closure.call(true, 1) == 42)
check(live == baseline)
closure = API.make_uint32(43)
started = Queue.new
closer = Thread.new { started.pop; closure.close }
hook = -> { started << true; Thread.pass }
check(closure.call(true, 1) == 43)
closer.value
check(closure.closed? && live == baseline)

def abandon
  100.times { API.make_nat(2**1000) }
  callable = ->(x) { x }
  weak = WeakRef.new(callable)
  API.call_uint32(1, callable)
  weak
end
weak = abandon
5.times { GC.start; GC.compact }
check(!weak.weakref_alive? && live == baseline)
leases = Array.new(4096) { API.make_uint32(1) }
check(live == baseline + 4096)
rejects(API::LeanBridgeError) { API.make_uint32(2) }
leases.each(&:close)
check(live == baseline)
API.make_uint32(3).with { |fn| check(fn.call(true, 0) == 3) }

API.make_uint32(4).with do |fn|
  pid = fork do
    begin
      rejects(API::LeanBridgeError) { fn.call(true, 0) }
      rejects(API::LeanBridgeError) { fn.close }
      rejects(API::LeanBridgeError) { API.call_uint32(1) { |x| x } }
      exit! 0
    rescue Exception
      exit! 1
    end
  end
  Process.wait(pid)
  check($?.success?)
end
GC.start; GC.compact
check(live == baseline)
puts "callable-ruby-ok:#{$checks}"
