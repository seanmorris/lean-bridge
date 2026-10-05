import copy
import ctypes as c
import dataclasses
import gc
import json
import math
import os
import sys
import threading
import warnings
import lean_owned_aggregates as api
from lean_owned_aggregates import _native as n, _owned as r

library = c.CDLL(sys.argv[1])
runtime = r._OwnedRuntime(library)
n._bind(runtime)

def native(name, arguments, result=c.c_size_t):
    function = library[name]
    function.argtypes = arguments
    function.restype = result
    return function

live = native("owned_test_live", [])
identities = native("owned_test_identities", [])
handoffs = native("owned_test_handoffs", [])
native_fail = native("owned_test_fail_after", [c.c_ssize_t], None)
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

def resources(value):
    if isinstance(value, r._OwnedResource):
        yield value
    elif dataclasses.is_dataclass(value):
        for field in dataclasses.fields(value):
            yield from resources(getattr(value, field.name))
    elif type(value) in (list, tuple):
        for item in value:
            yield from resources(item)

def close(value):
    for resource in resources(value):
        resource.close()

def semantic(value):
    if type(value) is api.Ticket:
        return ("Ticket", api.serial(value), api.label(value))
    if dataclasses.is_dataclass(value):
        return (type(value).__name__, tuple(semantic(getattr(value, field.name))
                                          for field in dataclasses.fields(value)))
    if type(value) in (list, tuple):
        return tuple(semantic(item) for item in value)
    return value

def ticket(number=17):
    return api.new_ticket(number, "native\0🙂")

def bundle():
    first, second = ticket(), ticket(23)
    return api.Bundle(first, api.Some(second), [first, second], (second,),
                      api.Payload(-(1 << 130), b"\x00\x7f\x80\xff"))

state = runtime.current_state()
baseline = live(), identities()

first = ticket()
alias, independent = copy.copy(first), first.retain()
received = api.retain_ticket(first)
check(first.is_closed and alias.is_closed)
check(api.serial(received) == api.serial(independent) == 17)
rejected(r.LeanBridgeError, lambda: api.serial(alias), 4)
close((first, alias, received, independent))
check((live(), identities()) == baseline)

# Moving a single leaf closes sibling wrappers sharing the original result.
original = api.echo_record(bundle())
sibling = copy.copy(original.spare.value)
independent = sibling.retain()
received = api.retain_ticket(original.primary)
check(all(value.is_closed for value in resources(original)))
check(sibling.is_closed and api.serial(independent) == 23)
close((original, sibling, independent, received))
check((live(), identities()) == baseline)

def chain(depth=30):
    value = api.ChainStop()
    for index in range(depth):
        value = api.ChainLink(ticket(index), api.Some(value))
    return value

def tree(depth=40):
    value = api.TreeLeaf(ticket())
    for _ in range(depth):
        value = api.TreeBranch((value,))
    return value

def mixed(error=False):
    first = ticket()
    return api.Mixed(first, (None, api.Some(None), api.Some(api.Some(False)),
                             api.Some(api.Some(True))), api.Some(None),
                     api.Err(ticket(31)) if error else api.Ok(bundle()),
                     -(1 << 180), 1 << 200, "🙂", -0.0, float("inf"),
                     b"\x00\x7f\x80\xff", (0, (1 << 64) - 1),
                     (first, (api.Some(ticket(32)), api.Payload(-2, b"tuple"))),
                     chain(3))

