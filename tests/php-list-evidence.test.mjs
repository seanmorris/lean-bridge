/**
 * Bind native PHP List claims to installed public callers and cleanup probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { listPrimitives, listSignatures } from "./helpers/list-fixture.mjs";
import { phpListConsumer, phpListRequest } from "./helpers/php-list-fixture.mjs";
import { phpIsolationFlags } from "./helpers/type-corpus-php.mjs";

test("native PHP List evidence preserves both paths without promoting PHP-Wasm", async () => {
	const record = JSON.parse(await readFile("docs/evidence/php-native-lists-20260921.json"));
	assert.deepEqual(record.profiles, ["php-native"]); assert.equal(record.wordBits, 64);
	assert.deepEqual(record.signatures, listSignatures);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "php-native");
		assert.equal(run.sourceRemovedBeforeInstallation, true); assert.equal(run.handoffRemovedBeforeExecution, true);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		for(const key of phpIsolationFlags) assert.equal(run.php[key], true, key);
		assert.equal(run.php.requestSha256, sha256(phpListRequest(run.path)));
		assert.deepEqual(run.php.executions.map(execution => execution.mode), ["weak", "strict"]);
		assert.equal(run.php.lock.packages.find(pkg => pkg.name === "brick/math").version, "1.0.0");
		assert.equal(run.php.packageReceiptSha256, sha256(canonicalJson(run.php.packageReceipt)));
		assert.equal(run.packages.length, 1); assert.equal(run.packages[0].ecosystem, "composer");
		assert.equal(run.packages[0].artifacts[0].sha256, run.php.archiveSha256);
		for(const { mode, observation } of run.php.executions)
		{
			assert.equal(run.php.consumerSources[mode], sha256(phpListConsumer(mode, run.path)));
			assert.equal(observation.checks, 86983); assert.equal(observation.word_bits, 64);
			assert.deepEqual(observation.primitives.map(item => item.name).sort(), [...listPrimitives].sort());
			assert.ok(observation.primitives.every(item => item.checks === 1288));
			assert.equal(Object.keys(observation.native_libraries).length, 4);
			for(const [path, hash] of Object.entries(observation.native_libraries))
			{
				assert.equal(hash, run.php.packageReceipt.files[path].sha256);
				assert.equal(hash, run.php.deployment[`vendor/${run.packages[0].name}/${path}`].sha256);
			}
		}
		const faults = run.faults;
		assert.equal(faults.sourceSha256, record.sourceHashes["tests/fixtures/list-consumers/php-faults.php"]);
		assert.equal(faults.failures, 591); assert.equal(faults.checks, 14895);
		assert.equal(faults.checkpoints.reduce((sum, site) => sum + site.count, 0), faults.failures);
		assert.equal(faults.realFailureCases, 20); assert.equal(faults.partialInputCases, 16);
		assert.equal(faults.malformedOutputCases, 9); assert.equal(faults.emptyBufferCases, 2); assert.equal(faults.compoundAlignmentCases, 1);
		for(const key of ["inMemoryProbeOnly", "separateProcess", "compilerFree", "unchangedDeployment", "publicConsumersRepeatedAfterProbe"]) assert.equal(faults[key], true, key);
	}
	const publicSource = await readFile("tests/fixtures/list-consumers/php.php", "utf8");
	assert.doesNotMatch(publicSource, /Internal\\|FFI|CData|lean_ctor_|::check[0-9]|::from[0-9]/);
});
