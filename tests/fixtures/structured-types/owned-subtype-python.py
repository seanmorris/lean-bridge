"""Independent installed-wheel consumer for checked owned aggregates."""
import dataclasses

import lean_owned_subtypes as api


checks = 0


def check(value: bool, message: str) -> None:
    global checks
    checks += 1
    if not value:
        raise AssertionError(f"owned Subtype Python check {checks}: {message}")


def rejected(operation) -> None:
    try:
        operation()
    except api.LeanBridgeError as error:
        check(error.status == 1, f"expected invalid argument, got status {error.status}")
        return
    raise AssertionError("expected checked-constructor rejection")


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


def bundle(ticket, count: int) -> api.Bundle:
    return api.Bundle(
        primary=ticket,
        spare=None,
        peers=[ticket],
        history=[ticket],
        payload=api.Payload(count=count, bytes_=b"\x00\xff"),
    )


def serial_is(ticket, expected: int, message: str) -> None:
    check(api.serial(ticket) == expected, message)


ticket = api.new_ticket(41, "python\x00checked")
retained = ticket.retain()
serial_is(ticket, 41, "fresh resource is usable")
serial_is(retained, 41, "explicit retain is independent")

valid = bundle(ticket, 7)
for _ in range(25):
    echoed = api.echo_record(valid)
    check(echoed.payload.count == 7, "selected constructor accepts a valid value")
    serial_is(echoed.primary, 41, "selected constructor preserves the resource")
    alternate = api.echo_record_alternate(valid)
    check(alternate.payload.bytes_ == b"\x00\xff", "alternate constructor preserves bytes")
    serial_is(alternate.primary, 41, "alternate constructor preserves the resource")
    release(echoed)
    release(alternate)
check(not ticket.is_closed, "borrowed calls do not consume the input owner")

invalid = bundle(ticket, -1)
rejected(lambda: api.echo_record(invalid))
rejected(lambda: api.echo_record_alternate(invalid))
check(not ticket.is_closed, "borrowed rejection preserves the input owner")
serial_is(ticket, 41, "borrowed rejection leaves the resource usable")

moving = api.new_ticket(51, "moving")
kept = moving.retain()
rejected(lambda: api.transfer_record(bundle(moving, -1)))
check(not moving.is_closed, "transfer rejection happens before ownership movement")
serial_is(moving, 51, "rejected transfer leaves the original usable")
serial_is(kept, 51, "rejected transfer leaves the retain usable")

moved = api.transfer_record(bundle(moving, 9))
check(moving.is_closed, "successful transfer consumes the selected owner")
serial_is(kept, 51, "successful transfer preserves an independent retain")
check(moved.payload.count == 9, "successful transfer preserves the checked field")
serial_is(moved.primary, 51, "successful transfer returns a usable resource")

release(moved)
ticket.close()
retained.close()
moving.close()
kept.close()
check(ticket.is_closed and retained.is_closed and moving.is_closed and kept.is_closed,
      "cleanup is explicit and idempotent")

print(f"owned-subtype-python:{checks}")
