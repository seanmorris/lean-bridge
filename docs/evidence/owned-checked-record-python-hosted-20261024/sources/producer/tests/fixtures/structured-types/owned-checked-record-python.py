"""Installed-wheel consumer for owned proof-erased checked records."""
import dataclasses
import gc

import lean_owned_checked_records as api


checks = 0


def check(value: bool, message: str) -> None:
    global checks
    checks += 1
    if not value:
        raise AssertionError(f"owned checked-record Python check {checks}: {message}")


def rejected(operation, status: int = 1):
    try:
        operation()
    except api.LeanBridgeError as error:
        check(error.status == status,
              f"expected native status {status}, got {error.status}")
        return error
    raise AssertionError("expected checked-record rejection")


def resources(value):
    if isinstance(value, api.Ticket):
        return [value]
    if dataclasses.is_dataclass(value):
        return [resource for field in dataclasses.fields(value)
                for resource in resources(getattr(value, field.name))]
    if isinstance(value, (list, tuple)):
        return [resource for item in value for resource in resources(item)]
    return []


def release(value) -> None:
    for resource in resources(value):
        resource.close()


def claim(ticket, quota: int) -> api.Claim:
    return api.Claim(holder=ticket, quota=quota)


def booking(ticket, lo: int, hi: int) -> api.Booking:
    return api.Booking(holder=ticket, window=api.Window(lo=lo, hi=hi))


def serial_is(ticket, expected: int, message: str) -> None:
    check(api.serial(ticket) == expected, message)


def owning_state(ticket):
    lease = ticket._lease
    check(lease is not None, "lifecycle probe requires an open owner")
    return lease.state


ticket = api.new_ticket(41, "python\x00checked")
retained = ticket.retain()
serial_is(ticket, 41, "fresh resource is usable")
serial_is(retained, 41, "explicit retain is independent")
valid = claim(ticket, 7)
valid_booking = booking(ticket, 3, 8)

for _ in range(25):
    echoed = api.echo_claim(valid)
    check(echoed.quota == 7, "selected constructor accepts the claim")
    serial_is(echoed.holder, 41, "claim preserves its resource")
    echoed_booking = api.echo_booking(valid_booking)
    check(echoed_booking.window.hi == 8,
          "nested copied checked record preserves its fields")
    serial_is(echoed_booking.holder, 41, "booking preserves its resource")
    release(echoed)
    release(echoed_booking)

invalid = claim(ticket, 99)
rejected(lambda: api.echo_claim(invalid))
rejected(lambda: api.pair_claim(valid_booking, invalid))
check(not ticket.is_closed, "early and late borrowed rejection preserve input")
serial_is(ticket, 41, "borrowed rejection recovers")

moving = api.new_ticket(51, "moving")
kept = moving.retain()
rejected_transfer = claim(moving, 99)
rejected(lambda: api.transfer_claim(rejected_transfer))
check(not moving.is_closed and not rejected_transfer.holder.is_closed,
      "transfer rejection precedes movement")
serial_is(moving, 51, "rejected transfer leaves input usable")
serial_is(kept, 51, "rejected transfer leaves retain usable")
accepted_transfer = claim(moving, 9)
moved = api.transfer_claim(accepted_transfer)
check(moving.is_closed and accepted_transfer.holder.is_closed,
      "successful transfer consumes the shared owner")
check(moved.quota == 9, "successful transfer preserves payload")
serial_is(moved.holder, 51, "transferred result is usable")
serial_is(kept, 51, "independent retain survives transfer")

calls = 0


def reply(incoming):
    global calls
    calls += 1
    check(incoming.quota == 7, "callback receives a proof-free claim")
    return claim(incoming.holder, 10)


callback_result = api.with_claim_callback(
    valid, api.with_recovery(reply, valid))
check(calls == 1 and callback_result.quota == 10,
      "valid host callback reply accepted")
serial_is(callback_result.holder, 41, "host reply resource retained")
release(callback_result)
before = calls
bare_result = api.with_claim_callback(valid, reply)
check(calls == before + 1 and bare_result.quota == 10,
      "successful callback needs no failure-path recovery")
release(bare_result)
before = calls
rejected(lambda: api.with_claim_callback(
    valid, api.with_recovery(reply, invalid)))
check(calls == before, "invalid recovery stops callback")
rejected(lambda: api.with_claim_callback(
    valid, api.with_recovery(lambda incoming: claim(incoming.holder, 99), valid)))
serial_is(ticket, 41, "invalid host reply recovers")

sentinel = RuntimeError("owned checked callback")


def fail(_incoming):
    raise sentinel


try:
    api.with_claim_callback(valid, api.with_recovery(fail, valid))
except RuntimeError as error:
    check(error is sentinel, "callback exception identity preserved")
else:
    raise AssertionError("callback exception was swallowed")

closure = api.claim_closure()
from_closure = closure(valid)
check(from_closure.quota == 7, "returned closure accepts valid claim")
serial_is(from_closure.holder, 41, "closure result resource retained")
release(from_closure)
rejected(lambda: closure(invalid))
reused = closure(claim(ticket, 6))
check(reused.quota == 6, "returned closure recovers and reuses")
release(reused)
closure.close()
closure.close()
check(closure.is_closed, "closure closes idempotently")

produced = api.claim_for(retained)
check(isinstance(produced, api.Some), "Lean-produced claim is present")
check(produced.value.quota == 0, "Lean-produced claim erases its proof")
serial_is(produced.value.holder, 41, "Lean-produced resource is usable")
release(produced)

anchor = api.new_ticket(61, "finalizer-anchor")
state = owning_state(anchor)
baseline = len(state.slots)
finalized = api.new_ticket(62, "finalized")
survivor = finalized.retain()
check(len(state.slots) == baseline + 2, "finalizer probe owns two results")
del finalized
gc.collect()
serial_is(survivor, 62, "GC preserves an independent retain")
check(len(state.slots) == baseline + 1, "GC releases the abandoned owner")
survivor.close()
check(len(state.slots) == baseline, "explicit cleanup restores slot baseline")
anchor.close()

release(valid)
release(invalid)
release(valid_booking)
release(moved)
ticket.close()
retained.close()
moving.close()
kept.close()
check(all(value.is_closed for value in (ticket, retained, moving, kept)),
      "cleanup is explicit and idempotent")

print(f"owned-checked-record-python:{checks}")
