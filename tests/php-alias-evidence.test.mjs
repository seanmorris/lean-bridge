/**
 * Bind native PHP alias claims to installed callers, archives and cleanup probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { aliasPrimitives, nativeAliasReviewedIr, nativeAliasSignatures } from "./helpers/native-alias-fixture.mjs";
import { phpAliasCatalog, phpAliasConsumer, phpAliasRequest } from "./helpers/php-alias-fixture.mjs";
import { phpIsolationFlags } from "./helpers/type-corpus-php.mjs";
import { validateBrickMathInstall } from "./helpers/brick-math.mjs";

test("native PHP alias evidence preserves both installed source paths and lexical callers", async () => {
	const record = JSON.parse(await readFile("docs/evidence/php-native-aliases-20260921.json"));
	assert.deepEqual(record.profiles, ["php-native"]); assert.equal(record.wordBits, 64);
	assert.deepEqual(record.signatures, nativeAliasSignatures); assert.deepEqual(record.primitives, aliasPrimitives);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(nativeAliasReviewedIr())));
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "php-native"); assert.equal(run.sourceRemovedBeforeInstallation, true); assert.equal(run.handoffRemovedBeforeExecution, true);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256", "contractSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.deepEqual(run.catalog.aliases, phpAliasCatalog);
		for(const flag of ["originalAliasChains", "originalApiSites", "originalRecordFields", "installedSourceDocumentation", "transparentTargetValues"]) assert.equal(run.catalog[flag], true, flag);
		for(const key of phpIsolationFlags) assert.equal(run.php[key], true, key);
		assert.equal(run.php.requestSha256, sha256(phpAliasRequest(run.path)));
		assert.deepEqual(run.php.executions.map(execution => execution.mode), ["weak", "strict"]);
		validateBrickMathInstall(run.php, run.php.deployment);
		assert.equal(run.php.packageReceiptSha256, sha256(canonicalJson(run.php.packageReceipt)));
		assert.equal(run.packages.length, 1); assert.equal(run.packages[0].ecosystem, "composer");
		assert.equal(run.packages[0].artifacts[0].sha256, run.php.archiveSha256);
		const prefix = `vendor/${run.packages[0].name}/`;
		for(const [path, identity] of Object.entries(run.php.packageReceipt.files)) assert.deepEqual(run.php.deployment[prefix + path], identity);
		assert.equal(run.php.deployment[prefix + "src/Api.php"].sha256, run.php.declarationsSha256);
		for(const { mode, observation } of run.php.executions)
		{
			assert.equal(run.php.consumerSources[mode], sha256(phpAliasConsumer(mode, run.path)));
			assert.equal(run.php.deployment[mode + ".php"].sha256, run.php.consumerSources[mode]);
			assert.equal(observation.checks, 12532); assert.equal(observation.word_bits, 64); assert.equal(observation.aliases, 27);
			assert.deepEqual(observation.primitives.map(item => item.name).sort(), Object.values(aliasPrimitives).sort());
			assert.ok(observation.primitives.every(item => item.checks === 256));
			assert.equal(Object.keys(observation.native_libraries).length, 4);
			for(const [path, hash] of Object.entries(observation.native_libraries)) assert.equal(hash, run.php.packageReceipt.files[path].sha256);
			assert.deepEqual(observation.native_libraries, record.executions[0].php.executions[0].observation.native_libraries);
		}
		const faults = run.faults;
		assert.equal(faults.sourceSha256, record.sourceHashes["tests/fixtures/alias-consumers/php-faults.php"]);
		assert.equal(faults.failures, 567); assert.equal(faults.checks, 12904);
		assert.equal(faults.checkpoints.reduce((sum, site) => sum + site.count, 0), faults.failures);
		assert.equal(faults.realFailureCases, 67); assert.equal(faults.partialInputCases, 64);
		assert.equal(faults.malformedOutputCases, 15); assert.equal(faults.emptyBufferCases, 2);
		for(const key of ["inMemoryProbeOnly", "separateProcess", "compilerFree", "unchangedDeployment", "publicConsumersRepeatedAfterProbe"]) assert.equal(faults[key], true, key);
	}
	const publicSource = await readFile("tests/fixtures/alias-consumers/php.php", "utf8");
	assert.doesNotMatch(publicSource, /Internal\\|FFI|CData|lean_ctor_|::check[0-9]|::from[0-9]/);
});

test("native PHP aliases promote exactly six installed cells and remain required by CI", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes("php-native-aliases-installed"));
	assert.equal(cells.length, 6);
	for(const cell of cells)
	{
		assert.equal(cell.profile, "php-native"); assert.equal(cell.shape, "alias"); assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["php-native-aliases-installed"]); }
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_PHP_ALIAS_TEST=1 node --test tests\/php-aliases.test.mjs tests\/php-alias-contract.test.mjs/);
	assert.match(workflow, /test -s build\/aliases\/php-native\.json/);
	assert.match(workflow, /path: \|[^]*?build\/aliases\/php-native\.json/);
});
