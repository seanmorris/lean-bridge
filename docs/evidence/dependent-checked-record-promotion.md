# Dependent checked records

Eleven immutable hosted archives establish proof-free dependent checked records at copied top-level parameters and results in seventeen consumer profiles. Ordinary Lean source and independently reviewed Binding IR use the same selected constructor, each as a full package and as a standalone result-only package.

| Evidence lane | Consumer profiles | Author routes | Retained evidence | Hosted run | Producer revision |
| --- | --- | --- | --- | --- | --- |
| browser | node-javascript, node-typescript, browser-javascript, browser-react, browser-worker | ordinary-source, reviewed-ir, result-only-ordinary-source, result-only-reviewed-ir | [archive index](dependent-checked-record-browser-20261021/index.json) | 39919381925 | `733693e06a1461541d4d3d7a43d8496d26c2df45` |
| native | c, cpp | ordinary-source, reviewed-ir, result-only-ordinary-source, result-only-reviewed-ir | [archive index](dependent-checked-record-native-20261021/index.json) | 39857552237 | `b869fb3f1cbf320c3cb453058f4a7bdf095a49c1` |
| dotnet | dotnet | ordinary-source, reviewed-ir, result-only-ordinary-source, result-only-reviewed-ir | [archive index](dependent-checked-record-dotnet-20261021/index.json) | 39857550512 | `b869fb3f1cbf320c3cb453058f4a7bdf095a49c1` |
| jvm | java, kotlin | ordinary-source, reviewed-ir, result-only-ordinary-source, result-only-reviewed-ir | [archive index](dependent-checked-record-jvm-20261021/index.json) | 39688929761 | `e1899c46c9169c93419e230a9efba9892963c7f2` |
| php | php-native | ordinary-source, reviewed-ir, result-only-ordinary-source, result-only-reviewed-ir | [archive index](dependent-checked-record-php-20261021/index.json) | 39863597094 | `6cff3434bff38689ea6bda776ae143057a265ad5` |
| php-wasm | php-wasm | ordinary-source, reviewed-ir, result-only-ordinary-source, result-only-reviewed-ir | [archive index](dependent-checked-record-php-wasm-20261021/index.json) | 39857552688 | `b869fb3f1cbf320c3cb453058f4a7bdf095a49c1` |
| python | python | ordinary-source, reviewed-ir, result-only-ordinary-source, result-only-reviewed-ir | [archive index](dependent-checked-record-python-20261021/index.json) | 39664026329 | `d2f3e5c869d84b77c228b2efebe18d86172d81b1` |
| ruby | ruby | ordinary-source, reviewed-ir, result-only-ordinary-source, result-only-reviewed-ir | [archive index](dependent-checked-record-ruby-20261021/index.json) | 39664029867 | `d2f3e5c869d84b77c228b2efebe18d86172d81b1` |
| rust | rust | ordinary-source, reviewed-ir, result-only-ordinary-source, result-only-reviewed-ir | [archive index](dependent-checked-record-rust-20261021/index.json) | 39664026659 | `d2f3e5c869d84b77c228b2efebe18d86172d81b1` |
| perl | perl | ordinary-source, reviewed-ir, result-only-ordinary-source, result-only-reviewed-ir | [archive index](dependent-checked-record-perl-20261021/index.json) | 39664026059 | `d2f3e5c869d84b77c228b2efebe18d86172d81b1` |
| wit | wit-wasi | ordinary-source, reviewed-ir, result-only-ordinary-source, result-only-reviewed-ir | [archive index](dependent-checked-record-wit-20261021/index.json) | 39871962476 | `9687cccc00a3c0f546925aaa5bcf6c8b6040d367` |

The support inventory gains evidence for exactly 68 cells: seventeen profiles, two author paths and two positions. Each parameter cell cites its full route; each result cell cites its full and result-only routes. These are value-carrying dependent records: `DependentRecords.Dependent` carries `bound` and `below : Fin bound` as proof-free host fields. A host input is rebuilt only through `DependentRecords.mkDependent`, which rejects `below >= bound` before Lean code runs; rejected caller values are preserved and the next valid call succeeds.

PHP-Wasm is the shared result tracked by #1461 and is not inferred from native PHP. This promotion does not cover other dependent field kinds, nested or recursive dependent records, checked-record fields, callbacks, owned positions, open or opaque indices or zero-payload records. External runtimes, compilers, package managers and operating-system distributions remain trusted recorded inputs.
