/**
 * Render consumer conversion tables from position- and path-scoped type evidence.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { phpWasmEntryProbeEvidenceId } from "../tests/helpers/php-wasm-refinement-entry-publication.mjs";
import { renderPhpWasmEntryProbeBoundary } from "../tests/helpers/php-wasm-refinement-entry-publication-docs.mjs";

export const typeGuideProfiles = Object.freeze({
	"docs/javascript-typescript.md": ["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"]
	, "docs/php.md": ["php-native", "php-wasm"]
	, ...Object.fromEntries(["dotnet", "java", "kotlin", "ruby", "perl", "python", "rust", "c", "cpp", "wit-wasi"]
		.map(profile => [`docs/consume/${profile}.md`, [profile]]))
});

/**
 * Describe closed generic Subtype fields only after every lane and all 32 field
 * cells carry the complete installed/foundation evidence binding.
 *
 * @param document - Validated type-surface semantic document.
 */
export function genericSubtypeMatrixReference(document)
{
	const lanes = ["npm-ordinary", "npm-reviewed", "foundation", "native", "perl"
		, "python", "ruby", "rust", "dotnet", "jvm", "php-native", "wit-wasi"];
	const id = lane => `generic-subtype-${lane}-hosted-installed`;
	if(!lanes.every(lane => document.evidence.some(entry => entry.id === id(lane)
		&& entry.kind === (lane === "foundation" ? "test" : "installed")))) return "";
	const profiles = document.profiles.filter(profile => profile.id !== "php-wasm");
	if(profiles.length !== 16) return "";
	for(const { id: profile } of profiles)
		for(const [route, path] of [["ordinary", "ordinary-source"], ["reviewed", "reviewed-ir"]])
		{
			const lane = /^(?:node|browser)-/u.test(profile) ? `npm-${route}`
				: ["c", "cpp"].includes(profile) ? "native"
					: ["java", "kotlin"].includes(profile) ? "jvm" : profile;
			const observation = document.observations.find(item => item.profiles.includes(profile)
				&& item.path === path && item.shapes.includes("subtype") && item.positions.includes("field"));
			if(!observation || !document.stages.every(stage =>
				observation.stages[stage].state === "passed"
				&& observation.stages[stage].evidence.includes(id("foundation"))
				&& observation.stages[stage].evidence.includes(id(lane)))) return "";
		}
	return "[Hosted closed generic-Subtype acceptance](../evidence/generic-subtype-promotion-20261023.md) covers the closed `GenericNat` alias of `GenericCarrier Nat` across sixteen non-PHP-Wasm profiles on both author routes. Its `Positive` value field crosses without a proof, the Nat marker remains payload, the two named specializations retain their distinct `plusOne` and `plusTwo` constructors, and copied results carry no constructor. The twelve original archives establish exactly 32 Subtype field cells. PHP-Wasm, open generic host types, arbitrary arguments or predicates, generic Fin, callbacks, ownership and recursive generic graphs are not covered. The separate compiler/review foundation checks retained Nat, Bool and String indices; it does not establish installed host support for those dependent shapes.";
}

/**
 * Publish the owned checked-record summary only when all seventeen profiles,
 * both source routes and five positions name their own installed archive.
 * This checks documentation consistency; the promotion replays the archives.
 *
 * @param document - Validated type-surface semantic document.
 */
export function ownedCheckedRecordMatrixReference(document)
{
	const lanes = {
		native: ["c", "cpp"], perl: ["perl"], python: ["python"], ruby: ["ruby"]
		, rust: ["rust"], dotnet: ["dotnet"], jvm: ["java", "kotlin"]
		, php: ["php-native"], wit: ["wit-wasi"]
		, javascript: ["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"]
		, "php-wasm": ["php-wasm"]
	};
	const profiles = Object.values(lanes).flat();
	if(document.profiles.length !== profiles.length
		|| !document.profiles.every(profile => profiles.includes(profile.id))) return "";
	for(const [lane, selected] of Object.entries(lanes))
	{
		const id = `owned-checked-record-${lane}-hosted-installed`;
		const evidence = document.evidence.filter(item => item.id === id);
		if(evidence.length !== 1 || evidence[0].kind !== "installed") return "";
		for(const profile of selected)
			for(const path of ["ordinary-source", "reviewed-ir"])
				for(const position of ["parameter", "result", "field", "callback-parameter", "callback-result"])
				{
					const observations = document.observations.filter(item => item.profiles.includes(profile)
						&& item.path === path && item.shapes.includes("checked-record") && item.positions.includes(position));
					if(observations.length !== 1 || !document.stages.every(stage =>
						observations[0].stages[stage]?.state === "passed"
						&& observations[0].stages[stage].evidence.includes(id))) return "";
				}
	}
	return "[Hosted owned checked-record acceptance](../evidence/owned-checked-record-promotion-20261026-aligned.md) binds eleven immutable archives to exactly 170 cells across seventeen profiles and both source routes. The acyclic Booking carries a copied checked Window; Claim retains its Ticket resource and checked quota. Full packages check borrowed and transferred inputs before ownership moves, project leased proof-free results, and exercise synchronous host callbacks and returned Lean closures. Standalone result-only packages expose Claim results without checked-input, transfer or callback metadata. Native PHP and PHP-Wasm have independent archives. Grant and its nested Subtype, arbitrary owned containers, recursive owned graphs, retained or asynchronous callbacks, other predicates, dispatch cost and peak memory are not covered.";
}

const names = {
	"node-javascript": "Node JavaScript"
	, "node-typescript": "TypeScript"
	, "browser-javascript": "Browser"
	, "browser-react": "React"
	, "browser-worker": "Worker"
	, "php-native": "Native PHP"
	, "php-wasm": "PHP-Wasm"
	, dotnet: "C#"
	, java: "Java"
	, kotlin: "Kotlin"
	, ruby: "Ruby"
	, perl: "Perl"
	, python: "Python"
	, rust: "Rust"
	, c: "C"
	, cpp: "C++"
	, "wit-wasi": "WIT/WASI"
};
const positions = { parameter: "input", result: "result", field: "field", "callback-parameter": "callback input", "callback-result": "callback result", signature: "signature" };
const paths = { "ordinary-source": "Ordinary source", "reviewed-ir": "Reviewed IR" };
const escapeCell = value => String(value).replaceAll("|", "\\|").replace(/\s+/gu, " ").trim();
const inline = value => `\`${String(value).replaceAll("`", "'")}\``;
const table = (headings, rows) => [headings, headings.map(() => "---"), ...rows]
	.map(row => `| ${row.map(escapeCell).join(" | ")} |`).join("\n");
