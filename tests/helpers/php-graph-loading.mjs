/**
 * Multiple original Composer archives sharing one authenticated native runtime.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, realpath, rename, rm, statfs } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { saveLakeFile, lakeInputState } from "./lake-workspace.mjs";
import { brickMathRepository, validateBrickMathInstall } from "./brick-math.mjs";

const inventory = async root => Object.fromEntries(await Promise.all((await nativeArtifactPaths(root)).map(async path => {
	const bytes = await readFile(join(root, path)); return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
})));
const json = async path => JSON.parse(await readFile(path, "utf8"));
const prepare = async (root, specifications, diagnostic) => {
	const environment = { ...nativeFixtureEnvironment(["php-native"])
		, LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php"
		, LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer" };
	const packages = [], project = join(root, "project"), feed = join(project, "feed");
	await mkdir(feed, { recursive: true });
	for(const [index, specification] of specifications.entries())
	{
		const space = await statfs(root); assert.ok(Number(space.bavail) * Number(space.bsize) >= 1024 ** 3, "Small Composer composition builds require 1 GiB free");
		const { name, module, graph, value, targets, artifact = name } = specification;
		const author = join(root, "author"), projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(root, "handoff");
		const lean = `namespace ${module}
${graph ? `inductive V where
  | done (value : UInt32)
  | next (value : V)
structure Parcel where
  node : V
def echo (value : Parcel) : Parcel := value
` : ""}def value : UInt32 := ${value}
end ${module}
`;
		await saveLakeFile(projectRoot, `${module}.lean`, lean);
		await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(projectRoot, "lakefile.toml", `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "${module}"\n`);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: [module]
			, exports: [...graph ? [`${module}.echo`] : [], `${module}.value`]
			, targets: { "php-native": { name: `lean-bridge/${artifact}`, version: "1.0.0" } } }));
		const before = await lakeInputState(projectRoot); diagnostic(`loading: building ${artifact} (${targets.join(", ")})`);
		await buildCanonicalProject({ projectRoot, outputRoot, targets, environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const release = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		assert.deepEqual(release.packages.map(pkg => pkg.target).sort(), [...targets].sort());
		const pkg = release.packages.find(pkg => pkg.target === "php-native"), artifactFile = pkg.artifacts[0];
		const bytes = await readFile(join(handoff, artifactFile.path)); assert.equal(sha256(bytes), artifactFile.sha256);
		const archive = join(feed, `package${index}.zip`), inspection = join(project, `inspection${index}`);
		await saveLakeFile(feed, `package${index}.zip`, bytes);
		await runCopied("/usr/bin/unzip", ["-q", archive, "-d", inspection], root);
		const receipt = await json(join(inspection, "lean-bridge/package-receipt.json"));
		await verifyNativeFiles(inspection, receipt.files);
		const manifest = await json(join(inspection, "binding-manifest.json")), composer = await json(join(inspection, "composer.json"));
		const inspected = await inventory(inspection);
		packages.push({ ...specification, package: pkg, receipt, manifest, composer
			, inspected, sourceSha256: sha256(lean), authorInputsUnchanged: true
			, dist: { type: "zip", url: pathToFileURL(archive).href, shasum: createHash("sha1").update(bytes).digest("hex") } });
		await rm(inspection, { recursive: true, force: true });
		await rm(author, { recursive: true, force: true }); await rm(handoff, { recursive: true, force: true });
	}
	assert.equal(new Set(packages.map(item => item.package.runtimeIdentity)).size, 1);
	const php = await realpath(environment.LEAN_BRIDGE_PHP), composer = await realpath(environment.LEAN_BRIDGE_COMPOSER);
	const probe = JSON.parse((await runCopied(php, ["-n", "-r", "echo json_encode([PHP_VERSION, ini_get('extension_dir'), get_loaded_extensions()]);"], root)).stdout);
	const [phpVersion, extensionDirectory, builtins] = probe, extensions = {};
	const modules = ["ffi", "ctype", "iconv", "mbstring", "phar", "zip"];
	for(const name of modules.filter(name => !builtins.map(name => name.toLowerCase()).includes(name)))
	{
		const path = await realpath(join(extensionDirectory, `${name}.so`)); extensions[name] = { path, sha256: sha256(await readFile(path)) };
	}
	const flags = names => ["-n", ...names.filter(name => extensions[name]).flatMap(name => ["-d", "extension=" + extensions[name].path]), "-d", "ffi.enable=1", "-d", "memory_limit=256M"];
	const home = join(project, "home"), cache = join(project, "cache");
	await mkdir(home); await mkdir(cache); assert.deepEqual(await readdir(home), []); assert.deepEqual(await readdir(cache), []);
	const manifest = { name: "lean-bridge-tests/loading"
		, require: Object.fromEntries(packages.map(item => [item.package.name, item.package.version]))
		, repositories: [{ "packagist.org": false }, await brickMathRepository(feed)
			, ...packages.map(item => ({ type: "package", package: { ...item.composer, dist: item.dist } }))]
		, config: { "allow-plugins": false } };
	await saveLakeFile(project, "composer.json", canonicalJson(manifest));
	const installEnvironment = { ...copiedCleanEnvironment, COMPOSER_HOME: home
		, COMPOSER_CACHE_DIR: cache, COMPOSER_ALLOW_SUPERUSER: "1"
		, COMPOSER_DISABLE_NETWORK: "1", COMPOSER_NO_INTERACTION: "1"
		, COMPOSER: join(project, "composer.json") };
	const args = [...flags(modules), composer, "--no-plugins", "--no-scripts", "--no-interaction", "install", "--prefer-dist", "--no-progress", "--no-dev"];
	await runCopied(php, args, project, installEnvironment);
	const lock = await json(join(project, "composer.lock")), installed = await json(join(project, "vendor/composer/installed.json"));
	assert.equal(lock.packages.length, packages.length + 1); assert.equal(installed.packages.length, packages.length + 1);
	assert.deepEqual(lock["packages-dev"], []);
	for(const entry of packages)
	{
		for(const selected of [lock.packages, installed.packages].map(list => list.find(pkg => pkg.name === entry.package.name)))
		{ assert.equal(selected.version, entry.package.version); assert.deepEqual(selected.dist, entry.dist); }
		assert.deepEqual(await inventory(join(project, "vendor", entry.package.name)), entry.inspected);
	}
	const before = await inventory(join(project, "vendor")), lockHash = sha256(await readFile(join(project, "composer.lock")));
	await runCopied(php, args, project, installEnvironment);
	assert.deepEqual(await inventory(join(project, "vendor")), before); assert.equal(sha256(await readFile(join(project, "composer.lock"))), lockHash);
	const deployment = join(root, "relocated"); await mkdir(deployment);
	await rename(join(project, "vendor"), join(deployment, "vendor"));
	await rm(project, { recursive: true, force: true });
	assert.deepEqual(await readdir(root), ["relocated"]);
	const request = packages.map(entry => {
		if(!entry.graph) return { name: entry.package.name, value: entry.value, namespace: entry.receipt.namespace };
		const evidence = entry.manifest.nativeEvidence;
		return { name: entry.package.name, value: entry.value
			, namespace: entry.receipt.namespace
			, evidence: { ...evidence, identity: sha256(canonicalJson(evidence))
				, loadOrder: ["libleanshared.so", "liblean_bridge_native.so", ...Object.keys(evidence.libraries).filter(name => ![evidence.library, "libleanshared.so", "liblean_bridge_native.so"].includes(name)), evidence.library] } };
	});
	await saveLakeFile(deployment, "request.json", canonicalJson(request));
	const files = await inventory(deployment); validateBrickMathInstall({ manifest, lock, installed }, files);
	return { root, deployment, php, runtimeOptions: flags(["ffi"])
		, packages, request
		, installation: { manifest, lock, installed, phpVersion
			, phpSha256: sha256(await readFile(php))
			, composerSha256: sha256(await readFile(composer))
			, extensions, lockSha256: lockHash
			, offline: true, emptyHome: true, emptyCache: true, repeatInstall: true
			, sourceFreeExecution: true, compilerFreeExecution: true
			, handoffRemoved: true } };
};

const execute = async (prepared, file, scenarios) => {
	const source = await readFile(`tests/fixtures/structured-types/${file}`, "utf8");
	await saveLakeFile(prepared.deployment, "caller.php", source);
	const deployment = await inventory(prepared.deployment), observations = [];
	for(const args of scenarios)
	{
		const invoke = async () => {
			const result = await runCopied(prepared.php, [...prepared.runtimeOptions, "caller.php", ...args], prepared.deployment);
			assert.equal(result.stderr, ""); assert.deepEqual(await inventory(prepared.deployment), deployment);
			return JSON.parse(result.stdout);
		};
		const observed = await invoke(); assert.deepEqual(await invoke(), observed);
		observations.push({ args, observed, repeatExecution: true, unchangedDeployment: true });
	}
	return { sourceSha256: sha256(source), deployment, observations };
};

/**
 * Two recursive packages and one ordinary package share initialization and retirement.
 *
 * @param root - Test-owned scratch root.
 * @param diagnostic - Progress callback.
 */
