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
 * Checked Lean Fin bounds: result[*] projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>array&lt;nat&gt;</code>.
 */
    public static java.math.BigInteger[] arrayValues(java.math.BigInteger arg0) { return Runtime.call0(arg0); }
/**
 * Checked Lean Fin bounds: result.ok projects the Subtype base value; result.error projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>result&lt;nat, nat&gt;</code>.
 */
    public static Result<java.math.BigInteger, java.math.BigInteger> branch(java.math.BigInteger arg0) { return Runtime.call1(arg0); }
/**
 * Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit &lt; 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>Event</code>.
 */
    public static Event eventChoices(java.math.BigInteger arg0) { return Runtime.call2(arg0); }
/**
 * Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit &lt; 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>Event</code>.
 */
    public static Event eventEmpty(java.math.BigInteger arg0) { return Runtime.call3(arg0); }
/**
 * Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit &lt; 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>Event</code>.
 */
    public static Event eventValue(java.math.BigInteger arg0) { return Runtime.call4(arg0); }
/**
 * Checked Lean Fin bounds: result[*]?.payload projects the Subtype base value; result[*]?.digit &lt; 3.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>array&lt;option&lt;EnvelopeAlias&gt;&gt;</code>.
 */
    public static Option<Envelope>[] groupValues(java.math.BigInteger arg0) { return Runtime.call5(arg0); }
/**
 * Checked Lean Fin bounds: result[*] projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>list&lt;nat&gt;</code>.
 */
    public static java.math.BigInteger[] listValues(java.math.BigInteger arg0) { return Runtime.call6(arg0); }
/**
 * Checked Lean Fin bounds: result[*] projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>array&lt;nat&gt;</code>.
 */
    public static java.math.BigInteger[] noItems(java.math.BigInteger arg0) { return Runtime.call7(arg0); }
/**
 * Checked Lean Fin bounds: result? projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>option&lt;nat&gt;</code>.
 */
    public static Option<java.math.BigInteger> optional(java.math.BigInteger arg0) { return Runtime.call8(arg0); }
/**
 * Checked Lean Fin bounds: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit &lt; 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit &lt; 3.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>AliasPair</code>.
 */
    public static AliasPair pairValues(java.math.BigInteger arg0) { return Runtime.call9(arg0); }
/**
 * Checked Lean Fin bounds: result.payload projects the Subtype base value; result.digit &lt; 3.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>Envelope</code>.
 */
    public static Envelope produceEnvelope(java.math.BigInteger arg0) { return Runtime.call10(arg0); }
/**
 * Checked Lean Fin bounds: result.0 projects the Subtype base value; result.1 projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>tuple&lt;nat, nat&gt;</code>.
 */
    public static Pair<java.math.BigInteger, java.math.BigInteger> product(java.math.BigInteger arg0) { return Runtime.call11(arg0); }
/**
 * Checked Lean Fin bounds: result projects the Subtype base value.
 *
 * @param arg0 Contract type: <code>nat</code>.
 * @return Contract type: <code>nat</code>.
 */
    public static java.math.BigInteger scalar(java.math.BigInteger arg0) { return Runtime.call12(arg0); }
}
