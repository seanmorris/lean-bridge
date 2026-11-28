# encoding: UTF-8
require "lean_bridge/ruby_pulse"
require_relative "scheduler"
API = LeanBridge::RubyPulse
def check(value) = (raise("failed at #{caller(1, 1).first}") unless value)
def rejects(type)
  begin
    yield
  rescue type => e
    return e
  end
  raise "expected #{type} at #{caller(1, 1).first}"
end
def snapshot
  f = Fiddle::Function.new(Fiddle::Handle::DEFAULT["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
  Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) { |p| f.call(p); return p[0, 24].unpack("L<6") }
end
def eventually
  deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + 12
  until yield
    raise "worker did not settle" if Process.clock_gettime(Process::CLOCK_MONOTONIC) > deadline
    sleep 0.002
  end
end
def clean = eventually { snapshot[5].zero? }
cold = snapshot
rejects(RangeError) { API.rt_uint8(256) }
check(Thread.new { rejects(API::WrongContext) { API.rt_int(4) } }.value)
check(snapshot == cold)
wide = (1 << 4096) + 73
values = {unit: API::UNIT, bool: false, uint8: 255, int8: -128, uint16: 65535, int16: -32768,
  uint32: (1 << 32) - 1, int32: -(1 << 31), uint64: (1 << 64) - 1, int64: -(1 << 63),
  usize: (1 << 64) - 1, isize: -(1 << 63), float32: -3.5, float64: Float::INFINITY,
  char: "🦊", bytes: "\xff\0".b, string: "a\0λ", int: -wide, nat: wide}
values.each do |type, value|
  t = API.public_send("rt_#{type}", value)
  check(t.is_a?(API::Task) && t.await == value && t.await == value && !t.cancel)
end
check(API.rt_float32(Float::NAN).await.nan? && 1.0 / API.rt_float64(-0.0).await == -Float::INFINITY)
check(API.direct(false, "x") == 23)
check(API.identity("pure\0λ") == "pure\0λ" && API.base((1 << 64) - 1) == (1 << 64) - 1)
check(API.rt_int(-wide).freeze.with(&:await) == -wide)
check(API.series(false, false, "frozen").freeze.to_a == [API::Err.new("frozen"), API::Ok.new(73)])
check(rejects(API::DeclaredError) { API.direct(true, "direct") }.payload == "direct")
check(API.io_task(false).await.equal?(API::UNIT))
start = rejects(API::IOError) { API.io_task(true) }; check(start.declaration == "Pulse.ioTask" && !start.is_a?(API::TaskIOError))
check(API.checked(false, true, "ordinary").await == API::Err.new("ordinary"))
check(rejects(API::DeclaredError) { API.checked(true, false, "factory") }.payload == "factory")
[[wide, API::Ok.new(wide)], [-wide, API::Err.new(values[:bytes])]].each do |n, nested|
  check(API.wide(false, n, values[:bytes]).await == nested)
  check(rejects(API::DeclaredError) { API.wide(true, n, values[:bytes]) }.payload == nested)
end
t = API.terminal(true, wide)
error = rejects(API::TaskIOError) { t.await }
check(error.equal?(rejects(API::TaskIOError) { t.await }) && error.declaration == "RubyTasks.terminal" && error.message.include?("terminal Ruby"))
check(API.terminal(false, -wide).await == -wide)

s = API.series(false, false, "one")
pulls, closes = API.pulls, API.closes
check(s.is_a?(Enumerable) && API.pulls == pulls)
check(s.next == API::Err.new("one") && API.pulls == pulls + 1)
check(s.next == API::Ok.new(73))
rejects(StopIteration) { s.next }; rejects(StopIteration) { s.next }
check(API.pulls == pulls + 3 && API.closes == closes + 1 && !s.close)
closes = API.closes
check(API.series(false, false, "two").each { |v| break v } == API::Err.new("two"))
check(API.closes == closes + 1)
err = Class.new(StandardError)
rejects(err) { API.series(false, false, "x").each { raise err } }
check(API.closes == closes + 2)
s = API.series(true, false, "first")
check(s.next == API::Err.new("first"))
step = rejects(API::StepError) { s.next }
check(step.declaration == "Pulse.next" && step.payload == 413 && !s.close)
rejects(StopIteration) { s.next }

fault = Class.new(StandardError)
t = API.wide(false, wide, "b")
API::Ok.define_singleton_method(:new) { |*| raise fault }
begin
  ex = rejects(fault) { t.await }
  check(rejects(fault) { t.await }.equal?(ex))
ensure
  API::Ok.singleton_class.remove_method(:new)
end
clean
sched = ProbeScheduler.new
Fiber.set_scheduler(sched)
API.reset
t = API.late(false, -41)
rejects(TypeError) { t.dup }; rejects(TypeError) { Marshal.dump(t) }
check(Thread.new { rejects(API::WrongContext) { t.cancel } }.value)
pid = fork { exit!(rejects(API::WrongContext) { t.await } ? 0 : 12) }
Process.wait(pid); check($?.success?)
got = []
2.times { Fiber.schedule { got << t.await } }
check(sched.waiting.size == 2 && got.empty?)
API.release; sched.run
check(got == [-41, -41] && !t.cancel)
clean
# Each pending waiter must wake when closed, even without Lean cooperation.
API.reset; t = API.late(false, 9); got = []
eventually { API.state == 1 }
2.times { Fiber.schedule { got << rejects(API::Cancelled) { t.await } } }
check(sched.waiting.size == 2 && t.cancel && !t.cancel)
sched.run
check(got.size == 2 && got[0].equal?(got[1]))
API.release; eventually { API.state == 3 }; clean
API.reset; t = API.late(true, 9); eventually { API.state == 1 }
check(t.close); eventually { API.state == 2 }; clean
API.reset; s = API.series(false, true, "paused"); stopped = false
Fiber.schedule { rejects(API::Cancelled) { s.next }; stopped = true }
check(sched.waiting.size == 1)
eventually { API.state == 1 }
rejects(API::Busy) { s.next }
rejects(API::Busy) { s.each { raise "should not run" } }
check(!stopped && sched.waiting.size == 1)
check(s.close && !s.close); sched.run
check(stopped)
API.release; eventually { API.state == 3 }; clean
def abandon
  API.bytes("abandoned")
  API.series(false, false, "abandoned cursor")
  nil
end
closes = API.closes
abandon
eventually { GC.start; API.state; API.closes == closes + 1 && snapshot[5].zero? }

# Retiring a live broker must wake a parked fiber before its gated worker can
# complete. Disposing the idle cursor is still allowed after retirement.
API.reset; t = API.late(true, 17); s = API.series(false, false, "retire")
retired = false
Fiber.schedule { rejects(API::Unavailable) { t.await }; retired = true }
check(sched.waiting.size == 1)
Fiddle::Function.new(Fiddle::Handle::DEFAULT["lean_bridge_native_runtime_retire"], [], Fiddle::TYPE_VOID).call
sched.run
check(retired && s.close && !t.close)
rejects(API::Unavailable) { API.bytes("no restart") }
Fiber.set_scheduler(nil); clean
puts "Ruby Task: 19 scalars, fiber readiness, cancellation, typed errors, stream backpressure, retirement and cleanup passed"
