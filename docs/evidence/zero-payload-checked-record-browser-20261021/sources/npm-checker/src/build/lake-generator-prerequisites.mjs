/**
 * Select declared Lake generators from captured configuration and run pure tools.
 *
 * @file
 */
import { chmod, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { readExportConfiguration } from "../analyze/export-configuration.mjs";
import { validateLakeDependencySnapshotDocument, verifyLakeDependencySnapshot, writeLakeDependencySnapshot } from "./lake-dependency-snapshot.mjs";
import { runLakeGenerator, validateLakeGeneratorDefinition, validateLakeGeneratorReceipt } from "./lake-generators.mjs";
import { processBuildRunner } from "./process-runner.mjs";

const resolverSource = fileURLToPath(new URL("ResolveLakeWorkspace.lean", import.meta.url));
const fail = (message, code = "invalid-lake-generator-selection") => { throw Object.assign(new Error(message), { code }); };
const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const name = value => typeof value === "string" && value.length <= 256 && /^[A-Za-z_][A-Za-z0-9_']*(?:\.[A-Za-z_][A-Za-z0-9_']*)*$(?![\s\S])/.test(value);
const frozen = value => {
	if(value && typeof value === "object")
	{ Object.values(value).forEach(frozen); Object.freeze(value); }
	return value;
};
const closed = (value, fields) => {
	if(!value || typeof value !== "object" || Array.isArray(value) || !same(Object.keys(value).sort(), [...fields].sort())) fail("Lake generator selection fields must be closed");
};
const filesFor = snapshot => new Map([
	...snapshot.document.rootInputs.map(file => [`root/${file.path}`, file])
	, ...snapshot.document.packages.flatMap(pkg => pkg.files.map(file => [`${pkg.directory}/${file.path}`, file]))
]);
const packagesFor = snapshot => [
	{ name: null, root: "root", directory: "root" }
	, ...snapshot.document.packages.map(pkg => ({ name: pkg.name, root: [pkg.directory, pkg.packageRoot].filter(Boolean).join("/"), directory: pkg.directory }))
];
const identity = async path => sha256(await readFile(path));
const hash = value => typeof value === "string" && /^[0-9a-f]{64}$(?![\s\S])/.test(value);

/**
 * Read recipes from a verified private capture, including dependency packages.
 *
 * @param options - Original source identity and its private materialization.
 * @param options.snapshot - Prepared complete Lake snapshot.
 * @param options.snapshotRoot - Private copy of the exact capture.
 * @param options.signal - Optional cancellation signal.
 */
export const readLakeGeneratorRecipes = async ({ snapshot, snapshotRoot, signal }) => {
	await verifyLakeDependencySnapshot({ snapshot, snapshotRoot, signal });
	const files = filesFor(snapshot), recipes = [], configurations = [];
	for(const pkg of packagesFor(snapshot))
	{
		const configuration = await readExportConfiguration(join(snapshotRoot, pkg.root), { signal });
		if(!configuration.configuration.generators?.length) continue;
		const path = `${pkg.root}/${configuration.path}`, source = files.get(path);
		if(!source || source.sha256 !== configuration.sourceSha256) fail("Generator configuration differs from the source capture");
		configurations.push({ path, source });
		for(const recipe of configuration.configuration.generators)
		{
			const entry = { key: `${pkg.root}/${recipe.name}`
				, packageRoot: pkg.root, configuration: path, recipe
				, inputs: recipe.inputs.map(input => ({ ...input, path: `${pkg.root}/${input.path}` }))
				, outputs: recipe.outputs.map(output => ({ ...output, path: `${pkg.root}/${output.path}` })) };
			for(const input of entry.inputs)
				if(!files.has(input.path)) fail(`Generator input is not captured: ${input.path}`);
			for(const output of entry.outputs)
				if([...files.keys()].some(path => path === output.path || path.startsWith(`${output.path}/`) || output.path.startsWith(`${path}/`))) fail("Generator output collides with a captured source");
			recipes.push(entry);
		}
	}
	if(recipes.length > 128) fail("A Lake workspace supports at most 128 declared generators");
	const outputs = recipes.flatMap(recipe => recipe.outputs.map(output => output.path));
	if(new Set(outputs).size !== outputs.length || outputs.some(path => outputs.some(other => other.startsWith(`${path}/`)))) fail("Generator outputs overlap across packages");
	return frozen({ configurations, recipes });
};