cases = [
    (api.echo_array, lambda: [ticket(), ticket(2)]),
    (api.echo_array, lambda: []),
    (api.echo_list, lambda: [ticket(), ticket(2)]),
    (api.echo_list, lambda: ()),
    (api.echo_option, lambda: api.Some(ticket())),
    (api.echo_option, lambda: None),
    (api.echo_result, lambda: api.Ok(bundle())),
    (api.echo_result, lambda: api.Err(ticket())),
    (api.echo_tuple, lambda: (ticket(), (api.Some(ticket(2)), api.Payload(-1, b"p")))),
    (api.echo_record, bundle), (api.echo_alias, bundle),
    (api.echo_variant, lambda: api.ChoiceEmpty()),
    (api.echo_variant, lambda: api.ChoiceOne(ticket())),
    (api.echo_variant, lambda: api.ChoicePair(ticket(), ticket(2))),
    (api.echo_variant, lambda: api.ChoiceMany((ticket(), ticket(2)))),
    (api.echo_variant, lambda: api.ChoiceMany(())),
    (api.echo_row, lambda: (None, api.Some(ticket()), None)),
    (api.echo_recursive, tree),
    (api.echo_recursive, lambda: api.TreeBranch(())),
    (api.echo_nested, lambda: ((), (None, api.Some(api.Ok(bundle())),
                                   api.Some(api.Err(ticket()))))),
    (api.echo_chain, chain), (api.echo_chain, lambda: api.ChainStop()),
    (api.echo_chain, lambda: api.ChainLink(ticket(), None)),
    (api.echo_mixed, mixed), (api.echo_mixed, lambda: mixed(True)),
]
for function, make in cases:
    value = make()
    before = semantic(value)
    leaves = tuple(resources(value))
    received = function(value)
    check(semantic(received) == before)
    check(all(leaf.is_closed for leaf in leaves))
    if function is api.echo_mixed:
        check(math.copysign(1, received.precise) == -1)
        check(math.isinf(received.approximate))
    close((value, received))
    check((live(), identities()) == baseline)

value = ticket()
received = api.echo_array([value, value, copy.copy(value)])
check(value.is_closed and all(api.serial(item) == 17 for item in received))
close(received)

first, second = ticket(), ticket(29)
received = api.bundle(first, None, [second], (), api.Payload(5, b"two"))
check(first.is_closed and second.is_closed)
check(api.serial(received.primary) == 17 and api.serial(received.peers[0]) == 29)
close(received)

# A repeated owner across consuming parameters is rejected before handoff.
first = ticket()
before = handoffs()
rejected(r.LeanBridgeError, lambda: api.bundle(first, None, [first], (), api.Payload(0, b"")), 1)
check(handoffs() == before and not first.is_closed)
rejected(TypeError, lambda: api.bundle(first, None, [], (), api.Payload(True, b"")))
check(handoffs() == before and api.serial(first) == 17)
first.close()

value = tree(130)
before = handoffs()
rejected(r.LeanBridgeError, lambda: api.echo_recursive(value), 2)
check(handoffs() == before and all(not item.is_closed for item in resources(value)))
close(value)
first = ticket()
cyclic = []
loop = api.TreeBranch(cyclic)
cyclic.append(loop)
rejected(ValueError, lambda: api.echo_recursive(loop))
first.close()

# Callbacks observe consumed caller aliases, but receive live scoped borrows.
value = bundle()
aliases = tuple(copy.copy(item) for item in resources(value))
escaped, retained = [], []
def callback(incoming):
    check(all(item.is_closed for item in aliases))
    check(api.serial(incoming.primary) == 17)
    escaped.append(copy.copy(incoming.primary))
    rejected(r.LeanBridgeError, lambda: api.retain_ticket(incoming.primary), 1)
    owned = incoming.primary.retain()
    retained.append(api.retain_ticket(owned))
    check(owned.is_closed)
    local = api.echo_record(bundle())
    check(api.serial(local.primary) == 17)
    close(local)
    return incoming
received = api.callback_record(value, callback)
check(escaped[0].is_closed and api.serial(retained[0]) == 17)
close((value, aliases, escaped, retained, received))

class CallbackError(BaseException):
    pass

sentinel = CallbackError("same exception object")
value = bundle()
def fail(incoming):
    check(value.primary.is_closed)
    raise sentinel
try:
    api.callback_record(value, fail)
except CallbackError as error:
    check(error is sentinel and value.primary.is_closed)
else:
    raise AssertionError("Callback exception was swallowed")
close(value)

