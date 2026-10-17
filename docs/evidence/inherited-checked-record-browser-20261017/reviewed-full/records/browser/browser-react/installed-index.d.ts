// Generated from Binding IR SHA-256 6fec0815177f3351ec950aa7a9da15e4084b7f8d417401440c1b2823086484c9.
/**
 * Independent corpus contract.
 */
export interface Span {
  readonly lo: bigint;
  readonly hi: bigint;
}

/**
 * Independent corpus contract.
 */
export interface Stamped {
  readonly toTicket: Ticket;
  readonly mark: bigint;
}

/**
 * Independent corpus contract.
 */
export interface Ticket {
  readonly toSpan: Span;
  readonly word: bigint;
}

/**
 * Independent inherited checked-record contract.
 */
export type TicketAlias = Ticket;

/**
 * Independent corpus contract.
 */
export declare function aliased(value0: TicketAlias): bigint;

/**
 * Independent corpus contract.
 */
export declare function echo(value0: Ticket): Ticket;

/**
 * Independent corpus contract.
 */
export declare function first(value0: Ticket): bigint;

/**
 * Independent corpus contract.
 */
export declare function nested(value0: Stamped): bigint;

/**
 * Independent corpus contract.
 */
export declare function normalized(value0: Ticket): bigint;

/**
 * Independent corpus contract.
 */
export declare function pair(value0: Ticket, value1: Ticket): bigint;

/**
 * Independent corpus contract.
 */
export declare function produce(value0: bigint): Ticket;

/**
 * Independent corpus contract.
 */
export declare function produceStamped(value0: bigint): Stamped;

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
