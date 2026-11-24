# Checking a PHP application's class contract

The native PHP authoring check now compiles a Lean package that imports
`LeanBridge.Host.Php`. It distinguishes an application-owned PHP object
from a Lean-owned resource. The native Composer build links the resulting C
externs to a PHP binding. PHP-Wasm does not inherit this native owner.

Set `LEAN_BRIDGE_LEAN_PREFIX` to the pinned Lean 4.32.2 installation and run
`npm run test:php-host-imports`. The [Workshop fixture](../../tests/fixtures/php-host-members/Workshop.lean)
constructs a box, reads and writes its property, calls a method, and returns
the box unchanged. It also maps a host failure to `EIO String`, returns an
`Except` containing the box as ordinary data, and throws a box through
`EIO Box`. The check compiles ordinary source and an independently reviewed
public interface. It checks the generated foreign symbols, receiver and
result ownership, and the two distinct error channels. It rejects a stale
review, a shadowed host module, a substituted symbol, omitted compiled
member dependencies, changed import bytes, and worker declarations for an owner-only class.
Both source routes produced public IR SHA-256
`814e952d26a63f75e5ad4a605e201c35a31e8f2daa317aece6081b9f5658d912`
and host-module C SHA-256
`8eb80b5b855ba427851888d582fef6bac9ebd5f893f63e054e0536d9ea70b94a`.

Run `npm run test:php-host-members` to exercise the private PHP dispatcher
against real application objects. Set `LEAN_BRIDGE_HOST_PHP` to select the
interpreter. Constructors, public instance/static methods and public
properties use normal PHP invocation. Subclasses keep their identity; a
method's original `Throwable` is distinct from an invalid receiver or an
object returned with the wrong class. Unset properties cannot fall back to
undeclared magic access. On PHP 8.4 and newer, the test also calls declared
property hooks and rejects a setter that would bypass PHP visibility.

The dispatcher passed 20 checks on PHP 8.2.35 and 24 on PHP 8.5.10.
The [offline CLI install test](../../tests/cli-npm-package.test.mjs) also
loads the compiler and resolves the constructor symbol from the installed
author tarball, then compares its PHP dispatcher with the tested source.

## Installed Composer checks

`npm run test:php-host-installed` builds the ordinary and reviewed Workshop
projects and verifies their package-set receipts. Composer installs local ZIPs
and pinned Brick Math with networking, plugins and install scripts disabled.
The test removes the Lean source and unpacked producer, relocates the consumer,
verifies the installed inventory and runs with no compiler on its path.
Set `LEAN_BRIDGE_PHP_HOST_INTERPRETERS` to a comma-separated list of absolute
PHP executable paths. Set `LEAN_BRIDGE_PHP_HOST_OUTPUT` to an existing
directory to keep the archives, receipts and consumer results for replay.
To test a newer client against those same package bytes, run:

```sh
LEAN_BRIDGE_PHP_HOST_REPLAY=/path/to/php-host-handoffs-ID npm run test:php-host-installed
```

The replay reads the ordinary and reviewed handoffs, verifies their receipts
and reinstalls them offline. It does not recompile Lean or modify either handoff.

The [installed client](../../tests/fixtures/php-host-members/compiled.php)
initially passed 22 checks on PHP 8.2.35 and 8.5.10 for each source route. The first
call returns an application-created object unchanged. Lean then constructs and
mutates a PHP object, handles nested calls, propagates the original exception,
maps it to a typed failure and carries objects in both value and error
payloads. Wrong-class and wrongly typed PHP replies stay boundary errors,
even when Lean maps an IO failure. A later valid call succeeds. An attempted
close from inside a call leaves the binding usable.
Explicit close, repeated close and reopening leave zero private PHP references.

The expanded client passed **35 checks on PHP 8.2.35 and 34 on PHP 8.5.10**
for each of the same two archives. While a member was suspended inside a
real Lean call, the owner guard refused another caller's read, close and new
binding. The original Fiber resumed and returned its value. Cloning,
serialization and attempts to use an uninitialized binding failed.
A discarded weak-canonical object became unreachable immediately. The
extra check on PHP 8.2 used an actual fork: neither read nor close worked
in the child, and the parent binding remained usable. The tested 8.5
interpreter was built without `pcntl_fork`.

| Source route | Composer ZIP SHA-256 | Package-set receipt SHA-256 |
| --- | --- | --- |
| Ordinary | `fcd07cca0c5ad63bc1efc6c0171b971a2945f00df6bcb4b88978657b96170ab0` | `9ba9b6372404200487a2f53931b55c3431faeccc7e9e96bb30545e5cc5897e50` |
| Reviewed | `586cc6a8829e60e051070d908bcb49a8ca47b9ad8e3de268db8fb5389a97379f` | `4f3e0105226eb6694dcf4f42a60aea26da7d3b5b9fef95c13b68151f5c2cecde` |
| Independent peer | `6a6a10b5999f5741002e800d43275aaf73042a1787c60da4f0f76f99c960bc47` | `a19cfc0a7a54816ab1ec8f8f64ad7cbb40b383a3283f0db578292ad63039c92d` |

`npm run test:php-host-peer` installs the ordinary package alongside a
separately compiled peer. To reuse the first ZIP, set
`LEAN_BRIDGE_PHP_HOST_HANDOFF` to the ordinary handoff directory. The
[two-package client](../../tests/fixtures/php-host-members/peer.php) passed
in both load orders on both interpreters. A conflicting class binding left
the original binding intact. The two packages shared the same PHP object,
observed each other's mutations and preserved the original nested exception.
Closing one binding left the other usable; closing both left zero private tokens.

The local runs used Linux x86-64, Lean 4.32.2, NTS PHP with FFI and the
glibc 2.36 test floor. The release default remains glibc 2.38. These checks
do not cover PHP-Wasm, PHP calls from worker threads or arbitrary host
members not declared in the import contract.
