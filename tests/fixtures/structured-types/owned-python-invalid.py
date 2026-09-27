from lean_owned_aggregates import (
    Bundle, ChainLink, Ok, Option, Payload, Result, Ticket, TreeLeaf,
    callback_record, dispatch, factory,
)

def invalid(ticket: Ticket, bundle: Bundle) -> None:
    Bundle(1, None, (), (), Payload(0, b""))
    bundle.primary = ticket
    TreeLeaf(bundle)
    ChainLink(ticket, True)
    optional: Option[Ticket] = ticket
    result: Result[Bundle, Ticket] = Ok(ticket)
    Ticket()
    ticket.close(1)
    callback_record(bundle, lambda value: value.primary)
    factory(lambda unit: ticket)
    dispatch(bundle)(lambda value: value.primary)
