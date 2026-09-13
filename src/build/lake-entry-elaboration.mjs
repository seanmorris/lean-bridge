/**
 * Derive public APIs from fresh Lean interfaces inside the build engine.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { validateBindingIr } from "../binding-ir/contract.mjs";
import { assertComponentSignature, componentScalarTypes } from "../abi/component-scalars.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { verifyLakeEntryModules } from "./lake-entry-modules.mjs";
import { createMetadataRequest, identifyLeanInterface } from "../analyze/elaborated-metadata.mjs";
import { projectElaboratedMetadata } from "../analyze/project-elaborated.mjs";

const fail = message => { throw Object.assign(new Error(message), { code: "invalid-lake-entry-elaboration" }); };
const closed = (value, fields) => {
	if(!value || Array.isArray(value) || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...fields].sort())) fail("Elaborated metadata fields must be closed");
};
const name = value => typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_']*(?:\.[A-Za-z_][A-Za-z0-9_']*)*$(?![\s\S])/.test(value);
const doc = summary => ({ summary, details: "" });

/**
 * Lower the admitted pure primitive signatures without consulting source text.
 *
 * @param inventory - Original project files and package facts.
 * @param entries - Root module identities confirmed by Lake.
 * @param elaboration - Fresh compiler metadata and the identities that produced it.
 */
export const createLakeEntryAnalysis = (inventory, entries, elaboration) => {
	if(elaboration.metadata?.kind === "lean-bridge-elaborated-exports") return projectElaboratedMetadata(inventory, entries, elaboration);
	const { metadata } = elaboration;
	closed(metadata, ["schemaVersion", "kind", "declarations"]);
	if(metadata.schemaVersion !== 1 || metadata.kind !== "lean-bridge-native-elaborated-exports" || !Array.isArray(metadata.declarations)
		|| !metadata.declarations.length || metadata.declarations.length > 1024) fail("Unsupported or empty elaborated export set");
	const primitive = type => {
		closed(type, ["kind", "name", "lean", "abi"]);
		if(type.kind !== "primitive" || !componentScalarTypes.includes(type.name)) fail("Elaborated npm APIs currently require pure primitive signatures");
		return { kind: "primitive", name: type.name };
	};
	const selected = new Map(entries.map(entry => [entry.module, entry]));
	const publicNames = new Set(), declarations = [], candidates = [];
	for(const item of metadata.declarations)
	{
		closed(item, ["name", "module", "parameters", "result"]);
		const publicName = item.name?.split(".").at(-1);
		if(!name(item.name) || !selected.has(item.module) || publicNames.has(publicName) || !Array.isArray(item.parameters) || item.parameters.length > 32) fail("Invalid, duplicate or unselected elaborated export");
		publicNames.add(publicName);
		const declaration = {
			id: `lean:${item.name}`, name: publicName, kind: "function", owner: null
			, overloadKey: item.name, typeParameters: [], receiver: null
			, parameters: item.parameters.map((parameter, index) => {
				closed(parameter, ["name", "type"]);
				return { name: `arg${index}`, type: primitive(parameter.type), ownership: "copy", lifetime: null, mutability: "immutable", optional: false, default: null };
			})
			, result: { type: primitive(item.result), ownership: "copy", lifetime: null }
			, mutability: "immutable", effects: []
			, failure: { mode: "none", errors: [], unexpected: "poison-runtime" }
			, resultMode: "value", capabilities: [], assurance: []
			, documentation: doc(`Call ${item.name}.`)
			, source: { producer: "lean", declaration: item.name, extensions: {} }
		};
		assertComponentSignature(declaration); declarations.push(declaration);
		candidates.push({ declaration: item.name, sourceModule: item.module, path: selected.get(item.module).path, status: "exportable" });
	}
	const facts = inventory.project;
	const id = `${facts.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[^a-z0-9]+/, "") || "lean-project"}@${facts.version}`;
	const document = { schemaVersion: 3
		, component: { id, name: facts.name, version: facts.version }
		, producers: [{ id: "lean", adapter: "lean-bridge-native-elaborator"
			, adapterVersion: 1, tool: "Lean", toolVersion: facts.toolVersion
			, extensions: { "lean-lang.org/toolchain": facts.toolchain
				, "lean-lang.org/elaboration-sha256": sha256(canonicalJson(elaboration)) } }]
		, types: [], declarations, errors: [], capabilities: [], assurance: []
		, documentation: doc(`Compiler-checked exports for ${facts.name}.`) };
	validateBindingIr(document);
	return { project: inventory.project, inputs: inventory.inputs
		, sourceTreeSha256: inventory.sourceTreeSha256, adapterHints: []
		, exportCandidates: candidates, entryModules: entries, elaboration
		, bindingIr: { origin: "lean-elaborated", path: null
			, semanticSha256: hashBindingIr(document), document } };
};

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
 */
export const elaborateLakeEntryModules = async ({ inventory, entries, workspace, leanPrefix, engineRoot, signal, runner = processBuildRunner }) => {
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
			, exports: configuration.exports ?? [], resources: [], arities: [] };
		const request = createMetadataRequest(selection, { toolchain: inventory.project.toolchain
			, snapshotSha256: workspace.evidence.resolution.snapshotSha256
			, generatedSourcesSha256: workspace.generatedSources?.sha256 ?? null
			, leanCompilerSha256: workspace.document.leanCompilerSha256, extractorSha256
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