export const checkPhpGraphComposition = async (root, diagnostic = () => {}) => {
	const prepared = await prepare(root, [
		{ name: "cedar", module: "Cedar", graph: true, value: 41, targets: ["php-native"] }
		, { name: "maple", module: "Maple", graph: true, value: 43, targets: ["cpp", "php-native"] }
		, { name: "stone", module: "Stone", graph: false, value: 47, targets: ["php-native"] }
	], diagnostic);
	const result = await execute(prepared, "recursive-php-composition.php", [["graph-first"], ["peer-first"]]);
	for(const run of result.observations)
	{ assert.equal(run.observed.runtimeInitializations, 1); assert.equal(run.observed.componentInitializations, 3); assert.equal(run.observed.forkRejected, true); assert.equal(run.observed.sharedRetirement, true); }
	return { schemaVersion: 1, packages: prepared.packages, installation: prepared.installation, ...result };
};

/**
 * Exact duplicates reuse mappings; conflicting builds reject before native loading.
 *
 * @param root - Test-owned scratch root.
 * @param diagnostic - Progress callback.
 */
export const checkPhpGraphConflicts = async (root, diagnostic = () => {}) => {
	const prepared = await prepare(root, [41, 43].map(value => ({ name: "collision"
		, module: "Collision", graph: true, value, targets: ["php-native"]
		, artifact: `collision-${value}` })), diagnostic);
	assert.equal(prepared.packages[0].receipt.component.id, prepared.packages[1].receipt.component.id);
	const result = await execute(prepared, "recursive-php-conflicts.php", ["duplicate", "conflict"].flatMap(mode => [0, 1].map(first => [mode, String(first)])));
	for(const run of result.observations)
	{ assert.equal(run.observed.mappingUnchanged, true); assert.equal(run.observed.originalUsable, true); }
	return { schemaVersion: 1, packages: prepared.packages, installation: prepared.installation, ...result };
};
