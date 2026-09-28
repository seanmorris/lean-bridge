/**
 * Bind native PHP ownership claims to compiler, installed and fault observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedPhpPackage } from "../../src/backends/php/owned-package.mjs";
import { ownedPhpAdapterSources } from "../../src/build/owned-php-artifacts.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";
import { assertOwnedPhpCi } from "./owned-php-ci.mjs";

export const ownedPhpScope = {
	profiles: ["php-native"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, installedComposer: true, cliIntegrated: true, privateGmp: true
	, primitives: 19, publicExports: 51, callerModes: ["weak", "strict"]
	, transferredInputs: false, anchoredResults: false
	, wasm: false, promotedCells: 0
};
export const ownedPhpCommands = {
	values: "LEAN_BRIDGE_OWNED_PHP_VALUES_TEST=1 node --test --test-name-pattern='^(?!.*32-bit PHP-Wasm)' tests/owned-php-values.test.mjs"
	, core: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-php-runtime.test.mjs tests/owned-php-conversions.test.mjs tests/owned-php-calls.test.mjs tests/owned-php-package.test.mjs"
	, packages: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-php-packaging.test.mjs"
	, documentation: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-php-documentation.test.mjs"
	, coexistence: "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-php-coexistence.test.mjs"
	, cli: "node --test tests/cli-npm-package.test.mjs"
	, legacy: "node --test tests/php-recursive-callable-contract.test.mjs"
};
const identity = source => ({ bytes: Buffer.byteLength(source), sha256: sha256(source) });
const digest = hash => assert.match(hash, /^[a-f0-9]{64}$/u);
const flags = (record, names) => { for(const name of names) assert.equal(record[name], true, name); };
const passing = (run, name, count) => {
	assert.equal(run.status, "passed"); assert.equal(run.command, ownedPhpCommands[name]);
	assert.equal(sha256(run.text), run.sha256);
	const skipped = name === "values" ? 1 : 0;
	for(const [key, value] of Object.entries({ tests: count + skipped, pass: count, fail: 0, skipped, cancelled: 0 }))
		assert.match(run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(run.text, /^not ok/mu);
	assert.deepEqual(run.text.split("\n").filter(line => /^ok .* # SKIP/u.test(line)), skipped
		? ["ok 4 - owned PHP values execute in the actual 32-bit PHP-Wasm interpreter # SKIP"] : []);
};
const installation = report => {
	flags(report, ["emptyHome", "emptyCache", "offline", "lockedInstall"
		, "scriptsDisabled", "pluginsDisabled", "composerProjectRemoved"
		, "relocated", "compilerFree", "iniDisabled"]);
	assert.match(report.version, /^8\.[2-9]\.\d+$/u);
	assert.match(report.composerVersion, /^Composer version 2\./u);
	for(const hash of [report.hostSha256, report.composerSha256, report.lockSha256, report.archiveSha256]) digest(hash);
	validateBrickMathInstall(report, report.deployment);
	for(const receipt of report.receipts)
	{
		assert.equal(receipt.ecosystem, "composer");
		for(const [path, file] of Object.entries(receipt.files))
			assert.deepEqual(report.deployment["vendor/" + receipt.name + "/" + path], file, path);
		assert.deepEqual(report.deployment["vendor/" + receipt.name + "/lean-bridge/package-receipt.json"], identity(canonicalJson(receipt)));
		const locked = report.lock.packages.find(pkg => pkg.name === receipt.name);
		assert.equal(locked.version, receipt.version);
		assert.deepEqual(locked.require, { php: ">=8.2 <9", "ext-ffi": "*", "brick/math": "1.0.0" });
		assert.deepEqual(locked.autoload, { files: ["src/Api.php"] });
		assert.equal(locked.scripts, undefined);
	}
};
const packageSet = (report, targets) => {
	assert.equal(report.cliBuild.status, "ok");
	assert.deepEqual(report.cliBuild.result.targets, targets);
	assert.deepEqual([...new Set(report.packageSetReceipt.packages.map(pkg => pkg.target))], targets);
	assert.equal(report.verification.status, "ok");
	assert.equal(report.verification.result.verificationType, "local-package-set");
	assert.equal(report.packageSetReceipt.profiles.length, 1);
	const projection = targets.length === 1 ? report.cliBuild.result : report.cliBuild.result.projections.find(item => item.ecosystem === "php-native");
	assert.equal(projection.backend, "owned-php-cli-ffi-v1");
	assert.equal(projection.packages.length, 1);
	const pkg = projection.packages[0];
	const installed = report.packageSetReceipt.packages.find(item => item.target === "php-native");
	assert.equal(installed.ecosystem, "composer"); assert.equal(installed.runtimeDelivery, "embedded");
	assert.deepEqual(installed.artifacts, [{ path: "archives/" + pkg.archive, bytes: pkg.bytes, sha256: pkg.sha256 }]);
	assert.equal(report.installation.archiveSha256, pkg.sha256);
	assert.equal(report.installation.receipt.name, pkg.name);
	assert.equal(report.installation.receipt.version, pkg.version);
	installation(report.installation);
};
const packageReport = async (report, mode) => {
	flags(report, ["cliAdmission", "compiledLean", "installedPackage"
		, "sourceUnchanged"
		, "sourceFreeInstallation", "sourceFreeRelocatedExecution", "handoffRemoved"
		, "deterministicReassembly", "receiptVerifiedWithoutProducer"]);
	assert.equal(report.mode, mode); packageSet(report, ["php-native"]);
	const model = createCompiledNativeModel(report.input, { ownedGraphs: true, ownedHostCallbacks: true });
	assert.equal(model.exports.length, 51);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(model.sourceIdentity.modules[0].source.sha256, sha256(await readFile("tests/fixtures/onboarding/owned-dotnet-callables/Owned.lean")));
	assert.equal(model.sourceIdentity.extractorSha256, sha256(await readFile("src/analyze/NativeExports.lean")));
	const native = generateCompiledNativeLeanAdapters(model), component = report.componentReceipt;
	assert.equal(component.modelSha256, sha256(canonicalJson(model)));
	assert.equal(component.metadataSha256, sha256(canonicalJson(report.input.metadata)));
	assert.equal(component.headerSha256, sha256(native.header));
	assert.equal(component.adaptersSha256, sha256(native.leanSource));
	assert.equal(component.callbackSourceSha256, sha256(native.callbackSource));
	const c = generateOwnedCPackage({ ...report.input, hostCallbacks: true });
	const php = generateOwnedPhpPackage(model.bindingIr), adapter = report.adapterReceipt;
	assert.deepEqual(adapter.phpValues, php.contract);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	assert.deepEqual(adapter.ownedValues, { schemaVersion: 2
		, hostCallbacks: model.ownedGraph.hostCallbacks
		, headerSha256: sha256(c.publicHeader), sourceSha256: sha256(c.source) });
	assert.deepEqual(adapter.gmp, { version: "6.3.0", soname: "libgmp-lean-bridge.so.10", binding: "local-symbols" });
	for(const [path, source] of Object.entries(ownedPhpAdapterSources(c, php)))
		assert.deepEqual(adapter.files[path], identity(source), path);
	const receipt = report.installation.receipt;
	assert.equal(receipt.kind, "lean-bridge-owned-php-package");
	assert.deepEqual(receipt.ownedValues, php.contract);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.equal(receipt.runtimeIdentity, component.runtimeIdentity);
	const libraries = Object.fromEntries(Object.entries(receipt.files)
		.filter(([path]) => path.startsWith("native/linux-x64/"))
		.map(([path, file]) => [path.split("/").at(-1), file.sha256]));
	assert.equal(libraries[component.library], component.nativeLibrary.sha256);
	assert.equal(libraries[adapter.library], adapter.files["lib/" + adapter.library].sha256);
	assert.equal(libraries[adapter.gmp.soname], adapter.files["gmp/lib/" + adapter.gmp.soname].sha256);
	const compiled = generateOwnedPhpPackage(model.bindingIr, {
		componentId: model.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, libraries, library: adapter.library, ownedValues: php.contract
		, runtimeIdentity: component.runtimeIdentity
	});
	for(const [path, source] of Object.entries(compiled.files)) assert.deepEqual(receipt.files[path], identity(source), path);
	assert.deepEqual(report.needed, [adapter.gmp.soname, component.library, "liblean_bridge_native.so", "libleanshared.so", "libc.so.6", "ld-linux-x86-64.so.2"]);
	assert.equal(report.sourceSha256, sha256(await readFile("tests/fixtures/structured-types/owned-installed-php.php")));
	assert.equal(report.loaderSourceSha256, sha256(await readFile("tests/fixtures/structured-types/owned-installed-php-loader.php")));
	assert.deepEqual(report.observations.map(item => item.caller), ["weak", "strict"]);
	for(const { observed } of report.observations)
	{
		assert.equal(observed.checks, 241); assert.equal(observed.primitives, 19);
		flags(observed, ["ordinaryAutoload", "iniDisabled"]);
		assert.deepEqual(observed.functions, php.functions.map(fn => fn.publicName).sort());
	}
	assert.deepEqual(report.observations[0].observed, report.observations[1].observed);
	const loader = report.loader;
	assert.deepEqual(loader.consumer, report.observations[0].observed);
	assert.equal(loader.runtimeInitializations, 1); assert.equal(loader.componentInitializations, 1);
	assert.equal(loader.liveIdentities, 0); assert.equal(loader.idleSessionIdentities, 1);
	flags(loader, ["automaticShutdown", "privateGmp"]);
	assert.deepEqual(Object.keys(loader.mappings).sort(), Object.keys(libraries).sort());
	for(const [name, paths] of Object.entries(loader.mappings))
	{
		assert.equal(Object.keys(paths).length, 1);
		assert.ok(Object.keys(paths)[0].endsWith("/relocated/vendor/" + receipt.name + "/native/linux-x64/" + name));
	}
	assert.deepEqual(report.tamperRejected, ["lifetime", "unknown-field", "source", "boundary", "gmp-receipt", "gmp-source", "library", "unrecorded"]);
	assert.deepEqual(report.loaderRejected, ["changed-library", "symlink-library", "missing-library", "foreign-runtime"]);
};

/**
 * Check retained execution reports without treating source generation as delivery.
 *
 * @param record - Complete native PHP package integration receipt.
 */
