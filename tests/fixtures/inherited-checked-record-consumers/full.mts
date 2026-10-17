/**
 * Strict public types for every inherited checked-record export.
 *
 * @file
 */
import * as api from "inheritedcheckedrecords";

const span: api.Span = { lo: 2n, hi: 3n };
const ticket: api.Ticket = { toSpan: span, word: 4n };
const alias: api.TicketAlias = ticket;
const stamped: api.Stamped = { toTicket: ticket, mark: 3n };
const scalar: bigint = api.first(ticket) + api.normalized(ticket)
	+ api.pair(ticket, ticket) + api.aliased(alias) + api.nested(stamped);
const echoed: api.Ticket = api.echo(ticket);
const produced: api.Ticket = api.produce(4n);
const producedStamped: api.Stamped = api.produceStamped(4n);
// @ts-expect-error An erased parent proof is never a public field.
api.first({ toSpan: { lo: 2n, hi: 3n, ordered: true }, word: 4n });
// @ts-expect-error An erased child proof is never a public field.
api.first({ toSpan: span, word: 4n, linked: true });
// @ts-expect-error Fin and checked Subtype payloads retain bigint representation.
api.nested({ toTicket: ticket, mark: 3 });
void scalar; void echoed; void produced; void producedStamped;
