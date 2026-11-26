# Exercise a worker trap inside an ordinary synchronous Lean call. The Ruby
# callback deliberately catches it and returns a plausible but invalid value.
require "weakref"
names = %w[workshop workshop_peer]
order = ARGV.fetch(0)
raise "unknown load order" unless %w[forward reverse].include?(order)
mode = ARGV.fetch(1)
raise "unknown handling" unless %w[catch propagate].include?(mode)
names.reverse! if order == "reverse"
names.each { |name| require "lean_bridge/#{name}" }
A, B = LeanBridge::Workshop, LeanBridge::WorkshopPeer
class Box
  attr_accessor :level, :hook
  def initialize(n) = (@level = n)
  def read = hook ? hook.call : level
  def identity = self
end
class Leaf
  attr_accessor :hook
  def read = hook.call
end
def check(ok, reason) = (raise reason unless ok)
def failure(type)
  yield
rescue type => e
  e
else
  raise "expected #{type}, got success"
end
def bound(api, &body) = api.bind_hosts(box: Box, leaf: Leaf, &body)
def error_owner(api)
  bound(api) do
    b = Box.new(23)
    data = api.outcome(b).await
    check(data.is_a?(api::Err) && data.value.equal?(b), "lost returned Except")
    e = failure(api::DeclaredError) { api.reject(b) }
    check(e.declaration == "Workers.reject" && e.payload.equal?(b), "wrong named error")
    [e, WeakRef.new(b)]
  end
end
def consume_owner(producer, peer)
  error, weak = error_owner(producer)
  GC.start
  check(weak.weakref_alive? && producer.send(:__live).zero?, "unbound error lost its payload or leaked the host registry")
  bound(peer) do
    check(peer.read(error.payload) == 23 && peer.update(error.payload, 42) == 42, "peer did not mutate the sole error payload")
  end
  weak
end
producer, peer = order == "forward" ? [A, B] : [B, A]
# Release the completed MRI native stack as well as the Ruby frame: dead C
# stack slots on a still-active fiber are conservative GC roots.
weak = Fiber.new { consume_owner(producer, peer) }.resume
12.times do
  GC.start(full_mark: true, immediate_sweep: true)
  break unless weak.weakref_alive?
  GC.compact
end
check(!weak.weakref_alive?, "payload outlived the error and both bindings")
reads = 0
nested = 0
bound(producer) do
  bound(peer) do
    b = Box.new(23)
    failure(RangeError) { producer.check_pair(b, 256) }
    original = ArgumentError.new("retryable")
    b.hook = -> { raise original }
    check(failure(ArgumentError) { producer.read(b) }.equal?(original), "lost original exception")
    mapped = failure(peer::DeclaredError) { peer.mapped(b) }
    check(mapped.declaration.end_with?(".mapped") && mapped.payload == "host read failed", "wrong mapped failure")
    b.hook = nil
    check(producer.read(b) == 23, "binding unusable after a declared failure")
    fatal = Class.new(Exception).new("stop the worker")
    leaf = Leaf.new
    leaf.hook = -> {
      reads += 1
      if mode == "propagate"
        peer.fallback(b) { nested += 1; raise fatal }.await
        raise "worker trap disappeared"
      end
      caught = failure(fatal.class) { peer.fallback(b) { nested += 1; raise fatal }.await }
      check(caught.equal?(fatal), "lost fatal exception")
      97
    }
    if mode == "catch"
      stopped = failure(RuntimeError) { producer.read_leaf(leaf) }
      check(stopped.message.include?("unavailable"), "outer call did not report retirement: #{stopped}")
    else
      check(failure(fatal.class) { producer.read_leaf(leaf) }.equal?(fatal), "outer changed the uncaught fatal exception")
    end
    failure(RuntimeError) { peer.read_leaf(leaf) }
    failure(producer::Unavailable) { producer.scalar(1).await }
    check(reads == 1 && nested == 1, "host dispatched after retirement")
  end
end
check(A.send(:__live).zero? && B.send(:__live).zero?, "leaked host identities")
puts "Ruby worker: #{order} #{mode}, sole owner 23->42 then collected, nested fatal, dispatch 1/1, live=0"