export const assertOwnedPhpExecution = async record => {
	assert.deepEqual(record.scope, ownedPhpScope); assert.equal(record.acceptance, "passed");
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedPhpCommands).sort());
	for(const [name, count] of Object.entries({ values: 3, core: 18, packages: 2, documentation: 1, coexistence: 1, cli: 5, legacy: 9 }))
		passing(record.runs[name], name, count);
	assert.equal(record.values.observations.length, 8);
	assert.deepEqual(record.values.observations.map(({ mode, observation: item }) => [item.integerBits, item.wordBits, mode]),
		[[64, 64], [64, 32], [32, 32], [32, 64]].flatMap(widths => ["weak", "strict"].map(mode => [...widths, mode])));
	for(const { observation: item } of record.values.observations)
	{
		assert.equal(item.compiledLean, false); assert.equal(item.installedPackage, false);
		assert.equal(item.actualPhpBits, 64);
		assert.equal(item.checks, item.integerBits === 64 ? 234 : 235);
		assert.equal(item.rejections, item.integerBits === 64 ? 103 : 104);
	}
	assert.deepEqual(Object.keys(record.packages).sort(), ["ordinary", "reviewed"]);
	assert.deepEqual(Object.keys(record.calls).sort(), ["ordinary", "reviewed"]);
	assert.deepEqual(Object.keys(record.runtime).sort(), ["ordinary", "reviewed"]);
	assert.deepEqual(Object.keys(record.conversions).sort(), ["composition-ordinary", "composition-reviewed", "scalars-ordinary", "scalars-reviewed"]);
	for(const mode of ["ordinary", "reviewed"])
	{
		await packageReport(record.packages[mode], mode);
		const runtime = record.runtime[mode];
		assert.equal(runtime.compiledLean, true); assert.equal(runtime.installedPackage, false);
		assert.equal(runtime.probeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-php-runtime.php")));
		assert.equal(runtime.observations.length, 33);
		assert.deepEqual(runtime.observations[0], { mode: "normal"
			, observation: { checks: 301, identities: 0, live: 0, nativeFailures: 4, phpFailures: 6 } });
		for(const observed of runtime.observations.slice(1))
			assert.deepEqual(observed, { mode: "shutdown", observation: { checks: 1, shutdownCleanup: true } });
		for(const kind of ["scalars", "composition"])
		{
			const converted = record.conversions[kind + "-" + mode];
			assert.equal(converted.compiledLean, true); assert.equal(converted.installedPackage, false);
			assert.equal(converted.phpCallbacks, false);
			assert.deepEqual(converted.observation, kind === "scalars"
				? { checks: 395, identities: 0, live: 0, nativeFailures: 27, phpFailures: 46, primitives: 19 }
				: { checks: 1286, identities: 0, live: 0, nativeFailures: 121, phpFailures: 120, primitives: 0 });
		}
		const report = record.calls[mode];
		flags(report, ["compiledLean", "phpCallbacks"]); assert.equal(report.installedPackage, false);
		assert.deepEqual(report.observation, { boundedInvocations: 819, checks: 855
			, identities: 0, live: 0, nativeFailures: 115, phpFailures: 91
			, primitives: 19, reentries: 63, scalarCalls: 19 });
		assert.deepEqual(report.weak, report.observation);
		assert.deepEqual(report.retirement, { checks: 8, identities: 0, live: 0 });
		assert.equal(report.probeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-php-calls.php")));
	}
	const docs = record.documentation;
	flags(docs, ["cliIntegrated", "producerRemoved", "handoffRemoved", "sourceUnchanged", "relocated"]);
	packageSet(docs, ["c", "php-native"]);
	assert.equal(docs.observed.stdout, "42\n42\n"); assert.equal(docs.observed.stderr, "");
	for(const [name, path, heading, language] of [
		["lean", "publish/php", "### Export resource-containing values", "lean"]
		, ["config", "publish/php", "### Export resource-containing values", "json"]
		, ["example", "php", "### Resource-containing values", "php"]
	]) {
		const section = (await readFile("docs/" + path + ".md", "utf8")).split(heading + "\n")[1].split("\n### ")[0];
		const source = section.match(new RegExp("```" + language + "\\n([^]*?)\\n```"))[1] + "\n";
		assert.equal(docs.sourceHashes[name], sha256(source));
	}
	const coexist = record.coexistence;
	flags(coexist, ["cliIntegrated", "compiledLean", "installedPackage", "sourceFreeInstallation", "sourceFreeRelocatedExecution", "handoffRemoved"]);
	assert.equal(coexist.reproduced.independentNativeCompilation, true);
	assert.deepEqual(coexist.reproduced.pkg, coexist.releases[0].pkg);
	assert.equal(coexist.reproduced.cliBuild.status, "ok");
	assert.equal(coexist.releases.length, 3); installation(coexist.installation);
	for(const item of coexist.releases)
	{
		assert.equal(item.cliBuild.status, "ok");
		assert.deepEqual(item.cliBuild.result.targets, ["php-native"]);
		assert.equal(item.built.backend, item.owned ? "owned-php-cli-ffi-v1" : "ordinary-php-cli-ffi-v1");
	}
	assert.deepEqual(coexist.observations.map(item => item.order), ["one,two,graph", "two,graph,one", "graph,one,two", "graph,two,one"]);
	for(const { observed } of coexist.observations)
	{
		assert.equal(observed.checks, 284); assert.equal(observed.callbacks, 32);
		assert.equal(observed.foreignRejections, 64); assert.equal(observed.liveIdentities, 0);
		assert.equal(observed.runtimeInitializations, 1); assert.equal(observed.componentInitializations, 3);
	}
	assert.equal(coexist.consumerSha256, sha256(await readFile("tests/fixtures/structured-types/owned-php-coexistence.php")));
	assertOwnedPhpCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
};