/**
 * Validate Lake-selected tool closures and produce exact internal runner recipes.
 *
 * @param options - Independently captured source/recipes and compiler selection.
 * @param options.snapshot - Complete expected source capture.
 * @param options.recipes - Package-relative author intent bound to that capture.
 * @param options.selection - Fresh Lean/Lake prerequisite selection.
 */
export const validateLakeGeneratorSelection = ({ snapshot, recipes, selection }) => {
	validateLakeDependencySnapshotDocument(snapshot.document);
	if(![2, 3].includes(snapshot.document.schemaVersion) || sha256(canonicalJson(snapshot.document)) !== snapshot.sha256) fail("Generator selection requires a complete authenticated snapshot");
	closed(selection, ["schemaVersion", "resolver", "leanVersion", "leanCommit", "packages", "generators"]);
	if(selection.schemaVersion !== 1 || selection.resolver !== "lean-lake-generator-selection" || snapshot.document.toolchain !== `leanprover/lean4:v${selection.leanVersion}`
		|| typeof selection.leanCommit !== "string" || !/^[0-9a-f]{40}$(?![\s\S])/.test(selection.leanCommit)) fail("Generator selection compiler differs from the captured toolchain");
	const files = filesFor(snapshot), packages = new Map();
	if(!Array.isArray(selection.packages) || selection.packages.length !== snapshot.document.packages.length + 1) fail("Generator selection package set differs from the capture");
	for(const pkg of selection.packages)
	{
		closed(pkg, ["name", "configFile", "dependencies"]);
		if(typeof pkg.name !== "string" || !pkg.name.length || packages.has(pkg.name) || !files.has(pkg.configFile)
			|| !Array.isArray(pkg.dependencies) || pkg.dependencies.some(value => typeof value !== "string") || new Set(pkg.dependencies).size !== pkg.dependencies.length) fail("Invalid selected package identity");
		packages.set(pkg.name, pkg);
	}
	const roots = selection.packages.filter(pkg => pkg.configFile.startsWith("root/"));
	if(roots.length !== 1 || !["root/lakefile.lean", "root/lakefile.toml"].includes(roots[0].configFile)) fail("Selected root package is absent or ambiguous");
	for(const pkg of snapshot.document.packages)
		if(packages.get(pkg.name)?.configFile !== [pkg.directory, pkg.packageRoot, pkg.configFile].filter(Boolean).join("/")) fail("Selected dependency configuration differs from the capture");
	if(selection.packages.some(pkg => pkg.dependencies.some(name => !packages.has(name)))) fail("Selected package dependency is absent");
	if(!Array.isArray(selection.generators) || selection.generators.length > recipes.length) fail("Invalid selected generator count");
	const selected = new Set(), definitions = [];
	for(const generator of selection.generators)
	{
		closed(generator, ["key", "package", "module", "modules", "externalImports"]);
		const recipe = recipes.find(recipe => recipe.key === generator.key);
		const owner = recipe && packagesFor(snapshot).find(pkg => pkg.root === recipe.packageRoot);
		if(!owner || selected.has(generator.key) || generator.package !== (owner.name ?? roots[0].name) || generator.module !== recipe.recipe.module) fail("Selected generator differs from the captured recipe or owner");
		selected.add(generator.key);
		if(!Array.isArray(generator.externalImports) || generator.externalImports.some(value => !name(value)) || new Set(generator.externalImports).size !== generator.externalImports.length) fail("Invalid generator compiler-library imports");
		if(!Array.isArray(generator.modules) || !generator.modules.length || generator.modules.length > 128) fail("Invalid generator tool module count");
		const known = new Map();
		for(const module of generator.modules)
		{
			closed(module, ["module", "path", "package", "imports"]);
			const pkg = packagesFor(snapshot).find(pkg => (pkg.name ?? roots[0].name) === module.package);
			if(!name(module.module) || known.has(module.module) || generator.externalImports.includes(module.module) || !pkg || !files.has(module.path) || !module.path.endsWith(".lean")
				|| !module.path.startsWith(`${pkg.directory}/`) || !Array.isArray(module.imports) || module.imports.some(value => !known.has(value) && !generator.externalImports.includes(value))) fail("Generator tool ownership or dependency order is invalid");
			known.set(module.module, module);
		}
		if(known.get(generator.module)?.package !== generator.package) fail("Generator entry module is absent or belongs to another package");
		const imports = new Set(generator.modules.flatMap(module => module.imports).filter(name => !known.has(name)));
		if(!same([...imports].sort(), [...generator.externalImports].sort())) fail("Generator compiler-library closure contains unrelated imports");
		const reachable = new Set();
		const visit = name => {
			if(reachable.has(name) || !known.has(name)) return;
			reachable.add(name); known.get(name).imports.forEach(visit);
		};
		visit(generator.module);
		if(reachable.size !== known.size) fail("Generator tool closure contains unrelated modules");
		const definition = { schemaVersion: 1
			, profile: recipe.recipe.profile, name: recipe.recipe.name
			, declaration: recipe.recipe.declaration
			, modules: generator.modules.map(({ module, path }) => ({ module, path }))
			, inputs: recipe.inputs, arguments: recipe.recipe.arguments
			, outputs: recipe.outputs };
		validateLakeGeneratorDefinition(definition, snapshot);
		definitions.push({ key: generator.key, definition });
	}
	if(!same([...selected], [...selected].sort())) fail("Generator selection order must be canonical");
	return frozen(definitions);
};

