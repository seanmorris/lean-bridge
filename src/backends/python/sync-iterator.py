"""Immediate pulls on the component's owning thread, without an event loop."""
import atexit as _cursor_atexit
from os import getpid as _cursor_getpid
from weakref import WeakSet as _CursorSet


class LeanStreamError(Exception):
    def __init__(self, declaration, payload):
        self.declaration, self.payload = declaration, payload
        super().__init__(f"{declaration} failed while pulling a Lean iterator")


_open_iterators = _CursorSet()
_cursor_process = None


class _LBIterator:
    def __init__(self, start, decode):
        self._start, self._decode = start, decode
        self._cursor, self._busy, self._closed = None, False, False

    def __iter__(self):
        return self

    def __next__(self):
        if self._closed:
            raise StopIteration
        _native._cursor_owner()
        if self._busy:
            raise RuntimeError("cannot reenter a synchronous Lean pull")
        self._busy = True
        try:
            if self._cursor is None:
                self._cursor = self._start()
                self._start = None
                _track_lean_iterator(self)
            step = _native._cursor_next(self._cursor)
            if step is None:
                raise StopIteration
            return self._decode(step)
        except BaseException:
            self._finish()
            raise
        finally:
            self._busy = False

    def _finish(self):
        self._closed = True
        cursor, self._cursor = self._cursor, None
        self._start = self._decode = None
        _open_iterators.discard(self)
        if cursor is not None:
            _native._cursor_close(cursor)

    def close(self):
        if self._closed:
            return
        _native._cursor_owner()
        if self._busy:
            raise RuntimeError("cannot close an active Lean pull")
        self._finish()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


def _track_lean_iterator(cursor):
    global _cursor_process
    if _cursor_process is None:
        _cursor_atexit.register(_close_lean_iterators)
        _cursor_process = _cursor_getpid()
    _open_iterators.add(cursor)


def _close_lean_iterators():
    # Importing in another interpreter does not establish ownership. A forked
    # child inherits this hook, but not the right to enter the parent's Lean heap.
    if _cursor_process != _cursor_getpid():
        return
    for cursor in list(_open_iterators):
        cursor.close()
    _native._cursor_owner()
