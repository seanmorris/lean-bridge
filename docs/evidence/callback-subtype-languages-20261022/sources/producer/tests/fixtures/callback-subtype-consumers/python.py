"""Installed Python acceptance for directional callback Subtypes."""
import lean_callbacksubtypes as api


checks = 0
calls = 0
rejections = 0


def check(value, label):
    global checks
    if not value:
        raise AssertionError(label)
    checks += 1


def reject(operation, kind=Exception):
    global rejections
    try:
        operation()
    except kind as error:
        rejections += 1
        return error
    raise AssertionError("expected rejection")


def increment(value):
    global calls
    calls += 1
    return value + 1


check(api.call_host(api.with_recovery(increment, 1)) == 2, "valid host result")
before = calls
reject(lambda: api.call_host(increment), TypeError)
check(calls == before, "missing recovery stops callback")
reject(lambda: api.call_host(api.with_recovery(increment, 0)), api.LeanBridgeError)
check(calls == before, "invalid recovery stops callback")
error = reject(lambda: api.call_host(api.with_recovery(lambda _value: 0, 1)), api.LeanBridgeError)
check(error.status == 1, "invalid host result status")

sentinel = RuntimeError("callback failed")
def fail(_value):
    raise sentinel
check(reject(lambda: api.call_host(api.with_recovery(fail, 1))) is sentinel,
      "callback exception identity")
check(api.call_host(api.with_recovery(lambda value: value, 1)) == 1,
      "host recovery reuse")
check(api.call_host_mixed(api.with_recovery(lambda marker, value: marker - 5 + value, 1)) == 3,
      "mixed host result")

closure = api.make_closure(9)
check(closure(2) == 2, "closure result")
reject(lambda: closure(0), api.LeanBridgeError)
check(closure(3) == 3, "closure recovery")
closure.close()
closure.close()
check(closure.closed, "closure closes idempotently")

mixed = api.make_mixed_closure(0)
check(mixed(9, 2) == 2, "mixed closure result")
reject(lambda: mixed(9, 0), api.LeanBridgeError)
check(mixed(9, 3) == 3, "mixed closure recovery")
mixed.close()

nested = api.call_host_container(api.with_recovery(
    lambda value: api.Ok(api.Some(2)) if value is None else api.Err("unexpected"),
    api.Ok(api.Some(1))))
check(type(nested) is api.Ok and type(nested.value) is api.Some
      and nested.value.value == 2, "nested host result")
container = api.make_container_closure(0)
check(container([None]) is None, "nested closure result")
reject(lambda: container([api.Some(0)]), api.LeanBridgeError)
check(container([]) is None, "nested closure recovery")
container.close()

print(f"callback-subtype-language-ok:{checks}")
