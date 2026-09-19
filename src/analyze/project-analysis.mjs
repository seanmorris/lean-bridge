/**
 * Assemble the public analysis contract from compiler metadata or reviewed Binding IR.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { hashBindingIr, parseBindingIr } from "../binding-ir/canonical.mjs";
import { projectElaboratedMetadata } from "./project-elaborated.mjs";
import { createMetadataRequest } from "./elaborated-metadata.mjs";
import { compilerExportSelection } from "./export-configuration.mjs";
import { assertReviewedSourceConfiguration, validateReviewedSource, reviewedSourceSelection } from "./reviewed-source.mjs";

const fail = message => { throw Object.assign(new Error(message), { code: "invalid-compiler-analysis" }); };
const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const closed = (value, keys) => {
	if(!value || typeof value !== "object" || Array.isArray(value) || !same(Object.keys(value).sort(), keys.toSorted())) fail("Compiler analysis evidence fields must be closed");
};
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$(?![\s\S])/.test(value);
const moduleName = value => typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_']*(?:\.[A-Za-z_][A-Za-z0-9_']*)*$(?![\s\S])/.test(value);
const facts = inventory => ({ root: "."
	, name: inventory.project.name
	, version: inventory.project.version
	, toolchain: inventory.project.toolchain
	, lakefile: inventory.project.lakefile });
const diagnostic = item => ({ code: item.code
	, severity: item.severity
	, message: item.message
	, path: item.path ?? null
	, hint: item.hint ?? null
	, category: item.category ?? null
	, module: item.module ?? null
	, declaration: item.declaration ?? null });
const versionWarning = inventory => inventory.project.version === "0.0.0-local" ? [diagnostic({
	code: "package-version-defaulted"
	, severity: "warning"
	, message: "No semantic package version was found; the Binding IR uses 0.0.0-local"
	, path: inventory.project.lakefile
	, hint: "Set version in lakefile.toml or package.json before release."
})] : [];

/**
 * Expose a stable report without leaking engine-only entry ownership annotations.
 *
 * @param inventory - Original source inventory.
 * @param entries - Selected public source modules.
 * @param elaboration - Fresh, invocation-bound compiler report.
 */
export const compilerProjectAnalysis = (inventory, entries, elaboration) => {
	if(elaboration?.schemaVersion !== 3 || elaboration.kind !== "lean-bridge-lake-entry-elaboration") fail("Unsupported compiler analysis evidence");
	const analysis = projectElaboratedMetadata(inventory, entries, elaboration);
	const report = { ...analysis };
	delete report.entryModules;
	const unsupported = ["resources"].filter(key => Object.keys(inventory.configurationRecord.configuration[key] ?? {}).length);
	if(unsupported.length)
	{
		report.bindingIr = null;
		report.proposedExports = [];
		for(const field of unsupported) report.diagnostics.push(diagnostic({
			code: "analysis-configuration-unsupported"
			, severity: "error"
			, category: "unsupported-meaning"
			, message: `Compiler analysis does not yet project the configured ${field}`
			, path: "lean-bridge.exports.json"
			, hint: "Use an explicit reviewed Binding IR for this API."
		}));
	}
	return { ...report, schemaVersion: 2, project: facts(inventory)
		, diagnostics: [...report.diagnostics.map(diagnostic), ...versionWarning(inventory)] };
};

/**
 * Preserve explicit reviewed IR without obtaining semantics from source scanning.
 *
 * @param projectRoot - Original read-only project root.
 * @param inventory - Captured input identities and shared configuration.
 * @param signal - Optional cancellation signal.
 */
