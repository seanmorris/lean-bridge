# Inspect the private boundary below the public fiber guard. Keep one peer
# bound throughout so that clearing the shared class table cannot mask a leak.
require "lean_bridge/workshop"
require "lean_bridge/workshop_peer"
class ProbeBox; end
class Leaf; end
a, b = LeanBridge::Workshop, LeanBridge::WorkshopPeer
def rejected
  yield
rescue TypeError
  return
else
  raise "foreign or stale native lease was accepted"
end
token, value = nil, ProbeBox.new
b.bind_hosts(box: ProbeBox, leaf: Leaf) do
  a.bind_hosts(box: ProbeBox, leaf: Leaf) do
    token = a.send(:__worker_pin, 0, value)
    raise "same-scope resolution" unless a.send(:__worker_resolve, 0, token).equal?(value)
    rejected { a.send(:__worker_resolve, 0, token.byteslice(0, 15)) }
    rejected { a.send(:__worker_resolve, 1, token) }
    rejected { b.send(:__worker_resolve, 0, token) }
    raise "peer dropped the primary lease" if b.send(:__worker_drop, 0, token)
    # Deliberately abandon the private input token. Unbinding must release it.
  end
  a.bind_hosts(box: ProbeBox, leaf: Leaf) do
    rejected { a.send(:__worker_resolve, 0, token) }
    raise "stale drop accepted" if a.send(:__worker_drop, 0, token)
    fresh = a.send(:__worker_pin, 0, value)
    raise "same native token reused" if fresh == token
    raise "explicit release" unless a.send(:__worker_drop, 0, fresh)
    rejected { a.send(:__worker_resolve, 0, fresh) }
  end
end
raise "host roots survived both binds" unless a.send(:__live).zero?
snapshot = Fiddle::Function.new(Fiddle::Handle::DEFAULT["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) do |p|
  snapshot.call(p)
  raise "private token outlived its binding" unless p[0, 24].unpack("L<6").last.zero?
end
puts "Ruby worker: native peer/generation isolation and abandoned-token cleanup passed"
