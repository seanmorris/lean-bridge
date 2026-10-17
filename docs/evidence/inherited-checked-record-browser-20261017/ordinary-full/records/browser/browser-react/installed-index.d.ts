// Generated from Binding IR SHA-256 00c89fd429ee5484eed64fb0bdcae3a44bda860d704e48e45f04fe7b0ba0f80f.
/**
 * Checked Lean InheritedCheckedRecords.Span.
 */
export interface Span {
  readonly lo: bigint;
  readonly hi: bigint;
}

/**
 * Checked Lean InheritedCheckedRecords.Stamped.
 */
export interface Stamped {
  readonly toTicket: Ticket;
  readonly mark: bigint;
}

/**
 * Checked Lean InheritedCheckedRecords.Ticket.
 */
export interface Ticket {
  readonly toSpan: Span;
  readonly word: bigint;
}

/**
 * Checked Lean InheritedCheckedRecords.TicketAlias.
 */
export type TicketAlias = Ticket;

/**
 * Call InheritedCheckedRecords.aliased.
 */
export declare function aliased(arg0: TicketAlias): bigint;

/**
 * Call InheritedCheckedRecords.echo.
 */
export declare function echo(arg0: Ticket): Ticket;

/**
 * Call InheritedCheckedRecords.first.
 */
export declare function first(arg0: Ticket): bigint;

/**
 * Call InheritedCheckedRecords.nested.
 */
export declare function nested(arg0: Stamped): bigint;

/**
 * Call InheritedCheckedRecords.normalized.
 */
export declare function normalized(arg0: Ticket): bigint;

/**
 * Call InheritedCheckedRecords.pair.
 */
export declare function pair(arg0: Ticket, arg1: Ticket): bigint;

/**
 * Lean produces every erased proof on results; no host constructor is selected. 
 */
export declare function produce(arg0: bigint): Ticket;

/**
 * Call InheritedCheckedRecords.produceStamped.
 */
export declare function produceStamped(arg0: bigint): Stamped;

declare const bindings: Readonly<{
  readonly aliased: typeof aliased;
  readonly echo: typeof echo;
  readonly first: typeof first;
  readonly nested: typeof nested;
  readonly normalized: typeof normalized;
  readonly pair: typeof pair;
  readonly produce: typeof produce;
  readonly produceStamped: typeof produceStamped;
}>;
export default bindings;
