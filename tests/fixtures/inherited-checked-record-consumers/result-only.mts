/**
 * Strict public types for the inherited result-only package.
 *
 * @file
 */
import * as api from "inheritedcheckedrecords";

const produced: api.Ticket = api.produce(4n);
const stamped: api.Stamped = api.produceStamped(4n);
const span: api.Span = produced.toSpan;
const word: bigint = produced.word;
const mark: bigint = stamped.mark;
// @ts-expect-error Lean-produced records carry no erased parent proof field.
const ordered: boolean = span.ordered;
// @ts-expect-error The result-only package does not expose checked inputs.
api.first(produced);
void word; void mark; void ordered;
