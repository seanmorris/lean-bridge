# Installed Perl checked-record acceptance harness

The new gate builds each checked-record route from two independent author roots
and compares the complete model, receipt and four-ABI archive identities. It
removes both author trees before installation. The four routes are ordinary
source, independently reviewed IR, ordinary result-only and reviewed result-only.

Every route requires these interpreter configurations:

- Perl 5.36.3, threaded and unthreaded.
- Perl 5.38.2, threaded and unthreaded.

Executable overrides must supply all four configurations with distinct absolute
paths. The gate probes each executable's version, architecture, word sizes and
threading settings. A path label alone does not establish its ABI.

## Installation and replay

Each interpreter runs `prebuilt-only` and `build-xs` installations. The prebuilt
path has no C compiler in its tool directory. The XS-build path permits C
compilation and checks the resulting receipts to require generated XS only.
Neither installation path can invoke Lean. Both install the runtime and component
from the verified local handoff without a package registry.

The harness checks installed native payloads against the prepared package
manifests. It removes unpacked distributions before executing the caller, hashes
all installed files, and executes the full Perl consumer. It moves the complete
installation, repeats the unchanged caller twice without compiler access, and
requires every installed file and the interpreter bytes to remain unchanged.

The record reader independently checks both build identities, the exact
constructor choices, source and review digests, all eight interpreter/mode
observations, install receipts, copied payload hashes, derived-XS commands and
retained execution output. It reads archive-relative files and never follows
recorded producer paths.

## Evidence scope

The harness is registered under `tests/checked-records.test.mjs`. Installed
execution requires `LEAN_BRIDGE_CHECKED_RECORD_PERL_TEST=1`; otherwise its four
tests are explicit skips. Enabling an unknown or duplicate route is an error.

This source milestone adds no installed support claim. Actual ordinary and
reviewed runs, archive validation, documentation promotion and recurring
installed CI remain required. Entry counters are not measured by this harness.
Its source-history ledger preserves every existing support observation.

Source verification passed seven tests without failures, with the four installed
routes explicitly skipped. The eight-root regression passed 242 tests with zero
failures and 36 compiler/installed gates skipped, 278 total. Full lint, final
changed-source lint, checked JavaScript and all 16 generated references passed.

The exact source-history ledger records four transitions from `70989c9`. The
type inventory is byte-identical: no evidence or support cell changed. The
independent Git audit authenticates 3,893 distinct source pins and confirms all
6,502 older evidence files remain unchanged.

Ledger SHA-256:
`593830197492964f868d745e9e3c9c79fd86ffdcb16b557b6153e0af6a73e0b1`.
