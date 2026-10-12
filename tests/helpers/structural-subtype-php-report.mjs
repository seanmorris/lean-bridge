/**
 * Check original structural PHP execution records without reopening historical paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { brickMathSources } from "../../src/backends/php/brick-math.mjs";
import { structuralSubtypePhpGenerators } from "./structural-subtype-php-generators.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";
import { structuralSubtypeReview } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypePhpConfiguration, structuralSubtypePhpCounts, parseStructuralSubtypePhpResult } from "./structural-subtype-php-fixture.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const generatedNames = [
	"ClassLoader.php", "InstalledVersions.php", "LICENSE", "autoload_classmap.php"
	, "autoload_files.php", "autoload_namespaces.php", "autoload_psr4.php"
	, "autoload_real.php", "autoload_static.php", "installed.json"
	, "installed.php", "platform_check.php"
];
export const structuralSubtypePhpGeneratedPaths = Object.freeze([
	"composer.lock", "vendor/autoload.php"
	, ...generatedNames.map(path => `vendor/composer/${path}`)
]);
export const structuralSubtypePhpRecords = Object.freeze([
	"report.json", "expected.binding-ir.json", "configuration.json", "consumer.php"
	, ...["installed", "relocated"].flatMap(place => ["weak", "strict"].map(mode => `${place}-${mode}.json`))
	, ...["consumer.php", "strict.php", "composer.json", ...structuralSubtypePhpGeneratedPaths].map(path => `installation/${path}`)
	, ...["composer.json", "binding-manifest.json", "src/Api.php"].map(path => `package/${path}`)
	, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json", "StructuralSubtypes.lean"].map(path => `build-${index}/${path}`))
]);

/**
 * Require exact PHP contracts, authenticated Composer inputs and relocated observations.
 *
 * @param read - Original route-relative record reader.
 * @param options - Independent frozen producer and route selection.
 * @param options.route - Ordinary or reviewed author configuration.
 * @param options.producerCommit - Actual installed producer revision.
 */
