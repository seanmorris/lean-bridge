"""Exercise two asyncio loops on one thread against the installed Timers cursor."""
import asyncio
import json
import lean_timers as t
from observe import snapshot, watch_descriptors


def counts():
    return (t.opens(), t.pulls(), t.closes())


async def until(check):
    async with asyncio.timeout(15):
        while not check():
            await asyncio.sleep(.005)


def foreign_loop():
    owner, other = asyncio.new_event_loop(), asyncio.new_event_loop()
    t.reset()
    initial = counts()
    leases, descriptors = snapshot().live, watch_descriptors()
    assert leases == 0
    cursor = t.series(41, 3, 10, True, False, False, "parked")
    settled = []

    async def park():
        job = asyncio.create_task(anext(cursor))
        job.add_done_callback(lambda done: settled.append(done.result().value))
        await until(lambda: t.state() == 1)
        assert not job.done() and snapshot().live == 2
        return job

    async def refuse_foreign():
        rejected = []
        for name, action in [("anext", lambda: anext(cursor)), ("aclose", cursor.aclose)]:
            try:
                await action()
            except RuntimeError as exc:
                assert "different event loop" in str(exc), repr(exc)
                rejected.append(name)
            else:
                raise AssertionError(f"foreign {name} took ownership")
        return rejected

    try:
        job = owner.run_until_complete(park())
        parked = counts(), snapshot().live, watch_descriptors()
        assert parked[0] == (initial[0]+1, initial[1]+1, initial[2])
        rejected = other.run_until_complete(refuse_foreign())
        assert (counts(), snapshot().live, watch_descriptors()) == parked
        assert not job.done() and not settled and t.state() == 1
        t.release()
        assert owner.run_until_complete(asyncio.wait_for(job, 15)) == t.Ok(41)
        owner.run_until_complete(cursor.aclose())
        owner.run_until_complete(cursor.aclose())
        assert settled == [41] and counts() == tuple(n+1 for n in initial)
        assert watch_descriptors() == descriptors and snapshot().live == leases
        return {"rejected": rejected, "settled": settled, "finalizers": 1, "owners": leases}
    finally:
        t.release()
        owner.run_until_complete(owner.shutdown_asyncgens())
        other.run_until_complete(other.shutdown_asyncgens())
        other.close()
        owner.close()


async def refused_reader():
    # Exercise actual native work on a selector loop whose reader hook refuses
    # registration. This is not an install on a different OS or event-loop backend.
    t.reset()
    loop = asyncio.get_running_loop()
    original, marker = loop.add_reader, NotImplementedError("reader unavailable")
    attempts = []

    def fail(fd, *args):
        attempts.append(fd)
        raise marker

    cursor = t.series(70, 2, 10, True, False, False, "not delivered")
    before, fds = counts(), watch_descriptors()
    loop.add_reader = fail
    try:
        try:
            await anext(cursor)
        except NotImplementedError as exc:
            assert exc is marker
        else:
            raise AssertionError("missing reader became an item or exhaustion")
    finally:
        loop.add_reader = original
        t.release()
    await until(lambda: snapshot().live == 0)
    assert len(attempts) == 1 and counts() == tuple(n+1 for n in before)
    assert await anext(cursor, "end") == "end"
    await cursor.aclose()
    assert counts() == tuple(n+1 for n in before) and watch_descriptors() == fds
    fresh = t.series(73, 1, 10, False, True, False, "fresh")
    assert await anext(fresh) == t.Ok(73)
    await fresh.aclose()
    assert snapshot().live == 0 and watch_descriptors() == fds
    return {"registrationAttempts": len(attempts), "finalizersBeforeClose": 1, "fresh": 73, "owners": 0}


print(json.dumps({"foreignLoop": foreign_loop(), "refusedReader": asyncio.run(refused_reader())}))
