import atexit
import gc
import threading


# Register first so the package shutdown hook runs before this observer.
@atexit.register
def shutdown_observer():
    assert counts() == 81608, f"shutdown left {counts()}"
    print("shutdown closed the final live cursor exactly once")


from lean_counting import numbers, checked, units, counts, LeanEIOError, LeanStreamError, LeanStreamIOError


def fails(cls, call):
    try:
        call()
    except cls as err:
        return err
    raise AssertionError(f"expected {cls.__name__}")


cur = numbers(100)
assert iter(cur) is cur and not hasattr(cur, "__anext__")
assert counts() == 0
cur.close()
assert list(cur) == [] and counts() == 0
with numbers(100) as cur:
    for n in cur:
        assert n == 0 and counts() == 10100
        break
assert counts() == 10101
cur.close()
assert list(numbers(99)) == [0, 1, 2] and counts() == 20502
assert fails(LeanEIOError, lambda: next(checked(0))).payload == "factory"
assert counts() == 20502
cur = checked(1)
assert next(cur) == 0
err = fails(LeanStreamError, lambda: next(cur))
assert err.payload == "step" and err.declaration == "Counting.checked"
assert list(cur) == [] and counts() == 30703
cur = units(1)
assert next(cur) is None  # Option.some Unit is not end of iteration.
assert "unit step" in str(fails(LeanStreamIOError, lambda: next(cur)))
assert list(cur) == [] and counts() == 40904
assert list(units(9)) == [None, None] and counts() == 51205
cur = numbers(4)
assert next(cur) == 0
errors = []
def off_owner():
    errors.extend(fails(RuntimeError, fn) for fn in [lambda: next(cur), cur.close])
t = threading.Thread(target=off_owner)
t.start()
t.join()
assert len(errors) == 2 and next(cur) == 1
cur.close()
assert counts() == 61406
held = [numbers(8)]
assert next(held[0]) == 0
t = threading.Thread(target=held.clear)
t.start()
t.join()
gc.collect()
numbers(8).close()  # also drains any pending owner-thread destruction.
assert counts() == 71507
print("immediate native pulls, both failure phases, affinity and seven finalizers passed")
at_shutdown = numbers(8)
assert next(at_shutdown) == 0 and counts() == 81607
