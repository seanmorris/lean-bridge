# Installed Ruby acceptance for directional callback checked records.
require "lean_bridge/callbackcheckedrecords"
API = LeanBridge::Callbackcheckedrecords
$checks = 0
$calls = 0

def check(value, label)
  raise label unless value
  $checks += 1
end

def reject(kind = Exception)
  yield
  raise "expected rejection"
rescue kind => error
  error
end

def interval(lo, hi)
  API::Interval.new(lo: lo, hi: hi)
end

def weighted(weight, limit)
  API::Weighted.new(weight: weight, limit: limit)
end

widen = proc do |value|
  $calls += 1
  check(value == interval(1, 3), "proof-free host argument")
  interval(1, 4)
end
check(API.call_host(API.with_recovery(widen, interval(1, 3))) == 3,
      "valid host reply")
before = $calls
reject(TypeError) { API.call_host(widen) }
check($calls == before, "missing recovery stops callback")
reject(API::LeanBridgeError) do
  API.call_host(API.with_recovery(widen, interval(3, 1)))
end
check($calls == before, "invalid recovery stops callback")
reject(API::LeanBridgeError) do
  API.call_host(API.with_recovery(proc { interval(5, 2) }, interval(1, 3)))
end
check($calls == before, "invalid host reply calls once outside counted callback")
check(API.call_host(API.with_recovery(widen, interval(1, 3))) == 3,
      "host recovery reuse")

sentinel = Class.new(StandardError).new("callback failed")
caught = reject { API.call_host(API.with_recovery(proc { raise sentinel }, interval(1, 3))) }
check(caught.equal?(sentinel), "callback exception identity")
check(API.call_host_mixed(API.with_recovery(
  proc { |marker, value| interval(value.lo, value.hi + marker - 5) },
  interval(1, 3)
)) == 4, "mixed host reply")

closure = API.make_closure(9)
check(closure.call(interval(2, 5)) == 3, "closure result")
reject(API::LeanBridgeError) { closure.call(interval(5, 2)) }
check(closure.call(interval(3, 3)) == 0, "closure recovery")
closure.close
closure.close
check(closure.closed?, "closure closes idempotently")

mixed = API.make_mixed_closure(0)
check(mixed.call(9, interval(2, 5)) == interval(2, 5), "mixed closure result")
reject(API::LeanBridgeError) { mixed.call(9, interval(5, 2)) }
check(mixed.call(9, interval(3, 4)) == interval(3, 4), "mixed closure recovery")
mixed.close

container = API.call_host_container(API.with_recovery(
  proc { |value| value.nil? ? API::Ok.new(API::Some.new(interval(1, 4))) : API::Err.new("unexpected") },
  API::Ok.new(nil)
))
check(container == 3, "container host reply")
reject(API::LeanBridgeError) do
  API.call_host_container(API.with_recovery(
    proc { API::Ok.new(API::Some.new(interval(4, 1))) }, API::Ok.new(nil)
  ))
end
container_closure = API.make_container_closure(0)
check(container_closure.call([nil, API::Some.new(interval(2, 5))]).nil?,
      "container closure result")
reject(API::LeanBridgeError) do
  container_closure.call([API::Some.new(interval(5, 2))])
end
check(container_closure.call([]).nil?, "container closure recovery")
container_closure.close

reply = [2, 5]
reweigh = proc do |value|
  $calls += 1
  check(value == weighted(1, 2), "proof-free weighted argument")
  weighted(*reply)
end
check(API.call_host_nested(API.with_recovery(
  reweigh, weighted(1, 2)
)) == 3, "weighted host reply")
reply.replace([0, 5])
reject(API::LeanBridgeError) do
  API.call_host_nested(API.with_recovery(reweigh, weighted(1, 2)))
end
reply.replace([6, 5])
reject(API::LeanBridgeError) do
  API.call_host_nested(API.with_recovery(reweigh, weighted(1, 2)))
end
before = $calls
reject(API::LeanBridgeError) do
  API.call_host_nested(API.with_recovery(reweigh, weighted(0, 2)))
end
check($calls == before, "invalid weighted recovery stops callback")
reply.replace([2, 5])
check(API.call_host_nested(API.with_recovery(
  reweigh, weighted(1, 2)
)) == 3, "weighted host recovery")

nested = API.make_nested_closure(0)
check(nested.call(weighted(2, 5)) == 3, "weighted closure result")
reject(API::LeanBridgeError) { nested.call(weighted(0, 5)) }
reject(API::LeanBridgeError) { nested.call(weighted(6, 5)) }
check(nested.call(weighted(5, 5)) == 0, "weighted closure recovery")
nested.close

puts "callback-checked-record-language-ok:#{$checks}"
