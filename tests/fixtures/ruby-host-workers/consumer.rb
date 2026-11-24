# frozen_string_literal: true
require "lean_bridge/workshop"
require "lean_bridge/workshop_peer"
require "fiddle"

A, B = LeanBridge::Workshop, LeanBridge::WorkshopPeer
class Leaf
  def read = 9
end
class Box
  attr_accessor :level
  def initialize(level) = (@level = level)
  def read = level
  def identity = self
end
def check(ok, reason) = (raise reason unless ok)
def refused(klass)
  begin
    yield
  rescue klass => error
    return error
  end
  raise "expected #{klass}"
end
def leases
  f = Fiddle::Function.new(Fiddle::Handle::DEFAULT["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
  Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) { |p| f.call(p); return p[0, 24].unpack("L<6").last }
end
def descriptors = Dir.children("/proc/self/fd").size
def drained(baseline)
  deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + 3
  until leases.zero? && descriptors == baseline
    raise "shutdown: #{leases} leases, #{descriptors} FDs, expected #{baseline}" if Process.clock_gettime(Process::CLOCK_MONOTONIC) >= deadline
    sleep 0.005
  end
end

box = Box.new(42)
check(A.scalar(41).await == 42, "scalar task unexpectedly needs bind_hosts")
refused(A::WrongContext) { A.outcome(box) }
# Initialize MRI's wait support and Lean's worker pool before measuring FDs.
A.bind_hosts(box: Box, leaf: Leaf) { check(A.relay(box) { |v| v }.await.equal?(box), "first retained callback") }
base = descriptors
stale = nil
B.bind_hosts(box: Box, leaf: Leaf) do
  A.bind_hosts(box: Box, leaf: Leaf) do
    refused(RangeError) { A.check_pair(Box.new(1), 256) }
    check(A.send(:__live).zero?, "failed argument list retained strong identity")
    leaf = Leaf.new
    check(A.weak_echo(leaf).await.equal?(leaf), "weak identity changed")
    check(A.read_leaf(leaf) == 9, "synchronous weak member")
    check(A.send(:__live).zero?, "completed worker still pinned weak identity")
    check(A.plain(box).equal?(box) && A.lifted(box).equal?(box), "immediate pure and BaseIO neighbors")
    owner = Fiber.current
    task = A.relay(box) do |arg|
      check(arg.equal?(box) && Fiber.current.equal?(owner) && Thread.current == Thread.main, "callback identity or owner")
      refused(RuntimeError) { A.send(:__unbind) }
      check(B.identity(arg).equal?(box), "peer reentry changed identity")
      B.update(arg, 43)
      GC.compact
      arg
    end
    Fiber.new { refused(A::WrongContext) { task.await } }.resume
    check(task.await.equal?(box) && task.await.equal?(box) && box.level == 43, "task result or settlement")
    check(A.outcome(box).await.value.equal?(box), "returned Except identity")
    error = refused(A::DeclaredError) { A.reject(box) }
    check(error.payload.equal?(box) && error.declaration == "Workers.reject", "factory EIO")
    original = ArgumentError.new("callback failed")
    check(refused(ArgumentError) { A.relay(box) { raise original }.await }.equal?(original), "callback exception replaced")
    check(A.fallback(box) { raise original }.await.equal?(box), "Lean could not catch callback exception")
    refused(TypeError) { A.fallback(box) { Object.new }.await }
    stream = A.open_cursor(box)
    check(stream.next.equal?(box), "typed cursor item")
    error = refused(A::StepError) { stream.next }
    check(error.payload.equal?(box) && error.declaration == "Workers.pull", "typed cursor failure")
    stream = A.open_error_cursor(box)
    check(stream.next.equal?(box), "IO cursor item")
    error = refused(A::TaskIOError) { stream.next }
    check(error.message.include?("Ruby cursor ended") && error.declaration == "Workers.pullIO", "cursor IO failure")
    check(A.open_cursor(box).each { |v| break v }.equal?(box), "early cursor exit")
    cancelled = A.relay(box) { raise "cancelled task dispatched" }
    check(cancelled.cancel && !cancelled.cancel, "cancel not idempotent")
    refused(A::Cancelled) { cancelled.await }
    stale = A.relay(box) { raise "stale callback dispatched" }
    A.open_cursor(box)
  end
  refused(A::WrongContext) { stale.await }
  check(B.relay(box) { |v| v }.await.equal?(box), "closing primary binding broke peer")
  A.bind_hosts(box: Box, leaf: Leaf) { refused(A::WrongContext) { stale.await } }
end
drained(base)
check(A.send(:__live).zero?, "host identities after last unbind")

# A Ruby control-flow exception retires the shared runtime, not merely one
# request. Run this last and prove the other component does not dispatch.
A.bind_hosts(box: Box, leaf: Leaf) do
  B.bind_hosts(box: Box, leaf: Leaf) do
    trap = Class.new(Exception).new("fatal")
    check(refused(trap.class) { A.fallback(box) { raise trap }.await }.equal?(trap), "trap swallowed")
    refused(B::Unavailable) { B.scalar(1).await }
  end
end
drained(base)
check(B.send(:__live).zero?, "retired Ruby host roots")
puts "Ruby worker: class identity, typed/IO/callback failures, stale scopes, peer retirement, zero live identities"
