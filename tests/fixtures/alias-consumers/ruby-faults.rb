# Separate process: instrument in-memory methods, not installed package files.
require "json"
require "lean_bridge/aliases"
API = LeanBridge::Aliases
Some, Ok, Err = API::Some, API::Ok, API::Err
Native = API.const_get(:Native, false)
API.reverse_rows([])
module Probe
  class << self
    attr_accessor :count, :target, :calls, :clears, :active, :pointers, :scopes
    def tick
      return unless active
      self.count += 1
      raise NoMemoryError, "injected alias conversion failure" if count == target
    end
    def check(value); raise "alias cleanup assertion" unless value; end
    def closed
      check(pointers.all?(&:freed?))
      check(scopes.all? { |scope| scope.instance_variable_get(:@buffers).empty? && scope.instance_variable_get(:@callbacks).empty? })
    end
    def reset
      closed if pointers
      self.count = self.target = self.calls = self.clears = 0
      self.pointers = []; self.scopes = []; self.active = true
    end
  end
  class Buffers < Array
    def <<(pointer); Probe.tick; super; end
  end
end
Fiddle::Pointer.singleton_class.prepend(Module.new do
  def malloc(*)
    pointer = super
    Probe.pointers << pointer if Probe.active
    pointer
  end
end)
Native::Scope.prepend(Module.new do
  def initialize
    super
    if Probe.active
      @buffers = Probe::Buffers.new
      Probe.scopes << self
    end
  end
  def allocate(...)
    value = super
    Probe.tick
    value
  end
end)
conversions = Module.new
names = Native.instance_methods(false).grep(/\A(?:to|from)\d+\z/)
raise "missing conversion probes" unless names.length >= 50
names.each { |name| conversions.define_method(name) { |*args| Probe.tick; super(*args) } }
Native.singleton_class.prepend(conversions)
Native.constants(false).grep(/\A(?:CALL|CLEAR)\d+\z/).each do |name|
  function = Native.const_get(name); original = function.method(:call)
  function.define_singleton_method(:call) do |*args|
    if Probe.active
      name.to_s.start_with?("CLEAR") ? Probe.clears += 1 : Probe.calls += 1
    end
    original.call(*args)
  end
end
def faults
  Probe.reset; yield; count = Probe.count; Probe.closed; Probe.check(count > 0)
  (1..count).each do |target|
    Probe.reset; Probe.target = target; failed = false
    begin
      yield
    rescue NoMemoryError => error
      failed = error.message == "injected alias conversion failure"
    ensure
      Probe.target = 0
    end
    Probe.check(failed); Probe.closed
    Probe.check(Probe.calls <= 1 && Probe.calls == Probe.clears)
    Probe.check(API.reverse_rows([[1, 2]]) == [[2, 1]])
  end
  count
end
huge = 1 << 5120
packet = API::Packet.new(count: 7, text: "copied\0🌱", rows: [[1, 2], []], maybe: Some.new(Some.new(API::UNIT)), outcome: Ok.new([7, "\0\xff".b]))
scalars = API::Scalars.new(v_unit: API::UNIT, v_bool: true, v_uint8: 255, v_uint16: 65535,
  v_uint32: (1 << 32) - 1, v_uint64: (1 << 64) - 1, v_int8: -128, v_int16: -32768,
  v_int32: -(1 << 31), v_int64: -(1 << 63), v_nat: huge + 19, v_int: -(huge + 31),
  v_float32: 1.5, v_float64: -2.25, v_string: "A\0🌱", v_bytes: "\0\xff\1".b,
  v_char: "🌱", v_usize: (1 << 32) - 1, v_isize: -(1 << 31))
count = faults { API.change_packet(packet) } + faults { API.reverse_packets([packet, packet]) } +
  faults { API.echo_scalars(scalars) } + faults { API.echo_maybe(Some.new(Some.new(API::UNIT))) } +
  faults { API.echo_outcome(Err.new("copied\0🌱")) } + faults { API.duplicate("\0\xff".b) } +
  faults { API.echo_nat(huge) } + faults { API.echo_int(-huge) }
bad = API::Packet.new(count: 7, text: "copied first", rows: nil, maybe: nil, outcome: Err.new("unused"))
partial = [-> { API.change_packet(bad) }, -> { API.reverse_packets([packet, bad]) },
  -> { API.reverse_rows([[1, 2], [nil]]) }, -> { API.echo_outcome(Ok.new([7, nil])) }]
partial.each do |call|
  16.times do
    Probe.reset; failed = false
    begin; call.call; rescue TypeError; failed = true; end
    Probe.check(failed && Probe.calls.zero?); Probe.closed
  end
end
Probe.active = false
indices = JSON.parse(ARGV.fetch(0))
option, result, list, array, string, char = indices.map { |index| Native.method("from#{index}") }
layouts = 0
raw = Fiddle::Pointer.malloc(80, Fiddle::RUBY_FREE)
inner = Fiddle::Pointer.malloc(32, Fiddle::RUBY_FREE)
bad_utf8 = Fiddle::Pointer.malloc(1, Fiddle::RUBY_FREE); bad_utf8[0, 1] = "\xff".b
reject = ->(kind, &call) do
  failed = false
  begin; call.call; rescue kind; failed = true; end
  Probe.check(failed); layouts += 1
end
begin
  [option, result].each do |convert|
    [2, 127, 255].each do |flag|
      raw[0, 80] = "\0" * 80; raw[0, 1] = [flag].pack("C")
      reject.call(RangeError) { convert.call(raw) }
    end
  end
  raw[0, 80] = "\xff" * 80; raw[0, 1] = "\0"; Probe.check(option.call(raw).nil?); layouts += 1
  raw[0, 2] = [1, 2].pack("CC"); reject.call(RangeError) { option.call(raw) }
  poison = ->(offset) { raw[offset, 16] = [1, (1 << 64) - 1].pack("Q<Q<") }
  raw[0, 80] = "\0" * 80; raw[0, 1] = [1].pack("C"); poison.call(48)
  Probe.check(result.call(raw) == Ok.new([0, "".b])); layouts += 1
  raw[0, 80] = "\0" * 80; poison.call(16)
  Probe.check(result.call(raw) == Err.new("")); layouts += 1
  [list, array].each do |convert|
    [[0, 1], [1, 1], [1, (1 << 64) - 1]].each do |address, length|
      raw[0, 80] = "\0" * 80; raw[0, 16] = [address, length].pack("Q<Q<")
      reject.call(RangeError) { convert.call(raw) }
    end
    raw[0, 16] = [1, 0].pack("Q<Q<"); Probe.check(convert.call(raw) == []); layouts += 1
  end
  inner[0, 32] = "\0" * 32; inner[0, 16] = [0, 1].pack("Q<Q<")
  raw[0, 80] = "\0" * 80; raw[0, 16] = [inner.to_i, 1].pack("Q<Q<")
  reject.call(RangeError) { array.call(raw) }
  raw[0, 80] = "\0" * 80; raw[0, 16] = [bad_utf8.to_i, 1].pack("Q<Q<")
  reject.call(EncodingError) { string.call(raw) }
  [0xd800, 0x110000].each { |value| reject.call(RangeError) { char.call(value) } }
ensure
  raw.call_free; inner.call_free; bad_utf8.call_free
end
puts JSON.generate(checks: count, partial_inputs: 64, layouts: layouts, conversion_probes: names.length)
