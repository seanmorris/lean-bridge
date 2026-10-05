/**
 * Isolated alias conversion fault injection, followed by public installed reruns.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Probe private conversion checkpoints without changing any installed file.
 *
 * @param options - Installed deployment and independently executed public callers.
 * @param options.consumer - Task-owned directory outside the installed deployment.
 * @param options.environment - Explicit PHP executable selection.
 * @param options.installed - Verified Composer installation and execution evidence.
 * @param options.projection - Private decoder indices for this isolated probe only.
 */
export const probePhpAliases = async ({ consumer, environment, installed, projection }) => {
	const deployment = join(consumer, "php-native/relocated");
	const source = await readFile("tests/fixtures/alias-consumers/php-faults.php", "utf8");
	const request = { clearSites: projection.surface.functions.filter(fn => projection.surface.copy(fn.declaration.result.type).aggregate).length
		, functions: Object.fromEntries(projection.surface.functions.map((fn, index) => {
			const output = projection.surface.copy(fn.declaration.result.type);
			return [fn.field, { call: `call${index}`, from: `from${output.index}`, ctype: output.ctype }];
		}))
	};
	await saveLakeFile(consumer, "faults.php", source);
	await saveLakeFile(consumer, "probes.json", canonicalJson(request));
	const result = await runCopied(environment.LEAN_BRIDGE_PHP, [...installed.php.runtimeOptions, join(consumer, "faults.php"), join(consumer, "probes.json")], deployment);
	assert.equal(result.stderr, "");
	const faults = JSON.parse(result.stdout);
	assert.ok(faults.failures > 100); assert.ok(faults.checks > faults.failures * 4);
	assert.equal(faults.partialInputCases, 64); assert.equal(faults.malformedOutputCases, 15);
	const unchanged = async () => {
		assert.deepEqual((await nativeArtifactPaths(deployment)).sort(), Object.keys(installed.php.deployment).sort());
		await verifyNativeFiles(deployment, installed.php.deployment);
	};
	await unchanged();
	for(const { mode, observation } of installed.php.executions)
	{
		const repeat = await runCopied(environment.LEAN_BRIDGE_PHP, [...installed.php.runtimeOptions, mode + ".php"], deployment);
		assert.equal(repeat.stderr, ""); assert.deepEqual(JSON.parse(repeat.stdout), observation);
		await unchanged();
	}
	return { ...faults, sourceSha256: sha256(source)
		, requestSha256: sha256(canonicalJson(request))
		, inMemoryProbeOnly: true, separateProcess: true, compilerFree: true
		, unchangedDeployment: true, publicConsumersRepeatedAfterProbe: true };
};
