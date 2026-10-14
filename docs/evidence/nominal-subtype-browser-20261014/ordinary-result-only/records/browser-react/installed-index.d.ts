// Generated from Binding IR SHA-256 876d028329e0f44b957cec223ce5895e94ca5cb3245f3b5c171f7fa81dc80306.
/**
 * Checked Lean NominalSubtypes.AliasPair.
 */
export interface AliasPair {
  readonly left: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>;
  readonly right: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>;
}

/**
 * Checked Lean NominalSubtypes.Envelope.
 */
export interface Envelope {
  readonly payload: bigint;
  readonly digit: bigint;
}

/**
 * Checked Lean NominalSubtypes.EnvelopeAlias.
 */
export type EnvelopeAlias = Envelope;

/**
 * Checked Lean NominalSubtypes.Event.
 */
export type Event = Readonly<{ readonly kind: "empty" }> | Readonly<{ readonly kind: "box"; readonly value: Envelope }> | Readonly<{ readonly kind: "choices"; readonly values: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Readonly<{ ok: bigint }> | Readonly<{ error: bigint }> }>> }>;

/**
 * Call NominalSubtypes.arrayValues.
 */
export declare function arrayValues(arg0: bigint): ReadonlyArray<bigint>;

/**
 * Call NominalSubtypes.branch.
 */
export declare function branch(arg0: bigint): Readonly<{ ok: bigint }> | Readonly<{ error: bigint }>;

/**
 * Call NominalSubtypes.eventChoices.
 */
export declare function eventChoices(arg0: bigint): Event;

/**
 * Call NominalSubtypes.eventEmpty.
 */
export declare function eventEmpty(arg0: bigint): Event;

/**
 * Call NominalSubtypes.eventValue.
 */
export declare function eventValue(arg0: bigint): Event;

/**
 * Call NominalSubtypes.groupValues.
 */
export declare function groupValues(arg0: bigint): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>;

/**
 * Call NominalSubtypes.listValues.
 */
export declare function listValues(arg0: bigint): ReadonlyArray<bigint>;

/**
 * Call NominalSubtypes.noItems.
 */
export declare function noItems(arg0: bigint): ReadonlyArray<bigint>;

/**
 * Call NominalSubtypes.optional.
 */
export declare function optional(arg0: bigint): Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: bigint }>;

/**
 * Call NominalSubtypes.pairValues.
 */
export declare function pairValues(arg0: bigint): AliasPair;

/**
 * Call NominalSubtypes.produceEnvelope.
 */
export declare function produceEnvelope(arg0: bigint): Envelope;

/**
 * Call NominalSubtypes.product.
 */
export declare function product(arg0: bigint): readonly [bigint, bigint];

/**
 * Call NominalSubtypes.scalar.
 */
export declare function scalar(arg0: bigint): bigint;

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
