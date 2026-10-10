# Reviewed Perl parameter names and Core CI follow-up

The installed Perl run at `a115eb7873bb4fc6294c603edd629481d1283d19`
failed its unchanged empty-string rejection check. The generated XS reported
`word`, the Lean binder, while the reviewed API and consumer required `value0`.
The earlier repair had changed positional labels to Lean binder names without
reading the reconciled API.

The Perl generator now selects parameter names from the reconciled Binding IR
by export ID. Distinct specializations of one Lean declaration retain their own
names. Missing declarations and mismatched parameter counts fail generation.
Subtype, scalar Fin, indexed Fin and POD diagnostics use the same selection.
Ordinary-source output remains byte-identical to the predecessor.

[The original failure records](refinement-followup-20261010/index.json) retain
both reproduced build identities, the XS, runner, TAP and run metadata. The
16-record index has SHA-256
`5771c8a96130e2bc346ce7062f8731aec3e4bf3eea978d8ddcb18c53b59f801d`.
The archive also retains the local reproduction of all three Core CI failures
from [run 38071834819](https://github.com/seanmorris/lean-bridge/actions/runs/38071834819).

The workflow assertion now validates and removes the entry-probe and Subtype
additions before checking the older direct-Fin workflow. The author-guide
assertions authenticate the hosted native matrix and PHP-Wasm Subtype evidence.
An obsolete paragraph that still called WIT products, Java/Kotlin and native PHP
acceptance pending now cites the completed hosted matrix.

The [source history](refinement-followup-source-history-20261010.json) records
ten exact transitions and 58 source-pin updates. It adds no support claims.
An independent comparison verified all 5,559 older evidence files against Git
and compared every ordinary Perl generated file with the previous generator.
The focused regression passes 15 tests without failures or skips. Full lint,
checked JavaScript and all 16 generated reference checks pass.

The five-root regression passes 200 tests with no failures and 20 explicit
compiler/installed gates skipped. Those skips do not claim installed acceptance.
Its first attempt caught a historical-source comparison that omitted the newest
documentation transition; the corrected comparison preserves binary inputs.

This repair still requires a new installed Perl run on each of the four pinned
ABIs. The failed installed run is not evidence of successful Perl acceptance.
