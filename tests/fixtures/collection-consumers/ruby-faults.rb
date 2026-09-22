# A separate process instruments the installed API in memory, never its files.
require "json"
require "lean_bridge/collections"

module CollectionFaults
  extend self
  API = LeanBridge::Collections
  Native = API.const_get(:Native, false)
  API.array_reverse_uint32([[1, 2]])
  module Probe
    class << self
      attr_accessor :count, :target, :calls, :clears, :active, :pointers, :scopes
      def check(value); raise "collection cleanup assertion" unless value; end
      def tick
        return unless active
        self.count += 1
        raise NoMemoryError, "injected collection conversion failure" if count == target
      end
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
  names = Native.instance_methods(false).grep(/\A(?:to|from)\d+\z/)
  raise "missing collection converters" unless names.length >= 80
  conversions = Module.new
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
  constructors = [API::Primitives, API::Empty, API::Single, API::Count, API::Pair, API::Reversed, API::Packet]
  constructors.each do |type|
    type.singleton_class.prepend(Module.new do
      def new(...)
        value = super
        Probe.tick
        value
      end
    end)
  end
  def faults
    Probe.reset; yield; count = Probe.count; Probe.closed; Probe.check(count > 0)
    (1..count).each do |target|
      Probe.reset; Probe.target = target; failed = false
      begin
        yield
      rescue NoMemoryError => error
        failed = error.message == "injected collection conversion failure"
      ensure
        Probe.target = 0
      end
      Probe.check(failed); Probe.closed
      Probe.check(Probe.calls <= 1 && Probe.calls == Probe.clears)
      Probe.check(API.array_reverse_uint32([[1, 2]]) == [[2, 1]])
      Probe.closed
    end
    Probe.active = false
    count
  end
  fields = {unit: API::UNIT, flag: true, u8: 255, u16: 65535, u32: (1 << 32) - 1, u64: (1 << 64) - 1,
    i8: -128, i16: -32768, i32: -(1 << 31), i64: -(1 << 63), natural: (1 << 5120) + 19,
    integer: -((1 << 5120) + 31), f32: -0.0, f64: 3.25, text: "A\0🌱", bytes: "\0\xff\1".b,
    char_: "🌱", usize: (1 << 64) - 1, isize: -(1 << 63)}
  record = API::Primitives.new(**fields)
  packet = API::Packet.new(label: "parcel", values: [[record, record], [], [record]], empty: API::Empty.new,
    single: API::Single.new(value: 42), count: API::Count.new(value: 1 << 5120),
    pair: API::Pair.new(first: 7, second: "left"), reversed: API::Reversed.new(second: "right", first: 9))
  nested = 42; 24.times { nested = [nested] }
  count = faults { API.record_duplicate(packet) } + faults { API.record_shuffle(packet) } +
    faults { API.array_reverse_int([[1 << 5120, -(1 << 5120)], []]) } +
    faults { API.array_duplicate(["A\0".b, "\xff".b]) } + faults { API.deep(nested) } + faults { API.generate(7) }
  bad_text = "\xed\xa0\x80".force_encoding(Encoding::UTF_8)
  partial = [[RangeError, -> { API.record_reverse([record, API::Primitives.new(**fields.merge(natural: -1))]) }],
    [TypeError, -> { API.array_reverse_uint32([[1], [2, nil]]) }],
    [EncodingError, -> { API.array_reverse_string([["valid"], ["valid", bad_text]]) }],
    [TypeError, -> { API.record_reverse([record, nil]) }]]
  partial.each do |kind, action|
    16.times do
      Probe.reset; failed = false
      begin; action.call; rescue kind; failed = true; end
      Probe.check(failed && Probe.calls.zero?); Probe.closed
    end
  end
  Probe.active = false
  layouts = JSON.parse(ARGV.fetch(0))
  sequence = layouts.fetch("sequence")
  pointer = Fiddle::Pointer.malloc(32, Fiddle::RUBY_FREE)
  backing = Fiddle::Pointer.malloc(16, Fiddle::RUBY_FREE)
  malformed = 0
  begin
    convert = Native.method("from#{sequence.fetch("index")}")
    pointer[0, 32] = "\0" * 32
    Probe.check(convert.call(pointer) == [])
    [[0, 1], [backing.to_i + 1, 1], [backing.to_i, (16 * 1024 * 1024) / sequence.fetch("charge") + 1], [backing.to_i, (1 << 64) - 1]].each do |address, length|
      pointer[0, 16] = [address, length].pack("Q<Q<")
      failed = false
      begin; convert.call(pointer); rescue RangeError; failed = true; end
      Probe.check(failed); malformed += 1
    end
    char = Native.method("from#{layouts.fetch("char_index")}")
    [0xd800, 0xdfff, 0x110000, 0xffffffff].each do |value|
      failed = false
      begin; char.call(value); rescue RangeError; failed = true; end
      Probe.check(failed); malformed += 1
    end
  ensure
    pointer.call_free; backing.call_free
  end
  puts JSON.generate(checks: count, partial_inputs: 64, malformed_values: malformed,
    conversion_methods: names.length, constructor_probes: constructors.length)
end