const unique = values => [...new Set(values)];
const primitiveNominalMarker = "Primitive-base nominal acceptance in the remaining hosts, refined callbacks, owned, recursive, dependent and broader generic Subtypes remain pending.";
const primitiveNominalPending = "Selected synchronous callback Subtypes have installed native and PHP-Wasm acceptance. Owned, dependent, broader generic and recursive refined-callback positions remain separate profiles.";
const primitiveNominalDotnet = "[Nineteen-base C# checks](../evidence/nominal-primitive-subtype-dotnet-20261015/index.json) extend the same fields and constructor-free results to both author routes with exact C# representations and 64-bit machine words. Full and result-only APIs reproduce complete NuGet packages from two author roots, install offline after author removal, replay after relocation and execute again after deleting all consumer sources on .NET SDK 8.0.424 and shared framework 8.0.30 with Linux x64/glibc 2.36.";
const primitiveNominalPhp = "[Nineteen-base native PHP checks](../evidence/nominal-primitive-subtype-php-20261015/index.json) extend the same fields and constructor-free results to both author routes with native PHP representations and 64-bit machine words. Full and result-only APIs reproduce complete Composer ZIPs from two author roots, install offline after author and build removal, and run weak and strict callers before and after relocation on PHP 8.2.33 and Composer 2.5.5 with Linux x64/glibc 2.36. Consumer PHP source remains required at runtime.";
const primitiveNominalWit = "[Nineteen-base WIT checks](../evidence/nominal-primitive-subtype-wit-20261015/index.json) extend the same fields and constructor-free results to both author routes with exact WIT wire representations and 64-bit native machine words. Full and standalone result-only APIs reproduce complete WIT archives from two author roots, install offline after author and build removal, and execute one compiled public C caller through Wasmtime 42.0.1 before and after relocation on Linux x64/glibc 2.36.";
const primitiveNominalJvm = "[Nineteen-base Java and Kotlin checks](../evidence/nominal-primitive-subtype-jvm-20261015/index.json) extend the same fields and constructor-free results to both author routes with exact JVM representations and 64-bit machine words. Full and standalone result-only APIs reproduce complete Maven packages from two author roots, install offline after author removal, and run Java and Kotlin callers after relocation and again from a source-free deployment on JDK 22.0.2 and Kotlin 2.2.0 with Linux x64/glibc 2.36.";
const primitiveNominalPhpWasm = "[Nineteen-base PHP-Wasm checks](../evidence/nominal-primitive-subtype-php-wasm-20261015/index.json) extend the same fields and constructor-free results to both author routes with exact wasm32 PHP representations and 32-bit machine words. Full and standalone result-only APIs reproduce complete Composer API, npm component and npm shared-runtime archives from two author roots, install offline after author and build removal, and run twelve startup/lazy, weak/strict Node and Chromium contexts twice after relocation on wasm32 PHP 8.4.1, Node 22.23.2 and Chromium 152.0.7977.75. Consumer PHP source remains required at runtime.";
const recursiveSubtypePhpWasm = "[Recursive PHP-Wasm checks](../evidence/recursive-subtype-php-wasm-20261015.md) add selected constructors and shared Fin bounds inside a recursive variant, its alias and nested array/option carriers on both source routes. All twelve installed Node and Chromium arrangements pass after offline installation and relocation; exact late failures preserve shared caller values and later calls recover.";
const ownedSubtypePhpWasm = "[PHP-Wasm owned Subtype checks](../evidence/owned-subtype-php-wasm-local-qualification-20261022.md) add one proof-erased `Int` field inside the tested acyclic `Bundle` owner on both source routes. Source-free offline packages are physically relocated before eight Node and eight Chromium executions per route cover borrowed and transferred inputs, leased results, exact constructor selection, rejection before transfer, explicit retain/close behavior, queued-finalizer cleanup and request recovery. [PHP-Wasm owned checked-record checks](../evidence/owned-checked-record-php-wasm-local-qualification-20261022.md) add the tested copied `Window` inside `Booking` and the proof-backed `Claim` across `Ticket` owners, transfers, synchronous callbacks and returned Lean closures on both source routes. Invalid explicit recovery rejects before callback entry; standalone result-only packages retain no checked-input or callback metadata. Recursive owned graphs, retained or asynchronous callbacks and broader predicates remain separate work.";
const callbackSubtypePhpWasm = "[PHP-Wasm callback Subtype checks](../evidence/callback-subtype-php-wasm-local-qualification-20261022.md) add synchronous host callback replies and returned Lean closure inputs on both source routes. Two author roots reproduce the Composer API, npm component and npm shared-runtime archives before source removal, offline installation and relocation. Eight Node and four Chromium startup/lazy, weak/strict contexts per route check scalar, mixed and nested copied carriers, exact typed recovery, exception identity, cleanup and later-call recovery. Retained or asynchronous callbacks, arbitrary predicates, recursive or generic refined payloads, owned callback payloads, dispatch counts and memory bounds remain separate work.";
const callbackSubtypeHostedEvidenceIds = Object.freeze([
	"callback-subtype-browser-hosted-installed"
	, "callback-subtype-native-hosted-installed"
	, "callback-subtype-languages-hosted-installed"
	, "callback-subtype-perl-hosted-installed"
	, "callback-subtype-dotnet-hosted-installed"
	, "callback-subtype-jvm-hosted-installed"
	, "callback-subtype-php-native-hosted-installed"
	, "callback-subtype-wit-wasi-hosted-installed"
]);
const callbackSubtypeHostedProfiles = new Set([
	"node-javascript", "node-typescript", "browser-javascript"
	, "browser-react", "browser-worker", "c", "cpp", "python", "ruby"
	, "rust", "perl", "dotnet", "java", "kotlin", "php-native", "wit-wasi"
]);
const hasCallbackSubtypeHostedEvidence = document =>
	callbackSubtypeHostedEvidenceIds.every(id =>
		document.evidence.some(item => item.id === id));
const callbackSubtypeHostedReference = "[Hosted synchronous callback Subtype acceptance](../evidence/callback-subtype-promotion-20261022.md) establishes proof-erased selected Nat Subtypes in host callback replies and returned Lean closure inputs across all sixteen non-PHP-Wasm consumer profiles and both source routes. Lean-produced values cross as base values. Host-produced replies use the target's exact typed recovery wrapper; invalid or missing recovery prevents callback entry, caller values remain unchanged and a later valid call succeeds. Retained or asynchronous callbacks, checked-record and owned callback positions, arbitrary predicates, recursive or generic refined payloads, dispatch cost and peak memory remain separate work.";
const ownedSubtypeHostedEvidenceIds = Object.freeze([
	"owned-subtype-javascript-hosted-installed"
	, "owned-subtype-native-hosted-installed"
	, "owned-subtype-perl-hosted-installed"
	, "owned-subtype-languages-hosted-installed"
	, "owned-subtype-dotnet-hosted-installed"
	, "owned-subtype-jvm-hosted-installed"
	, "owned-subtype-php-native-hosted-installed"
	, "owned-subtype-wit-wasi-hosted-installed"
]);
const ownedSubtypeHostedProfiles = new Set([
	"node-javascript", "node-typescript", "browser-javascript"
	, "browser-react", "browser-worker", "c", "cpp", "python", "ruby"
	, "rust", "perl", "dotnet", "java", "kotlin", "php-native", "wit-wasi"
]);
const hasOwnedSubtypeHostedEvidence = document =>
	ownedSubtypeHostedEvidenceIds.every(id =>
		document.evidence.some(item => item.id === id));
const ownedSubtypeHostedReference = "[Hosted owned Subtype acceptance](../evidence/owned-subtype-promotion-20261023.md) establishes one proof-erased selected Nat Subtype field in the tested acyclic `Bundle` owner across all sixteen non-PHP-Wasm consumer profiles and both source routes. Host values are validated before a successful ownership transfer; rejection leaves ownership with the caller. Leased or retained results preserve their owner lifetime, explicit close or release performs cleanup, and later valid calls recover. Recursive owned graphs, owned checked-record fields, owned callback positions, arbitrary predicates, dispatch cost and peak memory remain separate work. PHP-Wasm retains its separately audited owned-Subtype boundary.";
const zeroPayloadMatrixLanes = Object.freeze([
	"browser", "native", "dotnet", "jvm", "rust", "php", "python"
	, "ruby", "perl", "wit", "php-wasm"
]);
const zeroPayloadMatrixRoutes = Object.freeze([
	"ordinary-source", "reviewed-ir"
	, "result-only-ordinary-source", "result-only-reviewed-ir"
]);
export const zeroPayloadMatrixEvidenceIds = Object.freeze(
	zeroPayloadMatrixLanes.flatMap(lane => zeroPayloadMatrixRoutes.map(route =>
		`zero-payload-${lane}-${route}-hosted-installed`))
);
export const zeroPayloadMatrixProfiles = Object.freeze([
	"node-javascript", "node-typescript", "browser-javascript"
	, "browser-react", "browser-worker", "c", "cpp", "dotnet", "java"
	, "kotlin", "rust", "php-native", "python", "ruby", "perl"
	, "wit-wasi", "php-wasm"
]);
const hasZeroPayloadMatrixEvidence = document =>
	zeroPayloadMatrixEvidenceIds.every(id =>
		document.evidence.some(item => item.id === id));
const zeroPayloadMatrixReference = "[Hosted zero-payload checked-record acceptance](../evidence/zero-payload-checked-record-matrix-closure-20261022.md) covers all seventeen consumer profiles through eleven independently retained host archives and all four ordinary/reviewed full/result-only routes. The exact copied parameter and result cells distinguish proof-only Witness, Unit-bearing Token, plain empty Marker, Option presence, arrays and active or inactive Mark branches. The matrix contains 44 route evidence identities and promotes 68 profile/path/position cells. It does not promote fields, callbacks, owned positions or other zero-payload shapes, and it never infers one host from another.";
const dependentCheckedRecordMatrixLanes = Object.freeze([
	"browser", "native", "dotnet", "jvm", "php", "php-wasm"
	, "python", "ruby", "rust", "perl", "wit"
]);
const dependentCheckedRecordMatrixRoutes = Object.freeze([
	"ordinary-source", "reviewed-ir"
	, "result-only-ordinary-source", "result-only-reviewed-ir"
]);
export const dependentCheckedRecordMatrixEvidenceIds = Object.freeze(
	dependentCheckedRecordMatrixLanes.flatMap(lane =>
		dependentCheckedRecordMatrixRoutes.map(route =>
			`dependent-checked-record-${lane}-${route}-hosted-installed`))
);
export const dependentCheckedRecordMatrixProfiles = Object.freeze([
	"node-javascript", "node-typescript", "browser-javascript"
	, "browser-react", "browser-worker", "c", "cpp", "dotnet", "java"
	, "kotlin", "php-native", "php-wasm", "python", "ruby", "rust"
	, "perl", "wit-wasi"
]);
const hasDependentCheckedRecordMatrixEvidence = document =>
	dependentCheckedRecordMatrixEvidenceIds.every(id =>
		document.evidence.some(item => item.id === id));
