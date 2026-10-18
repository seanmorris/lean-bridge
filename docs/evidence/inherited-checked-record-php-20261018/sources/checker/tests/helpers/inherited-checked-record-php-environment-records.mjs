/**
 * Reconcile inherited checked-record Composer inputs, dependencies and complete vendor tree.
 * Historical absolute paths are compared as provenance, never reopened.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { brickMathSources } from "../../src/backends/php/brick-math.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const generatedNames = ["ClassLoader.php", "InstalledVersions.php", "LICENSE"
	, "autoload_classmap.php", "autoload_files.php", "autoload_namespaces.php"
	, "autoload_psr4.php", "autoload_real.php", "autoload_static.php"
	, "installed.json", "installed.php", "platform_check.php"];
export const inheritedCheckedRecordPhpGeneratedPaths = Object.freeze([
	"composer.lock", "vendor/autoload.php"
	, ...generatedNames.map(path => `vendor/composer/${path}`)
]);

/**
 * Bind caller, Composer, package and dependency records into one closed deployment.
 *
 * @param options - Independently authenticated original inputs.
 * @param options.read - Selection-relative retained byte reader.
 * @param options.json - Canonical JSON reader.
 * @param options.environment - Original closed installation.
 * @param options.packaged - Independently checked package record.
 * @param options.receipt - Verified package-set receipt.
 * @param options.tools - Separately validated exact tools and probes.
 * @param options.caller - Frozen public caller for this route and API.
 */
