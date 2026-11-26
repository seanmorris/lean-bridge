"""Use public installed records and ordinary application objects, without bridge handles."""
import gc
import weakref
import lean_meter as api


class Meter:
    def __init__(self, value):
        self.value = value
        self.reads = 0
        self.failure = None

    def read(self):
        self.reads += 1
        if self.failure:
            raise self.failure
        return self.value


def refused(call, error_type):
    try:
        call()
    except error_type as exc:
        return exc
    raise AssertionError("expected " + error_type.__name__)


with api.bind_hosts(Box=Meter):
    a, b = Meter(3), Meter(7)
    with api.Rack(a, 9, b) as first:
        other = api.reorder(first)
        assert (other.primary is b and other.backup is a and other.offset == 12)
        assert a.reads == 1 and b.reads == 0
        assert api.select_primary(first) is a
        a.value = 12
        assert api.weigh(first, 2) == 23 and a.reads == 2
        shared = api.shared(a)
        assert shared.primary is a and shared.backup is a
        refused(lambda: setattr(first, "primary", b), AttributeError)
        refused(lambda: api.reorder((a, 0, b)), TypeError)
        refused(lambda: api.reorder(api.Rack(a, 0, object())), TypeError)
        refused(lambda: api.reorder(api.Rack(a, 2**32, b)), OverflowError)
        refused(lambda: api.weigh(first, "not an integer"), TypeError)
        assert a.reads == 2
        original = LookupError("meter unplugged")
        a.failure = original
        assert refused(lambda: api.reorder(first), LookupError) is original
        a.failure = None
        assert api.weigh(first, 1) == 22
    assert first.closed and not first.close()
    refused(lambda: api.reorder(first), RuntimeError)
    refused(lambda: first.primary, RuntimeError)
    assert other.backup is a and shared.primary is a
    assert other.close() and shared.close()
    temporary = Meter(33)
    held = weakref.ref(temporary)
    last = api.shared(temporary)
    del temporary
    gc.collect()
    assert held() is not None and last.primary is held()
    assert last.close()
    gc.collect()
    assert held() is None, "a closed result pinned the application object"
    survivor = api.shared(a)
assert survivor.primary is a and survivor.backup is a
assert survivor.close() and not survivor.close()
print("installed Python record: identity, aliasing, input validation, exception identity, disposal")
