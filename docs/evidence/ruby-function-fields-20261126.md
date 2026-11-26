# Passing functions through a Ruby record

MRI 3.3.12 installed `tariff-quotes` 1.0.0 twice: once from ordinary Lean
exports and once from a reviewed interface. Each application ran after the
gem feed was removed and its installed gems were moved. The [ordinary
record](ruby-function-fields-20261126/ordinary.json) and [reviewed
record](ruby-function-fields-20261126/reviewed.json) identify the installed
gem, binding, interpreter and exact [Ruby client](../../tests/fixtures/structured-types/tariff-fields.rb).

The client passed a function in a `Tariff` record, retained it, repacked
it, then closed every intermediate wrapper. The retained field still returned
42 when invoked through Lean. A Ruby lambda borrowed by a call did not
escape through its result: calling the returned field directly or through
Lean was refused with status 10, without entering the lambda. Passing an
explicitly closed function as a field was refused with status 4.

A higher-order Ruby callback returned a retained function directly. Lean
invoked it and returned 44. When another callback raised after a nested
allocation, the caller caught the **same Ruby exception object**, then used
the surviving functions and made a fresh call. On both routes the installed
native broker measured **1 → 9 → 1** live identities: the warmed binding
returned to its baseline after the explicit closes. The test does not
claim a zero process-wide baseline or a long-lived registration for a Ruby
lambda passed as a record field.

Run `npm run test:ruby-function-fields` with the pinned Lean and Ruby build
tools and `LEAN_BRIDGE_RUBY` pointing to the MRI executable. To keep the
original packages, set `LEAN_BRIDGE_RUBY_TARIFF_KEEP` to an existing
directory. Set `LEAN_BRIDGE_RUBY_TARIFF_REPLAY` to the reported handoff
directory instead to repeat the two clean installations without rebuilding.
