/**
 * Stage authenticated generator outputs and re-resolve their Lake import closure.
 *
 * @file
 */
import { constants } from "node:fs";
import { chmod, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { verifyLakeDependencySnapshot, writeLakeDependencySnapshot } from "./lake-dependency-snapshot.mjs";
import { readLakeGeneratorRecipes, validateLakeGeneratorPrerequisiteReceipt } from "./lake-generator-prerequisites.mjs";
import { verifyLakeGeneratorCompiler } from "./lake-generators.mjs";
import { validateLakeModuleClosure } from "./lake-workspace.mjs";
import { processBuildRunner } from "./process-runner.mjs";

const resolverSource = fileURLToPath(new URL("ResolveLakeWorkspace.lean", import.meta.url));
const fail = message => { throw Object.assign(new Error(message), { code: "invalid-generated-lake-workspace" }); };
const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const frozen = value => {
	if(value && typeof value === "object")
	{ Object.values(value).forEach(frozen); Object.freeze(value); }
	return value;
};
const closed = (value, fields) => {
	if(!value || typeof value !== "object" || Array.isArray(value) || !same(Object.keys(value).sort(), [...fields].sort())) fail("Generated workspace fields must be closed");
};
const digest = value => typeof value === "string" && /^[0-9a-f]{64}$(?![\s\S])/.test(value);
const capturedFiles = snapshot => [
	...snapshot.document.rootInputs.map(file => ({ ...file, path: `root/${file.path}` }))
	, ...snapshot.document.packages.flatMap(pkg => pkg.files.map(file => ({ ...file, path: `${pkg.directory}/${file.path}` })))
];
const outputFiles = prerequisites => prerequisites.generators.flatMap(generator => generator.receipt.outputs.map(output => ({
	...output, generator: generator.key, receiptSha256: generator.sha256
}))).sort((left, right) => compare(left.path, right.path));
const overlayDocument = (snapshot, prerequisites, expectedPrerequisitesSha256) => ({
	schemaVersion: 1, kind: "lean-bridge-generated-lake-workspace"
	, snapshotSha256: snapshot.sha256
	, prerequisitesSha256: expectedPrerequisitesSha256
	, outputs: outputFiles(prerequisites)
});
const identity = content => ({ bytes: Buffer.byteLength(content), sha256: sha256(content), mode: 0o644 });

// Read no more than the authorized size plus one byte, even during concurrent growth.
const readVerified = async (path, expected, signal) => {
	signal?.throwIfAborted();
	const before = await lstat(path);
	if(!before.isFile() || await realpath(path) !== path || before.size !== expected.bytes) fail(`Source identity or file type changed: ${path}`);
	const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	try
	{
		const stat = await handle.stat();
		if(!stat.isFile() || stat.ino !== before.ino || stat.dev !== before.dev || stat.size !== expected.bytes) fail("Source changed while opening it");
		const buffer = Buffer.alloc(expected.bytes + 1);
		let length = 0;
		while(length < buffer.length)
		{
			signal?.throwIfAborted();
			const { bytesRead } = await handle.read(buffer, length, Math.min(65536, buffer.length - length), null);
			if(bytesRead === 0) break;
			length += bytesRead;
		}
		const bytes = buffer.subarray(0, length), after = await handle.stat(), current = await lstat(path);
		if(stat.size !== after.size || stat.mtimeMs !== after.mtimeMs || stat.ctimeMs !== after.ctimeMs
			|| stat.ino !== current.ino || stat.dev !== current.dev || await realpath(path) !== path
			|| bytes.length !== expected.bytes || sha256(bytes) !== expected.sha256 || (stat.mode & 0o111 ? 0o755 : 0o644) !== expected.mode) fail(`Source bytes or mode changed: ${path}`);
		return bytes;
	} finally
	{ await handle.close(); }
};

const verifyFiles = async (root, files, signal) => {
	const expected = new Map(files.map(file => [file.path, file])), directories = new Set([""]);
	for(const file of files)
		for(let parent = dirname(file.path); parent !== "."; parent = dirname(parent)) directories.add(parent);
	const found = new Set();
	const visit = async prefix => {
		signal?.throwIfAborted();
		const path = join(root, prefix), before = await lstat(path);
		if(!before.isDirectory() || !directories.has(prefix) || await realpath(path) !== path) fail(`Unexpected or symlinked generated workspace directory: ${prefix || "."}`);
		for(const entry of await readdir(path, { withFileTypes: true }))
		{
			const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
			if(entry.isDirectory()) await visit(relative);
			else
			{
				if(!expected.has(relative)) fail(`Unexpected generated workspace file: ${relative}`);
				await readVerified(join(root, relative), expected.get(relative), signal);
				found.add(relative);
			}
		}
		const after = await lstat(path);
		if(before.ino !== after.ino || before.dev !== after.dev || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) fail("Workspace directory changed during verification");
	};
	await visit("");
	if(found.size !== expected.size) fail("Generated workspace is missing an authorized file");
};

/**
 * Validate separate output origins without changing the original capture identity.
 *
 * @param document - Generated workspace receipt.
 * @param expected - Independently authorized capture, selection and receipt digests.
 * @param expected.snapshot - Complete original source capture.
 * @param expected.modules - Selected root modules.
 * @param expected.catalog - Recipes read from the verified original capture.
 * @param expected.prerequisites - Recorded selection and generator receipts.
 * @param expected.expectedPrerequisitesSha256 - Selection digest from the build handoff.
 * @param expected.expectedSha256 - Workspace receipt digest from the build handoff.
 */
export const validateGeneratedLakeWorkspace = (document, { snapshot, modules, catalog, prerequisites, expectedPrerequisitesSha256, expectedSha256 }) => {
	validateLakeGeneratorPrerequisiteReceipt(prerequisites, { snapshot, modules, catalog, expectedSha256: expectedPrerequisitesSha256 });
	if(!digest(expectedSha256) || sha256(canonicalJson(document)) !== expectedSha256) fail("Generated workspace differs from its expected identity");
	if(!same(document, overlayDocument(snapshot, prerequisites, expectedPrerequisitesSha256))) fail("Generated workspace output origins differ from the authorized receipts");
	if(document.outputs.length > 16384 || document.outputs.reduce((sum, file) => sum + file.bytes, 0) > 256 * 1024 * 1024) fail("Generated workspace exceeds its aggregate output limit");
	return true;
};

/**
 * Copy verified outputs into a new workspace, retaining an untouched source capture.
 * The caller keeps ownership of prerequisite staging and may dispose it afterward.
 *
 * @param options - Source capture and completed, independently identified generators.
 * @param options.snapshot - Opaque complete source capture.
 * @param options.modules - Selected root module names.
 * @param options.prerequisites - Result of prepareLakeGeneratorPrerequisites.
 * @param options.expectedPrerequisitesSha256 - Required selection handoff identity.
 * @param options.signal - Optional cancellation signal.
 */
export const prepareGeneratedLakeWorkspace = async ({ snapshot, modules, prerequisites, expectedPrerequisitesSha256, signal }) => {
	signal?.throwIfAborted();
	if(!prerequisites || typeof prerequisites.verify !== "function" || !Array.isArray(prerequisites.results)) fail("Staging requires completed generator prerequisites");
	const working = await mkdtemp(join(tmpdir(), `lean-bridge-generated-workspace-${process.pid}-`));
	try
	{
		const captureRoot = join(working, "capture"), workspaceRoot = join(working, "workspace");
		await writeLakeDependencySnapshot({ snapshot, outputRoot: captureRoot, signal });
		const catalog = await readLakeGeneratorRecipes({ snapshot, snapshotRoot: captureRoot, signal });
		// Clone retained metadata before awaiting user-supplied verification callbacks.
		const receipt = frozen(JSON.parse(canonicalJson(prerequisites.document)));
		const document = frozen(overlayDocument(snapshot, receipt, expectedPrerequisitesSha256)), hash = sha256(canonicalJson(document));
		validateGeneratedLakeWorkspace(document, { snapshot, modules, catalog, prerequisites: receipt, expectedPrerequisitesSha256, expectedSha256: hash });
		const results = [...prerequisites.results];
		if(!same(results.map(result => ({ key: result.key, receipt: result.document, sha256: result.sha256 })), receipt.generators)) fail("Generator results differ from the authorized selection");
		await prerequisites.verify();
		await writeLakeDependencySnapshot({ snapshot, outputRoot: workspaceRoot, signal });
		const captured = capturedFiles(snapshot);
		for(const file of captured)
			for(const root of [captureRoot, workspaceRoot]) await chmod(join(root, file.path), file.mode === 0o755 ? 0o555 : 0o444);
		for(const file of document.outputs)
		{
			const result = results.find(result => result.key === file.generator);
			const bytes = await readVerified(join(resolve(result.outputRoot), file.path), file, signal);
			await mkdir(dirname(join(workspaceRoot, file.path)), { recursive: true });
			await writeFile(join(workspaceRoot, file.path), bytes, { flag: "wx", mode: 0o444, signal });
		}
		const files = [...captured, ...document.outputs
			, { path: "lake-dependency-snapshot.json", ...identity(canonicalJson(snapshot.document)) }];
		const verify = async () => {
			await verifyLakeDependencySnapshot({ snapshot, snapshotRoot: captureRoot, signal });
			await verifyFiles(workspaceRoot, files, signal);
		};
		await prerequisites.verify();
		await verify();
		return Object.freeze({ workspaceRoot, captureRoot, catalog, document
			, sha256: hash, prerequisites: receipt
			, verify, dispose: () => rm(working, { recursive: true, force: true }) });
	} catch(error)
	{
		await rm(working, { recursive: true, force: true });
		throw error;
	}
};

const sourceIdentities = (snapshot, overlay) => new Map([
	...capturedFiles(snapshot).map(file => [file.path, { ...file, origin: { kind: "captured", snapshotSha256: snapshot.sha256 } }])
	, ...overlay.outputs.map(({ generator, receiptSha256, ...file }) => [file.path, { ...file, origin: { kind: "generated", generator, receiptSha256 } }])
]);
const checkResolution = (raw, snapshot, modules, overlay, prerequisites) => {
	closed(raw, ["schemaVersion", "resolver", "generators", "resolution"]);
	if(raw.schemaVersion !== 1 || raw.resolver !== "lean-lake-generated"
		|| !same(raw.generators, prerequisites.selection.generators.map(generator => generator.key))) fail("Generated imports changed the selected Lake prerequisites");
	const resolution = validateLakeModuleClosure(raw.resolution, snapshot, modules, sourceIdentities(snapshot, overlay));
	if(!same(resolution.packages, prerequisites.selection.packages) || resolution.leanVersion !== prerequisites.selection.leanVersion
		|| resolution.leanCommit !== prerequisites.selection.leanCommit) fail("Generated resolution changed package or compiler identity");
	return { ...raw, resolution };
};

/**
 * Check generated module/native origins against independently verified receipts.
 * This validates recorded evidence; it does not execute Lake or read source bytes.
 *
 * @param document - Resolution receipt with explicit captured/generated origins.
 * @param expected - Original capture and previously authorized output evidence.
 * @param expected.snapshot - Complete original source capture.
 * @param expected.modules - Selected root modules.
 * @param expected.catalog - Recipes from the verified capture.
 * @param expected.prerequisites - Selection and generator receipts.
 * @param expected.expectedPrerequisitesSha256 - Selection handoff identity.
 * @param expected.overlay - Generated workspace receipt.
 * @param expected.expectedOverlaySha256 - Workspace handoff identity.
 * @param expected.expectedSha256 - Resolution handoff identity.
 */
export const validateGeneratedLakeResolution = (document, { snapshot, modules, catalog, prerequisites, expectedPrerequisitesSha256, overlay, expectedOverlaySha256, expectedSha256 }) => {
	validateGeneratedLakeWorkspace(overlay, { snapshot, modules, catalog, prerequisites, expectedPrerequisitesSha256, expectedSha256: expectedOverlaySha256 });
	closed(document, ["schemaVersion", "kind", "snapshotSha256", "overlaySha256", "prerequisitesSha256", "resolverSha256", "leanCompilerSha256", "lakeLibrarySha256", "result"]);
	if(!digest(expectedSha256) || sha256(canonicalJson(document)) !== expectedSha256 || document.schemaVersion !== 1
		|| document.kind !== "lean-bridge-generated-lake-resolution" || document.snapshotSha256 !== snapshot.sha256
		|| document.overlaySha256 !== expectedOverlaySha256 || document.prerequisitesSha256 !== expectedPrerequisitesSha256) fail("Generated resolution differs from its authorized identity");
	for(const field of ["resolverSha256", "leanCompilerSha256", "lakeLibrarySha256"])
		if(document[field] !== prerequisites[field]) fail("Generated resolution tools differ from prerequisite selection");
	const result = document.result;
	if(!Array.isArray(result?.resolution?.modules)) fail("Generated resolution requires module records");
	const modulesWithoutSources = result.resolution.modules.map(module => {
		closed(module, ["module", "path", "package", "imports", "source", ...(Object.hasOwn(module, "nativeInputs") ? ["nativeInputs"] : [])]);
		const { source, nativeInputs, ...raw } = module;
		void source;
		if(nativeInputs !== undefined && !Array.isArray(nativeInputs)) fail("Generated native inputs must be an array");
		return { ...raw, ...(nativeInputs ? { nativeInputs: nativeInputs.map(input => {
			closed(input, ["package", "target", "path", "source"]);
			return { package: input.package, target: input.target, path: input.path };
		}) } : {}) };
	});
	const checked = checkResolution({ ...result, resolution: { ...result.resolution, modules: modulesWithoutSources } }, snapshot, modules, overlay, prerequisites);
	if(!same(checked, result)) fail("Resolved source origins differ from the captured and generated files");
	return true;
};

/**
 * Re-run Lake after generation, rejecting newly introduced prerequisite targets.
 * Returned staging owns its copied outputs, never the caller's prerequisite trees.
 *
 * @param options - Complete capture, completed generators and the same Lean compiler.
 * @param options.snapshot - Opaque original source capture.
 * @param options.modules - Selected root module names.
 * @param options.prerequisites - Completed prerequisite result.
 * @param options.expectedPrerequisitesSha256 - Selection identity from the build handoff.
 * @param options.leanPrefix - Selected Lean installation, without Elan.
 * @param options.signal - Optional cancellation signal.
 */
export const resolveGeneratedLakeWorkspace = async ({ snapshot, modules, prerequisites, expectedPrerequisitesSha256, leanPrefix, signal }) => {
	modules = Array.isArray(modules) ? [...modules].sort() : modules;
	const overlay = await prepareGeneratedLakeWorkspace({ snapshot, modules, prerequisites, expectedPrerequisitesSha256, signal });
	let working;
	try
	{
		working = await mkdtemp(join(tmpdir(), `lean-bridge-generated-resolution-${process.pid}-`));
		const prefix = await realpath(leanPrefix), lean = join(prefix, "bin/lean");
		const lake = join(prefix, "lib/lean", process.platform === "darwin" ? "libLake_shared.dylib" : process.platform === "win32" ? "libLake_shared.dll" : "libLake_shared.so");
		const toolFiles = [[resolverSource, "resolverSha256"], [lean, "leanCompilerSha256"], [lake, "lakeLibrarySha256"]];
		const compilers = overlay.prerequisites.generators.map(generator => generator.receipt.compiler);
		if(compilers.some(compiler => !same(compiler, compilers[0]))) fail("Generators used different compiler library closures");
		const verifyTools = async () => {
			for(const [path, field] of toolFiles)
				if(sha256(await readFile(path, { signal })) !== overlay.prerequisites[field]) fail("Generated resolution tool changed since prerequisite selection");
			if(compilers.length) await verifyLakeGeneratorCompiler({ leanPrefix: prefix, compiler: compilers[0], signal });
		};
		await verifyTools();
		const request = canonicalJson({ workspace: overlay.workspaceRoot
			, packages: snapshot.document.packages.map(({ name, directory, packageRoot, configFile, manifestFile }) => ({ name, directory, packageRoot, configFile, manifestFile }))
			, modules, files: [...sourceIdentities(snapshot, overlay.document).keys()]
			, generatorPhase: "generated"
			, generators: overlay.catalog.recipes.map(recipe => ({ packageRoot: recipe.packageRoot, name: recipe.recipe.name, module: recipe.recipe.module, outputs: recipe.outputs.map(output => output.path) })) });
		const requestPath = join(working, "request.json");
		await writeFile(requestPath, request, { flag: "wx", mode: 0o444, signal });
		const env = { PATH: `${join(prefix, "bin")}:${process.env.PATH}`
			, LEAN_SYSROOT: prefix, LANG: "C.UTF-8", LC_ALL: "C.UTF-8"
			, GIT_ALLOW_PROTOCOL: "", GIT_NO_LAZY_FETCH: "1"
			, LAKE_NO_CACHE: "1", LAKE_CACHE_DIR: "" };
		const response = await processBuildRunner.capture({ command: lean
			, args: ["--plugin", lake, "--run", resolverSource, requestPath]
			, cwd: overlay.workspaceRoot, env, signal, timeoutMs: 120000 });
		const result = checkResolution(JSON.parse(response.stdout), snapshot, modules, overlay.document, overlay.prerequisites);
		// Lean-configured dependencies can leave their own .lake directories too.
		// Only these known private caches are removed; verification rejects other extras.
		const packageRoots = ["root", ...snapshot.document.packages.map(pkg => [pkg.directory, pkg.packageRoot].filter(Boolean).join("/"))];
		for(const root of packageRoots)
			await rm(join(overlay.workspaceRoot, root, ".lake"), { recursive: true, force: true });
		await overlay.verify();
		const sourceRoot = join(working, "source"), sources = [];
		for(const module of result.resolution.modules)
		{
			const bytes = await readVerified(join(overlay.workspaceRoot, module.path), module.source, signal);
			const path = `${module.module.replaceAll(".", "/")}.lean`;
			await mkdir(dirname(join(sourceRoot, path)), { recursive: true });
			await writeFile(join(sourceRoot, path), bytes, { flag: "wx", mode: 0o444, signal });
			sources.push({ path, ...identity(bytes) });
		}
		const document = frozen({ schemaVersion: 1
			, kind: "lean-bridge-generated-lake-resolution"
			, snapshotSha256: snapshot.sha256, overlaySha256: overlay.sha256
			, prerequisitesSha256: expectedPrerequisitesSha256
			, ...Object.fromEntries(toolFiles.map(([, field]) => [field, overlay.prerequisites[field]])), result });
		const hash = sha256(canonicalJson(document));
		validateGeneratedLakeResolution(document, { snapshot, modules
			, catalog: overlay.catalog, prerequisites: overlay.prerequisites
			, expectedPrerequisitesSha256, overlay: overlay.document
			, expectedOverlaySha256: overlay.sha256, expectedSha256: hash });
		const verify = async () => {
			await overlay.verify();
			await verifyFiles(working, [{ path: "request.json", ...identity(request) }, ...sources.map(file => ({ ...file, path: `source/${file.path}` }))], signal);
			await verifyTools();
		};
		await verify();
		return Object.freeze({ sourceRoot, workspaceRoot: overlay.workspaceRoot
			, overlay: overlay.document, catalog: overlay.catalog
			, document, sha256: hash, verify
			, dispose: async () => { await rm(working, { recursive: true, force: true }); await overlay.dispose(); } });
	} catch(error)
	{
		if(working) await rm(working, { recursive: true, force: true });
		await overlay.dispose();
		throw error;
	}
};
