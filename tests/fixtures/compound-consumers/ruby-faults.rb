# Separate process: probe in-memory methods, never change installed package files.
require "json"
require "lean_bridge/compounds"
API = LeanBridge::Compounds
Some, Ok, Err = API::Some, API::Ok, API::Err
Native = API.const_get(:Native, false)
API.classify(nil)
module Probe
  class << self
    attr_accessor :count, :target, :calls, :clears, :active, :pointers, :scopes
    def tick
      return unless active
      self.count += 1
      raise NoMemoryError, "injected conversion failure" if count == target
    end
    def check(value); raise "compound cleanup assertion" unless value; end
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
    Probe.check(API.classify(Some.new(Some.new(API::UNIT))) == 2)
  end
  count
end
huge = 1 << 4096
packet = API::Packet.new(choice: Some.new(Ok.new([huge, API::UNIT])), products: [[42, "copied\0λ"], [true, "🌿"]],
  rows: [Some.new(Err.new(["\0\xff".b, -huge])), Some.new(Ok.new(["row", 1]))], nested: Ok.new(Some.new(Err.new("nested"))))
count = faults { API.transform(packet) } + faults { API.duplicate(Some.new("\0\xff".b)) } + faults { API.option_nat(Some.new(huge)) } +
  faults { API.result_string(Ok.new("success")) } + faults { API.result_string(Err.new("error")) } + faults { API.tuple_string(["left", "right"]) }
16.times do
  Probe.reset; failed = false
  begin
    API.transform(API::Packet.new(choice: packet.choice, products: packet.products, rows: nil, nested: packet.nested))
  rescue TypeError
    failed = true
  end
  Probe.check(failed && Probe.calls.zero?); Probe.closed
end
Probe.active = false
option, result = JSON.parse(ARGV.fetch(0)).map { |index| Native.method("from#{index}") }
flag_checks = 0
raw = Fiddle::Pointer.malloc(72, Fiddle::RUBY_FREE)
begin
  [option, result].each do |convert|
    [2, 127, 255].each do |flag|
      raw[0, 72] = "\0" * 72; raw[0, 1] = [flag].pack("C"); failed = false
      begin; convert.call(raw); rescue RangeError; failed = true; end
      Probe.check(failed); flag_checks += 1
    end
  end
  poison = ->(offset) { raw[offset, 16] = [1, (1 << 64) - 1].pack("Q<Q<") }
  raw[0, 72] = "\0" * 72; poison.call(8); Probe.check(option.call(raw).nil?); flag_checks += 1
  raw[0, 72] = "\0" * 72; raw[0, 1] = [1].pack("C"); poison.call(40); Probe.check(result.call(raw) == Ok.new("")); flag_checks += 1
  raw[0, 72] = "\0" * 72; poison.call(8); Probe.check(result.call(raw) == Err.new("")); flag_checks += 1
ensure
  raw.call_free
end
puts JSON.generate(checks: count, partial_inputs: 16, flags: flag_checks, conversion_probes: names.length)
