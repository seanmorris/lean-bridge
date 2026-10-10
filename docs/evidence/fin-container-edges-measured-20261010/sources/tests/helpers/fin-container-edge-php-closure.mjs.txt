/**
 * Authenticate Composer payloads before loading PHP and keep generated autoload inputs closed.
 * The explicitly selected PHP/Composer distributions remain trusted host tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { brickMathSources } from "../../src/backends/php/brick-math.mjs";
import { brickMathRepository } from "./brick-math.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { readClosedPackageZip } from "./closed-package-zip.mjs";
import { verifyFinContainerEdgeFileClosure } from "./fin-container-edge-closure.mjs";

const receiptPath = "lean-bridge/package-receipt.json";
const identity = data => ({ bytes: Buffer.byteLength(data), sha256: sha256(data) });
const immutable = files => Object.freeze(Object.fromEntries(Object.entries(files).map(([path, value]) => [path, Object.freeze(value)])));
const generatedNames = ["ClassLoader.php", "InstalledVersions.php", "LICENSE", "autoload_classmap.php", "autoload_files.php", "autoload_namespaces.php", "autoload_psr4.php", "autoload_real.php", "autoload_static.php", "installed.json", "installed.php", "platform_check.php"];
const installEnvironment = root => ({ ...copiedCleanEnvironment, PATH: "/usr/bin:/bin"
	, COMPOSER_HOME: join(root, "composer-home")
	, COMPOSER_CACHE_DIR: join(root, "composer-cache")
	, COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_DISABLE_NETWORK: "1"
	, COMPOSER_NO_INTERACTION: "1"
	, COMPOSER: join(root, "composer.json"), PHP_INI_SCAN_DIR: "" });

const verifyFiles = async (root, files, exact = false) => {
	assert.equal(await realpath(root), resolve(root), "PHP directory must not traverse a symlink");
	if(exact) assert.deepEqual(await nativeArtifactPaths(root), Object.keys(files).sort(), "unrecorded or missing PHP file");
	for(const [path, expected] of Object.entries(files))
	{
		assert.equal(await realpath(join(root, path)), join(resolve(root), path), `PHP input must not traverse a symlink: ${path}`);
		assert.deepEqual(identity(await readFile(join(root, path))), expected, `PHP file drift: ${path}`);
	}
};

/**
 * Authenticate every original member before Composer reads package metadata.
 *
 * @param bytes - Original ZIP bytes.
 * @param archiveSha256 - Package-set digest.
 */
export const inspectFinContainerEdgePhpArchive = (bytes, archiveSha256) => {
	assert.match(archiveSha256, /^[a-f0-9]{64}$/u);
	assert.equal(sha256(bytes), archiveSha256, "original PHP archive drift");
	const members = readClosedPackageZip(bytes), receiptBytes = members.get(receiptPath)?.toString("utf8");
	assert.equal(typeof receiptBytes, "string", "PHP receipt missing");
	const receipt = JSON.parse(receiptBytes);
	assert.equal(canonicalJson(receipt), receiptBytes); assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.kind, "lean-bridge-ordinary-php-package"); assert.equal(receipt.ecosystem, "composer");
	assert.match(receipt.name, /^[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*$/u);
	assert.match(receipt.version, /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u);
	assert.deepEqual([...members.keys()].sort(), [...Object.keys(receipt.files), receiptPath].sort(), "unrecorded or missing PHP archive file");
	for(const [path, expected] of Object.entries(receipt.files)) assert.deepEqual(identity(members.get(path)), expected, `PHP archive member drift: ${path}`);
	const metadata = JSON.parse(members.get("composer.json"));
	assert.equal(metadata.name, receipt.name); assert.equal(metadata.version, receipt.version); assert.equal(metadata.type, "library");
	assert.deepEqual(metadata.require, { php: ">=8.2 <9", "ext-ffi": "*", "brick/math": "1.0.0" });
	assert.deepEqual(metadata.autoload, { files: ["src/Api.php"] }); assert.ok(members.has("src/Api.php"));
	for(const field of ["scripts", "repositories", "autoload-dev", "config", "bin", "target-dir", "include-path", "replace", "provide", "conflict"])
		assert.ok(!Object.hasOwn(metadata, field), `unexpected Composer discovery input: ${field}`);
	return { members, receipt, receiptBytes, metadata
		, packageFileSetSha256: sha256(canonicalJson([...members.keys()].sort())) };
};

