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