const dependentCheckedRecordMatrixReference = "[Hosted dependent checked-record acceptance](../evidence/dependent-checked-record-promotion.md) covers top-level copied parameters and results in all seventeen consumer profiles through eleven independently retained host archives and all four ordinary/reviewed full/result-only routes. The proof-free host value carries `bound` and `below : Fin bound` as payload fields. Full packages rebuild host inputs through `DependentRecords.mkDependent`, reject `below >= bound` before Lean code runs, preserve rejected caller values and recover on a later valid call. Fields, callbacks, owned positions, other dependent field kinds, nested or recursive dependent records and open or opaque indices remain separate work.";
const hostNullCompleteEvidenceId = "hosted-host-null-complete-installed";
const hostNullCompleteProfiles = new Set([
	"node-javascript", "node-typescript", "browser-javascript"
	, "browser-react", "browser-worker", "php-native", "php-wasm"
	, "dotnet", "java", "kotlin", "perl", "python", "ruby", "c", "cpp"
	, "rust", "wit-wasi"
]);
const hasHostNullCompleteEvidence = document =>
	document.evidence.some(item => item.id === hostNullCompleteEvidenceId);
const directProofErasureCompleteEvidenceId
	= "hosted-direct-proof-erasure-complete";
const directProofErasureCompleteProfiles = new Set([
	"node-javascript", "node-typescript", "browser-javascript"
	, "browser-react", "browser-worker", "php-native", "php-wasm"
	, "dotnet", "java", "kotlin", "perl", "python", "ruby", "c", "cpp"
	, "rust", "wit-wasi"
]);
const directProofErasureCompletePositions = Object.freeze([
	"parameter", "result", "field", "callback-parameter"
	, "callback-result", "signature"
]);
const hasDirectProofErasureCompleteEvidence = document => {
	const evidence = document.evidence.filter(item =>
		item.id === directProofErasureCompleteEvidenceId);
	if(evidence.length !== 1 || evidence[0].kind !== "installed") return false;
	for(const profile of directProofErasureCompleteProfiles)
		for(const path of ["ordinary-source", "reviewed-ir"])
			for(const position of directProofErasureCompletePositions)
			{
				const observations = document.observations.filter(item =>
					item.profiles.includes(profile) && item.path === path
					&& item.shapes.includes("proof")
					&& item.positions.includes(position));
				if(observations.length !== 1 || !document.stages.every(stage =>
					observations[0].stages[stage]?.state === "passed"
					&& observations[0].stages[stage].evidence.includes(
						directProofErasureCompleteEvidenceId))) return false;
			}
	return true;
};
export const phpWasmRefinementEntryBoundary = `PHP-Wasm refinement support is established by unmodified prepared packages.
The separate entry-measurement probes instrument fixture packages only: their
24 copied, owned and indexed routes count validator, constructor, adapter and
Lean-source entries, while six callback routes record callback control totals.
Together they form 30 ordinary/reviewed routes in 27 retained artifacts and do
not widen any type-support cell. The configured [promotion
workflow](https://github.com/seanmorris/lean-bridge/actions/workflows/php-wasm-refinement-entry-promotion.yml)
is not a hosted result; entry counts become hosted evidence only when a
completed run publishes a verified summary for one revision.`;

/**
 * Keep generated prose consistent with the published probe reference.
 * This rendering check does not replace the publisher's original-source replay.
 *
 * @param document - Validated full inventory or its streaming projection.
 */
export const phpWasmRefinementEntryReference = document => {
	const references = document.evidence.filter(item => item.id === phpWasmEntryProbeEvidenceId);
	if(references.length === 0) return phpWasmRefinementEntryBoundary;
	assert.equal(references.length, 1, "Exactly one hosted probe reference");
	for(const observation of document.observations)
		for(const stage of Object.values(observation.stages))
			assert.ok(!stage.evidence.includes(phpWasmEntryProbeEvidenceId)
				, "Entry probes cannot establish prepared-package support");
	return renderPhpWasmEntryProbeBoundary(references[0]);
};

