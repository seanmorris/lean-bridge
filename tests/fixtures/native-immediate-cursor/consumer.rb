# frozen_string_literal: true
require "weakref"
at_exit { raise "shutdown left a native cursor" unless LeanBridge::Dials.counts == 81408 }
require "lean_bridge/dials"
D = LeanBridge::Dials

def expect_error(cls)
  yield
  raise "expected #{cls}"
rescue cls => e
  e
end

raise unless D.counts.zero?
first = D.sequence(3)
raise unless D.counts == 10000
answer = first.each do |n|
  raise unless n.zero? && D.counts == 10100
  expect_error(D::BoundaryError) { first.next }
  break :early
end
raise unless answer == :early && D.counts == 10101
first.close
raise unless first.to_a.empty?
second = D.sequence(2)
raise unless second.is_a?(Enumerable) && second.each.is_a?(Enumerator)
expect_error(TypeError) { second.dup }
Thread.new do
  expect_error(D::WrongContext) { second.next }
  expect_error(D::WrongContext) { second.close }
end.value
raise unless second.to_a == [0, 1] && D.counts == 20402
expect_error(StopIteration) { second.next }
e = expect_error(D::DeclaredError) { D.checked(0) }
raise unless e.declaration == "Dials.checked" && e.payload == "factory"
third = D.checked(1)
raise unless third.next.zero?
e = expect_error(D::DeclaredError) { third.next }
raise unless e.declaration == "Dials.checkedNext" && e.payload == "step"
raise unless third.to_a.empty? && D.counts == 30603
items = D.units(1)
raise unless D::UNIT.equal?(items.next)
e = expect_error(D::IOError) { items.next }
raise unless e.declaration == "Dials.nextUnit" && e.message == "unit step"
raise unless items.to_a.empty? && D.counts == 40804
raise unless D.units(4).map { |x| D::UNIT.equal?(x) } == [true, true]
raise unless D.counts == 51105
fault = StandardError.new("caller left the loop")
e = expect_error(StandardError) { D.sequence(4).each { raise fault } }
raise unless e.equal?(fault) && D.counts == 61206
def abandon
  cursor = D.sequence(4)
  raise unless cursor.next.zero?
  WeakRef.new(cursor)
end
weak = abandon
3.times { GC.start(full_mark: true, immediate_sweep: true) }
raise if weak.weakref_alive?
raise unless D.counts == 71307
# Keep this cursor alive so normal process exit, not GC, runs its finalizer.
$at_shutdown = D.sequence(4)
raise unless $at_shutdown.next.zero? && D.counts == 81407
