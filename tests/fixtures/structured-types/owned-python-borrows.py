import copy
import ctypes as c
import gc
import json
import os
import pickle
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
    if not value:
        raise AssertionError("owned Python borrow check failed")
    checks += 1

def rejected(kind, action, status=None):
    try:
        action()
    except kind as error:
        check(status is None or error.status == status)
    else:
        raise AssertionError("Expected " + str(kind))

def ticket(number=17):
    return api.new_ticket(number, "owner\0🙂")

def data():
    return api.Payload(-(1 << 1024) - 37, b"\0\xff\x13")

def sample():
    first, second = ticket(7).get(), ticket(9).get()
    return api.Bundle(first, api.Some(second), (first, second, first), (second, first), data())

def owners():
    root = ticket()
    alias, kept = copy.copy(root), root.retain()
    view = api.retain_ticket(root)
    child = api.retain_ticket(view)
    check(view == root and child == kept)
    independent, leaf = child.retain(), child.get()
    root.close()
    check(not view.is_closed and api.serial(alias.get()) == 17)
    alias.close()
    check(view.is_closed and child.is_closed and leaf.is_closed)
    rejected(r.LeanBridgeError, view.get, 4)
    rejected(r.LeanBridgeError, view.retain, 4)
    rejected(r.LeanBridgeError, lambda: view == kept, 4)
    check(api.serial(kept.get()) == api.serial(independent.get()) == 17)
    for number in range(64):
        fresh = ticket(number)
        check(api.serial(fresh.get()) == number and view.is_closed)
    rejected(TypeError, lambda: api.Value())
    rejected(TypeError, lambda: api.retain_ticket(kept.get()))
    rejected(TypeError, lambda: copy.deepcopy(kept))
    rejected(TypeError, lambda: pickle.dumps(kept))

def shape(raw, function):
    root = api.copy_value(raw, result_of=function)
    check(not root.is_closed)
    view = function(root)
    kept, child = view.retain(), function(view)
    check(not root.is_closed and view == kept and kept == root)
    root.close()
    check(view.is_closed and child.is_closed)
    rejected(r.LeanBridgeError, view.get, 4)
    check(not kept.is_closed)

def shapes():
    value = sample()
    item = value.primary
    for raw, function in [
        ([], api.echo_array), ([item, item], api.echo_array),
        ([], api.echo_list), ([item], api.echo_list),
        (None, api.echo_option), (api.Some(item), api.echo_option),
        (api.Ok(value), api.echo_result), (api.Err(item), api.echo_result),
        ((item, (api.Some(item), data())), api.echo_tuple),
        (value, api.echo_record), (value, api.echo_alias),
        ((), api.echo_row), ((None, api.Some(item)), api.echo_row),
        ((), api.echo_nested),
        (((), (None, api.Some(api.Ok(value)), api.Some(api.Err(item)))), api.echo_nested),
        (api.TreeBranch(()), api.echo_recursive),
    ]:
        shape(raw, function)
    for branch in [api.ChoiceEmpty(), api.ChoiceOne(item), api.ChoicePair(item, item),
                   api.ChoiceMany((item, item)), api.ChoiceMany(())]:
        shape(branch, api.echo_variant)
    tree = api.TreeLeaf(item)
    for _ in range(35):
        tree = api.TreeBranch((tree,))
    shape(tree, api.echo_recursive)
    own = api.copy_value(value)
    check(own.get() == value)
    peers = api.copy_value([], parameter_of=(api.bundle, "arg2"))
    borrowed = api.bundle(item, None, peers, (), data())
    check(borrowed.get().primary == item)
    peers.close()
    check(borrowed.is_closed)
    rejected(TypeError, lambda: api.copy_value([]))
    rejected(TypeError, lambda: api.copy_value([], result_of=api.serial))
    rejected(TypeError, lambda: api.copy_value([], parameter_of=(api.bundle, "missing")))

