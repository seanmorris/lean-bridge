"""Embedded in generated Linux CPython packages that export Lean tasks."""
import asyncio as _asyncio


async def _lb_await(ticket):
    try:
        if not _native._task_ready(ticket):
            loop = _asyncio.get_running_loop()
            ready = loop.create_future()
            fd = _native._task_fd(ticket)

            def wake():
                if not ready.done():
                    ready.set_result(None)

            loop.add_reader(fd, wake)
            try:
                await ready
            finally:
                loop.remove_reader(fd)
        return _native._task_take(ticket)
    finally:
        _native._task_close(ticket)
