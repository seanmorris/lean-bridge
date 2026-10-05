/**
 * Inspect installed ownership and loader state without configuring the consumer.
 *
 * @file
 */
export const ownedPythonInstalledProbe = `import contextlib
import ctypes as c
import gc
import importlib.util
import io
import json
import os
import pathlib
import runpy
import signal
import sys
import threading
import warnings
import lean_owned_aggregates as api
from lean_owned_aggregates import _assets as assets

# The consumer itself uses only public imports. Native inspection happens
# afterwards, against the library automatically loaded by that import.
output = io.StringIO()
with contextlib.redirect_stdout(output):
    runpy.run_path("consumer.py", run_name="__main__")
consumer = json.loads(output.getvalue())
class Snapshot(c.Structure):
    _fields_ = [(name, c.c_uint32) for name in (
        "abi", "state", "runtime_inits", "component_inits", "components", "identities"
    )] + [("runtime_instance", c.c_uint64), ("identity_domain", c.c_uint64)]
read = assets._LIBRARY.lean_bridge_native_snapshot_read
read.argtypes = [c.POINTER(Snapshot)]
read.restype = None
def snapshot():
    gc.collect()
    value = Snapshot()
    read(c.byref(value))
    return value
# Each cached, open C session has its own broker identity. Empty result slots
# and exactly one session identity prove that no consumer values survived.
assert not api._OwnedNative._runtime.current_state().slots
assert snapshot().identities == 1

def import_again(name):
    root = pathlib.Path(api.__file__).parent
    spec = importlib.util.spec_from_file_location(name, root / "__init__.py",
                                                submodule_search_locations=[str(root)])
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    try:
        spec.loader.exec_module(module)
    except BaseException:
        sys.modules.pop(name, None)
        raise
    return module

handles = len(assets._state.handles)
compatible = import_again("owned_compatible")
assert compatible._OwnedNative._Assets._LIBRARY is assets._LIBRARY
assert len(assets._state.handles) == handles
with compatible.new_ticket(97, "second import") as ticket:
    assert compatible.serial(ticket) == 97
assert not compatible._OwnedNative._runtime.current_state().slots
assert snapshot().identities == 2
assert snapshot().runtime_inits == 1
assert snapshot().component_inits == 1

results, failures = [], []
def load_in_thread(name):
    try:
        module = import_again(name)
        with module.new_ticket(98, name) as value:
            assert module.serial(value) == 98
        results.append(module)
    except BaseException as error:
        failures.append(error)
threads = [threading.Thread(target=load_in_thread, args=("owned_parallel_" + str(i),))
           for i in range(4)]
for thread in threads:
    thread.start()
for thread in threads:
    thread.join()
assert not failures, failures
assert len(results) == 4 and len(assets._state.handles) == handles
assert snapshot().identities == 2
assert snapshot().component_inits == 1

source = pathlib.Path(assets.__file__).read_text()
identity = assets._evidence["runtimeIdentity"]
assert source.count(identity) == 1
conflict = source.replace(identity, "0" * 64)
try:
    exec(compile(conflict, "conflicting-owned-loader", "exec"),
         {"__file__": assets.__file__, "__name__": "owned_conflict"})
except ImportError as error:
    assert "Incompatible Lean runtime identities" in str(error), str(error)
else:
    raise AssertionError("Conflicting runtime was accepted")
with api.new_ticket(99, "still usable") as ticket:
    assert api.serial(ticket) == 99

# A held registry lock must not trap a child before the PID check.
entered, release = threading.Event(), threading.Event()
def hold_lock():
    with assets._state.lock:
        entered.set()
        release.wait()
thread = threading.Thread(target=hold_lock)
thread.start()
entered.wait()
try:
    with warnings.catch_warnings(record=True) as recorded:
        warnings.simplefilter("always", DeprecationWarning)
        child = os.fork()
    if child == 0:
        signal.alarm(5)
        try:
            try:
                api.new_ticket(1, "fork")
            except RuntimeError as error:
                assert "fork" in str(error).lower()
            else:
                os._exit(41)
            try:
                import_again("owned_child")
            except ImportError as error:
                assert "fork" in str(error).lower()
            else:
                os._exit(42)
        except BaseException:
            os._exit(43)
        os._exit(0)
    _, status = os.waitpid(child, 0)
    assert os.waitstatus_to_exitcode(status) == 0, status
    if sys.version_info >= (3, 12):
        assert len(recorded) == 1 and "multi-threaded" in str(recorded[0].message)
    else:
        assert not recorded
finally:
    release.set()
    thread.join()
# Close the two still-live main-thread session guards after checking their
# result slots. Thread-exit cleanup already closed the four worker sessions.
assert not api._OwnedNative._runtime.current_state().slots
assert not compatible._OwnedNative._runtime.current_state().slots
api._OwnedNative._runtime.current_state().close()
compatible._OwnedNative._runtime.current_state().close()
state = snapshot()
assert state.identities == 0
print(json.dumps({"consumer": consumer, "liveIdentities": state.identities,
                  "runtimeInitializations": state.runtime_inits,
                  "componentInitializations": state.component_inits,
                  "compatibleImports": 5, "concurrentImports": 4,
                  "conflictingRuntimeRejected": True, "forkWithHeldLockRejected": True}))
`;
