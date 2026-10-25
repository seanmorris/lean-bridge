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


def grant(ticket, weight: int, limit: int) -> api.Grant:
    return api.Grant(holder=ticket, weight=weight, limit=limit)


def serial_is(ticket, expected: int, message: str) -> None:
    check(api.serial(ticket) == expected, message)


def owning_state(ticket):
    lease = ticket._lease
    check(lease is not None, "lifecycle probe requires an open owner")
    return lease.state


ticket = api.new_ticket(41, "python\x00checked")
initial_slots = len(owning_state(ticket).slots) - 1
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

invalid_booking = booking(ticket, 8, 3)
for _ in range(10):
    rejected(lambda: api.echo_booking(invalid_booking))
    check(invalid_booking.window.lo == 8 and invalid_booking.window.hi == 3,
          "nested copied rejection preserves both input fields")
    serial_is(invalid_booking.holder, 41, "nested copied rejection preserves owner")
equal_booking = api.echo_booking(booking(ticket, 3, 3))
check(equal_booking.window.lo == 3 and equal_booking.window.hi == 3,
      "nested copied constructor accepts equality and recovers")
serial_is(equal_booking.holder, 41, "nested copied recovery retains resource")
release(equal_booking)

check(api.booking_span(valid_booking) == 5, "copied payload consumed")
check(api.claim_quota(valid) == 7, "owned payload consumed")
echoed_grant = api.echo_grant(grant(ticket, 7, 8))
check(echoed_grant.weight == 7 and echoed_grant.limit == 8,
      "nested Subtype and outer checked record accepted")
serial_is(echoed_grant.holder, 41, "grant retains resource")
release(echoed_grant)
rejected(lambda: api.echo_grant(grant(ticket, 0, 8)))
rejected(lambda: api.echo_grant(grant(ticket, 7, 3)))
claims = api.echo_claims([valid, valid])
check(len(claims) == 2 and claims[1].quota == 7,
      "owned checked-record array round trips")
serial_is(claims[0].holder, 41, "array retains resource")
release(claims)
for _ in range(10):
    rejected(lambda: api.echo_claims([valid, claim(ticket, 99)]))
    check(not ticket.is_closed, "later array rejection preserves owner")
check(len(api.echo_claims([])) == 0, "empty owned array")
array_recovery = api.echo_claims([valid])
check(len(array_recovery) == 1, "array rejection recovers")
release(array_recovery)

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

first = api.new_ticket(71, "first")
second = api.new_ticket(81, "second")
first_kept = first.retain()
second_kept = second.retain()
moving_booking = booking(first, 3, 8)
moving_claim = claim(second, 99)
rejected(lambda: api.transfer_pair_claim(moving_booking, moving_claim))
check(not first.is_closed and not second.is_closed,
      "late failure aborts both transfers")
serial_is(first, 71, "first rejected transfer intact")
serial_is(second, 81, "second rejected transfer intact")
pair = api.transfer_pair_claim(moving_booking, claim(second, 7))
check(first.is_closed and second.is_closed and pair.quota == 7,
      "both transfers commit together")
serial_is(first_kept, 71, "first independent retain survives")
serial_is(second_kept, 81, "second independent retain survives")
release(pair)
first_kept.close()
second_kept.close()

for throws in (False, True):
    post_input = api.new_ticket(91, "post-transfer")
    independent = post_input.retain()
    transferred = claim(post_input, 7)
    entered = 0
    post_sentinel = RuntimeError("post-transfer callback")

    def post_reply(incoming):
        global entered
        entered += 1
        if throws:
            raise post_sentinel
        return claim(incoming.holder, 99)

    post_callback = api.with_recovery(post_reply, claim(independent, 7))
    if throws:
        try:
            api.transfer_with_claim_callback(transferred, post_callback)
        except RuntimeError as error:
            check(error is post_sentinel,
                  "post-transfer callback exception identity preserved")
        else:
            raise AssertionError("post-transfer exception was swallowed")
        post_sentinel.__traceback__ = None
    else:
        rejected(lambda: api.transfer_with_claim_callback(transferred, post_callback))
    check(entered == 1 and post_input.is_closed,
          "failure after transfer consumes input")
    serial_is(independent, 91, "post-transfer failure preserves independent retain")
    recovered = api.transfer_with_claim_callback(claim(independent, 7),
        api.with_recovery(lambda incoming: claim(incoming.holder, 9),
                          claim(independent, 7)))
    check(independent.is_closed and recovered.quota == 9,
          "post-transfer callback failure recovers on next call")
    serial_is(recovered.holder, 91, "recovered transfer resource is usable")
    release(recovered)

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
sentinel.__traceback__ = None

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
gc.collect()
check(len(state.slots) == initial_slots, "all runtime slots return to baseline")

print(f"owned-checked-record-python:{checks}")