export const reviewedProjectAnalysis = async (projectRoot, inventory, signal) => {
	const paths = inventory.inputs.filter(input => input.path.endsWith(".binding-ir.json"));
	if(!paths.length) fail("Reviewed analysis requires an explicit Binding IR document");
	assertReviewedSourceConfiguration(inventory.configurationRecord.configuration);
	let bindingIr = null;
	if(paths.length === 1)
	{
		signal?.throwIfAborted();
		const bytes = await readFile(join(projectRoot, paths[0].path));
		if(sha256(bytes) !== paths[0].sha256 || bytes.length !== paths[0].bytes) fail("Reviewed Binding IR changed during analysis");
		const document = parseBindingIr(bytes.toString("utf8"));
		bindingIr = { origin: "existing-validated", path: paths[0].path, semanticSha256: hashBindingIr(document), document };
	}
	const candidates = (bindingIr?.document.declarations ?? []).map(item => ({
		declaration: item.source?.declaration ?? item.id
		, kind: "reviewed-ir"
		, path: bindingIr.path
		, line: null
		, documentation: item.documentation?.summary || null
		, confidence: "reviewed-ir"
		, status: "exportable"
		, reasons: []
		, shape: null
		, theoremCandidates: []
		, evidence: ["binding-ir:validated"]
	}));
	return { schemaVersion: 2
		, project: facts(inventory)
		, inputs: inventory.inputs
		, sourceTreeSha256: inventory.sourceTreeSha256
		, buildGraph: { imports: []
			, flake: inventory.inputs.some(input => input.path === "flake.nix")
			, lockfiles: inventory.inputs.filter(input => ["flake.lock", "lake-manifest.json", "package-lock.json"].includes(input.path)).map(({ path, sha256 }) => ({ path, sha256 })) }
		, compiledEnvironment: { status: "absent", format: "Lean elaborated metadata", modules: [], note: "Reviewed Binding IR was validated without compiling source or consulting cached interfaces." }
		, declarations: []
		, exportCandidates: candidates
		, proposedExports: bindingIr?.document.declarations.map(item => item.id) ?? []
		, bindingIr
		, adapterHints: bindingIr ? [] : [{ id: "hint:component-selection"
			, declaration: null
			, reason: "multiple-binding-ir-documents"
			, question: "Which component should this analysis target?"
			, choices: paths.map(item => item.path)
			, required: true }]
		, diagnostics: [...versionWarning(inventory)
			, ...(bindingIr ? [] : [diagnostic({
				code: "binding-ir-unavailable"
				, severity: "error"
				, message: "Select one reviewed Binding IR document before proceeding"
				, hint: "Keep the intended component in this analysis project." })])]
		, readOnly: true, elaboration: null };
};

/**
 * Reconstruct the public report and check its authorized roots and captured identities.
 *
 * @param analysis - Untrusted engine output.
 * @param inventory - Original independently captured project facts.
 * @param intent - Authorized public source intent and snapshot.
 */
