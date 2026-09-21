# Native PHP List FFI compatibility

The native PHP List alignment guard used a static `FFI::cast()` call. PHP 8.3+
deprecates that call form. PHP 8.5 emitted a warning and failed the clean-output
contract in CI. The guard now calls `cast()` on the existing FFI instance.
It still reads the address of the pointer field before checking alignment.

The pointer-guard and syntax contracts pass on PHP 8.2.33 and PHP 8.5.10.
The installed-package suite was rebuilt and rerun on PHP 8.2.33 NTS CLI.
The [follow-up machine record](php-native-lists-ffi-20260921.json) captures those
new packages, sources, receipts and execution hashes. The
[original record](php-native-lists-20260921.json) and its artifact inventory
remain unchanged.

Both ordinary-source and independently reviewed-IR packages retain all checks
documented in the [native PHP List milestone](php-native-lists-20260921.md):

- Weak and strict callers each pass 86,983 public assertions three times.
- Each source path injects 591 conversion failures and passes 14,895 probe
  assertions, including twenty real cleanup failures, nine malformed outputs,
  two empty poison-pointer cases and the four-byte alignment case.
- Offline installation, producer/handoff removal, relocation and compiler-free
  execution leave the installed files and mapped libraries unchanged.

Reproduce with an FFI-enabled PHP CLI and the native build prerequisites:

```sh
LEAN_BRIDGE_PHP=/absolute/path/to/php-8.5 \
  node --test tests/php-list-contract.test.mjs
LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 \
  LEAN_BRIDGE_PHP_LIST_TEST=1 \
  LEAN_BRIDGE_PHP_LIST_REPORT=build/lists/php-native-ffi.json \
  node --test tests/php-lists.test.mjs
node --test tests/php-list-evidence.test.mjs
```

The local installed run used glibc 2.36; the CI package floor remains 2.38.
PHP 8.5 coverage here is the syntax and pointer-guard contract, not a second
installed-package run. No registry package was published.
