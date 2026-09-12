/**
 * Resolve captured Lake projects using the selected compiler in private staging.
 *
 * @file
 */
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { prepareLakeDependencySnapshot, validateLakeDependencySnapshotDocument, verifyLakeDependencySnapshot, writeLakeDependencySnapshot } from "./lake-dependency-snapshot.mjs";
import { processBuildRunner } from "./process-runner.mjs";

const resolverSource = fileURLToPath(new URL("ResolveLakeWorkspace.lean", import.meta.url));
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const name = value => typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_']*(?:\.[A-Za-z_][A-Za-z0-9_']*)*$(?![\s\S])/.test(value);
const closed = (value, keys, label) => {
	if(!value || typeof value !== "object" || Array.isArray(value) || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort()))
		fail("invalid-lake-resolution", `Invalid ${label} fields`);
};
const records = snapshot => new Map([
	...snapshot.document.rootInputs.map(file => [`root/${file.path}`, file])
	, ...snapshot.document.packages.flatMap(pkg => pkg.files.map(file => [`${pkg.directory}/${file.path}`, file]))
]);

/**
 * Capture a complete project whenever analysis includes an existing Lake lock.
 *
 * @param options - Project, analyzed root inputs and optional cancellation signal.
 * @param options.projectRoot - Read-only author project.
 * @param options.inputs - Expected root inputs from the selected build's analysis.
 * @param options.signal - Optional cancellation signal.
 */
export const captureLockedLakeProject = async ({ projectRoot, inputs, signal }) => {
	const lock = inputs.find(input => input.path === "lake-manifest.json");
	if(!lock) return null;
	const bytes = await readFile(join(projectRoot, lock.path));
	if(sha256(bytes) !== lock.sha256) fail("lake-source-drift", "Lake lock changed after source analysis");
	const snapshot = await prepareLakeDependencySnapshot({ projectRoot, signal, includeProject: true });
	const files = new Map(snapshot.document.rootInputs.map(input => [input.path, input]));
	for(const input of inputs)
		if(files.get(input.path)?.sha256 !== input.sha256 || files.get(input.path)?.bytes !== input.bytes)
			fail("lake-source-drift", "Root source changed after analysis or lies outside the captured inputs");
	return snapshot;
};

/**
 * Check Lake's module closure against independently verified source identities.
 * Generated-workspace callers supply an explicit capture/output identity map.
 *
 * @param value - Raw Lake resolution, without host annotations.
 * @param snapshot - Original complete source capture.
 * @param selected - Selected root module names.
 * @param files - Verified qualified paths and their source identities.
 */