const callbackSubtypeHostedGuide = (document, profiles, reference) => {
	if(!hasCallbackSubtypeHostedEvidence(document)) return null;
	const selected = profiles.filter(profile =>
		callbackSubtypeHostedProfiles.has(profile));
	if(selected.length === 0) return null;
	const evidence = reference.replace(/reference\/types\.md$/u
		, "evidence/callback-subtype-promotion-20261022.md");
	return `[Hosted synchronous callback Subtype acceptance](${evidence}) covers ${selected.map(profile => names[profile]).join(", ")} on ordinary-source and reviewed-IR packages. A selected Subtype produced by Lean crosses as its proof-erased base value. A host callback reply uses the generated exact typed recovery wrapper, and a returned Lean closure checks its selected Subtype input before entering the closure body. Missing or invalid recovery prevents callback entry, preserves caller values and does not prevent a later valid call. Retained or asynchronous callbacks, arbitrary predicates, checked-record or owned callback positions, recursive or generic refined payloads, dispatch cost and peak memory remain outside this evidence.`;
};
const ownedSubtypeHostedGuide = (document, profiles, reference) => {
	if(!hasOwnedSubtypeHostedEvidence(document)) return null;
	const selected = profiles.filter(profile =>
		ownedSubtypeHostedProfiles.has(profile));
	if(selected.length === 0) return null;
	const evidence = reference.replace(/reference\/types\.md$/u
		, "evidence/owned-subtype-promotion-20261023.md");
	return `[Hosted owned Subtype acceptance](${evidence}) covers ${selected.map(profile => names[profile]).join(", ")} on ordinary-source and reviewed-IR packages. The tested acyclic Bundle carries one selected Nat Subtype field beside explicit resource identities. Its constructor validates host input before a successful ownership transfer; rejection leaves ownership with the caller. Leased or retained results preserve their owner lifetime, explicit close or release performs cleanup, and later valid calls recover. Recursive owned graphs, owned checked-record fields, owned callback positions, arbitrary predicates, dispatch cost and peak memory remain outside this evidence. PHP-Wasm keeps its separately audited owned-Subtype boundary.`;
};
const zeroPayloadMatrixGuide = (document, profiles, reference) => {
	if(!hasZeroPayloadMatrixEvidence(document)) return null;
	const selected = profiles.filter(profile =>
		zeroPayloadMatrixProfiles.includes(profile));
	if(selected.length === 0) return null;
	const evidence = reference.replace(/reference\/types\.md$/u
		, "evidence/zero-payload-checked-record-matrix-closure-20261022.md");
	return `[Hosted zero-payload checked-record acceptance](${evidence}) covers ${selected.map(profile => names[profile]).join(", ")} in all four ordinary/reviewed full/result-only package routes from the independently retained host archives that name those profiles. The tested copied parameters and results distinguish proof-only Witness, Unit-bearing Token, plain empty Marker, Option presence, arrays and both Mark branches. Fields, callback positions, owned positions and other zero-payload shapes remain outside this evidence.`;
};
const dependentCheckedRecordMatrixGuide = (
	document, profiles, reference
) => {
	if(!hasDependentCheckedRecordMatrixEvidence(document)) return null;
	const selected = profiles.filter(profile =>
		dependentCheckedRecordMatrixProfiles.includes(profile));
	if(selected.length === 0) return null;
	const evidence = reference.replace(/reference\/types\.md$/u
		, "evidence/dependent-checked-record-promotion.md");
	return `[Hosted dependent checked-record acceptance](${evidence}) covers ${selected.map(profile => names[profile]).join(", ")} in all four ordinary/reviewed full/result-only package routes from the independently retained host archives that name those profiles. The proof-free host value carries the tested runtime bound and bounded value. Full packages validate inputs with the selected dependent constructor before Lean execution; standalone result-only packages expose Lean-produced values without checked-input metadata. Fields, callbacks, owned positions, other dependent field kinds, nested or recursive dependent records and open or opaque indices remain outside this evidence.`;
};
const hostNullCompleteGuide = (document, profiles, reference) => {
	if(!hasHostNullCompleteEvidence(document)) return null;
	const selected = profiles.filter(profile =>
		hostNullCompleteProfiles.has(profile));
	assert.equal(selected.length, profiles.length
		, "Complete HostNull evidence must cover every rendered profile");
	const evidence = reference.replace(/reference\/types\.md$/u
		, "evidence/host-null-complete-20261029/index.json");
	return `[Complete hosted HostNull acceptance](${evidence}) covers ${selected.map(profile => names[profile]).join(", ")} in installed ordinary-source and independently reviewed packages. \`HostNull.null\` uses the target's declared null carrier; \`HostNull.value x\` carries \`x\` directly. This rule applies only to explicit \`HostNull\`: \`Option.none\`, \`Unit\`, erased proofs, and omitted or default arguments retain separate representations. The retained matrix exercises parameters, results, record fields, and synchronous callback parameters and results. Owned or asynchronous values and generic or dependent HostNull combinations remain outside this evidence.`;
};
const directProofErasureCompleteGuide = (
	document, profiles, reference
) => {
	if(!hasDirectProofErasureCompleteEvidence(document)) return null;
	const selected = profiles.filter(profile =>
		directProofErasureCompleteProfiles.has(profile));
	assert.equal(selected.length, profiles.length
		, "Complete proof-erasure evidence must cover every rendered profile");
	const evidence = reference.replace(/reference\/types\.md$/u
		, "evidence/direct-proof-erasure-hosted-20261028/index.json");
	return `[Complete hosted direct proof-erasure acceptance](${evidence}) covers ${selected.map(profile => names[profile]).join(", ")} in installed ordinary-source and independently reviewed packages. Proof-only parameters, fields, callback arguments and callback results occupy no host slot; public signatures omit them. A declaration whose runtime result is itself a proof is refused instead of being represented by null, Unit, a default or fabricated evidence. Lean metadata retains theorem identity and assumptions, while runtime payloads and refinement checks remain intact. The retained matrix covers exactly these six direct positions; proof-bearing data structures, dependent runtime payloads and propositions that require host evidence keep their separate contracts.`;
};
const nestedCheckedRecordPerlMarker = "[PHP-Wasm checked-record packages]";
const zeroPayloadNativeMarker = "[Checked-record browser packages]";
const nestedCheckedRecordPerlPending = "targets other than npm, C, C++, .NET, Java and Kotlin need separate nested acceptance";
const nestedCheckedRecordPerl = "[Nested checked-record Perl packages](../evidence/nested-checked-record-perl-20261016/index.json) establish the same copied positions through generated blessed Packet, Holder and Choice::Packet classes on both author routes and API modes. Two author roots reproduce complete CPAN component and runtime archives before source-free offline installation on threaded and unthreaded Perl 5.36.3 and 5.38.2 in prebuilt-only and build-XS modes. Unchanged callers run before and after moving each installation on Linux x64/glibc 2.36; exact constructor failures preserve caller graphs and later calls recover.";
const nestedCheckedRecordPhpMarker = "[PHP-Wasm checked-record packages]";
const nestedCheckedRecordPhpPending = "targets other than npm, C, C++, .NET, Java, Kotlin and Perl need separate nested acceptance";
const nestedCheckedRecordPhp = "[Nested checked-record native PHP packages](../evidence/nested-checked-record-php-20261016/index.json) establish the same copied positions through generated final readonly Packet, Holder and ChoicePacket classes on both author routes and API modes. Two author roots reproduce complete Composer ZIPs before author and build removal and offline installation; unchanged weak and strict callers run before and after moving each installation on PHP 8.2.33 and Composer 2.5.5 with Linux x64/glibc 2.36. Exact constructor failures preserve caller graphs and later calls recover; consumer PHP source remains required at runtime.";
const nestedCheckedRecordPythonMarker = "[PHP-Wasm checked-record packages]";
const nestedCheckedRecordPythonPending = "targets other than npm, C, C++, .NET, Java, Kotlin, Perl and native PHP need separate nested acceptance";
const nestedCheckedRecordPython = "[Nested checked-record Python wheels](../evidence/nested-checked-record-python-20261016/index.json) establish the same copied positions through generated frozen Packet, Holder and ChoicePacket dataclasses on both author routes and API modes. Two author roots reproduce one complete wheel for both CPython floors before author removal and offline installation; the unchanged caller runs on CPython 3.11.16 and 3.12.14 before and after moving each installation on Linux x64/glibc 2.36. Exact constructor failures preserve caller graphs and later calls recover.";
const nestedCheckedRecordRubyMarker = "[PHP-Wasm checked-record packages]";
const nestedCheckedRecordRubyPending = "targets other than npm, C, C++, .NET, Java, Kotlin, Perl, native PHP and Python need separate nested acceptance";
const nestedCheckedRecordRuby = "[Nested checked-record Ruby gems](../evidence/nested-checked-record-ruby-20261016/index.json) establish the same copied positions through generated frozen Packet, Holder and Choice::Packet classes on both author routes and API modes. Two author roots reproduce complete native gems before author removal and offline installation; the unchanged caller runs before and after moving each installation on MRI 3.3.12 with Linux x64/glibc 2.36. Exact constructor failures preserve caller graphs and later calls recover.";
const nestedCheckedRecordWitMarker = "[PHP-Wasm checked-record packages]";
const nestedCheckedRecordWitPending = "targets other than npm, C, C++, .NET, Java, Kotlin, Perl, native PHP, Python and Ruby need separate nested acceptance";
const nestedCheckedRecordWit = "[Nested checked-record WIT/WASI components](../evidence/nested-checked-record-wit-20261016/index.json) establish the same copied positions through Component Model Packet and Holder records and the packet case of a Choice variant on both author routes and API modes. Two author roots reproduce complete component archives before author removal and offline installation; one public C caller is compiled, its source is removed, and the executable runs before and after moving each installation through Wasmtime 42.0.1 on Linux x64/glibc 2.36. Exact constructor failures preserve caller value trees and output sentinels, and later calls recover. The component requires its packaged native Lean host rather than running as a standalone WASI command.";
const nestedCheckedRecordPhpWasmMarker = "Generic, recursive and inherited checked records, other indices, open dependent records, callbacks and owned positions remain unverified;";
const nestedCheckedRecordPhpWasmPending = "targets other than npm, C, C++, .NET, Java, Kotlin, Perl, native PHP, Python, Ruby and WIT/WASI need separate nested acceptance";
const nestedCheckedRecordPhpWasm = "[Nested checked-record PHP-Wasm packages](../evidence/nested-checked-record-php-wasm-20261016/index.json) establish the same copied positions through generated Packet, Holder and ChoicePacket classes on both author routes and API modes. Two author roots reproduce complete Composer API, npm component and npm shared-runtime archives before author and build removal, offline installation and physical relocation. Unchanged weak and strict callers run in eight Node embedded/Composer and four Chromium bundled startup/lazy contexts on wasm32 PHP 8.4.1, Node 22.23.2 and Chromium 152.0.7977.75. Exact constructor failures preserve caller graphs and later calls recover; consumer PHP source remains required at runtime.";
const nestedCheckedRecordRustMarker = "Generic, recursive and inherited checked records, other indices, open dependent records, callbacks and owned positions remain unverified;";
const nestedCheckedRecordRustPending = "the Rust target still needs separate nested acceptance";
const nestedCheckedRecordRust = "[Nested checked-record Rust crates](../evidence/nested-checked-record-rust-20261016/index.json) establish the same copied positions through generated Packet and Holder structs and the Packet case of a Choice enum on both author routes and API modes. Two author roots reproduce complete Cargo crates before author removal, offline installation from an authenticated vendored dependency closure and physical relocation. The unchanged compiled caller runs from the installed tree, after relocation and again with only its executable retained on Rust and Cargo 1.90.0 with Linux x64/glibc 2.36 and a 2.36 package floor. Exact constructor failures preserve caller graphs and later calls recover.";
const inheritedCheckedRecordMarker = "Generic, recursive and inherited checked records, other indices, open dependent records, callbacks and owned positions remain unverified;";
const inheritedCheckedRecord = "[Inherited checked-record acceptance](../evidence/inherited-checked-record-promotion-20261018.md) preserves the tested Span → Ticket → Stamped parent-subobject chain, its Ticket alias, repeated parameters, nested Fin field and proof-free results in installed packages across all seventeen profiles and both author routes. Full and result-only packages are separately retained. Generic or recursive inheritance, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain separate work.";
const recursiveCheckedRecordMarker = inheritedCheckedRecord;
const recursiveCheckedRecord = `${inheritedCheckedRecord} [Recursive checked-record acceptance](../evidence/recursive-checked-record-promotion-20261018.md) covers finite self-recursive Packet and mutually recursive Envelope/Step graphs across all seventeen profiles and both author routes. The retained packages preserve nominal identities and aliases, Array/Option carriers and active branches; validate selected checked fields and Fin bounds; erase proofs; preserve rejected inputs; recover on later valid calls; and return constructor-free copied results. Other recursive graph shapes, value-carrying receiver-dependent fields, other index kinds, open dependent or zero-payload records, callbacks, owned positions, retained identity and cyclic host-object inputs remain separate work.`;
const checkedRecordValueIndexBrowserMarker = "[Nested checked-record npm/browser packages]";
const checkedRecordValueIndexBrowser = "[Hosted npm/browser checked-record value-index acceptance](../evidence/checked-record-value-index-browser-promotion-20261019.md) adds closed Bool, String and Nat indices at top-level copied parameters and results across Node JavaScript, strict TypeScript, Chromium, Firefox and WebKit pages, React and workers on both source routes. Full and standalone result-only packages are retained. The [complete hosted value-index matrix](../evidence/checked-record-value-index-matrix-promotion-20261020.md) establishes the same boundary in all 17 consumer profiles. Open or opaque indices, other index kinds, fields, callbacks and owned positions remain separate work.";
const callbackCheckedRecordMarker = "All seventeen profiles have separate installed acceptance for this tested nested copied boundary.";
const callbackCheckedRecord = "[Hosted synchronous callback checked-record acceptance](../evidence/callback-checked-record-promotion-20261023.md) adds proof-free host callback arguments and replies and returned Lean closure inputs and results in all sixteen non-PHP-Wasm profiles on both source routes. Host-produced values run the selected nested-field and record constructors with exact typed recovery; Lean-produced values project payloads without proof fields. [Hosted copied PHP-Wasm acceptance](../evidence/callback-refinements-php-wasm-promotion-20261023.md) establishes Interval and Weighted callbacks in twelve Node and Chromium arrangements per route; its companion Fin corpus covers all four callback and returned-closure directions. [Local owned PHP-Wasm acceptance](../evidence/owned-checked-record-php-wasm-local-qualification-20261022.md) establishes the tested owned `Claim` callback and returned closure on both source routes, including rejection of invalid explicit recovery before callback entry. Retained or asynchronous callbacks, recursive owned records and unarchived indexed or recursive callback combinations remain separate work.";