export const checkStructuralSubtypePhpReport = async (read, { route, producerCommit }) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `Original canonical record: ${path}`);
		return value;
	};
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
	const expected = structuralSubtypeReview(), configuration = structuralSubtypePhpConfiguration(route), report = await json("report.json");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.configuration, configuration); assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.independentBuilds, 2);
	for(const key of ["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation"]) assert.equal(report[key], true, key);
	assert.ok(["2.36", "2.38"].includes(report.declaredGlibcFloor));
	assert.deepEqual(report.dispatch, { observed: false, reason: "No PHP entry counters in this installed acceptance" });
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	for(const index of [0, 1])
	{
		const modelBytes = await read(`build-${index}/model.json`), model = await json(`build-${index}/model.json`);
		const receiptBytes = await read(`build-${index}/package-set-receipt.json`), receipt = await json(`build-${index}/package-set-receipt.json`);
		validatePackageSetReceipt(receipt); assert.deepEqual(receipt, report.receipt);
		assert.equal(model.profile, "native-library-v1"); assert.equal(model.pointerBits, 64); assert.equal(model.exports.length, 12);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		for(const declaration of expected.declarations)
		{
			const exported = model.exports.find(item => item.name === declaration.id.slice(5)); assert.ok(exported);
			assert.deepEqual(exported.refinements, declaration.source.extensions["lean-lang.org/refinements"]);
		}
		const source = await read(`build-${index}/StructuralSubtypes.lean`);
		assert.deepEqual(source, original("tests/fixtures/onboarding/structural-subtypes/StructuralSubtypes.lean"));
		assert.equal(model.sourceIdentity.modules.length, 1);
		assert.deepEqual(model.sourceIdentity.modules[0].source, { path: "StructuralSubtypes.lean", bytes: source.length, sha256: sha256(source) });
		assert.equal(model.sourceIdentity.extractorSha256, sha256(original("src/analyze/NativeExports.lean")));
		assert.equal(model.sourceIdentity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(model.sourceIdentity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.deepEqual(model.sourceIdentity.request.metadata.modules.map(item => item.sourceSha256), [sha256(source)]);
		digest(model.sourceIdentity.leanCompilerSha256);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		assert.equal(receipt.source.treeSha256, model.sourceIdentity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(pkg => pkg.target), ["php-native"]);
		assert.deepEqual(report.builds[index], {
			modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256])))
		});
	}

	const source = original("tests/fixtures/structural-subtype-consumers/php-native.php").toString();
	const caller = route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
	assert.equal((await read("consumer.php")).toString(), caller);
	assert.match(report.php, /^8\.[2-9]\.[0-9]+$/u);
	const environment = report.installation, model = await json("build-0/model.json");
	assert.deepEqual(Object.keys(environment).sort(), [
		"root", "command", "composer", "runtimeFlags", "tools", "name", "receiptBytes"
		, "packageFileSetSha256", "inputs", "feedFiles", "dependencyFiles"
		, "generatedFiles", "vendorFiles"
	].sort());
	for(const key of ["root", "command", "composer"]) assert.ok(environment[key].startsWith("/") && !environment[key].includes("\0"));
	assert.equal(environment.name, "example/structuralsubtypes");
	const flags = environment.runtimeFlags;
	assert.equal(flags[0], "-n"); assert.deepEqual(flags.slice(-2), ["-d", "ffi.enable=1"]);
	assert.ok(flags.length === 3 || flags.length === 5);
	if(flags.length === 5)
	{
		assert.equal(flags[1], "-d"); assert.match(flags[2], /^extension=\/[^\0]+\/ffi\.so$/u);
		assert.ok(environment.tools[flags[2].slice("extension=".length)]);
	}
	for(const path of [environment.command, environment.composer]) assert.ok(environment.tools[path]);
	for(const [path, entry] of Object.entries(environment.tools))
	{
		assert.ok(path === environment.command || path === environment.composer || /\/(ctype|ffi|iconv|mbstring|phar|tokenizer)\.so$/u.test(path));
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 0); digest(entry.sha256);
	}
	const receiptBytes = Buffer.from(environment.receiptBytes), receipt = JSON.parse(receiptBytes);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	const pkg = report.receipt.packages[0];
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, "lean-bridge-ordinary-php-package");
	assert.equal(receipt.ecosystem, "composer"); assert.equal(receipt.name, pkg.name);
	assert.equal(receipt.version, pkg.version); assert.equal(receipt.namespace, "LeanStructuralsubtypes");
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(receipt.glibcMinimumVersion, report.declaredGlibcFloor);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity); assert.deepEqual(receipt.component, model.component);
	assert.deepEqual(receipt.files["lean-bridge/component/model.json"], identity(await read("build-0/model.json")));
	const payload = { ...receipt.files, "lean-bridge/package-receipt.json": identity(receiptBytes) };
	assert.equal(environment.packageFileSetSha256, sha256(canonicalJson(Object.keys(payload).sort())));
	const metadata = await json("package/composer.json"), manifest = await json("package/binding-manifest.json");
	assert.equal(metadata.name, pkg.name); assert.equal(metadata.version, pkg.version);
	assert.equal(metadata.type, "library");
	assert.deepEqual(metadata.require, { php: ">=8.2 <9", "ext-ffi": "*", "brick/math": "1.0.0" });
	assert.deepEqual(metadata.autoload, { files: ["src/Api.php"] });
	for(const key of ["scripts", "repositories", "autoload-dev", "config", "bin", "target-dir", "include-path", "replace", "provide", "conflict"])
		assert.ok(!Object.hasOwn(metadata, key), key);
	const { generateCopiedPhpPackage } = await structuralSubtypePhpGenerators(producerCommit);
	const generated = generateCopiedPhpPackage(model.bindingIr), expectedManifest = JSON.parse(generated["binding-manifest.json"]);
	assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
	assert.equal(manifest.namespace, "LeanStructuralsubtypes");
	assert.deepEqual(manifest.exports, expectedManifest.exports);
	assert.deepEqual(manifest.publicFiles, ["src/Api.php"]);
	assert.equal((await read("package/src/Api.php")).toString(), generated["src/Api.php"], "Public API must match its recorded producer");
	assert.equal(manifest.filesSha256["src/Api.php"], sha256(generated["src/Api.php"]));
	for(const path of ["composer.json", "binding-manifest.json", "src/Api.php"])
		assert.deepEqual(receipt.files[path], identity(await read(`package/${path}`)));
	const dependencies = Object.fromEntries(Object.entries(brickMathSources()).map(([path, bytes]) => [path, identity(bytes)]));
	assert.deepEqual(environment.dependencyFiles, dependencies);
	assert.deepEqual(Object.keys(environment.inputs).sort(), ["composer.json", "consumer.php", "strict.php"]);
	assert.equal((await read("installation/consumer.php")).toString(), caller);
	assert.equal((await read("installation/strict.php")).toString(), caller.replace("declare(strict_types=0);", "declare(strict_types=1);"));
	for(const [path, entry] of Object.entries(environment.inputs)) assert.deepEqual(entry, identity(await read(`installation/${path}`)));
	assert.deepEqual(Object.keys(environment.generatedFiles).sort(), [...structuralSubtypePhpGeneratedPaths].sort());
	for(const [path, entry] of Object.entries(environment.generatedFiles)) assert.deepEqual(entry, identity(await read(`installation/${path}`)));
	const vendor = {
		...Object.fromEntries(Object.entries(payload).map(([path, entry]) => [`${environment.name}/${path}`, entry]))
		, ...Object.fromEntries(Object.entries(dependencies).map(([path, entry]) => [`brick/math/${path}`, entry]))
		, ...Object.fromEntries(Object.entries(environment.generatedFiles).filter(([path]) => path.startsWith("vendor/")).map(([path, entry]) => [path.slice(7), entry]))
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
	assert.equal(composer.name, "copied-check/consumer");
	assert.deepEqual(composer.require, { [pkg.name]: pkg.version });
	assert.deepEqual(composer.config, { "allow-plugins": false });
	assert.equal(composer.repositories.length, 3); assert.deepEqual(composer.repositories[0], { "packagist.org": false });
	const component = composer.repositories[2];
	assert.deepEqual(component, { type: "package", package: { ...metadata, dist: { type: "zip", url: new URL("file://" + environment.root + "/feed/component.zip").href } } });
	const lock = JSON.parse(await read("installation/composer.lock"));
	const installed = JSON.parse(await read("installation/vendor/composer/installed.json"));
	assert.deepEqual(lock["packages-dev"], []);
	for(const records of [lock.packages, installed.packages])
	{
		assert.deepEqual(records.map(item => item.name).sort(), ["brick/math", pkg.name].sort());
		const selected = records.find(item => item.name === pkg.name);
		for(const key of ["version", "require", "autoload", "dist"]) assert.deepEqual(selected[key], component.package[key]);
	}
	validateBrickMathInstall({ manifest: composer, lock, installed }, Object.fromEntries(Object.entries(vendor).map(([path, entry]) => ["vendor/" + path, entry])));
	assert.deepEqual(Object.keys(environment.feedFiles).sort(), ["component.zip", "brick-math-1.0.0.zip", ...Object.keys(dependencies).map(path => "brick-math/" + path)].sort());
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
	assert.equal(report.observations.length, 4);
	for(const [position, place] of ["installed", "relocated"].entries()) for(const [offset, mode] of ["weak", "strict"].entries())
	{
		const observation = await json(`${place}-${mode}.json`);
		assert.deepEqual(observation, report.observations[2 * position + offset]);
		assert.equal(observation.relocated, Boolean(position)); assert.equal(observation.mode, mode);
		assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, "");
		assert.deepEqual(parseStructuralSubtypePhpResult(observation.run.stdout), structuralSubtypePhpCounts);
		assert.deepEqual(observation.counts, structuralSubtypePhpCounts); assert.deepEqual(observation.closure, closure);
	}
	return {
		route, producerCommit
		, ...structuralSubtypePhpCounts
		, executions: 4, php: report.php, modes: ["weak", "strict"]
		, dispatchObserved: false
		, archives: report.builds[0].archives
	};
};
