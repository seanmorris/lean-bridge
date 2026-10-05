# WIT host library isolation

Two independently compiled packages with the same name and version returned
`11` and `21` when loaded separately. Loading both in one process made the
second return the first package's answer. Reversing their load order reversed
the wrong answer. The dynamic loader reused dependencies with matching library
names.

Prepared WIT hosts now check the loaded native adapter, compiled Lean component,
two runtime libraries and Wasmtime against their compiler receipts. A mismatch
rejects session opens, calls and custom-linker imports. Host-local function
binding prevents one host's internal calls from resolving to another host.
The checks run once when loading the host; calls check the cached result.

## Installed checks

The source-free consumer runs 26 scenarios using real compiled Lean packages:

- Conflicting implementations in both load orders.
- Identical relocated copies in both load orders.
- Differently named packages in both load orders.
- A conflicting component loaded before the WIT host.
- Changed bytes in each of the five dependency libraries.

Each scenario runs with both local and global dynamic-library visibility.
Rejected calls leave output slots unchanged. Existing sessions continue to
return their original results. Inherited hosts reject calls, opens and linker
registration after `fork`; the parent remains usable.

The private file verifier also passes 71 checks under address, undefined-behavior
and leak sanitizers. Its SHA-256 results match Node across padding and I/O
boundaries. It rejects wrong sizes, wrong digests, missing files, directories,
symlinks and FIFOs.

Fresh ordinary-source and reviewed-IR runs cover collections, primitive
callbacks, recursive package installation and independent recursive rebuilds.
The collection consumer checks 800,719 assertions per source path.

## Records

The [execution record](wit-host-isolation-20260924.json) preserves the original
failure, installed package receipts, observations and passing logs. The
[integration record](wit-host-isolation-integration-20260924.json) records exact
source transitions from `6f8a369` and retains the earlier evidence unchanged.
CI executes and uploads the installed isolation and sanitizer reports.

This fixes prepared-host binding conflicts. Final recursive WIT acceptance,
structured callback payloads and owned resource-containing aggregates remain
open in VO 1219. The support inventory stays at version 0.84.0.
