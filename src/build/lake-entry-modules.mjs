/**
 * Compiler-free public module intent, checked against Lake after generation.
 *
 * @file
 */
import { selectSourceModules, validateExportConfiguration } from "../analyze/export-configuration.mjs";

const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };

/**
 * Select captured roots or declared root-owned outputs without inventing signatures.
 * Lake must subsequently confirm each module's library, path and selected producer.
 *
 * @param configuration - Shared export configuration read from the original project.
 * @param inputs - Original project input inventory, including its lock and configuration.
 */
export const selectLakeEntryModules = (configuration, inputs) => {
	validateExportConfiguration(configuration);
	if(!configuration.modules || !configuration.generators?.length)
		return selectSourceModules(configuration, inputs).map(input => ({ ...input, origin: { kind: "captured" } }));
	if(!inputs.some(input => input.path === "lake-manifest.json"))
		fail("generated-entry-lock-required", "Generated entry modules require a captured lake-manifest.json");
	const outputs = configuration.generators.flatMap(recipe => recipe.outputs.filter(output => output.path.endsWith(".lean"))
		.map(output => ({ path: output.path, origin: { kind: "generated", generator: `root/${recipe.name}` } })));
	const selected = configuration.modules.map(module => {
		const suffix = `${module.replaceAll(".", "/")}.lean`;
		const candidates = [...inputs.filter(input => input.path.endsWith(".lean")).map(input => ({ ...input, origin: { kind: "captured" } })), ...outputs]
			.filter(input => input.path === suffix || input.path.endsWith(`/${suffix}`));
		if(!candidates.length) fail("unknown-export-module", `Selected module ${module} has no captured source or declared root generator output`);
		if(candidates.length !== 1) fail("ambiguous-export-module", `Selected module ${module} has multiple captured or generated source candidates`);
		return { ...candidates[0], module };
	});
	if(new Set(selected.map(input => input.path)).size !== selected.length)
		fail("ambiguous-export-module", "Selected module names refer to the same captured or generated file");
	return selected;
};

/**
 * Require the resolved closure to preserve selected root ownership and source origin.
 *
 * @param entries - Compiler-free module intent.
 * @param resolution - Authenticated second Lake resolution result.
 */
export const verifyLakeEntryModules = (entries, resolution) => {
	return entries.map(entry => {
		const actual = resolution.modules.find(item => item.module === entry.module);
		if(!actual || actual.path !== `root/${entry.path}`)
			fail("lake-entry-source-drift", `Lake resolved a different source for public module ${entry.module}`);
		const origin = actual.source.origin ?? { kind: "captured" };
		if(origin.kind !== entry.origin.kind || (entry.origin.kind === "generated" && origin.generator !== entry.origin.generator)
			|| (entry.origin.kind === "captured" && (actual.source.sha256 !== entry.sha256 || actual.source.bytes !== entry.bytes)))
			fail("lake-entry-source-drift", `Lake resolved a different origin for public module ${entry.module}`);
		return { module: entry.module, path: entry.path, bytes: actual.source.bytes, sha256: actual.source.sha256, origin };
	});
};
