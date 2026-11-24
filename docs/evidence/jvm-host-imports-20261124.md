# Checking a JVM host object's Lean interface

The compiler can now check a Lean project that imports an application-owned
JVM class. The test contract has a constructor, a method, a mutable property,
and a method that returns the receiver. No application-supplied object code
or Lean interface is used to validate those declarations.

With Lean 4.32.2 installed, set `LEAN_BRIDGE_LEAN_PREFIX` to its installation
directory and run `npm run test:jvm-host-imports`. The test compiles the
project once from ordinary source and again against a reviewed public
interface. Both routes produced the same public IR
(`868331aabdafc7968d82f02d2da5b3225ac4b63949c6cb9eafe70c1c8e1b13eb`)
and generated host-module C
(`ab6791f92f8bf2363b776436b825f13228c88daa3dc6f9d7df0a5605f77b1bb5`).

The checked interface distinguishes a leased host reference from a copied
value, records both the property read and write, and distinguishes an
escaping host exception from a Lean-mapped `EIO` error. A changed reviewed
member, a foreign native symbol, a different host scheduler, or a source
module shadowing the generated one is rejected.

## Calling Java from compiled Lean

Set `JAVA_HOME` to JDK 22 and run `npm run test:jvm-host-members` on Linux
with the same Lean installation and a C compiler. The first test binds a
public Java constructor, instance and static methods, and a JavaBean
property from the import contract. It checks observable mutation, nominal
object identity, copied byte arrays, Unicode, and numeric bounds. A bad
boundary value is distinguished from an exception thrown inside the method.

The second test compiles [a Lean caller](../../tests/fixtures/jvm-host-members/FrameCheck.lean)
and an actual JNI library. Both a platform thread and a virtual thread call
it. Java calls back into Lean on the serialized owner thread without a
deadlock. Two Java exceptions have identical messages: when Lean catches
both and rethrows the first error, the caller gets the *first Java object*.
When Lean replaces an error with the same text or maps it to a typed
`EIO String`, neither result is mistaken for the original exception.

This native test uses a small test entry point and one static host member.
It is not a Maven installation test: it does not establish cross-JAR host
object identity, host lease retirement, or generated package delivery.

## Sharing an application object between components

`npm run test:jvm-host-domain` compiles two independent native components,
packages their private Java adapters in separate JARs and removes both build
directories. A Java consumer loads each JAR in a different classloader and
exercises both load orders, each in a fresh JVM with JNI checking enabled.

The first component calls the host's identity method and saves the resulting
Lean reference in a test observation slot. The second component receives the
original Java object as a fresh argument. Lean compares the two wrappers by
pointer: they match. Two objects that compare equal in Java do not match.
One Java object bound as two distinct nominal Lean kinds does not match either.

An incompatible second class in a binding rolls back. A call with a bad
second argument does not retain its first strong argument. Closing a binding
inside its own host method is rejected; closing it after return leaves the
other binding usable. Closing the final binding brings the registry count
to zero, invalidates a previously saved Lean reference even after rebinding,
and lets the JVM collect the object.

The test supplies the component entry and a native observation slot. These
are integration JARs, not releases built by the Maven publisher. On Linux
x86-64, the independently built copies of the owner had SHA-256
`b627be085eafc1cfdc61d2685a7d5c568176e12ac8a82810bd36df6407367b43`;
both copies of the shared nominal domain had SHA-256
`9728e40ff5b5f69e1893524253e12d2055de6cf2aedfadb87eb90e94f77a0436`.
