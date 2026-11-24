# Checking a PHP application's class contract

The native PHP authoring check now compiles a Lean package that imports
`LeanBridge.Host.Php`. It distinguishes an application-owned PHP object
from a Lean-owned resource. This is a compiler and PHP dispatch checkpoint;
the public Composer build does not yet link the two or expose a binding.
PHP-Wasm does not inherit this native owner.

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

These checks do not establish a native object lifetime across an installed
Composer call. That requires a compiled bridge, cross-package identity,
and installed tests for cleanup and reentry on the PHP owner.
