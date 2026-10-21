// Stand-in for the generated public carrier: a Java record with two retained
// naturals and no proof field. Kotlin reads its components as properties.
package org.leanbridge.dependentrecords;

public record Dependent(java.math.BigInteger bound, java.math.BigInteger below) {
    public Dependent {
        java.util.Objects.requireNonNull(bound);
        java.util.Objects.requireNonNull(below);
    }
}
