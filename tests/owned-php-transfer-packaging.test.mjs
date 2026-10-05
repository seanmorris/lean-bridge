/**
 * Source-free Composer installs of compiler-selected consuming PHP APIs.
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
import { ownedRustTransferConfiguration, ownedRustTransferReviewedIr, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { installOwnedPhpArchive, ownedPhpInventory } from "./helpers/owned-php-installed.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { assertOwnedPhpCi } from "./helpers/owned-php-ci.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const explain = error => { throw new Error(`${error.message}: ${JSON.stringify(error.details ?? {})}`, { cause: error }); };

test("PHP transfer CI requires native execution and every private, installed and documentation report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const verify = source => {
		assertOwnedPhpCi(source);
		const step = source.split("      - name: Execute owned native PHP values and source-free Composer releases\n")[1].split("      - name:")[0];
		assert.ok(step.includes("          npm run test:owned-php-transfers\n"));
		for(const directory of ["transfers", "transfer-packaging"])
		{
			assert.ok(source.includes(`            build/owned-php-${directory}/\n`));
			for(const mode of ["ordinary", "reviewed"])
				assert.ok(step.includes(`          test -s build/owned-php-${directory}/${mode}.json\n`));
		}
		assert.ok(step.includes("          test -s build/owned-php-transfer-packaging/documentation.json\n"));
		assert.ok(source.split("\n").find(line => line.includes("record --consumer php-native")).includes(" && npm run test:owned-php-transfers"));
	};
	verify(workflow);
	const command = (await json("package.json")).scripts["test:owned-php-transfers"];
	assert.equal(command, "LEAN_BRIDGE_OWNED_PHP_TRANSFER_TEST=1 LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-php-transfers.test.mjs tests/owned-php-transfer-packaging.test.mjs tests/owned-php-documentation.test.mjs");
	for(const removed of ["          npm run test:owned-php-transfers\n"
		, "          test -s build/owned-php-transfers/ordinary.json\n"
		, "          test -s build/owned-php-transfer-packaging/reviewed.json\n"
		, "          test -s build/owned-php-transfer-packaging/documentation.json\n"
		, "            build/owned-php-transfer-packaging/\n"
		, " && npm run test:owned-php-transfers"])
		assert.throws(() => verify(workflow.replace(removed, "")));
});

test("PHP transfer packages bind consuming semantics and retain borrowed package bytes", () => {
	const ir = ownedRustTransferReviewedIr(), options = { transferredInputs: true };
	assert.throws(() => generateOwnedPhpPackage(ir), /call-scoped input borrows/u);
	const model = generateOwnedPhpPackage(ir, null, options);
	assert.equal(model.contract.schemaVersion, 2);
	assert.deepEqual(model.contract.inputTransfers, { schemaVersion: 1
		, arguments: "ordinary-values", consumption: "before-lean-call"
		, validation: "before-consumption", failure: "consumed-after-handoff"
		, aliases: "shared-lease", borrowedInputs: "reject"
		, independentRetains: "preserved" });
	assert.equal(model.files["src/Api.php"].split("Consumes resource leases in ").length - 1, 20);
	assert.match(model.files["README.md"], /Two consuming arguments cannot share one owner/u);
	assert.equal(auditOwnedPhpPackage(ir, model.files, options), true);
	assert.throws(() => auditOwnedPhpPackage(ir, model.files));
	for(const path of Object.keys(model.files))
		assert.throws(() => auditOwnedPhpPackage(ir, { ...model.files, [path]: model.files[path] + "\n" }, options));
	const borrowed = ownedDotnetCallbacksReviewedIr();
	const enabled = generateOwnedPhpPackage(borrowed, null, options), original = generateOwnedPhpPackage(borrowed);
	assert.deepEqual(enabled.files, original.files); assert.deepEqual(enabled.contract, original.contract);
	assert.equal(enabled.nativeSource, original.nativeSource);
});

for(const mode of ["ordinary", "reviewed"]) test(`installed PHP consuming inputs survive source removal (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_TRANSFER_TEST !== "1", timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-php-transfers-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer"), handoff = join(directory, "handoff");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + ownedRustTransferSource);
	const settings = { name: "lean-bridge/owned-values", version: "1.2.3" };
	const config = mode === "ordinary" ? await ownedRustTransferConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { "php-native": settings };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedRustTransferReviewedIr()));
	const before = await lakeInputState(project);
	const environment = { ...nativeFixtureEnvironment([])
		, LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php"
		, LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer" };
	const leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	const runtimeRoot = join(output, "native/runtime"), nativeRoot = join(output, "native/component");
	const adapterRoot = join(output, "native/owned-php-binding"), cli = resolve("scripts/lean-bridge.mjs");
	t.diagnostic(`${mode}: build consuming Lean component and Composer archive`);
	const invocation = await processBuildRunner.capture({ command: process.execPath
		, args: [cli, "build", "--project", project, "--output", output, "--target", "php-native", "--json"]
		, cwd: directory, env: environment, timeoutMs: 1200000 }).catch(explain);
	const response = JSON.parse(invocation.stdout), built = await json(join(output, "native-release.json"));
	assert.equal(response.status, "ok"); assert.deepEqual(response.result.targets, ["php-native"]);
	assert.deepEqual(await lakeInputState(project), before);
	const options = { working: output, nativeRoot, runtimeRoot, leanPrefix, settings, environment, adapterRoot };
	const verified = await ownedPhpEvidence(options);
	assert.equal(verified.model.exports.length, 26); assert.equal(verified.model.schemaVersion, 8);
	assert.equal(verified.model.ownedGraph.inputTransfers.exports.length, 20);
	assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(verified.adapter.schemaVersion, 2); assert.equal(verified.php.contract.schemaVersion, 2);
	assert.deepEqual(verified.adapter.ownedValues.inputTransfers, verified.model.ownedGraph.inputTransfers);
	await assert.rejects(readVerifiedNativeComponent(nativeRoot, verified.evidence.runtimeIdentity, {
		ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: false
	}), /input-transfer/u);
	const repack = { ...options, glibcMinimumVersion: built.glibcMinimumVersion };
	const mutations = ["schema", "missing", "aliases", "consumption", "borrowed", "export", "source", "boundary", "library"];
	for(const mutation of mutations)
	{
		const forged = structuredClone(verified.adapter); let path, original;
		if(mutation === "schema") forged.schemaVersion = 1;
		else if(mutation === "missing") delete forged.ownedValues.inputTransfers;
		else if(mutation === "aliases") forged.phpValues.inputTransfers.aliases = "wrapper-only";
		else if(mutation === "consumption") forged.ownedValues.inputTransfers.consumption = "after-lean-call";
		else if(mutation === "borrowed") forged.phpValues.inputTransfers.borrowedInputs = "consume";
		else if(mutation === "export") forged.ownedValues.inputTransfers.exports.pop();
		else
		{
			path = mutation === "source" ? `src/${verified.prefix}.c`
				: mutation === "boundary" ? `src/${verified.prefix}-php.c` : `lib/${verified.adapter.library}`;
			original = await readFile(join(adapterRoot, path));
			const changed = Buffer.concat([original, Buffer.from("\n/* modified consuming adapter */\n")]);
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
	t.diagnostic(`${mode}: offline Composer install with producer removed`);
	const installed = await installOwnedPhpArchive({ root: join(directory, "consumer"), archive: join(handoff, "archives", pkg.archive), pkg, environment });
	await rm(handoff, { recursive: true, force: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const { deployment, php, runtimeOptions, environment: clean } = installed;
	const source = await readFile("tests/fixtures/structured-types/owned-installed-php-transfers.php", "utf8");
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
		assert.ok(observed.checks > 200); assert.equal(observed.heldOriginalError, true);
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
	const cold = await runCopied(php, ["-n", "-r", "require 'vendor/autoload.php'; try { LeanOwnedAggregates\\transfer_callback(fn($v) => $v); } catch (TypeError $e) { echo 'cold'; }"], deployment, clean);
	assert.equal(cold.stdout, "cold"); assert.equal(cold.stderr, "");
	await verifyNativeFiles(packageRoot, installed.evidence.receipt.files);
	assert.deepEqual(await ownedPhpInventory(deployment), inventory);
	await saveLakeFile("build/owned-php-transfer-packaging", `${mode}.json`, canonicalJson({ schemaVersion: 1
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
		, componentReceipt: verified.receipt, adapterReceipt: verified.adapter
		, built }));
});
