"""Exercise only the installed Python API; all progress counters belong to Lean."""
import asyncio
from contextlib import aclosing
from pathlib import Path

import lean_timers as t


def counts():
    return t.opens(), t.pulls(), t.closes()


def stream(*, base=0, count=3, fail=100, pause=False, cooperate=True, reject=False):
    return t.series(base, count, fail, pause, cooperate, reject, "λ\x00🦊")


async def phase(n):
    async with asyncio.timeout(8):
        while t.state() != n:
            await asyncio.sleep(.005)


async def checks():
    big = 2**18000
    a, p, c = counts()
    unused = stream()
    await unused.aclose()
    assert await anext(unused, "end") == "end" and counts() == (a, p, c)
    values = stream(base=big)
    async with values as it:
        assert it is values and aiter(it) is it and counts() == (a, p, c)
        assert await anext(it) == t.Ok(big) and counts() == (a + 1, p + 1, c)
        await asyncio.sleep(.01)
        assert counts() == (a + 1, p + 1, c)
        assert [x async for x in it] == [t.Err("λ\x00🦊"), t.Ok(big + 2)]
        assert counts() == (a + 1, p + 4, c + 1)
    await values.aclose()
    assert await anext(values, "end") == "end" and counts() == (a + 1, p + 4, c + 1)
    assert [x async for x in t.units(3)] == [None, None, None]
    assert [x async for x in t.units(0)] == []

    for manager in (lambda x: x, aclosing):
        a, p, c = counts()
        async with manager(stream()) as it:
            async for x in it:
                assert x == t.Ok(0)
                break
        assert counts() == (a + 1, p + 1, c + 1)
    a, p, c = counts()
    retained = stream()
    async for _ in retained:
        break
    assert counts() == (a + 1, p + 1, c)
    await retained.aclose()
    assert counts() == (a + 1, p + 1, c + 1)
    a, p, c = counts()
    try:
        await anext(stream(reject=True))
    except t.LeanEIOError as exc:
        assert exc.payload == "λ\x00🦊" and exc.declaration == "Timers.series"
    else:
        raise AssertionError("startup error lost")
    assert counts() == (a, p, c)
    try:
        await anext(stream(base=True))
    except TypeError:
        pass
    else:
        raise AssertionError("invalid input reached the cursor")
    assert counts() == (a, p, c)
    broken = stream(fail=1)
    assert await anext(broken) == t.Ok(0)
    try:
        await anext(broken)
    except t.LeanStreamError as exc:
        assert exc.payload == "λ\x00🦊" and exc.declaration == "Timers.series"
    else:
        raise AssertionError("step error became an element or exhaustion")
    assert await anext(broken, "end") == "end" and counts() == (a + 1, p + 2, c + 1)

    for cooperate, explicit_close in [(True, True), (False, True), (True, False)]:
        a, p, c = counts()
        t.reset()
        pending = stream(pause=True, cooperate=cooperate)
        result = asyncio.create_task(anext(pending, "end"))
        await phase(1)
        try:
            await anext(pending)
        except RuntimeError:
            pass
        else:
            raise AssertionError("a concurrent pull was accepted")
        assert not result.done() and counts() == (a + 1, p + 1, c)
        if explicit_close:
            await pending.aclose()
            assert await result == "end" and not result.cancelled()
        else:
            result.cancel()
            try:
                await result
            except asyncio.CancelledError:
                pass
            assert result.cancelled()
        await pending.aclose()
        assert counts() == (a + 1, p + 1, c + 1)
        if not cooperate:
            t.release()
        await phase(2 if cooperate else 3)
        assert await anext(pending, "end") == "end" and counts() == (a + 1, p + 1, c + 1)
    left, right = stream(base=5), stream(base=17)
    assert await asyncio.gather(anext(left), anext(right)) == [t.Ok(5), t.Ok(17)]
    delayed = anext(left)
    try:
        await asyncio.to_thread(asyncio.run, delayed)
    except RuntimeError as exc:
        assert "different event loop" in str(exc)
    else:
        raise AssertionError("a pull created here ran on another event loop")
    assert await anext(left) == t.Err("λ\x00🦊")
    await left.aclose()
    assert await anext(right) == t.Err("λ\x00🦊")
    await right.aclose()


async def leave_open():
    it = stream()
    assert await anext(it) == t.Ok(0)
    return it  # Retain it outside the loop; asyncio must close the actual producer.


asyncio.run(checks())
before = counts()
held = asyncio.run(leave_open())
assert counts() == tuple(x + 1 for x in before)
assert asyncio.run(anext(held, "end")) == "end"
stub = (Path(t.__file__).parent / "__init__.pyi").read_text()
assert "-> _LBStream[Ok[int] | Err[str]]:" in stub and "def aclose(self)" in stub
print("compiled streams: demand, exhaustion, scoped break, error ordering, pending close/cancel, late result and loop shutdown")
