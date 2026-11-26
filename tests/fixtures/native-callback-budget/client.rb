# frozen_string_literal: true
require "lean_bridge/rubygems_budget"
require "weakref"
API = LeanBridge::RubygemsBudget

def check(condition) = (raise "failed at #{caller(1, 1).first}" unless condition)
def caught(klass)
  yield
rescue klass => error
  check(error.instance_of?(klass))
  error
else
  raise "expected #{klass} at #{caller(1, 1).first}"
end
def denied(name, &call)
  error = caught(API::CallbackAlreadyInvoked, &call)
  check(error.declaration == name && error.message == "callback-already-invoked")
  error
end
def tracked(calls)
  owner = Object.new
  [WeakRef.new(owner), API::RetainedCallback.new do |value|
    owner.object_id
    calls[0] += 1
    value + 1
  end]
end

calls = [0, 0]
weak, f = tracked(calls)
many = ->(n) { calls[1] += 1; n + 1 }
denied("Budget.probe") { API.probe(1, f, many).await }
check(calls == [1, 2])
check(API.pair(40, f, f).await == 42)
a, b = API.single(3, f), API.single(41, f)
check(b.await == 42 && a.await == 4 && calls == [5, 2])

original = RuntimeError.new("callback-already-invoked")
failed = 0
boom = ->(_) { failed += 1; raise original }
denied("Budget.retry") { API.retry_(1, boom).await }
check(failed == 1)
check(caught(RuntimeError) { API.single(1, boom).await }.equal?(original))
earlier = denied("Racing.duringStart") { API.during_start(1, f).await }
check(caught(API::CallbackAlreadyInvoked) { API.single(1) { raise earlier }.await }.equal?(earlier))
startup = caught(API::IOError) { API.start(0, f).await }
check(startup.declaration == "FactoryFault.start" && startup.message.include?("callback-already-invoked"))
terminal = caught(API::TaskIOError) { API.replace(1, f).await }
check(terminal.declaration == "Racing.replace" && terminal.message.include?("callback-already-invoked"))
before = calls[0]
typed = caught(API::DeclaredError) { API.checked(0, f).await }
check(typed.declaration == "TypedBudget.checked" && typed.payload == 73 && calls[0] == before)
denied("TypedBudget.checked") { API.checked(1, f).await }
check(calls[0] == before + 1)

16.times do |n|
  before = calls[0]
  denied("Racing.race") { API.race(n, f).await }
  check(calls[0] == before + 1)
end
check(weak.weakref_alive? && f.close)
16.times { GC.start; break unless weak.weakref_alive? }
check(!weak.weakref_alive?)
# The application above never sees native handles. Observe the already-loaded
# broker here, without initializing another runtime just to read its counters.
read = Fiddle::Function.new(Fiddle::Handle::DEFAULT["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) do |p|
  read.call(p)
  abi, _, init, _, _, live = p[0, 24].unpack("L<6")
  check([abi, init, live] == [1, 1, 0])
end
puts "Ruby: 16 one-call worker races; factory, terminal, typed and original errors distinct; capture released; zero leases"
