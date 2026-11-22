"""Owner-loop dispatch for callbacks retained by an exported Lean task."""
from typing import Callable as _Callable, Generic as _Generic, TypeVar as _TypeVar
import inspect as _cb_inspect

_CBArg = _TypeVar("_CBArg")
_CBReply = _TypeVar("_CBReply")


class RetainedCallback(_Generic[_CBArg, _CBReply]):
    """Optional explicit revocation; passing an ordinary callable works too."""

    def __init__(self, callback: _Callable[[_CBArg], _CBReply]):
        if not callable(callback):
            raise TypeError("expected a callable")
        self._callback = callback

    def close(self) -> None:
        self._callback = None

    def __call__(self, value: _CBArg) -> _CBReply:
        callback = self._callback
        if callback is None:
            raise RuntimeError("retained callback is closed")
        return callback(value)


class _LBCallbacks:
    def __init__(self, callbacks):
        if not all(callable(f) for f in callbacks.values()):
            raise TypeError("expected a callable for each Lean callback")
        self.loop = _asyncio.get_running_loop()
        self.owner = _asyncio.current_task()
        if self.owner is None:
            raise RuntimeError("a retained Lean callback needs an asyncio task")
        self.cancels = self.owner.cancelling()
        self.callbacks = {k: self.guard(f) for k, f in callbacks.items()}
        self.faults = {}
        self.failure = None

    def guard(self, f):
        def invoke(value):
            if self.owner.cancelling() > self.cancels:
                raise RuntimeError("retained callback task was cancelled")
            reply = f(value)
            if _cb_inspect.isawaitable(reply):
                if _cb_inspect.iscoroutine(reply):
                    reply.close()
                raise TypeError("a retained Lean IO callback must return a value, not an awaitable")
            return reply
        return invoke

    def __enter__(self):
        self.port = _native._cb_open()
        try:
            self.fd = _native._cb_fd(self.port)
            self.loop.add_reader(self.fd, self.pump)
        except BaseException:
            _native._cb_close(self.port)
            raise
        return self

    def pump(self):
        if self.port is None:
            return
        try:
            _native._cb_drain(self.port, self.callbacks, self.faults)
        except BaseException as error:
            self.failure = error
            self.owner.cancel()

    def __exit__(self, kind, value, tb):
        port, self.port = self.port, None
        try:
            if not self.loop.is_closed():
                self.loop.remove_reader(self.fd)
        finally:
            _native._cb_close(port)
            self.callbacks.clear()
            self.faults.clear()
            self.owner = None
        if self.failure is not None:
            raise self.failure
