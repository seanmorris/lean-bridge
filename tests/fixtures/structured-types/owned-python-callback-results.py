import copy
import gc
import json
import os
import pickle
import sys
import threading
import warnings
import lean_owned_aggregates as api

# HOST_CALLBACKS, COMBINED and INSTALLED come from the independent test driver.
checks = 0
scenarios = []


def check(value, message="Python callback-result check failed"):
    global checks
    if not value:
        raise AssertionError(message)
    checks += 1


def rejected(kind, action, status=None):
    try:
        action()
    except kind as error:
        check(status is None or error.status == status, "unexpected rejection status")
    else:
        raise AssertionError("Expected " + str(kind))


def sample(number=7):
    first = api.new_ticket(number, "owner\0🙂").get()
    second = api.new_ticket(number + 2, "second\0𐐷").get()
    return api.Bundle(first, api.Some(second), (first, second, first),
                      (second, first), api.Payload(-(1 << 1024) - 37, b"\0\xff\x13"))


def record(value, number=7):
    check(api.serial(value.primary) == number)
    check(api.label(value.primary) == "owner\0🙂")
    check(value.primary == value.peers[0] == value.peers[2])
    check(value.spare.value == value.history[0] == value.peers[1])
    check(value.payload.count == -(1 << 1024) - 37)
    check(value.payload.bytes_ == b"\0\xff\x13")


def original_owner():
    captured = api.copy_value(sample(91))
    closure = api.make_record(captured.get())
    root = api.copy_value(sample())
    alias = copy.copy(root)
    supplied = closure(False, root)
    view = closure.get()(True, supplied)
    child = closure(True, view)
    retained, copied = child.retain(), api.copy_value(child.get())
    leaf = view.get().primary
    record(supplied.get())
    record(view.get(), 91)
    captured.close()
    closure.close()
    check(not view.is_closed, "callback result must not borrow the closure owner")
    root.close()
    check(not view.is_closed, "a shallow root alias still owns the anchor")
    alias.close()
    check(supplied.is_closed and view.is_closed and child.is_closed and leaf.is_closed,
          "closing the selected argument must expire transitive callback results")
    rejected(api.LeanBridgeError, view.get, 4)
    rejected(api.LeanBridgeError, view.retain, 4)
    rejected(api.LeanBridgeError, lambda: view == retained, 4)
    record(retained.get(), 91)
    record(copied.get(), 91)
    for number in range(64):
        fresh = api.copy_value(sample(number))
        check(view.is_closed and child.is_closed, "reused owner slots must not revive borrows")
        fresh.close()
    rejected(TypeError, lambda: api.Value())
    rejected(TypeError, lambda: copy.deepcopy(retained))
    rejected(TypeError, lambda: pickle.dumps(retained))


def independent_closure():
    captured = api.copy_value(sample(19))
    argument = api.copy_value(sample())
    leased = api.make_leased_record(captured.get())
    output = leased(False, argument.get())
    captured.close()
    argument.close()
    leased.close()
    check(not output.is_closed, "leased and borrowed callback results must remain distinct")
    record(output.get())


def native_passback():
    captured = api.copy_value(sample(23))
    source = api.copy_value(sample())
    callback = api.make_record_callback(captured.get())
    results = []
    # The descriptor's native-closure path must remain available without host callbacks.
    for argument in (callback.get(), callback):
        result = api.callback_record(source.get(), argument)
        record(result.get(), 23)
        results.append(result)
    captured.close()
    source.close()
    callback.close()
    for result in results:
        record(result.get(), 23)


def recursive_owners():
    for empty in (True, False):
        raw = api.TreeBranch(()) if empty else api.TreeLeaf(api.new_ticket(13, "tree").get())
        for _ in range(30):
            raw = api.TreeBranch((raw,))
        captured = api.copy_value(raw)
        root = api.copy_value(raw)
        closure = api.make_recursive(captured.get())
        view = closure(False, root)
        child = closure(True, view)
        kept = child.retain()
        check(view.get() == child.get() == raw)
        captured.close()
        closure.close()
        root.close()
        check(view.is_closed and child.is_closed, "empty recursive results must keep their anchor")
        rejected(api.LeanBridgeError, view.get, 4)
        check(kept.get() == raw)
    empty = api.copy_value(api.TreeBranch(()))
    callback = api.make_tree_callback(api.TreeBranch(()))
    for argument in (callback.get(), callback):
        result = api.callback_recursive(empty.get(), argument)
        check(result.get() == api.TreeBranch(()))
    root = api.copy_value(api.TreeBranch(()))
    closure = api.make_recursive(root.get())
    root.close()
    rejected(api.LeanBridgeError, lambda: closure(False, root), 4)
    rejected(TypeError, lambda: closure(False, api.TreeBranch(())))
    ticket = api.new_ticket(1, "wrong type")
    rejected(TypeError, lambda: closure(False, ticket))


