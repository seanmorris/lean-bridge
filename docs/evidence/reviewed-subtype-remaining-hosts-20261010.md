# Reviewed Subtype acceptance on the remaining native hosts

Rust, .NET, native PHP, WIT/WASI and all four pinned Perl configurations passed
the independently reviewed twelve-export corpus. Each run reproduced its
packages from two author roots, removed those roots before offline installation,
and repeated the unchanged consumer after moving its installed tree.

| Host | Checks per execution | Producer |
| --- | ---: | --- |
| Rust | 2,026 | `033dc35` |
| .NET | 2,024 | `033dc35` |
| Native PHP | 2,024, in weak and strict mode | `033dc35` |
| WIT/WASI | 2,031 | `a0f0ca4` |
| Perl 5.36.3 and 5.38.2, each threaded and unthreaded | 2,025 | `135617a` |

Together with the [Python](reviewed-subtype-python-hosts-20261010.md) and
[Ruby, Java and Kotlin](reviewed-subtype-ruby-jvm-hosts-20261010.md) archives,
these runs complete the nine-profile native rollout. The original C/C++ and
Node acceptance remains in its [separate receipt](reviewed-subtype-20261008/receipt.json).

The caller keeps all original rejection/recovery checks and adds eight checks
for the portable byte export, two generic specializations with different
constructors, normalization, input preservation and a zero-argument result.
Perl executes 17 original checks, eight additions and 1,000 rejection/recovery
pairs, totaling 2,025. All four Perl reports record the actual interpreter
version, threading configuration, integer widths and interpreter digest.

## Original records and validation

The [archive index](reviewed-subtype-remaining-hosts-20261010/index.json) has
SHA-256 `5725f388c44e7650ccae5acae5227a46bc4fcf06307d1d64c2a62224f6a40081`.
It authenticates 243 records, including 78 selected source snapshots from three
producer revisions. The independent audit matched every record to its original
and every source snapshot to Git. All 5,578 older evidence files and the support
inventory remain unchanged.

The archive retains the original PHP failure caused by the minimal toolchain's
missing `ctype` extension, the initial Perl glibc-floor refusal, and the later
Perl check-count mismatch. Earlier Perl diagnostic failures remain in the
[diagnostic archive](reviewed-perl-diagnostics-20261010.md) and
[API-name follow-up](refinement-followup-20261010.md). Successful observations
do not replace those original failures.

The registered archive tests check all original bytes and reject 488 index or
record corruptions and 128 weakened report claims. These include lost isolation
or relocation, wrong caller and package identities, changed .NET/PHP deployment
inventories, wrong Perl ABI settings and invented dispatch measurements.
Readers open archive-relative records; recorded producer paths are provenance.
The writer validates every run before creating the archive and refuses to
overwrite an existing archive.

The registered reviewed-Subtype regression passes 35 tests with no failures and
four explicit compiler/installed gates skipped. The archive controls themselves
pass all three groups without skips. Full lint, checked JavaScript and the 16
generated reference checks pass.

## Recorded environment and scope

These are local Linux executions with an explicit glibc 2.36 floor. Native PHP
used `/usr/bin/php` 8.2.33 and Composer 2.5.5 after verifying the required
extensions. The .NET and PHP observations retain the dependency and deployment
inventories that their installers checked. Rust and WIT retain their recorded
package identities and isolated replay observations, not a complete executable
environment inventory.

The records establish top-level primitive-base Subtype parameters and results,
including the named finite specializations. They do not measure constructor or
source entry counts, establish hosted CI acceptance, or cover browser profiles,
nested or nominal Subtypes, callbacks, owned transports or dependent records.
Package binaries and complete toolchain/input closures are not in this archive.
Support-table promotion and the reviewed-host CI gates follow separately.
