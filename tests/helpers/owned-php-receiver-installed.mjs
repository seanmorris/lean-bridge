/**
 * Public installed receiver probes, relocated execution and loader rejection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, readFile, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { ownedPhpInventory } from "./owned-php-installed.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

/**
 * Remove installation scaffolding before repeating strict and weak consumers.
 *
 * @param options - Task-owned deployment, expected package and public consumer.
 */
export const inspectOwnedPhpReceiverDeployment = async options => {
	const { installed, pkg, source, directory, consumer, libraries, adapterLibrary } = options;
	let { deployment } = installed;
	assert.doesNotMatch(source, /Internal\\|FFI|owned_test_/u);
	const loaderSource = await readFile("tests/fixtures/structured-types/owned-installed-php-loader.php", "utf8");
	for(const caller of ["weak", "strict"])
		await saveLakeFile(deployment, `${caller}.php`, source.replace("strict_types=1", `strict_types=${caller === "strict" ? 1 : 0}`));
	await saveLakeFile(deployment, "loader.php", loaderSource);
	const inventory = await ownedPhpInventory(deployment), observations = [];
	const execute = args => runCopied(installed.php, [...installed.runtimeOptions, ...args], deployment, installed.environment)
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details ?? {})}`, { cause: error }); });
	for(const location of ["installed", "relocated-again"])
	{
		if(location === "relocated-again")
		{
			const relocated = join(directory, "runtime-only"); await rename(deployment, relocated); deployment = relocated;
			await rm(consumer, { recursive: true }); await assert.rejects(access(consumer), { code: "ENOENT" });
		}
		for(const caller of ["weak", "strict"])
		{
			const result = await execute([`${caller}.php`]); assert.equal(result.stderr, "");
			const observed = JSON.parse(result.stdout);
			assert.equal(observed.ordinaryAutoload, true); assert.equal(observed.iniDisabled, true);
			if(observations.length) assert.deepEqual(observed, observations[0].observed);
			observations.push({ location, caller, observed });
		}
		const result = await execute(["loader.php"]); assert.equal(result.stderr, "");
		const loader = JSON.parse(result.stdout);
		assert.deepEqual(loader.consumer, observations[0].observed);
		assert.equal(loader.liveIdentities, 0); assert.equal(loader.privateGmp, true); assert.equal(loader.automaticShutdown, true);
		observations.push({ location, loader, observed: loader.consumer });
		await verifyNativeFiles(join(deployment, "vendor", pkg.name), installed.evidence.receipt.files);
		assert.deepEqual(await ownedPhpInventory(deployment), inventory);
	}
	const native = join(deployment, "vendor", pkg.name, "native/linux-x64");
	const entry = ["-r", "require 'vendor/autoload.php'; LeanOwnedAggregates\\new_ticket(Brick\\Math\\BigInteger::of(1), 'load')->close();"];
	const loaderRejected = [];
	for(const name of Object.keys(libraries))
	{
		const original = await readFile(join(native, name)), corrupt = Buffer.from(original); corrupt[0] ^= 1;
		try
		{
			await saveLakeFile(native, name, corrupt);
			await assert.rejects(execute(entry), /differs from compiled evidence/u);
			loaderRejected.push({ kind: "changed-library", name });
		}
		finally
		{ await saveLakeFile(native, name, original); }
	}
	const library = join(native, adapterLibrary), backup = library + ".original";
	await rename(library, backup);
	try
	{
		await symlink(backup, library);
		await assert.rejects(execute(entry), /differs from compiled evidence/u);
		loaderRejected.push({ kind: "symlink-library", name: adapterLibrary });
		await rm(library);
		await assert.rejects(execute(entry), /differs from compiled evidence/u);
		loaderRejected.push({ kind: "missing-library", name: adapterLibrary });
	}
	finally
	{ await rm(library, { force: true }); await rename(backup, library); }
	const cold = await runCopied(installed.php, ["-n", "-r", "require 'vendor/autoload.php'; try { LeanOwnedAggregates\\new_ticket(1, 'invalid'); } catch (TypeError $e) { echo 'cold'; }"], deployment, installed.environment);
	assert.equal(cold.stdout, "cold"); assert.equal(cold.stderr, "");
	await verifyNativeFiles(join(deployment, "vendor", pkg.name), installed.evidence.receipt.files);
	assert.deepEqual(await ownedPhpInventory(deployment), inventory);
	return { observations, inventory, loaderRejected
		, coldValidationWithoutFfi: true
		, sourceSha256: sha256(source), loaderSourceSha256: sha256(loaderSource) };
};
