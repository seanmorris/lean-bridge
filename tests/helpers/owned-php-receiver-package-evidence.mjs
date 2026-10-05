/**
 * Reconstruct installed Composer members and bind runtime-only observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedPhpPackage } from "../../src/backends/php/owned-package.mjs";
import { ownedPhpAdapterSources } from "../../src/build/owned-php-artifacts.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";
import { ownedPhpReceiverCommand, ownedPhpReceiverScope, ownedPhpReceiverModel, assertOwnedPhpReceiverRuntime } from "./owned-php-receiver-evidence.mjs";
import { ownedPhpInstalledReceiverProbe, ownedPhpPlainInstalledReceiverProbe } from "./owned-php-receiver-fixture.mjs";
import { assertOwnedPhpReceiverCi } from "./owned-php-receiver-ci.mjs";
import { ownedPhpWasmReceiverHistoricalBytes } from "./owned-php-wasm-receiver-history.mjs";

const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };
const identity = source => ({ bytes: Buffer.byteLength(source), sha256: sha256(source) });
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);

const assertCli = async item => {
	const config = JSON.parse(ownedPhpWasmReceiverHistoricalBytes(
		"config/cli-package.v1.json", await readFile("config/cli-package.v1.json")).toString());
	const cli = item.cliPackage;
	const { archive, inventorySha256, externalRegistryWrites, ...inventory } = cli;
	assert.equal(cli.kind, "lean-bridge-cli-package");
	assert.equal(inventorySha256, sha256(canonicalJson(inventory)));
	assert.equal(cli.productionApproved, false); assert.equal(externalRegistryWrites, false);
	digest(archive.sha256); assert.ok(archive.bytes > 0);
	assert.deepEqual(item.cliInstallation, { offline: true, filesVerified: cli.files.length, sourceRemoved: true });
	assert.equal(cli.files.length, config.files.length + 2);
	assert.equal(new Set(cli.files.map(file => file.path)).size, cli.files.length);
	for(const path of config.files)
	{
		const file = cli.files.find(value => value.path === path);
		const bytes = Buffer.from(ownedPhpWasmReceiverHistoricalBytes(path, await readFile(path), file?.sha256));
		assert.ok(file, path); assert.equal(file.bytes, bytes.length); assert.equal(file.sha256, sha256(bytes), path);
	}
	assert.equal(item.cliBuilds.length, 2);
	for(const build of item.cliBuilds)
	{
		assert.equal(build.status, "ok"); assert.equal(build.exitCode, 0);
		assert.deepEqual([...build.result.targets].sort(), item.mode === "reviewed" ? ["c", "php-native"] : ["php-native"]);
		const projection = build.result.projections?.find(value => value.ecosystem === "php-native") ?? build.result;
		assert.deepEqual(projection.packages, item.built.packages);
	}
	assert.equal(item.verification.status, "ok");
	assert.equal(item.verification.result.verificationType, "local-package-set");
};

/**
 * Rebuild one public package and require both relocations and loader negatives.
 *
 * @param item - Installed report from an actual Lean build.
 * @param plain - Require a resource-only build with callback transport disabled.
 */
