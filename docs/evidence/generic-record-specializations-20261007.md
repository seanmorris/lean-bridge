# Generic records and configured specializations across installed packages

VO #1433 and #1439 under #1220. Local acceptance on 2026-10-07.

All eleven native consumer profiles and Node/TypeScript pass the ordinary-source generic-record fixture and its nine configured function specializations. The [original host reports](generic-record-hosts-20261007/receipt.json) retain the earlier ten direct exports. The [specialization reports](generic-record-specializations-20261007/receipt.json) retain the expanded fixture at revision `d5705ff38d67e6410c987a3a3a28cc409162ebfd`, with report hashes, interpreter selections and reproduction commands.

## What the packages expose

Lean Bridge elaborates each closed application and emits a named host record for its alias. The fixture includes `NatBox := Box Nat`, `TextBox := Box String`, a pair of named records, an `Option Nat` field, a universe-polymorphic structure and a phantom type parameter. The Binding IR records the originating structure and its resolved type arguments.

The expanded fixture declares one polymorphic `echo` function. The export configuration selects nine concrete applications over record aliases, two namespaces, lists and options. No monomorphic Lean wrapper is added. Consumers call ordinary host functions with concrete signatures; neither type arguments nor instance dictionaries cross the runtime boundary.

Each alias retains its name and origin. Host assignability follows the host language: TypeScript uses structural interfaces, so aliases with the same fields are interchangeable. Rust, C#, Java and Kotlin reject the wrong generated nominal type in the checked negative cases. The tests also reject missing fields, wrong field types, wrong namespace types and invalid specialized container arguments where the host checks those statically.

## Installed executions

| Consumer | Checks in expanded fixture | Additional recorded checks |
| --- | ---: | --- |
| Node and strict TypeScript | 1,019 | 1,010 runtime rejections; strict declaration checking with `skipLibCheck` disabled |
| C | 1,029 | Public GMP-backed records and configured functions |
| C++ | 1,024 | Public named structs and configured functions |
| Python 3.11.2 and 3.12.14 | 1,036 each | Offline wheel installation and public values |
| Rust | 1,025 | Six compiler-rejected callers, followed by a valid call |
| C# | 1,034 | Six compiler-rejected callers; unchanged assembly and valid recovery |
| Java | 1,034 | Six compiler-rejected callers; unchanged JAR and valid recovery |
| Kotlin | 1,030 | Six compiler-rejected callers; unchanged JAR and valid recovery |
| Ruby | 1,036 | Installed gem and public values |
| Native PHP 8.2.33 | 1,035 | Installed Composer package and public values |
| WIT/WASI | 1,036 | Generated WIT types and the installed host package |
| Perl 5.36.3 and 5.38.2, threaded and unthreaded | 1,040 each | Four separately built and installed CPAN package sets |

Each native run builds in two unrelated author roots, compares archive bytes, verifies the package-set receipt, removes the author sources and installs offline with a compiler-free consumer PATH. The reports record the source tree, Binding IR, model, package receipt and exact composed consumer hashes. Native runs used a local glibc floor of 2.36; these reports do not establish the CI distribution floor.

The original npm test checks two-root archive equality, offline installation, Node execution and strict TypeScript compilation. It renames the source directories but retains them and the build staging, and it does not remove compilers from PATH. Its report contains check counts, archive hashes and the nine specialization selections; it does not establish deletion-before-install or compiler-free isolation. The strengthened npm harness removes those inputs and records isolation separately. A later run must supply that evidence.

## Remaining coverage

These executions cover ordinary-source packages. Reviewed generic records and specializations, browser contexts and PHP-Wasm require their own installed runs. Open generic dispatch, inherited or indexed structures, dependent or proof fields, generic variants and refined generic arguments remain separate work. A record report does not establish support for callbacks, resources or refinements inside generic arguments.

For the extraction rules and earlier C/C++ and npm runs, see [alias-named generic structures](generic-records-20261007.md).
