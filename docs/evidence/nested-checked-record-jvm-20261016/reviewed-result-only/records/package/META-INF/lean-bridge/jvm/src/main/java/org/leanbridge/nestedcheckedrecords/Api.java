package org.leanbridge.nestedcheckedrecords;
public final class Api {
    private Api() { }
/**
 * Checked Lean Fin bounds: result[*] projects proof-backed record payload fields; result[*].digit &lt; 10; result[*].word projects the Subtype base value.
 */
    public static Packet[] produceArray(java.math.BigInteger arg0) { return Runtime.call0(arg0); }
/**
 * Checked Lean Fin bounds: result? projects proof-backed record payload fields; result?.digit &lt; 10; result?.word projects the Subtype base value.
 */
    public static Option<Packet> produceOption(java.math.BigInteger arg0) { return Runtime.call1(arg0); }
}