const verifyTools = async context => {
	for(const [path, expected] of Object.entries(context.tools))
	{
		assert.equal(await realpath(path), path, "PHP/Composer tool target drift");
		assert.deepEqual(identity(await readFile(path)), expected, "PHP/Composer tool drift");
	}
};
const verifyPayloads = async context => {
	await verifyTools(context);
	await verifyFiles(context.root, context.inputs);
	await verifyFiles(join(context.root, "feed"), context.feedFiles, true);
	const closure = await verifyFinContainerEdgeFileClosure({ installed: join(context.root, "vendor", context.name), receiptPath, receiptBytes: context.receiptBytes });
	assert.equal(closure.packageFileSetSha256, context.packageFileSetSha256);
	await verifyFiles(join(context.root, "vendor/brick/math"), context.dependencyFiles, true);
	return closure;
};

/**
 * Verify every file the public Composer autoloader can discover before starting PHP.
 *
 * @param context - Original package/dependency files and trusted Composer-generated outputs.
 */
export const verifyFinContainerEdgePhpEnvironment = async context => {
	const closure = await verifyPayloads(context);
	await verifyFiles(context.root, context.generatedFiles);
	await verifyFiles(join(context.root, "vendor"), context.vendorFiles, true);
	return { ...closure, dependencyFilesSha256: sha256(canonicalJson(context.dependencyFiles))
		, generatedFilesSha256: sha256(canonicalJson(context.generatedFiles))
		, vendorFilesSha256: sha256(canonicalJson(context.vendorFiles))
		, toolsSha256: sha256(canonicalJson(context.tools)) };
};

/**
 * Execute either original caller strictness mode and verify inputs even after a failure.
 *
 * @param context - Authenticated installation, with the current root after relocation.
 * @param mode - Weak or strict original caller.
 */
export const runFinContainerEdgePhp = async (context, mode = "weak") => {
	assert.ok(["weak", "strict"].includes(mode));
	await verifyFinContainerEdgePhpEnvironment(context);
	try
	{
		return await runCopied(context.command, [...context.runtimeFlags, mode === "strict" ? "strict.php" : "consumer.php"], context.root, copiedCleanEnvironment);
	}
	finally
	{ await verifyFinContainerEdgePhpEnvironment(context); }
};

/**
 * Install from authenticated local distributions with plugins, scripts and ambient ini disabled.
 * Payload identities always come from the original archives, never the installed baseline.
 *
 * @param options - Fresh root and selected original package/tools.
 * @param options.root - Directory containing only consumer.php.
 * @param options.archive - Original package-set ZIP.
 * @param options.archiveSha256 - Original archive digest.
 * @param options.command - Selected trusted PHP executable.
 * @param options.composer - Selected trusted Composer executable or PHAR.
 */
