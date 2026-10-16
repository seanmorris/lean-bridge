// Generated from Binding IR SHA-256 5a794d0c15d10efc26ed3f5ef79f701356523cb78ebaaf9bc9d5bbdf32cc095a.
/**
 * Checked Lean MutualCheckedRecords.Envelope.
 */
export interface Envelope {
  readonly value: bigint;
  readonly mode: bigint;
  readonly next: Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: Step }>;
}

/**
 * Checked Lean MutualCheckedRecords.EnvelopeAlias.
 */
export type EnvelopeAlias = Envelope;

/**
 * Checked Lean MutualCheckedRecords.Step.
 */
export type Step = Readonly<{ readonly kind: "stop" }> | Readonly<{ readonly kind: "more"; readonly packet: Envelope }>;

/**
 * Call MutualCheckedRecords.echo.
 */
export declare function echo(arg0: Envelope): Envelope;

/**
 * Call MutualCheckedRecords.echoGroups.
 */
export declare function echoGroups(arg0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>): ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>;

/**
 * Call MutualCheckedRecords.first.
 */
export declare function first(arg0: Envelope): bigint;

/**
 * Call MutualCheckedRecords.groups.
 */
export declare function groups(arg0: ReadonlyArray<Readonly<{ tag: "none" }> | Readonly<{ tag: "some"; value: EnvelopeAlias }>>): bigint;

/**
 * Call MutualCheckedRecords.produce.
 */
export declare function produce(arg0: bigint): Envelope;

/**
 * Call MutualCheckedRecords.second.
 */
export declare function second(arg0: Envelope): bigint;

declare const bindings: Readonly<{
  readonly echo: typeof echo;
  readonly echoGroups: typeof echoGroups;
  readonly first: typeof first;
  readonly groups: typeof groups;
  readonly produce: typeof produce;
  readonly second: typeof second;
}>;
export default bindings;
