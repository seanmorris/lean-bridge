/**
 * Actual source-free Composer installs of fresh ordinary and reviewed Lean APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { ownedPhpEvidence } from "../src/build/owned-php-artifacts.mjs";
import { projectOwnedPhp } from "../src/build/owned-php-projection.mjs";
import { packageOwnedPhp } from "../src/release/owned-composer.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { installOwnedPhpArchive, ownedPhpInventory } from "./helpers/owned-php-installed.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const explain = error => { error.message += `: ${JSON.stringify(error.details ?? {})}`; throw error; };

for(const mode of ["ordinary", "reviewed"]) test(`owned PHP Composer archive installs without producer sources (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-owned-php-composer-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer"), handoff = join(directory, "handoff");
	await cp(resolve("tests/fixtures/onboarding/owned-dotnet-callables"), project, { recursive: true });
	const settings = { name: "lean-bridge/owned-values", version: "1.2.3" };
	const config = mode === "ordinary" ? await json(join(project, "lean-bridge.exports.json")) : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { "php-native": settings };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedDotnetCallbacksReviewedIr()));
	const before = await lakeInputState(project);
	const environment = { ...nativeFixtureEnvironment([])
		, LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php"
		, LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer" };
	const leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	const runtimeRoot = join(output, "native/runtime"), nativeRoot = join(output, "native/component");
	const adapterRoot = join(output, "native/owned-php-binding");
	t.diagnostic(`${mode}: fresh runtime and Lean component`);
	await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix }).catch(explain);
	await buildNativeComponent({ projectRoot: project, outputRoot: nativeRoot
		, runtimeRoot, leanPrefix, targets: ["c"]
		, ownedGraphs: true, ownedHostCallbacks: true }).catch(explain);
	t.diagnostic(`${mode}: isolated GMP, native PHP adapter and Composer archive`);
	const options = { working: output, nativeRoot, runtimeRoot, leanPrefix, settings, environment };
	const built = await projectOwnedPhp(options).catch(explain);
	assert.equal(built.backend, "owned-php-cli-ffi-v1");
	assert.deepEqual(await lakeInputState(project), before);
	const verified = await ownedPhpEvidence({ ...options, adapterRoot });
	assert.equal(verified.model.exports.length, 51);
	assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(verified.needed[0], "libgmp-lean-bridge.so.10");
	const repack = { ...options, adapterRoot, glibcMinimumVersion: built.glibcMinimumVersion };
	const mutations = ["lifetime", "unknown-field", "source", "boundary", "gmp-receipt", "gmp-source", "library", "unrecorded"];
	for(const mutation of mutations)
	{
		const forged = structuredClone(verified.adapter); let path, original;
		if(mutation === "lifetime") forged.phpValues.callbackLifetime = "retained";
		else if(mutation === "unknown-field") forged.unknown = true;
		else
		{
			path = ({ source: `src/${verified.prefix}.c`
				, boundary: `src/${verified.prefix}-php.c`
				, "gmp-receipt": "gmp/share/lean-bridge/gmp.json"
				, "gmp-source": "gmp/share/lean-bridge/sources/gmp-6.3.0.tar.xz"
				, library: `lib/${verified.adapter.library}`
				, unrecorded: "unexpected.txt" })[mutation];
			original = mutation === "unrecorded" ? null : await readFile(join(adapterRoot, path));
			const changed = mutation === "gmp-receipt" ? Buffer.from(canonicalJson({ ...JSON.parse(original), binding: "global-symbols" }))
				: Buffer.concat([original ?? Buffer.alloc(0), Buffer.from("\n/* modified projection */\n")]);
			await saveLakeFile(adapterRoot, path, changed);
			if(!["library", "unrecorded"].includes(mutation)) forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		}
		await saveLakeFile(adapterRoot, "native-php-adapter.json", canonicalJson(forged));
		await assert.rejects(packageOwnedPhp({ ...repack, working: join(directory, `forged-${mutation}`) }));
		if(path)
		{
			if(original) await saveLakeFile(adapterRoot, path, original);
			else await rm(join(adapterRoot, path));
		}
		await saveLakeFile(adapterRoot, "native-php-adapter.json", canonicalJson(verified.adapter));
	}
	const reassembled = join(directory, "reassembled"), rebuilt = await packageOwnedPhp({ ...repack, working: reassembled });
	assert.deepEqual(rebuilt, built);
	const pkg = built.packages[0];
	assert.deepEqual(await readFile(join(reassembled, "archives", pkg.archive)), await readFile(join(output, "archives", pkg.archive)));
	await cp(join(output, "archives"), handoff, { recursive: true });
	const input = { metadata: await json(join(nativeRoot, "metadata.json")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	for(const path of [project, output, reassembled])
	{
		await rm(path, { recursive: true, force: true });
		await assert.rejects(access(path), { code: "ENOENT" });
	}
	t.diagnostic(`${mode}: offline Composer install after producer removal`);
	const installed = await installOwnedPhpArchive({ root: join(directory, "consumer"), archive: join(handoff, pkg.archive), pkg, environment });
	await rm(handoff, { recursive: true, force: true });
	await assert.rejects(access(handoff), { code: "ENOENT" });
	const { deployment, php, runtimeOptions, environment: clean } = installed;
	const source = await readFile("tests/fixtures/structured-types/owned-installed-php.php", "utf8");
	const loaderSource = await readFile("tests/fixtures/structured-types/owned-installed-php-loader.php", "utf8");
	for(const caller of ["weak", "strict"]) await saveLakeFile(deployment, `${caller}.php`, source.replace("strict_types=1", `strict_types=${caller === "strict" ? 1 : 0}`));
	await saveLakeFile(deployment, "loader.php", loaderSource);
	const inventory = await ownedPhpInventory(deployment), observations = [];
	const execute = args => runCopied(php, [...runtimeOptions, ...args], deployment, clean);
	for(const caller of ["weak", "strict"])
	{
		const result = await execute([`${caller}.php`]); assert.equal(result.stderr, "");
		assert.deepEqual(await execute([`${caller}.php`]), result);
		assert.deepEqual(await ownedPhpInventory(deployment), inventory);
		const observed = JSON.parse(result.stdout);
		assert.equal(observed.primitives, 19); assert.ok(observed.checks > 200);
		assert.equal(observed.ordinaryAutoload, true); assert.equal(observed.iniDisabled, true);
		assert.deepEqual(observed.functions, verified.php.functions.map(fn => fn.publicName).sort());
		observations.push({ caller, observed }); t.diagnostic(`${mode} ${caller}: ${observed.checks} checks, 51 public functions`);
	}
	assert.deepEqual(observations[0].observed, observations[1].observed);
	const inspected = await execute(["loader.php"]); assert.equal(inspected.stderr, "");
	const loader = JSON.parse(inspected.stdout); assert.deepEqual(loader.consumer, observations[0].observed);
	assert.equal(loader.liveIdentities, 0); assert.equal(loader.privateGmp, true);
	assert.equal(loader.idleSessionIdentities, 1); assert.equal(loader.automaticShutdown, true);
	assert.deepEqual(Object.keys(loader.mappings).sort(), Object.keys(verified.evidence.libraries).sort());
	const packageRoot = join(deployment, "vendor", pkg.name), native = join(packageRoot, "native/linux-x64");
	const entry = ["-r", "require 'vendor/autoload.php'; LeanOwnedAggregates\\new_ticket(Brick\\Math\\BigInteger::of(1), 'load')->close();"];
	for(const name of Object.keys(verified.evidence.libraries))
	{
		const path = join(native, name), original = await readFile(path), corrupt = Buffer.from(original); corrupt[0] ^= 1;
		await saveLakeFile(native, name, corrupt);
		await assert.rejects(execute(entry), error => /differs from compiled evidence/u.test(error.details?.stderr));
		await saveLakeFile(native, name, original);
	}
	const library = join(native, verified.adapter.library);
	await rename(library, library + ".original"); await symlink(library + ".original", library);
	await assert.rejects(execute(entry), error => /differs from compiled evidence/u.test(error.details?.stderr));
	await rm(library); await rename(library + ".original", library);
	await rename(library, library + ".original");
	await assert.rejects(execute(entry), error => /differs from compiled evidence/u.test(error.details?.stderr));
	await rename(library + ".original", library);
	await assert.rejects(runCopied(php, [...runtimeOptions, ...entry], deployment, { ...clean, LD_PRELOAD: join(native, "libleanshared.so") }), error => /foreign Lean runtime/u.test(error.details?.stderr));
	const cold = await runCopied(php, ["-n", "-r", "require 'vendor/autoload.php'; try { LeanOwnedAggregates\\new_ticket(1, 'invalid'); } catch (TypeError $e) { echo 'cold'; }"], deployment, clean);
	assert.equal(cold.stdout, "cold"); assert.equal(cold.stderr, "");
	await verifyNativeFiles(packageRoot, installed.evidence.receipt.files);
	assert.deepEqual(await ownedPhpInventory(deployment), inventory);
	await saveLakeFile("build/owned-php-packaging", `${mode}.json`, canonicalJson({ schemaVersion: 1
		, planNode: 1219
		, mode, compiledLean: true, installedPackage: true, sourceUnchanged: true
		, sourceFreeInstallation: true, sourceFreeRelocatedExecution: true
		, handoffRemoved: true
		, deterministicReassembly: true, cliAdmission: false, needed: verified.needed
		, tamperRejected: mutations
		, loaderRejected: ["changed-library", "symlink-library", "missing-library", "foreign-runtime"]
		, sourceSha256: sha256(source)
		, loaderSourceSha256: sha256(loaderSource)
		, observations, loader, installation: installed.evidence, inventory, input
		, componentReceipt: verified.receipt, adapterReceipt: verified.adapter
		, built }));
});