export const installFinContainerEdgePhp = async ({ root, archive, archiveSha256, command: selected, composer: selectedComposer }) => {
	assert.equal(await realpath(root), resolve(root));
	assert.deepEqual(await nativeArtifactPaths(root), ["consumer.php"], "fresh PHP consumer directory required");
	const bytes = await readFile(archive), original = inspectFinContainerEdgePhpArchive(bytes, archiveSha256);
	const command = await realpath(selected), composer = await realpath(selectedComposer);
	const host = JSON.parse((await runCopied(command, ["-n", "-r", 'echo json_encode(["directory"=>ini_get("extension_dir"),"modules"=>get_loaded_extensions()]);'], root)).stdout);
	const tools = { [command]: identity(await readFile(command)), [composer]: identity(await readFile(composer)) };
	const extensions = {};
	for(const name of ["ctype", "ffi", "iconv", "mbstring", "phar", "tokenizer"])
	{
		if(host.modules.some(module => module.toLowerCase() === name)) continue;
		const path = await realpath(join(host.directory, `${name}.so`)); extensions[name] = path; tools[path] = identity(await readFile(path));
	}
	const composerFlags = ["-n", ...Object.values(extensions).flatMap(path => ["-d", `extension=${path}`])];
	const runtimeFlags = ["-n", ...(extensions.ffi ? ["-d", `extension=${extensions.ffi}`] : []), "-d", "ffi.enable=1"];
	const feed = join(root, "feed"), dependency = await brickMathRepository(feed);
	await writeFile(join(feed, "component.zip"), bytes, { flag: "wx" });
	const component = { type: "package", package: { ...original.metadata, dist: { type: "zip", url: pathToFileURL(join(feed, "component.zip")).href } } };
	const source = await readFile(join(root, "consumer.php"), "utf8");
	assert.ok(source.includes("declare(strict_types=0);"), "original weak PHP caller required");
	const contents = { "consumer.php": source
		, "strict.php": source.replace("declare(strict_types=0);", "declare(strict_types=1);")
		, "composer.json": canonicalJson({ name: "copied-check/consumer"
			, require: { [original.receipt.name]: original.receipt.version }
			, repositories: [{ "packagist.org": false }, dependency, component]
			, config: { "allow-plugins": false } }) };
	for(const [path, data] of Object.entries(contents)) if(path !== "consumer.php") await writeFile(join(root, path), data, { flag: "wx" });
	const feedFiles = Object.fromEntries(await Promise.all((await nativeArtifactPaths(feed)).map(async path => [path, identity(await readFile(join(feed, path)))])));
	const dependencyFiles = immutable(Object.fromEntries(Object.entries(brickMathSources()).map(([path, data]) => [path, identity(data)])));
	const context = { root, command, composer
		, runtimeFlags: Object.freeze(runtimeFlags), tools: immutable(tools)
		, name: original.receipt.name, receiptBytes: original.receiptBytes
		, packageFileSetSha256: original.packageFileSetSha256
		, inputs: immutable(Object.fromEntries(Object.entries(contents).map(([path, data]) => [path, identity(data)])))
		, feedFiles: immutable(feedFiles), dependencyFiles };
	await verifyTools(context); await verifyFiles(root, context.inputs); await verifyFiles(feed, context.feedFiles, true);
	const invoke = args => runCopied(command, [...composerFlags, composer, "--no-plugins", "--no-scripts", "--no-interaction", ...args], root, installEnvironment(root));
	await invoke(["install", "--prefer-dist", "--no-dev", "--no-progress", "--no-autoloader"]);
	await verifyPayloads(context);
	assert.deepEqual(await nativeArtifactPaths(join(root, "vendor/composer")), ["InstalledVersions.php", "installed.json", "installed.php"]);
	const lock = JSON.parse(await readFile(join(root, "composer.lock"))), installed = JSON.parse(await readFile(join(root, "vendor/composer/installed.json")));
	assert.deepEqual(lock["packages-dev"], []);
	for(const entries of [lock.packages, installed.packages])
	{
		assert.deepEqual(entries.map(entry => entry.name).sort(), ["brick/math", context.name].sort());
		for(const expected of [dependency.package, component.package])
		{
			const entry = entries.find(item => item.name === expected.name);
			for(const field of ["version", "require", "autoload", "dist"]) assert.deepEqual(entry[field], expected[field], `Composer identity drift: ${expected.name}.${field}`);
		}
	}
	const beforeAutoload = Object.fromEntries(await Promise.all(["composer.lock", "vendor/composer/InstalledVersions.php", "vendor/composer/installed.json", "vendor/composer/installed.php"].map(async path => [path, identity(await readFile(join(root, path)))])));
	await verifyFiles(root, beforeAutoload);
	await invoke(["dump-autoload", "--no-dev"]);
	await verifyPayloads(context); await verifyFiles(root, beforeAutoload);
	assert.deepEqual(await nativeArtifactPaths(join(root, "vendor/composer")), generatedNames);
	const generatedPaths = ["composer.lock", "vendor/autoload.php", ...generatedNames.map(path => `vendor/composer/${path}`)];
	context.generatedFiles = immutable(Object.fromEntries(await Promise.all(generatedPaths.map(async path => [path, identity(await readFile(join(root, path)))]))));
	context.vendorFiles = immutable({
		...Object.fromEntries([...original.members].map(([path, data]) => [`${context.name}/${path}`, identity(data)]))
		, ...Object.fromEntries(Object.entries(dependencyFiles).map(([path, entry]) => [`brick/math/${path}`, entry]))
		, ...Object.fromEntries(Object.entries(context.generatedFiles).filter(([path]) => path.startsWith("vendor/")).map(([path, entry]) => [path.slice(7), entry])) });
	Object.freeze(context);
	assert.equal(sha256(await readFile(archive)), archiveSha256, "PHP archive changed during installation");
	await verifyFinContainerEdgePhpEnvironment(context);
	return { context, run: mode => runFinContainerEdgePhp(context, mode) };
};
