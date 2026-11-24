"""Embedded in generated Linux CPython packages that export Lean tasks."""
import asyncio as _asyncio


class _LBWait:
    _binding = None

    def __init__(self, ticket):
        self.ticket = ticket
        self.loop = self.ready = self.fd = None
        self.binding = self._binding() if self._binding is not None else None
        if self.binding is not None:
            self.binding.waits.add(self)

    def wake(self):
        if self.ready is not None and not self.ready.done():
            self.ready.set_result(None)

    def close(self):
        ticket, self.ticket = self.ticket, None
        if ticket is None:
            return
        try:
            if self.fd is not None and not self.loop.is_closed():
                self.loop.remove_reader(self.fd)
                self.wake()
        finally:
            self.fd = self.ready = self.loop = None
            try:
                _native._task_close(ticket)
            finally:
                if self.binding is not None:
                    self.binding.waits.discard(self)
                    self.binding = None

    async def take(self):
        try:
            if not _native._task_ready(self.ticket):
                self.loop = _asyncio.get_running_loop()
                self.ready = self.loop.create_future()
                fd = _native._task_fd(self.ticket)
                self.loop.add_reader(fd, self.wake)
                self.fd = fd
                await self.ready
            if self.ticket is not None:
                return _native._task_take(self.ticket)
        finally:
            self.close()


async def _lb_await(ticket):
    if _native._task_ready(ticket):
        try:
            return _native._task_take(ticket)
        finally:
            _native._task_close(ticket)
    return await _LBWait(ticket).take()
