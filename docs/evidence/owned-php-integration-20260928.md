# Native PHP ownership CLI integration

VO 1219. Native `--target php-native` builds admit explicitly owned aggregates
from ordinary Lean source and compiler-checked reviewed contracts. The CLI
validates the PHP projection before compiling, builds its ownership adapter
with private GMP, and emits a Composer ZIP and release-root package-set receipt.
Combined C/PHP releases reuse one Lean component. Copied PHP packages retain
their existing transport and loader.

The CLI archive includes the ownership generators, build and release modules.
Local, global and `npm exec` installations exercise that archive without the
repository or install scripts. Consumer and publisher documentation describe
the generated PHP values, scoped borrows, explicit retention, cleanup and
package-manager installation. The exact Lean and PHP examples are executable
acceptance inputs.

## Execution evidence

The [integration receipt](owned-php-integration-20260928.json) binds the current
source files to the original reports and command output. Its tests regenerate
the Lean, C and PHP adapter sources from retained compiler metadata, compare
their hashes with installed receipts, check the complete caller matrix, and
reject changed scopes or substituted observations.

Acceptance includes ordinary and reviewed CLI builds, offline Composer
installation after producer removal, compiler-free relocation and receipt
verification, strict and weak callers, all 51 public exports and 19 primitive
types, original exception identity, injected allocation failures, expiring
borrows, retained owners and automatic shutdown. Each package-loading observer
checks one Lean runtime, private GMP resolution and zero remaining native
identities after shutdown.

Independent CLI builds reproduce the original archive and every installed
file. Two owned APIs and a copied recursive API share a Composer deployment and
execute nested callbacks in four initial loading orders. Foreign resource
wrappers reject. The author documentation builds C and PHP together; its
installed consumer prints `42` twice after closing one independent owner.

CI requires all eight ownership suites and thirteen nonempty reports. It
retains the reports even when a step fails, and an ownership failure marks the
native PHP observation failed and fails the consumer job. The existing copied
PHP and PHP-Wasm suites remain required.

## Historical evidence

The preceding Perl and JVM JSON receipts remain unchanged. The new receipt
records exact literal edits and both whole-file identities for shared source
changes. Historical checks reverse only those authenticated edits. Unknown
changes remain visible and fail verification. Current type-surface source
hashes change without promoting coverage cells.

This receipt covers native PHP's explicit lease profile. PHP-Wasm and
JavaScript/Wasm ownership transports, selected WIT/WASI ownership, transferred
inputs, anchored results and final release verification remain in the full
structured-types goal.
