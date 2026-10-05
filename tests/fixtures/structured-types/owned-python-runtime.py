import copy
import gc
import json
import pickle
import signal
import warnings

library = _c.CDLL(_sys.argv[1])
runtime = _OwnedRuntime(library)
pointer = _c.POINTER(_c.c_void_p)

def function(name, args, result=_c.c_uint32):
    fn = library[name]
    fn.argtypes = args
    fn.restype = result
    return fn

native_new = function("owned_test_new", [_c.c_void_p, _c.c_uint64, pointer, pointer])
native_retain = function("owned_test_retain", [_c.c_void_p, _c.c_void_p, pointer, pointer])
native_serial = function("owned_test_serial", [_c.c_void_p, _c.c_void_p, _c.POINTER(_c.c_uint64), pointer])
live = function("owned_test_live", [], _c.c_size_t)
identities = function("owned_test_identities", [], _c.c_size_t)
native_fail = function("owned_test_fail_after", [_c.c_ssize_t], None)

class Ticket(_OwnedResource):
    __slots__ = ()

    def retain(self):
        if self._lease is None:
            raise LeanBridgeError(4)
        state = self._lease.state
        raw = self._raw(state)
        with _OwnedNativeOwner(state) as owner:
            output = _c.c_void_p()
            _owned_checked(native_retain(state.require(), raw, _c.byref(output), _c.byref(owner.value)))
            return Ticket._from_lease(state.adopt(owner), output.value)

def new_ticket(state, serial):
    with _OwnedNativeOwner(state) as owner:
        output = _c.c_void_p()
        _owned_checked(native_new(state.require(), serial, _c.byref(output), _c.byref(owner.value)))
        return Ticket._from_lease(state.adopt(owner), output.value)

def serial(ticket, state=None):
    if state is None:
        state = ticket._lease.state if ticket._lease is not None else runtime.current_state()
    raw = ticket._raw(state)
    with _OwnedNativeOwner(state) as owner:
        output = _c.c_uint64()
        _owned_checked(native_serial(state.require(), raw, _c.byref(output), _c.byref(owner.value)))
        return output.value

checks = 0

def check(value):
    global checks
    assert value
    checks += 1

def rejected(status, action):
    try:
        action()
    except LeanBridgeError as error:
        check(error.status == status)
    else:
        raise AssertionError("Expected ownership status " + str(status))

def python_rejected(kind, action):
    try:
        action()
    except kind:
        check(True)
    else:
        raise AssertionError("Expected Python failure " + str(kind))

_owned_checked(0)
for status in [*range(1, 11), 99]:
    rejected(status, lambda: _owned_checked(status))

state = runtime.current_state()
check(runtime.current_state() is state)
first = new_ticket(state, 41)
shared = copy.copy(first)
retained = first.retain()
check(shared == first and retained == first)
python_rejected(TypeError, lambda: Ticket())
python_rejected(TypeError, lambda: copy.deepcopy(first))
python_rejected(TypeError, lambda: pickle.dumps(first))
first.close()
first.close()
check(first.is_closed)
rejected(4, lambda: serial(first))
check(serial(shared) == 41)
shared.close()
check(serial(retained) == 41)

other = _OwnedState(runtime)
rejected(1, lambda: retained._raw(other))
other.close()
other.close()

with _OwnedBorrowFrame(state) as frame:
    borrowed = Ticket._from_lease(frame.lease, retained._raw(state))
    escaped = copy.copy(borrowed)
    kept = borrowed.retain()
    check(serial(borrowed) == 41)
check(borrowed.is_closed and escaped.is_closed)
rejected(4, lambda: serial(escaped))
check(serial(kept) == 41)

original = RuntimeError("original exception")
try:
    with _OwnedBorrowFrame(state) as frame:
        unwound = Ticket._from_lease(frame.lease, kept._raw(state))
        with new_ticket(state, 99) as temporary:
            check(serial(temporary) == 99)
            raise original
except RuntimeError as error:
    check(error is original)
check(unwound.is_closed and temporary.is_closed)
check(serial(kept) == 41)

thread_errors = []
def foreign_call():
    try:
        serial(kept)
    except LeanBridgeError as error:
        thread_errors.append(error.status)
worker = _threading.Thread(target=foreign_call)
worker.start()
worker.join()
check(thread_errors == [5])

