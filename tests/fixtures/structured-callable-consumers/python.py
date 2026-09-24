"""Public, source-free installed-wheel structured callback acceptance."""
import concurrent.futures
import copy
import dataclasses
import gc
import json
import os
import pickle
import runpy
import signal
import sys
import threading
import typing
import warnings
import weakref

import lean_structured as api

values = runpy.run_path("python-values.py")
SHAPES, payload, owned = (values[name] for name in ("SHAPES", "payload", "owned"))
checks = calls = rejected = 0
count_lock = threading.Lock()


def check(condition):
    global checks
    with count_lock:
        checks += 1
        number = checks
    if not condition:
        raise AssertionError(f"check {number} failed")


def same(actual, expected):
    check(type(actual) is type(expected))
    check(actual == expected)
    if type(expected) is tuple:
        for left, right in zip(actual, expected):
            same(left, right)
    elif dataclasses.is_dataclass(expected):
        for field in dataclasses.fields(expected):
            same(getattr(actual, field.name), getattr(expected, field.name))


def rejects(exception, function):
    global rejected
    try:
        function()
    except exception as failure:
        with count_lock:
            rejected += 1
        return failure
    raise AssertionError(f"Expected {exception}")


class Marker(BaseException):
    pass


for shape in SHAPES:
    call, twice, make = (getattr(api, action + "_" + shape) for action in ("call", "twice", "make"))
    for seed in range(24):
        value, other = payload(shape, seed), payload(shape, seed + 1)
        expected, replacement = owned(value), owned(other)
        seen = []

        def callback(item):
            same(item, expected)
            seen.append(item)
            return other

        same(call(value, callback), replacement)
        calls += 1
        check(len(seen) == 1)
        # Host callback arguments outlive the native call and their input buffers.
        gc.collect()
        same(seen[0], expected)
        seen.clear()

        def alternating(item):
            same(item, expected if not seen else replacement)
            seen.append(item)
            return other if len(seen) == 1 else value

        same(twice(value, alternating), expected)
        calls += 1
        check(len(seen) == 2)
        with make(value) as closure, make(other) as second:
            check(isinstance(closure, api.LeanClosure) and not closure.closed)
            same(closure(True, other), expected)
            same(closure(False, other), replacement)
            same(second(True, value), replacement)
            same(second(False, value), expected)
            calls += 6
        check(closure.closed and second.closed)
        closure.close()
        rejects(RuntimeError, lambda: closure(True, other))

    value = payload(shape, 1)
    marker, invoked = Marker(shape), []

    def fail(item):
        invoked.append(item)
        raise marker

    check(rejects(Marker, lambda: twice(value, fail)) is marker)
    check(len(invoked) == 1)
    same(call(value, lambda item: item), owned(value))

    def nested(item):
        check(rejects(Marker, lambda: call(item, fail)) is marker)
        return call(item, lambda inner: inner)

    same(twice(value, nested), owned(value))
    with make(value) as closure:
        same(call(value, lambda item: closure(True, item)), owned(value))
        for operation in (copy.copy, copy.deepcopy, pickle.dumps):
            rejects(TypeError, lambda: operation(closure))
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as worker:
            failure = worker.submit(lambda: rejects(RuntimeError, lambda: closure(True, value))).result()
            check("creating thread" in str(failure))
    for bad in (object(), {"untyped": value}):
        invoked.clear()
        rejects((TypeError, ValueError), lambda: call(bad, lambda item: invoked.append(item)))
        check(not invoked)
        rejects((TypeError, ValueError), lambda: call(value, lambda _: bad))
        with make(value) as closure:
            rejects((TypeError, ValueError), lambda: closure(False, bad))
        same(call(value, lambda item: item), owned(value))

