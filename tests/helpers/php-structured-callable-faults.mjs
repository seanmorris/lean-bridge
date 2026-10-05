/**
 * Fault-inject an in-memory copy, then repeat the unchanged installed consumers.
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
 * Exercise every allocation/conversion checkpoint across five paths per shape.
 *
 * @param options - The original Composer deployment and private layout metadata.
 * @param options.consumer - Task-owned scratch directory outside deployment.
 * @param options.environment - Explicit PHP interpreter selection.
 * @param options.installed - Receipt-bound installation and public observations.
 * @param options.projection - Private function names and malformed header shapes.
 */
export const probePhpStructuredCallables = async ({ consumer, environment, installed, projection }) => {
	const deployment = join(consumer, "php-native/relocated");
	const source = await readFile("tests/fixtures/structured-callable-consumers/php-faults.php", "utf8");
	const request = {
		package: installed.php.packageReceipt.name
		, functions: Object.fromEntries(projection.surface.functions.map((fn, index) => [fn.field, `call${index}`]))
		, invalid: projection.surface.copies.filter(copy => copy.variant || copy.element || ["option", "result"].includes(copy.compound))
			.map(copy => ({ index: copy.index, ctype: copy.ctype, kind: copy.variant ? "variant" : copy.element ? "sequence" : copy.compound }))
	};
	await saveLakeFile(consumer, "faults.php", source);
	await saveLakeFile(consumer, "faults.json", canonicalJson(request));
	const result = await runCopied(environment.LEAN_BRIDGE_PHP, [...installed.php.runtimeOptions, join(consumer, "faults.php"), join(consumer, "faults.json")], deployment);
	assert.equal(result.stderr, ""); const report = JSON.parse(result.stdout);
	assert.deepEqual(report.shapes.map(item => item.shape), ["array", "list", "option", "result", "tuple", "record", "variant", "alias"]);
	assert.ok(report.checks > report.faults && report.faults > 1000);
	assert.ok(report.clears > 0 && report.closes > 0 && report.malformed >= 10);
	assert.equal(report.conversionMethods, 64);
	for(const shape of report.shapes)
	{
		assert.deepEqual(Object.keys(shape.paths).sort(), ["callback", "create", "create-call", "held-call", "repeated"]);
		for(const count of Object.values(shape.paths)) assert.ok(Number.isSafeInteger(count) && count > 0);
		assert.equal(shape.faults, 2 * Object.values(shape.paths).reduce((sum, count) => sum + count, 0));
	}
	assert.equal(report.faults, report.shapes.reduce((sum, shape) => sum + shape.faults, 0));
	const documented = (await readFile("docs/php.md", "utf8")).match(/### Structured callback values\n[\s\S]*?```php\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(documented);
	await saveLakeFile(consumer, "documented.php", documented + "\n");
	for(let i = 0; i < 2; i++)
	{
		const example = await runCopied(environment.LEAN_BRIDGE_PHP, [...installed.php.runtimeOptions, "-r", "eval('?>' . file_get_contents($argv[1]));", join(consumer, "documented.php")], deployment);
		assert.equal(example.stderr, ""); assert.equal(example.stdout, "copied\nSome None\n");
	}
	const unchanged = async () => {
		assert.deepEqual((await nativeArtifactPaths(deployment)).sort(), Object.keys(installed.php.deployment).sort());
		await verifyNativeFiles(deployment, installed.php.deployment);
	};
	await unchanged();
	for(const { mode, observation } of installed.php.executions)
	{
		const repeated = await runCopied(environment.LEAN_BRIDGE_PHP, [...installed.php.runtimeOptions, mode + ".php"], deployment);
		assert.equal(repeated.stderr, ""); assert.deepEqual(JSON.parse(repeated.stdout), observation); await unchanged();
	}
	return { ...report, sourceSha256: sha256(source)
		, requestSha256: sha256(canonicalJson(request))
		, documentation: { sourceSha256: sha256(documented), executions: 2, installedPublicApi: true }
		, inMemoryProbeOnly: true, separateProcess: true, compilerFree: true
		, unchangedDeployment: true, publicConsumersRepeatedAfterProbe: true };
};
