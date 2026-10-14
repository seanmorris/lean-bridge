// Generated from Binding IR SHA-256 aab93dfb3005269c791001ee7231660173fa267219cb90dcd6a3f2c9c773dbe1.
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
 * Checked Lean NominalSubtypes.Pair.
 */
export interface Pair {
  readonly left: Envelope;
  readonly right: Envelope;
}

/**
 * Call NominalSubtypes.aliases.
 */
export declare function aliases(arg0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>, arg1: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>): bigint;

/**
 * Call NominalSubtypes.arrayValues.
 */
export declare function arrayValues(arg0: bigint): ReadonlyArray<bigint>;

/**
 * Call NominalSubtypes.branch.
 */
export declare function branch(arg0: bigint): Readonly<{ ok: bigint }> | Readonly<{ error: bigint }>;

/**
 * Call NominalSubtypes.combine.
 */
export declare function combine(arg0: Envelope, arg1: Envelope): bigint;

/**
 * Call NominalSubtypes.echo.
 */
export declare function echo(arg0: Envelope): Envelope;

/**
 * Call NominalSubtypes.echoEvent.
 */
export declare function echoEvent(arg0: Event): Event;

/**
 * Call NominalSubtypes.echoGroups.
 */
export declare function echoGroups(arg0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>;

/**
 * Call NominalSubtypes.echoPair.
 */
export declare function echoPair(arg0: AliasPair): AliasPair;

/**
 * Call NominalSubtypes.eventChoices.
 */
export declare function eventChoices(arg0: bigint): Event;

/**
 * Call NominalSubtypes.eventEmpty.
 */
export declare function eventEmpty(arg0: bigint): Event;

/**
 * Call NominalSubtypes.eventFirst.
 */
export declare function eventFirst(arg0: Event): bigint;

/**
 * Call NominalSubtypes.eventSecond.
 */
export declare function eventSecond(arg0: Event): bigint;

/**
 * Call NominalSubtypes.eventValue.
 */
export declare function eventValue(arg0: bigint): Event;

/**
 * Call NominalSubtypes.first.
 */
export declare function first(arg0: Envelope): bigint;

/**
 * Call NominalSubtypes.groupValues.
 */
export declare function groupValues(arg0: bigint): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>;

/**
 * Call NominalSubtypes.inspectAliasPair.
 */
export declare function inspectAliasPair(arg0: AliasPair): bigint;

/**
 * Call NominalSubtypes.listValues.
 */
export declare function listValues(arg0: bigint): ReadonlyArray<bigint>;

/**
 * Call NominalSubtypes.nested.
 */
export declare function nested(arg0: Pair): bigint;

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
 * Call NominalSubtypes.plainFin.
 */
export declare function plainFin(arg0: bigint): bigint;

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

/**
 * Call NominalSubtypes.second.
 */
export declare function second(arg0: Envelope): bigint;

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
