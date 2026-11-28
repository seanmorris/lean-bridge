"""Run with an installed, moved wheel and no author tools on PATH."""
import asyncio
import gc
import threading
import weakref
from contextvars import copy_context

import lean_meter as meter


class Box:
    def __init__(self, n):
        self.n = n

    def read(self):
        return self.n


class Child(Box):
    pass


async def main():
    a, b = Box(4), Child(11)
    thread = threading.get_ident()
    outside = copy_context()
    scope = meter.bind_hosts(Box=Box)
    async with scope:
        def swap(value):
            assert value is a and threading.get_ident() == thread
            assert meter.read_level(value) == 4
            try:
                scope.__exit__(None, None, None)
            except RuntimeError as e:
                assert "callback" in str(e)
            else:
                raise AssertionError("callback closed its own binding")
            return b

        assert await meter.relay(a, swap) is b
        assert await meter.choose(11, lambda n: b if n == 11 else None) is b
        assert await meter.project(b, lambda value: value.read()) == 11
        ex = ValueError("application failure")

        def raises(_):
            raise ex

        assert await meter.fallback(a, raises) is a
        async def invalid_awaitable(_):
            return a
        for invalid in (lambda _: object(), invalid_awaitable):
            try:
                await meter.fallback(a, invalid)
            except TypeError:
                pass
            else:
                raise AssertionError("Lean caught an invalid Python return as IO.Error")
        class Interrupt(BaseException):
            pass
        interrupted = Interrupt()
        def interrupt(_):
            raise interrupted
        try:
            await meter.fallback(a, interrupt)
        except Interrupt as e:
            assert e is interrupted
        else:
            raise AssertionError("Lean caught a Python control-flow exception")
        try:
            outside.run(meter.read_level, b)
        except RuntimeError:
            pass
        else:
            raise AssertionError("unbound context borrowed the interpreter thread's binding")
        try:
            await meter.project(a, raises)
        except ValueError as e:
            assert e is ex
        else:
            raise AssertionError("lost Python exception")
        result = await meter.outcome(a)
        assert isinstance(result, meter.Err) and result.error is a
        try:
            await meter.reject(a)
        except meter.LeanEIOError as e:
            assert e.payload is a
        else:
            raise AssertionError("lost EIO failure")
        async with meter.open_cursor(b) as stream:
            assert await anext(stream) is b
            try:
                await anext(stream)
            except meter.LeanStreamError as e:
                assert e.payload is b
            else:
                raise AssertionError("lost cursor failure")
        async with meter.open_error_cursor(b) as stream:
            assert await anext(stream) is b
            try:
                await anext(stream)
            except meter.LeanStreamIOError as e:
                assert e.declaration == "Workers.openErrorCursor" and "IO.Error" in str(e)
            else:
                raise AssertionError("lost cursor IO failure")
        unused = Box(99)
        unused_ref = weakref.ref(unused)
        saved = meter.relay(unused, lambda x: x)
        never = meter.open_cursor(unused)
        del unused
        old_context = copy_context()
        # Park the caller before leaving; no callback from this binding can run
        # in the following binding, even when it uses the identical class.
        item = Box(123)
        weak = weakref.ref(item)
        pending = asyncio.create_task(meter.project(item, lambda x: x.read()))
        del item
        await asyncio.sleep(0)
    try:
        await pending
    except asyncio.CancelledError:
        pass
    else:
        raise AssertionError("scope exit did not cancel pending work")
    gc.collect()
    assert weak() is None and unused_ref() is None
    async with meter.bind_hosts(Box=Box):
        try:
            old_context.run(meter.read_level, b)
        except RuntimeError:
            pass
        else:
            raise AssertionError("stale context entered a newer binding")
        try:
            await saved
        except RuntimeError as e:
            assert "expired" in str(e)
        else:
            raise AssertionError("old coroutine entered new binding")
        assert await anext(never, None) is None
        assert await meter.relay(b, lambda value: value) is b
    print("Python worker: owner thread, nominal identity, scoped shutdown, callbacks, cursor and typed errors passed")


asyncio.run(main())
