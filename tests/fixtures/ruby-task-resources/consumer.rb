# encoding: UTF-8
require "json"
require "weakref"
order = ARGV.reject { |name| name == "--smoke" }
order.each { |name| require "lean_bridge/#{name}" }
foreign = !ARGV.include?("--smoke")
require "lean_bridge/ruby_other_desk" if foreign
a, b = LeanBridge::RubyLeaseDesk, LeanBridge::RubyLeaseDepot
def check(value) = (raise("failed at #{caller(1, 1).first}") unless value)
def rejects(klass)
  yield
rescue klass => e
  return e
else
  raise "expected #{klass} at #{caller(1, 1).first}"
end
def eventually
  stop = Process.clock_gettime(Process::CLOCK_MONOTONIC) + 20
  until yield
    raise "not ready at #{caller(1, 1).first}" if Process.clock_gettime(Process::CLOCK_MONOTONIC) > stop
    sleep 0.002
  end
end
def snapshot
  f = Fiddle::Function.new(Fiddle::Handle::DEFAULT["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
  Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) { |p| f.call(p); return p[0, 24].unpack("L<6") }
end
def descriptors
  Dir.children("/proc/self/fd").count { |n| (File.readlink("/proc/self/fd/#{n}") rescue nil) == "/dev/null" }
end
b.reset; base = descriptors; check(snapshot.last.zero?)
check(a::Ticket.equal?(b::Ticket) && a::Badge.equal?(b::Badge))
# Fail after native allocation, while the result is still owned by the wire.
# No Ruby wrapper was delivered: the native lease and Lean's descriptor must go away.
orig_finalizer = ObjectSpace.method(:define_finalizer)
fault = RuntimeError.new("cannot register a wrapper")
begin
  ObjectSpace.define_singleton_method(:define_finalizer) do |obj, fn|
    raise fault if obj.instance_of?(a::Ticket)
    orig_finalizer.call(obj, fn)
  end
  check(rejects(RuntimeError) { a.issue(0) }.equal?(fault))
ensure
  ObjectSpace.define_singleton_method(:define_finalizer, orig_finalizer)
end
eventually { snapshot.last.zero? && descriptors == base }
escaped = catch(:leave_scope) { a.issue(1).with { throw :leave_scope, :closed } }
check(escaped == :closed)
check(rejects(RuntimeError) { a.issue(1).with { raise fault } }.equal?(fault))
eventually { snapshot.last.zero? && descriptors == base }
ticket, distinct = a.issue(40), a.issue(40)
alias_lease = b.alias_(ticket)
check(ticket.instance_of?(b::Ticket) && ticket.same_resource?(alias_lease) && !ticket.same_resource?(distinct))
check(!ticket.equal?(alias_lease)); ticket.freeze
kept = ticket.retain
b.add(kept, 2); check(a.count(alias_lease) == 42 && b.count(distinct) == 40)
check(ticket.close && !ticket.close && ticket.closed? && !alias_lease.closed?)
rejects(a::ClosedResource) { a.count(ticket) }; rejects(b::ClosedResource) { b.count(ticket) }
GC.start
rejects(a::ClosedResource) { ticket.retain }; rejects(a::ClosedResource) { ticket.with { raise "yielded a closed lease" } }
rejects(TypeError) { alias_lease.dup }; rejects(TypeError) { Marshal.dump(alias_lease) }
rejects(NoMethodError) { b::Ticket.new }; rejects(NoMethodError) { b::Ticket.allocate }
rejects(b::ClosedResource) { b.count(a::Ticket.send(:allocate)) }
badge = b.badge(0); rejects(TypeError) { a.count(badge) }; rejects(TypeError) { alias_lease.same_resource?(badge) }; badge.close
check(Thread.new { rejects(a::WrongContext) { a.count(kept) } }.value)
child = fork { exit!(rejects(b::WrongContext) { b.count(kept) }.is_a?(b::WrongContext)) }
Process.wait(child); check($?.success?)
if foreign
  c = LeanBridge::RubyOtherDesk
  outsider = c.issue(2)
  check(!c::Ticket.equal?(a::Ticket))
  rejects(TypeError) { a.count(outsider) }; rejects(TypeError) { c.count(kept) }
  rejects(TypeError) { kept.same_resource?(outsider) }; outsider.close
end
check(rejects(a::DeclaredError) { a.check_ticket(true, kept) }.payload.with { |x| x.same_resource?(kept) })
check(a.check_ticket(false, kept).with { |x| x.same_resource?(kept) })
check(rejects(b::DeclaredError) { b.checked(true, kept) }.payload.with { |x| x.same_resource?(kept) })
check(b.checked(false, kept).await.with { |x| x.same_resource?(kept) })
temporary = a.issue(13)
failure = rejects(a::DeclaredError) { a.check_ticket(true, temporary) }
temporary.close
check(failure.payload.with { |x| b.count(x) } == 13)
temporary = a.issue(20)
borrower = b.revisit(temporary) { |n| n * 2 }
temporary.close
check(borrower.await.with { |x| a.count(x) } == 40)
job = b.revisit(kept) { |n| check(b.count(kept) == n); n + 5 }
returned = job.await
check(returned.equal?(job.await) && returned.same_resource?(kept) && a.count(returned) == 47)
returned.close
original = RuntimeError.new("Ruby callback")
check(rejects(RuntimeError) { b.revisit(kept) { raise original }.await }.equal?(original))
3.times do |mode|
  before = b.closes
  stream = b.tickets(kept, mode == 1)
  item = stream.next
  check(item.same_resource?(kept) && a.count(item) == 47); item.close
  if mode == 1
    err = rejects(b::StepError) { stream.next }
    check(err.payload.with { |x| x.same_resource?(kept) })
  elsif mode == 0
    rejects(StopIteration) { stream.next }
  else
    check(stream.close)
  end
  check(b.closes == before + 1 && !stream.close)
end
kept.close; alias_lease.close; distinct.close
eventually { snapshot.last.zero? && descriptors == base }

def abandon(api)
  value = api.issue(7)
  WeakRef.new(value)
end
weak = Fiber.new { abandon(a) }.resume
eventually { GC.start; b.state; !weak.weakref_alive? && snapshot.last.zero? && descriptors == base }
t = a.issue(8); b.reset
job = b.pending(t, false); eventually { b.state == 1 }
check(t.close && descriptors == base + 1)
b.release; v = job.await
check(a.count(v) == 9); v.close
eventually { snapshot.last.zero? && descriptors == base }
for cooperate in [true, false]
  b.reset; t = a.issue(30)
  job = b.pending(t, cooperate); eventually { b.state == 1 }
  check(t.close && descriptors == base + 1)
  check(job.cancel && !job.cancel)
  ce = rejects(b::Cancelled) { job.await }; check(rejects(b::Cancelled) { job.await }.equal?(ce))
  unless cooperate
    check(descriptors == base + 1); b.release
  end
  eventually { b.state == (cooperate ? 2 : 3) && snapshot.last.zero? && descriptors == base }
end
t = b.make(1, "retire-probe"); cursor = b.tickets(t, false)
ready = snapshot; n = foreign ? 3 : 2
check(ready[1, 4] == [2, 1, n, n])
Fiddle::Function.new(Fiddle::Handle::DEFAULT["lean_bridge_native_runtime_retire"], [], Fiddle::TYPE_VOID).call
rejects(a::Unavailable) { a.count(t) }; check(t.close && cursor.close)
eventually { snapshot.last.zero? && descriptors == base }
check(!File.exist?("retired-close-ran.txt"))
stats = snapshot
check(stats[1] == 3 && stats[2] == 1 && stats[3] == n)
puts JSON.generate({ order: order, foreignKindRejected: foreign, runtimeInitializations: stats[2],
  componentInitializations: stats[3], liveIdentities: stats.last, leakedDescriptors: descriptors - base })
