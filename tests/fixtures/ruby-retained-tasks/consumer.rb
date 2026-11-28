# encoding: UTF-8
require "lean_bridge/ruby_feedback"
require "weakref"
require_relative "scheduler"
API = LeanBridge::RubyFeedback
def check(ok) = (raise("failed at #{caller(1, 1).first}") unless ok)
def rejects(type)
  yield
rescue type => error
  return error
else
  raise "expected #{type} at #{caller(1, 1).first}"
end
def snapshot
  f = Fiddle::Function.new(Fiddle::Handle::DEFAULT["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
  Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) { |p| f.call(p); return p[0, 24].unpack("L<6") }
end
def eventually
  deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + 15
  until yield
    raise "Lean worker did not settle" if Process.clock_gettime(Process::CLOCK_MONOTONIC) > deadline
    sleep 0.002
  end
end
def clean = eventually { snapshot[5].zero? }
if ARGV == ["--trap"] || ARGV == ["--trap-format"]
  fatal = Class.new(Exception).new("fatal Ruby callback")
  source = if ARGV == ["--trap-format"]
             message = Object.new
             message.define_singleton_method(:to_s) { raise fatal }
             RuntimeError.new(message)
           else
             fatal
           end
  task = API.once(3) { raise source }
  2.times { check(rejects(fatal.class) { task.await }.equal?(fatal)) }
  rejects(API::Unavailable) { API.plain(0) }; clean
  exit
end
initial = snapshot
rejects(TypeError) { API.once(7, Object.new) }
rejects(RangeError) { API.once(-1) { 0 } }
rejects(ArgumentError) { API.once(1, ->(n) { n }) { 0 } }
check(snapshot == initial)
wide = (1 << 4096) + 71
v = [API::UNIT, true, "🦊", "a\0λ", "\xff\x00".b, wide, -wide, 255, 65535, (1 << 32) - 1,
     (1 << 64) - 1, (1 << 64) - 1, -128, -32768, -(1 << 31), -(1 << 63), -(1 << 63), -0.0, Float::INFINITY, API::UNIT]
seen = []
functions = 19.times.map do |i|
  ->(x) {
    check(Thread.current == Thread.main && x == v[i])
    check(1.0 / x == -Float::INFINITY) if i == 17
    seen << i
    v[i + 1]
  }
end
check(API.scalar_tour(*functions).await.equal?(API::UNIT) && seen == (0...19).to_a)
check(API.during_start(->(s) { check(API.once(20) { |n| API.plain(n) * 2 }.await == 42); s + "!" },
                       ->(s) { s + "?" }, "α\0").await == "α\0!?!")

original = Class.new(StandardError).new("identical")
bad = ->(_) { raise original }
t = API.repeat_call("", bad)
check(rejects(original.class) { t.await }.equal?(original))
check(rejects(original.class) { t.await }.equal?(original))
check(rejects(original.class) { API.during_start(bad, bad, "").await }.equal?(original))
binary = RuntimeError.new("\xff".b)
check(rejects(RuntimeError) { API.once(1) { raise binary }.await }.equal?(binary))
opaque = Object.new
def opaque.to_s = throw(:format_escape, :escaped)
unprintable = RuntimeError.new(opaque)
formatted = catch(:format_escape) do
  check(rejects(RuntimeError) { API.once(1) { raise unprintable }.await }.equal?(unprintable))
  :preserved
end
check(formatted == :preserved)
def opaque.to_s = raise("message conversion failed")
check(rejects(RuntimeError) { API.once(1) { raise unprintable }.await }.equal?(unprintable))
replaced = rejects(API::TaskIOError) { API.replace_error(bad).await }
check(replaced.declaration == "Retained.replaceError" && replaced.message.include?("identical") && !replaced.equal?(original))
check(API.recover(bad, wide).await == API::Err.new("caught in Lean"))
check(API.recover(->(n) { n + 2 }, wide).await == API::Ok.new(wide + 2))
early = API.early(true) { raise "unexpected invocation" }
err = rejects(API::IOError) { early.await }
check(err.instance_of?(API::IOError) && err.declaration == "Feedback.early" && err.message.include?("early Ruby factory"))
err = rejects(API::DeclaredError) { API.typed_start(bad, true, "".b).await }
check(err.declaration == "Retained.typedStart" && err.payload == "factory refused")
check(API.typed_start(->(b) { b.reverse }, false, "\xff\0".b).await == "\0\xff".b)
rejects(TypeError) { API.once(1) { "not an integer" }.await }
rejects(RangeError) { API.once(1) { -1 }.await }
rejects(LocalJumpError) { catch(:escape) { API.once(1) { throw :escape, :bad }.await } }
check(API.plain(4) == 5)

c = API::RetainedCallback.new { |n| n * 2 }
rejects(TypeError) { c.dup }; rejects(TypeError) { Marshal.dump(c) }
check(Thread.new { rejects(API::WrongContext) { c.close } }.value)
a, b = API.once(3, c), API.once(4, c)
check(a.cancel && b.await == 8 && !c.closed?)
check(c.close && !c.close && c.closed?)
rejects(API::CallbackClosed) { API.once(4, c).await }
self_closing = API::RetainedCallback.new { |n| self_closing.close; n + 3 }
check(API.once(7, self_closing).await == 10 && self_closing.closed?)
hits = 0
twice = API::RetainedCallback.new { |s| hits += 1; twice.close; s }
rejects(API::CallbackClosed) { API.repeat_call("x", twice).await }
check(hits == 1)
clean

def weak_remember
  f = ->(_) { raise "expired Ruby callback executed" }
  r = WeakRef.new(f)
  check(API.remember(f).await == 17)
  r
end
saved = weak_remember
eventually { GC.start; !saved.weakref_alive? }
check(rejects(API::TaskIOError) { API.use_expired.await }.message.include?("expired"))
API.forget; clean
def weak_cycle
  box = []
  t = API.once(3, ->(n) { box.fetch(0); n })
  box << t
  WeakRef.new(t)
end
weak = weak_cycle
eventually { GC.start; API.state; !weak.weakref_alive? && snapshot[5].zero? }
def exception_cycle
  t = API.once(1) do |_|
    error = RuntimeError.new("owns its task")
    error.instance_variable_set(:@owner, t)
    raise error
  end
  error = rejects(RuntimeError) { t.await }
  check(error.instance_variable_get(:@owner).equal?(t))
  WeakRef.new(t)
end
# Drop the producing fiber and its exception stack before observing reachability.
weak = Fiber.new { exception_cycle }.resume
clean
eventually { GC.start; !weak.weakref_alive? }

API.reset; calls = 0
t = API.cancel_late(->(n) { calls += 1; n })
eventually { API.state == 1 }
check(t.cancel); API.release
eventually { API.state == 2 }; check(calls.zero?); clean

scheduler = ProbeScheduler.new; Fiber.set_scheduler(scheduler)
API.reset; calls = 0; deliveries = []
t = API.queued do |n|
  calls += 1
  rejects(API::Busy) { t.await }
  API.once(n) { |x| API.plain(x) }.await
end
2.times { Fiber.schedule { deliveries << t.await } }
check(scheduler.waiting.size == 2 && calls.zero?)
API.release; scheduler.run
check(deliveries == [8, 8] && calls == 1)

# A second fiber may cancel while application code for the current request is suspended.
# Resuming it must not touch the freed native handle or send its stale reply.
r, w = IO.pipe
API.reset; cancelled = []; in_callback = false
t = API.queued { |n| in_callback = true; r.wait_readable; r.read(1); n }
2.times { Fiber.schedule { cancelled << rejects(API::Cancelled) { t.await } } }
API.release
while !in_callback
  ready = IO.select(scheduler.waiting.values, nil, nil, 10)
  check(ready)
  scheduler.waiting.to_a.each { |fiber, io| fiber.resume if ready[0].include?(io) && scheduler.waiting[fiber].equal?(io) }
end
check(t.cancel); w.write("x"); scheduler.run
check(cancelled.length == 2 && cancelled[0].equal?(cancelled[1]))
r.close; w.close; clean
Fiber.set_scheduler(nil)

fatal = Class.new(Exception).new("fatal callback trap")
%w[--trap --trap-format].each { |mode| check(system(RbConfig.ruby, __FILE__, mode)) }
t = API.once(9) { t.cancel; raise fatal }
cancelled = rejects(API::Cancelled) { t.await }
check(rejects(API::Cancelled) { t.await }.equal?(cancelled))
rejects(API::Unavailable) { API.plain(3) }
clean
puts "Ruby retained callbacks: 19 scalars, nested dispatch, original exceptions, fibers, cancellation, retirement and cleanup passed"
