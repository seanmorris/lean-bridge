"""Cancel the consumer task after Lean has actually parked a pull, not before it starts."""
import asyncio
import lean_timers as t
from observe import snapshot, watch_descriptors


async def until(predicate):
    async with asyncio.timeout(15):
        while not predicate():
            await asyncio.sleep(.005)


async def exercise(cooperate):
    t.reset()
    before = (t.opens(), t.pulls(), t.closes())
    leases = snapshot().live
    assert leases == 0
    fds = watch_descriptors()
    cursor = t.series(41, 3, 10, True, cooperate, False, "in flight")
    settled = []
    pull = asyncio.create_task(anext(cursor))
    pull.add_done_callback(lambda job: settled.append(job.cancelled()))
    await until(lambda: t.state() == 1)
    assert not pull.done() and snapshot().live == 2
    assert (t.opens(), t.pulls(), t.closes()) == (before[0]+1, before[1]+1, before[2])
    assert pull.cancel("consumer cancelled a parked pull")
    try:
        await pull
    except asyncio.CancelledError as error:
        assert error.args == ("consumer cancelled a parked pull",)
    else:
        raise AssertionError("cancellation became success or exhaustion")
    # No aclose(), context manager, del, or garbage collection has run.
    assert t.closes() == before[2]+1 and watch_descriptors() == fds
    await until(lambda: settled == [True])
    if not cooperate:
        assert t.state() == 1 and snapshot().live == 1
        t.release()  # Let the worker compute the item the caller must never see.
    await until(lambda: t.state() == (2 if cooperate else 3) and snapshot().live == leases)
    assert await anext(cursor, "end") == "end"
    assert (t.opens(), t.pulls(), t.closes()) == tuple(n+1 for n in before)
    await cursor.aclose()
    await cursor.aclose()
    assert settled == [True] and snapshot().live == leases and watch_descriptors() == fds


async def main():
    await exercise(False)
    await exercise(True)


asyncio.run(main())
print("parked cooperative and noncooperative pulls: one cancellation, finalized before aclose, no late item, zero owner and selector delta")
