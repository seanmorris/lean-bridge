"""Application calls use only the installed Python APIs; observe.py checks native cleanup."""
import asyncio
import copy
import gc
import importlib
import os
import sys
import threading
import warnings
from contextlib import ExitStack
from pathlib import Path

for package in sys.argv[1:]:
    importlib.import_module(package)
import lease_desk as desk
import lease_depot as depot
import other_desk as foreign
from observe import snapshot, retire, descriptors, watch_descriptors


def rejects(error, call, *args):
    try:
        call(*args)
    except error as exc:
        return exc
    raise AssertionError(f"expected {error} from {call}")


async def refuses(error, call):
    try:
        await call
    except error as exc:
        return exc
    raise AssertionError(f"expected {error} from awaitable")


async def until(condition):
    deadline = asyncio.get_running_loop().time() + 20
    while not condition():
        if asyncio.get_running_loop().time() > deadline:
            raise AssertionError("condition did not settle")
        await asyncio.sleep(.005)


async def exchange():
    assert desk.Ticket is depot.Ticket and desk.Badge is depot.Badge
    assert foreign.Ticket is not desk.Ticket and foreign.Ticket.__name__ == desk.Ticket.__name__
    rejects(TypeError, desk.Ticket)
    rejects(TypeError, object.__new__, desk.Ticket)
    rejects(TypeError, type, "Fake", (desk.Ticket,), {})
    with ExitStack() as stack:
        use = stack.enter_context
        t, distinct = use(desk.issue(40)), use(desk.issue(40))
        alias, held = use(depot.alias(t)), use(t.retain())
        assert isinstance(t, depot.Ticket) and alias is not t and held is not t
        assert alias.same_resource(t) and not t.same_resource(distinct)
        depot.add(alias, 2)
        assert desk.count(held) == 42 and depot.count(distinct) == 40
        t.close(); t.close()
        assert t.closed and not alias.closed
        rejects(ValueError, desk.count, t); rejects(ValueError, depot.count, t)
        rejects(ValueError, t.retain); rejects(TypeError, copy.copy, held)
        outsider, badge = use(foreign.issue(12)), use(depot.badge(1))
        for value in [None, object(), badge, outsider]:
            rejects(TypeError, desk.count, value); rejects(TypeError, held.same_resource, value)
        rejects(TypeError, foreign.count, held)
        for call in [lambda: depot.count(held), held.close, held.retain]:
            assert isinstance(await asyncio.to_thread(rejects, RuntimeError, call), RuntimeError)
        # A child must reject its inherited broker before touching native locks.
        with warnings.catch_warnings():
            # This negative child only checks the lock-free PID guard and _exit.
            warnings.filterwarnings("ignore", message=".*multi-threaded.*", category=DeprecationWarning)
            child = os.fork()
        if not child:
            try:
                rejects(RuntimeError, desk.count, held); rejects(RuntimeError, held.close)
                os._exit(0)
            except BaseException:
                os._exit(1)
        assert os.waitpid(child, 0)[1] == 0
        err = rejects(desk.LeanEIOError, desk.check_ticket, True, held)
        assert err.declaration == "Desk.checkTicket" and use(err.payload).same_resource(held)
        assert use(desk.check_ticket(False, held)).same_resource(held)
        failed = await refuses(depot.LeanEIOError, depot.checked(True, held))
        assert failed.declaration == "Depot.checked" and use(failed.payload).same_resource(held)
        assert use(await depot.checked(False, held)).same_resource(held)
        other = desk.issue(13)
        failed = rejects(desk.LeanEIOError, desk.check_ticket, True, other)
        other.close()
        assert depot.count(use(failed.payload)) == 13
        def change(n):
            assert depot.count(held) == n
            return n + 5
        task = asyncio.create_task(depot.revisit(held, change))
        result = use(await task)
        assert await task is result and result.same_resource(held) and desk.count(result) == 47
        original = LookupError("original callback")
        def fail(n):
            raise original
        assert await refuses(LookupError, depot.revisit(held, fail)) is original
        for mode in ("exhaust", "reject", "early", "cancel"):
            before = depot.closes()
            async with depot.tickets(held, mode == "reject") as stream:
                with await anext(stream) as item:
                    assert item.same_resource(held) and desk.count(item) == 47
                if mode == "exhaust":
                    await refuses(StopAsyncIteration, anext(stream))
                elif mode == "reject":
                    failure = await refuses(depot.LeanStreamError, anext(stream))
                    with failure.payload as why:
                        assert why.same_resource(held)
                elif mode == "cancel":
                    pull = asyncio.create_task(anext(stream)); pull.cancel()
                    await refuses(asyncio.CancelledError, pull)
            await stream.aclose()
            assert depot.closes() == before + 1


async def main():
    depot.reset()
    base = descriptors()
    await exchange()
    gc.collect()
    await until(lambda: snapshot().live == 0 and descriptors() == base)
    # The last Python reference disappears on a worker. The next owner call in
    # the *other* component drains the release queue without running Lean there.
    box = [desk.issue(9)]
    worker = threading.Thread(target=box.clear); worker.start(); worker.join()
    assert not box and snapshot().live == 1 and descriptors() == base + 1
    depot.state()
    assert snapshot().live == 0 and descriptors() == base
    for mode in ("settle", "cancel-late", "cooperate"):
        depot.reset()
        t = desk.issue(30)
        job = asyncio.create_task(depot.pending(t, mode == "cooperate"))
        await until(lambda: depot.state() == 1)
        t.close()
        assert descriptors() == base + 1
        if mode == "settle":
            depot.release()
            with await job as settled:
                assert desk.count(settled) == 31
        else:
            job.cancel()
            await refuses(asyncio.CancelledError, job)
            if mode == "cancel-late":
                depot.release()
        await until(lambda: depot.state() == (2 if mode == "cooperate" else 3)
                    and snapshot().live == 0 and descriptors() == base)
    poll_base = watch_descriptors()
    probe = depot.make(1, "retire-probe")
    stream = depot.tickets(probe, False)
    last = await anext(stream)
    assert probe.same_resource(last)
    before = snapshot()
    assert (before.state, before.init, before.components, before.attached) == (2, 1, 3, 3)
    # Prove retirement itself wakes *every* blocked selector, without a queued
    # callback, a task completing, or a timeout silently cancelling the job.
    depot.reset()
    loop = asyncio.get_running_loop()
    add, waiting = loop.add_reader, set()
    def registered(fd, callback, *args):
        add(fd, callback, *args)
        if getattr(callback, "__name__", None) == "wake":
            waiting.add(fd)
    loop.add_reader = registered
    try:
        jobs = [asyncio.create_task(depot.pending(probe, True)) for _ in range(2)]
        await until(lambda: len(waiting) == 2 and depot.state() == 1)
    finally:
        loop.add_reader = add
    retire()
    done, pending = await asyncio.wait(jobs, timeout=10)
    if pending:
        for job in pending:
            job.cancel()
        await asyncio.gather(*jobs, return_exceptions=True)
        raise AssertionError("runtime retirement did not wake pending tasks")
    assert len(done) == 2
    for job in done:
        assert "runtime" in str(await refuses(RuntimeError, job))
    rejects(RuntimeError, desk.count, probe); rejects(RuntimeError, probe.retain)
    probe.close(); last.close(); await stream.aclose()
    await until(lambda: snapshot().live == 0 and descriptors() == base and watch_descriptors() == poll_base)
    assert snapshot().state == 3 and not Path("retired-close-ran.txt").exists()
    print("three components, one runtime, zero live identities, zero leaked descriptors")


asyncio.run(main())