def bounded_depth():
    root = api.copy_value(api.TreeBranch(()))
    closure = api.make_recursive(root.get())
    chain = [root]
    for _ in range(140):
        try:
            chain.append(closure(False, chain[-1]))
        except api.LeanBridgeError as error:
            check(error.status == 2 and len(chain) >= 100)
            break
    else:
        raise AssertionError("Expected bounded callback anchor depth")
    independent = chain[-1].retain()
    chain[48].close()
    check(not chain[47].is_closed and chain[49].is_closed and chain[-1].is_closed)
    root.close()
    for value in chain[1:]:
        check(value.is_closed)
    check(independent.get() == api.TreeBranch(()))


def host_replies():
    root = api.copy_value(sample())
    escaped, retained = [], []

    def raw(value):
        escaped.append(value.primary)
        retained.append(value.primary.retain())
        # Nested bridge entry while the original callback frame is live.
        nested = api.copy_value(value)
        record(api.make_record(value)(False, nested).get())
        return value

    for callback in (raw, lambda value: root,
                     api.with_recovery(raw, root.get()),
                     api.with_recovery(raw, root),
                     api.with_recovery(lambda value: root, root.get()),
                     api.with_recovery(lambda value: root, root)):
        output = api.callback_record(root.get(), callback)
        record(output.get())
    check(all(value.is_closed for value in escaped), "escaped callback arguments must expire")
    check(all(not value.is_closed for value in retained))
    for value in escaped:
        rejected(api.LeanBridgeError, lambda: api.serial(value), 4)
    failure = RuntimeError("original Python callback exception")

    def throwing(value):
        raise failure

    for recovery in (None, root.get(), root):
        try:
            callback = throwing if recovery is None else api.with_recovery(throwing, recovery)
            api.callback_record(root.get(), callback)
        except RuntimeError as error:
            check(error is failure, "callback exceptions must retain their identity")
        else:
            raise AssertionError("Recovery must not turn a failed callback into success")
        failure.__traceback__ = None
    expired = api.copy_value(api.TreeBranch(()))
    expired.close()
    rejected(api.LeanBridgeError,
             lambda: api.callback_recursive(api.TreeBranch(()), lambda value: expired), 4)
    rejected(api.LeanBridgeError,
             lambda: api.callback_recursive(api.TreeBranch(()), api.with_recovery(lambda value: value, expired)), 4)

    async def asynchronous(value):
        return value

    rejected(TypeError, lambda: api.callback_record(root.get(), asynchronous))
    rejected(TypeError, lambda: api.callback_record(root.get(), lambda value: asynchronous(value)))
    rejected(TypeError, lambda: api.callback_record(root.get(), lambda value: 42))
    record(api.callback_record(root.get(), lambda value: value).get())
    root.close()
    record(output.get())


def combined_transfers():
    root = api.copy_value(sample())
    closure = root.make_record()
    alias = copy.copy(root)
    view = closure(False, root)
    descendant = view.borrow_record()
    kept = descendant.retain()
    captured = api.make_record_callback(root.get())
    rejected(api.LeanBridgeError, lambda: view.move_record(lambda value: value), 1)
    check(not root.is_closed and not descendant.is_closed)
    escaped = []

    def during(value):
        check(root.is_closed and alias.is_closed and view.is_closed and descendant.is_closed,
              "handoff must expire aliases before callback reentry")
        rejected(api.LeanBridgeError, descendant.get, 4)
        escaped.append(value.primary)
        record(api.callback_record(value, captured.get()).get())
        return value

    result = root.move_record(during)
    check(escaped[0].is_closed)
    record(result.get())
    record(kept.get())
    record(closure(False, kept).get())
    record(api.callback_record(kept.get(), captured).get())
    moved = api.copy_value(sample())
    record(moved.move_record(lambda value: kept).get())
    check(moved.is_closed)
    moved = api.copy_value(sample())
    record(moved.move_record(captured).get())
    check(moved.is_closed)
    failed = api.copy_value(sample())
    dependent = closure(False, failed)
    failure = RuntimeError("failure after handoff")

    def throwing(value):
        check(failed.is_closed and dependent.is_closed)
        raise failure

    try:
        failed.move_record(throwing)
    except RuntimeError as error:
        check(error is failure)
    else:
        raise AssertionError("Expected transfer callback failure")
    failure.__traceback__ = None
    check(failed.is_closed and dependent.is_closed)


