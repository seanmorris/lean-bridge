/**
 * Reconstruct the extractor that preceded top-level Fin refinement support.
 * Historical package receipts stay immutable while current-source regressions
 * can prove that this isolated admission did not rewrite their implementation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "./source-history-digest.mjs";
import { beforeSubtypeRefinementSource, subtypeRefinementChangedPaths } from "./subtype-refinement-source-history.mjs";
import { subtypeHeapChangedPaths } from "./subtype-heap-source-history.mjs";
import { subtypeComponentChangedPaths } from "./subtype-component-source-history.mjs";
import { nestedFinChangedPaths, refinementClosureChangedPaths } from "./nested-fin-source-history.mjs";
import { nominalFinChangedPaths } from "./nominal-fin-source-history.mjs";
import { callbackFinChangedPaths } from "./callback-fin-source-history.mjs";
import { perlEvidenceRepairChangedPaths } from "./perl-evidence-repair-source-history.mjs";
import { nativeFinChangedPaths } from "./native-fin-source-history.mjs";
import { npmFinDiagnosticsChangedPaths } from "./npm-fin-diagnostics-source-history.mjs";
import { diagnosticFollowupChangedPaths } from "./diagnostic-followup-source-history.mjs";
import { combinedLineageChangedPaths } from "./combined-lineage-source-history.mjs";
import { testProfileRegistrationChangedPaths } from "./test-profile-registration-source-history.mjs";
import { runtimeReceiptChangedPaths } from "./runtime-receipt-source-history.mjs";
import { cpanCliControlChangedPaths } from "./cpan-cli-control-source-history.mjs";
import { pythonFinChangedPaths } from "./python-fin-source-history.mjs";
import { rustFinChangedPaths } from "./rust-fin-source-history.mjs";
import { rubyFinChangedPaths } from "./ruby-fin-source-history.mjs";
import { dotnetFinChangedPaths } from "./dotnet-fin-source-history.mjs";
import { jvmFinChangedPaths } from "./jvm-fin-source-history.mjs";
import { phpFinChangedPaths } from "./php-fin-source-history.mjs";
import { witFinChangedPaths } from "./wit-fin-source-history.mjs";
import { finDistributionChangedPaths } from "./fin-distribution-source-history.mjs";
import { perlFinChangedPaths } from "./perl-fin-source-history.mjs";
import { hostFinEvidenceChangedPaths } from "./host-fin-evidence-source-history.mjs";
import { nativeSpecializationsChangedPaths } from "./native-specializations-source-history.mjs";
import { nativeFinContainersChangedPaths } from "./native-fin-containers-source-history.mjs";
import { nativeSubtypeChangedPaths } from "./native-subtype-source-history.mjs";
import { refinementAuditChangedPaths } from "./refinement-audit-source-history.mjs";
import { browserRefinementsChangedPaths } from "./browser-refinements-source-history.mjs";
import { scalarFinRejectionChangedPaths } from "./scalar-fin-rejection-source-history.mjs";
import { scalarFinWordingChangedPaths } from "./scalar-fin-wording-source-history.mjs";
import { perlRefinementsChangedPaths } from "./perl-refinements-source-history.mjs";
import { perlIndexedErrorsChangedPaths } from "./perl-indexed-errors-source-history.mjs";
import { refinementCiRepairChangedPaths } from "./refinement-ci-repair-source-history.mjs";
import { pythonRefinementEvidenceChangedPaths } from "./python-refinement-evidence-source-history.mjs";
import { containerHostDispatchChangedPaths } from "./container-host-dispatch-source-history.mjs";
import { reviewedSemanticDecisionsChangedPaths } from "./reviewed-semantic-decisions-source-history.mjs";
import { genericRecordsChangedPaths } from "./generic-records-source-history.mjs";
import { reviewedFinChangedPaths } from "./reviewed-fin-source-history.mjs";
import { refinementHistoryCacheChangedPaths } from "./refinement-history-cache-source-history.mjs";
import { reviewedFinEvidenceChangedPaths } from "./reviewed-fin-evidence-source-history.mjs";
import { historyDigestChangedPaths } from "./history-digest-source-history.mjs";
import { genericRecordHostsChangedPaths } from "./generic-record-hosts-source-history.mjs";
import { genericRecordSpecializationChangedPaths } from "./generic-record-specialization-source-history.mjs";
import { refinementCoreFollowupChangedPaths } from "./refinement-core-followup-source-history.mjs";
import { perlFinArchiveChangedPaths } from "./perl-fin-archive-source-history.mjs";
import { reviewedScalarHostsChangedPaths } from "./reviewed-scalar-hosts-source-history.mjs";
import { refinementCiFollowupChangedPaths } from "./refinement-ci-followup-source-history.mjs";
import { perlFinXsAuditChangedPaths } from "./perl-fin-xs-audit-source-history.mjs";
import { finProductsChangedPaths } from "./fin-products-source-history.mjs";
import { genericRecordPromotionChangedPaths } from "./generic-record-promotion-source-history.mjs";
import { reviewedScalarRolloutChangedPaths } from "./reviewed-scalar-rollout-source-history.mjs";
import { finProductsCiChangedPaths } from "./fin-products-ci-source-history.mjs";
import { finProductsFloorsChangedPaths } from "./fin-products-floors-source-history.mjs";
import { genericRecordsEngineChangedPaths } from "./generic-records-engine-source-history.mjs";
import { finProductArraysChangedPaths } from "./fin-product-arrays-source-history.mjs";
import { reviewedFinAcceptanceChangedPaths } from "./reviewed-fin-acceptance-source-history.mjs";
import { nativeFinRecordsChangedPaths } from "./native-fin-records-source-history.mjs";
import { phpWasmFinChangedPaths } from "./php-wasm-fin-source-history.mjs";
import { reviewedFinPromotionChangedPaths } from "./reviewed-fin-promotion-source-history.mjs";
import { ciDependencyTimeoutChangedPaths } from "./ci-dependency-timeout-source-history.mjs";
import { finProductPhpNameChangedPaths } from "./fin-product-php-name-source-history.mjs";
import { phpReceiverDependencyChangedPaths } from "./php-receiver-dependency-source-history.mjs";
import { nativeFinPromotionChangedPaths } from "./native-fin-promotion-source-history.mjs";
import { reviewedSubtypeDecisionsChangedPaths } from "./reviewed-subtype-decisions-source-history.mjs";
import { witDependencyChangedPaths } from "./wit-dependency-source-history.mjs";
import { genericRecordBrowserChangedPaths } from "./generic-record-browser-source-history.mjs";
import { reviewedSpecializationAdmissionChangedPaths } from "./reviewed-specialization-admission-source-history.mjs";
import { phpWasmFinArchiveChangedPaths } from "./php-wasm-fin-archive-source-history.mjs";
import { genericRecordBrowserArchiveChangedPaths } from "./generic-record-browser-archive-source-history.mjs";
import { reviewedSpecializationCiHotfixChangedPaths } from "./reviewed-specialization-ci-hotfix-source-history.mjs";
import { nativeFinCallbackAdmissionChangedPaths } from "./native-fin-callback-admission-source-history.mjs";
import { reviewedSubtypeAdmissionChangedPaths } from "./reviewed-subtype-admission-source-history.mjs";
import { callbackCodeCiRepairChangedPaths } from "./callback-code-ci-repair-source-history.mjs";
import { reviewedCallbackFinAdmissionChangedPaths } from "./reviewed-callback-fin-admission-source-history.mjs";
import { nativeFinCallbackArchiveChangedPaths } from "./native-fin-callback-archive-source-history.mjs";
import { closureHistoryCiRepairChangedPaths } from "./closure-history-ci-repair-source-history.mjs";
import { reviewedNpmSnapshotChangedPaths } from "./reviewed-npm-snapshot-source-history.mjs";
import { reviewedSubtypeHarnessChangedPaths } from "./reviewed-subtype-harness-source-history.mjs";
import { reviewedCallbackHarnessChangedPaths } from "./reviewed-callback-harness-source-history.mjs";
import { reviewedSpecializationArchiveChangedPaths } from "./reviewed-specialization-archive-source-history.mjs";
import { reviewedInstantiationChangedPaths } from "./reviewed-instantiation-source-history.mjs";
import { browserCallbackArchiveChangedPaths } from "./browser-callback-archive-source-history.mjs";
import { subtypeFixtureLinkChangedPaths } from "./subtype-fixture-link-source-history.mjs";
import { inheritedRecordsChangedPaths } from "./inherited-records-source-history.mjs";
import { inheritanceSubtypeHarnessChangedPaths } from "./inheritance-subtype-harness-source-history.mjs";
import { reviewedSubtypeArchiveChangedPaths } from "./reviewed-subtype-archive-source-history.mjs";
import { memoizeSourceHistory } from "./source-history-memo.mjs";

const extractorPath = "src/analyze/NativeExports.lean";
const previousExtractorSha256 = "9d39776bae35a6a4c0074e45dc710e17d4e4d7a74103b2b39ec9dfdd84818764";
const currentExtractorSha256 = "ca8620672a1a19eea8a665f75efbb6c500df0f095ed1fc09b7cd92d393f29221";
const typeSurfacePath = "docs/type-surface.v1.json";
const currentTypeSurfaceSha256 = "0a7ecf85d5b272a1615b3144d5ec6b6e4e1b54d0a4ce3c4da9f76dc1e4913f3b";
const previousTypeSurfaceSha256 = "6ef586e9ed2dfd5735051dc5ec7c1c9ef34f860e10a1672d20aebaa3c8d6e0d6";
const typeSurfaceHashes = new Map(Object.entries({
	"docs/consume/perl.md": ["8471ffe12646a951af6bdba20f1d7a05bbc866346ddeaaab579dc7a469780944", "b497b18adc826c368ed80a828a2ff9038cc2ae3da94a34e59c5e1764b419cbcf"]
	, "schema/compiler-adapter-plan.schema.json": ["f68868315de712ff3e9338fe7e0642477543d1ba1dfac4e63bb77658c97c3ab7", "7925c40f253ad5ca06979d94e5e0cdb381dd4afa73b1cd46e40b083de3f262e4"]
	, "schema/elaborated-export-metadata.schema.json": ["f8565778550a99196646b6a3c3cfd64afffe39f590ae47c25d731db16afd81a8", "cb13ae5f230dedb93bcba1a8b7e1b66cd1af0f8761b3ef0212299523727da985"]
	, "src/analyze/NativeExports.lean": ["ca8620672a1a19eea8a665f75efbb6c500df0f095ed1fc09b7cd92d393f29221", "9d39776bae35a6a4c0074e45dc710e17d4e4d7a74103b2b39ec9dfdd84818764"]
	, "src/analyze/elaborated-metadata.mjs": ["3fec4ae8aaf94c90a224307ceac2757fa9ee865b2a592df8d95334f21ff1c653", "1362aa142e52680b630cbc36a5a10aea5b00e424eb65714eb8d751a7ae1577fb"]
	, "src/analyze/export-configuration.mjs": ["a7bb9d18660c30bccd691b5083a4c334746bdc3a01cc025f70e6cdf3a5e55f55", "2faf5839a254844babfaac7d0c6c7b59bb157ce289e76c3714edcdf5c45ef4c5"]
	, "src/analyze/semantic-model.mjs": ["2b11358d3c854cd32b55ad91ede6e5484fd1fbb7065b59fa34a29a868340178a", "88ee704bd1352ff7e1a6a2c906ebe86473c82aed083a5a81eaeeec01d3468fb9"]
	, "src/backends/javascript/generate.mjs": ["e7f8477ff42f6725aa22ed906e30fe3a46ae44dd0c58dbb4d8c25e4b2d8c2c0b", "d1f89f3865f16857423fa5d7bd1440aa1731759e0547bba504e4ab51e5570cc5"]
	, "src/build/compiler-adapters.mjs": ["c14c7c5627cb674080c46b048e8ccdbc9607fefb22f96d528f4f9965cc6d9989", "3a6f809c6eef78031ea960967674b4f8f3357c90b41a165b29cf5897ef74f81d"]
	, "src/build/component-record-adapters.mjs": ["40c42acc03c0fe60eb7e3e840af529b2aa7524584ad956fa755039f0711e661c", "8ae4f5c236fc59381f7c4a65c1f39b98a9e5e9c67cf3e9cb7f7650a35a988cef"]
	, "src/build/component-recursive-lean.mjs": ["d3fce28702480524d3f770f110c58c40b31615cd148c314a5ff43899ab5db6d2", "7bcff37a068738a5fc029621f411ae422ae6e286b5f31b13dfb5360fb0e74c28"]
	, "src/build/component-structured-callable-lean.mjs": ["0e633f2f262f7207f5705ad9cf46aafb291ea3c06733fbf5b0e2edaa8f23057a", "8791cb354561e54f7082126608ef058fc0f98abf72146d4eb0d32eeed7c6d369"]
	, "tests/helpers/jvm-shared-regression-receipt.mjs": ["7268ad407a1c8d7a273f99a4a7c1ae6ffe821429568cbd72ab9edd7de5121fb3", "d39a929ed62cab6a8ef99ed5aa48de6e7764f1bf91d9da043ca56515f3e29f11"]
	, "tests/helpers/test-registration-history.mjs": ["bf77e64e61779f785a1cd8625ae4974cc53a87f19d5cb67849a988b9263981e6", "0f4f01a834b80b9438c23afabfa926f4201f7754f92514763dd6d125d246dc4d"]
	, "tests/helpers/wit-host-source-history.mjs": ["069b16ef657859c32b560bb3187dc0f51ce13b8f2810885bf67467a859594969", "a383a539e7e8888f93ea3312231d720625009187cf35096d00f4d7abfe4ec79c"]
	, "tests/helpers/wit-package-source-history.mjs": ["82f1d54f96e72fac12d4f80ca81dc140e680d9af68aea52c71a432b615fba27d", "89a489e28268d8c7fa530a77dc0d14a0ce38a9ab3a5d8b5dbbfb6a910e20530d"]
	, "tests/unlocked-component.test.mjs": ["b4f2fc8701dc311ca9252fa29facab79a8ee1365760f007691712ac7c634318c", "ddb9a9e934605f8b16161639b15ff92ed3334b470ac0c638cad04d09c8c3fe51"]
}));
const verifierPath = "tests/helpers/test-registration-history.mjs";
const verifierEdits = {
	[verifierPath]: [
		['import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";\n', ""]
		, ["\tsource = beforeFinRefinementSource(path, source);\n", ""]
	]
	, "tests/helpers/jvm-shared-verifier-updates.mjs": [
		['import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";\n', ""]
		, ["\tsource = beforeFinRefinementSource(path, source);\n", ""]
	]
	, "tests/helpers/jvm-shared-regression-receipt.mjs": [
		['import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";\n', ""]
		, ['for(const [path, hash] of Object.entries(record.verifierSources)) assert.equal(sha256(beforeNativeSharedVerification(path, beforeFinRefinementSource(path, await readFile(path, "utf8")))), hash, path);'
			, 'for(const [path, hash] of Object.entries(record.verifierSources)) assert.equal(sha256(beforeNativeSharedVerification(path, await readFile(path, "utf8"))), hash, path);']
	]
	, "tests/helpers/wit-package-source-history.mjs": [
		['import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";\n', ""]
		, ["\tsource = beforeFinRefinementSource(path, source);\n", ""]
	]
	, "tests/helpers/wit-host-source-history.mjs": [
		['import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";\n', ""]
		, ["\tsource = beforeFinRefinementSource(path, source);\n", ""]
	]
};
const extractorEdits = [
	[`  if e.isAppOfArity \`\`Fin 1 then
    if depth != 0 || copied then
      reject e "Fin refinements currently require a top-level parameter or result"
    if request.profile.getD "component-scalars-v1" != "component-scalars-v1" then
      reject e "Fin refinements are not implemented by the native-library profile"
    let bound ← whnf e.appArg!
    let .lit (.natVal bound) := bound
      | reject e "Fin refinements require a closed literal bound"
    return obj [
      ("kind", str "refinement"),
      ("base", obj [("kind", str "primitive"), ("name", str "nat"),
        ("lean", str "Nat"), ("abi", ← abi (mkConst \`\`Nat))]),
      ("predicate", obj [("kind", str "fin"), ("bound", str (toString bound))]),
      ("abi", ← abi e)]
`
	, ""]
	, ['              if ["resource", "callback", "refinement"].contains ((target.getObjValAs? String "kind").toOption.getD "") then\n'
		, '              if ["resource", "callback"].contains ((target.getObjValAs? String "kind").toOption.getD "") then\n']
	, [`  if kind == "refinement" then
    return obj [("kind", str kind),
      ("base", ← componentCopiedType (← ofExcept <| value.getObjVal? "base")),
      ("predicate", ← ofExcept <| value.getObjVal? "predicate")]
`
	, ""]
	, [`    if refinement == str "reject" then
      if (type.getObjValAs? String "kind").toOption == some "refinement" then
        return some s!"{label}: the contract rejects compiler-checked refined values"
    else
`
	, `    if refinement != str "reject" then
`]
];
const transitions = {
	"docs/consume/perl.md": {
		current: "8471ffe12646a951af6bdba20f1d7a05bbc866346ddeaaab579dc7a469780944"
		, previous: "b497b18adc826c368ed80a828a2ff9038cc2ae3da94a34e59c5e1764b419cbcf"
		, edits: [
			["| `Polymorphic exports` | `Concrete named Perl subroutine for each configured specialization` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Each configured type application becomes a distinct monomorphic Perl subroutine. The unspecialized Lean declaration is absent. Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |"
				, "| `Polymorphic exports` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |"]
			, ["| `Implicit arguments {α}` | `Concrete Perl signature with no runtime type argument` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Lean elaboration supplies configured type arguments before native compilation; Perl passes no placeholder value. Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |"
				, "| `Implicit arguments {α}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |"]
			, ["| `Instance arguments [C α]` | `Concrete Perl signature with the Lean-selected instance dictionary erased` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Lean synthesizes the selected dictionary before native compilation. Perl cannot provide or replace it. Required: Specialize or supply the selected dictionary without changing runtime behavior. |"
				, "| `Instance arguments [C α]` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specialize or supply the selected dictionary without changing runtime behavior. |"]
		]
	}
	, "docs/javascript-typescript.md": {
		current: "77c567cf9079bee4c307de75ea8e677c301bb67e10d9708005bd9dd3eb8090f2"
		, previous: "08a318f306d940eb87bc2310365a7eddde9650cb75db1e8ab59471ea613acafa"
		, edits: [
			["| `Fin n` | Node JavaScript / TypeScript: `bigint checked as 0 <= value < n before Wasm dispatch` (input); `bigint checked as 0 <= value < n after Wasm return` (result); Browser / React / Worker: No host mapping recorded | Ordinary source: Node JavaScript / TypeScript: Installed checks passed (input, result); Not audited (field, callback input, callback result); Browser / React / Worker: Not audited. Reviewed IR: Not audited | Node JavaScript / TypeScript: The public value is bigint. JavaScript validates Nat and the strict upper bound before dispatch and after return; the Lean adapter independently checks the input bound before constructing Fin. Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |"
				, "| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |"]
			, ["| `Polymorphic exports` | Node JavaScript / TypeScript: `Concrete named function for each configured specialization` (signature); `Named finite specializations` (signature); Browser / React / Worker: `Named finite specializations` (signature) | Ordinary source: Node JavaScript / TypeScript: Installed checks passed; Browser / React / Worker: Not audited. Reviewed IR: Generator inspected | Node JavaScript / TypeScript: Each configured type application becomes a distinct monomorphic export. The unspecialized Lean declaration is absent from the package. Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |"
				, "| `Polymorphic exports` | `Named finite specializations` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |"]
			, ["| `Implicit arguments {α}` | Node JavaScript / TypeScript: `Concrete host signature with no runtime type argument` (signature); Browser / React / Worker: No host mapping recorded | Ordinary source: Node JavaScript / TypeScript: Installed checks passed; Browser / React / Worker: Not audited. Reviewed IR: Not audited | Node JavaScript / TypeScript: Lean elaboration supplies configured type arguments. They have no host runtime representation and are not replaced with null or any. Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |"
				, "| `Implicit arguments {α}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |"]
			, ["| `Instance arguments [C α]` | Node JavaScript / TypeScript: `Concrete host signature with the Lean-selected instance dictionary erased` (signature); Browser / React / Worker: No host mapping recorded | Ordinary source: Node JavaScript / TypeScript: Installed checks passed; Browser / React / Worker: Not audited. Reviewed IR: Not audited | Node JavaScript / TypeScript: Lean synthesizes the selected dictionary before compilation. The host receives the resulting concrete callable and cannot substitute a dictionary. Required: Specialize or supply the selected dictionary without changing runtime behavior. |"
				, "| `Instance arguments [C α]` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specialize or supply the selected dictionary without changing runtime behavior. |"]
		]
	}
	, "src/analyze/elaborated-metadata.mjs": {
		current: "3fec4ae8aaf94c90a224307ceac2757fa9ee865b2a592df8d95334f21ff1c653"
		, previous: "1362aa142e52680b630cbc36a5a10aea5b00e424eb65714eb8d751a7ae1577fb"
		, edits: [[[
			'\t\t\t\t\tif(type?.kind === "refinement")'
			, "\t\t\t\t\t{"
			, '\t\t\t\t\t\tclosed(type, ["kind", "base", "predicate"]);'
			, "\t\t\t\t\t\tscalar(type.base);"
			, '\t\t\t\t\t\tclosed(type.predicate, ["kind", "bound"]);'
			, '\t\t\t\t\t\tif(type.base.name !== "nat" || type.predicate.kind !== "fin"'
			, '\t\t\t\t\t\t\t|| typeof type.predicate.bound !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(type.predicate.bound))'
			, '\t\t\t\t\t\t\tfail("Invalid Fin refinement");'
			, "\t\t\t\t\t\treturn;"
			, "\t\t\t\t\t}"
		].join("\n") + "\n"
		, ""]]
	}
	, "src/analyze/export-configuration.mjs": {
		current: "a7bb9d18660c30bccd691b5083a4c334746bdc3a01cc025f70e6cdf3a5e55f55"
		, previous: "2faf5839a254844babfaac7d0c6c7b59bb157ce289e76c3714edcdf5c45ef4c5"
		, edits: [['\t\tif(site.refinement === "reject" && type.kind === "refinement") return `${label}: the contract rejects compiler-checked refined values`;\n', ""]]
	}
	, "src/analyze/semantic-model.mjs": {
		current: "2b11358d3c854cd32b55ad91ede6e5484fd1fbb7065b59fa34a29a868340178a"
		, previous: "88ee704bd1352ff7e1a6a2c906ebe86473c82aed083a5a81eaeeec01d3468fb9"
		, edits: [
			['\t\tif(type.kind === "refinement") value.base = remember(type.base);\n', ""]
			, ['\t\tif(type.kind === "refinement") return reference(type.base);\n', ""]
			, ['\tconst refinement = type => type.kind === "refinement" ? structuredClone(type.predicate) : null;\n', ""]
			, [[
				'\t\tconst refinements = { parameters: projection.parameters.map(parameter => refinement(parameter.type))'
				, "\t\t\t, result: refinement(projection.result) };"
				, "\t\tconst hasRefinements = refinements.result !== null || refinements.parameters.some(value => value !== null);"
			].join("\n") + "\n"
			, ""]
			, ['\t\t\t\t\t, ...(hasRefinements ? { "lean-lang.org/refinements": refinements } : {})\n', ""]
		]
	}
	, "src/backends/javascript/generate.mjs": {
		current: "e7f8477ff42f6725aa22ed906e30fe3a46ae44dd0c58dbb4d8c25e4b2d8c2c0b"
		, previous: "d1f89f3865f16857423fa5d7bd1440aa1731759e0547bba504e4ab51e5570cc5"
		, edits: [
			[[
				"const declarationRefinements = declaration => {"
				, '\tconst value = declaration.source.extensions["lean-lang.org/refinements"];'
				, "\tif(value === undefined) return { parameters: declaration.parameters.map(() => null), result: null };"
				, '\tif(value === null || typeof value !== "object" || Array.isArray(value)'
				, '\t\t|| JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(["parameters", "result"])'
				, "\t\t|| !Array.isArray(value.parameters) || value.parameters.length !== declaration.parameters.length)"
				, '\t\tfail("invalid-refinement", `${declaration.id} has malformed refinement metadata`);'
				, "\tfor(const refinement of [...value.parameters, value.result])"
				, "\t{"
				, "\t\tif(refinement === null) continue;"
				, '\t\tif(refinement === undefined || typeof refinement !== "object" || Array.isArray(refinement)'
				, '\t\t\t|| JSON.stringify(Object.keys(refinement).sort()) !== JSON.stringify(["bound", "kind"])'
				, '\t\t\t|| refinement.kind !== "fin" || typeof refinement.bound !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(refinement.bound))'
				, '\t\t\tfail("invalid-refinement", `${declaration.id} has an unsupported refinement`);'
				, "\t}"
				, "\tvalue.parameters.forEach((refinement, index) => {"
				, '\t\tif(refinement !== null && (declaration.parameters[index].type.kind !== "primitive" || declaration.parameters[index].type.name !== "nat"))'
				, '\t\t\tfail("invalid-refinement", `${declaration.id} has a Fin parameter that does not erase to Nat`);'
				, "\t});"
				, '\tif(value.result !== null && (declaration.result.type.kind !== "primitive" || declaration.result.type.name !== "nat"))'
				, '\t\tfail("invalid-refinement", `${declaration.id} has a Fin result that does not erase to Nat`);'
				, "\treturn value;"
				, "};"
				, ""
				, "const emitFinCheck = (output, refinement, expression, path, indent) => {"
				, "\tif(refinement !== null) output.push(`${indent}validate.assertFin(${expression}, ${quote(refinement.bound)}, ${quote(path)});`);"
				, "};"
				, ""
			].join("\n") + "\n"
			, ""]
			, ["\t\t\t\tconst refinements = declarationRefinements(target);\n", ""]
			, ["\t\t\t\tfor(const [index, parameter] of target.parameters.entries())", "\t\t\t\tfor(const parameter of target.parameters)"]
			, ['\t\t\t\t\temitFinCheck(output, refinements.parameters[index], parameter.name, `${target.name}.${parameter.name}`, "      ");\n', ""]
			, [[
				"\t\t\t\toutput.push("
				, '\t\t\t\t\t`${indent}const result = runtime.call(${quote(target.id)}, [${target.parameters.map(parameter => parameter.name).join(", ")}]);`,'
				, '\t\t\t\t\t`${indent}validate.${validatorName(target.result.type, typeMap)}(result, ${quote(`${target.name}.result`)});`,'
				, "\t\t\t\t);"
				, '\t\t\t\temitFinCheck(output, refinements.result, "result", `${target.name}.result`, indent);'
				, "\t\t\t\toutput.push(`${indent}return result;`);"
			].join("\n")
			, [
				"\t\t\t\toutput.push("
				, '\t\t\t\t\t`${indent}const result = runtime.call(${quote(target.id)}, [${target.parameters.map(parameter => parameter.name).join(", ")}]);`,'
				, '\t\t\t\t\t`${indent}validate.${validatorName(target.result.type, typeMap)}(result, ${quote(`${target.name}.result`)});`,'
				, "\t\t\t\t\t`${indent}return result;`,"
				, "\t\t\t\t);"
			].join("\n")]
			, ["\t\tconst refinements = declarationRefinements(declaration);\n", ""]
			, ["\t\tdeclaration.parameters.forEach((parameter, index) => {", "\t\tdeclaration.parameters.forEach(parameter => {"]
			, ['\t\t\temitFinCheck(output, refinements.parameters[index], parameter.name, `${declaration.name}.${parameter.name}`, "  ");\n', ""]
			, ['\t\t\temitFinCheck(output, refinements.result, "result", `${declaration.name}.result`, indent);\n', ""]
			, ['\t\t, "export const assertFin = (value, bound, path) => { assertNat(value, path); if (value >= BigInt(bound)) invalid(path, `bigint below ${bound}`); return value; };"\n', ""]
		]
	}
	, "src/build/compiler-adapters.mjs": {
		current: "c14c7c5627cb674080c46b048e8ccdbc9607fefb22f96d528f4f9965cc6d9989"
		, previous: "3a6f809c6eef78031ea960967674b4f8f3357c90b41a165b29cf5897ef74f81d"
		, edits: [
			['import { componentRefinedCall, componentRefinementGuards } from "./component-refinements.mjs";\n', ""]
			, [[
				"const validateFinRefinement = (value, path) => {"
				, "\tif(value === null) return;"
				, '\texactKeys(value, ["kind", "bound"], path);'
				, '\tif(value.kind !== "fin" || typeof value.bound !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value.bound))'
				, '\t\tfail("invalid-compiler-adapter-plan", `${path} must be a canonical Fin bound`);'
				, "};"
				, ""
				, "const validateRefinements = (value, item) => {"
				, '\texactKeys(value, ["parameters", "result"], "compiler export refinements");'
				, "\tif(!Array.isArray(value.parameters) || value.parameters.length !== item.parameters.length)"
				, '\t\tfail("invalid-compiler-adapter-plan", "Compiler refinements must cover the exact runtime signature");'
				, "\tvalue.parameters.forEach((refinement, index) => {"
				, "\t\tvalidateFinRefinement(refinement, `parameter ${index} refinement`);"
				, '\t\tif(refinement !== null && item.parameters[index].leanType !== "_root_.Nat")'
				, '\t\t\tfail("invalid-compiler-adapter-plan", "Fin parameters must erase to Nat");'
				, "\t});"
				, '\tvalidateFinRefinement(value.result, "result refinement");'
				, '\tif(value.result !== null && item.leanResultType !== "_root_.Nat")'
				, '\t\tfail("invalid-compiler-adapter-plan", "Fin results must erase to Nat");'
				, "};"
				, ""
			].join("\n") + "\n"
			, ""]
			, ['\t\texactKeys(item, ["bindingId", "sourceDeclaration", "sourceModule", "wrapper", "symbol", "parameters", "leanResultType", "resultMode", "leanEffect", ...(item.sourceApplication === undefined ? [] : ["sourceApplication"]), ...(item.refinements === undefined ? [] : ["refinements"])], "compiler export");'
				, '\t\texactKeys(item, ["bindingId", "sourceDeclaration", "sourceModule", "wrapper", "symbol", "parameters", "leanResultType", "resultMode", "leanEffect", ...(item.sourceApplication === undefined ? [] : ["sourceApplication"])], "compiler export");']
			, ['\t\tif(item.refinements !== undefined) validateRefinements(item.refinements, item);\n', ""]
			, [[
				"\t\tconst refined = componentRefinedCall(item, item.parameters.map(parameter => parameter.name));"
				, '\t\tconst body = componentRefinementGuards(refined.guards, refined.call, `panic! "Lean Bridge rejected an invalid Fin value"`);'
			].join("\n")
			, '\t\tconst arguments_ = item.parameters.map(parameter => parameter.name).join(" ");']
			, ['\t\tlines.push(`  ${callback ? "⟨" : ""}${body}${callback ? "⟩" : ""}`);'
				, '\t\tlines.push(`  ${callback ? "⟨" : ""}${item.sourceApplication ? `(${item.sourceApplication})` : `_root_.${item.sourceDeclaration}`}${arguments_ === "" ? "" : ` ${arguments_}`}${callback ? "⟩" : ""}`);']
			, ['    const refinements = declaration.source.extensions["lean-lang.org/refinements"];\n', ""]
			, ['      , ...(refinements === undefined ? {} : { refinements: structuredClone(refinements) })\n', ""]
		]
	}
	, "src/build/component-record-adapters.mjs": {
		current: "40c42acc03c0fe60eb7e3e840af529b2aa7524584ad956fa755039f0711e661c"
		, previous: "8ae4f5c236fc59381f7c4a65c1f39b98a9e5e9c67cf3e9cb7f7650a35a988cef"
		, edits: [
			['import { componentRefinedCall, componentRefinementGuards } from "./component-refinements.mjs";\n', ""]
			, [[
				"\t\tconst args = signature.parameters.map((type, index) => convert(type, item.parameters[index].name, true));"
				, "\t\tconst refined = componentRefinedCall(item, args);"
				, '\t\tconst body = componentRefinementGuards(refined.guards, convert(signature.result, `(${refined.call})`, false)'
				, '\t\t\t, `panic! "Lean Bridge rejected an invalid Fin value"`);'
			].join("\n")
			, [
				'\t\tconst args = signature.parameters.map((type, index) => convert(type, item.parameters[index].name, true)).join(" ");'
				, '\t\tconst call = `${item.sourceApplication ? `(${item.sourceApplication})` : `_root_.${item.sourceDeclaration}`}${args ? ` ${args}` : ""}`;'
			].join("\n")]
			, ['\t\t\t, `  ${body.replaceAll("\\n", "\\n  ")}`, "");'
				, '\t\t\t, `  ${convert(signature.result, `(${call})`, false)}`, "");']
		]
	}
	, "src/build/component-structured-callable-lean.mjs": {
		current: "0e633f2f262f7207f5705ad9cf46aafb291ea3c06733fbf5b0e2edaa8f23057a"
		, previous: "8791cb354561e54f7082126608ef058fc0f98abf72146d4eb0d32eeed7c6d369"
		, edits: [
			['import { componentRefinedCall, componentRefinementGuards } from "./component-refinements.mjs";\n', ""]
			, [[
				"\t\tconst refined = componentRefinedCall(item, names, true);"
				, '\t\tconst body = componentRefinementGuards(refined.guards, `pure (${refined.call})`, ".none");'
			].join("\n")
			, '\t\tconst call = `${item.sourceApplication ? `(${item.sourceApplication})` : `_root_.${item.sourceDeclaration}`} ${names.join(" ")}`;']
			, ['\t\t\t, ...["carrierResult (do", ...names.map(name => `  let ${name} ← carrierValue ${name}`), ...body.split("\\n").map(line => `  ${line}`), ")"].map(line => `  ${line}`), "");'
				, '\t\t\t, ...checked(names, call).map(line => `  ${line}`), "");']
		]
	}
	, "schema/compiler-adapter-plan.schema.json": {
		current: "f68868315de712ff3e9338fe7e0642477543d1ba1dfac4e63bb77658c97c3ab7"
		, previous: "7925c40f253ad5ca06979d94e5e0cdb381dd4afa73b1cd46e40b083de3f262e4"
		, edits: [
			['        "refinements": { "$ref": "#/$defs/refinements" },\n', ""]
			, [[
				'    "finRefinement": {'
				, '      "oneOf": ['
				, '        { "type": "null" },'
				, "        {"
				, '          "type": "object", "additionalProperties": false, "required": ["kind", "bound"],'
				, '          "properties": {'
				, '            "kind": { "const": "fin" },'
				, '            "bound": { "type": "string", "pattern": "^(0|[1-9][0-9]*)$" }'
				, "          }"
				, "        }"
				, "      ]"
				, "    },"
				, '    "refinements": {'
				, '      "type": "object", "additionalProperties": false, "required": ["parameters", "result"],'
				, '      "properties": {'
				, '        "parameters": { "type": "array", "items": { "$ref": "#/$defs/finRefinement" } },'
				, '        "result": { "$ref": "#/$defs/finRefinement" }'
				, "      }"
				, "    },"
			].join("\n") + "\n"
			, ""]
		]
	}
	, "schema/elaborated-export-metadata.schema.json": {
		current: "f8565778550a99196646b6a3c3cfd64afffe39f590ae47c25d731db16afd81a8"
		, previous: "cb13ae5f230dedb93bcba1a8b7e1b66cd1af0f8761b3ef0212299523727da985"
		, edits: [
			[[
				"        {"
				, '          "type": "object", "additionalProperties": false, "required": ["kind", "base", "predicate"],'
				, '          "properties": {'
				, '            "kind": { "const": "refinement" },'
				, '            "base": { "$ref": "#/$defs/scalarType" },'
				, '            "predicate": {'
				, '              "type": "object", "additionalProperties": false, "required": ["kind", "bound"],'
				, '              "properties": {'
				, '                "kind": { "const": "fin" },'
				, '                "bound": { "type": "string", "pattern": "^(0|[1-9][0-9]*)$" }'
				, "              }"
				, "            }"
				, "          }"
				, "        },"
			].join("\n") + "\n"
			, ""]
		]
	}
	, "tests/elaborated-metadata.test.mjs": {
		current: "43f06098d430307df6c11e31d05bf125eac1da08fb81bc5537d30e201a0c4065"
		, previous: "7d7e38a1f58682131d6716722e44f0cf0d4d0c0cb2b89a486f93d0bb5a6e5a05"
		, removeRanges: [[
			'test("literal Fin bounds remain compiler-owned while the runtime signature erases only the proof"'
			, 'test("fresh metadata preserves aliases, documentation, UTF-16 ranges and actual theorem relationships after relocation"'
		]]
		, edits: []
	}
	, "tests/unlocked-component.test.mjs": {
		current: "b4f2fc8701dc311ca9252fa29facab79a8ee1365760f007691712ac7c634318c"
		, previous: "ddb9a9e934605f8b16161639b15ff92ed3334b470ac0c638cad04d09c8c3fe51"
		, edits: [
			["def bounded (value : Fin 5) : Fin 5 := value\n", ""]
			, ['\tawait saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], exports: [...specializations.map(item => item.name), "OnboardingSmall.bounded", "OnboardingSmall.plainWord"], specializations, contracts }));'
				, '\tawait saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], exports: [...specializations.map(item => item.name), "OnboardingSmall.plainWord"], specializations, contracts }));']
			, ['\t\tassert.deepEqual(ir.declarations.map(item => item.name), ["bounded", "chooseWord", "echoNat", "echoText", "echoWord", "firstWord", "plainWord"]);'
				, '\t\tassert.deepEqual(ir.declarations.map(item => item.name), ["chooseWord", "echoNat", "echoText", "echoWord", "firstWord", "plainWord"]);']
			, [[
				'\t\tassert.deepEqual(ir.declarations.find(item => item.name === "bounded").source.extensions["lean-lang.org/refinements"], {'
				, '\t\t\tparameters: [{ kind: "fin", bound: "5" }]'
				, '\t\t\t, result: { kind: "fin", bound: "5" }'
				, "\t\t});"
			].join("\n") + "\n"
			, ""]
			, ["assert.equal(api.bounded(0n), 0n);\nassert.equal(api.bounded(4n), 4n);\n", ""]
			, ["assert.throws(() => api.bounded(5n));\nassert.throws(() => api.bounded(-1n));\n", ""]
			, ['\tassert.match(declarations, /bounded\\(arg0: bigint\\): bigint/);\n', ""]
			, ["const bounded: bigint = api.bounded(4n);\n", ""]
			, ['if(word !== 4294967295 || text !== "Lean λ 🙂" || natural !== 2n ** 100n || chosen !== 37 || first !== 71 || plain !== 74 || bounded !== 4n)'
				, 'if(word !== 4294967295 || text !== "Lean λ 🙂" || natural !== 2n ** 100n || chosen !== 37 || first !== 71 || plain !== 74)']
			, [[
				'\t\t, args: [join(engineRoot, "node_modules/typescript/lib/tsc.js")'
				, '\t\t\t, "--strict"'
				, '\t\t\t, "--noEmit"'
				, '\t\t\t, "--skipLibCheck"'
				, '\t\t\t, "false"'
				, '\t\t\t, "--target"'
				, '\t\t\t, "ES2022"'
				, '\t\t\t, "--module"'
				, '\t\t\t, "NodeNext"'
				, '\t\t\t, "--moduleResolution"'
				, '\t\t\t, "NodeNext"'
				, '\t\t\t, "index.mts"]'
			].join("\n")
			, [
				'\t\t, args: [join(engineRoot, "node_modules/typescript/lib/tsc.js"), "--strict", "--noEmit", "--skipLibCheck", "false"'
				, '\t\t\t, "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"]'
			].join("\n")]
		]
	}
	, "src/build/component-recursive-lean.mjs": {
		current: "d3fce28702480524d3f770f110c58c40b31615cd148c314a5ff43899ab5db6d2"
		, previous: "7bcff37a068738a5fc029621f411ae422ae6e286b5f31b13dfb5360fb0e74c28"
		, edits: [
			['import { componentRefinedCall, componentRefinementGuards } from "./component-refinements.mjs";\n', ""]
			, [[
				"\t\tconst refined = componentRefinedCall(item, names, true);"
				, '\t\tconst body = componentRefinementGuards(refined.guards, `pure (${refined.call})`, ".none");'
			].join("\n")
			, '\t\tconst call = `${item.sourceApplication ? `(${item.sourceApplication})` : `_root_.${item.sourceDeclaration}`} ${names.join(" ")}`;']
			, ['\t\t\t, ...checked(names, body.split("\\n")).map(line => `  ${line}`), "");'
				, '\t\t\t, ...checked(names, [`pure (${call})`]).map(line => `  ${line}`), "");']
		]
	}
};

const reverse = (source, edits, label) => {
	for(const [index, [current, previous]] of edits.entries())
	{
		assert.equal(source.split(current).length, 2, `Exactly one ${label} edit ${index}`);
		source = source.replace(current, previous);
	}
	return source;
};

const beforeFinTypeSurface = source => {
	if(sha256(source) !== currentTypeSurfaceSha256) return source;
	const inventory = JSON.parse(source);
	inventory.shapes.find(shape => shape.id === "fin").ir = null;
	inventory.evidence = inventory.evidence.filter(item => ![
		"npm-fin-refinements-installed"
		, "npm-finite-specializations-installed"
		, "perl-finite-specializations-installed"
	].includes(item.id));
	inventory.observations = inventory.observations.filter(item => ![
		"npm-fin-refinements-ordinary-source"
		, "npm-finite-specializations-ordinary-source"
		, "perl-finite-specializations-ordinary-source"
	].includes(item.id));
	const restore = value => {
		if(Array.isArray(value)) value.forEach(restore);
		else if(value && typeof value === "object")
		{
			const hashes = typeSurfaceHashes.get(value.path);
			if(hashes && value.sha256 === hashes[0]) value.sha256 = hashes[1];
			Object.values(value).forEach(restore);
		}
	};
	restore(inventory);
	const previous = JSON.stringify(inventory, null, 2) + "\n";
	assert.equal(sha256(previous), previousTypeSurfaceSha256);
	return previous;
};

/**
 * Remove only the Fin extractor change or its historical-verifier integration.
 *
 * @param path - Current repository path.
 * @param source - Complete current source.
 * @param expected - Optional exact stopping SHA-256.
 */
