// Independent contract oracle for the immutable dependent-record Java and
// Kotlin callers: it mirrors the generated Maven API surface over BigInteger
// values only, with no compiled Lean component, so each caller's exact totals
// and fault sensitivity can be measured without producing a package. Never
// evidence of installed acceptance. The same source serves both public
// packages; the oracle test rewrites only the package line for Kotlin.
package org.leanbridge.dependentrecords;

import java.math.BigInteger;

public final class Api {
    private Api() { }

    private static String fault() {
        var value = System.getenv("LEAN_BRIDGE_DEPENDENT_FAULT");
        return value == null ? "" : value;
    }

    private static BigInteger nat(BigInteger value) {
        if (value.signum() < 0) throw new IllegalArgumentException("Nat cannot be negative");
        return value;
    }

    // The checked constructor: Lean refuses the payload unless below < bound.
    private static void checked(Dependent value) {
        java.util.Objects.requireNonNull(value);
        var bound = nat(value.bound());
        var below = nat(value.below());
        if (below.compareTo(bound) >= 0 && !fault().equals("accept-invalid")) {
            var prefix = fault().equals("wrong-message") ? "wrong0" : "ROUTE_PREFIX";
            var message = prefix + " was rejected by DependentRecords.mkDependent";
            if (fault().equals("wrong-status")) throw new LeanBridgeException(message, null);
            throw new IllegalArgumentException(message);
        }
    }

    // BEGIN FULL_ONLY
    public static BigInteger dependentTotal(Dependent value) {
        checked(value);
        return value.bound().add(value.below());
    }

    public static Dependent dependentRoundtrip(Dependent value) {
        checked(value);
        return fault().equals("wrong-roundtrip")
            ? new Dependent(value.bound().add(BigInteger.ONE), value.below()) : value;
    }
    // END FULL_ONLY

    // BEGIN PRODUCER
    public static Dependent dependentResult(BigInteger seed) {
        seed = nat(seed);
        return new Dependent(seed.add(fault().equals("wrong-produced") ? BigInteger.TWO : BigInteger.ONE), seed);
    }
    // END PRODUCER
}
