// Generated from Binding IR SHA-256 2f38ccd2d87c26c3372cc5b97bb33ae078c10cdcaafd2cb040fb80865cdd4e18.
/**
 * Independent corpus contract.
 */
export interface AliasPair {
  readonly left: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>;
  readonly right: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>;
}

/**
 * Independent corpus contract.
 */
export interface Envelope {
  readonly payload: bigint;
  readonly digit: bigint;
}

/**
 * Independent corpus contract.
 */
export type EnvelopeAlias = Envelope;

/**
 * Independent corpus contract.
 */
export type Event = Readonly<{ readonly kind: "empty" }> | Readonly<{ readonly kind: "box"; readonly value: Envelope }> | Readonly<{ readonly kind: "choices"; readonly values: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Readonly<{ ok: bigint }> | Readonly<{ error: bigint }> }>> }>;

/**
 * Independent corpus contract.
 */
export declare function arrayValues(value0: bigint): ReadonlyArray<bigint>;

/**
 * Independent corpus contract.
 */
export declare function branch(value0: bigint): Readonly<{ ok: bigint }> | Readonly<{ error: bigint }>;

/**
 * Independent corpus contract.
 */
export declare function eventChoices(value0: bigint): Event;

/**
 * Independent corpus contract.
 */
export declare function eventEmpty(value0: bigint): Event;

/**
 * Independent corpus contract.
 */
export declare function eventValue(value0: bigint): Event;

/**
 * Independent corpus contract.
 */
export declare function groupValues(value0: bigint): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>;

/**
 * Independent corpus contract.
 */
export declare function listValues(value0: bigint): ReadonlyArray<bigint>;

/**
 * Independent corpus contract.
 */
export declare function noItems(value0: bigint): ReadonlyArray<bigint>;

/**
 * Independent corpus contract.
 */
export declare function optional(value0: bigint): Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>;

/**
 * Independent corpus contract.
 */
export declare function pairValues(value0: bigint): AliasPair;

/**
 * Independent corpus contract.
 */
export declare function produceEnvelope(value0: bigint): Envelope;

/**
 * Independent corpus contract.
 */
export declare function product(value0: bigint): readonly [bigint, bigint];

/**
 * Independent corpus contract.
 */
export declare function scalar(value0: bigint): bigint;

declare const bindings: Readonly<{
  readonly arrayValues: typeof arrayValues;
  readonly branch: typeof branch;
  readonly eventChoices: typeof eventChoices;
  readonly eventEmpty: typeof eventEmpty;
  readonly eventValue: typeof eventValue;
  readonly groupValues: typeof groupValues;
  readonly listValues: typeof listValues;
  readonly noItems: typeof noItems;
  readonly optional: typeof optional;
  readonly pairValues: typeof pairValues;
  readonly produceEnvelope: typeof produceEnvelope;
  readonly product: typeof product;
  readonly scalar: typeof scalar;
}>;
export default bindings;