export const checkInheritedCheckedRecordPhpEnvironmentRecords = async ({ read, json, environment, packaged, receipt, tools, caller }) => {
	assert.deepEqual(Object.keys(environment).sort(), [
		"root", "command", "composer", "runtimeFlags", "tools", "name", "receiptBytes"
		, "packageFileSetSha256", "inputs", "feedFiles", "dependencyFiles"
		, "generatedFiles", "vendorFiles"
	].sort());
	assert.equal(typeof environment.root, "string");
	assert.ok(posix.isAbsolute(environment.root) && posix.normalize(environment.root) === environment.root && !environment.root.includes("\0"));
	assert.equal(environment.name, "example/inheritedcheckedrecords");
	assert.equal(environment.command, tools.command); assert.equal(environment.composer, tools.composer);
	assert.deepEqual(environment.runtimeFlags, tools.runtimeFlags); assert.deepEqual(environment.tools, tools.tools);
	const receiptBytes = await read("package/lean-bridge/package-receipt.json");
	assert.equal(environment.receiptBytes, receiptBytes.toString());
	const payload = packaged.files, pkg = receipt.packages[0];
	assert.equal(environment.packageFileSetSha256, sha256(canonicalJson(Object.keys(payload).sort())));
	const metadata = await json("package/composer.json");
	assert.equal(metadata.name, pkg.name); assert.equal(metadata.version, pkg.version); assert.equal(metadata.type, "library");
	assert.deepEqual(metadata.require, { php: ">=8.2 <9", "ext-ffi": "*", "brick/math": "1.0.0" });
	assert.deepEqual(metadata.autoload, { files: ["src/Api.php"] });
	assert.deepEqual(metadata.extra, { "lean-bridge": { profile: "ordinary-php-cli-ffi-v1"
		, platform: "linux-x86_64"
		, glibcMinimumVersion: JSON.parse(environment.receiptBytes).glibcMinimumVersion
		, namespace: "LeanInheritedcheckedrecords", licenses: "licenses/" } });
	for(const key of ["scripts", "repositories", "autoload-dev", "config", "bin", "target-dir", "include-path", "replace", "provide", "conflict"])
		assert.ok(!Object.hasOwn(metadata, key), key);
	const dependencies = Object.fromEntries(Object.entries(brickMathSources()).map(([path, bytes]) => [path, identity(bytes)]));
	assert.deepEqual(environment.dependencyFiles, dependencies);
	assert.deepEqual(Object.keys(environment.inputs).sort(), ["composer.json", "consumer.php", "strict.php"]);
	assert.equal((await read("installation/consumer.php")).toString(), caller);
	assert.equal((await read("installation/strict.php")).toString(), caller.replace("declare(strict_types=0);", "declare(strict_types=1);"));
	for(const [path, entry] of Object.entries(environment.inputs)) assert.deepEqual(entry, identity(await read(`installation/${path}`)));
	assert.deepEqual(Object.keys(environment.generatedFiles).sort(), [...inheritedCheckedRecordPhpGeneratedPaths].sort());
	for(const [path, entry] of Object.entries(environment.generatedFiles)) assert.deepEqual(entry, identity(await read(`installation/${path}`)));
	const vendor = {
		...Object.fromEntries(Object.entries(payload).map(([path, entry]) => [`${environment.name}/${path}`, entry]))
		, ...Object.fromEntries(Object.entries(dependencies).map(([path, entry]) => [`brick/math/${path}`, entry]))
		, ...Object.fromEntries(Object.entries(environment.generatedFiles).filter(([path]) => path.startsWith("vendor/"))
			.map(([path, entry]) => [path.slice(7), entry]))
	};
	assert.deepEqual(environment.vendorFiles, vendor);
	for(const entries of [payload, environment.feedFiles, environment.generatedFiles, vendor])
		for(const [path, entry] of Object.entries(entries))
		{
			assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
			assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); digest(entry.sha256);
		}
	const composer = await json("installation/composer.json");
	assert.deepEqual(Object.keys(composer).sort(), ["config", "name", "repositories", "require"]);
	assert.equal(composer.name, "copied-check/consumer"); assert.deepEqual(composer.require, { [pkg.name]: pkg.version });
	assert.deepEqual(composer.config, { "allow-plugins": false });
	assert.equal(composer.repositories.length, 3); assert.deepEqual(composer.repositories[0], { "packagist.org": false });
	const component = composer.repositories[2];
	assert.deepEqual(component, {
		type: "package"
		, package: {
			...metadata
			, dist: { type: "zip", url: new URL("file://" + environment.root + "/feed/component.zip").href }
		}
	});
	const lock = JSON.parse(await read("installation/composer.lock"));
	const installed = JSON.parse(await read("installation/vendor/composer/installed.json"));
	assert.deepEqual(lock["packages-dev"], []);
	for(const records of [lock.packages, installed.packages])
	{
		assert.deepEqual(records.map(item => item.name).sort(), ["brick/math", pkg.name].sort());
		const selected = records.find(item => item.name === pkg.name);
		for(const key of ["version", "require", "autoload", "dist"]) assert.deepEqual(selected[key], component.package[key]);
	}
	validateBrickMathInstall({ manifest: composer, lock, installed }
		, Object.fromEntries(Object.entries(vendor).map(([path, entry]) => ["vendor/" + path, entry])));
	assert.deepEqual(Object.keys(environment.feedFiles).sort(), [
		"component.zip", "brick-math-1.0.0.zip"
		, ...Object.keys(dependencies).map(path => "brick-math/" + path)
	].sort());
	assert.deepEqual(environment.feedFiles["component.zip"], { bytes: pkg.artifacts[0].bytes, sha256: pkg.artifacts[0].sha256 });
	for(const [path, entry] of Object.entries(dependencies)) assert.deepEqual(environment.feedFiles["brick-math/" + path], entry);
	const closure = {
		receiptSha256: sha256(receiptBytes)
		, packageFileSetSha256: environment.packageFileSetSha256
		, dependencyFilesSha256: sha256(canonicalJson(dependencies))
		, generatedFilesSha256: sha256(canonicalJson(environment.generatedFiles))
		, vendorFilesSha256: sha256(canonicalJson(vendor))
		, toolsSha256: sha256(canonicalJson(environment.tools))
	};
	assert.deepEqual(packaged.closure, closure); return closure;
};
