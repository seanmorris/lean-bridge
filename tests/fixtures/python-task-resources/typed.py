"""A type checker must accept tickets and their retained owners across packages."""
import lease_desk as desk
import lease_depot as depot


async def relay(ticket: desk.Ticket) -> desk.Ticket:
    peer: depot.Ticket = ticket
    with peer.retain() as kept:
        result: desk.Ticket = await depot.checked(False, kept)
        assert ticket.same_resource(result)
        return result


def recognize(value: object) -> int:
    return depot.count(value) if isinstance(value, desk.Ticket) else 0


def failure(exc: desk.LeanEIOError | depot.LeanStreamError) -> int:
    with exc.payload as ticket:
        return depot.count(ticket)
