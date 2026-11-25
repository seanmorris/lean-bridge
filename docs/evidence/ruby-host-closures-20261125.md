# Returned Lean functions over Ruby application objects

MRI 3.3.12 ran three verified, relocated gems on Linux x86-64. Each installed
[client](../../tests/fixtures/ruby-host-closures/consumer.rb) called the
[factory](../../tests/fixtures/ruby-host-closures/Closures.lean) with one box,
supplied a different box during invocation, and received the original instance
back. The client had neither a compiler nor the publisher on its search path.

| Author configuration | Verified package-set receipt (SHA-256) |
| --- | --- |
| Ordinary source | `d4b4dc001e2d1d9e14fd4017b32f7fc32c8c5d800e52e44312ea73e6f89f8cdf` |
| Reviewed public interface | `5ba9be8bc13a849adaf114b019ec3e2afa729c06f6ac8457ee4742e7b3b8a8aa` |
| Host functions, file-reading closure and application-object task | `1b4d7a8dc4bc8a9e9f0d4335e53bad1e6da6236f327e946958180b9f9b677d0c` |

Repeating all three builds with an offline-installed publisher CLI reproduced
the three receipt digests exactly. Before the positive reviewed build, changing
only the callable's owner from Ruby to Python was rejected. Neither that
stale review nor the missing filesystem grant produced a release directory.

The same function worked through `call` and Ruby block conversion. An
exception escaped a nested host call with its original Ruby identity.
Closing a function from inside its own call let that invocation finish,
while a second invocation was refused. Another fiber or thread could not
call, close, or run the factory’s first host method. A retained Proc stopped
working after the binding closed and stayed stale after rebinding.

The owner registry reported zero live Ruby host objects after explicit close,
after owner-side collection of an abandoned function, and after binding
shutdown. In the worker gem, a neighboring awaited task returned the same
box. A separate function read two different contents from the same file on
successive calls. Publishing it without a filesystem grant was refused.

Run `npm run test:ruby-host-closures` with the pinned Lean toolchain and MRI
3.3 development headers. This covers synchronous unary IO closures with
copied scalars or imported Ruby classes. A Ruby block supplied to a Lean task
is [a different ownership path](ruby-worker-gems-20261124.md).
