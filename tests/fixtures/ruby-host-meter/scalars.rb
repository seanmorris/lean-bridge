require_relative "consumer"

class Box
  attr_accessor :echo_hook
  def child = Box.new(level + 1)
  def from_parent(parent) = parent.child
  def finish = read
end
def retain_anchor(api, receiver, scope)
  parent = Box.new(11)
  scope == :receiver ? api.retain_child(parent) : api.retain_from(receiver, parent)
  WeakRef.new(parent)
end
samples = {
  unit: [A::UNIT], bool: [true, false], string: ["", "embedded\0🦊", "ascii".encode("US-ASCII")],
  char: ["λ", "🦊", "\0"], bytes: ["".b, "\0\xff".b],
  nat: [0, 2**200 + 1], int: [0, -2**200 - 1, 2**200 + 1],
  float32: [1.0 / 3, Float::INFINITY, -0.0, Float::NAN], float64: [1.0 / 3, -Float::INFINITY, -0.0, Float::NAN]
}
bounds = {}
[8, 16, 32, 64].each do |bits|
  bounds[:"uint#{bits}"] = [0, 2**bits - 1]
  bounds[:"int#{bits}"] = [-2**(bits-1), 2**(bits-1)-1]
end
bounds[:usize] = bounds[:uint64]
bounds[:isize] = bounds[:int64]
samples.merge!(bounds)
samples.each_key do |tag|
  Box.define_method("echo_#{tag}") { |v| echo_hook ? echo_hook.call(v) : v }
end
check(A::UNIT.frozen? && A::UNIT.equal?(B::UNIT), "incompatible Unit sentinels")
box = Box.new(0)
A.bind_hosts(box: Box) do
  B.bind_hosts(box: Box) do
    samples.each_pair do |tag, values|
      values.each do |v|
        # Observe the actual Ruby member argument independently of the returned value.
        observed = :absent
        box.echo_hook = ->(x) { observed = x; x }
        result = B.public_send("test_#{tag}", box, A.public_send("test_#{tag}", box, v))
        expected = tag == :float32 ? [v].pack("g").unpack1("g") : v
        same = ->(x) { expected.is_a?(Float) ? [x].pack("G") == [expected].pack("G") || (expected.nan? && x.nan?) : expected == x }
        check(same.call(observed) && same.call(result), "roundtrip #{tag}: #{v.inspect}")
        check(result.encoding == Encoding::BINARY, "not binary") if tag == :bytes
      end
    end
    box.echo_hook = nil
    bounds.each_pair do |tag, (low, high)|
      refused(RangeError) { A.public_send("test_#{tag}", box, low - 1) }
      refused(RangeError) { A.public_send("test_#{tag}", box, high + 1) }
    end
    refused(TypeError) { A.test_unit(box, nil) }
    refused(TypeError) { A.test_bool(box, 1) }
    refused(TypeError) { A.test_float64(box, 1) }
    refused(RangeError) { A.test_nat(box, -1) }
    refused(RangeError) { A.test_char(box, "e\u0301") }
    refused(EncodingError) { A.test_string(box, "\xff".b.force_encoding("UTF-8")) }
    refused(EncodingError) { A.test_bytes(box, "text") }
    box.echo_hook = ->(_) { 256 }
    refused(RangeError) { A.test_uint8(box, 1) }
    box.on_read = -> { raise StandardError, "boom\0λ" }
    check(A.verdict(false) == A::Err.new("ordinary refusal") && A.verdict(true) == A::Ok.new(42), "pure Except turned into a failure")
    check(refused(A::DeclaredError) { A.layered(box, true) }.payload == "declared refusal", "wrong outer EIO payload")
    check(A.caught(box).include?("boom\0λ"), "Lean lost host error text")
    e = refused(A::IOError) { A.replaced(box) }
    check(e.message.include?("replacement") && e.declaration == "Workshop.replaced", "lost replacement error")
    box.on_read = -> { A.send(:__unbind) }
    refused(RuntimeError) { A.read(box) }
    box.on_read = -> { throw :escape }
    check(catch(:escape) { refused(A::IOError) { A.read(box) }; :returned } == :returned, "nonlocal jump crossed Lean")
    box.on_read = nil
    check(A.layered(box, true) == A::Ok.new(A::Ok.new(0)) && A.layered(box, false) == A::Ok.new(A::Err.new("inner refusal")), "lost the inner returned value")
    [:receiver, :parameter].each do |scope|
      weak = retain_anchor(A, box, scope)
      GC.start; GC.compact
      check(weak.weakref_alive? && B.read(A.held) == 12, "lost #{scope} anchor")
      A.forget
      check(A.send(:__live).zero?, "borrowed child not released")
    end
    check(A.consume(box).zero? && A.send(:__live).zero?, "transfer retained a native reference")
    box.on_read = -> { raise RangeError, "finish failed" }
    refused(RangeError) { A.consume(box) }
    check(A.send(:__live).zero?, "failed transfer retained a native reference")
    box.on_read = nil
    check(B.read(box) == 0, "failed to recover")
  end
end
check(A.send(:__live).zero?, "scalar fault leaked an object")
puts "19 primitive types; live=0"
