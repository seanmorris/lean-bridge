"""Consumer application. Uses only installed packages and ordinary Python classes."""
import gc
import os
import warnings
from concurrent.futures import ThreadPoolExecutor
from weakref import ref

import lean_workshop as a
import lean_workshop_peer as b
from host_app import Box


def raises(kind, text, call):
    try:
        call()
    except kind as e:
        assert text in str(e), (text, e)
        return e
    raise AssertionError("expected %s: %s" % (kind, text))


class AppBox(Box):
    def __init__(self, n):
        super().__init__(n)
        self.problem = ValueError("outside the host range")

    @Box.level.setter
    def level(self, n):
        if n > 100:
            raise self.problem
        self._level = n


def echo(self, value):
    return value


scalars = {
    "uint8": (0, 255), "uint16": (65535,), "uint32": (2**32-1,),
    "uint64": (2**64-1,), "int8": (-128, 127), "int16": (-32768, 32767),
    "int32": (-2**31, 2**31-1), "int64": (-2**63, 2**63-1),
    "usize": (2**64-1,), "isize": (-2**63,), "bool": (True, False),
    "nat": (0, 2**18000+77), "int": (-(2**18000+77), 0, 2**300),
    "float32": (-12.25,), "float64": (-1234567.125,), "char": ("🦊",),
    "unit": (None,), "string": ("a\x00λ🦊",), "bytes": (b"\x00\xff",),
}
for name in scalars:
    setattr(AppBox, "echo_" + name, echo)

raises(RuntimeError, "bind_hosts", lambda: a.make(1))
raises(TypeError, "class", lambda: a.bind_hosts(Box=3).__enter__())
with a.bind_hosts(Box=AppBox), b.bind_hosts(Box=AppBox):
    box, other = a.make(7), b.make(7)
    assert type(box) is AppBox and a.alias(box) is b.alias(box) is box
    assert a.same(box, box) and not b.same(box, other)
    assert a.live() == 2 and a.finish(other) == 7
    a.set_level(value=81, box=box)
    assert b.read(box) == 81 and b.scale(box, .25) == 20.25
    for name, samples in scalars.items():
        for sample in samples:
            result = getattr(a, "echo_" + name)(box, sample)
            assert type(result) is type(sample) and result == sample, name
    assert raises(ValueError, "outside the host range", lambda: b.set_level(box, 101)) is box.problem
    raises(RuntimeError, "replacement from Lean", lambda: b.replace_error(box))
    raises(TypeError, "nominal", lambda: a.read(object()))
    raises(OverflowError, "", lambda: b.set_level(box, 2**32))
    raises(TypeError, "integer", lambda: b.set_level(box, True))
    assert a.read(box) == 81
    AppBox.echo_uint8 = lambda self, n: 256
    raises(OverflowError, "", lambda: a.echo_uint8(box, 1))
    AppBox.echo_bool = lambda self, v: 1
    raises(TypeError, "bool", lambda: b.echo_bool(box, False))
    AppBox.echo_char = lambda self, v: "\ud800"
    raises(TypeError, "surrogate", lambda: b.echo_char(box, "X"))
    AppBox.identity = lambda self: object()
    raises(TypeError, "nominal", lambda: b.alias(box))
    AppBox.identity = Box.identity
    # Reenter both the current and an independently built component.
    AppBox.echo_uint8 = lambda self, v: a.read(self) + b.read(self)
    assert a.echo_uint8(box, 1) == 162
    with ThreadPoolExecutor(max_workers=1) as pool:
        raises(RuntimeError, "bind_hosts", lambda: pool.submit(a.read, box).result())
    # Intentionally exercise the forbidden inherited-runtime path, not normal use.
    with warnings.catch_warnings(record=True) as notices:
        warnings.simplefilter("always", DeprecationWarning)
        child = os.fork()
    assert all(w.category is DeprecationWarning and "fork()" in str(w.message) for w in notices)
    if child == 0:
        try:
            raises(RuntimeError, "bind_hosts", lambda: a.read(box))
            os._exit(0)
        except BaseException:
            os._exit(1)
    assert os.waitpid(child, 0)[1] == 0
    b.keep(box)
    assert b.read_held() == 81
    temporary = a.make(22)
    ephemeral = ref(temporary)
    a.keep(temporary)
    del temporary
    assert ephemeral() is not None and a.read_held() == 22
    a.forget()
    assert ephemeral() is None
    shadow = ref(other)
    del other
    gc.collect()
    assert shadow() is None

with b.bind_hosts(Box=AppBox):
    raises(TypeError, "stale", b.read_held)
    b.forget()
    with a.bind_hosts(Box=AppBox):
        saved = a.make(12)
        b.keep(saved)
    assert b.read_held() == 12
    class Different(Box):
        pass
    raises(TypeError, "incompatible", lambda: a.bind_hosts(Box=Different).__enter__())
    b.forget()
    del saved
box.problem.__traceback__ = None
del box
gc.collect()
assert len(Box.instances) == 0
print("installed host imports: peers, 19 scalars, original exceptions, reentry, stale, fork, thread and zero live objects")
