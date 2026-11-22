import asyncio
import lean_effects as api


async def main():
    assert api.read_boot() == "from-app"
    assert api.observe("state") == 37
    assert await api.worker("state") == 37
    cursor = api.walk("state")
    assert await anext(cursor) == 37
    await cursor.aclose()
    assert api.observe("state") == 0


asyncio.run(main())
