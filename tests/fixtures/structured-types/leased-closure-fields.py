"""Consumer of an installed Tariff package. No runtime setup or ABI calls."""
from lean_tariff_quotes import (
    Tariff, LeanBridgeError, apply_tariff, echo_tariff, make_tariff,
    new_ticket, pack_quote, unpack_quote,
)


def refuses(error_type, operation, status=None):
    try:
        operation()
    except error_type as exc:
        if status is not None:
            assert exc.status == status, exc
    else:
        raise AssertionError("unexpected acceptance")


source = make_tariff(40)
with source.quote as original:
    assert original(2) == 42
    copied_record = echo_tariff(Tariff(original))
    projected = unpack_quote(source)
with copied_record.quote as copy, projected:
    assert original.is_closed
    refuses(LeanBridgeError, lambda: apply_tariff(source, 2))
    assert copy(3) == 43 and projected(4) == 44
    assert apply_tariff(copied_record, 5) == 45
    with pack_quote(projected).quote as repacked:
        assert repacked(6) == 46
assert copy.is_closed and projected.is_closed

# Record construction is ordinary Python; crossing into Lean checks the actual
# handle. The same signature alone does not turn a Python lambda into a lease.
refuses(TypeError, lambda: echo_tariff(Tariff(lambda n: n)))
with new_ticket(1) as wrong_kind:
    refuses(TypeError, lambda: echo_tariff(Tariff(wrong_kind)))

# A host callback borrowed through a normal function parameter still expires
# on return, even when Lean saves its trampoline in a record.
invocations = []
escaped = pack_quote(lambda n: invocations.append(n) or n)
with escaped.quote:
    refuses(LeanBridgeError, lambda: escaped.quote(1), 10)
    refuses(LeanBridgeError, lambda: apply_tariff(escaped, 2), 10)
assert invocations == []
with make_tariff(8).quote as recovered:
    assert recovered(1) == 9
print("leased-closure-fields: ok")
