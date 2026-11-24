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