def transfers():
    root = ticket(23)
    alias, kept = copy.copy(root), root.retain()
    view = api.retain_ticket(root)
    child = api.retain_ticket(view)
    rejected(r.LeanBridgeError, lambda: api.transfer_ticket(view), 1)
    moved = api.transfer_ticket(root)
    check(root.is_closed and alias.is_closed and view.is_closed and child.is_closed)
    check(api.serial(moved.get()) == api.serial(kept.get()) == 23)
    other = ticket(0)
    other_alias = copy.copy(other)
    mixed = api.mixed_ticket(moved, other)
    check(other.is_closed and other_alias.is_closed and mixed == moved)
    rejected(r.LeanBridgeError, lambda: api.mixed_ticket(moved, moved), 1)
    rejected(r.LeanBridgeError, lambda: api.mixed_ticket(mixed, moved), 1)
    check(not moved.is_closed and not mixed.is_closed)
    moved.close()
    check(mixed.is_closed)
    empty = api.copy_value([], result_of=api.echo_array)
    alias = copy.copy(empty)
    view = api.echo_array(empty)
    child = api.echo_array(view)
    check(api.move_array(empty).get() == ())
    check(empty.is_closed and alias.is_closed and view.is_closed and child.is_closed)

def callbacks():
    root = api.copy_value(sample())
    escaped, retained = [], []
    def callback(value):
        escaped.append(value.primary)
        retained.append(value.primary.retain())
        owner = api.copy_value(value)
        check(api.echo_record(owner).get() == value)
        return value
    view = api.callback_record(root, callback)
    check(escaped[0].is_closed and not retained[0].is_closed and view == root)
    closure = api.make_record(root)
    kept = closure.retain()
    check(closure(True, sample()).get() == root.get())
    failure = RuntimeError("original Python failure")
    def throwing(value):
        raise failure
    try:
        api.callback_record(root, throwing)
    except RuntimeError as error:
        check(error is failure)
    else:
        raise AssertionError("Expected original callback failure")
    failure.__traceback__ = None
    root.close()
    check(view.is_closed and closure.is_closed)
    rejected(r.LeanBridgeError, lambda: closure(True, sample()), 4)
    check(not kept(True, sample()).is_closed)
    moving = api.copy_value(sample())
    alias, dependent = copy.copy(moving), api.echo_record(moving)
    def during_move(value):
        check(alias.is_closed and dependent.is_closed)
        return value
    check(not api.move_record(moving, during_move).is_closed)

def affinity():
    root = ticket(41)
    view = api.retain_ticket(root)
    def foreign():
        rejected(r.LeanBridgeError, view.get, 5)
    thread = threading.Thread(target=foreign)
    thread.start()
    thread.join()
    with warnings.catch_warnings(record=True) as fork_warnings:
        warnings.simplefilter("always", DeprecationWarning)
        pid = os.fork()
    if pid == 0:
        try:
            view.get()
        except r.LeanBridgeError as error:
            os._exit(0 if error.status == 6 else 1)
        os._exit(2)
    check(os.waitpid(pid, 0)[1] == 0)
    check(all(item.category is DeprecationWarning and
              "multi-threaded, use of fork() may lead to deadlocks" in str(item.message)
              for item in fork_warnings))

def depth():
    root = ticket(33)
    kept = root.retain()
    chain = [copy.copy(root)]
    for _ in range(140):
        try:
            chain.append(api.retain_ticket(chain[-1]))
        except r.LeanBridgeError as error:
            check(error.status == 2 and len(chain) >= 100)
            break
    else:
        raise AssertionError("Expected bounded anchor depth")
    check(api.serial(chain[-1].get()) == 33)
    chain[48].close()
    check(not chain[47].is_closed and chain[49].is_closed and chain[-1].is_closed)
    root.close()
    chain[0].close()
    for item in chain[1:]:
        check(item.is_closed)
    check(api.serial(kept.get()) == 33)