def affinity():
    root = api.copy_value(api.TreeBranch(()))
    closure = api.make_recursive(root.get())
    view = closure(False, root)
    failures = []

    def foreign():
        try:
            view.get()
        except BaseException as error:
            failures.append(error)

    thread = threading.Thread(target=foreign)
    thread.start()
    thread.join(10)
    check(not thread.is_alive() and len(failures) == 1)
    check(type(failures[0]) is api.LeanBridgeError and failures[0].status == 5)
    with warnings.catch_warnings(record=True) as fork_warnings:
        warnings.simplefilter("always", DeprecationWarning)
        pid = os.fork()
    if pid == 0:
        try:
            view.get()
        except api.LeanBridgeError as error:
            os._exit(0 if error.status == 6 else 1)
        os._exit(2)
    check(os.waitpid(pid, 0)[1] == 0)
    check(all(item.category is DeprecationWarning and
              "multi-threaded, use of fork() may lead to deadlocks" in str(item.message)
              for item in fork_warnings))


if not INSTALLED:
    import ctypes as c
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
    state = runtime.current_state()
    baseline = live(), identities()
    if os.environ.get("LEAN_BRIDGE_OWNED_SANITIZER_CHECK") == "1":
        assert sys.flags.no_user_site and sys.flags.safe_path
        assert not sys.flags.ignore_environment
        allocator = c.pythonapi._PyMem_GetCurrentAllocatorName
        allocator.argtypes = []
        allocator.restype = c.c_char_p
        assert allocator() == b"malloc", "sanitizer requires the actual malloc allocator"
        native("owned_test_sanitizer_tls_touch", [], None)()
    if os.environ.get("LEAN_BRIDGE_OWNED_SANITIZER_FAULT") == "address":
        native("owned_test_sanitizer_fault", [c.c_size_t], None)(4)
        raise AssertionError("AddressSanitizer missed an out-of-bounds write")
    if os.environ.get("LEAN_BRIDGE_OWNED_SANITIZER_FAULT") == "undefined":
        native("owned_test_undefined_fault", [c.c_int], c.c_int)(40)
        raise AssertionError("UndefinedBehaviorSanitizer missed an invalid shift")
    if os.environ.get("LEAN_BRIDGE_OWNED_SANITIZER_FAULT") == "leak":
        native("owned_test_sanitizer_leak", [], None)()
        state.close()
        print(json.dumps({"leaked": True}))
        sys.exit(0)
    if os.environ.get("LEAN_BRIDGE_OWNED_SANITIZER_FAULT") in ("tls-live", "tls-leak"):
        native("owned_test_sanitizer_tls_hold", [], None)()
        leaked = os.environ["LEAN_BRIDGE_OWNED_SANITIZER_FAULT"] == "tls-leak"
        if leaked:
            native("owned_test_sanitizer_tls_clear", [], None)()
        state.close()
        print(json.dumps({"tls": "leak" if leaked else "live"}))
        sys.exit(0)
    if os.environ.get("LEAN_BRIDGE_OWNED_COLD_ONLY") == "1":
        # Exercise interpreter thread/fork startup without calling a Lean export.
        thread = threading.Thread(target=lambda: None)
        thread.start()
        thread.join()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", DeprecationWarning)
            child = os.fork()
        if child == 0:
            os._exit(0)
        assert os.waitpid(child, 0)[1] == 0
        del thread
        gc.collect()
        state.close()
        print(json.dumps({"cold": True}))
        sys.exit(0)