const normalizeFinRefinementSource = memoizeSourceHistory((path, source, expected) => {
	source = beforeSubtypeRefinementSource(path, source, expected);
	if(sha256(source) === expected) return source;
	if(path === typeSurfacePath) return beforeFinTypeSurface(source);
	const verification = verifierEdits[path];
	if(verification && verification.some(([current]) => source.includes(current)))
		return reverse(source, verification, "Fin verifier integration");
	if(path === extractorPath && sha256(source) === currentExtractorSha256)
	{
		const previous = reverse(source, extractorEdits, "Fin extractor");
		assert.equal(sha256(previous), previousExtractorSha256);
		return previous;
	}
	const transition = transitions[path];
	if(!transition || sha256(source) !== transition.current) return source;
	for(const [start, end] of transition.removeRanges ?? [])
	{
		const first = source.indexOf(start), last = source.indexOf(end);
		assert.ok(first >= 0 && last > first, `Exact Fin ${path} removal range`);
		source = source.slice(0, first) + source.slice(last);
	}
	const previous = reverse(source, transition.edits, `Fin ${path}`);
	assert.equal(sha256(previous), transition.previous);
	return previous;
});

export const finRefinementNormalizationPaths = Object.freeze([...new Set([
	extractorPath, typeSurfacePath, ...Object.keys(transitions)
	, ...Object.keys(verifierEdits), ...subtypeRefinementChangedPaths
	, ...subtypeHeapChangedPaths, ...subtypeComponentChangedPaths
	, ...nestedFinChangedPaths, ...refinementClosureChangedPaths
	, ...nominalFinChangedPaths, ...callbackFinChangedPaths
	, ...perlEvidenceRepairChangedPaths, ...nativeFinChangedPaths
	, ...npmFinDiagnosticsChangedPaths, ...diagnosticFollowupChangedPaths
	, ...combinedLineageChangedPaths, ...testProfileRegistrationChangedPaths
	, ...runtimeReceiptChangedPaths, ...cpanCliControlChangedPaths
	, ...pythonFinChangedPaths
	, ...rustFinChangedPaths
	, ...rubyFinChangedPaths
	, ...dotnetFinChangedPaths
	, ...jvmFinChangedPaths
	, ...phpFinChangedPaths
	, ...witFinChangedPaths
	, ...finDistributionChangedPaths
	, ...perlFinChangedPaths
	, ...hostFinEvidenceChangedPaths
	, ...nativeSpecializationsChangedPaths
	, ...nativeFinContainersChangedPaths
	, ...nativeSubtypeChangedPaths
	, ...refinementAuditChangedPaths
	, ...browserRefinementsChangedPaths
	, ...scalarFinRejectionChangedPaths
	, ...scalarFinWordingChangedPaths
	, ...perlRefinementsChangedPaths
	, ...perlIndexedErrorsChangedPaths
	, ...refinementCiRepairChangedPaths
	, ...pythonRefinementEvidenceChangedPaths
	, ...containerHostDispatchChangedPaths
	, ...reviewedSemanticDecisionsChangedPaths
	, ...genericRecordsChangedPaths
	, ...reviewedFinChangedPaths
	, ...refinementHistoryCacheChangedPaths
	, ...reviewedFinEvidenceChangedPaths
	, ...historyDigestChangedPaths
	, ...genericRecordHostsChangedPaths
	, ...genericRecordSpecializationChangedPaths
	, ...refinementCoreFollowupChangedPaths
	, ...perlFinArchiveChangedPaths
	, ...reviewedScalarHostsChangedPaths
	, ...refinementCiFollowupChangedPaths
	, ...perlFinXsAuditChangedPaths
	, ...finProductsChangedPaths
	, ...genericRecordPromotionChangedPaths
	, ...reviewedScalarRolloutChangedPaths
	, ...finProductsCiChangedPaths
	, ...finProductsFloorsChangedPaths
	, ...genericRecordsEngineChangedPaths
	, ...finProductArraysChangedPaths
	, ...reviewedFinAcceptanceChangedPaths
	, ...nativeFinRecordsChangedPaths
	, ...phpWasmFinChangedPaths
	, ...reviewedFinPromotionChangedPaths
	, ...ciDependencyTimeoutChangedPaths
	, ...finProductPhpNameChangedPaths
	, ...phpReceiverDependencyChangedPaths
	, ...nativeFinPromotionChangedPaths
	, ...reviewedSubtypeDecisionsChangedPaths
	, ...witDependencyChangedPaths
	, ...genericRecordBrowserChangedPaths
	, ...reviewedSpecializationAdmissionChangedPaths
	, ...phpWasmFinArchiveChangedPaths
	, ...genericRecordBrowserArchiveChangedPaths
	, ...reviewedSpecializationCiHotfixChangedPaths
	, ...nativeFinCallbackAdmissionChangedPaths
	, ...reviewedSubtypeAdmissionChangedPaths
	, ...callbackCodeCiRepairChangedPaths
	, ...reviewedCallbackFinAdmissionChangedPaths
	, ...nativeFinCallbackArchiveChangedPaths
	, ...closureHistoryCiRepairChangedPaths
	, ...reviewedNpmSnapshotChangedPaths
	, ...reviewedSubtypeHarnessChangedPaths
	, ...reviewedCallbackHarnessChangedPaths
	, ...reviewedSpecializationArchiveChangedPaths
	, ...reviewedInstantiationChangedPaths
	, ...browserCallbackArchiveChangedPaths
	, ...subtypeFixtureLinkChangedPaths
	, ...inheritedRecordsChangedPaths
	, ...inheritanceSubtypeHarnessChangedPaths
	, ...reviewedSubtypeArchiveChangedPaths
])].sort());

/**
 * Preserve the original buffer when no authenticated transition changes its bytes.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text or bytes.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeFinRefinementSource = (path, source, expected) => {
	if(!finRefinementNormalizationPaths.includes(path)) return source;
	const text = source.toString(), previous = normalizeFinRefinementSource(path, text, expected);
	return previous === text ? source : previous;
};
