# frozen_string_literal: true
require "lean_bridge/workshop"
require "weakref"

Station = LeanBridge::Workshop
class Sensor
  attr_accessor :level, :failure
  attr_reader :reads
  def initialize(n) = (@level, @reads = n, 0)
  def read
    @reads += 1
    raise failure if failure
    level
  end
end

def check(value) = (raise "assertion failed" unless value)
def refused(kind)
  begin
    yield
  rescue kind => e
    return e
  end
  raise "expected #{kind}"
end
def temporary
  held = Sensor.new(42)
  record, weak = Station.mirror(held), WeakRef.new(held)
  held = nil
  [record, weak]
end

a, b = Sensor.new(11), Sensor.new(7)
survivor = nil
Station.bind_hosts(box: Sensor) do
  panel = Station::Panel.new(a, 3, b)
  survivor = Station.switch_meters(panel)
  GC.compact
  check(survivor.active_meter.equal?(b) && survivor.spare_meter.equal?(a) && survivor.threshold == 14)
  check(Station.current(panel).equal?(a) && a.reads == 1 && b.reads.zero?)
  frozen = panel.dup.freeze
  twin = frozen.clone
  check(twin.frozen? && twin.close && !twin.close)
  check(frozen.active_meter.equal?(a) && frozen.close && !panel.closed?)
  refused(NoMethodError) { panel.active_meter = b }
  Station.mirror(b).with do |aliased|
    check(aliased.active_meter.equal?(b) && aliased.spare_meter.equal?(b))
    bad = Station::Panel.new(b, 0, Object.new)
    refused(TypeError) { Station.combined(panel, bad) }
    bad.close
    refused(RangeError) { Station.switch_meters(Station::Panel.new(a, 2**32, b)) }
    refused(TypeError) { Station.switch_meters([a, 0, b]) }
    check(a.reads == 1 && b.reads.zero?)
    a.level = 20
    check(Station.combined(panel, aliased) == 31)
    marker = ArgumentError.new("sensor unplugged")
    a.failure = marker
    check(refused(ArgumentError) { Station.switch_meters(panel) }.equal?(marker))
    a.failure = nil
    check(Station.combined(panel, aliased) == 31)
  end
  check(panel.close && panel.closed? && !panel.close)
  check(panel.dup.closed?)
  refused(IOError) { Station.current(panel) }
  refused(IOError) { panel.active_meter }
  foreign = Fiber.new { refused(RuntimeError) { Station.mirror(a) } }.resume
  check(foreign.message.include?("this fiber"))
  holder, weak = temporary
  GC.start
  check(Thread.new { weak.weakref_alive? && holder.active_meter.equal?(weak.__getobj__) }.value)
  check(holder.close)
  12.times { GC.start; break unless weak.weakref_alive? }
  check(!weak.weakref_alive?)
end
check(survivor.spare_meter.equal?(a) && survivor.close && !survivor.close)
puts "installed Ruby panel: original objects, two borrowed records, checked inputs, exact exception, alias and lifetime"
