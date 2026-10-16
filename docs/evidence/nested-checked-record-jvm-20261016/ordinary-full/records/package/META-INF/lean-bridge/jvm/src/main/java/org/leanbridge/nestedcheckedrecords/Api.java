package org.leanbridge.nestedcheckedrecords;
public final class Api {
    private Api() { }
/**
 * Checked Lean Fin bounds: arg0[*] checked by NestedCheckedRecords.mkPacket; arg0[*].digit &lt; 10; arg0[*].word checked by NestedCheckedRecords.mkWord; result[*] projects proof-backed record payload fields; result[*].digit &lt; 10; result[*].word projects the Subtype base value.
 */
    public static Packet[] echoArray(Packet[] arg0) { return Runtime.call0(arg0); }
/**
 * Checked Lean Fin bounds: arg0 checked by NestedCheckedRecords.mkPacket; arg0.digit &lt; 10; arg0.word checked by NestedCheckedRecords.mkWord.
 */
    public static java.math.BigInteger first(Packet arg0) { return Runtime.call1(arg0); }
/**
 * Checked Lean Fin bounds: arg0[*] checked by NestedCheckedRecords.mkPacket; arg0[*].digit &lt; 10; arg0[*].word checked by NestedCheckedRecords.mkWord.
 */
    public static java.math.BigInteger inArray(Packet[] arg0) { return Runtime.call2(arg0); }
/**
 * Checked Lean Fin bounds: arg0.packet.value checked by NestedCheckedRecords.mkPacket; arg0.packet.value.digit &lt; 10; arg0.packet.value.word checked by NestedCheckedRecords.normalizeWord.
 */
    public static java.math.BigInteger inChoice(Choice arg0) { return Runtime.call3(arg0); }
/**
 * Checked Lean Fin bounds: arg0.ok checked by NestedCheckedRecords.normalizePacket; arg0.ok.digit &lt; 10; arg0.ok.word checked by NestedCheckedRecords.mkWord; arg0.error checked by NestedCheckedRecords.mkPacket; arg0.error.digit &lt; 10; arg0.error.word checked by NestedCheckedRecords.normalizeWord.
 */
    public static java.math.BigInteger inExcept(Result<Packet, Packet> arg0) { return Runtime.call4(arg0); }
/**
 * Checked Lean Fin bounds: arg0.packet checked by NestedCheckedRecords.normalizePacket; arg0.packet.digit &lt; 10; arg0.packet.word checked by NestedCheckedRecords.mkWord.
 */
    public static java.math.BigInteger inHolder(Holder arg0) { return Runtime.call5(arg0); }
/**
 * Checked Lean Fin bounds: arg0[*] checked by NestedCheckedRecords.normalizePacket; arg0[*].digit &lt; 10; arg0[*].word checked by NestedCheckedRecords.normalizeWord.
 */
    public static java.math.BigInteger inList(Packet[] arg0) { return Runtime.call6(arg0); }
/**
 * Checked Lean Fin bounds: arg0? checked by NestedCheckedRecords.mkPacket; arg0?.digit &lt; 10; arg0?.word checked by NestedCheckedRecords.normalizeWord.
 */
    public static java.math.BigInteger inOption(Option<Packet> arg0) { return Runtime.call7(arg0); }
/**
 * Checked Lean Fin bounds: arg0.0 checked by NestedCheckedRecords.mkPacket; arg0.0.digit &lt; 10; arg0.0.word checked by NestedCheckedRecords.mkWord; arg0.1 checked by NestedCheckedRecords.normalizePacket; arg0.1.digit &lt; 10; arg0.1.word checked by NestedCheckedRecords.normalizeWord.
 */
    public static java.math.BigInteger inProduct(Pair<Packet, Packet> arg0) { return Runtime.call8(arg0); }
/**
 * Checked Lean Fin bounds: arg0 checked by NestedCheckedRecords.mkPacket; arg0.digit &lt; 10; arg0.word checked by NestedCheckedRecords.mkWord; arg1 checked by NestedCheckedRecords.normalizePacket; arg1.digit &lt; 10; arg1.word checked by NestedCheckedRecords.normalizeWord.
 */
    public static java.math.BigInteger pair(Packet arg0, Packet arg1) { return Runtime.call9(arg0, arg1); }
/**
 * Checked Lean Fin bounds: result[*] projects proof-backed record payload fields; result[*].digit &lt; 10; result[*].word projects the Subtype base value.
 */
    public static Packet[] produceArray(java.math.BigInteger arg0) { return Runtime.call10(arg0); }
/**
 * Checked Lean Fin bounds: result? projects proof-backed record payload fields; result?.digit &lt; 10; result?.word projects the Subtype base value.
 */
    public static Option<Packet> produceOption(java.math.BigInteger arg0) { return Runtime.call11(arg0); }
/**
 * Checked Lean Fin bounds: arg0 checked by NestedCheckedRecords.normalizePacket; arg0.digit &lt; 10; arg0.word checked by NestedCheckedRecords.normalizeWord.
 */
    public static java.math.BigInteger second(Packet arg0) { return Runtime.call12(arg0); }
}
