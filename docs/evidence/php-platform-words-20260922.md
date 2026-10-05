# PHP platform-integer caller repair

VO 1219, 2026-09-22. This regression check retains the existing USize/ISize
coverage; it does not add a type family or change the generated PHP API.

## Failure and cause

[Consumer CI run 35738171308](https://github.com/seanmorris/lean-bridge/actions/runs/35738171308)
failed in the native PHP and PHP-Wasm platform-integer callers with
`Unknown named parameter $unsigned_values`. The native failure reproduced locally
with the installed ordinary-source package.

The collections work made PHP record constructors and properties preserve the
Lean field names. `Words.Sample` has `unsignedValues` and `signedValues`, while
the older integer caller still used `unsigned_values` and `signed_values`.
The repair updates those named arguments and property reads. Function names
such as `keep_unsigned_values` keep their existing projection.

The fast Word contract suite now checks every `Sample` constructor and property
read in the installed caller against the generated 32-bit and 64-bit PHP APIs.
This catches the mismatch without a Lean build or browser startup.

## Installed verification

[Fresh observations](php-platform-words-20260922.json) retain both ordinary-source
and independently reviewed packages, exact caller digests and archive identities.
The original [platform-integer receipt](platform-words-20260918.json) stays
byte-identical. Its test checks the exact historical caller names; a separate
test checks the current caller against the fresh observations.

Native PHP runs both strict and weak callers after offline Composer installation.
PHP-Wasm runs twelve arrangements per source path: embedded and Composer APIs
in Node, plus bundled APIs in Chromium, each with startup/lazy loading and
strict/weak callers. Each execution performs 6,181 checks. All packages are
installed after removing their author workspace and build staging; consumers
have no Lean compiler on their path.

```sh
LEAN_BRIDGE_WORD_PROFILES=php-native node --test tests/native-words.test.mjs
LEAN_BRIDGE_WORD_PROFILES=php-wasm node --test tests/native-words.test.mjs
node --test tests/word-contract.test.mjs tests/word-evidence.test.mjs
```
