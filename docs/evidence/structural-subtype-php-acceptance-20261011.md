# Installed structural Subtypes in native PHP

Ordinary-source and independently reviewed Composer packages passed at producer
`79dbeb20fdbab984500dcd420c770a807bf8ac40`. Both runs used PHP 8.2.33 on
Linux x86-64 with a declared local glibc floor of 2.36.

| Author route | Installed test | Duration | Lowest free disk |
| --- | --- | --- | --- |
| Ordinary source | 1 passed, 0 failed, 0 skipped | 134.7 seconds | 10,287 MiB |
| Reviewed API | 1 passed, 0 failed, 0 skipped | 140.7 seconds | 10,284 MiB |

Each route reproduced its model, package-set receipt and Composer ZIP in two
independent author directories. The harness removed both author/build trees
before installing from the local feed. Composer used the prepared package and
pinned Brick Math dependency with network access, plugins and scripts disabled.
Both caller modes passed again after the complete consumer directory moved.

The installer authenticated every original package member before Composer read
its metadata. It checked the lock file, installed package records, generated
autoloader inputs, dependency sources, caller files and complete vendor tree
before and after execution. PHP used an explicit FFI extension with ambient ini
files disabled. The selected PHP and Composer distributions remain trusted tools.

The eight retained executions cover two author routes, strict and weak PHP, and
two locations. Each passed 4,119 assertions, including 1,042 expected rejections
and six snapshot mutation controls. The twelve exports cover Array, List, Option,
products, both result branches, transparent aliases and a closed generic
specialization. Inputs include arbitrary-precision Nat and Fin values, UInt8,
Unicode, complete NUL suffixes, empty/absent values, first/middle/last failures
and all nine nested row/column positions.

The caller checks exact exception codes and messages, mixed-Fin validation
priority, independent alias/parameter constructors and exactly-once normalization.
Independent snapshots retain PHP array keys, types, active branches, complete
integer values and every string byte. They do not call generated equality methods.
Both inputs are checked through 1,000 late rejection/recovery pairs.
Separate synthetic caller tests cover both routes and strictness modes; each
rejects eight mutants that drop validation, lose NUL suffixes, bypass
normalization or change either input. These synthetic tests do not execute Lean.

## Original records

The archive is
[`structural-subtype-php-20261011`](./structural-subtype-php-20261011/index.json).
It retains 107 originals plus its index: 74 run records, 31 exact Git producer
source snapshots, the runner and report checker. Index SHA-256:
`a745724cce2e53f0064c352d346d42ce2413221aa4406c22e4bfa067b0aa05cd`.

Ordinary TAP SHA-256:
`cf001e88dcdeb07946fef646709680452f6993afc6302075a2cce501fd238958`.
Reviewed TAP SHA-256:
`92e34e78bdfc51df1b36dd4318cf549e12d5332d4315c6a604c4fb6ffd9f0835`.

The checker reconciles both original models with the independent API and
constructor choices. It authenticates the callers, receipts, generated public
API, Composer inputs, dependency identities and all replay observations.
Historical absolute paths are provenance only; the checker does not reopen them.

Archive tests passed three groups, rejecting 216 missing/corrupted originals and
70 coordinated report/contract mutations. Controls cover omitted strict/weak
runs, false relocation/isolation claims, altered counts, changed constructors,
extra autoload inputs, dependency substitutions, injected repositories and
enabled Composer plugins. Dependency controls coordinate the manifest, lock,
installed metadata, file identities and observation hashes.

An independent audit compared every archived original and source snapshot with
its producer. All 8,346 older evidence files and the complete
440-claim/555-observation inventory remain unchanged. The source five-root
regression passed 45 tests, failed none and skipped fifteen explicitly gated
compiler/installed tests. Full source lint, final targeted lint, type checking
and sixteen generated references passed.
The final five-root regression passed 48 tests, failed none and skipped fifteen
explicit compiler/installed gates. Those skips are separate from the two real
installed-package runs above. The documentation root passed all 43 tests without
skips.

## Remaining acceptance

This is local glibc 2.36 acceptance, not a hosted glibc 2.38 observation. Package
and tool identities are retained; their binaries and complete toolchain closures
are not. Constructor/source entry counts and memory behavior were not measured
for these PHP packages. This milestone does not promote support-table cells or
add recurring structural PHP CI.

WIT/WASI and Perl remain in the native structural-Subtype pass. Browser
page/React/worker and PHP-Wasm are additional environments. Required recurring
gates, support-table promotion and consumer documentation follow acceptance.
Nominal fields, callbacks, owned values and broader generic combinations remain
within VO #1444 and #1220's original scope.
