# Inherited checked-record acceptance

The public support inventory now records installed acceptance for one acyclic
inheritance chain across all seventeen consumer profiles. The fixture preserves
`Span` as the parent subobject of `Ticket`, and `Ticket` as the parent subobject
of `Stamped`; it also exercises a transparent `Ticket` alias, repeated direct
parameters, a nested `Fin 8` field, and proof-free `Ticket` and `Stamped`
results.

Each host lane retains ordinary-source and independently reviewed packages in
both full and result-only modes. Full packages check parameters, results, and
fields. Result-only packages expose the same proof-free result representation
without input-constructor metadata. The retained packages are reproduced from
independent author roots, installed offline after author-source removal, moved,
and replayed through independent callers wherever the host permits those
steps.

The authenticated lane indexes are:

- [Node, TypeScript, pages, React, and workers](inherited-checked-record-browser-20261017/index.json)
- [C and C++](inherited-checked-record-native-20261017/index.json)
- [.NET](inherited-checked-record-dotnet-20261017/index.json)
- [Java and Kotlin](inherited-checked-record-jvm-20261017/index.json)
- [Python](inherited-checked-record-python-20261017/index.json)
- [Ruby](inherited-checked-record-ruby-20261017/index.json)
- [Perl](inherited-checked-record-perl-20261018/index.json)
- [Native PHP](inherited-checked-record-php-20261018/index.json)
- [PHP-Wasm](inherited-checked-record-php-wasm-20261017/index.json)
- [Rust](inherited-checked-record-rust-20261017/index.json)
- [WIT/WASI](inherited-checked-record-wit-20261017/index.json)

This acceptance is deliberately narrow. It does not claim generic or recursive
inheritance, value-carrying receiver-dependent inherited fields, other index
kinds, open dependent or zero-payload records, callbacks, or owned positions.
