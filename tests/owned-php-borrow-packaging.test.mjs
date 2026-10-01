/**
 * Install actual Composer archives with original-owner PHP lifetime contracts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedPhpPackage, auditOwnedPhpPackage } from "../src/backends/php/owned-package.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedPhpEvidence } from "../src/build/owned-php-artifacts.mjs";
import { readVerifiedNativeComponent, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { packageOwnedPhp } from "../src/release/owned-composer.mjs";
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr, ownedRustBorrowSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedRustTransferReviewedIr } from "./helpers/owned-rust-transfer-fixture.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { installOwnedPhpArchive, ownedPhpInventory } from "./helpers/owned-php-installed.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { assertOwnedPhpCi } from "./helpers/owned-php-ci.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const explain = error => { throw new Error(`${error.message}: ${JSON.stringify(error.details ?? {})}`, { cause: error }); };
const capabilities = { transferredInputs: true, anchoredResults: true };

test("PHP borrow CI requires executed runtimes, installed archives and documentation", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const reports = [
		"build/owned-php-borrows/ordinary.json"
		, "build/owned-php-borrows/reviewed.json"
		, "build/owned-php-borrows/borrow-only.json"
		, "build/owned-php-borrow-packaging/ordinary.json"
		, "build/owned-php-borrow-packaging/reviewed.json"
		, "build/owned-php-borrow-packaging/documentation.json"
	];
	const verify = source => {
		assertOwnedPhpCi(source);
		const step = source.split("      - name: Execute owned native PHP values and source-free Composer releases\n")[1].split("      - name:")[0];
		assert.ok(step.includes("          npm run test:owned-php-borrows\n"));
		for(const report of reports) assert.ok(step.includes(`          test -s ${report}\n`), report);
		for(const directory of ["owned-php-borrows", "owned-php-borrow-packaging"])
			assert.ok(source.includes(`            build/${directory}/\n`));
		assert.ok(source.split("\n").find(line => line.includes("record --consumer php-native")).includes(" && npm run test:owned-php-borrows"));
	};
	verify(workflow);
	for(const removed of ["          npm run test:owned-php-borrows\n"
		, ...reports.map(report => `          test -s ${report}\n`)
		, "            build/owned-php-borrows/\n"
		, "            build/owned-php-borrow-packaging/\n"
		, " && npm run test:owned-php-borrows"])
		assert.throws(() => verify(workflow.replace(removed, "")));
	assert.equal((await json("package.json")).scripts["test:owned-php-borrows"], "LEAN_BRIDGE_OWNED_PHP_BORROW_TEST=1 LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-php-borrows.test.mjs tests/owned-php-borrow-packaging.test.mjs tests/owned-php-borrow-documentation.test.mjs");
});

test("PHP borrowed-result packages authenticate whole owners without changing unanchored releases", () => {
	const ir = ownedRustBorrowReviewedIr(), model = generateOwnedPhpPackage(ir, null, capabilities);
	assert.throws(() => generateOwnedPhpPackage(ir, null, { transferredInputs: true }), /explicit output leases/u);
	assert.equal(model.contract.schemaVersion, 3);
	assert.equal(model.contract.inputTransfers.arguments, "whole-values");
	assert.deepEqual(model.contract.resultAnchors, {
		schemaVersion: 1, values: "checked-whole-result"
		, anchor: "original-result-owner"
		, expiration: "owner-release-or-transfer", descendants: "transitive"
		, emptyValues: "owner-preserved", aliases: "shared-owner"
		, independentOwnership: "retain-or-copy_value"
		, copyType: "nominal-or-resultOf-or-parameterOf"
		, rawViews: "borrowed-from-whole-owner"
		, resourceEquality: "canonical-identity", invalidEquality: "raise"
		, transfers: "original-owner"
	});
	assert.ok(model.exports.includes("LeanOwnedAggregates\\Value"));
	assert.ok(model.exports.includes("LeanOwnedAggregates\\copy_value"));
	assert.equal(auditOwnedPhpPackage(ir, model.files, capabilities), true);
	for(const path of Object.keys(model.files))
		assert.throws(() => auditOwnedPhpPackage(ir, { ...model.files, [path]: model.files[path] + "\n" }, capabilities));
	const forged = structuredClone(model.files), manifest = JSON.parse(forged["binding-manifest.json"]);
	manifest.contract.resultAnchors.anchor = "retained-snapshot";
	forged["binding-manifest.json"] = canonicalJson(manifest);
	assert.throws(() => auditOwnedPhpPackage(ir, forged, capabilities));
	for(const fixture of [ownedAggregateReviewedIr, ownedRustTransferReviewedIr])
	{
		const original = generateOwnedPhpPackage(fixture(), null, { transferredInputs: true });
		const enabled = generateOwnedPhpPackage(fixture(), null, capabilities);
		assert.deepEqual(enabled.files, original.files);
		assert.deepEqual(enabled.contract, original.contract);
		assert.equal(enabled.nativeSource, original.nativeSource);
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`installed PHP borrowed results follow original owners (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_BORROW_TEST !== "1", timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-php-borrows-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer"), handoff = join(directory, "handoff");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + ownedRustBorrowSource);
	const settings = { name: "lean-bridge/owned-values", version: "1.2.3" };
	const config = mode === "ordinary" ? await ownedRustBorrowConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { "php-native": settings };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedRustBorrowReviewedIr()));
	const before = await lakeInputState(project);
	const environment = { ...nativeFixtureEnvironment([])
		, LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php"
		, LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer" };
	const leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX, cli = resolve("scripts/lean-bridge.mjs");
	const runtimeRoot = join(output, "native/runtime"), nativeRoot = join(output, "native/component"), adapterRoot = join(output, "native/owned-php-binding");
	t.diagnostic(`${mode}: compile borrowed-result Lean API and Composer archive`);
	const invocation = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "build", "--project", project, "--output", output, "--target", "php-native", "--json"]
		, cwd: directory, env: environment, timeoutMs: 1200000 }).catch(explain);
	const response = JSON.parse(invocation.stdout), built = await json(join(output, "native-release.json"));
	assert.equal(response.status, "ok"); assert.deepEqual(response.result.targets, ["php-native"]);
	assert.deepEqual(await lakeInputState(project), before);
	const options = { working: output, nativeRoot, runtimeRoot, leanPrefix, settings, environment, adapterRoot };
	const verified = await ownedPhpEvidence(options);
	assert.equal(verified.model.exports.length, 26); assert.equal(verified.model.schemaVersion, 9);
	assert.equal(verified.model.ownedGraph.resultAnchors.exports.length, 19);
	assert.equal(verified.model.ownedGraph.inputTransfers.exports.length, 4);
	assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(verified.adapter.schemaVersion, 3); assert.equal(verified.php.contract.schemaVersion, 3);
	assert.deepEqual(verified.adapter.ownedValues.resultAnchors, verified.model.ownedGraph.resultAnchors);
	await assert.rejects(readVerifiedNativeComponent(nativeRoot, verified.evidence.runtimeIdentity, {
		ownedGraphs: true, ownedHostCallbacks: true
		, ownedInputTransfers: true, ownedAnchoredResults: false
	}), /anchor/u);
	const repack = { ...options, glibcMinimumVersion: built.glibcMinimumVersion };
	const mutations = ["schema", "missing-anchor", "snapshot-anchor", "empties", "aliases", "export", "source", "boundary", "library"];
	for(const mutation of mutations)
	{
		const forged = structuredClone(verified.adapter); let path, original;
		if(mutation === "schema") forged.schemaVersion = 2;
		else if(mutation === "missing-anchor") delete forged.ownedValues.resultAnchors;
		else if(mutation === "snapshot-anchor") forged.phpValues.resultAnchors.anchor = "retained-snapshot";
		else if(mutation === "empties") forged.phpValues.resultAnchors.emptyValues = "unowned";
		else if(mutation === "aliases") forged.phpValues.inputTransfers.aliases = "wrapper-only";
		else if(mutation === "export") forged.ownedValues.resultAnchors.exports.pop();
		else
		{
			path = mutation === "source" ? `src/${verified.prefix}.c`
				: mutation === "boundary" ? `src/${verified.prefix}-php.c` : `lib/${verified.adapter.library}`;
			original = await readFile(join(adapterRoot, path));
			const changed = Buffer.concat([original, Buffer.from("\n/* changed lifetime adapter */\n")]);
			await saveLakeFile(adapterRoot, path, changed);
			if(mutation !== "library") forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		}
		await saveLakeFile(adapterRoot, "native-php-adapter.json", canonicalJson(forged));
		await assert.rejects(packageOwnedPhp({ ...repack, working: join(directory, `forged-${mutation}`) }));
		if(path) await saveLakeFile(adapterRoot, path, original);
		await saveLakeFile(adapterRoot, "native-php-adapter.json", canonicalJson(verified.adapter));
	}
	const reassembled = join(directory, "reassembled"), rebuilt = await packageOwnedPhp({ ...repack, working: reassembled });
	for(const [key, value] of Object.entries(rebuilt)) assert.deepEqual(built[key], value, key);
	const pkg = built.packages[0];
	assert.deepEqual(await readFile(join(reassembled, "archives", pkg.archive)), await readFile(join(output, "archives", pkg.archive)));
	const packageSet = await copyPackageSetHandoff(output, handoff);
	const input = { metadata: await json(join(nativeRoot, "metadata.json")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	for(const path of [project, output, reassembled])
	{ await rm(path, { recursive: true, force: true }); await assert.rejects(access(path), { code: "ENOENT" }); }
	const verification = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "verify", "--receipt", join(handoff, "package-set-receipt.json"), "--json"]
		, cwd: directory, env: copiedCleanEnvironment }).catch(explain);
	const verifiedSet = JSON.parse(verification.stdout); assert.equal(verifiedSet.status, "ok");
	t.diagnostic(`${mode}: offline Composer installation with producer removed`);
	const installed = await installOwnedPhpArchive({ root: join(directory, "consumer"), archive: join(handoff, "archives", pkg.archive), pkg, environment });
	await rm(handoff, { recursive: true, force: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const { deployment, php, runtimeOptions, environment: clean } = installed;
	const source = await readFile("tests/fixtures/structured-types/owned-installed-php-borrows.php", "utf8");
	const loaderSource = await readFile("tests/fixtures/structured-types/owned-installed-php-loader.php", "utf8");
	for(const caller of ["weak", "strict"])
		await saveLakeFile(deployment, `${caller}.php`, source.replace("strict_types=1", `strict_types=${caller === "strict" ? 1 : 0}`));
	await saveLakeFile(deployment, "loader.php", loaderSource);
	const inventory = await ownedPhpInventory(deployment), observations = [];
	const execute = args => runCopied(php, [...runtimeOptions, ...args], deployment, clean).catch(explain);
	for(const caller of ["weak", "strict"])
	{
		const result = await execute([`${caller}.php`]); assert.equal(result.stderr, "");
		assert.deepEqual(await execute([`${caller}.php`]), result);
		const observed = JSON.parse(result.stdout);
		assert.ok(observed.checks >= 150, JSON.stringify(observed)); assert.equal(observed.heldOriginalError, true);
		assert.equal(observed.ordinaryAutoload, true); assert.equal(observed.iniDisabled, true);
		assert.deepEqual(observed.functions, verified.php.functions.map(fn => fn.publicName).sort());
		observations.push({ caller, observed }); t.diagnostic(`${mode} ${caller}: ${observed.checks} checks, 26 exports`);
	}
	assert.deepEqual(observations[0].observed, observations[1].observed);
	const inspected = await execute(["loader.php"]); assert.equal(inspected.stderr, "");
	const loader = JSON.parse(inspected.stdout); assert.deepEqual(loader.consumer, observations[0].observed);
	assert.equal(loader.liveIdentities, 0); assert.equal(loader.privateGmp, true); assert.equal(loader.automaticShutdown, true);
	const packageRoot = join(deployment, "vendor", pkg.name), native = join(packageRoot, "native/linux-x64");
	const entry = ["-r", "require 'vendor/autoload.php'; LeanOwnedAggregates\\new_ticket(Brick\\Math\\BigInteger::of(1), 'load')->close();"];
	for(const name of Object.keys(verified.evidence.libraries))
	{
		const path = join(native, name), original = await readFile(path), corrupt = Buffer.from(original); corrupt[0] ^= 1;
		await saveLakeFile(native, name, corrupt);
		await assert.rejects(execute(entry), /differs from compiled evidence/u); await saveLakeFile(native, name, original);
	}
	const library = join(native, verified.adapter.library);
	await rename(library, library + ".original"); await symlink(library + ".original", library);
	await assert.rejects(execute(entry), /differs from compiled evidence/u);
	await rm(library); await assert.rejects(execute(entry), /differs from compiled evidence/u);
	await rename(library + ".original", library);
	const cold = await runCopied(php, ["-n", "-r", "require 'vendor/autoload.php'; try { LeanOwnedAggregates\\echo_array([]); } catch (TypeError $e) { echo 'cold'; }"], deployment, clean);
	assert.equal(cold.stdout, "cold"); assert.equal(cold.stderr, "");
	await verifyNativeFiles(packageRoot, installed.evidence.receipt.files);
	assert.deepEqual(await ownedPhpInventory(deployment), inventory);
	await saveLakeFile("build/owned-php-borrow-packaging", `${mode}.json`, canonicalJson({ schemaVersion: 1
		, planNode: 1219, mode, compiledLean: true, installedPackage: true
		, sourceUnchanged: true, sourceFreeInstallation: true
		, sourceFreeRelocatedExecution: true
		, handoffRemoved: true, deterministicReassembly: true, cliAdmission: true
		, cliBuild: response, packageSetReceipt: packageSet
		, receiptVerifiedWithoutProducer: true, verification: verifiedSet
		, tamperRejected: mutations
		, loaderRejected: ["changed-library", "symlink-library", "missing-library"]
		, sourceSha256: sha256(source), loaderSourceSha256: sha256(loaderSource)
		, observations, loader, installation: installed.evidence, inventory, input
		, componentReceipt: verified.receipt, adapterReceipt: verified.adapter, built
	}));
});
