/**
 * Bind native PHP transfer claims to fresh Lean and source-free Composer calls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedBorrowHistoricalBytes } from "./owned-borrow-history.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedPhpCalls } from "../../src/backends/php/owned-calls.mjs";
import { generateOwnedPhpPackage } from "../../src/backends/php/owned-package.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustTransferSource } from "./owned-rust-transfer-fixture.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";
import { assertOwnedPhpCi } from "./owned-php-ci.mjs";

export const ownedPhpTransferCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-php-transfers";
export const ownedPhpTransferScope = Object.freeze({
	profiles: ["php-native"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, installedComposer: true, transferredInputs: true, publicExports: 26
	, consumingExports: 20, callerModes: ["weak", "strict"]
	, sharedAliases: true, independentRetains: true, callbackReentry: true
	, multipleInputHandoffs: true, recursiveValues: true
	, phpAllocationFaults: true, nativeAllocationFaults: true
	, retainedExceptions: true, forkRejection: true, fiberRejection: true
	, sourceFreeInstallation: true, offlineInstall: true
	, sourceFreeRelocatedExecution: true, deterministicReassembly: true
	, documentationExecuted: true, combinedCRelease: true
	, automaticShutdown: true, privateGmp: true
	, wasm: false, anchoredBorrowedResults: false, docker: false
	, otherConsumerBindings: false, installedSupportPromotions: 0
});
const digest = hash => assert.match(hash, /^[a-f0-9]{64}$/u);
const flags = (record, names) => { for(const name of names) assert.equal(record[name], true, name); };
const block = (text, heading, language) => {
	const section = text.split(heading + "\n")[1]?.split("\n### ")[0]; assert.ok(section, heading);
	const match = section.match(new RegExp("```" + language + "\\n([^]*?)\\n```"));
	assert.ok(match, heading + "/" + language); return match[1] + "\n";
};

/**
 * Require runtime, installation, source identity and documentation observations.
 *
 * @param record - Frozen execution reports from the enabled eight-test gate.
 */
export const assertOwnedPhpTransferExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedPhpTransferScope);
	assert.equal(record.run.command, ownedPhpTransferCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, value] of Object.entries({ tests: 8, pass: 8, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.consumers.map(item => item.mode), ["ordinary", "reviewed"]);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8") + ownedRustTransferSource;
	const privateHash = sha256(await readFile("tests/fixtures/structured-types/owned-php-transfers.php"));
	const consumerHash = sha256(await readFile("tests/fixtures/structured-types/owned-installed-php-transfers.php"));
	for(const item of [...record.runtime, ...record.consumers])
	{
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		const extractor = "src/analyze/NativeExports.lean", expectedExtractor = item.input.sourceIdentity.extractorSha256;
		assert.equal(sha256(ownedBorrowHistoricalBytes(extractor, await readFile(extractor), expectedExtractor)), expectedExtractor);
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true });
		assert.equal(model.schemaVersion, 8); assert.equal(model.exports.length, 26);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 20);
		const calls = generateOwnedPhpCalls(model.bindingIr, { transferredInputs: true });
		if(record.runtime.includes(item))
		{
			assert.equal(item.compiledLean, true); assert.equal(item.installedPackage, false);
			assert.equal(item.consumerSha256, privateHash); digest(item.nativeSourceSha256);
			assert.deepEqual(item.generated, Object.fromEntries(Object.entries(calls.files).map(([path, text]) => [path, sha256(text)])));
			assert.equal(item.observed.checks, 2272); assert.equal(item.observed.heldErrors, 285);
			assert.deepEqual(item.observed.functions, calls.functions.map(fn => fn.name).sort());
			assert.equal(item.observed.live, 0); assert.equal(item.observed.identities, 0);
			for(const shape of ["single", "multiple"]) for(const domain of ["php", "native"]) for(const phase of ["before", "after"])
				assert.ok(Number.isSafeInteger(item.observed.faults[shape][domain][phase]) && item.observed.faults[shape][domain][phase] > 0);
			continue;
		}
		flags(item, ["compiledLean", "installedPackage", "sourceUnchanged"
			, "sourceFreeInstallation", "sourceFreeRelocatedExecution", "handoffRemoved"
			, "deterministicReassembly", "cliAdmission"
			, "receiptVerifiedWithoutProducer"]);
		assert.equal(item.sourceSha256, consumerHash);
		assert.equal(item.loaderSourceSha256, sha256(await readFile("tests/fixtures/structured-types/owned-installed-php-loader.php")));
		assert.equal(item.cliBuild.status, "ok"); assert.equal(item.verification.status, "ok");
		assert.equal(item.verification.result.verificationType, "local-package-set");
		validatePackageSetReceipt(item.packageSetReceipt);
		assert.equal(item.componentReceipt.schemaVersion, 4);
		assert.deepEqual(item.componentReceipt.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(item.adapterReceipt.schemaVersion, 2);
		assert.deepEqual(item.adapterReceipt.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
		const generated = generateOwnedPhpPackage(model.bindingIr, null, { transferredInputs: true });
		assert.deepEqual(item.adapterReceipt.phpValues, generated.contract);
		assert.deepEqual(item.observations.map(value => value.caller), ["weak", "strict"]);
		for(const { observed } of item.observations)
		{
			assert.equal(observed.checks, 277); flags(observed, ["ordinaryAutoload", "iniDisabled", "heldOriginalError"]);
			assert.deepEqual(observed.functions, calls.functions.map(fn => fn.publicName).sort());
		}
		assert.deepEqual(item.observations[0].observed, item.observations[1].observed);
		assert.deepEqual(item.loader.consumer, item.observations[0].observed);
		flags(item.loader, ["privateGmp", "automaticShutdown"]); assert.equal(item.loader.liveIdentities, 0);
		assert.equal(item.loader.idleSessionIdentities, 1);
		assert.deepEqual(item.tamperRejected, ["schema", "missing", "aliases", "consumption", "borrowed", "export", "source", "boundary", "library"]);
		assert.deepEqual(item.loaderRejected, ["changed-library", "symlink-library", "missing-library"]);
		flags(item.installation, ["emptyHome", "emptyCache", "offline"
			, "lockedInstall"
			, "scriptsDisabled", "pluginsDisabled", "composerProjectRemoved"
			, "relocated", "compilerFree", "iniDisabled"]);
		validateBrickMathInstall(item.installation, item.installation.deployment);
		assert.deepEqual(item.installation.receipt.ownedValues, generated.contract);
		assert.equal(item.installation.archiveSha256, item.built.packages[0].sha256);
		for(const [path, identity] of Object.entries(item.installation.receipt.files))
			assert.deepEqual(item.inventory[`vendor/${item.installation.receipt.name}/${path}`], identity, path);
	}
	const author = await readFile("docs/publish/php.md", "utf8"), consumer = await readFile("docs/php.md", "utf8");
	const config = canonicalJson({ ...JSON.parse(block(author, "### Export resource-containing values", "json"))
		, ...JSON.parse(block(author, "### Export consuming inputs", "json")) });
	const doc = record.documentation;
	flags(doc, ["cliIntegrated", "producerRemoved", "handoffRemoved", "sourceUnchanged", "relocated"]);
	assert.deepEqual(doc.mixedTargets, ["c", "php-native"]);
	assert.deepEqual(doc.sourceHashes, { lean: sha256(block(author, "### Export resource-containing values", "lean"))
		, config: sha256(config)
		, example: sha256(block(consumer, "### Consuming inputs", "php")) });
	assert.equal(doc.observed.stdout, "42\n42\nclosed\n"); assert.equal(doc.observed.stderr, "");
	validatePackageSetReceipt(doc.packageSetReceipt); assert.equal(doc.verification.status, "ok");
	assertOwnedPhpCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
};
