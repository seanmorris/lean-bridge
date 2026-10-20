# Ruby closed value-index checked records

This promotion records four installed Ruby gem selections from GitHub Actions
run `39360088323`, artifact `12238516604`. The immutable
[archive](checked-record-value-index-ruby-20261020/index.json) authenticates
ordinary Lean source and independently reviewed Binding IR, with full and
standalone result-only APIs.

The full API covers top-level copied checked-record parameters and results. The
result-only API covers results only. All routes reproduce the complete native
gem from two author roots, remove author roots, install offline on MRI 3.3.12,
relocate the environment, and replay the unchanged caller.

The run used Ubuntu 24.04 with Linux x64/glibc 2.39 and a glibc 2.38 package
floor. Each selection executes before and after physical relocation.

The fixture covers closed `Bool`, `String`, and `Nat` indices: both booleans,
the empty and Unicode strings, zero, and a Nat wider than 64 bits. Generated
frozen records expose payload fields only; Ruby `Integer` represents every Nat
payload. Negative Nat inputs and invalid checked records fail without changing
caller data, and a later valid call succeeds. Proof fields never cross the Ruby
boundary.

This promotion covers only the four named top-level cells. It does not promote
fields, callbacks, owned values, open or opaque indices, other index kinds,
generic or zero-payload records, or broader dependent payloads.
