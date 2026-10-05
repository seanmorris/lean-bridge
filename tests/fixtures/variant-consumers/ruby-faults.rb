# Separate process: inject failures in memory; leave installed gem files intact.
require "json"
require "lean_bridge/variants"
module VariantFaults
  extend self
  API = LeanBridge::Variants
  Signal, Mode, Nested, Scalars = API::Signal, API::Mode, API::Nested, API::Scalars
  Anonymous, One, Buffers = API::Anonymous, API::One, API::Buffers
  Some, Ok, Err = API::Some, API::Ok, API::Err
  Native = API.const_get(:Native, false)
  API.echo(Signal::Idle.new)
  module Probe
    class << self
      attr_accessor :count, :target, :calls, :clears, :active, :pointers, :scopes
      def tick
        return unless active
        self.count += 1
        raise NoMemoryError, "injected variant conversion failure" if count == target
      end
      def check(value); raise "variant cleanup assertion" unless value; end
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
  raise "missing conversion probes" unless names.length >= 60
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
  constructors = [Signal::Idle, Signal::Stopped, Signal::Data, Signal::Marker,
    Mode::First, Mode::Second, Mode::Third, Nested::Empty, Nested::Packet, Nested::Outcome,
    Scalars::Absent, Scalars::All, Anonymous::Number, Anonymous::Pair, Anonymous::Collision,
    One::Only, Buffers::Empty, Buffers::Pair, API::Packet, Some, Ok, Err]
  constructors.each do |constructor|
    constructor.singleton_class.prepend(Module.new do
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
        failed = error.message == "injected variant conversion failure"
      ensure
        Probe.target = 0
      end
      Probe.check(failed); Probe.closed
      Probe.check(Probe.calls <= 1 && Probe.calls == Probe.clears)
      result = API.next(Signal::Data.new(count: 2, label: "recovered"))
      Probe.check(result.count == 3 && result.label == "recovered!")
      Probe.closed
    end
    count
  end
  data = Signal::Data.new(count: 42, label: "A\0🌱")
  packet = API::Packet.new(current: data, events: [Signal::Idle.new, data, Signal::Marker.new(value: API::UNIT)],
    fallback: Some.new(data), modes: [Mode::First.new, Mode::Third.new])
  scalars = Scalars::All.new(unit: API::UNIT, bool_: true, u8: 255, u16: 65535,
    u32: (1 << 32) - 1, u64: (1 << 64) - 1, i8: -128, i16: -32768, i32: -(1 << 31), i64: -(1 << 63),
    natural: (1 << 5120) + 19, integer: -((1 << 5120) + 31), f32: 1.5, f64: -2.25,
    text: "A\0🌱", bytes: "\0\xff\1".b, char_: "🌱", word: (1 << 32) - 1, signed_word: -(1 << 31))
  values = [Nested::Packet.new(value: packet), Nested::Outcome.new(value: Ok.new([data, Mode::Second.new])),
    Nested::Outcome.new(value: Err.new("A\0🌱")), [[data, Signal::Idle.new], []], scalars,
    Anonymous::Collision.new(arg1: 7, arg1_: "copied"), Buffers::Pair.new(first: "\0\xff".b, second: "A".b)]
  count = faults { API.echo_nested(values[0]) } + faults { API.echo_nested(values[1]) } +
    faults { API.echo_nested(values[2]) } + faults { API.signals(values[3]) } +
    faults { API.echo_scalars(values[4]) } + faults { API.echo_anonymous(values[5]) } +
    faults { API.echo_buffers(values[6]) } + faults { API.duplicate("\0\xff".b) } + faults { API.produce(7) }
  Probe.active = false
  bad_packet = API::Packet.new(current: data, events: [data, nil], fallback: nil, modes: [])
  bad_scalars = Scalars::All.new(**scalars.deconstruct_keys(nil).merge(natural: -1))
  bad_marker = Signal::Marker.new(value: nil)
  bad_text = Signal::Data.new(count: 1, label: "\xff".force_encoding("UTF-8"))
  partial = [[RangeError, -> { API.echo_scalars(bad_scalars) }], [TypeError, -> { API.echo_nested(Nested::Packet.new(value: bad_packet)) }],
    [TypeError, -> { API.echo(bad_marker) }], [EncodingError, -> { API.echo(bad_text) }]]
  partial.each do |kind, call|
    16.times do
      Probe.reset; failed = false
      begin; call.call; rescue kind; failed = true; end
      Probe.check(failed && Probe.calls.zero?); Probe.closed
    end
  end
  Probe.active = false
  layouts = JSON.parse(ARGV.fetch(0))
  raise "missing variant layouts" unless layouts.length == 7
  expected = {"Signal" => Signal::Idle, "Mode" => Mode::First, "Nested" => Nested::Empty,
    "Scalars" => Scalars::Absent, "Anonymous" => Anonymous::Number, "One" => One::Only, "Buffers" => Buffers::Empty}
  malformed = inactive = 0
  layouts.each do |layout|
    raw = Fiddle::Pointer.malloc(layout.fetch("size"), Fiddle::RUBY_FREE)
    convert = Native.method("from#{layout.fetch("index")}")
    begin
      raw[0, layout.fetch("size")] = "\xff".b * layout.fetch("size")
      failed = false
      begin; convert.call(raw); rescue RangeError; failed = true; end
      Probe.check(failed); malformed += 1
      next if layout.fetch("name") == "One"
      raw[0, 4] = [0].pack("L<")
      raw[layout.fetch("payloadOffset"), 4] = [23].pack("L<") if layout.fetch("name") == "Anonymous"
      value = convert.call(raw)
      Probe.check(value.instance_of?(expected.fetch(layout.fetch("name"))))
      Probe.check(value.arg0 == 23) if layout.fetch("name") == "Anonymous"
      inactive += 1
    ensure
      raw.call_free
    end
  end
  puts JSON.generate(checks: count, partial_inputs: 64, malformed_tags: malformed, inactive_cases: inactive,
    layouts: malformed + inactive, conversion_methods: names.length, constructor_probes: constructors.length)
end
