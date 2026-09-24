# In-memory installed-adapter probes. The installed gem is never modified.
require "json"
require_relative "ruby-values"
API = StructuredValues::API
Native = API.const_get(:Native, false)
API.call_option(nil) { |value| value }
LAYOUTS = JSON.parse(ARGV.fetch(0))
SNAPSHOT = Fiddle::Function.new(Native::LIBRARY["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)

def live
  Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) do |memory|
    SNAPSHOT.call(memory)
    memory[20, 4].unpack1("L<")
  end
end

module Probe
  class Marker < Exception; end
  class << self
    attr_accessor :active, :target, :count, :marker, :buffers, :callbacks, :scopes, :deferred
    attr_accessor :checks, :faults, :clears, :closes
    def check(condition)
      self.checks += 1
      raise "structured Ruby fault check #{checks} failed" unless condition
    end
    def tick
      return unless active
      self.count += 1
      raise marker if count == target
    end
    def closed
      check(buffers.all?(&:freed?))
      check(callbacks.all?(&:freed?))
      check(scopes.all? { |scope| scope.instance_variable_get(:@buffers).empty? && scope.instance_variable_get(:@callbacks).empty? })
    end
  end
  self.active = false
  self.checks = self.faults = self.clears = self.closes = 0
end

Native::Scope.prepend(Module.new do
  def initialize
    super
    Probe.scopes << self if Probe.active
  end
  def allocate(...)
    Probe.tick
    value = super
    Probe.buffers << value if Probe.active
    Probe.tick
    value
  end
  def retain_callback(function)
    super
    Probe.callbacks << function if Probe.active
    Probe.tick
  end
  def close
    super
    Probe.closes += 1 if Probe.active
  end
end)
conversions = Native.methods.grep(/\A(?:to|from|own)\d+\z/) + [:owned_output]
raise "missing structured conversion probes" unless conversions.length >= 65
Native.singleton_class.prepend(Module.new do
  conversions.each do |name|
    define_method(name) do |*args|
      if name.to_s == "to#{LAYOUTS.fetch('bool')}" && Probe.deferred
        action = Probe.deferred
        Probe.deferred = nil
        action.call
      end
      Probe.tick
      result = super(*args)
      Probe.tick
      result
    end
  end
end)
Native.constants(false).grep(/\A(?:CLEAR|DISPOSE)\d+\z/).each do |name|
  function = Native.const_get(name)
  original = function.method(:call)
  size = name.to_s.start_with?("DISPOSE") ? 8 : LAYOUTS.fetch("sizes").fetch(name.to_s.delete_prefix("CLEAR"))
  function.define_singleton_method(:call) do |pointer|
    result = original.call(pointer)
    if Probe.active
      Probe.clears += 1
      Probe.check(pointer[0, size] == "\0" * size)
    end
    result
  end
end

def exercise(function, expected, target = 0, kind = NoMemoryError)
  baseline = live
  Probe.buffers, Probe.callbacks, Probe.scopes = [], [], []
  Probe.count, Probe.target = 0, target
  Probe.marker = kind.new("structured checkpoint failure")
  Probe.active = true
  failed = false
  begin
    Probe.check(function.call == expected)
  rescue kind => error
    Probe.check(error.equal?(Probe.marker))
    failed = true
    Probe.faults += 1
  ensure
    Probe.active = false
  end
  Probe.check(failed == (target != 0))
  Probe.closed
  GC.start
  Probe.check(live == baseline)
  Probe.count
end

baseline = live
reports = StructuredValues::SHAPES.map do |shape|
  value = StructuredValues.payload(shape, shape == "option" ? 2 : 1)
  other = StructuredValues.payload(shape, shape == "variant" ? 6 : 2)
  expected = StructuredValues.snapshot(other)
  call, twice, make = %w[call twice make].map { |action| API.method("#{action}_#{shape}") }
  path_counts = {}
  faults_before = Probe.faults
  make.call(other).with do |held|
    paths = {
      "callback" => -> { call.call(value) { other } },
      "repeated" => -> { twice.call(value) { other } },
      "create" => -> { make.call(other).with { expected } },
      "create-call" => -> { make.call(other).with { |closure| closure.call(true, value) } },
      "held-call" => -> { held.call(true, value) }
    }
    paths.each do |name, function|
      count = exercise(function, expected)
      Probe.check(count > 0)
      path_counts[name] = count
      [NoMemoryError, Probe::Marker].each do |kind|
        (1..count).each do |limit|
          exercise(function, expected, limit, kind)
          Probe.check(call.call(value) { other } == expected)
        end
      end
      Probe.check(exercise(function, expected) == count)
    end
  end
  Probe.check(live == baseline)
  closure = make.call(value)
  Probe.deferred = -> { closure.close; Probe.check(closure.closed? && live == baseline + 1) }
  Probe.check(closure.call(true, other) == value)
  Probe.check(closure.closed? && live == baseline && Probe.deferred.nil?)
  { shape: shape, paths: path_counts, faults: Probe.faults - faults_before }
end

# Reject invalid tags and impossible sequence spans before any payload read.
malformed = 0
LAYOUTS.fetch("invalid").each do |layout|
  Fiddle::Pointer.malloc(layout.fetch("size"), Fiddle::RUBY_FREE) do |raw|
    convert = Native.method("from#{layout.fetch('index')}")
    patterns = case layout.fetch("kind")
               when "variant" then [[0, [(1 << 32) - 1].pack("L<")]]
               when "option", "result" then [[0, [2].pack("C")]]
               when "sequence" then [[0, [0, 1].pack("Q<Q<")], [0, [1, (1 << 64) - 1].pack("Q<Q<")]]
               else raise layout.inspect
               end
    patterns.each do |offset, bytes|
      raw[0, layout.fetch("size")] = "\0" * layout.fetch("size")
      raw[offset, bytes.bytesize] = bytes
      failed = false
      begin
        convert.call(raw)
      rescue RangeError
        failed = true
      end
      Probe.check(failed)
      malformed += 1
    end
  end
end
Probe.check(malformed >= 10)
Probe.check(live == baseline)
Probe.check(Probe.faults == reports.sum { |report| report.fetch(:faults) })
puts JSON.generate(checks: Probe.checks, faults: Probe.faults, clears: Probe.clears,
                   closes: Probe.closes, malformed: malformed, shapes: reports,
                   conversion_methods: conversions.length)
