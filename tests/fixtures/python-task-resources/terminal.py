"""Observe terminal cleanup while the consumer still holds the cursor and its first item."""
import asyncio
import importlib
import sys

for package in sys.argv[1:]:
    importlib.import_module(package)
import lease_desk as desk
import lease_depot as depot
from observe import descriptors, snapshot


async def exhausted(cursor):
    try:
        await anext(cursor)
    except StopAsyncIteration:
        return
    raise AssertionError("a terminal cursor yielded another item")


async def exercise(mode):
    before = depot.closes()
    live, fds = snapshot().live, descriptors()
    original = desk.issue(41)
    cursor = depot.tickets(original, mode == "failure")
    item = await anext(cursor)
    assert item.same_resource(original)
    original.close()
    assert depot.closes() == before
    if mode == "failure":
        try:
            await anext(cursor)
        except depot.LeanStreamError as failure:
            # Python's public error names the exported cursor factory.
            assert failure.declaration == "Depot.tickets" and failure.payload.same_resource(item)
            payload = failure.payload
        else:
            raise AssertionError("expected the typed step error")
    elif mode == "end":
        await exhausted(cursor)
    else:
        # Control: a suspended, nonterminal cursor only closes after our request.
        await cursor.aclose()
    # In the terminal branches neither context-manager exit nor aclose has run.
    assert depot.closes() == before + 1
    await exhausted(cursor)
    assert desk.count(item) == 41
    item.close()
    if mode == "failure":
        assert snapshot().live == live + 1 and descriptors() == fds + 1
        depot.add(payload, 1)
        assert desk.count(payload) == 42
        payload.close()
        assert snapshot().live == live and descriptors() == fds
    await cursor.aclose()
    await cursor.aclose()
    assert depot.closes() == before + 1 and snapshot().live == live and descriptors() == fds


async def main():
    desk.issue(0).close()
    depot.reset()
    for mode in ("end", "failure", "early"):
        await exercise(mode)


asyncio.run(main())
print("exhaustion and typed failure finalized before aclose; early close finalized on request; last error owner usable, zero owner and descriptor delta")
