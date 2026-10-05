# Installed public API only. No compiler, source tree or native helper access.
require "json"
require "weakref"
require_relative "ruby-values"
API = StructuredValues::API
SHAPES = StructuredValues::SHAPES
$checks = $calls = $rejected = 0
COUNT_LOCK = Mutex.new

def check(value)
  number = COUNT_LOCK.synchronize { $checks += 1 }
  raise "structured Ruby check #{number} failed" unless value
end

def same(actual, expected)
  check(actual.class == expected.class)
  check(actual == expected)
  if expected.instance_of?(String)
    check(actual.encoding == expected.encoding)
  elsif expected.instance_of?(Array)
    actual.zip(expected).each { |left, right| same(left, right) }
  elsif expected.is_a?(API::Some) || expected.is_a?(API::Ok) || expected.is_a?(API::Err)
    check(actual.frozen?)
    same(actual.value, expected.value)
  elsif expected.is_a?(API::Payload) || expected.is_a?(API::Packet)
    check(actual.frozen?)
    expected.deconstruct_keys(nil).each { |name, item| same(actual.public_send(name), item) }
  end
end

def rejects(*kinds)
  begin
    yield
  rescue *kinds => failure
    COUNT_LOCK.synchronize { $rejected += 1 }
    return failure
  end
  raise "expected #{kinds}"
end

class Marker < Exception; end

SHAPES.each do |shape|
  call, twice, make = %w[call twice make].map { |action| API.method("#{action}_#{shape}") }
  24.times do |seed|
    value, other = [seed, seed + 1].map { |n| StructuredValues.payload(shape, n) }
    expected, replacement = [value, other].map { |item| StructuredValues.snapshot(item) }
    seen = []
    same(call.call(value) { |item| same(item, expected); seen << item; other }, replacement)
    $calls += 1
    check(seen.length == 1)
    GC.start
    same(seen.first, expected)
    seen.clear
    same(twice.call(value, ->(item) {
      same(item, seen.empty? ? expected : replacement)
      seen << item
      seen.length == 1 ? other : value
    }), expected)
    $calls += 1
    check(seen.length == 2)
    first, second = make.call(value), make.call(other)
    first.with do |closure|
      second.with do |another|
        check(closure.instance_of?(API::LeanClosure) && !closure.closed?)
        same(closure.call(true, other), expected)
        same(closure.call(false, other), replacement)
        same(another.call(true, value), replacement)
        same(another.call(false, value), expected)
        $calls += 6
      end
    end
    check(first.closed? && second.closed?)
    first.close
    rejects(API::LeanBridgeError) { first.call(true, other) }
  end

  value = StructuredValues.payload(shape, 1)
  [RuntimeError, Marker, NoMemoryError, SystemExit].each do |kind|
    marker, seen = kind.new(shape), []
    fail_callback = ->(item) { seen << item; raise marker }
    check(rejects(kind) { twice.call(value, fail_callback) }.equal?(marker))
    check(seen.length == 1)
    same(call.call(value) { |item| item }, value)
    same(call.call(value) { |item|
      check(rejects(kind) { call.call(item, fail_callback) }.equal?(marker))
      call.call(item) { |inner| inner }
    }, value)
  end
  make.call(value).with do |closure|
    same(call.call(value) { |item| closure.call(true, item) }, value)
    rejects(TypeError) { closure.dup }
    rejects(TypeError) { closure.clone }
    rejects(TypeError) { Marshal.dump(closure) }
    Thread.new do
      error = rejects(API::LeanBridgeError) { closure.call(true, value) }
      check(error.message.include?("creating thread"))
    end.value
    rejects(ArgumentError) { closure.call }
    rejects(TypeError) { closure.call(nil, value) }
  end
  [Object.new, { untyped: value }].each do |bad|
    seen = []
    rejects(TypeError, RangeError) { call.call(bad) { |item| seen << item } }
    check(seen.empty?)
    rejects(TypeError, RangeError) { call.call(value) { bad } }
    rejects(TypeError, RangeError) { make.call(bad) }
    make.call(value).with { |closure| rejects(TypeError, RangeError) { closure.call(false, bad) } }
    same(call.call(value) { |item| item }, value)
  end
end