for operation in [original_owner, independent_closure, native_passback,
                  recursive_owners, bounded_depth, affinity,
                  *([host_replies] if HOST_CALLBACKS else []),
                  *([combined_transfers] if COMBINED else [])]:
    operation()
    scenarios.append(operation.__name__)
    gc.collect()
    if not INSTALLED:
        state.drain()
        check((live(), identities()) == baseline, operation.__name__ + " leaked native ownership")

if INSTALLED:
    print(json.dumps({"checks": checks, "scenarios": scenarios}))
    sys.exit(0)

# Keep failures and their tracebacks alive while checking cleanup.
failures = []
checkpoint = r._owned_checkpoint
faults = []
kinds = ["native-record", "native-empty", "retain"]
if HOST_CALLBACKS:
    kinds += ["host-raw", "host-whole", "recovery-raw", "recovery-whole"]
if COMBINED:
    kinds += ["transfer-raw", "transfer-whole", "transfer-native"]
for kind in kinds:
    for allocator in ("python", "native"):
        before_count = after_count = 0
        for point in range(2048):
            empty = kind == "native-empty"
            root = api.copy_value(api.TreeBranch(())) if empty else api.copy_value(sample())
            captured = api.copy_value(api.TreeBranch(())) if empty else api.copy_value(sample(91))
            closure = api.make_recursive(captured.get()) if empty else api.make_record(captured.get())
            unary = api.make_tree_callback(captured.get()) if empty else api.make_record_callback(captured.get())
            alias, dependent = copy.copy(root), closure(False, root)
            descendant, independent = closure(False, dependent), dependent.retain()
            before = handoffs()
            remaining = point

            def fail_python():
                global remaining
                if remaining == 0:
                    raise MemoryError("injected Python callback-result failure")
                remaining -= 1

            if allocator == "python":
                r._owned_checkpoint = fail_python
            else:
                native_fail(point)
            result = None
            succeeded = False
            try:
                if kind.startswith("native-"):
                    result = closure(True, root)
                elif kind == "retain":
                    result = dependent.retain()
                elif kind == "host-raw":
                    result = api.callback_record(root.get(), lambda value: value)
                elif kind == "host-whole":
                    result = api.callback_record(root.get(), lambda value: captured)
                elif kind == "recovery-raw":
                    result = api.callback_record(root.get(), api.with_recovery(lambda value: captured, independent.get()))
                elif kind == "recovery-whole":
                    result = api.callback_record(root.get(), api.with_recovery(lambda value: value, independent))
                elif kind == "transfer-raw":
                    result = root.move_record(lambda value: value)
                elif kind == "transfer-whole":
                    result = root.move_record(lambda value: captured)
                elif kind == "transfer-native":
                    result = root.move_record(unary)
                succeeded = True
            except (MemoryError, api.LeanBridgeError) as error:
                check(type(error) is MemoryError or error.status == 3)
                failures.append(error)
                if handoffs() > before:
                    after_count += 1
                else:
                    before_count += 1
            finally:
                r._owned_checkpoint = checkpoint
                native_fail(-1)
            consumed = handoffs() > before
            check(root.is_closed == alias.is_closed == dependent.is_closed == descendant.is_closed == consumed)
            check(not independent.is_closed)
            if empty:
                check(independent.get() == api.TreeBranch(()))
            else:
                record(independent.get())
            if result is not None:
                check(not result.is_closed)
                if empty:
                    check(result.get() == api.TreeBranch(()))
                else:
                    record(result.get(), 91 if kind in ("native-record", "host-whole", "recovery-raw", "transfer-whole", "transfer-native") else 7)
                result.close()
            for owner in (root, captured, closure, unary, alias, dependent, descendant, independent):
                owner.close()
            state.drain()
            check((live(), identities()) == baseline,
                  f"{kind}/{allocator}/{point}: retained traceback leaked {(live(), identities())}, expected {baseline}")
            if succeeded:
                break
        else:
            raise AssertionError("No successful call after allocation failures")
        check(before_count > 0)
        check((after_count > 0) == kind.startswith("transfer-"))
        faults.append({"kind": kind, "allocator": allocator,
                       "before": before_count, "after": after_count, "successAt": point})
state.close()
check(live() == identities() == 0)
print(json.dumps({"checks": checks, "scenarios": scenarios, "faults": faults,
                  "live": live(), "identities": identities()}))
