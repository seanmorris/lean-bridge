/**
 * Python resource leases over the checked C session and result boundary.
 *
 * @file
 */

/**
 * Emit scoped borrows, shared leases and creator-thread native cleanup.
 * This foundation alone does not admit resource-bearing Python wheels.
 *
 * @param prefix - Validated public C package identifier.
 */
export const ownedPythonRuntime = prefix => {
	if(!/^[a-z][a-z0-9_]*$/u.test(prefix) || prefix.includes("__")) throw new TypeError("Invalid owned Python prefix");
	return `import ctypes as _c
import os as _os
import sys as _sys
import threading as _threading

class LeanBridgeError(RuntimeError):
    def __init__(self, status, message=None):
        self.status = status
        super().__init__(message or {
            1: "Invalid argument", 2: "Ownership limit exceeded",
            3: "Native allocation failed", 4: "Resource is closed",
            5: "Resource belongs to another thread",
            6: "Start a fresh interpreter after fork",
            7: "Lean runtime is unavailable", 8: "Invalid native call order",
            9: "Malformed native result", 10: "Host callback failed",
        }.get(status, "Unknown native status: " + str(status)))

def _owned_checked(status):
    if status:
        raise LeanBridgeError(status)

def _owned_checkpoint():
    # Tests replace this hook to fail each Python ownership allocation boundary.
    pass

class _OwnedSlot:
    __slots__ = ("value", "pending", "releasing")
    def __init__(self):
        self.value = _c.c_void_p()
        self.pending = False
        self.releasing = False

class _OwnedNativeOwner:
    def __init__(self, state):
        self.state = state
        self.slot = None
        self.lease = None
        state.require()
        _owned_checkpoint()
        slot = _OwnedSlot()
        _owned_checkpoint()
        # Register before C can publish a result. Closing the creator thread
        # also releases a guard dropped by a foreign Python finalizer.
        with state.lock:
            state.slots.add(slot)
        self.slot = slot

    @property
    def value(self):
        if self.slot is None:
            raise LeanBridgeError(4)
        return self.slot.value

    def close(self):
        slot, self.slot = self.slot, None
        if slot is not None:
            self.state.release(slot)
        self.lease = None

    def __enter__(self):
        return self

    def __exit__(self, error_type, *_):
        if error_type is None and self.lease is not None:
            # Publish only after every output wrapper has been constructed.
            # An exception traceback may keep those wrappers alive forever.
            self.slot = None
            self.lease = None
        else:
            self.close()

    def __del__(self):
        try:
            self.close()
        except BaseException:
            pass

class _OwnedScope:
    __slots__ = ("active",)
    def __init__(self):
        self.active = True

class _OwnedLease:
    def __init__(self, state, slot=None, scope=None):
        self.state = state
        self.slot = slot
        self.scope = scope

    @property
    def closed(self):
        return (self.state.closed or self.state.exited
                or _os.getpid() != self.state.runtime.pid
                or (not self.scope.active if self.scope is not None
                    else self.slot is None or self.slot.pending
                    or self.slot.releasing or not self.slot.value.value))

    def require(self):
        self.state.require()
        if self.closed:
            raise LeanBridgeError(4)

    def __del__(self):
        try:
            if self.slot is not None:
                self.state.release(self.slot)
        except BaseException:
            pass

class _OwnedBorrowFrame:
    def __init__(self, state):
        self.scope = None
        state.require()
        _owned_checkpoint()
        self.scope = _OwnedScope()
        _owned_checkpoint()
        self.lease = _OwnedLease(state, scope=self.scope)

    def close(self):
        if self.scope is not None:
            self.scope.active = False

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()

    def __del__(self):
        self.close()

class _OwnedState:
    def __init__(self, runtime):
        runtime.ensure_process()
        self.runtime = runtime
        self.thread = _threading.current_thread()
        self.ident = _threading.get_ident()
        self.session = _c.c_void_p()
        self.closed = False
        self.exited = False
        self.lock = _threading.RLock()
        self.slots = set()
        _owned_checked(runtime.session_open(_c.byref(self.session)))
        if not self.session.value:
            raise LeanBridgeError(9)

    def affinity(self, exiting=False):
        self.runtime.ensure_process()
        if self.exited:
            raise LeanBridgeError(4)
        if (_threading.get_ident() != self.ident
                or (not exiting and _threading.current_thread() is not self.thread)):
            raise LeanBridgeError(5)

    def require(self):
        self.affinity()
        if self.closed or not self.session.value:
            raise LeanBridgeError(4)
        self.drain()
        return self.session

    def adopt(self, owner):
        self.require()
        if (owner.state is not self or owner.slot is None
                or owner.lease is not None or not owner.value.value):
            raise LeanBridgeError(1)
        _owned_checkpoint()
        lease = _OwnedLease(self)
        _owned_checkpoint()
        lease.slot = owner.slot
        owner.lease = lease
        return lease

    def release(self, slot):
        # Check PID before touching a potentially inherited, locked mutex.
        if _os.getpid() != self.runtime.pid or self.exited:
            return
        with self.lock:
            slot.pending = True
        if _threading.current_thread() is self.thread:
            self.drain()

    def drain(self, exiting=False):
        self.affinity(exiting)
        while True:
            with self.lock:
                selected = next((slot for slot in self.slots
                                 if slot.pending and not slot.releasing), None)
                if selected is None:
                    return
                selected.releasing = True
            # C cleanup can invoke finalizers. Do not hold the Python lock.
            try:
                status = self.runtime.result_release(_c.byref(selected.value))
            finally:
                with self.lock:
                    selected.releasing = False
                    if not selected.value.value:
                        self.slots.discard(selected)
            _owned_checked(status)
            if selected.value.value:
                raise LeanBridgeError(9)

    def close(self, exiting=False):
        self.affinity(exiting)
        if not self.closed:
            _owned_checked(self.runtime.session_close(_c.byref(self.session)))
            self.closed = True
        with self.lock:
            for slot in self.slots:
                slot.pending = True
        self.drain(exiting)

    def retire(self):
        if _os.getpid() == self.runtime.pid and _threading.get_ident() == self.ident and not self.exited:
            self.close(exiting=True)
            self.exited = True

    def __del__(self):
        try:
            self.retire()
        except BaseException:
            pass

class _OwnedLocalState:
    def __init__(self, state):
        self.state = state

    def __del__(self):
        # threading removes the public Thread object before clearing its local
        # values. Only this private thread-local holder uses the exit path.
        try:
            self.state.retire()
        except BaseException:
            pass

class _OwnedRuntime:
    def __init__(self, library, ensure_process=None):
        if hasattr(_sys, "_is_gil_enabled") and not _sys._is_gil_enabled():
            raise ImportError("Owned Lean values require a GIL-enabled interpreter")
        self.pid = _os.getpid()
        self._ensure_loaded_process = ensure_process
        self.local = _threading.local()
        self.library = library
        self._retire = library["lean_bridge_native_runtime_retire"]
        self._retire.argtypes = []
        self._retire.restype = None
        for name in ("session_open", "session_close", "result_release"):
            function = library["${prefix}_" + name]
            function.argtypes = [_c.POINTER(_c.c_void_p)]
            function.restype = _c.c_uint32
            setattr(self, name, function)

    def ensure_process(self):
        if self.pid != _os.getpid():
            raise LeanBridgeError(6)
        if self._ensure_loaded_process is not None:
            self._ensure_loaded_process()

    def retire(self):
        self.ensure_process()
        self._retire()

    def current_state(self):
        self.ensure_process()
        holder = getattr(self.local, "holder", None)
        if holder is None:
            _owned_checkpoint()
            state = _OwnedState(self)
            try:
                _owned_checkpoint()
                holder = _OwnedLocalState(state)
                self.local.holder = holder
            except BaseException:
                state.close()
                raise
        holder.state.require()
        return holder.state

class _OwnedResource:
    __slots__ = ("_lease", "_handle")
    __hash__ = None

    def __init__(self, *_):
        raise TypeError("Resource values are returned by Lean functions")

    @classmethod
    def _from_lease(cls, lease, handle):
        lease.require()
        if type(handle) is not int or handle <= 0 or handle >= 1 << 64:
            raise LeanBridgeError(1)
        _owned_checkpoint()
        result = object.__new__(cls)
        result._lease = lease
        result._handle = handle
        return result

    def _raw(self, state):
        if self._lease is None or not self._handle:
            raise LeanBridgeError(4)
        self._lease.require()
        if self._lease.state is not state:
            raise LeanBridgeError(1)
        return self._handle

    @property
    def is_closed(self):
        return self._lease is None or not self._handle or self._lease.closed

    def close(self):
        self._handle = 0
        self._lease = None

    def __enter__(self):
        if self._lease is None:
            raise LeanBridgeError(4)
        self._lease.require()
        return self

    def __exit__(self, *_):
        self.close()

    def __copy__(self):
        if self._lease is None:
            raise LeanBridgeError(4)
        return type(self)._from_lease(self._lease, self._handle)

    def __deepcopy__(self, memo):
        raise TypeError("Resource identity cannot be deep-copied; use retain()")

    def __reduce__(self):
        raise TypeError("Lean resources cannot be serialized")

    def __reduce_ex__(self, protocol):
        raise TypeError("Lean resources cannot be serialized")

    def __eq__(self, other):
        return (type(self) is type(other) and self._handle == other._handle
                and (self._lease is other._lease or (self._lease is not None
                     and other._lease is not None and self._lease.state is other._lease.state)))
`;
};
