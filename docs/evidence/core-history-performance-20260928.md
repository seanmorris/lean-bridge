# Historical verification performance

VO 1219. Core CI reached its 90-minute limit while verifying historical
structured-type evidence. A CPU sample identified repeated SHA-256 hashing and
source reconstruction, including repeated whole-file concatenation.

Historical normalizers now avoid digest work for unchanged string paths.
Recorded paths still pass their complete before/after digest and literal-edit
checks. Offset-based history readers reconstruct the predecessor in one pass
instead of repeatedly copying the entire file for each edit. A shared
transition boundary caches successful normalization by exact
source text, path and requested predecessor. Its limits are 64 MiB of retained
strings and 1,024 entries. Eviction uses least-recently-used order.

Changed text, unknown text, errors and mutable results are never accepted through
a cache hit. Failed checks are not cached. Unit tests cover every cache input,
source mutation, original exceptions, both resource bounds, eviction and disabled
caching.

Existing installed receipts remain unchanged. The successor authenticates each
verifier edit and the support index's hash-only refresh. This changes test
execution cost, not compiler admission, package behavior or installed support.