/**
 * Classify a single cell without borrowing evidence from another stage or position.
 *
 * @param cell - One expanded, validated inventory cell.
 */
export function cellTypeCoverage(cell)
{
	const stages = cell.stages;
	if(stages.installedExecution.state === "passed") return "Installed checks passed";
	if(stages.installedExecution.state === "limited") return "Installed checks: limited";
	if(stages.installedExecution.state === "rejected") return "Installed execution rejected";
	if(stages.packaging.state === "rejected") return "Packaging rejected";
	if(stages.compilation.state === "rejected") return "Compilation rejected";
	if(stages.generation.state === "rejected") return "Generation rejected";
	if(stages.analysis.state === "rejected") return "Analysis rejected";
	if(stages.packaging.state === "passed") return "Packaged; execution unaudited";
	if(stages.compilation.state === "passed") return "Compiled; installation unaudited";
	if(stages.generation.state === "passed") return "Generation tested; compilation unaudited";
	if(stages.generation.state === "limited") return "Generation tested: limited";
	if(stages.generation.state === "inspected") return cell.hostType === null ? "Inspected: no host mapping" : "Generator inspected";
	if(stages.analysis.state === "inspected") return "Analyzer inspected";
	return "Not audited";
}

const groupedProfiles = (profiles, project, separator = "; ") => {
	const groups = new Map();
	for(const profile of profiles)
	{
		const value = project(profile);
		if(value === "") continue;
		if(!groups.has(value)) groups.set(value, []);
		groups.get(value).push(names[profile]);
	}
	return [...groups].map(([value, group]) => profiles.length === 1 || group.length === profiles.length
		? value : `${group.join(" / ")}: ${value}`).join(separator);
};

const coverageText = (cells, profiles) => Object.entries(paths).map(([source, label]) => {
	const description = groupedProfiles(profiles, profile => {
		const selected = cells.filter(cell => cell.profile === profile && cell.path === source);
		const groups = new Map();
		for(const cell of selected)
		{
			const state = cellTypeCoverage(cell);
			if(!groups.has(state)) groups.set(state, []);
			groups.get(state).push(positions[cell.position]);
		}
		const descriptions = [...groups].map(([state, sites]) => groups.size === 1
			? state : `${state} (${sites.join(", ")})`);
		return descriptions.join("; ");
	});
	return `${label}: ${description}`;
}).join(". ");

const hostText = (cells, profiles) => groupedProfiles(profiles, profile => {
	const selected = cells.filter(cell => cell.profile === profile && cell.hostType !== null);
	const groups = new Map();
	for(const cell of selected)
	{
		if(!groups.has(cell.hostType)) groups.set(cell.hostType, []);
		groups.get(cell.hostType).push(positions[cell.position]);
	}
	if(groups.size === 0) return "No host mapping recorded";
	return [...groups].map(([type, sites]) => `${inline(type)} (${unique(sites).join(", ")})`).join("; ");
});

/**
 * Render every inventoried shape for an exact set of consumer profiles.
 *
 * @param inventory - Validated inventory and independent contracts.
 * @param inventory.document - Versioned type surface.
 * @param profiles - Exact runtime profiles, not inferred language aliases.
 * @param reference - Relative link to the shared type rules.
 */
export function renderTypeTable({ document, ...contracts }, profiles, reference)
{
	assert.ok(profiles.length > 0 && new Set(profiles).size === profiles.length, "Empty or duplicate type profiles");
	for(const profile of profiles) assert.ok(document.profiles.some(item => item.id === profile), `Unknown type profile ${profile}`);
	const cells = typeSurfaceCells(document, contracts).filter(cell => profiles.includes(cell.profile));
	const rows = document.shapes.map(shape => {
		const selected = cells.filter(cell => cell.shape === shape.id);
		const notes = groupedProfiles(profiles, profile => unique(selected.filter(cell => cell.profile === profile)
			.map(cell => cell.conversionNote).filter(Boolean)).join(" "), " ")
			// Older WIT notes must render their type syntax as code, not HTML.
			.replaceAll(/(?<!`)list<u32>(?!`)/gu, "`list<u32>`");
		return [inline(shape.lean), hostText(selected, profiles), coverageText(selected, profiles), `${notes ? notes + " " : ""}Required: ${shape.bounds}`];
	});
	const callbackSubtype = callbackSubtypeHostedGuide(
		document, profiles, reference);
	const ownedSubtype = ownedSubtypeHostedGuide(
		document, profiles, reference);
	const zeroPayloadMatrix = zeroPayloadMatrixGuide(
		document, profiles, reference);
	const dependentCheckedRecordMatrix = dependentCheckedRecordMatrixGuide(
		document, profiles, reference);
	const hostNullComplete = hostNullCompleteGuide(
		document, profiles, reference);
	const directProofErasureComplete = directProofErasureCompleteGuide(
		document, profiles, reference);
	return [
		"### Type conversions"
		, ""
		, `Profiles: ${profiles.map(profile => names[profile]).join(", ")}. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.`
		, ""
		, `The [conversion rules](${reference}#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](${reference.replace(/reference\/types\.md$/u, "type-surface.v1.json")}) records commands, source hashes, limitations and implementation owners.`
		, ...(zeroPayloadMatrix ? ["", zeroPayloadMatrix] : [])
		, ...(dependentCheckedRecordMatrix
			? ["", dependentCheckedRecordMatrix] : [])
		, ...(callbackSubtype ? ["", callbackSubtype] : [])
		, ...(ownedSubtype ? ["", ownedSubtype] : [])
		, ...(hostNullComplete ? ["", hostNullComplete] : [])
		, ...(directProofErasureComplete
			? ["", directProofErasureComplete] : [])
		, ""
		, table(["Lean type or source form", "Host representation", "Current evidence", "Conversion rules"], rows)
		, ""
	].join("\n");
}

