/**
 * Project authenticated Lean metadata into analysis and primitive Binding IR.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { validateElaboratedMetadata } from "./elaborated-metadata.mjs";
import { createElaboratedSemanticModel, elaboratedComponent } from "./semantic-model.mjs";
import { reconcileReviewedElaboration, verifyReviewedSourceInputs } from "./reviewed-source.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";

/**
 * Build a reviewable report using structural types supplied by Lean itself.
 *
 * @param inventory - Captured project facts and source hashes.
 * @param entries - Public modules whose ownership Lake has checked.
 * @param elaboration - Fresh report and its authenticated invocation context.
 */
export const projectElaboratedMetadata = (inventory, entries, elaboration) => {
	const { metadata, request } = elaboration;
	if(metadata.profile !== "component-scalars-v1") throw new Error("Ordinary component projection requires the scalar metadata profile");
	validateElaboratedMetadata(metadata, request);
	verifyReviewedSourceInputs(elaboration, inventory.inputs);
	const elaborationSha256 = sha256(canonicalJson(elaboration));
	const all = metadata.modules.flatMap(module => module.declarations.map(declaration => ({ ...declaration, module: module.name })));
	const byIdentity = new Map(all.map(item => [item.identity, item]));
	const selected = all.filter(item => item.selected), counts = new Map();
	for(const item of selected) counts.set(item.identity.split(".").at(-1), (counts.get(item.identity.split(".").at(-1)) ?? 0) + 1);
	const diagnostics = metadata.diagnostics.map(item => ({ ...item, path: byIdentity.get(item.declaration)?.source?.path ?? null, hint: null }));
	const candidates = selected.map(item => {
		const reasons = diagnostics.filter(diagnostic => diagnostic.declaration === item.identity && diagnostic.severity === "error").map(item => item.code);
		if(item.projection.status === "unsupported" && !reasons.includes(item.projection.reason)) reasons.push(item.projection.reason);
		if(counts.get(item.identity.split(".").at(-1)) > 1) reasons.push("public-name-collision");
		if(!item.source && !reasons.includes("missing-source-position")) reasons.push("missing-source-position");
		return { declaration: item.identity
			, kind: item.kind
			, path: entries.find(entry => entry.module === item.module)?.path ?? item.source?.path
			, sourceModule: item.module
			, line: item.source?.startLine ?? null
			, documentation: item.documentation
			, confidence: reasons.length ? "blocked" : "lean-elaborated"
			, status: reasons.length ? "blocked" : "exportable"
			, reasons
			, shape: item.projection.status === "supported" ? item.projection : null
			, theoremCandidates: item.theoremReferences
			, evidence: ["compiled-interface:fresh", `elaboration:${elaborationSha256}`] };
	});
	const adapterHints = candidates.flatMap(candidate => candidate.reasons.map(reason => ({
		id: `hint:${candidate.declaration}:${reason}`
		, declaration: candidate.declaration
		, reason
		, required: true
		, question: reason === "public-name-collision" ? "Which namespace-qualified export should this component expose?" : `How should Lean Bridge project ${candidate.declaration} (${reason})?`
		, choices: reason === "public-name-collision" ? ["select-one-export", "provide-wrapper"] : ["exclude", "provide-adapter"]
	})));
	for(const item of metadata.diagnostics.filter(item => ["missing-declaration", "unused-export-contract"].includes(item.code)))
		adapterHints.push({ id: `hint:${item.declaration}:${item.code}`
			, declaration: item.declaration
			, reason: item.code
			, required: true
			, question: item.code === "unused-export-contract" ? `Which selected public export should contract ${item.declaration} describe?` : `Which existing public declaration should replace ${item.declaration}?`
			, choices: ["correct-export-selection"] });
	const facts = inventory.project;
	const semantic = createElaboratedSemanticModel({
		metadata, request, component: elaboratedComponent(facts), elaborationSha256
		, include: candidates.filter(item => item.status === "exportable").map(item => item.declaration)
	});
	const document = adapterHints.length ? semantic.document : reconcileReviewedElaboration(inventory, elaboration, semantic.document);
	const semanticSha256 = hashBindingIr(document);
	const declarations = document.declarations;
	const bindingIr = declarations.length && !diagnostics.some(item => item.category === "extractor-failure" || item.category === "stale-metadata")
		? { origin: "lean-elaborated", path: null, semanticSha256, document } : null;
	if(!bindingIr) diagnostics.push({ code: "binding-ir-unavailable", severity: "error", message: "No supported compiler-checked API is available", path: null, hint: "Resolve the compiler diagnostics or select a supported public API." });
	for(const item of candidates.filter(item => item.documentation === null))
		diagnostics.push({ code: "documentation-missing", severity: "warning", message: `${item.declaration} has no documentation comment`, path: item.path, hint: null });
	return { schemaVersion: 1
		, project: { ...facts, root: "." }
		, inputs: inventory.inputs
		, sourceTreeSha256: inventory.sourceTreeSha256
		, buildGraph: { imports: metadata.modules.flatMap(module => module.directImports.map(imported => ({ module: imported, source: module.sourcePath })))
			, flake: inventory.inputs.some(input => input.path === "flake.nix")
			, lockfiles: inventory.inputs.filter(input => ["flake.lock", "lake-manifest.json", "package-lock.json"].includes(input.path)).map(({ path, sha256 }) => ({ path, sha256 })) }
		, compiledEnvironment: { status: "available"
			, format: "Lean elaborated metadata"
			, modules: metadata.modules.map(module => ({ module: module.name
				, declarations: module.declarations.map(item => item.identity)
				, directImports: module.directImports
				, sha256: module.interfaceSha256 }))
			, note: "Fresh interfaces and compiler-owned structural types. Theorem references do not confer a proof assurance claim." }
		, declarations: all.map(item => ({ name: item.identity
			, kind: item.kind
			, path: item.source?.path ?? null
			, line: item.source?.startLine ?? null
			, signature: item.typeExpression
			, documented: item.documentation !== null
			, compiled: true }))
		, exportCandidates: candidates
		, proposedExports: bindingIr?.document.declarations.map(item => item.id) ?? []
		, bindingIr
		, adapterHints: adapterHints.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
		, diagnostics
		, readOnly: true
		, entryModules: entries
		, elaboration };
};
