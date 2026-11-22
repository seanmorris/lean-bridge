"""Installed stream-only package: no tasks, host imports or explicit exports."""
import asyncio

import lean_signals as signals


async def main():
    assert not any(hasattr(signals, n) for n in ("bind_hosts", "pull", "stop"))
    big = 2**14000
    async with signals.constant(big) as it:
        assert await anext(it) == big and await anext(it) == big
    assert [v async for v in signals.checked(0, False)] == []
    try:
        await anext(signals.checked(1, True))
    except RuntimeError as exc:
        assert "signal unavailable" in str(exc)
    else:
        raise AssertionError("IO startup error lost")
    async with signals.checked(37, False) as it:
        assert await anext(it) == 37
    print("installed standalone stream-only package: pure and IO factories, shared pull/close")


asyncio.run(main())
