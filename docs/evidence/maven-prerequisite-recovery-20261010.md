# Maven prerequisite acquisition

Downstream run `38071834965`, JVM job `114270644018`, failed while acquiring
`maven-dependency-plugin:3.8.1` and `maven-install-plugin:3.1.4` from Maven
Central. The registry consumer and corpus bootstrap logs name those failures.
The ordinary JVM and callable tests also failed, but their short diagnostics
do not independently establish the cause. The Fin debugger gate was not
reached.

Original hosted log: `build/vo1220-jvm-d177-114270644018.log`, SHA-256
`deec8e8dc59a2ff71fc6107c5f9c7c155ca3168b3feda27c6a50b6930c12cb57`.
The new classifier recognizes both named plugin failures from that log.

An earlier isolated local probe acquired both exact plugin versions and their
dependencies from an empty repository. It took 10.362 seconds and retained
32,586-byte and 207,950-byte plugin JARs before removing its disposable cache.
Its log is `build/vo1220-maven-plugin-probe-r1.log`, SHA-256
`95f5c98d8df24676e68f3df917a9926e38807c5466e1b490c94373dc0fcea971`.
This confirms local availability, not the cause of the hosted failures.

## Recovery scope

`scripts/maven-prerequisite.mjs` handles only three pinned online goals:

- `org.apache.maven.plugins:maven-install-plugin:3.1.4:install-file`
- `org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath`
- `org.apache.maven.plugins:maven-dependency-plugin:3.8.1:get`

The corpus author-side bootstrap, ordinary JVM package test and managed
registry consumer use this helper. Each process has a three-minute deadline.
The helper emits bounded original failure output and enables execution-error
diagnostics. One recognized resolution failure for the selected plugin at
Maven Central gets a second attempt after two seconds. The second attempt
adds `--update-snapshots`; it cannot turn a second failure into success.

Maven caches failed resolutions according to repository update policy.
`--update-snapshots` forces a new check for missing releases as well as updated
snapshots. See the [Resolver error policy](https://maven.apache.org/resolver/maven-resolver-api/apidocs/org/eclipse/aether/resolution/ResolutionErrorPolicy.html)
and [Maven 3.9.11 CLI reference](https://maven.apache.org/ref/3.9.11/maven-embedder/cli.html).

The helper refuses offline invocations, extra goals, unknown plugin versions
and failure suppression. Compiler/assertion failures, timeouts, cancellations
and output-limit errors do not trigger a retry. It preserves the original
terminal exception. Existing repositories, package coordinates and plugin
versions stay unchanged.

The downstream `jvmMaven` implementation and hashed dependency-closure code
are byte-identical to the predecessor. Consumer installation still defaults
to `--offline`. No network retry was added to consumer installation, package
execution, assertions or the JVM debugger gate.

## Verification and preservation

Registered source-only controls cover first-attempt success, recovery after
one failed resolution, a second failure, invalid invocations, wrong plugin
versions, wrong repositories and interrupted processes. Real child-process
failures check preservation of the original stdout, stderr and exception.
Those children are stand-ins, not installed Lean or Maven acceptance.

The seven-root registered regression finished with 708 passing tests, zero
failures and 14 explicit installed/compiler skips in 213.04 seconds. It ran
native JVM, reviewed Subtype, type surface, type corpus, author documentation,
documentation and native Fin records with concurrency one. Original TAP:
`build/vo1220-maven-prerequisite-registered-r1.tap`, SHA-256
`b01f89bf5ddb2fae362fadace278e939ec14473a032aa17b88e2ac3444d1f7d1`.
Full repository lint, JavaScript typecheck and sixteen generated-reference
checks passed. A later change only corrects the new history test's file comment.

The eight-transition source ledger starts at
`0fb8f59f5c8d81c6eb3e4ba7bcd8b7797bdb0b24`. It refreshes only 23 source pins;
all 419 evidence entries and 518 observations retain their claims. The
independent audit matches all 5,832 older evidence files against Git.

Ledger: `maven-prerequisite-source-history-20261010.json`, SHA-256
`7db038360d3f31e1f9cbc32b35036415dc0c867e397c14eb6fb7972a6145a8dd`.
Audit: `build/vo1220-maven-prerequisite-audit-r1.json`, SHA-256
`0d8f37314a47a34103952e101f473f3d607d9dfc8136c1c71f42b4820a25d38c`.

Fresh hosted acceptance remains required. This change does not establish
that the original remote failure was transient or that the JVM Fin gate
passes.
