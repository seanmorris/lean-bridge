"""Run after pip installation and relocation, without the producer or toolchain."""
import gc
from weakref import ref

import lean_workshop as a
import lean_workshop_peer as b


class Box:
    calls = 0

    def __init__(self, value):
        self.value = value
        self.failure = None
        self.identity_result = None

    def read(self):
        Box.calls += 1
        if self.failure is not None:
            raise self.failure
        return self.value

    def identity(self):
        return self if self.identity_result is None else self.identity_result

    def same_as(self, other):
        return self is other

    # Equality or hashing would conflate two different identity-bearing objects.
    def __eq__(self, other):
        return isinstance(other, Box)

    __hash__ = None


class Token:
    def read(self):
        return 8


def refused(expected, fn, *args):
    try:
        fn(*args)
    except expected as error:
        return error
    raise AssertionError(f"expected {expected.__name__}")


def rejected(api, weak):
    obj = Box(3)
    mark = ref(obj)
    refused(TypeError, api.host_pair, obj, obj, 0)
    refused(OverflowError, api.host_pair, obj, weak, 256)
    return mark


def member_only(api):
    return ref(api.make(19))


def weak_only(api):
    token = Token()
    assert api.token_read(token) == 8
    return ref(token)


def failed_after_entry(api, token):
    obj = Box(5)
    issue = KeyError("accepted host call")
    obj.failure = issue
    assert refused(KeyError, api.host_pair, obj, token, 1) is issue
    obj.failure = None
    # The traceback also refers to the call; observe only the registry root.
    issue.__traceback__ = None
    return ref(obj)


def exercise(first, peer):
    weak = Token()
    with first.bind_hosts(Box=Box, Token=Token):
        with peer.bind_hosts(Box=Box, Token=Token):
            before = Box.calls
            misses = [rejected(peer, weak) for _ in range(32)]
            gc.collect()
            assert all(mark() is None for mark in misses), "rejected calls pinned their strong input"
            assert Box.calls == before
            refused(TypeError, first.read, weak)
            refused(TypeError, peer.token_read, Box(2))
            left, right = Box(1), Box(2)
            assert left == right and left is not right
            assert peer.same(left, left) and not first.same(left, right)
            assert first.alias(left) is left and peer.alias(right) is right
            left.identity_result = weak
            refused(TypeError, peer.alias, left)
            left.identity_result = None
            assert first.alias(left) is left
            assert first.host_pair(left, weak, 1) == 2
            assert weak_only(first)() is None
            pin = member_only(peer)
            assert pin() is not None
            refused(OverflowError, first.host_pair, pin(), weak, 256)
            gc.collect()
            assert pin() is not None, "failed call removed an existing pin"
            admitted = failed_after_entry(peer, weak)
            gc.collect()
            assert admitted() is not None, "valid input was not retained after a host exception"
            first.keep(right)
            assert first.read_held() == 2
        gc.collect()
        assert pin() is not None, "peer unbind prematurely released the strong row"
    return pin, admitted


for first, peer in ((a, b), (b, a)):
    marks = exercise(first, peer)
    gc.collect()
    assert all(mark() is None for mark in marks), "last unbind retained a Python object"
    with first.bind_hosts(Box=Box, Token=Token):
        refused(TypeError, first.read_held)
        first.forget()

print("strong and weak nominal kinds: both binding orders, no retained objects")


def saved_leases(first, peer):
    with first.bind_hosts(Box=Box, Token=Token), peer.bind_hosts(Box=Box, Token=Token):
        box, token = first.make(17), Token()
        refused(TypeError, first.pick_object, token, box, False)
        good = first.pick_object(box, token, True)
        bad = peer.pick_object(box, token, False)
        direct = refused(peer.LeanEIOError, peer.reject_box, box)
        assert direct.declaration == "Workshop.rejectBox"
        outer = refused(first.LeanEIOError, first.mixed_fault, box, token, 0)
        assert outer.payload == first.Err("outer")
        nested_box = refused(first.LeanEIOError, first.mixed_fault, box, token, 1)
        nested_token = refused(peer.LeanEIOError, peer.mixed_fault, box, token, 2)
        assert first.mixed_fault(box, token, 3) is None
        first.keep(box)
        # Tracebacks hold call arguments. Clear them so they cannot keep either
        # object alive and accidentally make an unowned payload appear valid.
        for error in (direct, outer, nested_box, nested_token):
            error.__traceback__ = None
        return (ref(box), ref(token)), (good, bad, direct, nested_box, nested_token)


def inspect_leases(first, peer, marks, kept):
    box, token = (mark() for mark in marks)
    assert box is not None and token is not None
    good, bad, direct, nested_box, nested_token = kept
    assert isinstance(good, first.Ok) and good.value is box
    assert isinstance(bad, peer.Err) and bad.error is token
    assert direct.payload is box and direct.payload.read() == 17
    assert isinstance(nested_box.payload, first.Ok) and isinstance(nested_box.payload.value, first.Err)
    assert nested_box.payload.value.error is box
    assert isinstance(nested_token.payload, peer.Ok) and isinstance(nested_token.payload.value, peer.Ok)
    assert nested_token.payload.value.value is token
    with first.bind_hosts(Box=Box, Token=Token):
        refused(TypeError, first.reject_saved)
        first.forget()
        empty = refused(first.LeanEIOError, first.reject_saved)
        assert empty.payload == first.Err("empty")


for first, peer in ((a, b), (b, a)):
    marks, kept = saved_leases(first, peer)
    gc.collect()
    inspect_leases(first, peer, marks, kept)
    del kept
    gc.collect()
    assert all(mark() is None for mark in marks), "released values or exceptions leaked host objects"

print("returned and raised leases survive unbind; discarded payloads release objects")


def last_error_owner(throwing, surviving):
    drops = []

    class Counter(Token):
        def __init__(self):
            self.next = 23

        def read(self):
            before = self.next
            self.next += 19
            return before

        def __del__(self):
            drops.append(1)

    def issue():
        with throwing.bind_hosts(Box=Box, Token=Counter):
            original = Counter()
            mark = ref(original)
            failure = refused(throwing.LeanEIOError, throwing.mixed_fault, Box(0), original, 2)
            assert failure.declaration == "Workshop.mixedFault"
            assert isinstance(failure.payload, throwing.Ok)
            assert isinstance(failure.payload.value, throwing.Ok)
            assert failure.payload.value.value is original
            # The traceback includes a frame with the original input. Keeping
            # it would let this test pass even if the error lost its payload.
            failure.__traceback__ = None
            return failure, mark

    with surviving.bind_hosts(Box=Box, Token=Counter):
        failure, mark = issue()
        gc.collect()
        assert mark() is not None and not drops
        assert surviving.token_read(failure.payload.value.value) == 23
        assert surviving.token_read(failure.payload.value.value) == 42
        del failure
        gc.collect()
        assert mark() is None and drops == [1], "payload survived its last owner"


for throwing, surviving in ((a, b), (b, a)):
    last_error_owner(throwing, surviving)
print("nested typed error alone owns the counter: peer reads 23 then 42, one finalization")
