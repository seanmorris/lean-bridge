# Recursive native PHP conversions

The [execution record](php-recursive-conversions-20260923.json) binds generated
PHP, independent C and PHP callers, fresh Lean components and passing logs.
It covers native conversion. Recursive Composer installation and PHP-Wasm Zend
conversion remain separate acceptance work.

The private FFI schema uses the shared C graph declarations. C compiler probes
check PHP's sizes, alignment and field offsets. Pointer typedefs remain owned by
the schema while arithmetic views refer to scoped buffers. Public value classes
do not load FFI or expose native handles.

Calls validate every argument before creating the schema. A bounded dry pass
checks combined scratch requirements before allocation. Iterative cursors copy
inputs before resolving the authenticated package target. Each copied scalar
and constructor is checked again during the write. Output cursors preserve
nominal constructors, option/result branches, integer bounds, Unicode and
independent copies. Path-local native address checks reject cyclic outputs.

Each call limits value depth to 128 and visits to 262,144. Native scratch and
PHP-side accounting each have a 16 MiB budget. The adapter rejects invalid tags,
noncanonical integer magnitudes, invalid Unicode, missing or misaligned spans,
overflowing addresses and excessive lengths before following the affected data.
The authenticated native adapter supplies readable memory. Span checks do not
validate arbitrary foreign addresses.

One pre-bound C cleanup function releases the output's root owner in `finally`.
It clears the owner prefix before releasing and never follows tags or child
pointers. PHP releases its input and result scratch after native cleanup.
Malformed output retires the shared runtime; already copied PHP values remain
usable, and owners held before retirement can still be released.

The isolated gate checks 478 layout observations and injects failures at all
180 PHP allocation/construction checkpoints in weak and strict callers. The
compiled gate builds ordinary Lean source and an independently reviewed
contract, exercising all eighteen exports in both caller modes. Each run
injects native allocation failures and PHP conversion failures, then tests one
of four runtime-retirement scenarios in a fresh process. Native ledgers and
weak references to PHP scratch owners confirm cleanup.

Reproduction commands appear in the
[contributor guide](../contributing/testing.md#recursive-native-php-conversions).