/**
 * Check an externally identified selection receipt against captured author intent.
 * This validates evidence, not filesystem bytes or Lake semantics a second time.
 *
 * @param document - Recorded selection and per-generator receipts.
 * @param expected - Independently retained build inputs and receipt digest.
 * @param expected.snapshot - Expected complete source capture.
 * @param expected.modules - Authorized root module selection.
 * @param expected.catalog - Recipes read from that verified capture.
 * @param expected.expectedSha256 - Digest from the producing build handoff.
 */
export const validateLakeGeneratorPrerequisiteReceipt = (document, { snapshot, modules, catalog, expectedSha256 }) => {
	closed(document, ["schemaVersion", "kind", "snapshotSha256", "requestedModules", "configurations", "resolverSha256", "leanCompilerSha256", "lakeLibrarySha256", "selection", "generators"]);
	if(!Array.isArray(modules) || !modules.length || modules.length > 128 || modules.some(module => !name(module)) || new Set(modules).size !== modules.length) fail("Generator receipt requires unique root module names");
	if(!hash(expectedSha256) || sha256(canonicalJson(document)) !== expectedSha256) fail("Generator prerequisite receipt differs from its expected identity");
	if(document.schemaVersion !== 1 || document.kind !== "lean-bridge-lake-generator-prerequisites" || document.snapshotSha256 !== snapshot.sha256
		|| !same(document.requestedModules, [...modules].sort()) || !same(document.configurations, catalog.configurations)
		|| !hash(document.resolverSha256) || !hash(document.leanCompilerSha256) || !hash(document.lakeLibrarySha256)) fail("Generator prerequisite receipt differs from its captured inputs");
	const definitions = validateLakeGeneratorSelection({ snapshot, recipes: catalog.recipes, selection: document.selection });
	if(!Array.isArray(document.generators) || document.generators.length !== definitions.length) fail("Generator prerequisite receipts differ from the selected targets");
	for(const [index, generator] of document.generators.entries())
	{
		closed(generator, ["key", "receipt", "sha256"]);
		if(generator.key !== definitions[index].key || generator.sha256 !== sha256(canonicalJson(generator.receipt))) fail("Generator prerequisite output receipt changed");
		validateLakeGeneratorReceipt(generator.receipt, { snapshot, definition: definitions[index].definition });
		if(generator.receipt.compiler.sha256 !== document.leanCompilerSha256) fail("Generator selection and execution compilers differ");
	}
	return true;
};

/**
 * Resolve Lake needs from captured configuration and execute only selected tools.
 * Returned outputs retain separate generator receipts and owned staging lifetimes.
 *
 * @param options - Source capture, selected root modules and compiler installation.
 * @param options.snapshot - Opaque authenticated version-2 source capture.
 * @param options.modules - Selected root module names.
 * @param options.leanPrefix - Explicit compiler installation, without Elan.
 * @param options.signal - Optional cancellation signal.
 */