export const validateCompilerProjectAnalysis = (analysis, inventory, intent) => {
	const elaboration = analysis?.elaboration;
	closed(elaboration, ["schemaVersion", "kind", "snapshotSha256", "generatedSourcesSha256", "leanCompilerSha256", "extractorSha256", "request", "interfaces", "metadata", ...(elaboration.reviewedBindingIr === undefined ? [] : ["reviewedBindingIr"])]);
	const { request } = elaboration;
	const selectionFields = compilerExportSelection(inventory.configurationRecord.configuration);
	closed(request, ["modules", "exportModules", "exports", "resources", "arities", "metadata", ...Object.keys(selectionFields)]);
	closed(request.metadata, ["toolchain", "invocationIdentitySha256", "modules"]);
	if(![elaboration.snapshotSha256, elaboration.leanCompilerSha256, elaboration.extractorSha256].every(digest)
		|| (elaboration.generatedSourcesSha256 !== null && !digest(elaboration.generatedSourcesSha256))
		|| !Array.isArray(request.modules) || !request.modules.length || !request.modules.every(moduleName)
		|| new Set(request.modules).size !== request.modules.length || !Array.isArray(request.metadata.modules)
		|| !Array.isArray(elaboration.interfaces) || elaboration.interfaces.length !== request.modules.length
		|| !same(request.resources, []) || !same(request.arities, elaboration.reviewedBindingIr ? reviewedSourceSelection(elaboration.reviewedBindingIr).arities : Object.entries(inventory.configurationRecord.configuration.arities ?? {}).sort(([a], [b]) => a.localeCompare(b)))) fail("Invalid compiler analysis invocation");
	if(elaboration.snapshotSha256 !== intent.lakeSnapshot.sha256 || request.metadata.toolchain !== inventory.project.toolchain
		|| !same(request.exportModules, intent.document.modules.map(item => item.module).sort())
		|| !same(request.exports, elaboration.reviewedBindingIr ? validateReviewedSource(elaboration.reviewedBindingIr).declarations.map(item => item.source.declaration).sort() : inventory.configurationRecord.configuration.exports ?? [])
		|| !same(elaboration.reviewedBindingIr ?? null, intent.document.reviewedBindingIr ?? null)
		|| !same(request.specializations ?? [], selectionFields.specializations ?? [])
		|| !same(request.contracts ?? {}, selectionFields.contracts ?? {})
		|| !request.exportModules.every(name => request.modules.includes(name)))
		fail("Compiler analysis differs from the authorized source or export selection");
	if(!same(request.metadata.modules.map(module => module?.name), request.modules)) fail("Compiler analysis module order differs from its invocation");
	for(const entry of intent.document.modules)
		if(request.metadata.modules.find(module => module.name === entry.module)?.sourcePath !== `root/${entry.path}`) fail("Compiler analysis changed a selected root's source path");
	const captured = new Map([...intent.lakeSnapshot.document.rootInputs.map(file => [`root/${file.path}`, file.sha256])
		, ...intent.lakeSnapshot.document.packages.flatMap(pkg => pkg.files.map(file => [`${pkg.directory}/${file.path}`, file.sha256]))]);
	for(const [index, module] of request.metadata.modules.entries())
	{
		closed(module, ["name", "sourcePath", "sourceSha256", "interfaceSha256"]);
		const compiled = elaboration.interfaces[index];
		closed(compiled, ["module", "sourceSha256", "oleanSha256", "interfaceSha256"]);
		if(![module.sourceSha256, module.interfaceSha256, compiled.oleanSha256].every(digest)
			|| compiled.module !== module.name || compiled.sourceSha256 !== module.sourceSha256 || compiled.interfaceSha256 !== module.interfaceSha256)
			fail("Compiler analysis interface identity differs from the invocation");
		if(typeof module.sourcePath !== "string" || !/^(?:root|packages\/[^/]+)\//.test(module.sourcePath)
			|| module.sourcePath.split("/").some(part => [".", "..", ""].includes(part)) || module.sourcePath.includes("\\")) fail("Invalid compiler analysis source path");
		if(captured.has(module.sourcePath))
		{ if(captured.get(module.sourcePath) !== module.sourceSha256) fail("Compiler analysis source identity differs from the snapshot"); }
		else if(elaboration.generatedSourcesSha256 === null) fail("Compiler analysis names an uncaptured source");
	}
	const { metadata, ...selection } = request;
	const reconstructed = createMetadataRequest(selection, { toolchain: inventory.project.toolchain
		, snapshotSha256: elaboration.snapshotSha256
		, generatedSourcesSha256: elaboration.generatedSourcesSha256
		, leanCompilerSha256: elaboration.leanCompilerSha256
		, extractorSha256: elaboration.extractorSha256
		, ...(elaboration.reviewedBindingIr ? { reviewedBindingIrSha256: sha256(canonicalJson(elaboration.reviewedBindingIr)) } : {})
		, modules: metadata.modules });
	if(!same(reconstructed, request)) fail("Compiler analysis invocation identity is invalid");
	const expected = compilerProjectAnalysis(inventory, intent.document.modules, elaboration);
	if(!same(expected, analysis)) fail("Public analysis differs from its compiler-owned metadata");
	return true;
};
