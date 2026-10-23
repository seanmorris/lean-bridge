# Installed Ruby acceptance for directional callback Subtypes.
require "lean_bridge/callbacksubtypes"
API = LeanBridge::Callbacksubtypes
$checks = 0
$calls = 0
$rejections = 0

def check(value, label)
  raise label unless value
  $checks += 1
end

def reject(kind = Exception)
  yield
  raise "expected rejection"
rescue kind => error
  $rejections += 1
  error
end

increment = proc { |value| $calls += 1; value + 1 }
check(API.call_host(API.with_recovery(increment, 1)) == 2, "valid host result")
before = $calls
reject(TypeError) { API.call_host(increment) }
check($calls == before, "missing recovery stops callback")
reject(API::LeanBridgeError) { API.call_host(API.with_recovery(increment, 0)) }
check($calls == before, "invalid recovery stops callback")
error = reject(API::LeanBridgeError) { API.call_host(API.with_recovery(proc { 0 }, 1)) }
check(error.status == 1, "invalid host result status")

sentinel = Class.new(StandardError).new("callback failed")
caught = reject { API.call_host(API.with_recovery(proc { raise sentinel }, 1)) }
check(caught.equal?(sentinel), "callback exception identity")
check(API.call_host(API.with_recovery(proc { |value| value }, 1)) == 1, "host recovery reuse")
check(API.call_host_mixed(API.with_recovery(proc { |marker, value| marker - 5 + value }, 1)) == 3,
      "mixed host result")

closure = API.make_closure(9)
check(closure.call(2) == 2, "closure result")
reject(API::LeanBridgeError) { closure.call(0) }
check(closure.call(3) == 3, "closure recovery")
closure.close
closure.close
check(closure.closed?, "closure closes idempotently")

mixed = API.make_mixed_closure(0)
check(mixed.call(9, 2) == 2, "mixed closure result")
reject(API::LeanBridgeError) { mixed.call(9, 0) }
check(mixed.call(9, 3) == 3, "mixed closure recovery")
mixed.close

nested = API.call_host_container(API.with_recovery(
  proc { |value| value.nil? ? API::Ok.new(API::Some.new(2)) : API::Err.new("unexpected") },
  API::Ok.new(API::Some.new(1))))
check(nested.instance_of?(API::Ok) && nested.value.instance_of?(API::Some) && nested.value.value == 2,
      "nested host result")
container = API.make_container_closure(0)
check(container.call([nil]).nil?, "nested closure result")
reject(API::LeanBridgeError) { container.call([API::Some.new(0)]) }
check(container.call([]).nil?, "nested closure recovery")
container.close

puts "callback-subtype-language-ok:#{$checks}"
