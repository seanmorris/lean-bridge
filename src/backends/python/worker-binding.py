"""One application-class binding on its Python interpreter and event loop."""
import asyncio as _asyncio
from contextvars import ContextVar as _ContextVar
from functools import wraps as _wraps
from weakref import WeakSet as _WeakSet

_lb_current_binding = _ContextVar(__name__ + ".binding", default=None)


def _lb_binding():
    owner = _lb_current_binding.get()
    if owner is None or not owner.open:
        raise RuntimeError("enter bind_hosts before calling this component")
    return owner


class _LBHostBinding:
    def __init__(self, classes):
        self.classes = classes
        self.open = False
        self.loop = self.token = None
        self.jobs, self.ports, self.streams = set(), set(), _WeakSet()
        self.queued = _WeakSet()
        self.waits = set()

    def __enter__(self):
        if self.classes is None:
            raise RuntimeError("binding has already been used")
        _native._bind(*self.classes)
        self.classes = None
        self.token = _lb_current_binding.set(self)
        self.open = True

    async def __aenter__(self):
        return self.__enter__()

    def stop(self):
        if not self.open:
            return ()
        # Refuse self-disposal before detaching the context or any readers.
        _native._may_unbind()
        _lb_current_binding.reset(self.token)
        self.open = False
        jobs = tuple(self.jobs)
        errors = []
        def finish(fn):
            try:
                fn()
            except BaseException as error:
                errors.append(error)
        for job in jobs:
            finish(job.cancel)
        for call in tuple(self.queued):
            finish(call.revoke)
        for port in tuple(self.ports):
            finish(port.revoke)
        for stream in tuple(self.streams):
            finish(stream.revoke)
        for wait in tuple(self.waits):
            finish(wait.close)
        self.token = self.loop = None
        finish(_native._unbind)
        if errors:
            if len(errors) == 1:
                raise errors[0]
            raise BaseExceptionGroup("could not release Python worker binding", errors)
        return jobs

    def __exit__(self, *exc):
        self.stop()

    async def __aexit__(self, *exc):
        jobs = self.stop()
        if jobs:
            await _asyncio.gather(*jobs, return_exceptions=True)

    async def run(self, start):
        if not self.open or _lb_binding() is not self:
            raise RuntimeError("Python worker binding has expired")
        loop = _asyncio.get_running_loop()
        if self.loop is not None and self.loop is not loop:
            raise RuntimeError("Python worker binding belongs to a different loop")
        self.loop = loop
        # Cancel just this operation, never the user's unrelated enclosing task.
        job = loop.create_task(start())
        del start
        self.jobs.add(job)
        try:
            return await job
        finally:
            self.jobs.discard(job)
            if self.open:
                _native._worker_sweep()


class _LBQueuedCall:
    """A coroutine created now may never be awaited. Unbinding drops its inputs."""
    def __init__(self, owner, fn, args, kw):
        self.owner, self.call = owner, (fn, args, kw)
        owner.queued.add(self)

    def revoke(self):
        self.call = None
        self.owner.queued.discard(self)

    def __call__(self):
        fn, args, kw = self.call
        self.revoke()
        return fn(*args, **kw)


def _lb_bound_task(fn):
    @_wraps(fn)
    def submit(*args, **kw):
        owner = _lb_binding()
        return owner.run(_LBQueuedCall(owner, fn, args, kw))
    return submit


def _lb_bound_call(fn):
    @_wraps(fn)
    def call(*args, **kw):
        _lb_binding()
        return fn(*args, **kw)
    return call


class _LBBoundStream:
    def __init__(self, group, stream):
        self.group, self.stream = group, stream
        self.busy = False
        group.streams.add(self)

    def revoke(self):
        stream, self.stream = self.stream, None
        self.group.streams.discard(self)
        if stream is not None:
            stream._state.close()

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.stream is None:
            raise StopAsyncIteration
        if self.busy:
            raise RuntimeError("a Lean stream pull is already running")
        self.busy = True
        try:
            return await self.group.run(self.stream.__anext__)
        except BaseException:
            self.revoke()
            raise
        finally:
            self.busy = False

    async def aclose(self):
        stream = self.stream
        self.revoke()
        if stream is not None:
            await stream.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        await self.aclose()


def _lb_bound_stream(fn):
    @_wraps(fn)
    def submit(*args, **kw):
        return _LBBoundStream(_lb_binding(), fn(*args, **kw))
    return submit