# Invalid values must fail inside nested payloads, not only at their outer shell.
invalid = {
    "array": [[api.Some("ok"), api.Some(b"wrong")], [api.Some("\ud800")]],
    "list": [[api.Ok((1, "ok")), api.Ok((True, "wrong"))], [api.Err(b"wrong")]],
    "option": [api.Some(api.Some(1)), api.Some(0)],
    "result": [api.Ok(api.Some(-1)), api.Err(["ok", b"wrong"])],
    "tuple": [("ok", (bytearray(b"wrong"), 1)), ("ok", (b"", -1))],
    "record": [api.Payload("ok", [api.Some(b"wrong")], 1, None),
               api.Payload("ok", [], 1, api.Some(api.Ok((2**64, None))))],
    "variant": [api.PacketPayload("ok", [api.Some(b"wrong")]), api.PacketCounts(-1, 0)],
    "alias": [api.Payload("ok", [], True, None), api.Payload("ok", [], 1, api.Some(api.Err(b"wrong")))],
}
for shape, bad_values in invalid.items():
    call, make = (getattr(api, action + "_" + shape) for action in ("call", "make"))
    value = payload(shape, 1)
    for bad in bad_values:
        hits = []
        rejects((TypeError, ValueError), lambda: call(bad, lambda item: hits.append(item)))
        check(not hits)
        rejects((TypeError, ValueError), lambda: call(value, lambda _: bad))
        with make(value) as closure:
            rejects((TypeError, ValueError), lambda: closure(False, bad))
        same(call(value, lambda item: item), owned(value))

# Captured nested lists are copied before the caller can mutate them.
record = payload("record", 1)
expected = owned(record)
with api.make_record(record) as closure:
    record.rows.clear()
    gc.collect()
    same(closure(True, payload("record", 2)), expected)
check(api.Alias is api.Payload)

# A host callback cannot escape through a returned Lean closure.
for _ in range(8):
    with api.retain_record(lambda value: value) as escaped:
        rejects(api.LeanBridgeError, lambda: escaped(payload("record", 1)))
        same(api.call_record(payload("record", 2), lambda item: item), owned(payload("record", 2)))
        rejects(api.LeanBridgeError, lambda: escaped(payload("record", 1)))
marker = Marker("after failure")


def fail_record(_):
    raise marker


check(rejects(Marker, lambda: api.after_failure(payload("record", 1), fail_record)) is marker)
check(api.after_failure(payload("record", 2), lambda item: item) == payload("record", 2).text)


async def asynchronous(value):
    return value


rejects(TypeError, lambda: api.call_array([], asynchronous))
rejects(TypeError, lambda: api.call_array([], lambda value: asynchronous(value)))
rejects(TypeError, lambda: api.call_array([], 42))
rejects(TypeError, api.LeanClosure)
rejects(ValueError, lambda: api.call_array([], lambda _: [api.Some("x" * (16 * 1024 * 1024))]))
rejects(ValueError, lambda: api.twice_array([api.Some("x" * 1_500_000)], lambda item: item))
same(api.call_array([api.Some("ok")], lambda item: item), (api.Some("ok"),))


class Identity:
    def __call__(self, value):
        gc.collect()
        return value


identity = Identity()
reference = weakref.ref(identity)
same(api.call_record(payload("record", 1), identity), owned(payload("record", 1)))
del identity
gc.collect()
check(reference() is None)
closure = api.make_record(payload("record", 1))
reference = weakref.ref(closure)
del closure
gc.collect()
check(reference() is None)


def independent_thread(seed):
    for shape in SHAPES:
        value = payload(shape, seed)
        call, make = (getattr(api, action + "_" + shape) for action in ("call", "make"))
        with make(value) as closure:
            same(closure(True, value), owned(value))
            same(call(value, lambda item: item), owned(value))
    return True


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as workers:
    check(all(workers.map(independent_thread, range(12))))

# Post-fork rejection happens before entering the inherited runtime.
with api.make_record(payload("record", 1)) as closure:
    with warnings.catch_warnings(record=True) as fork_warnings:
        warnings.simplefilter("always")
        child = os.fork()
    if child == 0:
        signal.alarm(5)
        try:
            rejects(RuntimeError, lambda: closure(True, payload("record", 2)))
            rejects(RuntimeError, closure.close)
            rejects(RuntimeError, lambda: api.call_array([], lambda item: item))
        except BaseException:
            os._exit(1)
        os._exit(0)
    check(os.waitpid(child, 0)[1] == 0)
    check(len(fork_warnings) == (1 if sys.version_info >= (3, 12) else 0)
          and all(warning.category is DeprecationWarning and str(warning.message) == (
              f"This process (pid={os.getpid()}) is multi-threaded, "
              "use of fork() may lead to deadlocks in the child."
          ) for warning in fork_warnings))
    same(closure(True, payload("record", 2)), owned(payload("record", 1)))

for shape in SHAPES:
    for action in ("call", "twice", "make"):
        check(bool(typing.get_type_hints(getattr(api, action + "_" + shape))))
print(json.dumps({"checks": checks, "calls": calls, "rejected": rejected,
                  "shapes": list(SHAPES)}, sort_keys=True))
