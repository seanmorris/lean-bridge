/**
 * Capture, elaborate and verify an ordinary Lean API once per compiled profile.
 * The target callback compiles emitted C; fresh Lean checks bracket that work.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectLeanProject } from "../analyze/lean-project.mjs";
import { assertExportConfigurationCapabilities, assertExportConfigurationSnapshot, readExportConfiguration, selectSourceModules, compilerExportSelection } from "../analyze/export-configuration.mjs";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { generateNativeLeanAdapters } from "./native-model.mjs";
import { nativeArtifactPaths } from "./native-artifacts.mjs";
import { captureLockedLakeProject } from "./lake-workspace.mjs";
import { verifyLakeSnapshotSourceTree } from "./lake-dependency-snapshot.mjs";
import { elaboratedComponent } from "../analyze/semantic-model.mjs";
import { resolveLakeBuildWorkspace } from "./lake-build-workspace.mjs";
import { selectLakeEntryModules, verifyLakeEntryModules } from "./lake-entry-modules.mjs";
import { createMetadataRequest, identifyLeanInterface } from "../analyze/elaborated-metadata.mjs";

const engineRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const pinnedCompiledLean = "f3b06c705e6c85f5314019d5d3baab0fec5b580c";
const json = value => canonicalJson(value);
const namePattern = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/;
const absent = async path => {
	try
	{ await readdir(path); } catch(error)
	{ if(error.code === "ENOENT") return; throw error; }
	throw new Error(`native output already exists: ${path}`);
};
const save = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); };
const fileIdentity = async path => { const bytes = await readFile(path); return { bytes: bytes.length, sha256: sha256(bytes) }; };

/**
 * Keep source, interface, metadata and toolchain drift checks shared by targets.
 *
 * @param options - Source selection, fixed target profile and compiler hooks.
 * @param options.projectRoot - Ordinary Lean project root.
 * @param options.outputRoot - New output directory.
 * @param options.leanPrefix - Pinned host Lean compiler installation.
 * @param options.moduleName - Optional Perl namespace for native projections.
 * @param options.modules - Selected Lean entry modules.
 * @param options.exports - Selected Lean declarations.
 * @param options.resources - Explicit identity-bearing types.
 * @param options.arities - Argument counts for returned closures.
 * @param options.configurationSha256 - Expected shared configuration digest.
 * @param options.lakeSnapshot - Shared immutable Lake source capture.
 * @param options.targets - Projections whose configuration must be admitted.
 * @param options.validateModel - Target admission before compiling adapters.
 * @param options.profile - Fixed compiled target profile.
 * @param options.receiptName - Target-specific receipt filename.
 * @param options.createModel - Fixed target model factory.
 * @param options.compileComponent - Compile the checked C and return a receipt.
 * @param options.signal - Child-process cancellation signal.
 * @param options.runner - Process runner for fresh compiler and drift checks.
 */