baseline = live(), identities()
foreign = [new_ticket(state, 78)]
held = live(), identities()
def foreign_finalizer():
    foreign.pop()
    gc.collect()
worker = _threading.Thread(target=foreign_finalizer)
worker.start()
worker.join()
check((live(), identities()) == held)
state.require()
check((live(), identities()) == baseline)

escaped_thread = []
def thread_exit():
    local = runtime.current_state()
    ticket = new_ticket(local, 87)
    check(serial(ticket) == 87)
    escaped_thread.append(ticket)
worker = _threading.Thread(target=thread_exit)
worker.start()
worker.join()
check(escaped_thread[0].is_closed)
check((live(), identities()) == baseline)
rejected(4, lambda: serial(escaped_thread[0]))
escaped_thread.clear()

# Fork while a foreign thread owns the Python lock. The child must reject
# use and destruction without waiting for that inherited lock.
locked, release = _threading.Event(), _threading.Event()
def hold_lock():
    with state.lock:
        locked.set()
        release.wait()
worker = _threading.Thread(target=hold_lock)
worker.start()
locked.wait()
with warnings.catch_warnings(record=True) as notices:
    warnings.simplefilter("always", DeprecationWarning)
    child = _os.fork()
if child == 0:
    signal.alarm(5)
    try:
        rejected(6, lambda: serial(kept))
        rejected(6, runtime.current_state)
        rejected(6, state.close)
        check(kept.is_closed)
        kept.close()
        retained.close()
        _os._exit(0)
    except BaseException:
        _os._exit(1)
release.set()
worker.join()
check(len(notices) == (1 if _sys.version_info >= (3, 12) else 0))
for notice in notices:
    check(notice.category is DeprecationWarning and "multi-threaded" in str(notice.message))
check(_os.waitpid(child, 0) == (child, 0))
check(serial(kept) == 41)

for value in range(128):
    with new_ticket(state, value) as item:
        cloned = copy.copy(item)
        item.close()
        check(serial(cloned) == value)
        cloned.close()
        check(cloned.is_closed)

kept.close()
retained.close()
baseline = live(), identities()
check(baseline == (1, 1))

# A later field can fail after a resource wrapper has already escaped into a
# traceback. Aborting the result must revoke the wrapper immediately.
partial_results = []
conversion_failures = []
try:
    with _OwnedNativeOwner(state) as owner:
        output = _c.c_void_p()
        _owned_checked(native_new(state.require(), 123, _c.byref(output), _c.byref(owner.value)))
        partial_results.append(Ticket._from_lease(state.adopt(owner), output.value))
        raise ValueError("malformed later output field")
except ValueError as error:
    conversion_failures.append(error)
    check(partial_results[0].is_closed)
    rejected(4, lambda: serial(partial_results[0]))
    check((live(), identities()) == baseline)

native_failures = 0
for point in range(128):
    native_fail(point)
    try:
        result = new_ticket(state, 77)
    except LeanBridgeError as error:
        check(error.status == 3)
        native_failures += 1
    else:
        result.close()
        break
    finally:
        native_fail(-1)
    check((live(), identities()) == baseline)
check(0 < native_failures < 128)

python_failures = 0
retained_failures = []
checkpoint = _owned_checkpoint
for point in range(128):
    remaining = point
    def fail_python():
        global remaining
        if remaining == 0:
            raise MemoryError("injected ownership allocation failure")
        remaining -= 1
    _owned_checkpoint = fail_python
    try:
        result = new_ticket(state, 55)
    except MemoryError as error:
        retained_failures.append(error)
        python_failures += 1
        check((live(), identities()) == baseline)
    else:
        result.close()
        break
    finally:
        _owned_checkpoint = checkpoint
    gc.collect()
    check((live(), identities()) == baseline)
check(0 < python_failures < 128)

last = new_ticket(state, 88)
state.close()
state.close()
check(last.is_closed)
rejected(4, lambda: serial(last))
rejected(4, runtime.current_state)
last.close()
gc.collect()
check(live() == 0)
check(identities() == 0)
print(json.dumps({"python": ".".join(map(str, _sys.version_info[:3])), "checks": checks,
                  "pythonFailures": python_failures, "nativeFailures": native_failures,
                  "live": live(), "identities": identities()}))
