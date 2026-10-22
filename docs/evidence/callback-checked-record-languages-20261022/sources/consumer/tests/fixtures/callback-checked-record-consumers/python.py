"""Installed Python acceptance for directional callback checked records."""
import lean_callbackcheckedrecords as api


checks = 0
calls = 0


def check(value, label):
    global checks
    if not value:
        raise AssertionError(label)
    checks += 1


def reject(operation, kind=Exception):
    try:
        operation()
    except kind as error:
        return error
    raise AssertionError("expected rejection")


def interval(lo, hi):
    return api.Interval(lo, hi)


def weighted(weight, limit):
    return api.Weighted(weight, limit)


def widen(value):
    global calls
    calls += 1
    check(value == interval(1, 3), "proof-free host argument")
    return interval(1, 4)


check(api.call_host(api.with_recovery(widen, interval(1, 3))) == 3,
      "valid host reply")
before = calls
reject(lambda: api.call_host(widen), TypeError)
check(calls == before, "missing recovery stops callback")
reject(lambda: api.call_host(api.with_recovery(widen, interval(3, 1))),
       api.LeanBridgeError)
check(calls == before, "invalid recovery stops callback")
reject(lambda: api.call_host(api.with_recovery(
    lambda _value: interval(5, 2), interval(1, 3))), api.LeanBridgeError)
check(calls == before, "invalid host reply calls once outside counted callback")
check(api.call_host(api.with_recovery(widen, interval(1, 3))) == 3,
      "host recovery reuse")

sentinel = RuntimeError("callback failed")
def fail(_value):
    raise sentinel
check(reject(lambda: api.call_host(api.with_recovery(
    fail, interval(1, 3)))) is sentinel, "callback exception identity")

check(api.call_host_mixed(api.with_recovery(
    lambda marker, value: interval(value.lo, value.hi + marker - 5),
    interval(1, 3))) == 4, "mixed host reply")

closure = api.make_closure(9)
check(closure(interval(2, 5)) == 3, "closure result")
reject(lambda: closure(interval(5, 2)), api.LeanBridgeError)
check(closure(interval(3, 3)) == 0, "closure recovery")
closure.close()
closure.close()
check(closure.closed, "closure closes idempotently")

mixed = api.make_mixed_closure(0)
check(mixed(9, interval(2, 5)) == interval(2, 5), "mixed closure result")
reject(lambda: mixed(9, interval(5, 2)), api.LeanBridgeError)
check(mixed(9, interval(3, 4)) == interval(3, 4), "mixed closure recovery")
mixed.close()

container = api.call_host_container(api.with_recovery(
    lambda value: api.Ok(api.Some(interval(1, 4))) if value is None
    else api.Err("unexpected"), api.Ok(None)))
check(container == 3, "container host reply")
reject(lambda: api.call_host_container(api.with_recovery(
    lambda _value: api.Ok(api.Some(interval(4, 1))), api.Ok(None))),
       api.LeanBridgeError)
container_closure = api.make_container_closure(0)
check(container_closure([None, api.Some(interval(2, 5))]) is None,
      "container closure result")
reject(lambda: container_closure([api.Some(interval(5, 2))]),
       api.LeanBridgeError)
check(container_closure([]) is None, "container closure recovery")
container_closure.close()

reply = [2, 5]
def reweigh(value):
    global calls
    calls += 1
    check(value == weighted(1, 2), "proof-free weighted argument")
    return weighted(*reply)


check(api.call_host_nested(api.with_recovery(
    reweigh, weighted(1, 2))) == 3, "weighted host reply")
reply[:] = [0, 5]
reject(lambda: api.call_host_nested(api.with_recovery(
    reweigh, weighted(1, 2))), api.LeanBridgeError)
reply[:] = [6, 5]
reject(lambda: api.call_host_nested(api.with_recovery(
    reweigh, weighted(1, 2))), api.LeanBridgeError)
before = calls
reject(lambda: api.call_host_nested(api.with_recovery(
    reweigh, weighted(0, 2))), api.LeanBridgeError)
check(calls == before, "invalid weighted recovery stops callback")
reply[:] = [2, 5]
check(api.call_host_nested(api.with_recovery(
    reweigh, weighted(1, 2))) == 3, "weighted host recovery")

nested = api.make_nested_closure(0)
check(nested(weighted(2, 5)) == 3, "weighted closure result")
reject(lambda: nested(weighted(0, 5)), api.LeanBridgeError)
reject(lambda: nested(weighted(6, 5)), api.LeanBridgeError)
check(nested(weighted(5, 5)) == 0, "weighted closure recovery")
nested.close()

print(f"callback-checked-record-language-ok:{checks}")
