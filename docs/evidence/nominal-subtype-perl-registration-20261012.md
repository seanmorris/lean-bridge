# Register nominal Perl acceptance checks

Predecessor: `d2921624c47665f7a622f5bba96c4e306459e983`.

The normal `component-refinement-mirrors.test.mjs` test root now imports the
nominal Perl caller controls, the four explicit installed gates, the original
archive checks and the new history tests. Running the normal suite no longer
depends on invoking these helper files separately. Installed builds still
require their explicit environment flag; existing original installed results
remain distinct from skipped build gates in a source-only test run.

The history ledger records three exact source transitions. It adds the test
imports and connects their history to the existing source-verification chain.
The support inventory is byte-for-byte unchanged: 480 evidence entries and 575
observations. No earlier archive or ledger changed.

Ledger: [nominal-subtype-perl-registration-source-history-20261012.json](nominal-subtype-perl-registration-source-history-20261012.json).
SHA-256: `80f1883c6930a05dbfc488cebd8cc88308258c0db7e8bffa6c395f795198ec17`.

Validation:

- Ten focused history and test-profile checks passed without skips. They verify
  every transition against its predecessor Git blob, reject altered spans and
  digests, and require the writer to refuse unrelated checkouts.
- Five normal test roots completed 209 tests: 189 passed, none failed, and twenty
  explicit compiler/installed gates skipped. This includes the new Perl caller
  controls and all five archive/negative-control tests.
- Scoped lint passed. The archive milestone also passed full repository lint,
  checked JavaScript and all sixteen generated reference checks.

Registered regression: `build/vo1444-nominal-perl-registered-regression-r1.tap`.
SHA-256: `8d0e2ae12f220a9a392e786dabd24e6a279c767306cd6675269bf304d589a9cb`.
Focused history TAP SHA-256:
`49179cfc2b4a740910818e7bfbfb27c920698c55fe323be77edb9fa3b0fb3a49`.

Recurring hosted nominal CPAN builds and scoped support/documentation promotion
remain next. Registration alone does not claim those builds ran in CI.