value = tree(3)
received = api.callback_recursive(value, lambda item: item)
check(all(item.is_closed for item in resources(value)))
close(received)

for create, make in [(api.make_record, bundle), (api.make_recursive, lambda: tree(3))]:
    value = make()
    expected = semantic(value)
    closure = create(value)
    check(all(item.is_closed for item in resources(value)))
    supplied = make()
    received = closure(True, supplied)
    check(semantic(received) == expected)
    check(all(not item.is_closed for item in resources(supplied)))
    close((value, supplied, received, closure))

closure = api.new_record_callback()
alias, independent = copy.copy(closure), closure.retain()
received = api.transfer_callback(closure)
check(closure.is_closed and alias.is_closed and not independent.is_closed)
value = bundle()
result = received(value)
check(semantic(result) == semantic(value))
close((result, value, closure, alias, received, independent))

value = ticket()
thread_results = []
def other_thread():
    try:
        api.retain_ticket(value)
    except r.LeanBridgeError as error:
        thread_results.append(error.status)
thread = threading.Thread(target=other_thread)
thread.start()
thread.join()
check(thread_results == [5] and not value.is_closed)
with warnings.catch_warnings(record=True) as fork_warnings:
    warnings.simplefilter("always", DeprecationWarning)
    pid = os.fork()
if pid == 0:
    try:
        api.retain_ticket(value)
    except r.LeanBridgeError as error:
        os._exit(0 if error.status == 6 else 2)
    os._exit(3)
check(os.waitpid(pid, 0)[1] == 0)
check(all(item.category is DeprecationWarning and
          "multi-threaded, use of fork() may lead to deadlocks" in str(item.message)
          for item in fork_warnings))
value.close()
check((live(), identities()) == baseline)

# Keep failures and their tracebacks alive. Cleanup must not depend on GC.
failures = []
checkpoint = r._owned_checkpoint
counts = dict.fromkeys(("pythonBefore", "pythonAfter", "nativeBefore", "nativeAfter",
                        "multiPythonBefore", "multiPythonAfter", "multiNativeBefore",
                        "multiNativeAfter"), 0)
for multiple in (False, True):
    for allocator in ("python", "native"):
        for point in range(1024):
            first, second = ticket(), ticket(2)
            independent = first.retain()
            value = api.Bundle(first, None, [second], (), api.Payload(-1, b"fault"))
            before = handoffs()
            remaining = point
            def fail_python():
                global remaining
                if remaining == 0:
                    raise MemoryError("injected Python transfer failure")
                remaining -= 1
            if allocator == "python":
                r._owned_checkpoint = fail_python
            else:
                native_fail(point)
            succeeded = False
            try:
                if multiple:
                    result = api.bundle(first, None, [second], (), value.payload)
                else:
                    result = api.callback_record(value, lambda incoming: incoming)
                succeeded = True
            except (MemoryError, r.LeanBridgeError) as error:
                check(type(error) is MemoryError or error.status == 3)
                failures.append(error)
                moved = handoffs() > before
                key = ("multi" + allocator.capitalize() if multiple else allocator)
                counts[key + ("After" if moved else "Before")] += 1
            finally:
                r._owned_checkpoint = checkpoint
                native_fail(-1)
            moved = handoffs() > before
            check(first.is_closed == moved and second.is_closed == moved)
            check(api.serial(independent) == 17)
            if succeeded:
                check(api.serial(result.primary) == 17)
                close(result)
            close((value, first, second, independent))
            assert (live(), identities()) == baseline, (
                multiple, allocator, point, moved, succeeded, live(), identities(),
                [(bool(slot.value.value), slot.pending) for slot in state.slots])
            check((live(), identities()) == baseline)
            if succeeded:
                break
        else:
            raise AssertionError("No successful transfer after allocation faults")
check(all(count > 0 for count in counts.values()))
state.close()
gc.collect()
check(live() == 0 and identities() == 0)
print(json.dumps({"checks": checks, **counts, "live": live(), "identities": identities()}))
