# Native consumer CI documentation assertion repair, 11 October 2026

Hosted Perl jobs `114341674832` and `114341674955`, JVM job `114341674825`,
and Ruby job `114341674872` failed at revision `c9d11f7`
because `tests/native-fin-products.test.mjs` expected generated documentation to
say reviewed Binding IR was unsupported. Reviewed native refinement packages
already have installed acceptance. The documentation generator had removed that
exclusion; this older structural-container assertion had not followed it.

The exact assertion reproduced locally. The test now expects the supported
reviewed-IR behavior while retaining its exact container and product-path checks.
No production generator, workflow, installed consumer or failure gate changed.

The [13-file archive](refinement-perl-ci-20261011/index.json) retains all four original
GitHub job logs and metadata, the local failure, the fixed focused run, exact
before/after test sources and an independent source-history audit. Its index
SHA-256 is `ddb1721a6659d775af7fb0f190c93ce22c600712bf3a979f1692c10fc13617e3`.
The focused run passed 33 tests with zero failures and three explicit installed
gates. The six-root regression passed 223 tests with zero failures and 40 explicit
compiler/installed gates. Type checking and all 16 reference pages passed.
These results do not replace the next hosted execution.

The original JVM job log separately records a passing installed zero-bound and
nested-position Fin edge test and successful Java/Kotlin raw, public and
foreign-carrier report checks before this later assertion failed. The hosted
report still needs independent inspection and archival before #1454 can close.

The [new source-history ledger](refinement-perl-ci-source-history-20261011.json)
records two exact transitions and leaves older ledgers unchanged. Its independent
Git audit verified 3,893 distinct source pins and all 6,542 older evidence files.
The inventory remains byte-identical: 436 evidence entries and 551 observations.