state = runtime.current_state()
baseline = live(), identities()
for operation in [owners, shapes, transfers, callbacks, affinity, depth]:
    operation()
    gc.collect()
    state.drain()
    check((live(), identities()) == baseline)

# Retained failures must not pin hidden input owners through private tracebacks.
failures = []
checkpoint = r._owned_checkpoint
counts = dict.fromkeys(("pythonBefore", "pythonAfter", "nativeBefore", "nativeAfter"), 0)
for kind in ("borrow", "transfer", "empty"):
    for allocator in ("python", "native"):
        for point in range(1024):
            root = api.copy_value([], result_of=api.echo_array) if kind == "empty" else api.copy_value(sample())
            echo = api.echo_array if kind == "empty" else api.echo_record
            alias, dependent = copy.copy(root), echo(root)
            descendant, independent = echo(dependent), dependent.retain()
            before = handoffs()
            remaining = point
            def fail_python():
                global remaining
                if remaining == 0:
                    raise MemoryError("injected Python borrow failure")
                remaining -= 1
            if allocator == "python":
                r._owned_checkpoint = fail_python
            else:
                native_fail(point)
            result = None
            succeeded = False
            try:
                if kind == "empty":
                    result = api.move_array(root)
                elif kind == "transfer":
                    result = api.move_record(root, lambda incoming: incoming)
                else:
                    result = api.callback_record(root, lambda incoming: incoming)
                succeeded = True
            except (MemoryError, r.LeanBridgeError) as error:
                check(type(error) is MemoryError or error.status == 3)
                failures.append(error)
                counts[allocator + ("After" if handoffs() > before else "Before")] += 1
            finally:
                r._owned_checkpoint = checkpoint
                native_fail(-1)
            consumed = handoffs() > before
            check(root.is_closed == alias.is_closed == dependent.is_closed == descendant.is_closed == consumed)
            check(not independent.is_closed)
            if kind == "empty":
                check(independent.get() == ())
            else:
                check(api.serial(independent.get().primary) == 7)
            if result is not None:
                check(not result.is_closed)
                result.close()
            for owner in (root, alias, dependent, descendant, independent):
                owner.close()
            state.drain()
            assert (live(), identities()) == baseline, (kind, allocator, point, consumed, live(), identities(), baseline)
            check((live(), identities()) == baseline)
            if succeeded:
                break
        else:
            raise AssertionError("No successful call after allocation failures")
check(all(count > 0 for count in counts.values()))
# Keep ordinary validation errors, not just allocation failures. Closing every
# public wrapper must still release the private leases in their tracebacks.
lifetime_failures = []
for kind in ("borrowed-transfer", "expired-get", "expired-argument", "wrong-thread"):
    root = ticket()
    view = api.retain_ticket(root)
    if kind.startswith("expired"):
        root.close()
    def invalid_call():
        try:
            if kind == "borrowed-transfer":
                api.transfer_ticket(view)
            elif kind == "expired-argument":
                api.retain_ticket(view)
            else:
                view.get()
        except r.LeanBridgeError as error:
            failures.append(error)
        else:
            raise AssertionError("Expected invalid-lifetime rejection")
    before = len(failures)
    if kind == "wrong-thread":
        thread = threading.Thread(target=invalid_call)
        thread.start()
        thread.join()
    else:
        invalid_call()
    check(len(failures) == before + 1)
    check(failures[-1].status == {"borrowed-transfer": 1, "wrong-thread": 5}.get(kind, 4))
    root.close()
    view.close()
    gc.collect()
    state.drain()
    assert (live(), identities()) == baseline, (kind, live(), identities(), baseline)
    check((live(), identities()) == baseline)
    lifetime_failures.append(kind)
state.close()
check(live() == identities() == 0)
print(json.dumps({"checks": checks, **counts, "live": live(), "identities": identities(),
                  "retainedLifetimeFailures": lifetime_failures}))
