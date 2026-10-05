/**
 * Installed CLI builds and source-free Composer receiver consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { generateOwnedPhpPackage, auditOwnedPhpPackage } from "../src/backends/php/owned-package.mjs";
import { ownedPhpEvidence } from "../src/build/owned-php-artifacts.mjs";
import { packageOwnedPhp } from "../src/release/owned-composer.mjs";
import { readVerifiedNativeComponent } from "../src/build/native-artifacts.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./helpers/owned-rust-receiver-fixture.mjs";
import { ownedJvmPlainReceiverReviewedIr } from "./helpers/owned-jvm-receiver-fixture.mjs";
import { prepareOwnedReceiverCli } from "./helpers/owned-receiver-cli.mjs";
import { ownedPhpInstalledReceiverProbe } from "./helpers/owned-php-receiver-fixture.mjs";
import { installOwnedPhpArchive } from "./helpers/owned-php-installed.mjs";
import { inspectOwnedPhpReceiverDeployment } from "./helpers/owned-php-receiver-installed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const capabilities = { transferredInputs: true, anchoredResults: true, receiverExports: true };
const json = async path => JSON.parse(await readFile(path, "utf8"));

test("Composer receiver contracts authenticate nominal methods and read-only properties", async () => {
	const ir = ownedRustReceiverReviewedIr(), model = generateOwnedPhpPackage(ir, null, capabilities);
	assert.equal(model.contract.schemaVersion, 4);
	assert.equal(model.contract.receiverExports.exports.length, 16);
	assert.equal(model.contract.inputTransfers.arguments, "whole-values");
	assert.equal(model.contract.receiverExports.properties, "read-only-virtual-properties");
	for(const entry of model.contract.receiverExports.exports)
		assert.equal(entry.kind, ir.declarations.find(fn => fn.id === entry.bindingId).kind);
	assert.ok(model.exports.includes("LeanOwnedAggregates\\TicketValue"));
	assert.equal(auditOwnedPhpPackage(ir, model.files, capabilities), true);
	const policies = [["members", "snake-case"], ["properties", "writable"]
		, ["owners", "untyped"]
		, ["consumingReceivers", "copied-owner-handoff"]
		, ["resourceEquality", "wrapper-identity"], ["invalidEquality", "false"]];
	for(const [key, value] of policies)
	{
		const files = { ...model.files }, manifest = JSON.parse(files["binding-manifest.json"]);
		manifest.contract.receiverExports[key] = value;
		files["binding-manifest.json"] = canonicalJson(manifest);
		assert.throws(() => auditOwnedPhpPackage(ir, files, capabilities), /differs/u);
	}
	for(const consuming of [false, true])
	{
		const plain = generateOwnedPhpPackage(ownedJvmPlainReceiverReviewedIr(consuming), null, { ...capabilities, hostCallbacks: false });
		assert.equal(plain.contract.resultAnchors, undefined);
		assert.equal(plain.contract.callbackLifetime, undefined);
		assert.equal(plain.contract.callbackFailure, undefined);
		assert.doesNotMatch(plain.files["README.md"], /Pass synchronous PHP callables|with_recovery/u);
		assert.equal(auditOwnedPhpPackage(plain.c.native.model.bindingIr, plain.files, { ...capabilities, hostCallbacks: false }), true);
	}
	assert.doesNotMatch(await ownedPhpInstalledReceiverProbe(), /Internal\\|FFI|owned_test_/u);
});

for(const mode of ["ordinary", "reviewed"]) test(`installed Composer receiver methods retain original owners (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_RECEIVER_TEST !== "1", timeout: 2400000
}, async t => {
	const settings = { name: "lean-bridge/owned-values", version: "1.2.3" };
	const configuration = mode === "ordinary" ? await ownedRustReceiverConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = { ...mode === "reviewed" ? { c: {} } : {}, "php-native": settings };
	const prepared = await prepareOwnedReceiverCli(t, {
		label: `php-receiver-package-${mode}`, configuration
		, source: ownedRustReceiverSource
		, reviewedIr: mode === "reviewed" ? ownedRustReceiverReviewedIr() : undefined
		, profiles: [], buildTimeoutMs: 1200000
		, environment: { LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php"
			, LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer" }
	});
	const { directory, output, handoff, consumer, environment } = prepared;
	const release = await prepared.build(output);
	const built = release.projections?.find(entry => entry.ecosystem === "php-native") ?? release;
	assert.equal(built.ecosystem, "php-native");
	const options = { working: output, nativeRoot: join(output, "native/component")
		, runtimeRoot: join(output, "native/runtime")
		, adapterRoot: join(output, "native/owned-php-binding")
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX, settings, environment };
	const verified = await ownedPhpEvidence(options);
	assert.equal(verified.model.schemaVersion, 10); assert.equal(verified.model.exports.length, 27);
	assert.equal(verified.adapter.schemaVersion, 4); assert.equal(verified.php.contract.schemaVersion, 4);
	assert.equal(verified.model.ownedGraph.receiverExports.exports.length, 16);
	assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.deepEqual(verified.adapter.ownedValues.receiverExports, verified.model.ownedGraph.receiverExports);
	await assert.rejects(readVerifiedNativeComponent(options.nativeRoot, verified.evidence.runtimeIdentity, {
		ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true
		, ownedAnchoredResults: true, ownedReceiverExports: false
	}));
	const repack = { ...options, glibcMinimumVersion: built.glibcMinimumVersion };
	const mutations = ["missing-receivers", "native-slot", "member", "property", "owner", "consumption", "equality", "invalid-equality", "member-kind", "export"];
	for(const mutation of mutations)
	{
		const forged = structuredClone(verified.adapter);
		if(mutation === "missing-receivers") delete forged.ownedValues.receiverExports;
		else if(mutation === "native-slot") forged.ownedValues.receiverExports.exports.pop();
		else if(mutation === "member") forged.phpValues.receiverExports.members = "snake-case";
		else if(mutation === "property") forged.phpValues.receiverExports.properties = "writable";
		else if(mutation === "owner") forged.phpValues.receiverExports.owners = "untyped";
		else if(mutation === "consumption") forged.phpValues.receiverExports.consumingReceivers = "snapshot";
		else if(mutation === "equality") forged.phpValues.receiverExports.resourceEquality = "wrapper-identity";
		else if(mutation === "invalid-equality") forged.phpValues.receiverExports.invalidEquality = "false";
		else if(mutation === "member-kind") forged.phpValues.receiverExports.exports.find(entry => entry.kind === "property").kind = "method";
		else forged.phpValues.receiverExports.exports.pop();
		try
		{
			await saveLakeFile(options.adapterRoot, "native-php-adapter.json", canonicalJson(forged));
			await assert.rejects(packageOwnedPhp({ ...repack, working: join(directory, `forged-${mutation}`) }), /differs/u);
		}
		finally
		{ await saveLakeFile(options.adapterRoot, "native-php-adapter.json", canonicalJson(verified.adapter)); }
	}
	const independent = join(directory, "independent"), rebuilt = await prepared.build(independent);
	const rebuiltPhp = rebuilt.projections?.find(entry => entry.ecosystem === "php-native") ?? rebuilt;
	assert.deepEqual(rebuiltPhp.packages, built.packages);
	const pkg = built.packages[0];
	assert.deepEqual(await readFile(join(independent, "archives", pkg.archive)), await readFile(join(output, "archives", pkg.archive)));
	await rm(independent, { recursive: true }); await assert.rejects(access(independent), { code: "ENOENT" });
	const packageSet = await copyPackageSetHandoff(output, handoff);
	const input = {
		metadata: await json(join(options.nativeRoot, "metadata.json"))
			, sourceIdentity: verified.model.sourceIdentity
			, component: verified.model.component };
	const verification = await prepared.removeAuthor();
	const installed = await installOwnedPhpArchive({ root: consumer, archive: join(handoff, "archives", pkg.archive), pkg, environment });
	await rm(handoff, { recursive: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const source = await ownedPhpInstalledReceiverProbe();
	const inspected = await inspectOwnedPhpReceiverDeployment({
		installed, pkg, source, directory, consumer
		, libraries: verified.evidence.libraries
		, adapterLibrary: verified.adapter.library });
	for(const { observed } of inspected.observations)
	{
		assert.ok(observed.checks >= 200); assert.equal(observed.heldOriginalError, true);
		assert.deepEqual(observed.functions, verified.php.functions.map(fn => fn.publicName).sort());
	}
	t.diagnostic(`${mode}: ${inspected.observations[0].observed.checks} public checks, weak/strict calls repeated after relocation`);
	await saveLakeFile("build/owned-php-receiver-packaging", `${mode}.json`, canonicalJson({ schemaVersion: 1
		, mode, compiledLean: true, installedPackage: true, sourceUnchanged: true
		, sourceFreeInstallation: true, sourceFreeRelocatedExecution: true
		, handoffRemoved: true, independentBuild: true, cliAdmission: true
		, cliPackage: prepared.cli, cliInstallation: prepared.cliInstallation
		, cliBuilds: prepared.builds, packageSetReceipt: packageSet, verification
		, tamperRejected: mutations, installation: installed.evidence
		, input, componentReceipt: verified.receipt
		, adapterReceipt: verified.adapter, built
		, ...inspected
	}));
});
