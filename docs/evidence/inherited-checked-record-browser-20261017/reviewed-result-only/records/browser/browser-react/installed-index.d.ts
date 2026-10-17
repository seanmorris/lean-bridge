// Generated from Binding IR SHA-256 d0c701ec7684c8405b57675f53612017d7cf2633cca08eb3b776704ebda1a659.
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
 * Independent corpus contract.
 */
export declare function produce(value0: bigint): Ticket;

/**
 * Independent corpus contract.
 */
export declare function produceStamped(value0: bigint): Stamped;

declare const bindings: Readonly<{
  readonly produce: typeof produce;
  readonly produceStamped: typeof produceStamped;
}>;
export default bindings;
