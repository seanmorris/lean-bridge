require 'json'
require_relative 'ruby-values'
API = StructuredValues::API
Native = API.const_get(:Native, false)
API.call_option(nil) { |value| value }
SNAPSHOT = Fiddle::Function.new(Native::LIBRARY['lean_bridge_native_snapshot_read'], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
def live
  Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) do |memory|
    SNAPSHOT.call(memory)
    memory[20, 4].unpack1('L<')
  end
end

module Probe
  class Marker < Exception; end
  class << self
    attr_accessor :active, :target, :count, :marker, :buffers, :callbacks, :scopes, :frames, :deferred
    attr_accessor :checks, :faults, :clears, :closes
    def check(condition)
      self.checks += 1
      raise "recursive Ruby fault check #{checks} failed" unless condition
    end
    def tick
      return unless active
      self.count += 1
      raise marker if count == target
    end
    def closed
      check(buffers.all?(&:freed?))
      check(callbacks.all?(&:freed?))
      check(scopes.all? { |scope| scope.instance_variable_get(:@buffers).empty? && scope.instance_variable_get(:@active).empty? })
      check(frames.all? { |frame| !frame.alive && frame.instance_variable_get(:@callbacks).empty? })
    end
  end
  self.active = false
  self.checks = self.faults = self.clears = self.closes = 0
end
Native::GraphScope.prepend(Module.new do
  def initialize(...)
    super
    Probe.scopes << self if Probe.active
  end
  def allocate(...)
    value = super
    Probe.buffers << value if Probe.active && value
    value
  end
  def close
    super
    Probe.closes += 1 if Probe.active
  end
end)
Native::GraphCallableFrame.prepend(Module.new do
  def initialize
    super
    Probe.frames << self if Probe.active
  end
  def retain(function)
    super
    Probe.callbacks << function if Probe.active
    Probe.tick
  end
end)
conversions = Native.methods.grep(/\Agraph_(?:input|output)\d+\z/) + [:graph_own, :graph_owned_output]
raise 'missing recursive conversion probes' unless conversions.length >= 50
Native.singleton_class.prepend(Module.new do
  def graph_checkpoint
    Probe.tick
    super
  end
  conversions.each do |name|
    define_method(name) do |*args|
      if Probe.deferred && (args[0].equal?(true) || args[0].equal?(false)) && name.to_s.start_with?('graph_input')
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
clear = Native::CLEAR.method(:call)
Native::CLEAR.define_singleton_method(:call) do |pointer|
  result = clear.call(pointer)
  if Probe.active
    Probe.clears += 1
    Probe.check(pointer[0, 16] == "\0" * 16)
  end
  result
end

def exercise(function, expected, target = 0, kind = NoMemoryError)
  baseline = live
  Probe.buffers, Probe.callbacks, Probe.scopes, Probe.frames = [], [], [], []
  Probe.count, Probe.target = 0, target
  Probe.marker = kind.new('recursive checkpoint failure')
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
reports = (StructuredValues::SHAPES + ['recursive']).map do |shape|
  value = shape == 'recursive' ? API::Tree::Branch.new(children: [API::Tree::Leaf.new(value: 1 << 200), API::Tree::Branch.new(children: [])]) : StructuredValues.payload(shape, shape == 'option' ? 2 : 1)
  other = shape == 'recursive' ? API::Tree::Branch.new(children: [API::Tree::Leaf.new(value: 2), API::Tree::Branch.new(children: [API::Tree::Leaf.new(value: 1 << 300)])]) : StructuredValues.payload(shape, shape == 'variant' ? 6 : 2)
  call, twice, make = %w[call twice make].map { |action| API.method("#{action}_#{shape}") }
  path_counts = {}
  faults_before = Probe.faults
  make.call(other).with do |held|
    paths = {
      'callback' => -> { call.call(value) { other } },
      'repeated' => -> { twice.call(value) { other } },
      'create' => -> { make.call(other).with { other } },
      'create-call' => -> { make.call(other).with { |closure| closure.call(true, value) } },
      'held-call' => -> { held.call(true, value) }
    }
    paths.each do |name, function|
      count = exercise(function, other)
      Probe.check(count > 0)
      path_counts[name] = count
      [NoMemoryError, Probe::Marker].each do |kind|
        (1..count).each do |limit|
          exercise(function, other, limit, kind)
          Probe.check(call.call(value) { other } == other)
        end
      end
      Probe.check(exercise(function, other) == count)
    end
  end
  Probe.check(live == baseline)
  closure = make.call(value)
  Probe.deferred = -> { closure.close; Probe.check(closure.closed? && live == baseline + 1) }
  Probe.check(closure.call(true, other) == value)
  Probe.check(closure.closed? && live == baseline && Probe.deferred.nil?)
  { shape: shape, paths: path_counts, faults: Probe.faults - faults_before }
end
Probe.check(Probe.faults == reports.sum { |report| report.fetch(:faults) })
puts JSON.generate(checks: Probe.checks, faults: Probe.faults, clears: Probe.clears,
                   closes: Probe.closes, shapes: reports, identities: live,
                   conversion_methods: conversions.length)
