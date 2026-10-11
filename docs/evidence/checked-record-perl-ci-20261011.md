# Required installed Perl checked-record CI, 11 October 2026

The reusable Perl workflow now has a dedicated `checked-records` job. It builds
or verifies the four pinned interpreters, then runs ordinary, reviewed,
ordinary result-only and reviewed result-only acceptance sequentially.
Each route reproduces a single pair of runtime/component archives containing
all four Perl ABIs, then tests both installation modes on each interpreter.
This preserves the full local matrix without repeating the four-ABI builds in
each existing single-ABI consumer job.

The job uses the default glibc 2.38 package requirement. The shell runner rejects
floor and interpreter-location overrides, enables the real installed gate,
and refuses existing output directories. Producer failures propagate through
the TAP capture pipeline. After each producer, the report checker requires the
named installed test to pass with no skips or cancellations and checks the
complete original records against the requested glibc floor. It stops on the
first producer or checker failure. The workflow uploads the entire output
directory on success or failure, including partial routes and original TAP.

The ordinary downstream workflow already invokes the reusable Perl workflow
without failure tolerance. The new job therefore contributes to downstream
acceptance. The combined Perl observation also requires this job to succeed;
it cannot report Perl support as passing when checked-record acceptance fails.
The existing Perl matrix, Nix job and compiler job are unchanged.
The new job has a 120-minute timeout and its own cached four-ABI toolchain set.

## Evidence and preservation

[Installed acceptance](checked-record-perl-installed-20261011.md) is committed
at `e6ea18b0ab28021a18cf9cb8bdf764af5f070bc5`. The new CI job does not turn those
local glibc 2.36 reports into hosted glibc 2.38 evidence. Hosted execution remains
pending the next push.

The new source-history ledger records five exact transitions from that commit:
the Perl workflow, inventory source pins, the history-chain entry and two
historical tests. Its SHA-256 is
`a20ab31a138f760c1a9c8f870764517fafbdcc2822ee24643b93c18d751677fb`.
Only 13 workflow source hashes change in the inventory; its 436 evidence entries
and 551 support observations retain their existing claims. All earlier archived
evidence files remain unchanged. The independent
history check authenticates all 3,893 existing source pins and tests rejection
of unknown edits. No support-table promotion or registry publication is included.

Shell tests use stand-in tools to check all four routes, producer failure and
checker failure at every route, preservation of original stdout/stderr and
partial reports, stale-output rejection, and refusal of altered prerequisites.
They do not claim another installed-package run. Workflow controls reject
missing interpreters, skipped jobs, tolerated failures, narrowed uploads and
floor overrides. The actual report CLI also accepts every original archived
route and refuses to relabel it as glibc 2.38.

## Commands

```sh
bash scripts/run-checked-record-perl-ci.sh
```

Run this from the repository root after installing the pinned Lean compiler,
checkout dependencies and all four Perl toolchains. It writes originals under
`build/checked-record-perl-ci/` and preserves that directory when a route fails.
Historical absolute paths are metadata only; report validation reads the
explicitly supplied record directory.

```sh
node --test --test-concurrency=2 \
  tests/helpers/checked-record-perl-ci-history-tests.mjs \
  tests/helpers/checked-record-perl-ci-workflow-tests.mjs \
  tests/helpers/checked-record-perl-ci-shell-tests.mjs
```

These six focused checks passed without failures or skips. They are also
imported by the registered checked-record test root. Perl support-table and
consumer-guide promotion remain the next milestone; broader checked-record
positions and browser/PHP-Wasm acceptance remain open under #1446.

The first broader regression found stale workflow hashes in the documentation
inventory (129 passed, one failed, 31 gated skips). The generated-reference
check identified the same missing pin refresh. The corrected ledger records
the 13 pin-only changes and the historical tests authenticate the earlier
inventory instead of comparing it directly to the current file. The original
failed TAP remains at `build/vo1446-perl-ci-regression-r1.tap`. The subsequent
13 focused history/workflow/shell checks pass without failures or skips, and
all 16 generated-reference checks pass.

The corrected four-root regression passed 130 tests, with no failures and 31
explicit compiler/installed gates skipped. Its TAP SHA-256 is
`f5abf39156d7e5506699ab7bbd41a583aed921b91ff0e14dd4a4d1de7c1e3458`.
After adding the combined-observation dependency, the 13 focused checks and
16 generated-reference checks passed again. This change also requires a failed
checked-record job to produce a failed combined Perl observation.

Final Perl-contract, documentation and type-surface regression: 184 passed,
no failures or skips. Typecheck, targeted lint, ShellCheck and generated
references pass. The final independent audit confirms five exact Git source
transitions, only 13 refreshed workflow pins, unchanged support observations,
and all 7,049 earlier evidence files unchanged.