export const prepareLakeGeneratorPrerequisites = async ({ snapshot, modules, leanPrefix, signal }) => {
	if(!Array.isArray(modules) || !modules.length || modules.length > 128 || modules.some(module => !name(module)) || new Set(modules).size !== modules.length) fail("Generator selection requires unique root module names");
	modules = [...modules].sort();
	const prefix = await realpath(leanPrefix), working = await mkdtemp(join(tmpdir(), "lean-bridge-prerequisites-")), results = [];
	const dispose = async () => { await Promise.all(results.map(result => result.dispose())); await rm(working, { recursive: true, force: true }); };
	try
	{
		const workspace = join(working, "workspace");
		await writeLakeDependencySnapshot({ snapshot, outputRoot: workspace, signal });
		for(const [path, file] of filesFor(snapshot)) await chmod(join(workspace, path), file.mode === 0o755 ? 0o555 : 0o444);
		const catalog = await readLakeGeneratorRecipes({ snapshot, snapshotRoot: workspace, signal });
		const { configurations, recipes } = catalog;
		const lean = join(prefix, "bin/lean"), lake = join(prefix, "lib/lean", process.platform === "darwin" ? "libLake_shared.dylib" : process.platform === "win32" ? "libLake_shared.dll" : "libLake_shared.so");
		const identities = { resolverSha256: await identity(resolverSource), leanCompilerSha256: await identity(lean), lakeLibrarySha256: await identity(lake) };
		const request = canonicalJson({ workspace
			, packages: snapshot.document.packages.map(({ name, directory, packageRoot, configFile, manifestFile }) => ({ name, directory, packageRoot, configFile, manifestFile }))
			, modules, files: [...filesFor(snapshot).keys()], generatorPhase: "plan"
			, generators: recipes.map(recipe => ({ packageRoot: recipe.packageRoot, name: recipe.recipe.name, module: recipe.recipe.module, outputs: recipe.outputs.map(output => output.path) })) });
		const requestPath = join(working, "request.json");
		await writeFile(requestPath, request, { flag: "wx", mode: 0o444 });
		const env = { PATH: `${join(prefix, "bin")}:${process.env.PATH}`
			, LEAN_SYSROOT: prefix, LANG: "C.UTF-8", LC_ALL: "C.UTF-8"
			, GIT_ALLOW_PROTOCOL: "", GIT_NO_LAZY_FETCH: "1"
			, LAKE_NO_CACHE: "1", LAKE_CACHE_DIR: "" };
		const result = await processBuildRunner.capture({ command: lean, args: ["--plugin", lake, "--run", resolverSource, requestPath], cwd: workspace, env, signal, timeoutMs: 120000 });
		const selection = JSON.parse(result.stdout);
		const definitions = validateLakeGeneratorSelection({ snapshot, recipes, selection });
		await rm(join(workspace, "root/.lake"), { recursive: true, force: true });
		await verifyLakeDependencySnapshot({ snapshot, snapshotRoot: workspace, signal });
		for(const { key, definition } of definitions)
		{
			const generated = await runLakeGenerator({ snapshot, definition, leanPrefix: prefix, signal });
			results.push(Object.freeze({ key, ...generated }));
		}
		const verify = async () => {
			await verifyLakeDependencySnapshot({ snapshot, snapshotRoot: workspace, signal });
			if(await readFile(requestPath, "utf8") !== request || !same(identities, { resolverSha256: await identity(resolverSource), leanCompilerSha256: await identity(lean), lakeLibrarySha256: await identity(lake) })) fail("Generator selection inputs or compiler changed", "lake-generator-selection-drift");
			for(const result of results) await result.verify();
		};
		await verify();
		const document = frozen({ schemaVersion: 1
			, kind: "lean-bridge-lake-generator-prerequisites"
			, snapshotSha256: snapshot.sha256
			, requestedModules: modules, configurations, ...identities, selection
			, generators: results.map(result => ({ key: result.key, receipt: result.document, sha256: result.sha256 })) });
		const digest = sha256(canonicalJson(document));
		validateLakeGeneratorPrerequisiteReceipt(document, { snapshot, modules, catalog, expectedSha256: digest });
		return Object.freeze({ document, sha256: digest, results: Object.freeze(results), verify, dispose });
	} catch(error)
	{ await dispose(); throw error; }
};
