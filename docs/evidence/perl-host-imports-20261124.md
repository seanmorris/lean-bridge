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
interpreter. For installation and relocation, see [CPAN host packages](#cpan-host-packages).

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
a cloned interpreter.

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
paths in `LEAN_BRIDGE_PERLS`.

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
combinations passed.

## Public Perl calls

`npm run test:perl-host-exports` compiles a Lake application into one Linux
shared library. Only the XS adapter varies by Perl ABI. The publisher checks
the entry signatures against Lean's emitted C, checks the exported symbol list,
and rejects a library with a Perl dependency, a runtime search path, or an
embedded producer path. Set `LEAN_BRIDGE_PERLS` to a JSON array of interpreter
paths to test them against the same compiled library.

Perl 5.36.3 and 5.38.2, threaded and unthreaded, each ran the client against
component SHA-256 `1ca86269fdb2a16081d04752b43ceffa71b93f306a506d4852f47128be328ff4`.
None of the four XS adapters exported its member dispatch functions.
The tied class table, tied integer argument and tied object argument each
supplied their value once.

The client loads `LeanBridge::Workshop` and calls
`with_hosts({Box => 'Meter'}, sub { ... })`. A constructor returns a blessed
`Meter`. A property update changes that object, and an identity call returns
the same referent. The scope forwards list, scalar and void context. It releases
the binding when the block returns or dies; a call outside the block fails.

The client distinguishes a rethrown Perl exception, a new Lean IO error with
the same message, a declared EIO failure, and a returned nested `Except`. A
nominal value in either arm or in the error payload keeps the original object
alive after the binding closes. Dropping the last Perl reference releases it.
When Lean catches repeated host failures, the 65th attempted call stops before
the Perl method runs. Lean cannot turn that exhausted frame into a success.

This check uses public calls and a fixture loader. The CPAN package check below
uses the CLI and separate component archives.

## CPAN host packages

An offline installation of the packed CLI built Workshop and Peer from ordinary
Lean source and again with independently reviewed APIs. Each package contained
one compiled Lean library and four XS adapters. Each required the same exact
runtime archive (`44164075…b4a9`, full digest above).
These were local Linux x86-64 builds with the development glibc floor set to
2.36. No package was published to CPAN.

| Source | Package | Component archive SHA-256 | Compiled Lean library SHA-256 |
| --- | --- | --- | --- |
| Ordinary | Workshop | `76c2dc1c9a960fc156aed33053f36253c3ba6e7074d543820c0ce2bef475f02a` | `ed106b77a83cbe6d2dab2ab9f4a6e971e5c578357c414175af4878c5bac6a5b6` |
| Ordinary | Peer | `ced1b6741fe844ae835455617c1d993f27624c89c33daf69282586cd843863e7` | `ac44d739cb2414dccb9d654feef3f63e0e8ff083f10755f37f8f9adbbfee2a9c` |
| Reviewed | Workshop | `c73b2b0e47f9690a9c2d2a090816d6ffae8637f573d47fd411bd087605bad109` | `4ce0af0b0a11badcf2a34df998a4ffaf2004a79ed25f40e073ce55bac2b5e630` |
| Reviewed | Peer | `c73ff419cfa8868a541349f68402a7aef4a21b1cf7e3afc27bbb580fdebec6f5` | `7d245272dee9755c7fe180ab15ef1a7fa358ea9a53a25f5674fce72894d2fe60` |

The verifier rejected six modified copies of the ordinary Workshop package
after their inventories had been recomputed: a removed or ambiguous profile,
an extra installed module, an extra test, an XS receipt naming the wrong
source, and a replacement Makefile.PL.

Perl 5.36.3 and 5.38.2, each threaded and unthreaded, installed both pairs.
The ordinary pair used prebuilt XS; the reviewed pair built the component XS
against the prebuilt runtime. In all 16 processes (eight installs × two load
orders), the client mutated an application object through the other component,
re-entered Lean from a Perl method, and distinguished an original exception,
a replacement IO error and a mapped EIO error. A rejected call left no strong
pin. A nested error retained its weak object until released; the final matching
unbind released the strong object, and a later call rejected its stale wrapper.

An independent replay rehashed the five original archives, verified all four
component manifests, and repeated those eight installations in fresh prefixes.
The prebuilt installer had no compiler on its path; the XS-only installer had
a C toolchain but no Lean, Lake or Node. Each prefix was physically moved
before the two load orders ran. All 16 processes ran with an unavailable
`PATH` and loaded both component modules and the runtime from the moved
prefix. All 24 installed XS binaries matched their installation receipts.

Run the [Perl host-object package check](../contributing/testing.md#perl-host-objects)
to build and exercise a fresh set of packages.

The smaller [documented Workshop project](../../tests/fixtures/perl-host-project/Workshop.lean)
was also built without adding the test-only Token class. With its producer
removed, its original archives installed prebuilt on threaded Perl 5.36.3.
The [documented client](../../tests/fixtures/perl-host-meter/meter.pl) printed
`42` from the moved installation with no build tools on its path.
The single-ABI Workshop archive was 75,147 bytes, SHA-256
`20898de41967c7e7eb3dd0e8fdbde266c68d3acbcd6f66e434f0a6be45f3cb77`.