export const buildElaboratedComponent = async ({ projectRoot
	, outputRoot
	, leanPrefix
	, moduleName
	, modules
	, exports
	, resources
	, arities
	, configurationSha256
	, lakeSnapshot
	, targets = ["cpan"]
	, validateModel
	, profile
	, receiptName
	, createModel
	, compileComponent
	, signal
	, runner = processBuildRunner }) => {
	const receipts = { "native-library-v1": "native-component.json", "php-wasm-copied-v1": "php-wasm-component.json" };
	if(!Object.hasOwn(receipts, profile) || receipts[profile] !== receiptName) throw new TypeError("Invalid compiled component profile or receipt path");
	const run = (command, args, options = {}) => runner.capture({ command, args, cwd: engineRoot, ...options });
	const output = resolve(outputRoot), project = resolve(projectRoot);
	await absent(output); await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(join(dirname(output), ".lean-bridge-native-component-"));
	let lakeWorkspace;
	try
	{
		const record = await readExportConfiguration(project, { signal });
		if(configurationSha256 !== undefined && configurationSha256 !== record.sha256) throw new Error("export configuration changed before native compilation");
		const config = record.configuration;
		for(const target of targets)
			assertExportConfigurationCapabilities(config, { target, fields: ["modules", "exports", "resources", "arities", "specializations", "contracts", "generators"], targetFields: target === "cpan" ? ["module", "version"] : target === "php-wasm" ? ["npm", "composer"] : ["name", "version"] });
		for(const [field, value] of Object.entries({ modules, exports, resources, arities }))
			if(value !== undefined && config[field] !== undefined && canonicalJson(value) !== canonicalJson(config[field]))
				throw new Error(`Native ${field} override conflicts with lean-bridge.exports.json`);
		if(moduleName !== undefined && config.targets?.cpan?.module !== undefined && moduleName !== config.targets.cpan.module)
			throw new Error("Native moduleName override conflicts with targets.cpan.module");
		modules ??= config.modules;
		exports ??= config.exports ?? [];
		resources ??= config.resources ?? [];
		arities ??= config.arities ?? {};
		if(targets.includes("cpan")) moduleName ??= config.targets?.cpan?.module;
		const inventory = await inspectLeanProject(project, { signal });
		const entries = selectLakeEntryModules({ ...config, modules }, inventory.inputs);
		const analysis = inventory;
		assertExportConfigurationSnapshot(record, analysis.inputs);
		const lean = join(resolve(leanPrefix), "bin/lean");
		const extractor = join(engineRoot, "src/analyze/NativeExports.lean");
		const leanCompilerSha256 = sha256(await readFile(lean)), extractorSha256 = sha256(await readFile(extractor));
		const probe = await run(lean, ["--version"], { signal });
		const leanVersion = probe.stdout.match(/version ([^,]+),/)?.[1];
		if(!probe.stdout.includes(pinnedCompiledLean) || analysis.project.toolchain !== `leanprover/lean4:v${leanVersion}`) throw new Error("native source/compiler/runtime toolchain mismatch");
		const sources = entries.filter(entry => entry.origin.kind === "captured").map(({ module, path, bytes, sha256 }) => ({ module, path, bytes, sha256 }));
		let sourceByModule = new Map(selectSourceModules({}, analysis.inputs).map(({ module, ...input }) => [module, input]));
		for(const { module, ...input } of sources) sourceByModule.set(module, input);
		const selectedModules = modules ?? [...sourceByModule.keys()];
		if(!selectedModules.length || selectedModules.some(name => !namePattern.test(name) || !entries.some(entry => entry.module === name))) throw new Error("native module selection is invalid");
		if([...exports, ...resources, ...Object.keys(arities)].some(name => !namePattern.test(name))) throw new Error("native export selection is invalid");
		if(Object.values(arities).some(n => !Number.isSafeInteger(n) || n < 0 || n > 32)) throw new Error("invalid native export arity");
		if(lakeSnapshot) await verifyLakeSnapshotSourceTree({ snapshot: lakeSnapshot, projectRoot: project, signal });
		else lakeSnapshot = await captureLockedLakeProject({ projectRoot: project, inputs: analysis.inputs, signal });
		if(config.generators?.length && !lakeSnapshot) throw new Error("Lake generators require a captured lake-manifest.json");
		let lakeModules;
		if(lakeSnapshot)
		{
			lakeWorkspace = await resolveLakeBuildWorkspace({ snapshot: lakeSnapshot, modules: selectedModules, leanPrefix, signal });
			if(lakeWorkspace.resolution.leanCommit !== pinnedCompiledLean) throw new Error("native Lake resolver/compiler identity mismatch");
			lakeModules = new Map(lakeWorkspace.resolution.modules.map(module => [module.module, module]));
			verifyLakeEntryModules(entries, lakeWorkspace.resolution);
			sourceByModule = new Map(lakeWorkspace.resolution.modules.map(module => [module.module, { ...module.source, path: module.path }]));
		}
		const sourcePathFor = (name, input) => lakeWorkspace ? `${name.replaceAll(".", "/")}.lean` : input.path;
		const originalSource = (name, input) => lakeWorkspace
			? join(lakeWorkspace.sourceRoot, sourcePathFor(name, input)) : join(project, input.path);
		const sourceRoot = join(staging, "source"), oleanRoot = join(staging, "olean");
		await mkdir(oleanRoot); const compiled = new Set(), active = new Set(), compileOrder = [];
		const sourceByPath = new Map();
		for(const [name, input] of sourceByModule)
		{
			const bytes = await readFile(originalSource(name, input));
			if(sha256(bytes) !== input.sha256) throw new Error(`native source drift: ${input.path}`);
			const path = resolve(sourceRoot, sourcePathFor(name, input));
			await save(path, bytes); sourceByPath.set(path, name);
		}
		const env = { ...process.env, LEAN_SYSROOT: resolve(leanPrefix), LEAN_PATH: oleanRoot, LEAN_SRC_PATH: sourceRoot, PATH: `${join(leanPrefix, "bin")}:${process.env.PATH}` };
		const compile = async name => {
			if(compiled.has(name)) return;
			if(active.has(name)) throw new Error(`cyclic native source imports: ${name}`);
			active.add(name);
			const input = sourceByModule.get(name), sourceBytes = await readFile(originalSource(name, input));
			if(sha256(sourceBytes) !== input.sha256) throw new Error(`native source drift: ${input.path}`);
			const path = sourcePathFor(name, input);
			const sourcePath = join(sourceRoot, path), cPath = join(staging, `c/${path.replace(/\.lean$/, ".c")}`), olean = join(oleanRoot, `${name.replaceAll(".", "/")}.olean`);
			if(lakeModules)
			{
				for(const dependency of lakeModules.get(name).imports)
					if(lakeModules.has(dependency)) await compile(dependency);
			}
			else
			{
				const dependencies = await run(lean, ["--src-deps", sourcePath], { cwd: sourceRoot, env, signal });
				for(const path of dependencies.stdout.trim().split("\n"))
				{
					const dependency = sourceByPath.get(resolve(path));
					if(dependency) await compile(dependency);
				}
			}
			await save(sourcePath, sourceBytes); await mkdir(dirname(cPath), { recursive: true }); await mkdir(dirname(olean), { recursive: true });
			await run(lean, ["-R", sourceRoot, "-o", olean, "-c", cPath, sourcePath], { cwd: sourceRoot, env, signal });
			const compiledInterface = await identifyLeanInterface(olean, signal);
			compileOrder.push({ module: name, source: input
				, interface: { ...await fileIdentity(olean), interfaceSha256: compiledInterface.interfaceSha256 }
				, c: cPath });
			active.delete(name); compiled.add(name);
		};
		for(const name of selectedModules) await compile(name);
		// This selects Lean's C-shape metadata. The model and target compiler,
		// not this source-admission label, determine the binary pointer width.
		const selection = { profile: "native-library-v1"
			, modules: compileOrder.map(item => item.module)
			, exports, resources
			, arities: Object.entries(arities)
			, ...compilerExportSelection(config)
			, exportModules: selectedModules };
		const request = createMetadataRequest(selection, { toolchain: analysis.project.toolchain
			, leanCompilerSha256, extractorSha256
			, modules: compileOrder.map(item => ({ name: item.module
				, sourcePath: item.source.path
				, sourceSha256: item.source.sha256
				, interfaceSha256: item.interface.interfaceSha256 })) });
		await save(join(staging, "request.json"), json(request));
		const verifyElaborationInputs = async () => {
			if(sha256(await readFile(lean)) !== leanCompilerSha256 || sha256(await readFile(extractor)) !== extractorSha256)
				throw Object.assign(new Error("Native compiler or extractor changed during compilation"), { code: "native-elaboration-drift" });
			for(const item of compileOrder)
			{
				const path = join(oleanRoot, `${item.module.replaceAll(".", "/")}.olean`);
				const actual = await identifyLeanInterface(path, signal);
				if(actual.oleanSha256 !== item.interface.sha256 || actual.interfaceSha256 !== item.interface.interfaceSha256
					|| sha256(await readFile(join(sourceRoot, sourcePathFor(item.module, item.source)))) !== item.source.sha256)
					throw Object.assign(new Error(`Native source or interface changed: ${item.module}`), { code: "native-elaboration-drift" });
			}
		};
		await verifyElaborationInputs();
		const extractMetadata = async () => {
			try
			{
				const extracted = await run(lean, ["--run", extractor, "--metadata", join(staging, "request.json")], { env, signal });
				return JSON.parse(extracted.stdout);
			}
			catch(error)
			{
				signal?.throwIfAborted();
				throw Object.assign(new Error("Lean native metadata extraction failed"), { code: "lean-metadata-extractor-failed"
					, details: { category: "extractor-failure", cause: error.message, compilerDetails: error.details ?? null } });
			}
		};
		const metadata = await extractMetadata();
		const sourceIdentity = { leanVersion
			, leanCommit: pinnedCompiledLean
			, leanCompilerSha256
			, sourceTreeSha256: analysis.sourceTreeSha256
			, exportConfigurationSha256: record.sha256
			, extractorSha256
			, request
			, modules: compileOrder.map(({ module, source, interface: compiledInterface }) => ({ module, source, interface: compiledInterface })) };
		if(lakeWorkspace) sourceIdentity.lakeDependencies = { ...lakeWorkspace.evidence, snapshotSha256: lakeSnapshot.sha256 };
		const model = createModel({ metadata
			, component: elaboratedComponent(analysis.project)
			, moduleName: moduleName ?? (targets.includes("cpan") ? `LeanBridge::${analysis.project.name.split(/[^A-Za-z0-9]+/).filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("")}` : undefined)
			, sourceIdentity });
		if(model.profile !== profile || model.pointerBits !== (profile === "native-library-v1" ? 64 : 32)) throw new TypeError("Compiled model differs from its target profile");
		validateModel?.(model);
		await verifyElaborationInputs();
		const adapters = generateNativeLeanAdapters(model), generated = join(sourceRoot, `${adapters.module}.lean`), generatedC = join(staging, "c/adapter.c");
		await save(generated, adapters.leanSource);
		await run(lean, ["-R", sourceRoot, "-c", generatedC, generated], { env, signal });
		await verifyElaborationInputs();
		if(canonicalJson(await extractMetadata()) !== canonicalJson(metadata))
			throw Object.assign(new Error("Native metadata changed during adapter compilation"), { code: "native-elaboration-drift" });
		await verifyElaborationInputs();
		await save(join(staging, "component.h"), adapters.header);
		// The C compiler must compare every generated ABI declaration with Lean's
		// actual emitted definition. An ABI mismatch is a build error, not a crash
		// waiting for an installed consumer.
		await save(generatedC, `${await readFile(generatedC, "utf8")}\n#include "component.h"\n`);
		const { receipt, verify } = await compileComponent({ staging, model, metadata, sourceIdentity, adapters, compileOrder, generatedC, lakeWorkspace, lakeSnapshot, run, verifyElaborationInputs });
		if((await inspectLeanProject(project, { signal })).sourceTreeSha256 !== analysis.sourceTreeSha256) throw new Error("native source changed during compilation");
		if(lakeSnapshot) await verifyLakeSnapshotSourceTree({ snapshot: lakeSnapshot, projectRoot: project, signal });
		if(lakeWorkspace && sha256(await readFile(lean)) !== lakeWorkspace.document.leanCompilerSha256)
			throw new Error("native Lean compiler changed during compilation");
		await verify?.();
		await lakeWorkspace?.verify();
		await verifyElaborationInputs();
		if(lakeWorkspace?.generatedSources) await save(join(staging, "lake-generated-sources.json"), json(lakeWorkspace.generatedSources.document));
		await save(join(staging, "metadata.json"), json(metadata)); await save(join(staging, "model.json"), json(model));
		await save(join(staging, "binding-ir.json"), json(model.bindingIr)); await save(join(staging, receiptName), json(receipt));
		await save(join(staging, "generated.lean"), adapters.leanSource);
		for(const path of ["source", "olean", "c", "native-objects", "request.json"]) await rm(join(staging, path), { recursive: true, force: true });
		const files = {};
		for(const path of await nativeArtifactPaths(staging)) files[path] = await fileIdentity(join(staging, path));
		await save(join(staging, "artifacts.json"), json({ schemaVersion: 1, profile, files }));
		await rename(staging, output);
		return { root: output, model, receipt };
	} catch(error)
	{ await rm(staging, { recursive: true, force: true }); throw error; }
	finally
	{ await lakeWorkspace?.dispose(); }
	};
