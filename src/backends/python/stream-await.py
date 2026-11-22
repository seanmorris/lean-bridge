"""Embedded in packages with a compiler-checked Lean pull protocol."""

class LeanStreamError(Exception):
    def __init__(self, declaration, payload):
        self.declaration, self.payload = declaration, payload
        super().__init__(f"{declaration} failed while pulling a Lean stream")


class _LBCursorState:
    def __init__(self):
        self.closed = False
        self.loop = self.cursor = self.pending = None

    def check_loop(self):
        if self.loop is not None and self.loop is not _asyncio.get_running_loop():
            raise RuntimeError("Lean stream belongs to a different event loop")

    def close(self):
        if self.closed:
            return
        self.closed = True
        try:
            if self.pending is not None:
                self.pending.close()
        finally:
            if self.cursor is not None:
                _native._cursor_close(self.cursor)
            self.pending = self.cursor = self.loop = None


async def _lb_stream_items(state, start, decode):
    # A real async generator participates in asyncio.shutdown_asyncgens().
    try:
        if state.closed:
            return
        state.loop = _asyncio.get_running_loop()
        state.cursor = start()
        while not state.closed:
            state.pending = _LBWait(_native._cursor_next(state.cursor))
            raw = await state.pending.take()
            state.pending = None
            if state.closed or raw is None:  # closed during a pull, or Lean Option.none
                return
            yield decode(raw)
    finally:
        state.close()


class _LBStream:
    def __init__(self, start, decode):
        self._state = _LBCursorState()
        self._items = _lb_stream_items(self._state, start, decode)

    def __aiter__(self):
        return self

    async def __anext__(self):
        self._state.check_loop()
        return await self._items.__anext__()

    async def aclose(self):
        self._state.check_loop()
        self._state.close()
        if not self._items.ag_running:
            await self._items.aclose()

    async def __aenter__(self):
        self._state.check_loop()
        return self

    async def __aexit__(self, *exc):
        await self.aclose()
