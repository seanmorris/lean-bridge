// Generated from Binding IR SHA-256 1a42b2960f99368a3131fe9ae5c6ec7b1d6556143dbe49a44d8dfd8fc139c9ad.
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
export interface Pair {
  readonly left: Envelope;
  readonly right: Envelope;
}

/**
 * Independent corpus contract.
 */
export declare function aliases(value0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>, value1: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>): bigint;

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
export declare function combine(value0: Envelope, value1: Envelope): bigint;

/**
 * Independent corpus contract.
 */
export declare function echo(value0: Envelope): Envelope;

/**
 * Independent corpus contract.
 */
export declare function echoEvent(value0: Event): Event;

/**
 * Independent corpus contract.
 */
export declare function echoGroups(value0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>;

/**
 * Independent corpus contract.
 */
export declare function echoPair(value0: AliasPair): AliasPair;

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
export declare function eventFirst(value0: Event): bigint;

/**
 * Independent corpus contract.
 */
export declare function eventSecond(value0: Event): bigint;

/**
 * Independent corpus contract.
 */
export declare function eventValue(value0: bigint): Event;

/**
 * Independent corpus contract.
 */
export declare function first(value0: Envelope): bigint;

/**
 * Independent corpus contract.
 */
export declare function groupValues(value0: bigint): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>;

/**
 * Independent corpus contract.
 */
export declare function inspectAliasPair(value0: AliasPair): bigint;

/**
 * Independent corpus contract.
 */
export declare function listValues(value0: bigint): ReadonlyArray<bigint>;

/**
 * Independent corpus contract.
 */
export declare function nested(value0: Pair): bigint;

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
export declare function plainFin(value0: bigint): bigint;

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

/**
 * Independent corpus contract.
 */
export declare function second(value0: Envelope): bigint;

declare const bindings: Readonly<{
  readonly aliases: typeof aliases;
  readonly arrayValues: typeof arrayValues;
  readonly branch: typeof branch;
  readonly combine: typeof combine;
  readonly echo: typeof echo;
  readonly echoEvent: typeof echoEvent;
  readonly echoGroups: typeof echoGroups;
  readonly echoPair: typeof echoPair;
  readonly eventChoices: typeof eventChoices;
  readonly eventEmpty: typeof eventEmpty;
  readonly eventFirst: typeof eventFirst;
  readonly eventSecond: typeof eventSecond;
  readonly eventValue: typeof eventValue;
  readonly first: typeof first;
  readonly groupValues: typeof groupValues;
  readonly inspectAliasPair: typeof inspectAliasPair;
  readonly listValues: typeof listValues;
  readonly nested: typeof nested;
  readonly noItems: typeof noItems;
  readonly optional: typeof optional;
  readonly pairValues: typeof pairValues;
  readonly plainFin: typeof plainFin;
  readonly produceEnvelope: typeof produceEnvelope;
  readonly product: typeof product;
  readonly scalar: typeof scalar;
  readonly second: typeof second;
}>;
export default bindings;
