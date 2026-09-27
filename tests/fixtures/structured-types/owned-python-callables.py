import ctypes as _c
import dataclasses
import gc
import json
import sys
import lean_owned_aggregates as api
from lean_owned_aggregates import _native as n, _owned as r

library = _c.CDLL(sys.argv[1])
runtime = r._OwnedRuntime(library)
n._bind(runtime)

def native(name, arguments, result=_c.c_size_t):
    function = library[name]
    function.argtypes = arguments
    function.restype = result
    return function

live = native("owned_test_live", [])
identities = native("owned_test_identities", [])
native_fail = native("owned_test_fail_after", [_c.c_ssize_t], None)
checks = 0

def check(value):
    global checks
    assert value
    checks += 1

def rejected(kind, action, status=None):
    try:
        action()
    except kind as error:
        check(status is None or error.status == status)
    else:
        raise AssertionError("Expected " + str(kind))

first = api.new_ticket(1, "first")
second = api.new_ticket(2, "second")
bundle = api.Bundle(first, api.Some(second), (first, second), (second,), api.Payload(-3, b"abc"))
state = runtime.current_state()
escaped = []
retained = []

def borrow(value):
    escaped.append(value.primary)
    retained.append(value.primary.retain())
    return dataclasses.replace(value, primary=api.new_ticket(91, "local"),
                               payload=api.Payload(7, b"reply"))

result = api.callback_record(bundle, borrow)
check(escaped[0].is_closed)
rejected(r.LeanBridgeError, lambda: api.serial(escaped[0]), 4)
check(api.serial(retained[0]) == 1)
check(api.serial(result.primary) == 91)
check(result.payload == api.Payload(7, b"reply"))
result = None
retained[0].close()
check(api.callback_record(bundle, lambda value: value) == bundle)

class CallbackError(Exception):
    pass

sentinel = CallbackError("original callback exception")
def fail(value):
    escaped.append(value.primary)
    raise sentinel

try:
    api.callback_record(bundle, fail)
except CallbackError as error:
    check(error is sentinel)
else:
    raise AssertionError("Callback exception was swallowed")
check(escaped[-1].is_closed)
check(api.echo_record(bundle) == bundle)

def nested(value):
    try:
        api.callback_record(value, fail)
    except CallbackError as error:
        check(error is sentinel)
    return api.echo_record(value)

check(api.callback_record(bundle, nested) == bundle)
count = 0
def mutable(value):
    global count
    count += 1
    return dataclasses.replace(value, payload=api.Payload(count, b"count"))

check(api.twice(bundle, mutable).payload.count == 2)
dispatcher = api.dispatch(bundle)
check(dispatcher(mutable).payload.count == 3)
identity = api.identity_closure(None)
check(dispatcher(identity) == bundle)
check(api.callback_record(bundle, identity) == bundle)
kept = api.retain_callback(identity)
identity.close()
check(kept(bundle) == bundle)
expired = api.retain_callback(lambda value: value)
rejected(r.LeanBridgeError, lambda: expired(bundle), 10)
expired.close()
kept.close()
def close_active(value):
    dispatcher.close()
    return value
check(dispatcher(close_active) == bundle)
rejected(r.LeanBridgeError, lambda: dispatcher(lambda value: value), 4)

rejected(TypeError, lambda: api.factory(lambda unit: first))
rejected(TypeError, lambda: api.factory(api.with_recovery(lambda unit: first, bundle)))
made = api.factory(api.with_recovery(lambda unit: api.new_ticket(92, "factory"), first))
check(api.serial(made) == 92)
made.close()
def fail_factory(unit):
    raise sentinel
try:
    api.factory(api.with_recovery(fail_factory, first))
except CallbackError as error:
    check(error is sentinel)
else:
    raise AssertionError("Recovery was published as a successful result")
check(api.construct(first, lambda ticket: dataclasses.replace(bundle, primary=ticket)) == bundle)

tree = api.TreeBranch((api.TreeLeaf(first), api.TreeLeaf(second)))
check(api.callback_recursive(tree, lambda value: value) == tree)
chooser = api.make_recursive(tree)
check(chooser(True, api.TreeBranch(())) == tree)
check(chooser(False, api.TreeBranch(())) == api.TreeBranch(()))
chooser.close()

async def asynchronous(value):
    return value
class AsyncCallable:
    async def __call__(self, value):
        return value
async def asynchronous_generator(value):
    yield value
for function in [asynchronous, AsyncCallable(), asynchronous_generator, None, 7]:
    rejected(TypeError, lambda: api.callback_record(bundle, function))
rejected(TypeError, lambda: api.callback_record(bundle, lambda value: asynchronous(value)))
rejected(TypeError, lambda: api.callback_record(bundle, lambda value: value.primary))

calls = 0
def repeated(value):
    global calls
    calls += 1
    return value
rejected(r.LeanBridgeError, lambda: api.repeatedly(bundle, repeated, 10000), 2)
check(1 < calls < 10000)
check(api.callback_record(bundle, lambda value: value) == bundle)

# Keep exceptions and their partial wrappers alive while testing cleanup.
failures = []
gc.collect()
baseline = live(), identities()
checkpoint = r._owned_checkpoint
python_checkpoints = 0
def count_python():
    global python_checkpoints
    python_checkpoints += 1
r._owned_checkpoint = count_python
try:
    result = api.callback_record(bundle, lambda value: value)
    check(result == bundle)
finally:
    r._owned_checkpoint = checkpoint
result = None
check((live(), identities()) == baseline)
check(20 < python_checkpoints < 1024)
python_faults = 0
for point in range(python_checkpoints + 1):
    remaining = point
    def fail_python():
        global remaining
        if remaining == 0:
            raise MemoryError("injected owned callback allocation failure")
        remaining -= 1
    r._owned_checkpoint = fail_python
    try:
        result = api.callback_record(bundle, lambda value: value)
    except MemoryError as error:
        check(point < python_checkpoints)
        failures.append(error)
        python_faults += 1
        check((live(), identities()) == baseline)
    else:
        check(point == python_checkpoints)
        check(result == bundle)
        result = None
    finally:
        r._owned_checkpoint = checkpoint
check(python_faults == python_checkpoints)

native_faults = 0
for point in range(1024):
    native_fail(point)
    try:
        result = api.callback_record(bundle, lambda value: value)
    except r.LeanBridgeError as error:
        failures.append(error)
        check(error.status == 3)
        native_faults += 1
        check((live(), identities()) == baseline)
    else:
        check(result == bundle)
        result = None
        break
    finally:
        native_fail(-1)
check(20 < native_faults < 1024)
check((live(), identities()) == baseline)
state.close()
check(live() == 0)
check(identities() == 0)
print(json.dumps({"checks": checks, "pythonFaults": python_faults,
                  "pythonCheckpoints": python_checkpoints, "nativeFaults": native_faults,
                  "live": live(), "identities": identities(), "boundedInvocations": calls}))
