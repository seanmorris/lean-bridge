# Native PHP host-object lifetimes and failure ordering

The [peer project](../../tests/fixtures/php-host-members/Peer.lean) uses two
installed Composer packages and real PHP objects. One class is weak-canonical;
the second is strong-canonical. A borrowed key can name either its receiver or
a method argument as its owner. The packages share a process-local registry.

The [PHP client](../../tests/fixtures/php-host-members/lifecycle.php) observes
object identity, destructor calls and weak references. Its lifetime checks
cover these cases:

- A temporary object created inside a nested Lean call survives until the
  outer call returns. Its destructor calls both packages. A temporary created
  by that destructor is queued and finalized once, outside the native frame.
- When a destructor throws after a successful operation, PHP receives that
  same exception. An original member exception, a mapped `EIO String` or a
  Lean `IO.Error` takes precedence over a secondary cleanup exception.
- Two bindings see the same strongly held key. A receiver borrow retains its
  receiver. A parameter borrow retains the named argument, not the object
  on which the method was called. Attaching that anchor again adds no token.
- Closing a non-final binding leaves the key and both anchors alive.
  Closing the final binding releases all three, even when all three destructors
  throw. Each sees the binding as closed and can still call the other package.
  The first cleanup exception reaches the caller; repeated close is harmless.

The final case deliberately retires the loaded native broker during a nested
PHP method. The outer method catches the inner call's error and returns a
normal PHP value. The outer Lean call must still fail. Later calls must not
enter application code, and closing the retired bindings must release the
strong key and its anchor.

## Results

| Installed client | PHP 8.2.35 | PHP 8.5.10 |
| --- | --- | --- |
| Workshop, ordinary and reviewed | 35 checks per package, including fork | 34 per package; this interpreter lacks `pcntl_fork` |
| Workshop + ordinary peer, either native load order | 25 lifetime + 6 retirement checks per order | 25 + 6 per order |
| Workshop + reviewed peer, either native load order | 25 lifetime + 6 retirement checks per order | 25 + 6 per order |

All eight peer executions finished with zero private tokens. The
[receipt and execution record](php-host-finalizers-20261124.json) identifies
the four archives, their receipts, the exact clients and the observed
destructor calls.

## Reproduce locally

Run `npm run test:php-host-installed` followed by `npm run test:php-host-peer`.
Set `LEAN_BRIDGE_PHP_HOST_OUTPUT` to an existing directory to keep the
packages and their receipts. The peer test builds the first package itself
unless `LEAN_BRIDGE_PHP_HOST_HANDOFF` points to an ordinary Workshop handoff.
It builds the peer twice, first from source and then with a reviewed public
interface that must match the compiler output. Both routes use offline
Composer installs and run without a compiler on the consumer's path.

To rerun the clients without rebuilding either package:

```sh
export LEAN_BRIDGE_PHP_HOST_HANDOFF=/path/to/php-host-handoffs-ID/ordinary/handoff
export LEAN_BRIDGE_PHP_HOST_PEER_REPLAY=/path/to/php-host-peer-ID
export LEAN_BRIDGE_PHP_HOST_INTERPRETERS=/path/to/php82,/path/to/php85
npm run test:php-host-peer
```

This checks synchronous native PHP CLI on Linux x86-64. It does not test
PHP-Wasm or PHP member dispatch from a worker.

The peer suite also has a [reference-token exhaustion probe](../../tests/fixtures/php-host-members/registry-limit.php).
It raises the private registry counter to its ceiling just before the host
publishes a newly constructed object. The callback catches the resulting
overflow and the test restores the counter. Both packages must still refuse
new calls. This exercises a terminal registry failure without allocating
billions of objects or telling the runtime to retire. Ordinary exceptions,
mapped Lean failures and invalid arguments have separate, recoverable cases.

`error-policy.json` in each route's output records those observations alongside
the [last-owner check](../../tests/fixtures/php-host-members/error-owner.php)
and the digests of both clients and both installed packages.
