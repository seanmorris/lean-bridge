package org.leanbridge.nominalsubtypes;
/**
 * Copied Lean aliases use their JVM target values. The binding manifest retains their contract identities.
 * <table><caption>Copied alias contracts</caption>
 * <tr><th>Lean alias</th><th>Contract target</th><th>Java value type</th><th>Kotlin value type</th></tr>
 * <tr><td><code>EnvelopeAlias</code></td><td><code>Envelope</code></td><td><code>Envelope</code></td><td><code>Envelope</code></td></tr>
 * </table>
 */
public final class Api {
    private Api() { }
/**
 * Checked Lean Fin bounds: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit &lt; 3; arg1[*]?.payload checked by NominalSubtypes.plusTwo; arg1[*]?.digit &lt; 3.
 *
 * @param arg0 Contract type: <code>array&lt;option&lt;EnvelopeAlias&gt;&gt;</code>.
 * @param arg1 Contract type: <code>array&lt;option&lt;EnvelopeAlias&gt;&gt;</code>.
 * @return Contract type: <code>nat</code>.
 */
    public static java.math.BigInteger aliases(Option<Envelope>[] arg0, Option<Envelope>[] arg1) { return Runtime.call0(arg0, arg1); }
/**
 * Checked Lean Fin bounds: result[*] projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>array&lt;nat&gt;</code>.
 */
    public static java.math.BigInteger[] arrayValues(java.math.BigInteger arg0) { return Runtime.call1(arg0); }
/**
 * Checked Lean Fin bounds: result.ok projects the Subtype base value; result.error projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>result&lt;nat, nat&gt;</code>.
 */
    public static Result<java.math.BigInteger, java.math.BigInteger> branch(java.math.BigInteger arg0) { return Runtime.call2(arg0); }
/**
 * Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit &lt; 3; arg1.payload checked by NominalSubtypes.plusTwo; arg1.digit &lt; 3.
 *
 * @param arg0 Contract type: <code>Envelope</code>.
 * @param arg1 Contract type: <code>Envelope</code>.
 * @return Contract type: <code>nat</code>.
 */
    public static java.math.BigInteger combine(Envelope arg0, Envelope arg1) { return Runtime.call3(arg0, arg1); }
/**
 * Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit &lt; 3; result.payload projects the Subtype base value; result.digit &lt; 3.
 *
 * @param arg0 Contract type: <code>Envelope</code>.
 * @return Contract type: <code>Envelope</code>.
 */
    public static Envelope echo(Envelope arg0) { return Runtime.call4(arg0); }
/**
 * Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit &lt; 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo; result.box.value.payload projects the Subtype base value; result.box.value.digit &lt; 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>Event</code>.
 * @return Contract type: <code>Event</code>.
 */
    public static Event echoEvent(Event arg0) { return Runtime.call5(arg0); }
/**
 * Checked Lean Fin bounds: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit &lt; 3; result[*]?.payload projects the Subtype base value; result[*]?.digit &lt; 3.
 *
 * @param arg0 Contract type: <code>array&lt;option&lt;EnvelopeAlias&gt;&gt;</code>.
 * @return Contract type: <code>array&lt;option&lt;EnvelopeAlias&gt;&gt;</code>.
 */
    public static Option<Envelope>[] echoGroups(Option<Envelope>[] arg0) { return Runtime.call6(arg0); }
/**
 * Checked Lean Fin bounds: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit &lt; 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit &lt; 3; result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit &lt; 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit &lt; 3.
 *
 * @param arg0 Contract type: <code>AliasPair</code>.
 * @return Contract type: <code>AliasPair</code>.
 */
    public static AliasPair echoPair(AliasPair arg0) { return Runtime.call7(arg0); }
/**
 * Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit &lt; 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>Event</code>.
 */
    public static Event eventChoices(java.math.BigInteger arg0) { return Runtime.call8(arg0); }
/**
 * Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit &lt; 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>Event</code>.
 */
    public static Event eventEmpty(java.math.BigInteger arg0) { return Runtime.call9(arg0); }
/**
 * Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit &lt; 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo.
 *
 * @param arg0 Contract type: <code>Event</code>.
 * @return Contract type: <code>nat</code>.
 */
    public static java.math.BigInteger eventFirst(Event arg0) { return Runtime.call10(arg0); }
/**
 * Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusTwo; arg0.box.value.digit &lt; 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusTwo; arg0.choices.values[*]?.error checked by NominalSubtypes.plusOne.
 *
 * @param arg0 Contract type: <code>Event</code>.
 * @return Contract type: <code>nat</code>.
 */
    public static java.math.BigInteger eventSecond(Event arg0) { return Runtime.call11(arg0); }
/**
 * Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit &lt; 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>Event</code>.
 */
    public static Event eventValue(java.math.BigInteger arg0) { return Runtime.call12(arg0); }
/**
 * Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit &lt; 3.
 *
 * @param arg0 Contract type: <code>Envelope</code>.
 * @return Contract type: <code>nat</code>.
 */
    public static java.math.BigInteger first(Envelope arg0) { return Runtime.call13(arg0); }
/**
 * Checked Lean Fin bounds: result[*]?.payload projects the Subtype base value; result[*]?.digit &lt; 3.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>array&lt;option&lt;EnvelopeAlias&gt;&gt;</code>.
 */
    public static Option<Envelope>[] groupValues(java.math.BigInteger arg0) { return Runtime.call14(arg0); }
/**
 * Checked Lean Fin bounds: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit &lt; 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit &lt; 3.
 *
 * @param arg0 Contract type: <code>AliasPair</code>.
 * @return Contract type: <code>nat</code>.
 */
    public static java.math.BigInteger inspectAliasPair(AliasPair arg0) { return Runtime.call15(arg0); }
/**
 * Checked Lean Fin bounds: result[*] projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>list&lt;nat&gt;</code>.
 */
    public static java.math.BigInteger[] listValues(java.math.BigInteger arg0) { return Runtime.call16(arg0); }
/**
 * Checked Lean Fin bounds: arg0.left.payload checked by NominalSubtypes.plusOne; arg0.left.digit &lt; 3; arg0.right.payload checked by NominalSubtypes.plusTwo; arg0.right.digit &lt; 3.
 *
 * @param arg0 Contract type: <code>EnvelopePair</code>.
 * @return Contract type: <code>nat</code>.
 */
    public static java.math.BigInteger nested(EnvelopePair arg0) { return Runtime.call17(arg0); }
/**
 * Checked Lean Fin bounds: result[*] projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>array&lt;nat&gt;</code>.
 */
    public static java.math.BigInteger[] noItems(java.math.BigInteger arg0) { return Runtime.call18(arg0); }
/**
 * Checked Lean Fin bounds: result? projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>option&lt;nat&gt;</code>.
 */
    public static Option<java.math.BigInteger> optional(java.math.BigInteger arg0) { return Runtime.call19(arg0); }
/**
 * Checked Lean Fin bounds: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit &lt; 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit &lt; 3.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>AliasPair</code>.
 */
    public static AliasPair pairValues(java.math.BigInteger arg0) { return Runtime.call20(arg0); }
/**
 * Checked Lean Fin bounds: arg0 &lt; 3.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>nat</code>.
 */
    public static java.math.BigInteger plainFin(java.math.BigInteger arg0) { return Runtime.call21(arg0); }
/**
 * Checked Lean Fin bounds: result.payload projects the Subtype base value; result.digit &lt; 3.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>Envelope</code>.
 */
    public static Envelope produceEnvelope(java.math.BigInteger arg0) { return Runtime.call22(arg0); }
/**
 * Checked Lean Fin bounds: result.0 projects the Subtype base value; result.1 projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>tuple&lt;nat, nat&gt;</code>.
 */
    public static Pair<java.math.BigInteger, java.math.BigInteger> product(java.math.BigInteger arg0) { return Runtime.call23(arg0); }
/**
 * Checked Lean Fin bounds: result projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>nat</code>.
 */
    public static java.math.BigInteger scalar(java.math.BigInteger arg0) { return Runtime.call24(arg0); }
/**
 * Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusTwo; arg0.digit &lt; 3.
 *
 * @param arg0 Contract type: <code>Envelope</code>.
 * @return Contract type: <code>nat</code>.
 */
    public static java.math.BigInteger second(Envelope arg0) { return Runtime.call25(arg0); }
}