export const assertOwnedPhpReceiverPackage = async (item, plain = false) => {
	flags(item, ["compiledLean", "installedPackage", "sourceUnchanged"
		, "handoffRemoved", "coldValidationWithoutFfi"]);
	assert.equal(item.schemaVersion, 1);
	const consuming = !plain || item.mode === "reviewed";
	if(plain)
	{
		assert.equal(item.consuming, consuming); assert.equal(item.hostCallbacks, false); assert.equal(item.resultAnchors, false);
		assert.equal(item.producerInterface, "native-build-api");
		flags(item, ["sourceRemovedBeforeInstallation", "receiptVerifiedWithoutProducer", "deterministicReassembly"]);
	}
	else
	{
		flags(item, ["sourceFreeInstallation", "sourceFreeRelocatedExecution", "independentBuild", "cliAdmission"]);
		await assertCli(item);
		assert.deepEqual(item.tamperRejected, ["missing-receivers", "native-slot", "member", "property", "owner", "consumption", "equality", "invalid-equality", "member-kind", "export"]);
	}
	const { model, capabilities } = await ownedPhpReceiverModel(item, { plain, consuming });
	const component = item.componentReceipt, native = generateCompiledNativeLeanAdapters(model);
	assert.equal(component.schemaVersion, 6);
	assert.equal(component.runtimeIdentity, item.built.runtimeIdentity);
	assert.equal(component.modelSha256, sha256(canonicalJson(model)));
	assert.equal(component.bindingIrSha256, model.bindingIrSha256);
	assert.equal(component.metadataSha256, sha256(canonicalJson(item.input.metadata)));
	assert.deepEqual(component.sourceIdentity, item.input.sourceIdentity);
	for(const key of ["resultAnchors", "inputTransfers", "receiverExports"])
		assert.deepEqual(component[key], model.ownedGraph[key]);
	assert.equal(component.headerSha256, sha256(native.header));
	assert.equal(component.adaptersSha256, sha256(native.leanSource));
	assert.equal(component.callbackSourceSha256, plain ? undefined : sha256(native.callbackSource));
	const php = generateOwnedPhpPackage(model.bindingIr, null, capabilities);
	const c = generateOwnedCPackage({ ...item.input, ...capabilities, identityEquality: true });
	const adapter = item.adapterReceipt;
	assert.equal(adapter.schemaVersion, 4); assert.equal(adapter.ownedValues.schemaVersion, 5);
	assert.equal(adapter.runtimeIdentity, component.runtimeIdentity);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(adapter.phpValues, php.contract);
	for(const key of ["hostCallbacks", "resultAnchors", "inputTransfers", "receiverExports"])
		assert.deepEqual(adapter.ownedValues[key], model.ownedGraph[key]);
	assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader));
	assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
	const receipt = item.installation.receipt;
	assert.equal(receipt.kind, "lean-bridge-owned-php-package");
	assert.deepEqual(receipt.ownedValues, php.contract);
	for(const [path, source] of Object.entries(ownedPhpAdapterSources(c, php)))
	{
		assert.deepEqual(adapter.files[path], identity(source), path);
		assert.deepEqual(receipt.files["lean-bridge/adapter/" + path], identity(source), path);
	}
	for(const [path, source] of Object.entries({ "model.json": canonicalJson(model)
		, "metadata.json": canonicalJson(item.input.metadata)
		, "binding-ir.json": canonicalJson(model.bindingIr)
		, "native-component.json": canonicalJson(component)
		, "component.h": native.header, "generated.lean": native.leanSource
		, ...plain ? {} : { "callbacks.c": native.callbackSource } }))
		assert.deepEqual(receipt.files["lean-bridge/component/" + path], identity(source), path);
	if(plain) assert.equal(receipt.files["lean-bridge/component/callbacks.c"], undefined);
	assert.deepEqual(receipt.files["lean-bridge/native-php-adapter.json"], identity(canonicalJson(adapter)));
	const libraries = Object.fromEntries(Object.entries(receipt.files).filter(([path]) => path.startsWith("native/linux-x64/"))
		.map(([path, file]) => [path.slice("native/linux-x64/".length), file.sha256]));
	assert.deepEqual(Object.keys(libraries).sort(), [adapter.library, component.library, "libgmp-lean-bridge.so.10", "liblean_bridge_native.so", "libleanshared.so"].sort());
	assert.deepEqual(receipt.files["native/linux-x64/" + component.library], component.nativeLibrary);
	assert.deepEqual(receipt.files["native/linux-x64/" + adapter.library], adapter.files["lib/" + adapter.library]);
	const evidence = { runtimeIdentity: item.built.runtimeIdentity
		, componentId: model.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, ownedValues: php.contract, library: adapter.library, libraries };
	for(const [path, source] of Object.entries(generateOwnedPhpPackage(model.bindingIr, evidence, capabilities).files))
		assert.deepEqual(receipt.files[path], identity(source), path);
	validatePackageSetReceipt(item.packageSetReceipt);
	assert.equal(item.packageSetReceipt.profiles.length, 1);
	assert.equal(item.packageSetReceipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual([...new Set(item.packageSetReceipt.packages.map(pkg => pkg.target))].sort(), !plain && item.mode === "reviewed" ? ["c", "php-native"] : ["php-native"]);
	assert.equal(item.built.packages.length, 1);
	const pkg = item.built.packages[0], recorded = item.packageSetReceipt.packages.find(pkg => pkg.target === "php-native");
	assert.deepEqual(recorded.artifacts, [{ path: "archives/" + pkg.archive, bytes: pkg.bytes, sha256: pkg.sha256 }]);
	assert.equal(item.installation.archiveSha256, pkg.sha256);
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	flags(item.installation, ["emptyHome", "emptyCache", "offline", "lockedInstall"
		, "scriptsDisabled", "pluginsDisabled", "composerProjectRemoved"
		, "relocated", "compilerFree", "iniDisabled"]);
	for(const key of ["hostSha256", "composerSha256", "lockSha256", "archiveSha256"]) digest(item.installation[key]);
	validateBrickMathInstall(item.installation, item.installation.deployment);
	for(const [path, file] of Object.entries(receipt.files))
	{
		assert.deepEqual(item.installation.deployment[`vendor/${receipt.name}/${path}`], file, path);
		assert.deepEqual(item.inventory[`vendor/${receipt.name}/${path}`], file, path);
	}
	const source = plain ? ownedPhpPlainInstalledReceiverProbe(consuming) : await ownedPhpInstalledReceiverProbe();
	assert.equal(item.sourceSha256, sha256(source));
	assert.equal(item.loaderSourceSha256, sha256(await readFile("tests/fixtures/structured-types/owned-installed-php-loader.php")));
	assert.deepEqual(item.observations.map(({ location, caller }) => [location, caller ?? "loader"])
		, ["installed", "relocated-again"].flatMap(location => ["weak", "strict", "loader"].map(caller => [location, caller])));
	for(const { observed, loader, caller } of item.observations)
	{
		assert.equal(Boolean(loader), caller === undefined);
		assert.equal(observed.checks, plain ? consuming ? 26 : 25 : 222);
		flags(observed, ["ordinaryAutoload", "iniDisabled"]);
		assert.deepEqual(observed, item.observations[0].observed);
		if(!plain)
		{
			assert.equal(observed.heldOriginalError, true);
			assert.deepEqual(observed.functions, php.functions.map(fn => fn.publicName).sort());
		}
		if(loader)
		{
			assert.deepEqual(loader.consumer, observed); flags(loader, ["privateGmp", "automaticShutdown"]);
			assert.equal(loader.liveIdentities, 0); assert.equal(loader.idleSessionIdentities, 1);
			assert.equal(loader.runtimeInitializations, 1); assert.equal(loader.componentInitializations, 1);
			assert.deepEqual(Object.keys(loader.mappings).sort(), Object.keys(libraries).sort());
			for(const paths of Object.values(loader.mappings)) assert.equal(Object.keys(paths).length, 1);
		}
	}
	assert.deepEqual(item.loaderRejected.map(value => `${value.kind}:${value.name}`).sort(), [
		...Object.keys(libraries).map(name => `changed-library:${name}`)
		, `symlink-library:${adapter.library}`, `missing-library:${adapter.library}`
	].sort());
};

