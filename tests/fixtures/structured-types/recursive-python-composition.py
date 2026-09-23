import ctypes
import importlib
import inspect
import json
import os
import signal
import sys
import threading
import warnings
import lean_recursive as lb
from lean_recursive import _assets as assets, _native as native

layout = json.loads(sys.argv[1])
mode = sys.argv[2]
assert len(assets._state.components) == 1
import lean_recursive_peer as peer
import lean_graph_names as names

assert len(assets._state.components) == 3
assert assets._state is peer._native._state is names._assets._state
assert peer.answer() == 42
# A class named next must not shadow the loader's builtin next when it reuses
# the already-loaded Lean runtime. scope/value also exercise conversion locals.
named = names.next(names.value(names.Some(names.scopeNext(names.scopeFinish(17)))))
parameter = next(iter(inspect.signature(names.echo).parameters))
assert names.echo(**{parameter: named}) == named
assert names.echo(named).tree is not named.tree
assert names.echo(names.next(names.value(None))) == names.next(names.value(None))
owned = lb.tree(lb.TreeBranch([lb.TreeBranch([])]))
assert owned == lb.TreeBranch((lb.TreeBranch(()),))
libraries = [os.path.basename(handle._name) for handle in assets._state.handles]
assert libraries.count("libleanshared.so") == 1
assert libraries.count("liblean_bridge_native.so") == 1
assert len(libraries) == len(set(libraries)) == 8

# Fork is deliberately unsupported. Hold the inherited runtime lock so the
# child proves it rejects calls and imports before trying to acquire that lock.
locked, release = threading.Event(), threading.Event()


def hold_runtime_lock():
    with assets._state.lock:
        locked.set()
        assert release.wait(10)


worker = threading.Thread(target=hold_runtime_lock)
worker.start()
assert locked.wait(10)
try:
    with warnings.catch_warnings(record=True) as fork_warnings:
        warnings.simplefilter("always")
        pid = os.fork()
finally:
    release.set()
if pid == 0:
    signal.alarm(5)
    try:
        for call in [lb.empty, peer.answer, lambda: names.echo(named)]:
            try:
                call()
            except RuntimeError as error:
                assert "after fork" in str(error)
            else:
                raise AssertionError("Forked runtime reuse succeeded")
        try:
            importlib.reload(names._assets)
        except ImportError as error:
            assert "after fork" in str(error)
        else:
            raise AssertionError("Forked import succeeded")
    except BaseException:
        os._exit(91)
    os._exit(0)
worker.join(10)
assert not worker.is_alive()
assert os.waitpid(pid, 0)[1] == 0
assert len(fork_warnings) == (1 if sys.version_info >= (3, 12) else 0)
for warning in fork_warnings:
    assert warning.category is DeprecationWarning
    assert str(warning.message) == (
        f"This process (pid={os.getpid()}) is multi-threaded, "
        "use of fork() may lead to deadlocks in the child."
    )
assert lb.empty() == lb.TreeBranch(()) and peer.answer() == 42

index, raw = layout["tree"]["index"], getattr(native, layout["tree"]["raw"])
original = getattr(native, f"_fn{index}")
original_clear = native._graph_clear
clears = 0


def clear(output):
    global clears
    had_owner = output is not None and hasattr(output, "owner") and bool(output.owner)
    original_clear(output)
    if had_owner:
        assert not output.owner and not output.release
        clears += 1


def fail(*args):
    result = original(*args)
    assert result == 0
    if mode == "raw":
        ctypes.cast(args[-1], ctypes.POINTER(raw)).contents.kind = (1 << 32) - 1
    elif mode == "during":
        native._graph_retire()
    else:
        raise AssertionError("Unknown retirement mode")
    return result


setattr(native, f"_fn{index}", fail)
native._graph_clear = clear
try:
    lb.tree(owned)
except lb.LeanBridgeError as error:
    assert error.status == (4 if mode == "raw" else 5)
else:
    raise AssertionError("Output from retired runtime escaped")
assert clears == 1
assert not native._graph_ready()
for call, error_type in [(lb.empty, lb.LeanBridgeError), (peer.answer, peer.LeanBridgeError),
                         (lambda: names.echo(named), names.LeanBridgeError)]:
    try:
        call()
    except error_type as error:
        assert error.status == 5
    else:
        raise AssertionError("Retired runtime reused by another wheel")
assert owned == lb.TreeBranch((lb.TreeBranch(()),))
assert named.tree.next.value.value.value == 17
native._graph_clear = original_clear
setattr(native, f"_fn{index}", original)
print(json.dumps({"mode": mode, "components": 3, "libraries": libraries,
                  "forkRejection": True, "forkWithLockHeld": True,
                  "forkWarnings": len(fork_warnings), "retirementClears": clears,
                  "crossPackageRetirement": True, "retainedValuesUsable": True,
                  "publicNameCollisions": ["next", "scope", "value"],
                  "keywordArgument": parameter}))
