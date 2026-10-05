/**
 * Separate failure probes leave original installed Composer files unchanged.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { phpFfiType } from "../../src/backends/php/callables.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Inject converter failures and recheck the unchanged public consumers.
 *
 * @param options - Receipt-bound deployment and private converter identities.
 * @param options.consumer - Task-owned scratch outside the deployment.
 * @param options.environment - Explicit PHP binary.
 * @param options.installed - Original Composer package and public execution evidence.
 * @param options.projection - Private indices used only by the fault probe.
 */
export const probePhpCollections = async ({ consumer, environment, installed, projection }) => {
	const deployment = join(consumer, "php-native/relocated");
	const source = await readFile("tests/fixtures/collection-consumers/php-faults.php", "utf8");
	const request = {
		functions: Object.fromEntries(projection.surface.functions.map((fn, index) => [fn.field, { call: `call${index}` }]))
		, scalars: Object.fromEntries(["unit", "bool", "nat", "int"].map(name => {
			const copy = projection.surface.copy({ kind: "primitive", name });
			return [name, { index: copy.index, ctype: phpFfiType(copy) }];
		}))
	};
	await saveLakeFile(consumer, "faults.php", source);
	await saveLakeFile(consumer, "faults.json", canonicalJson(request));
	const result = await runCopied(environment.LEAN_BRIDGE_PHP, [...installed.php.runtimeOptions, join(consumer, "faults.php"), join(consumer, "faults.json")], deployment);
	assert.equal(result.stderr, ""); const faults = JSON.parse(result.stdout);
	assert.ok(faults.failures > 500); assert.ok(faults.checks > faults.failures * 4);
	assert.equal(faults.partialInputCases, 64); assert.ok(faults.malformedOutputCases > 500);
	const unchanged = async () => {
		assert.deepEqual((await nativeArtifactPaths(deployment)).sort(), Object.keys(installed.php.deployment).sort());
		await verifyNativeFiles(deployment, installed.php.deployment);
	};
	await unchanged();
	for(const { mode, observation } of installed.php.executions)
	{
		const repeat = await runCopied(environment.LEAN_BRIDGE_PHP, [...installed.php.runtimeOptions, mode + ".php"], deployment);
		assert.equal(repeat.stderr, ""); assert.deepEqual(JSON.parse(repeat.stdout), observation); await unchanged();
	}
	return { ...faults, sourceSha256: sha256(source)
		, requestSha256: sha256(canonicalJson(request))
		, inMemoryProbeOnly: true, separateProcess: true, compilerFree: true
		, unchangedDeployment: true, publicConsumersRepeatedAfterProbe: true };
};
