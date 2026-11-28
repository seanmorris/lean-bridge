# Run against two offline-installed gems, outside their producer directories.
require "lean_bridge/workshop"
require "lean_bridge/workshop_peer"
require "weakref"
A = LeanBridge::Workshop
B = LeanBridge::WorkshopPeer
def check(ok, message)
  raise message unless ok
end
def refused(type)
  begin
    yield
  rescue type => e
    return e
  end
  raise "expected #{type}"
end
class Box
  attr_accessor :level, :on_read
  def initialize(n) = (@level = n)
  def read = (@on_read ? @on_read.call : @level)
  def identity = self
end
class OtherBox < Box; end
class Token
  attr_accessor :on_read
  def identity = self
  def read = (@on_read ? @on_read.call : 19)
end
box = Box.new(4)
refused(RuntimeError) { A.read(box) }
A.bind_hosts(box: Box, token: Token) do
  refused(TypeError) { B.bind_hosts(box: OtherBox, token: Token) { raise "wrong binding admitted" } }
  B.bind_hosts(box: Box, token: Token) do
    x = A.make(11)
    check(x.instance_of?(Box) && B.identity(x).equal?(x), "constructor or identity")
    check(B.update(x, 42) == 42 && A.read(x) == 42 && x.level == 42, "shared mutable property")
    A.keep(x); B.keep(x)
    check(A.send(:__live) == 1 && B.send(:__live) == 1, "two wrappers for one object")
    GC.start; GC.compact
    check(A.held.equal?(x) && B.held.equal?(x), "object changed after GC")
    B.forget
    refused(TypeError) { A.read(Object.new) }
    refused(TypeError) { A.update(x, "12") }
    refused(RangeError) { A.update(x, -1) }
    refused(RangeError) { A.update(x, 2**32) }
    check(A.update(x, 2**32 - 1) == 2**32 - 1, "UInt32 boundary")
    x.on_read = -> { B.update(x, 73) }
    check(A.read(x) == 73, "cross-component reentry")
    boom = Class.new(StandardError).new("boom\0λ")
    x.on_read = -> { raise boom }
    check(refused(StandardError) { A.read(x) }.equal?(boom), "exception identity")
    box.on_read = -> { B.read(x) }
    check(refused(StandardError) { A.read(box) }.equal?(boom), "nested exception identity")
    mapped = refused(A::DeclaredError) { A.mapped(x) }
    check(mapped.declaration.end_with?(".mapped") && mapped.payload == "host read failed", "typed Lean EIO")
    box.on_read = nil; x.on_read = nil
    check(B.read(x) == 73, "exception poisoned following call")
    refused(RuntimeError) { Fiber.new { A.read(x) }.resume }
    err = Thread.new { begin A.read(x); nil; rescue => e; e; end }.value
    check(err.is_a?(RuntimeError), "wrong thread accepted")
    pid = fork do
      begin
        refused(RuntimeError) { A.read(x) }
        exit! 0
      rescue StandardError
        exit! 1
      end
    end
    check(Process.wait2(pid).last.success?, "fork inherited a live Lean binding")
    A.forget; check(A.send(:__live) == 0, "registration leaked after last reference")
    96.times { check(A.identity(box).equal?(box), "weak canonical reuse"); check(B.send(:__live).zero?, "unretained row") }
    weak_for = -> { v = A.make(7); B.keep(v); WeakRef.new(v) }
    weak = weak_for.call; GC.start
    check(weak.weakref_alive? && A.read(B.held) == 7, "lost sole Lean owner")
    B.forget
    check(B.send(:__live).zero?, "sole owner not released")
    A.keep(box)
  end
  check(A.held.equal?(box), "unbinding peer invalidated other session")
end
check(A.send(:__live).zero?, "leak at unbind")
A.bind_hosts(box: Box, token: Token) do
  refused(TypeError) { A.held } # Stored in Lean before the previous scope ended.
  A.forget
  check(A.read(box) == 4, "new scope failed")
end
check(B.send(:__live).zero?, "final owner count")
puts "two installed gems: shared identity, mutation, GC.compact, reentry, faults, stale/fiber/thread/fork refusal; live=0"
