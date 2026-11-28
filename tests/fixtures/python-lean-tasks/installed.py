"""A source-free consumer of an ordinary or reviewed Lean task wheel."""
import asyncio
import inspect
import os
from pathlib import Path
import sys
import warnings

import lean_timers as timers


async def phase(expected):
    async with asyncio.timeout(12):
        while timers.state() != expected:
            await asyncio.sleep(.005)


async def cancelled(task):
    try:
        await task
    except asyncio.CancelledError:
        assert task.cancelled()
    else:
        raise AssertionError("a cancelled task settled successfully")


def fd_count():
    return len(os.listdir("/proc/self/fd"))


async def exercise():
    assert inspect.iscoroutinefunction(timers.later)
    assert not inspect.iscoroutinefunction(timers.state)
    assert not hasattr(timers, "bind_hosts")
    assert await timers.immediate(2**18000) == 2**18000 + 1
    label = "λ\x00🦊"
    assert await timers.compute(label) == label + "!"
    assert await timers.start_checked(False, True, label) == timers.Err(label)
    assert await timers.start_checked(False, False, label) == timers.Ok(len(label))
    try:
        await timers.start_checked(True, False, label)
    except timers.LeanEIOError as exc:
        assert exc.payload == label and exc.declaration == "Timers.startChecked"
    else:
        raise AssertionError("typed startup failure was returned")
    try:
        await timers.start_io(True)
    except RuntimeError as exc:
        assert "start refused" in str(exc)
    else:
        raise AssertionError("IO failure was lost")
    assert await timers.start_io(False) == 47
    try:
        await timers.later(True)
    except TypeError:
        pass
    else:
        raise AssertionError("invalid argument started a task")
    warm = fd_count()
    timers.reset()
    abandoned = asyncio.create_task(timers.open_task(True, label))
    abandoned.cancel()
    await cancelled(abandoned)
    assert timers.state() == 0

    # The loop stays responsive even with exactly one Lean scheduler worker.
    job = asyncio.create_task(timers.open_task(True, label))
    delivered = []
    job.add_done_callback(delivered.append)
    await phase(1)
    # A suspended wait has a completion fd, a shared retirement fd and a selector.
    assert not job.done() and fd_count() == warm + 3
    timers.release()
    assert await job == timers.Ok(label)
    await asyncio.sleep(0)
    assert delivered == [job] and not job.cancel() and fd_count() == warm

    for cooperate in (True, False):
        timers.reset()
        job = asyncio.create_task(timers.open_task(cooperate, label))
        delivered = []
        job.add_done_callback(delivered.append)
        await phase(1)
        assert job.cancel()
        assert job.cancel()
        await cancelled(job)
        assert fd_count() == warm
        if cooperate:
            await phase(2)  # Lean actually saw IO.checkCanceled.
        else:
            timers.release()
            await phase(3)  # The discarded computation returned after cancellation.
        await asyncio.sleep(0)
        assert delivered == [job] and job.cancelled()
    assert await asyncio.gather(*(timers.later(n) for n in range(12))) == [n * 3 for n in range(12)]
    for _ in range(64):
        assert await timers.immediate(4) == 5
    assert fd_count() == warm


async def leave_pending(cooperate=True):
    timers.reset()
    asyncio.create_task(timers.open_task(cooperate, "shutdown"))
    await phase(1)
    # asyncio.run cancels and drains the pending task as part of loop shutdown.


if sys.argv[1:] == ["--exit-with-running-task"]:
    asyncio.run(leave_pending(False))
    assert timers.state() == 1
    print("exiting with uncancelled native work", flush=True)
    sys.exit(0)

asyncio.run(exercise())
asyncio.run(leave_pending())
asyncio.run(phase(2))
assert asyncio.run(timers.start_io(False)) == 47
with warnings.catch_warnings():
    warnings.simplefilter("ignore", DeprecationWarning)
    pid = os.fork()
if pid == 0:
    try:
        asyncio.run(timers.immediate(1))
    except RuntimeError:
        os._exit(0)
    os._exit(1)
assert os.waitpid(pid, 0)[1] == 0
stub = (Path(timers.__file__).parent / "__init__.pyi").read_text()
assert "async def later(n: int) -> int:" in stub and "def state() -> int:" in stub
print("real Lean tasks: completion, typed startup and returned errors, ordered cancellation, late result, loop shutdown, fork rejection and descriptor baseline")