const block = (source, heading, language) => {
	const sections = source.split(heading + "\n"); assert.equal(sections.length, 2);
	const section = sections[1].split(/^#{1,3} /mu)[0];
	const blocks = [...section.matchAll(new RegExp("^```" + language + "\\n([^]*?)^```", "gmu"))];
	assert.equal(blocks.length, 1); return blocks[0][1];
};

/**
 * Tie the installed documentation consumer to the exact published source blocks.
 *
 * @param doc - One complete documentation build and installation report.
 */
export const assertOwnedPhpReceiverDocumentation = async doc => {
	flags(doc, ["cliIntegrated", "receiverExports", "producerRemoved"
		, "handoffRemoved", "sourceUnchanged", "relocated"]);
	assert.deepEqual(doc.mixedTargets, ["c", "php-native"]);
	const author = ownedPhpWasmReceiverHistoricalBytes("docs/publish/php.md"
		, await readFile("docs/publish/php.md")).toString("utf8");
	const consumer = ownedPhpWasmReceiverHistoricalBytes("docs/php.md"
		, await readFile("docs/php.md")).toString("utf8");
	const config = canonicalJson({ ...JSON.parse(block(author, "### Export resource-containing values", "json"))
		, ...JSON.parse(block(author, "### Export methods and properties", "json")) });
	assert.deepEqual(doc.sourceHashes, {
		lean: sha256(block(author, "### Export resource-containing values", "lean"))
		, config: sha256(config)
		, example: sha256(block(consumer, "### Methods and properties", "php"))
	});
	assert.deepEqual(doc.observations.map(item => item.caller), ["weak", "strict"]);
	for(const { observed } of doc.observations)
		assert.deepEqual(observed, { code: 0, stdout: "42\nexpired\n42\n", stderr: "" });
	assert.equal(doc.cliBuild.status, "ok"); assert.equal(doc.cliBuild.exitCode, 0);
	assert.deepEqual(doc.cliBuild.result.targets, ["c", "php-native"]);
	assert.equal(doc.verification.status, "ok");
	assert.equal(doc.verification.result.verificationType, "local-package-set");
	validatePackageSetReceipt(doc.packageSetReceipt);
	assert.deepEqual([...new Set(doc.packageSetReceipt.packages.map(pkg => pkg.target))].sort(), ["c", "php-native"]);
	assert.equal(doc.packageSetReceipt.profiles.length, 1);
	const php = doc.cliBuild.result.projections.find(projection => projection.ecosystem === "php-native");
	assert.equal(php.packages.length, 1); const [pkg] = php.packages;
	const entry = doc.packageSetReceipt.packages.find(pkg => pkg.target === "php-native");
	assert.deepEqual(entry.artifacts, [{ path: "archives/" + pkg.archive, bytes: pkg.bytes, sha256: pkg.sha256 }]);
	assert.equal(doc.installation.archiveSha256, pkg.sha256);
	const receipt = doc.installation.receipt;
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.ownedValues.schemaVersion, 4);
	assert.deepEqual(receipt.ownedValues.receiverExports.exports, [
		{ bindingId: "lean:Owned.callbackRecord", owner: "lean:Owned.Bundle", kind: "method", member: "callbackRecord" }
		, { bindingId: "lean:Owned.serial", owner: "lean:Owned.Ticket", kind: "property", member: "serial" }
	]);
	flags(doc.installation, ["emptyHome", "emptyCache", "offline", "lockedInstall"
		, "scriptsDisabled", "pluginsDisabled", "composerProjectRemoved"
		, "relocated", "compilerFree", "iniDisabled"]);
	validateBrickMathInstall(doc.installation, doc.installation.deployment);
	for(const [path, file] of Object.entries(receipt.files))
		assert.deepEqual(doc.inventory[`vendor/${receipt.name}/${path}`], file, path);
};

