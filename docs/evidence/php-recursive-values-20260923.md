# Recursive PHP value declarations

The [execution record](php-recursive-values-20260923.json) binds generated PHP
source, independent callers, actual interpreter identities and passing logs.
This stage covers public values and validation. It neither compiles Lean nor
claims installed Composer or PHP-Wasm package support.

Named copied records and variant cases become final readonly classes. Variant
families use abstract readonly bases; validation accepts only exact generated
cases with every field initialized. Constructors take `mixed` arguments and
perform exact checks, so weak callers cannot coerce strings into integers.
Properties and PHPDoc retain each field's type. Transparent aliases retain
their targets without introducing PHP classes.

An iterative cursor walk handles recursive nominal edges, arrays, Lists,
options, results and binary products. It visits one child at a time. Path-local
object and array-reference identities detect cycles without rejecting shared
acyclic values. Equality completes both traversals even after an earlier
difference; identity comparisons cannot hide a malformed tail. Hashes retain
constructor identity, NaN equality and distinct signed zeros.

The value limits are 128 nesting levels, 262,144 visits and a 16 MiB accounting
budget. Structural PHPDoc expansion has separate 32-level, 65,536-character
and 4 MiB catalog/source limits. The visit-limit test runs under a 128 MiB PHP
memory limit. These checks do not bound a future Lean algorithm's working memory.

Native PHP executes all four combinations of 32/64-bit PHP integer models and
Lean word widths, in weak and strict mode. The 32-bit model checks on native PHP
are simulations. A separate PHP 8.4 WebAssembly interpreter executes the same
32-bit model and callers, recording its actual 32-bit width and loaded binary.
Both environments use the pinned Brick Math implementation for exact large
integers. Runtime conversion and package acceptance remain separate work.

The tests cover nineteen scalars, mutual recursion, optional recursive records,
127-link variant spines, uninhabited cycles, 256-field constructors, nominal
names matching private helpers, and source functions that shadow PHP built-ins.
Readonly properties keep PHP's normal value and reference semantics; validation
runs again before values can cross a future native boundary.

Reproduction commands appear in the
[contributor guide](../contributing/testing.md#recursive-php-values).
