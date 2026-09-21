# Separate process: probe in-memory methods, never change installed package files.
require "json"
require "lean_bridge/lists"
API = LeanBridge::Lists
Some, Ok, Err = API::Some, API::Ok, API::Err
Native = API.const_get(:Native, false)
API.reverse_uint32([])
module Probe
  class << self
    attr_accessor :count, :target, :calls, :clears, :active, :pointers, :scopes
    def tick
      return unless active
      self.count += 1
      raise NoMemoryError, "injected conversion failure" if count == target
    end
    def check(value); raise "list cleanup assertion" unless value; end
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
allocation = Module.new do
  def malloc(*)
    pointer = super
    Probe.pointers << pointer if Probe.active
    pointer
  end
end
Fiddle::Pointer.singleton_class.prepend(allocation)
scope_probe = Module.new do
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
end
Native::Scope.prepend(scope_probe)
conversions = Module.new
names = Native.instance_methods(false).grep(/\A(?:to|from)\d+\z/)
raise "missing conversion probes" unless names.length >= 100
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
      failed = error.message == "injected conversion failure"
    ensure
      Probe.target = 0
    end
    Probe.check(failed); Probe.closed
    Probe.check(Probe.calls <= 1 && Probe.calls == Probe.clears)
    Probe.check(API.reverse_uint32([1, 2]) == [2, 1])
  end
  count
end
huge = 1 << 4096
packet = API::Packet.new(sequences: [[1, 2], [3]], branches: [Some.new(Ok.new([huge, API::UNIT])), Some.new(Err.new("branch"))], buffers: ["\0\xff".b], arrays: [[[true, "🌿"]]])
deep = 42; 24.times { deep = [deep] }
count = faults { API.transform(packet) } + faults { API.duplicate("\0\xff".b) } + faults { API.reverse_nat([huge, 42]) } +
  faults { API.nest(Some.new([Ok.new([API::UNIT]), Err.new("error")])) } + faults { API.swap(Ok.new([[huge], [1, 2]])) } +
  faults { API.swap(Err.new(["copied", "error"])) } + faults { API.deep(deep) }
16.times do
  Probe.reset; failed = false
  begin; API.reverse_string(["copied first", nil]); rescue TypeError; failed = true; end
  Probe.check(failed && Probe.calls.zero?); Probe.closed
end
Probe.active = false
list, array = JSON.parse(ARGV.fetch(0)).map { |index| Native.method("from#{index}") }
layout_checks = 0
raw = Fiddle::Pointer.malloc(32, Fiddle::RUBY_FREE)
inner = Fiddle::Pointer.malloc(32, Fiddle::RUBY_FREE)
begin
  [list, array].each do |convert|
    [[0, 1], [1, 1], [1, (1 << 64) - 1]].each do |address, length|
      raw[0, 32] = "\0" * 32; raw[0, 16] = [address, length].pack("Q<Q<"); failed = false
      begin; convert.call(raw); rescue RangeError; failed = true; end
      Probe.check(failed); layout_checks += 1
    end
    raw[0, 16] = [1, 0].pack("Q<Q<"); Probe.check(convert.call(raw) == []); layout_checks += 1
  end
  inner[0, 32] = "\0" * 32; inner[0, 16] = [0, 1].pack("Q<Q<")
  raw[0, 32] = "\0" * 32; raw[0, 16] = [inner.to_i, 1].pack("Q<Q<"); failed = false
  begin; array.call(raw); rescue RangeError; failed = true; end
  Probe.check(failed); layout_checks += 1
ensure
  raw.call_free; inner.call_free
end
puts JSON.generate(checks: count, partial_inputs: 16, layouts: layout_checks, conversion_probes: names.length)
