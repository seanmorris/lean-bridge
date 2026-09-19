/**
 * Derive public APIs from fresh Lean interfaces inside the build engine.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { verifyLakeEntryModules } from "./lake-entry-modules.mjs";
import { createMetadataRequest, identifyLeanInterface } from "../analyze/elaborated-metadata.mjs";
import { projectElaboratedMetadata } from "../analyze/project-elaborated.mjs";
import { compilerExportSelection } from "../analyze/export-configuration.mjs";
import { reviewedSourceSelection, verifyReviewedSourceInputs } from "../analyze/reviewed-source.mjs";

const fail = message => { throw Object.assign(new Error(message), { code: "invalid-lake-entry-elaboration" }); };

/**
 * Lower the admitted pure primitive signatures without consulting source text.
 *
 * @param inventory - Original project files and package facts.
 * @param entries - Root module identities confirmed by Lake.
 * @param elaboration - Fresh compiler metadata and the identities that produced it.
 */
export const createLakeEntryAnalysis = (inventory, entries, elaboration) => projectElaboratedMetadata(inventory, entries, elaboration);

/**
 * Compile fresh interfaces, then ask Lean for names, types and implementation checks.
 *
 * @param options - Verified source and selected compiler context.
 * @param options.inventory - Original project facts and input hashes.
 * @param options.entries - Captured/generated public module intent.
 * @param options.workspace - Authenticated resolved Lake workspace retained by the caller.
 * @param options.leanPrefix - Pinned Lean installation.
 * @param options.engineRoot - Installed bridge-owned extractor source.
 * @param options.signal - Optional cancellation signal.
 * @param options.runner - Optional process runner for compiler and extractor fault checks.
 * @param options.reviewedBindingIr - Captured contract, checked against fresh compiler facts.
 */
export const elaborateLakeEntryModules = async ({ inventory, entries, workspace, leanPrefix, engineRoot, signal, runner = processBuildRunner, reviewedBindingIr }) => {
	verifyReviewedSourceInputs({ reviewedBindingIr }, inventory.inputs);
	const roots = verifyLakeEntryModules(entries, workspace.resolution).map(entry => entry.origin.kind === "captured"
		? { ...entry, origin: { kind: "captured", snapshotSha256: workspace.evidence.resolution.snapshotSha256 } } : entry);
	if(!roots.length) fail("Entry elaboration requires an authenticated public root");
	const lean = join(leanPrefix, "bin/lean"), extractor = join(engineRoot, "src/analyze/NativeExports.lean");
	const extractorSha256 = sha256(await readFile(extractor));
	const working = await mkdtemp(join(tmpdir(), `lean-bridge-entry-elaboration-${process.pid}-`));
	try
	{
		await workspace.verify();
		if(sha256(await readFile(lean)) !== workspace.document.leanCompilerSha256) fail("Lean compiler changed after Lake resolution");
		const env = { PATH: `${join(leanPrefix, "bin")}:${process.env.PATH}`, LEAN_SYSROOT: leanPrefix, LEAN_PATH: join(working, "olean"), LANG: "C.UTF-8", LC_ALL: "C.UTF-8" };
		const interfaces = [];
		for(const module of workspace.resolution.modules)
		{
			const relative = `${module.module.replaceAll(".", "/")}.lean`, source = join(workspace.sourceRoot, relative), output = join(working, "olean", relative.replace(/\.lean$/, ".olean"));
			if(sha256(await readFile(source)) !== module.source.sha256) fail(`Source changed before elaboration: ${module.module}`);
			await mkdir(dirname(output), { recursive: true });
			await runner.capture({ command: lean, args: ["-R", workspace.sourceRoot, "-o", output, source], cwd: workspace.sourceRoot, env, signal, timeoutMs: 120000 });
			interfaces.push({ module: module.module, sourceSha256: module.source.sha256, ...await identifyLeanInterface(output, signal) });
		}
		const configuration = inventory.configurationRecord.configuration;
		const selection = { modules: workspace.resolution.modules.map(module => module.module)
			, exportModules: roots.map(entry => entry.module).sort()
			, exports: configuration.exports ?? []
			, resources: []
			, arities: Object.entries(configuration.arities ?? {}).sort(([a], [b]) => a.localeCompare(b))
			, ...compilerExportSelection(configuration)
			, ...(reviewedBindingIr ? reviewedSourceSelection(reviewedBindingIr) : {}) };
		const request = createMetadataRequest(selection, { toolchain: inventory.project.toolchain
			, snapshotSha256: workspace.evidence.resolution.snapshotSha256
			, generatedSourcesSha256: workspace.generatedSources?.sha256 ?? null
			, leanCompilerSha256: workspace.document.leanCompilerSha256, extractorSha256
			, ...(reviewedBindingIr ? { reviewedBindingIrSha256: sha256(canonicalJson(reviewedBindingIr)) } : {})
			, modules: workspace.resolution.modules.map((module, index) => ({ name: module.module, sourcePath: module.path, sourceSha256: module.source.sha256, interfaceSha256: interfaces[index].interfaceSha256 })) });
		const requestPath = join(working, "request.json");
		await writeFile(requestPath, canonicalJson(request), { flag: "wx", mode: 0o444 });
		let metadata;
		try
		{
			const extracted = await runner.capture({ command: lean, args: ["--run", extractor, "--metadata", requestPath], cwd: working, env, signal, timeoutMs: 120000 });
			metadata = JSON.parse(extracted.stdout);
		}
		catch(error)
		{
			signal?.throwIfAborted();
			throw Object.assign(new Error("Lean metadata extraction failed"), { code: "lean-metadata-extractor-failed"
				, details: { category: "extractor-failure", cause: error.message, compilerDetails: error.details ?? null } });
		}
		const elaboration = { schemaVersion: 3
			, kind: "lean-bridge-lake-entry-elaboration"
			, snapshotSha256: workspace.evidence.resolution.snapshotSha256
			, generatedSourcesSha256: workspace.generatedSources?.sha256 ?? null
			, leanCompilerSha256: workspace.document.leanCompilerSha256
			, extractorSha256, request, interfaces
			, ...(reviewedBindingIr ? { reviewedBindingIr } : {})
			, metadata };
		if(extractorSha256 !== sha256(await readFile(extractor))) fail("Export extractor changed during elaboration");
		if(sha256(await readFile(lean)) !== workspace.document.leanCompilerSha256) fail("Lean compiler changed during elaboration");
		for(const module of workspace.resolution.modules)
			if(sha256(await readFile(join(workspace.sourceRoot, `${module.module.replaceAll(".", "/")}.lean`))) !== module.source.sha256) fail(`Source changed during elaboration: ${module.module}`);
		for(const module of interfaces)
			if((await identifyLeanInterface(join(working, "olean", `${module.module.replaceAll(".", "/")}.olean`), signal)).interfaceSha256 !== module.interfaceSha256) fail(`Interface changed during elaboration: ${module.module}`);
		await workspace.verify();
		return createLakeEntryAnalysis(inventory, roots, elaboration);
	} finally
	{ await rm(working, { recursive: true, force: true }); }
};
