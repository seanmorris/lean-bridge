import asyncio
import inspect
import lean_companions as api

assert api.plain(41) == 42
assert api.bump(3) == 3
work = api.doubled(21)
assert inspect.isawaitable(work)
assert asyncio.run(work) == 42
assert api.bump(4) == 7
api.finish("state")
