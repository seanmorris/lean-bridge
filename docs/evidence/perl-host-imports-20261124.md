# Perl host imports: compiler and dispatch checks

The checked Lake graph reserved `LeanBridge.Host.Perl` for the generator.
Lean compiled a component importing a constructor, mutable property, method
and identity-preserving return. The ordinary source and reviewed API produced
the same public IR and generated interface. A source module shadowing the
provider, an extern from another host, a mismatched scheduler and a stale
member review all failed.

| Compiler output | SHA-256 |
| --- | --- |
| Public binding IR | `510a601d438572ef1f46ee56a697d43eb4f10977481658a859669ad067744e4f` |
| Generated host C | `381d63a7e5e92945f6ff09645c81934c77aa75593bb61d67e1fef6e8b0cb7499` |

On Perl 5.36.3 and 5.38.2, threaded and unthreaded, the generated private
method table called the application's real constructor, accessors and
subclass override. It rejected wrong receivers, a wrong nominal return,
missing methods, forged `isa`/`can` methods and wrong arity. A host object
that evaluates false retained its identity in both a return and a thrown
exception. Binding captured a tied hash's class value once.

Run `npm run test:perl-host-imports` with the pinned Lean producer and
`npm run test:perl-host-members` with `LEAN_BRIDGE_PERL` set to each
interpreter. These are compiler and dispatch checks, not an installed CPAN
host-object package.

## Compiled Lean to Perl and back

On the same four Perl profiles, `npm run test:perl-host-frame` built the
generated Lean import and a real application module, linked their C output
to an XS fixture, and loaded it in a new Perl process. A call to a real
Perl method re-entered Lean and returned to its original invocation. The
test checked the caller's existing `$@` scalar through an alias.

An unchanged Lean `IO.Error` restored the original Perl exception object,
even after Lean had caught a second distinct exception. A replacement Lean
error with the same message did not restore it. Mapping the error to
`EIO String` delivered the mapped string. A malformed Perl method reply
failed inside the protected conversion. Weak observation showed that the
original exception was collectible after the outer call unwound.

After 64 distinct caught failures, the frame refused further host calls
before executing another method. Lean catching that refusal did not turn
the outer call into a success. A fresh invocation succeeded. The fixture
also refused inherited calls after fork and, on threaded Perl, calls from
a cloned interpreter. This is a native frame check with a scalar member;
it does not exercise an installed CPAN host-object pair.

## Shared identity across components

Two independently compiled XS components used the same registry in the real
`LeanBridge::Runtime` XS library. A separate witness retained a Lean value;
compiled Lean in the other component compared it with the wrapper for the
same Perl referent. Both load orders passed on 5.36.3 and 5.38.2, threaded
and unthreaded. Distinct objects that overload equality remained distinct,
as did different nominal kinds. The tests rejected reblessed objects,
foreign external classes and stale wrappers. A failed partial binding rolled
back. A weak object kept its borrow anchor only while Lean retained the
wrapper; an admitted strong object survived until the last matching unbind.
An input rejected before admission did not leave a pin. Reentry from a Perl
destructor during registry cleanup was refused. Live rows returned to zero.

A separate archive run built all four XS variants, extracted them from the
actual CPAN runtime tarball, and loaded each with its matching interpreter
and the verified native runtime. It checked all seven private registry
symbols and the binding hashes of the distributed ABI header, implementation
and `Runtime.xs`.

| Artifact | SHA-256 |
| --- | --- |
| Native runtime identity | `435df3ba25c15f046436350294d649cec8014446ac00b9610150ec6b173b03d0` |
| CPAN binding identity | `93e84bc3a42acdec6fca0ca4a3bd0e215322969197adc11ff4ad6abf67ddc2ad` |
| Four-ABI CPAN runtime archive | `44164075aa223e5d7126803c501f53e9c0154028ee606998d70b3657de44b4a9` |
| 5.36.3 threaded XS | `85ccbb92aa56bcf79a3c1ba268e219e66eb13acbc601c5e554dd3b7aa04f22f0` |
| 5.36.3 unthreaded XS | `30bcb000ce32ca8badc87710d2d40181dd1ca8166546c3eb4a6c71856a976324` |
| 5.38.2 threaded XS | `670dd22696597d29db5b8f0df72786e960d9623212eb576da6b38f68e484a7a4` |
| 5.38.2 unthreaded XS | `89321f836fab00c33c95178d61832e89eab4559b1468ff4440de094d8f57f157` |

Run `npm run test:perl-host-domain` per interpreter and
`npm run test:perl-host-runtime-archive` with the JSON array of interpreter
paths in `LEAN_BRIDGE_PERLS`. The two-component probe and the runtime archive
are separate checks: neither installs a pair of generated CPAN host-object
distributions.

## Generated member ABI

The two-component test also compiles the generated C declaration of every
member alongside Lean's emitted C. Both libraries execute the generated
native adapters. Lean calls a Perl constructor, writes and reads a property,
calls a method, and receives the original blessed object. The client counts
all 19 scalar method calls. Lean checks the returned values, including signed
and unsigned limits, floating-point subnormals, Unicode with an embedded
NUL, a copied byte string and 160-bit `Math::BigInt` values. Returning an
ordinary integer where a native Perl boolean was required failed in the
converter; the following valid call succeeded.

For borrowed results, the host method overwrote the argument scalar Perl
passed it. Whether the declared anchor was the receiver or a named parameter,
the result still kept the **original** anchor alive. The peer saw the same
child, an unrelated receiver was collectible, and clearing the last Lean
reference released both child and anchor. All eight interpreter/load-order
combinations passed. These are native component tests; the public host-object
package builder remains a separate gate.
