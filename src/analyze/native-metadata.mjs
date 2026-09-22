/**
 * Project the shared compiler report into the existing native ABI model.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { createMetadataRequest, validateElaboratedMetadata } from "./elaborated-metadata.mjs";

const fail = message => { throw Object.assign(new Error(message), { code: "invalid-native-elaboration" }); };
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const name = value => typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/.test(value);
const names = value => Array.isArray(value) && value.every(name) && new Set(value).size === value.length;
const containsGraph = value => value !== null && typeof value === "object"
	&& (value.kind === "graph" || Object.values(value).some(containsGraph));

/**
 * Reconstruct invocation context from separately retained compiler/source evidence.
 *
 * @param metadata - Shared report emitted by the pinned Lean extractor.
 * @param sourceIdentity - Native build's compiler, selection and interface evidence.
 * @param options - Internal compiled-transport admission.
 * @param options.copiedGraphs - Allow finite graphs only for the typed carrier compiler.
 */
export const projectNativeMetadata = (metadata, sourceIdentity, { copiedGraphs = false } = {}) => {
	if(!sourceIdentity || !digest(sourceIdentity.leanCompilerSha256) || !digest(sourceIdentity.extractorSha256)
		|| !digest(sourceIdentity.sourceTreeSha256) || !/^[a-f0-9]{40}$/.test(sourceIdentity.leanCommit)
		|| !Array.isArray(sourceIdentity.modules) || !sourceIdentity.modules.length) fail("Native metadata requires measured compiler and source identities");
	const { metadata: context, ...selection } = sourceIdentity.request ?? {};
	if(canonicalJson(Object.keys(selection).sort()) !== canonicalJson(["arities", "exportModules", "exports", "modules", "profile", "resources", ...(selection.specializations === undefined ? [] : ["specializations"]), ...(selection.contracts === undefined ? [] : ["contracts"])].sort())
		|| selection.profile !== "native-library-v1" || !names(selection.modules) || !selection.modules.length || !names(selection.exportModules) || !selection.exportModules.length
		|| selection.exportModules.some(module => !selection.modules.includes(module)) || !names(selection.exports) || !names(selection.resources)
		|| !Array.isArray(selection.arities) || selection.arities.some(item => !Array.isArray(item) || item.length !== 2 || !name(item[0]) || !Number.isSafeInteger(item[1]) || item[1] < 0 || item[1] > 32)
		|| new Set(selection.arities.map(item => item[0])).size !== selection.arities.length) fail("Native metadata requires its shared-profile request");
	const modules = sourceIdentity.modules.map(item => {
		if(!name(item?.module) || !digest(item.source?.sha256) || !digest(item.interface?.sha256) || !digest(item.interface?.interfaceSha256)
			|| typeof item.source.path !== "string" || !item.source.path.endsWith(".lean") || item.source.path.includes("\\") || item.source.path.split("/").some(part => ["", ".", ".."].includes(part))) fail("Native metadata requires complete source and interface identities");
		return { name: item.module, sourcePath: item.source.path, sourceSha256: item.source.sha256, interfaceSha256: item.interface.interfaceSha256 };
	});
	if(canonicalJson(modules.map(item => item.name)) !== canonicalJson(selection.modules)) fail("Native request differs from the compiled module closure");
	const expected = createMetadataRequest(selection, { toolchain: `leanprover/lean4:v${sourceIdentity.leanVersion}`
		, modules
		, leanCompilerSha256: sourceIdentity.leanCompilerSha256
		, ...(sourceIdentity.reviewedBindingIr === undefined ? {} : { reviewedBindingIrSha256: sha256(canonicalJson(sourceIdentity.reviewedBindingIr)) })
		, extractorSha256: sourceIdentity.extractorSha256 });
	if(canonicalJson(expected.metadata) !== canonicalJson(context)) fail("Native invocation differs from retained compiler/source evidence");
	validateElaboratedMetadata(metadata, expected);
	const diagnostics = metadata.diagnostics.filter(item => item.severity === "error");
	if(diagnostics.length) throw Object.assign(new Error(`Native export metadata rejected: ${diagnostics.map(item => item.message).join("; ")}`), {
		code: "native-elaboration-unsupported"
		, details: { diagnostics
			, projections: metadata.modules.flatMap(module => module.declarations).filter(item => item.selected && item.projection.status === "unsupported").map(item => ({ declaration: item.identity, ...item.projection })) }
	});
	const graph = metadata.modules.flatMap(module => module.declarations).find(item => item.selected && containsGraph(item.projection));
	if(graph && !copiedGraphs) throw Object.assign(new Error(`${graph.identity}: copied graph exports require the bounded graph transport`), {
		code: "native-elaboration-unsupported"
		, details: { declaration: graph.identity }
	});
	return { sha256: sha256(canonicalJson({ metadata, sourceIdentity }))
		, declarations: metadata.modules.flatMap(module => module.declarations.filter(item => item.selected).map(item => ({
			name: item.identity, module: module.name
			, parameters: item.projection.parameters
			, result: item.projection.result
			, documentation: item.documentation, sourcePosition: item.source
			, theoremReferences: item.theoremReferences
			, ...(item.specialization ? { specialization: { name: item.identity, ...item.specialization } } : {})
		}))).sort((left, right) => left.name.localeCompare(right.name)) };
};
