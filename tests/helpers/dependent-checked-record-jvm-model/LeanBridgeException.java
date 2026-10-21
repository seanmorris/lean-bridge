// Stand-in for the generated foreign-failure exception the callers never catch.
package org.leanbridge.dependentrecords;

public final class LeanBridgeException extends RuntimeException {
    LeanBridgeException(String message, Throwable cause) { super(message, cause); }
}
