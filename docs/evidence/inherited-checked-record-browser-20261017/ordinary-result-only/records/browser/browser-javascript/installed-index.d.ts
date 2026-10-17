// Generated from Binding IR SHA-256 115ba99993b15783e14c3828e3c244ca3eb6a435d1e26d34afde36131d9de2f2.
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
 * Lean produces every erased proof on results; no host constructor is selected. 
 */
export declare function produce(arg0: bigint): Ticket;

/**
 * Call InheritedCheckedRecords.produceStamped.
 */
export declare function produceStamped(arg0: bigint): Stamped;

declare const bindings: Readonly<{
  readonly produce: typeof produce;
  readonly produceStamped: typeof produceStamped;
}>;
export default bindings;
