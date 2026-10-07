# Alias-named instantiations of generic structures in installed npm and C/C++ packages

VO1433 under VO1220, 2026-10-07. A closed application of a generic structure, named by an abbrev, is an ordinary record in every host: the alias is its identity and Lean spelling, and the Binding IR records the structure and the resolved type arguments it came from.

## Rule

The extractor admits an application of a generic structure only when it reaches it through an abbrev. It requires every parameter applied, no indices or parents, and every argument a closed copied runtime type that is not a proposition and carries no resource, callback or refinement anywhere inside it, including through the definitions it references, so no bound is lowered away with an argument. Each field's type is Lean's own inference on a typed receiver with the structure's universes and arguments instantiated; a field whose type depends on the record value or is a proof is rejected. The constructor at the same universes is probed through a typed telescope: it must take exactly the projected field types in order and build the alias. The record carries `provenance {structure, arguments}`, whose arguments travel like field types: inline definitions in the inline form, references into the table in the graph form, so a nominal argument that no field carries (a phantom parameter) still reaches the package. The semantic model binds every argument to a carried definition, refuses two definitions of one name that disagree, and lowers the origin as the `lean-lang.org/instantiation` source extension with canonical type references.

Established structural constructors are Lean structures too (`Prod`, `Array`, `Fin`, `Subtype`): their mappings run ahead of generic-record admission in application dispatch and are excluded from alias instantiation detection, so `Nat × String`, `Array Nat` and their aliases keep the `tuple`, `array` and `alias` shapes they had. An application that no abbrev names, in a signature or as an argument of another instantiation, stops the build with `name this instantiation of a generic structure with an abbrev`.

## Fixture

`tests/fixtures/onboarding/generic-records` declares `Pair (α β : Type)`, `Box (α : Type)`, a universe-polymorphic `Tagged (α : Type u) (β : Type v)`, a phantom-parameter `Tag (α : Type)` whose only field is a `String`, and a plain `Marker` record. The aliases are `WordPair := Pair String Nat`, `NatBox := Box Nat`, `TextBox := Box String`, `NatBoxAgain := Box Nat`, `MaybeBox := Box (Option Nat)`, `Boxes := List NatBox`, `BoxPair := Pair NatBox TextBox`, `TaggedNat := Tagged String Nat` and `MarkerTag := Tag Marker`. Ten exports take and return them: `swapNamed`, `bump`, `shout`, `again`, `orZero`, `total`, `firstBoxes` (an `Option Boxes` result), `unpair`, `retag` and `relabel`. The unexported `swap` returns the unaliased `Pair Nat String` and is the rejection case.

## npm

`LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/generic-records.test.mjs` builds the fixture as an ordinary-source npm package from two clean roots on the nominal ABI (7) and verifies the component-package receipt; the archives are identical. The Binding IR carries one record per alias with its instantiation extension (`BoxPair` names `NatBox` and `TextBox`, `MaybeBox` names `option(nat)`, `MarkerTag` names `Marker`), `Marker` as a record without an extension, and `NatBox` and `NatBoxAgain` as two definitions with identical fields and the same origin. After the sources are removed, an offline Node consumer passes 1,010 checks and 1,005 shape rejections: every export through its alias-named records, a wrong field type, a missing and an extra field, a wrong nested record, a list element missing a field, and 1,000 rejection and recovery rounds. Strict TypeScript compiles one interface per alias and `type Boxes = ReadonlyArray<NatBox>`, and rejects a number for a Nat field and a missing field. Exporting `swap` stops the build with the classified hint `hint:OnboardingSmall.swap:unsupported-parameter-type`.

The run used revision `018872e`:

```text
onboarding-small-1.0.0.tgz  4c4deadbc9b42baba29eb781e855d19d8b11a207d1f30e28e8763e932f78a2c7
runtime.tgz                 53ae663f0a62c6e2a096e1477ebc0378875e861ada44ac801957da85264c2d79
```

## C and C++

`LEAN_BRIDGE_GENERIC_RECORD_PROFILES=c,cpp node --test tests/generic-records.test.mjs` builds the C and C++ packages from two clean roots with identical archives and verifies the package-set receipt. The native model keeps each alias-named record with its structure and resolved arguments, and the same Binding IR extension. Source-free offline consumers pass 1,013 checks in C and 1,012 in C++: construction and projection of every alias through the generated structs (`genericrecords_nat_box` with GMP integer fields in C, `lean_bridge::genericrecords::NatBox` with `cpp_int` in C++), `NatBox` and `NatBoxAgain` as distinct types (`static_assert(!std::is_same_v<NatBox, NatBoxAgain>)`), the `Option Nat` and `List NatBox` parameters, the `Option Boxes` result, the pair of two named instantiations, the universe-polymorphic instantiation, the phantom instantiation, and 1,000 rounds.

The same C-gated run checks the source rejections, each with the `unsupported-native-type` diagnostic naming the declaration and module: an unaliased application in a result (`Pair Nat String`), an unaliased application as an argument (`Box (Box Nat)`), an inherited structure, a field that depends on the value, a callback argument, and a refined phantom argument (`Tag (Option (Fin 10))`, refused by the native profile's Fin position rule before the argument rule). The npm run refuses the same refined phantom argument with the classified hint, where only the argument rule applies because the npm profile admits nested `Fin`; synthetic component metadata with `Tag (Option (Fin 5))` and `Tag (Option (Fin 10))`, inline and in graph form, is refused for the same reason, and the same shapes without the bound lower. It also builds the fixture beside direct and aliased `Array`, `List`, `Option`, `Prod` and `Except` exports and asserts they keep their `array`, `list`, `option`, `tuple` and `result` shapes with the alias names in place.

```text
genericrecords-1.0.0-c.tar.gz    539993ca8b39d75c348f79b36f8c97bdeaa45f9f31469a5f794cdf830e24e778
genericrecords-1.0.0-cpp.tar.gz  209b8ff35acade4398c3586e64652383750a1c30abc2453662a4a89f200a7da7
```

## Not covered

Inherited, indexed, open and dependent structures, proof fields, proposition arguments, and arguments that carry a resource, a callback or a refinement stay rejected. Generic variants still require a configured specialization. Refined fields inside an instantiated record, the other native hosts, browser contexts and reviewed Binding IR are not covered by this record; the other native hosts generate the same records from the same Binding IR.