/**
 * Require one complete no-skip gate before accepting a frozen milestone receipt.
 *
 * @param record - Source-bound native PHP receiver acceptance.
 */
export const assertOwnedPhpReceiverExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedPhpReceiverScope);
	assert.equal(record.run.command, ownedPhpReceiverCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, value] of Object.entries({ tests: 16, pass: 16, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	const subtests = [...record.run.text.matchAll(/^# Subtest: (.+)$/gmu)].map(item => item[1]);
	assert.deepEqual(subtests.sort(), [
		"PHP receivers preserve native argument positions and nonreceiver generated sources"
		, "PHP receiver sources parse and native callback signatures compile"
		, "Composer receiver contracts authenticate nominal methods and read-only properties"
		, "native PHP receiver guides execute from an installed C/Composer release"
		, ...["ordinary", "reviewed"].flatMap(mode => [
			`PHP receiver methods and properties preserve original owners (${mode})`
			, ...[false, true].map(consuming => `PHP plain resource receivers (${mode}, consuming=${consuming})`)
			, `PHP receiver callbacks and closures need no result anchors (${mode})`
			, `installed Composer receiver methods retain original owners (${mode})`
			, `installed Composer resource receivers need no callback artifacts (${mode})`
		])
	].sort());
	await assertOwnedPhpReceiverRuntime(record);
	assert.deepEqual(record.packages.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.resourcePackages.map(item => item.mode), ["ordinary", "reviewed"]);
	for(const item of record.packages) await assertOwnedPhpReceiverPackage(item);
	for(const item of record.resourcePackages) await assertOwnedPhpReceiverPackage(item, true);
	await assertOwnedPhpReceiverDocumentation(record.documentation);
	assertOwnedPhpReceiverCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
