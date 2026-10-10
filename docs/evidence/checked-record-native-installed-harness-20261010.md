# Checked-record native installed harness

This milestone adds independent consumers for Python, Rust, Ruby, .NET,
Java, Kotlin, native PHP and WIT/WASI. It prepares installed acceptance;
it does not add an installed support claim. The adapters were enabled in
`42f40d5658f82ed57d21424c16187bf510f96cf4`.

## Cases and installation

Each profile has four selections: ordinary source, independently reviewed
source, and a standalone result-only package for each source route. The
full consumer expects 9,024 checks; the result-only consumer expects 1,002.
Those are acceptance requirements, not observed installed results.

The full consumers exercise both Interval arguments, closed-length Triple
construction, a separate sorting constructor, Percent bounds, values above
64 bits, unchanged input arrays and independent result storage. Each of
the four constructors has 1,000 rejection/recovery pairs. Reviewed callers
change only the independently authenticated parameter names in expected
diagnostics. Result-only callers remove two explicitly delimited input
sections and retain all result checks. Kotlin uses the generated Kotlin
API, not the Java API.

The producer builds each selection from two author roots and compares
model, Binding IR, receipt and archive identities. It removes both author
roots before installation, verifies the copied handoff, and uses the
existing closed-environment native installation policies. It then moves
each installation and replays the unchanged caller. PHP replays both weak
and strict callers. Failed inputs remain available for diagnosis. Reports
explicitly mark entry counters as unmeasured.

Select hosts and routes explicitly. Output directories must not already
exist. Keep the 2,048 MiB heavy-producer start floor, 768 MiB stop floor,
and one producer on CPU 3. For example, after checking those prerequisites:

```sh
LEAN_BRIDGE_CHECKED_RECORD_NATIVE_HOSTS=python \
LEAN_BRIDGE_CHECKED_RECORD_NATIVE_ROUTES=ordinary-source \
LEAN_BRIDGE_CHECKED_RECORD_NATIVE_OUTPUT=/absolute/path/to/fresh-output \
taskset -c 3 node --test --test-concurrency=1 \
  tests/helpers/checked-record-native-installed-tests.mjs
```

Without a host selection the four installed gates are explicit skips.
Unknown, empty or duplicate selections fail instead of enabling a build.

## Source validation

All 32 profile/route combinations passed source checks against generated
bindings. Python, Ruby and PHP passed syntax checks; the WIT caller passed
C11 syntax checking against the generated host header and Wasmtime 42
headers with warnings treated as errors. Rust passed offline `cargo check`.
.NET, Java and Kotlin compiled their callers against the generated APIs.
These checks did not load or execute a Lean package.

The original failed source run is retained. It found Java lambdas written
with `=>`; the fixture now uses `->`. Earlier fixture-test failures came
from a test pattern that did not recognize Rust's `1000u64` loop bound.

Source-check records:

- `build/vo1446-native-callers-source-r2/source-checks.json`, SHA-256
  `fdf284f5d2fd466ae6f5eb61d03ffcf92fa81ebf33424dd645eb13b02cb0d5cb`.
- `build/vo1446-native-callers-source-r2.log`, SHA-256
  `7cf0a0d6688654d26e467b7860a028d11ab2c7441ebbf5202d4e6a3b9766e056`.

The new source-history layer authenticates changes from `42f40d5`.
Historical Subtype promotion tests compare complete authenticated
milestone inventories, including their original validator hashes.
Neither the original evidence archives nor the 420 evidence claims and
519 observations acquire new installed support.

The fourteen-root regression passed 301 tests with zero failures and 35
explicit compiler/installed skips. Its TAP is
`build/vo1446-native-installed-regression-r2.tap`, SHA-256
`50011e934429d38cae372763874f91eb10945dc8703e37c205e95eba54456801`.
Full lint, final changed-file lint, checked JavaScript and all 16 generated
reference checks passed. Five focused history/promotion tests also passed.
The first regression remains retained with its two promotion-comparison
failures and two stale-pin failures after draft edits during that run.
The successful second regression used unchanged source files.

The independent Git audit verified seven exact source transitions, 13
source-pin updates and all 6,029 older evidence files unchanged. Ledger
SHA-256: `2075c888c7316b2e232f9ad0b7843fa90c4560c12e385c581386a40485938134`.
Audit SHA-256: `4dcb00508a7f7b51c3b7bc8d2a7283d308672f9f6343582f2d024d384ab590c7`.

## Remaining acceptance

Run and validate all installed selections before archiving or promoting
their results. Perl, PHP-Wasm and browser checked-record execution remain
separate work. Nested, refined, recursive and inherited records, dependent
runtime payloads, other indices, zero-payload decisions and callback/owned
combinations remain within #1220's original scope.
