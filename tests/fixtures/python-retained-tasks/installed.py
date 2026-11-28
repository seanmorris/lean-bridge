"""An installed consumer; no producer modules, compiler or private dispatch API."""
import asyncio
import gc
import os
import math
import select
import signal
import threading
import warnings
import weakref

import lean_retained as api


async def raises(typ, call):
    try:
        await call
    except typ as e:
        return e
    raise AssertionError(f"expected {typ.__name__}")


async def wait_phase(n):
    async with asyncio.timeout(6):
        while api.state() != n:
            await asyncio.sleep(.005)


def descriptors():
    result = {}
    for name in os.listdir("/proc/self/fd"):
        try:
            result[int(name)] = os.readlink("/proc/self/fd/" + name)
        except FileNotFoundError:
            pass  # transient descriptor used to read /proc itself
    return result


async def checks():
    loop = asyncio.get_running_loop()
    owner = threading.get_ident()
    assert api.plain(0) == 1  # initialize Lean without creating any callback or task
    baseline = descriptors()
    events = []
    text = "λ\0🎈"

    def first(x):
        assert threading.get_ident() == owner and asyncio.get_running_loop() is loop
        assert api.plain(40) == 41  # synchronous reentry while a real worker waits
        events.append(("a", x))
        return x + "A"

    def second(x):
        assert threading.get_ident() == owner
        events.append(("b", x))
        return x + "B"

    assert await api.during_start(first, second, text) == text + "ABA"
    assert events == [("a", text), ("b", text + "A"), ("a", text + "AB")]
    assert await api.repeat_call(text, first) == text + "AA"
    assert await api.terminal(False) == 42
    late = await raises(api.LeanTaskError, api.terminal(True))
    assert late.declaration == "Retained.terminal" and str(late) == "late IO"

    class Marker(Exception):
        pass

    marker = Marker("identical")

    def fail(_):
        raise marker

    assert await raises(Marker, api.repeat_call(text, fail)) is marker
    assert await raises(Marker, api.during_start(fail, second, text)) is marker
    assert await raises(Marker, api.during_start(first, fail, text)) is marker
    changed = await raises(api.LeanTaskError, api.replace_error(fail))
    assert changed.declaration == "Retained.replaceError" and str(changed) == str(marker)
    assert await api.recover(fail, 10) == api.Err("caught in Lean")
    huge = (1 << 5000) + 5
    assert await api.recover(lambda n: n + 3, huge) == api.Ok(huge + 3)
    values = [None, True, "🪁", text, b"\0\xff", huge, -huge, 255, 65535,
              (1 << 32) - 1, (1 << 64) - 1, (1 << 64) - 1, -128, -32768,
              -(1 << 31), -(1 << 63), -(1 << 63), -0.0, math.inf, None]
    seen = []
    def exchange(i):
        def accept(v):
            assert type(v) is type(values[i]) and v == values[i]
            if i == 17:
                assert math.copysign(1.0, v) == -1.0
            seen.append(i)
            return values[i + 1]
        return accept
    assert await api.scalar_tour(*(exchange(i) for i in range(19))) is None
    assert seen == list(range(19))
    assert await api.recover(lambda _: -1, 20) == api.Err("caught in Lean")
    assert isinstance(await raises(TypeError, api.repeat_call(text, lambda _: b"no")), TypeError)
    async def cannot_suspend(s):
        return s
    assert "awaitable" in str(await raises(TypeError, api.repeat_call(text, cannot_suspend)))
    assert isinstance(await raises(TypeError, api.repeat_call(text, None)), TypeError)
    assert await api.typed_start(lambda b: b[::-1], False, b"\x00\xffa") == b"a\xff\x00"
    typed = await raises(api.LeanEIOError, api.typed_start(fail, True, b""))
    assert typed.declaration == "Retained.typedStart" and typed.payload == "factory refused"
    del typed, changed, late, marker, fail

    calls = []
    def revoke(s):
        calls.append(s)
        handle.close()
        return s + "!"
    handle = api.RetainedCallback(revoke)
    err = await raises(RuntimeError, api.repeat_call("first", handle))
    assert str(err) == "retained callback is closed" and calls == ["first"]
    del err, handle, revoke

    def sleeping(_):
        raise AssertionError("expired Python callback executed")
    ref = weakref.ref(sleeping)
    assert await api.remember(sleeping) == 17
    del sleeping
    gc.collect()
    assert ref() is None
    stale = await raises(api.LeanTaskError, api.use_expired())
    assert "expired" in str(stale)
    api.forget()
    del stale

    def cancel_self(s):
        pending.cancel()
        return s
    pending = asyncio.create_task(api.repeat_call("cut", cancel_self))
    await raises(asyncio.CancelledError, pending)
    api.reset()
    pending = asyncio.create_task(api.cancel_late(lambda _: 1))
    await wait_phase(1)
    pending.cancel()
    await raises(asyncio.CancelledError, pending)
    api.release()
    await wait_phase(2)  # inner produced after its owner's cancellation is also cancelled
    del pending

    api.reset()
    invoked = []
    callback_fds = []
    add_reader = loop.add_reader
    def observe(fd, fn, *args):
        if getattr(fn, "__name__", None) == "pump":
            callback_fds.append(fd)
        return add_reader(fd, fn, *args)
    loop.add_reader = observe
    try:
        pending = asyncio.create_task(api.queued(lambda n: invoked.append(n) or n))
        await wait_phase(3)
    finally:
        loop.add_reader = add_reader
    # Fork with a live owner. The child must neither touch inherited Lean
    # locks nor invalidate the parent's outstanding callback and completion fds.
    with warnings.catch_warnings(record=True) as notices:
        warnings.simplefilter("always", DeprecationWarning)
        pid = os.fork()
    assert all(w.category is DeprecationWarning and "fork()" in str(w.message) for w in notices)
    if pid == 0:
        signal.alarm(3)
        try:
            asyncio.run(api.repeat_call("child", str))
        except RuntimeError as e:
            os._exit(0 if "process" in str(e) or "runtime" in str(e) else 2)
        os._exit(3)
    assert os.waitstatus_to_exitcode(os.waitpid(pid, 0)[1]) == 0
    # A busy event loop hasn't dispatched the callback; its readable eventfd
    # proves a real worker is waiting, without a guessed delay.
    assert len(callback_fds) == 1
    fd = callback_fds[0]
    assert fd not in baseline and descriptors()[fd] == "anon_inode:[eventfd]"
    assert not select.select([fd], [], [], 0)[0]
    api.release()
    assert select.select([fd], [], [], 5)[0] == [fd]
    pending.cancel()
    await raises(asyncio.CancelledError, pending)
    await wait_phase(4)
    assert invoked == []

    # Concurrent calls must never exchange their ports, callables, or faults.
    async def independent(i):
        return await api.repeat_call(str(i), lambda x: x + str(i))
    assert await asyncio.gather(*(independent(i) for i in range(12))) == [str(i) * 3 for i in range(12)]
    gc.collect()
    async with asyncio.timeout(6):
        while descriptors() != baseline:
            await asyncio.sleep(.01)
    print("installed retained callbacks: owner-loop and factory reentry, exact exceptions, typed errors, self-close, expiry, cancellation and descriptor baseline passed")


asyncio.run(asyncio.wait_for(checks(), timeout=25))
