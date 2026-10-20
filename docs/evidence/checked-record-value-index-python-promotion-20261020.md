# Python closed value-index checked records

This promotion records four installed Python wheel selections from GitHub
Actions run `39318504598`, artifact `12220917624`. The immutable
[archive](checked-record-value-index-python-20261020/index.json) authenticates
ordinary Lean source and independently reviewed Binding IR, with full and
standalone result-only APIs.

The full API covers top-level copied checked-record parameters and results. The
result-only API covers results only. All routes reproduce the complete wheel
from two author roots, remove author roots, install offline on CPython 3.11 and
3.12, relocate each environment, and replay the unchanged caller.

The run used Ubuntu 24.04 with Linux x64/glibc 2.39 and a glibc 2.38 package
floor. Each selection has four installed executions: two interpreter floors,
before and after relocation.

The fixture covers closed `Bool`, `String`, and `Nat` indices: both booleans,
the empty and Unicode strings, zero, and a Nat wider than 64 bits. The generated
frozen records expose payload fields only; Python `int` represents every Nat
payload. Negative Nat inputs and invalid checked records fail without changing
caller data, and a later valid call succeeds. Proof fields never cross the
Python boundary.

This promotion covers only the four named top-level cells. It does not promote
fields, callbacks, owned values, open or opaque indices, other index kinds,
generic or zero-payload records, or broader dependent payloads.