/**
 * Replace only the generated section, retaining every installation step and old URL.
 *
 * @param source - Existing canonical consumer guide.
 * @param section - Generated Type conversions section.
 */
export function replaceTypeSection(source, section)
{
	const heading = "### Type conversions\n";
	assert.equal(source.split(heading).length, 2, "Each guide needs exactly one Type conversions heading");
	const start = source.indexOf(heading);
	const rest = source.slice(start + heading.length);
	const end = rest.search(/^#{1,3} /mu);
	assert.ok(end >= 0, "The generated type section needs a following guide section");
	return source.slice(0, start) + section + "\n" + rest.slice(end);
}

/**
 * Render guide sections and the shared inventory reference without writing.
 *
 * @param options - Canonical source location.
 * @param options.root - Repository root.
 * @param options.inventory - Optional already validated inventory for sparse evidence worktrees.
 */
export async function renderTypeDocuments({ root, inventory = null })
{
	inventory ??= await readTypeSurface({ repository: root });
	const documents = {};
	for(const [filename, profiles] of Object.entries(typeGuideProfiles))
	{
		const reference = path.posix.relative(path.posix.dirname(filename), "docs/reference/types.md");
		const source = await readFile(path.join(root, filename), "utf8");
		documents[filename] = replaceTypeSection(source, renderTypeTable(inventory, profiles, reference));
	}
	const { document } = inventory;
	const genericReference = genericSubtypeMatrixReference(document);
	const ownedCheckedReference = ownedCheckedRecordMatrixReference(document);
	const directProofReference = hasDirectProofErasureCompleteEvidence(document)
		? "[Complete hosted direct proof-erasure acceptance](../evidence/direct-proof-erasure-hosted-20261028/index.json) binds ten immutable installed-package archives and a fresh-Lean refusal to all 204 proof cells across seventeen profiles, both author routes and six direct positions. Proof-only parameters, fields and synchronous callback positions have no runtime slot; proof-free public signatures omit them. A proof-valued export is refused. The evidence does not erase runtime data, refinement checks or assumptions from assurance metadata, and it does not establish host-supplied proofs or arbitrary proof-bearing data structures."
		: "";
	const profileRows = document.profiles.map(profile => {
		const guide = Object.entries(typeGuideProfiles).find(([, profiles]) => profiles.includes(profile.id))[0];
		const relative = path.posix.relative("docs/reference", guide);
		return [`[${names[profile.id]}](${relative}#type-conversions)`, profile.context, profile.wordBits === null ? "Not audited" : `${profile.wordBits}-bit Lean target`];
	});
	const shapeRows = document.shapes.map(shape => {
		const rule = document.rules[document.families[shape.family].rule];
		return [inline(shape.lean), shape.meaning, shape.bounds, `${rule.ownership} ${rule.absence} ${rule.failure}`];
	});
	return {
		documents
		, reference: [
			...(ownedCheckedReference ? [ownedCheckedReference, ""] : [])
			, ...(directProofReference ? [directProofReference, ""] : [])
			, `Inventory ${document.contractVersion} covers ${document.shapes.length} source forms and ${document.profiles.length} consumer profiles. The language tables distinguish ordinary-source packages from reviewed-IR profiles and retain unaudited cells.`
			, ""
			, table(["Consumer table", "Runtime context", "Compiled Lean width"], profileRows)
			, ""
			, "[Structural Subtype packages](../evidence/structural-subtype-promotion-20261011.md) have installed checks across all seventeen profiles on both source routes. The fixtures cover primitive leaves inside Array, List, Option, products and Except, mixed Fin, transparent aliases and one closed List specialization. [Nominal npm checks](../evidence/nominal-subtype-npm-acceptance-20261011.md) add the tested Nat record/variant fields, aliases and constructor-free results on Node 22.23.2 with strict TypeScript. [Nominal C/C++ checks](../evidence/nominal-subtype-native-acceptance-20261011.md) add those Nat forms on both source routes in Linux x64/glibc 2.36, including standalone result-only packages. [Nominal Perl checks](../evidence/nominal-subtype-perl-acceptance-20261012.md) add those Nat fields, aliases and constructor-free results on all four pinned ABIs via prebuilt-only and build-xs installation on Linux x64/glibc 2.36. [Nominal Python checks](../evidence/nominal-subtype-python-acceptance-20261012.md) add those Nat forms on CPython 3.11 and 3.12 using the same reproduced wheel, offline installation and relocated replay. [Nominal Ruby checks](../evidence/nominal-subtype-ruby-acceptance-20261012.md) add those Nat forms on MRI Ruby 3.3.12 through reproduced gems, offline installation and relocated replay on Linux x64/glibc 2.36. [Nominal Rust checks](../evidence/nominal-subtype-rust-acceptance-20261012.md) add those Nat forms with Rust and Cargo 1.90.0, offline crate installation, relocated replay and execution after deleting all consumer sources on Linux x64/glibc 2.36. [Nominal C# checks](../evidence/nominal-subtype-dotnet-20261012.md) add those Nat forms with .NET SDK 8.0.424 and shared framework 8.0.30, offline NuGet installation, relocated replay and source-free deployment on Linux x64/glibc 2.36. [Nominal Java/Kotlin checks](../evidence/nominal-subtype-jvm-20261013.md) add those Nat forms with JDK 22.0.2 and Kotlin 2.2.0, offline installation, relocated replay and source-free deployment of both consumers on Linux x64/glibc 2.36. [Nominal native PHP checks](../evidence/nominal-subtype-php-20261013.md) add those Nat forms with PHP 8.2.33 and Composer 2.5.5, offline installation and weak/strict replay before and after relocation on Linux x64/glibc 2.36. Author/build roots are removed before installation; consumer PHP source remains required at runtime. [Nominal WIT/WASI checks](../evidence/nominal-subtype-wit-promotion-20261013.md) add the tested Nat records, variants, aliases and constructor-free results through the actual Component Model adapter and its required packaged native Lean host. Both source routes reproduce packages from two roots, install offline and replay after relocation on Linux x64/glibc 2.36 with Wasmtime 42.0.1. [Nominal browser checks](../evidence/nominal-subtype-browser-promotion-20261014.md) add the tested Nat fields and constructor-free outputs on both source routes in Chromium 151.0.7922.34, Firefox 153.0 and WebKit 26.5 pages, React and workers, with reproduced component/runtime archives and missing-asset and lifecycle recovery checks. [Nominal PHP-Wasm checks](../evidence/nominal-subtype-php-wasm-promotion-20261014.md) add both source routes and API modes on wasm32 PHP 8.4.1 in Node 22.23.2 and Chromium 151.0.7922.34. Embedded, Composer and bundled callers pass startup/lazy loading and weak/strict execution twice after relocation; all three reproduced archives are retained. [Nineteen-base npm checks](../evidence/nominal-primitive-subtype-npm-20261014/index.json) extend Node record and variant fields to every admitted primitive base on both source routes, with per-site normalization, constructor-free results, offline installation and relocated JavaScript/strict-TypeScript replay. Complete component/runtime archives are retained. [Nineteen-base Python checks](../evidence/nominal-primitive-subtype-python-20261014/index.json) extend the same nominal fields and constructor-free results to both author routes on CPython 3.11.16 and 3.12.14. Two author roots reproduce each complete wheel; both interpreter floors install it offline after author removal and replay after physical relocation on Linux x64/glibc 2.36 with 64-bit machine words. [Nineteen-base browser checks](../evidence/nominal-primitive-subtype-browser-20261014/index.json) add all four source/API selections in Chromium, Firefox and WebKit pages, React production/Strict Mode and dedicated workers. Source-free bundles run after offline installation of both reproduced npm archives and removal of installed sources. They check missing-asset recovery, React remounts and pending unmounts, and worker restart/disposal using wasm32 payloads. [Nineteen-base C/C++ checks](../evidence/nominal-primitive-subtype-native-20261014/index.json) extend those fields and constructor-free results to both native projections. All four author/API selections reproduce complete packages, install offline after author removal and replay independent C11/GMP and C++20 callers after relocation on Linux x64/glibc 2.36. Both API modes retain native representations and 64-bit machine words. Full APIs check per-site normalization, active branches, caller snapshots, C output preservation and recovery after rejection; standalone result-only packages omit input constructor selections. [Nineteen-base Perl checks](../evidence/nominal-primitive-subtype-perl-20261015/index.json) extend those fields and constructor-free results to all four pinned Perl ABIs through reproduced CPAN component and runtime archives, prebuilt-only and build-xs offline installation after author removal and relocated replay on Linux x64/glibc 2.36 with 64-bit machine words. The four accepted selections ran serially under two frozen revisions with recorded per-run load admission ceilings; four non-accepted launches are preserved and not counted. [Nineteen-base Ruby checks](../evidence/nominal-primitive-subtype-ruby-20261015/index.json) extend the same fields and constructor-free results to both author routes on MRI Ruby 3.3.12. Full and result-only APIs reproduce complete gems, install offline after author removal and replay after physical relocation on Linux x64/glibc 2.36 with 64-bit machine words. [Nineteen-base Rust checks](../evidence/nominal-primitive-subtype-rust-20261015/index.json) extend the same fields and constructor-free results to both author routes using exact Rust representations and 64-bit machine words. Full and result-only APIs reproduce complete crates from two author roots, install offline with fourteen authenticated dependencies after author removal, replay after relocation and execute again after deleting all consumer sources on Rust and Cargo 1.90.0 with Linux x64/glibc 2.36. Primitive-base nominal acceptance in the remaining hosts, refined callbacks, owned, recursive, dependent and broader generic Subtypes remain pending."
			, ""
			, "[Checked-record browser packages](../evidence/checked-record-browser-promotion-20261011.md) have installed checks in Node, strict TypeScript, Chromium, Firefox and WebKit pages, React and workers on both source routes, including standalone result-only packages. [Nested checked-record npm/browser packages](../evidence/nested-checked-record-browser-20261016/index.json) add direct and repeated parameters, Array, List, Option, Product and Except copies, enclosing record and active variant fields, and constructor-free Array/Option results. [Nested checked-record C/C++ packages](../evidence/nested-checked-record-native-20261016/index.json) establish the same positions through independent C11/GMP and C++20 callers on both author routes and API modes, with reproduced packages, source-free offline installation and unchanged replay after relocation on Linux x64/glibc 2.36. [Nested checked-record .NET packages](../evidence/nested-checked-record-dotnet-20261016/index.json) establish the same copied positions through generated C# records, typed arrays and Result values in reproduced, source-free and relocated NuGet installations on .NET SDK 8.0.424 and shared framework 8.0.30. [Nested checked-record Java/Kotlin packages](../evidence/nested-checked-record-jvm-20261016/index.json) establish those positions through generated Java records and Kotlin classes in reproduced, source-free and relocated Maven installations on JDK 22.0.2 and Kotlin 2.2.0. The tested Packet carries Fin 10 and checked Nat Subtype fields; every selected constructor, exact rejection path, caller snapshot and recovery is checked. [PHP-Wasm checked-record packages](../evidence/checked-record-php-wasm-promotion-20261011.md) pass the earlier top-level forms in all four routes through weak/strict Node/Chromium callers on wasm32 PHP 8.4.1. Generic, recursive and inherited checked records, other indices, open dependent records, callbacks and owned positions remain unverified; targets other than npm, C, C++, .NET, Java and Kotlin need separate nested acceptance."
			, ""
			, table(["Lean type or source form", "Meaning", "Bounds and representation", "Ownership, absence and failure"], shapeRows)
			, ""
			, "Both ordinary-source and compiler-checked reviewed packages have installed corpus runs across all seventeen consumer profiles. The [native](../evidence/reviewed-native-20260918.md) and [Wasm](../evidence/reviewed-wasm-20260918.md) records list tested signatures and gaps. All profiles accept nineteen primitive parameter/result types, including [Char in npm](../evidence/char-npm-20260918.md), [native/PHP-Wasm Char](../evidence/char-native-20260918.md), and [USize/ISize](../evidence/platform-words-20260918.md). All profiles also accept copied arrays and acyclic records containing these primitives."
			, ""
			, "Platform integers follow the compiled Lean target: npm and PHP-Wasm use 32-bit words; native packages and native-backed WIT components use 64-bit words. Host adapters check those ranges before calling Lean. The consumer's pointer width does not select the range. Lean arithmetic still wraps at its compiled word width."
			, ""
			, phpWasmRefinementEntryReference(document)
			, ""
			, ...(genericReference ? [genericReference, ""] : [])
			, "All seventeen profiles have installed checks for synchronous primitive callbacks and returned Lean functions on both source paths. The [npm callable record](../evidence/npm-callables-20260919.md) covers Node, strict TypeScript, Chromium and Firefox, including React and workers. These shared callable checks use one through sixteen primitive arguments and a primitive result. All seventeen profiles also accept acyclic copied callback payloads. All seventeen profiles additionally accept finite recursive callback values. Asynchronous callables require separate contracts."
			, ""
			, "The tables retain the separately audited type/position inventory, including older Alpha-only generator observations. Standalone Binding IR generators and compiler-backed packages have different coverage: Rust's older Alpha resource projection rejects arbitrary-precision integers; its copied-value generator and compiled packages use BigUint and BigInt. npm's [copied-array ABI](../evidence/npm-arrays-20260920.md) supports nested arrays of all nineteen primitives on both source paths in Node, strict TypeScript, Chromium, Firefox and WebKit, including React and workers. Its [record ABI](../evidence/npm-records-20260920.md) adds named copied structures, including primitive fields, nested records and arrays of records in the same contexts. Its [compound ABI](../evidence/npm-compounds-20260920.md) preserves explicit Option tags, Except success/error branches and nested binary products, including arrays and record fields. These constructors are installed-tested on both npm source paths in all three browser engines. [Perl arrays and records](../evidence/perl-collections-20260921.md) have installed checks for all nineteen primitives, nested arrays and seven named structures on both source paths and four pinned ABIs. [C/C++ arrays and records](../evidence/native-collections-20260921.md) have installed checks for all nineteen primitives, seven records and 24 fixed Array levels on both source paths, including independent copies and allocation-failure cleanup. [Ruby arrays and records](../evidence/ruby-collections-20260922.md) have installed checks for every primitive, seven records and 24 fixed Array levels on both source paths, including builtin-bound snapshots, value equality and failure cleanup. [C# arrays and records](../evidence/dotnet-collections-20260922.md) have installed checks for all nineteen primitives, seven records and 24 fixed Array levels on both source paths, including structural record equality, matching hashes, failure cleanup and runtime-only execution. [Python arrays and records](../evidence/python-collections-20260922.md) have installed checks for all nineteen primitives, seven records and 24 fixed Array levels on both source paths across Python 3.11 and 3.12, including automatic typing dependencies, bounded runtime annotations, strict public types and failure cleanup. [Rust arrays and records](../evidence/rust-collections-20260922.md) have installed checks for all nineteen primitives, seven records and 24 fixed Array levels on both source paths, including exact typed callers, independently owned results, allocation/panic cleanup and source-free execution. [C/C++](../evidence/native-compounds-20260920.md), [Python](../evidence/python-compounds-20260920.md), [Rust](../evidence/rust-compounds-20260920.md), [C#](../evidence/dotnet-compounds-20260920.md), [Java/Kotlin](../evidence/jvm-compounds-20260920.md), [Ruby](../evidence/ruby-compounds-20260920.md), [Perl](../evidence/perl-compounds-20260920.md), [native PHP](../evidence/php-native-compounds-20260920.md), [PHP-Wasm](../evidence/php-wasm-compounds-20260920.md) and [WIT/WASI](../evidence/wit-compounds-20260920.md) also have installed compound checks on both source paths. npm also has [installed List checks](../evidence/npm-lists-20260920.md) for all nineteen primitive elements and nested copied values on both source paths in all five npm profiles. Lists retain a distinct IR constructor and use ordinary host arrays. [C/C++ Lists](../evidence/native-lists-20260920.md) have installed checks on both source paths, using typed spans and owned vectors. [Python Lists](../evidence/python-lists-20260920.md) accept exact lists or tuples and return owned tuples, with installed checks on both source paths. [Rust Lists](../evidence/rust-lists-20260920.md) borrow slices and return owned vectors, with installed checks on both source paths. [C# Lists](../evidence/dotnet-lists-20260920.md) use copied typed arrays, with installed checks and SDK-free deployment on both source paths. [Java/Kotlin Lists](../evidence/jvm-lists-20260920.md) use primitive or reference arrays, with independently compiled consumers and runtime-only deployment on both paths. [Ruby Lists](../evidence/ruby-lists-20260921.md) use copied Arrays, with installed checks and relocated gem execution on both paths. [Perl Lists](../evidence/perl-lists-20260921.md) use plain array references, with installed checks on both source paths and all four pinned Perl ABIs. [Native PHP Lists](../evidence/php-native-lists-20260921.md) use consecutive-key arrays, with installed weak/strict checks on both source paths. [PHP-Wasm Lists](../evidence/php-wasm-lists-20260921.md) use consecutive-key arrays with 32-bit PHP mappings, with installed Node/Chromium checks on both source paths. [WIT/WASI Lists](../evidence/wit-lists-20260921.md) use canonical lists through the packaged Wasmtime host, with installed checks on both source paths. Copied Lists and transparent aliases now cover all seventeen consumer profiles, including [WIT/WASI aliases](../evidence/wit-aliases-20260921.md). Concrete, non-recursive tagged variants have installed checks in all five [npm profiles](../evidence/npm-variants-20260921.md), [C++](../evidence/cpp-variants-20260921.md), [C/C-GMP](../evidence/c-variants-20260921.md), [Python](../evidence/python-variants-20260921.md), [Rust](../evidence/rust-variants-20260921.md), [C#](../evidence/dotnet-variants-20260921.md), [Java/Kotlin](../evidence/jvm-variants-20260921.md), [Ruby](../evidence/ruby-variants-20260921.md), [Perl](../evidence/perl-variants-20260921.md), [native PHP](../evidence/php-native-variants-20260921.md), [PHP-Wasm](../evidence/php-wasm-variants-20260921.md) and [WIT/WASI](../evidence/wit-variants-20260921.md). [Recursive npm values](../evidence/npm-recursive-20260922.md) have installed checks on both source paths across all five npm profiles, including Chromium, Firefox and WebKit. [Recursive C/C++ packages](../evidence/native-recursive-packages-20260923.md) also pass installed checks on both source paths, including source-free deployment. [Recursive Rust packages](../evidence/rust-recursive-packages-20260923.md), [Python wheels](../evidence/python-recursive-packages-20260923.md), [Ruby gems](../evidence/ruby-recursive-packages-20260923.md) and [Perl CPAN archives](../evidence/perl-recursive-packages-20260923.md) have installed checks on both source paths. Perl covers four pinned ABIs and both prebuilt-only and generated-XS-only installation. [C#, Java, Kotlin, native PHP and PHP-Wasm](../evidence/recursive-managed-acceptance-20260924.md) also pass installed recursive checks on both source paths. [WIT/WASI acceptance](../evidence/wit-recursive-acceptance-20260924.md) completes the copied family. Recursive copied values have installed checks across all seventeen profiles. [Structured C callbacks](../evidence/c-structured-callables-20260924.md), [C++ callbacks](../evidence/cpp-structured-callables-20260924.md), [Rust callbacks](../evidence/rust-structured-callables-20260924.md), [Python callbacks](../evidence/python-structured-callables-20260924.md), [Ruby callbacks](../evidence/ruby-structured-callables-20260924.md), [C# callbacks](../evidence/dotnet-structured-callables-20260924.md), [Java/Kotlin callbacks](../evidence/jvm-structured-callables-20260925.md), [Perl callbacks](../evidence/perl-structured-callables-20260925.md), [native PHP callbacks](../evidence/php-structured-callables-20260925.md), [PHP-Wasm callbacks](../evidence/php-wasm-structured-callables-20260925.md) and [WIT/WASI callbacks](../evidence/wit-structured-callables-20260925.md) additionally have installed checks for arrays, Lists, options, results, products, acyclic records, variants and aliases. [Structured npm callbacks](../evidence/npm-structured-callables-20260925.md) have installed checks for all nine copied shapes, including recursive values, across Node, TypeScript, Chromium, Firefox and WebKit page, React and worker contexts. C and C++ have [installed recursive callback checks](../evidence/native-recursive-callables-20260925.md), as do [Python](../evidence/python-recursive-callables-20260925.md), [Rust](../evidence/rust-recursive-callables-20260925.md), [Ruby](../evidence/ruby-recursive-callables-20260925.md), [Perl](../evidence/perl-recursive-callables-20260925.md), [C#](../evidence/dotnet-recursive-callables-20260926.md), [Java/Kotlin](../evidence/jvm-recursive-callables-20260926.md), [native PHP](../evidence/php-recursive-callables-20260926.md), [PHP-Wasm](../evidence/php-wasm-recursive-callables-20260926.md) and [WIT/WASI](../evidence/wit-recursive-callables-20260926.md). Recursive callback payloads now have installed checks across all seventeen profiles. Explicitly owned resource aggregates remain assigned work. Missing mappings and positions remain assigned work in the [type inventory](../type-surface.v1.json)."
		].join("\n")
			.replace(zeroPayloadNativeMarker
				, `${hasZeroPayloadMatrixEvidence(document) ? `${zeroPayloadMatrixReference} ` : ""}${zeroPayloadNativeMarker}`)
			.replace(checkedRecordValueIndexBrowserMarker
				, `${checkedRecordValueIndexBrowser} ${hasDependentCheckedRecordMatrixEvidence(document) ? `${dependentCheckedRecordMatrixReference} ` : ""}${checkedRecordValueIndexBrowserMarker}`)
			.replace(nestedCheckedRecordPerlMarker
				, `${nestedCheckedRecordPerl} ${nestedCheckedRecordPerlMarker}`)
			.replace(nestedCheckedRecordPerlPending
				, "targets other than npm, C, C++, .NET, Java, Kotlin and Perl need separate nested acceptance")
			.replace(nestedCheckedRecordPhpMarker
				, `${nestedCheckedRecordPhp} ${nestedCheckedRecordPhpMarker}`)
			.replace(nestedCheckedRecordPhpPending
				, "targets other than npm, C, C++, .NET, Java, Kotlin, Perl and native PHP need separate nested acceptance")
			.replace(nestedCheckedRecordPythonMarker
				, `${nestedCheckedRecordPython} ${nestedCheckedRecordPythonMarker}`)
			.replace(nestedCheckedRecordPythonPending
				, "targets other than npm, C, C++, .NET, Java, Kotlin, Perl, native PHP and Python need separate nested acceptance")
			.replace(nestedCheckedRecordRubyMarker
				, `${nestedCheckedRecordRuby} ${nestedCheckedRecordRubyMarker}`)
			.replace(nestedCheckedRecordRubyPending
				, "targets other than npm, C, C++, .NET, Java, Kotlin, Perl, native PHP, Python and Ruby need separate nested acceptance")
			.replace(nestedCheckedRecordWitMarker
				, `${nestedCheckedRecordWit} ${nestedCheckedRecordWitMarker}`)
			.replace(nestedCheckedRecordWitPending
				, "targets other than npm, C, C++, .NET, Java, Kotlin, Perl, native PHP, Python, Ruby and WIT/WASI need separate nested acceptance")
			.replace(nestedCheckedRecordPhpWasmMarker
				, `${nestedCheckedRecordPhpWasm} ${nestedCheckedRecordPhpWasmMarker}`)
			.replace(nestedCheckedRecordPhpWasmPending
				, "the Rust target still needs separate nested acceptance")
			.replace(nestedCheckedRecordRustMarker
				, `${nestedCheckedRecordRust} ${nestedCheckedRecordRustMarker}`)
			.replace(nestedCheckedRecordRustPending
				, "All seventeen profiles have separate installed acceptance for this tested nested copied boundary")
			.replace(inheritedCheckedRecordMarker, inheritedCheckedRecord)
			.replace(recursiveCheckedRecordMarker, recursiveCheckedRecord)
			.replace(primitiveNominalMarker,
				`${primitiveNominalDotnet} ${primitiveNominalPhp} ${primitiveNominalPhpWasm} ${recursiveSubtypePhpWasm} ${primitiveNominalWit} ${primitiveNominalJvm} ${primitiveNominalPending}\n\n${ownedSubtypePhpWasm}${hasOwnedSubtypeHostedEvidence(document) ? ` ${ownedSubtypeHostedReference}` : ""} ${callbackSubtypePhpWasm}${hasCallbackSubtypeHostedEvidence(document) ? ` ${callbackSubtypeHostedReference}` : ""}`)
			.replace(callbackCheckedRecordMarker
				, `${callbackCheckedRecordMarker} ${callbackCheckedRecord}`)
	};
}
