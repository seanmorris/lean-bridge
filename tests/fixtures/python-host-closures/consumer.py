"""Application-side tests: no native API, numeric handles or source checkout."""
import threading
import weakref
import copy
import pickle
import asyncio
from contextvars import Context, copy_context
from pathlib import Path
import lean_meter as meter


class Box:
    def __init__(self, fn):
        self.fn = fn

    def read(self):
        return self.fn()


def refuses(kind, call):
    try:
        call()
    except kind:
        return
    raise AssertionError("unexpectedly accepted")


scope = meter.bind_hosts(Box=Box)
with scope:
    box, other = Box(lambda: 40), Box(lambda: 2)
    refuses(TypeError, meter.LeanClosure)
    orig = weakref.ref(box)
    kept = meter.remember(box)
    number = meter.reader(box)
    assert not number.closed and number(2) == 42
    for op in (copy.copy, copy.deepcopy, pickle.dumps):
        refuses(TypeError, lambda: op(kept))
    prior = copy_context()
    calls = []
    probe = Box(lambda: calls.append(1) or 1)
    refuses(RuntimeError, lambda: Context().run(meter.remember, probe))
    assert not calls
    refuses(RuntimeError, lambda: Context().run(number, 3))
    refuses(RuntimeError, lambda: Context().run(number.close))
    assert not number.closed
    if hasattr(meter, "job"):
        async def work():
            assert await meter.job(5) == 5
            if hasattr(meter, "echo_box"):
                assert await meter.echo_box(other) is other
        asyncio.run(work())
        with meter.file_reader() as read:
            path = Path("closure.txt")
            path.write_text("first")
            assert read(str(path)) == "first"
            path.write_text("second")
            assert read(str(path)) == "second"
    refuses(TypeError, lambda: kept(3))
    refusals = []
    def foreign():
        for op in (lambda: kept(other), kept.close):
            try:
                op()
            except RuntimeError:
                refusals.append(True)
    t = threading.Thread(target=foreign)
    t.start()
    t.join()
    assert len(refusals) == 2
    del box
    assert kept(other) is orig() and kept(Box(lambda: number(2))) is orig()
    error = LookupError("sentinel")
    def fail():
        raise error
    try:
        kept(Box(fail))
    except LookupError as e:
        assert e is error
    else:
        raise AssertionError("missing original host exception")
    with number:
        assert number(1) == 41
    assert number.closed
    refuses(RuntimeError, lambda: number(1))
    # The active application keeps its arguments alive while revoking new calls.
    def self_close():
        refuses(RuntimeError, lambda: scope.__exit__(None, None, None))
        kept.close()
        refuses(RuntimeError, lambda: kept(other))
        return 0
    observed = kept(Box(self_close))
    assert observed is orig()
    kept.close()
    del observed
    assert orig() is None

    final = Box(lambda: 9)
    stale = meter.reader(final)
    last = weakref.ref(final)
    del final
    assert last() is not None
    foreign_box = Box(lambda: 12)
    abandoned = weakref.ref(foreign_box)
    tickets = [meter.reader(foreign_box)]
    del foreign_box
    t = threading.Thread(target=tickets.clear)
    t.start()
    t.join()
    assert abandoned() is not None
    assert meter.read_level(other) == 2 and abandoned() is None

assert last() is None and stale.closed
with meter.bind_hosts(Box=Box):
    refuses(RuntimeError, lambda: stale(1))
    refuses(RuntimeError, lambda: prior.run(meter.remember, probe))
    assert not calls
    stale.close()
    assert meter.reader(other)(3) == 5
print("returned host closures: identity, reentry, disposal, foreign thread, and rebind passed")