export const validateLakeModuleClosure = (value, snapshot, selected, files = records(snapshot)) => {
	closed(value, ["schemaVersion", "resolver", "leanVersion", "leanCommit", "packages", "modules", "externalImports"], "Lake resolution");
	if(![1, 2].includes(value.schemaVersion) || value.resolver !== "lean-lake-locked" || typeof value.leanVersion !== "string"
		|| !/^[0-9a-f]{40}$/.test(value.leanCommit) || snapshot.document.toolchain !== `leanprover/lean4:v${value.leanVersion}`)
		fail("lake-toolchain-drift", "Lake resolver and captured project toolchains differ");
	if(!Array.isArray(value.packages) || value.packages.length !== snapshot.document.packages.length + 1)
		fail("invalid-lake-resolution", "Lake package set differs from the captured lock");
	const packages = new Map();
	for(const pkg of value.packages)
	{
		closed(pkg, ["name", "configFile", "dependencies"], "Lake package");
		if(typeof pkg.name !== "string" || packages.has(pkg.name) || !files.has(pkg.configFile)
			|| !Array.isArray(pkg.dependencies) || pkg.dependencies.some(dependency => typeof dependency !== "string"))
			fail("invalid-lake-resolution", "Invalid Lake package identity");
		packages.set(pkg.name, pkg);
	}
	for(const pkg of value.packages)
		if(pkg.dependencies.some(dependency => !packages.has(dependency))) fail("invalid-lake-resolution", "Lake package dependency is absent");
	for(const expected of snapshot.document.packages)
	{
		const configFile = [expected.directory, expected.packageRoot, expected.configFile].filter(Boolean).join("/");
		if(packages.get(expected.name)?.configFile !== configFile) fail("invalid-lake-resolution", "Lake loaded a different package configuration");
	}
	if(value.packages.filter(pkg => pkg.configFile.startsWith("root/")).length !== 1)
		fail("invalid-lake-resolution", "Lake root package identity is absent or ambiguous");
	const known = new Set();
	if(!Array.isArray(value.externalImports) || value.externalImports.some(item => !name(item)) || new Set(value.externalImports).size !== value.externalImports.length)
		fail("invalid-lake-resolution", "Invalid compiler-library imports");
	if(!Array.isArray(value.modules) || value.modules.length === 0) fail("invalid-lake-resolution", "Lake resolved no source modules");
	for(const module of value.modules)
	{
		closed(module, ["module", "path", "package", "imports", ...(value.schemaVersion === 2 && Object.hasOwn(module, "nativeInputs") ? ["nativeInputs"] : [])], "Lake module");
		if(!name(module.module) || known.has(module.module) || !files.has(module.path) || !module.path.endsWith(".lean") || !packages.has(module.package)
			|| !Array.isArray(module.imports) || module.imports.some(item => !known.has(item) && !value.externalImports.includes(item)))
			fail("invalid-lake-resolution", "Lake module ownership or dependency order is invalid");
		const owner = snapshot.document.packages.find(pkg => pkg.name === module.package);
		const prefix = owner ? owner.directory : "root";
		if(!module.path.startsWith(`${prefix}/`)) fail("invalid-lake-resolution", "Lake module source escaped its owning package");
		if(Object.hasOwn(module, "nativeInputs"))
		{
			if(!Array.isArray(module.nativeInputs) || !module.nativeInputs.length) fail("invalid-lake-resolution", "Native inputs must be non-empty when declared");
			for(const input of module.nativeInputs)
			{
				closed(input, ["package", "target", "path"], "Lake native input");
				const inputOwner = snapshot.document.packages.find(pkg => pkg.name === input.package);
				if(!packages.has(input.package) || typeof input.target !== "string" || !input.target.length || !files.has(input.path) || !input.path.endsWith(".c")
					|| !input.path.startsWith(`${inputOwner ? inputOwner.directory : "root"}/`)
					|| (input.package !== module.package && !packages.get(module.package).dependencies.includes(input.package)))
					fail("invalid-lake-resolution", "Native input is not a captured C source owned by a declared package");
			}
		}
		known.add(module.module);
	}
	if((value.schemaVersion === 2) !== value.modules.some(module => Object.hasOwn(module, "nativeInputs")))
		fail("invalid-lake-resolution", "Lake native input version disagrees with its declarations");
	if(selected.some(module => !value.modules.find(item => item.module === module)?.path.startsWith("root/")))
		fail("invalid-lake-resolution", "Lake omitted a selected root module");
	if(value.externalImports.some(module => known.has(module))) fail("invalid-lake-resolution", "Source and compiler-library module identities overlap");
	const external = new Set(value.modules.flatMap(module => module.imports).filter(module => !known.has(module)));
	if(canonicalJson([...external].sort()) !== canonicalJson([...value.externalImports].sort()))
		fail("invalid-lake-resolution", "Lake included compiler-library modules outside the selected import closure");
	const reachable = new Set();
	const visit = module => {
		if(reachable.has(module) || !known.has(module)) return;
		reachable.add(module);
		value.modules.find(item => item.module === module).imports.forEach(visit);
	};
	selected.forEach(visit);
	if(reachable.size !== known.size) fail("invalid-lake-resolution", "Lake included source modules outside the selected import closure");
	return { ...value, modules: value.modules.map(module => ({ ...module, source: files.get(module.path)
		, ...(module.nativeInputs ? { nativeInputs: module.nativeInputs.map(input => ({ ...input, source: files.get(input.path) })) } : {}) }))
	, externalImports: [...value.externalImports].sort() };
};

/**
 * Check recorded compiler resolution against its complete source snapshot.
 *
 * @param options - Captured metadata and selected root modules.
 * @param options.snapshot - Snapshot document and digest authorized by the build.
 * @param options.resolution - Recorded compiler resolution document.
 * @param options.modules - Selected root module names.
 */
export const validateLockedLakeResolution = ({ snapshot, resolution, modules }) => {
	validateLakeDependencySnapshotDocument(snapshot.document);
	if(snapshot.document.schemaVersion !== 2 || sha256(canonicalJson(snapshot.document)) !== snapshot.sha256)
		fail("invalid-lake-resolution", "Resolution requires a complete snapshot matching the authorized digest");
	const fields = ["schemaVersion", "resolver", "leanVersion", "leanCommit"
		, "packages", "modules", "externalImports", "snapshotSha256"
		, "resolverSha256", "leanCompilerSha256", "lakeLibrarySha256"];
	closed(resolution, fields, "recorded Lake resolution");
	const { snapshotSha256, resolverSha256, leanCompilerSha256, lakeLibrarySha256, ...raw } = resolution;
	if(snapshotSha256 !== snapshot.sha256 || [resolverSha256, leanCompilerSha256, lakeLibrarySha256].some(value => typeof value !== "string" || !/^[0-9a-f]{64}$(?![\s\S])/.test(value)))
		fail("invalid-lake-resolution", "Recorded resolution has invalid input identities");
	if(!Array.isArray(raw.modules)) fail("invalid-lake-resolution", "Recorded modules must be an array");
	const expected = validateLakeModuleClosure({ ...raw, modules: raw.modules.map(module => {
		closed(module, ["module", "path", "package", "imports", "source", ...(Object.hasOwn(module, "nativeInputs") ? ["nativeInputs"] : [])], "recorded Lake module");
		const native = module.nativeInputs;
		if(native !== undefined && !Array.isArray(native)) fail("invalid-lake-resolution", "Native inputs must be an array");
		return { module: module.module
			, path: module.path, package: module.package, imports: module.imports
			, ...(native ? { nativeInputs: native.map(input => {
				closed(input, ["package", "target", "path", "source"], "recorded native input");
				return { package: input.package, target: input.target, path: input.path };
			}) } : {}) };
	}) }, snapshot, modules);
	if(canonicalJson(expected) !== canonicalJson(raw)) fail("invalid-lake-resolution", "Recorded resolution source identities differ from the captured files");
	return true;
};