bad_text = "\xff".force_encoding("UTF-8")
invalid = {
  "array" => [[API::Some.new("ok"), API::Some.new(1)], [API::Some.new(bad_text)]],
  "list" => [[API::Ok.new([1, "ok"]), API::Ok.new([true, "wrong"])], [API::Err.new(1)]],
  "option" => [API::Some.new(API::Some.new(nil)), API::Some.new(0)],
  "result" => [API::Ok.new(API::Some.new(-1)), API::Err.new(["ok", 1])],
  "tuple" => [["ok", [nil, 1]], ["ok", ["".b, -1]]],
  "record" => [API::Payload.new(text: "ok", rows: [API::Some.new(1)], count: 1, nested: nil),
               API::Payload.new(text: "ok", rows: [], count: 1, nested: API::Some.new(API::Ok.new([1 << 64, API::UNIT])))],
  "variant" => [API::Packet::Payload.new(label: "ok", rows: [API::Some.new(1)]),
                API::Packet::Counts.new(positive: -1, negative: 0)],
  "alias" => [API::Payload.new(text: "ok", rows: [], count: true, nested: nil),
              API::Payload.new(text: "ok", rows: [], count: 1, nested: API::Some.new(API::Err.new(1)))]
}
invalid.each do |shape, bad_values|
  value = StructuredValues.payload(shape, 1)
  bad_values.each do |bad|
    hits = []
    rejects(TypeError, RangeError, EncodingError) { API.public_send("call_#{shape}", bad) { |item| hits << item } }
    check(hits.empty?)
    rejects(TypeError, RangeError, EncodingError) { API.public_send("twice_#{shape}", value) { bad } }
    rejects(TypeError, RangeError, EncodingError) { API.public_send("make_#{shape}", bad) }
    API.public_send("make_#{shape}", value).with do |closure|
      rejects(TypeError, RangeError, EncodingError) { closure.call(false, bad) }
    end
    same(API.public_send("call_#{shape}", value) { |item| item }, value)
  end
end

# Capture and callback copies retain separate mutable nested storage.
record = StructuredValues.payload("record", 1)
expected = StructuredValues.snapshot(record)
API.make_record(record).with do |closure|
  record.rows.clear
  record.text.replace("mutated")
  GC.start
  same(closure.call(true, record), expected)
  returned = closure.call(true, record)
  returned.rows.clear
  returned.text.replace("changed result")
  same(closure.call(true, record), expected)
end
check(!API.const_defined?(:Alias, false))
8.times do
  API.retain_record { |value| value }.with do |escaped|
    rejects(RangeError) { escaped.call(expected) }
    same(API.call_record(expected) { |item| item }, expected)
    rejects(RangeError) { escaped.call(expected) }
  end
end
marker = Marker.new("after failure")
check(rejects(Marker) { API.after_failure(expected) { raise marker } }.equal?(marker))
check(API.after_failure(expected) { |item| item } == expected.text)

# Ordinary callable objects, method objects and blocks all use copied values.
object = Object.new
def object.call(item); item; end
same(API.call_record(expected, object), expected)
same(API.call_record(expected, object.method(:call)), expected)
rejects(ArgumentError) { API.call_record(expected, object) { |item| item } }
rejects(TypeError) { API.call_record(expected, nil) }
rejects(TypeError) { API.call_record(expected) { Fiber.new {} } }
rejects(LocalJumpError) { API.twice_record(expected) { break expected } }
rejects(LocalJumpError) { catch(:escape) { API.twice_record(expected) { throw :escape, expected } } }
fiber = Fiber.new { API.call_record(expected) { |item| Fiber.yield(:paused); item } }
check(fiber.resume == :paused)
rejects(API::LeanBridgeError) { API.call_record(expected) { |item| item } }
same(fiber.resume, expected)
same(API.call_record(expected) { |item| item }, expected)
rejects(RangeError) { API.call_array([API::Some.new("x" * (16 * 1024 * 1024 + 1))]) { |item| item } }
rejects(RangeError) { API.call_array([]) { [API::Some.new("x" * (16 * 1024 * 1024 + 1))] } }

4.times.map do |index|
  Thread.new do
    SHAPES.each do |shape|
      value = StructuredValues.payload(shape, index + 1)
      8.times do
        same(API.public_send("call_#{shape}", value) { |item| item }, value)
        API.public_send("make_#{shape}", value).with { |closure| same(closure.call(true, value), value) }
      end
    end
  end
end.each(&:value)

def abandoned_callback(value)
  callback = ->(item) { item }
  weak = WeakRef.new(callback)
  API.call_record(value, callback)
  weak
end
weak = abandoned_callback(expected)
5.times { GC.start; GC.compact }
check(!weak.weakref_alive?)
API.make_record(expected).with do |closure|
  pid = fork do
    begin
      rejects(API::LeanBridgeError) { closure.call(true, expected) }
      rejects(API::LeanBridgeError) { closure.close }
      rejects(API::LeanBridgeError) { API.call_record(expected) { |item| item } }
      exit! 0
    rescue Exception
      exit! 1
    end
  end
  Process.wait(pid)
  check($?.success?)
end
puts JSON.generate(checks: $checks, calls: $calls, rejected: $rejected, shapes: SHAPES,
                   ruby: RUBY_DESCRIPTION, api: API.method(:call_record).source_location.first)
