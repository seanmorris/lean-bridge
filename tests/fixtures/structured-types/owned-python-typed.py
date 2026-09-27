from typing import assert_type
from lean_owned_aggregates import (
    Bundle, BundleAlias, Chain, ChainLink, ChainStop, Err, Ok, Option,
    Payload, Result, Some, Ticket, TicketRow, Tree, TreeBranch, TreeLeaf,
    callback_record, callback_recursive, dispatch, factory, identity_closure,
    with_recovery,
)

def values(ticket: Ticket) -> tuple[Bundle, Tree, Chain, TicketRow]:
    optional: Option[Ticket] = Some(ticket)
    payload = Payload(-(1 << 150), b"\0\xff")
    bundle: BundleAlias = Bundle(ticket, optional, (ticket,), [ticket], payload)
    success: Result[Bundle, Ticket] = Ok(bundle)
    failure: Result[Bundle, Ticket] = Err(ticket)
    tree: Tree = TreeBranch((TreeLeaf(ticket),))
    chain: Chain = ChainLink(ticket, Some(ChainStop()))
    row: TicketRow = (None, Some(ticket))
    assert_type(bundle.primary, Ticket)
    assert_type(ticket.retain(), Ticket)
    assert_type(ticket.is_closed, bool)
    with ticket as opened:
        assert_type(opened, Ticket)
    if isinstance(success, Ok):
        assert_type(success.value, Bundle)
    if isinstance(failure, Err):
        assert_type(failure.value, Ticket)
    return bundle, tree, chain, row

def callbacks(ticket: Ticket, bundle: Bundle, tree: Tree) -> None:
    assert_type(callback_record(bundle, lambda value: value), Bundle)
    assert_type(callback_recursive(tree, lambda value: value), Tree)
    closure = identity_closure(None)
    assert_type(closure(bundle), Bundle)
    assert_type(dispatch(bundle)(lambda value: value), Bundle)
    assert_type(dispatch(bundle)(closure), Bundle)
    assert_type(factory(with_recovery(lambda unit: ticket, ticket)), Ticket)