/**
 * Materialize a locked workspace, resolve imports through Lake, then compile from captured bytes.
 *
 * @param options - Immutable capture and selected compiler inputs.
 * @param options.snapshot - Complete capture returned by captureLockedLakeProject.
 * @param options.modules - Root package modules selected for compilation.
 * @param options.leanPrefix - Selected Lean installation, without an Elan download step.
 * @param options.signal - Optional cancellation signal.
 */
export const resolveLockedLakeWorkspace = async ({ snapshot, modules, leanPrefix, signal }) => {
	if(snapshot?.document.schemaVersion !== 2 || !Array.isArray(modules) || !modules.length || modules.some(module => !name(module)))
		fail("invalid-lake-resolution", "Lake resolution requires a complete capture and selected modules");
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-lake-workspace-"));
	try
	{
		const workspace = join(working, "workspace");
		await writeLakeDependencySnapshot({ snapshot, outputRoot: workspace, signal });
		for(const [path, input] of records(snapshot))
			await chmod(join(workspace, path), input.mode === 0o755 ? 0o555 : 0o444);
		const resolverSha256 = sha256(await readFile(resolverSource));
		const leanCompiler = join(leanPrefix, "bin/lean");
		const leanCompilerSha256 = sha256(await readFile(leanCompiler));
		const lakeLibrary = join(leanPrefix, "lib/lean", process.platform === "darwin" ? "libLake_shared.dylib" : process.platform === "win32" ? "libLake_shared.dll" : "libLake_shared.so");
		const lakeLibrarySha256 = sha256(await readFile(lakeLibrary));
		const request = { workspace
			, packages: snapshot.document.packages.map(({ name, directory, packageRoot, configFile, manifestFile }) => ({ name, directory, packageRoot, configFile, manifestFile }))
			, modules, files: [...records(snapshot).keys()]
			, generatorPhase: "none", generators: [] };
		await writeFile(join(working, "request.json"), canonicalJson(request));
		const env = { PATH: `${join(resolve(leanPrefix), "bin")}:${process.env.PATH}`
			, LEAN_SYSROOT: resolve(leanPrefix), LANG: "C.UTF-8", LC_ALL: "C.UTF-8"
			, GIT_ALLOW_PROTOCOL: "", GIT_NO_LAZY_FETCH: "1"
			, LAKE_NO_CACHE: "1", LAKE_CACHE_DIR: "" };
		const result = await processBuildRunner.capture({ command: leanCompiler
			, args: ["--plugin", lakeLibrary, "--run", resolverSource, join(working, "request.json")]
			, cwd: workspace, env, signal, timeoutMs: 120000 });
		const resolved = validateLakeModuleClosure(JSON.parse(result.stdout), snapshot, modules);
		if(sha256(await readFile(resolverSource)) !== resolverSha256) fail("lake-source-drift", "Lake resolver changed during resolution");
		if(sha256(await readFile(leanCompiler)) !== leanCompilerSha256) fail("lake-source-drift", "Lean compiler changed during resolution");
		if(sha256(await readFile(lakeLibrary)) !== lakeLibrarySha256) fail("lake-source-drift", "Lake compiler library changed during resolution");
		// Lake can cache its compiled configuration only inside this private tree.
		await rm(join(workspace, "root/.lake"), { recursive: true, force: true });
		await verifyLakeDependencySnapshot({ snapshot, snapshotRoot: workspace, signal });
		const sourceRoot = join(working, "source");
		for(const module of resolved.modules)
		{
			const bytes = await readFile(join(workspace, module.path));
			if(bytes.length !== module.source.bytes || sha256(bytes) !== module.source.sha256)
				fail("lake-source-drift", "Resolved module changed before compilation staging");
			const destination = join(sourceRoot, `${module.module.replaceAll(".", "/")}.lean`);
			await mkdir(dirname(destination), { recursive: true });
			await writeFile(destination, bytes, { mode: 0o444 });
		}
		const document = { ...resolved, snapshotSha256: snapshot.sha256
			, resolverSha256, leanCompilerSha256, lakeLibrarySha256 };
		return { sourceRoot, snapshotRoot: workspace, document
			, sha256: sha256(canonicalJson(document))
			, dispose: () => rm(working, { recursive: true, force: true }) };
	} catch(error)
	{
		await rm(working, { recursive: true, force: true });
		throw error;
	}
};
