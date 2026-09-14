/**
 * Project authenticated Lean metadata into analysis and primitive Binding IR.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { validateBindingIr } from "../binding-ir/contract.mjs";
import { validateElaboratedMetadata } from "./elaborated-metadata.mjs";

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
	for(const item of metadata.diagnostics.filter(item => item.code === "missing-declaration"))
		adapterHints.push({ id: `hint:${item.declaration}:missing-declaration`
			, declaration: item.declaration
			, reason: item.code
			, required: true
			, question: `Which existing public declaration should replace ${item.declaration}?`
			, choices: ["correct-export-selection"] });
	const doc = summary => ({ summary, details: "" });
	const declarations = candidates.filter(item => item.status === "exportable").map(candidate => {
		const source = byIdentity.get(candidate.declaration);
		const specialization = source.specialization ? { name: source.identity, ...source.specialization } : null;
		return { id: `lean:${source.identity}`
			, name: source.identity.split(".").at(-1)
			, kind: "function"
			, owner: null
			, overloadKey: source.identity
			, typeParameters: []
			, receiver: null
			, parameters: source.projection.parameters.map((parameter, index) => ({ name: `arg${index}`
				, type: parameter.type
				, ownership: "copy"
				, lifetime: null
				, mutability: "immutable"
				, optional: false
				, default: null }))
			, result: { type: source.projection.result, ownership: "copy", lifetime: null }
			, mutability: "immutable"
			, effects: []
			, failure: { mode: "none", errors: [], unexpected: "poison-runtime" }
			, resultMode: "value"
			, capabilities: []
			, assurance: []
			, documentation: doc(source.documentation ?? `Call ${source.identity}.`)
			, source: { producer: "lean"
				, declaration: specialization?.declaration ?? source.identity
				, extensions: { "lean-lang.org/theorem-references": source.theoremReferences
					, ...(specialization ? { "lean-lang.org/specialization": specialization } : {}) } } };
	});
	const facts = inventory.project;
	const id = `${facts.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[^a-z0-9]+/, "") || "lean-project"}@${facts.version}`;
	const document = { schemaVersion: 3
		, component: { id, name: facts.name, version: facts.version }
		, producers: [{ id: "lean"
			, adapter: metadata.producer.adapter
			, adapterVersion: metadata.producer.adapterVersion
			, tool: "Lean"
			, toolVersion: metadata.producer.toolVersion
			, extensions: { "lean-lang.org/toolchain": facts.toolchain, "lean-lang.org/elaboration-sha256": elaborationSha256 } }]
		, types: []
		, declarations
		, errors: []
		, capabilities: []
		, assurance: []
		, documentation: doc(`Compiler-checked exports for ${facts.name}.`) };
	if(declarations.length) validateBindingIr(document);
	const bindingIr = declarations.length && !diagnostics.some(item => item.category === "extractor-failure" || item.category === "stale-metadata")
		? { origin: "lean-elaborated", path: null, semanticSha256: hashBindingIr(document), document } : null;
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
