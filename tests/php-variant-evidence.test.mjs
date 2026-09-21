/**
 * Source-bound native Composer variants, lexical callers and isolated cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { phpVariantReviewedIr, phpVariantSignatures } from "./helpers/php-variant-fixture.mjs";
import { phpIsolationFlags } from "./helpers/type-corpus-php.mjs";
import { validateBrickMathInstall } from "./helpers/brick-math.mjs";

test("native PHP variant evidence binds original archives, both source paths and lexical callers", async () => {
	const record = JSON.parse(await readFile("docs/evidence/php-native-variants-20260921.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64); assert.deepEqual(record.profiles, ["php-native"]);
	assert.equal(record.hostGlibc, "2.36"); assert.equal(record.packageGlibcFloor, "2.36");
	const reports = record.executions.map(({ contractSha256, ...run }) => {
		assert.equal(contractSha256, sha256(canonicalJson(record.contract))); return { ...run, contract: record.contract };
	});
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports })));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.signatures, phpVariantSignatures); assert.deepEqual(record.types, phpVariantReviewedIr().types);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(phpVariantReviewedIr())));
	assert.equal(record.types.filter(type => type.kind === "variant").length, 7); assert.equal(record.types.flatMap(type => type.cases).length, 18);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	const publicSource = await readFile("tests/fixtures/variant-consumers/php.php", "utf8");
	assert.doesNotMatch(publicSource, /Internal\\|FFI|CData|lean_ctor_|::check[0-9]|::from[0-9]/);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "php-native"); assert.equal(run.sourceRemovedBeforeInstallation, true); assert.equal(run.handoffRemovedBeforeExecution, true);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256", "contractSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		for(const key of phpIsolationFlags) assert.equal(run.php[key], true, key);
		assert.equal(run.php.requestSha256, sha256(canonicalJson({ signatures: phpVariantSignatures, types: phpVariantReviewedIr().types })));
		assert.deepEqual(run.php.executions.map(execution => execution.mode), ["weak", "strict"]);
		validateBrickMathInstall(run.php, run.php.deployment);
		assert.equal(run.php.packageReceiptSha256, sha256(canonicalJson(run.php.packageReceipt)));
		assert.equal(run.packages.length, 1); assert.equal(run.packages[0].ecosystem, "composer");
		assert.equal(run.packages[0].artifacts[0].sha256, run.php.archiveSha256);
		const prefix = `vendor/${run.packages[0].name}/`;
		assert.equal(Object.keys(run.php.packageReceipt.files).length, 25); assert.equal(Object.keys(run.php.deployment).length, 67);
		for(const [path, identity] of Object.entries(run.php.packageReceipt.files)) assert.deepEqual(run.php.deployment[prefix + path], identity);
		assert.equal(run.php.deployment[prefix + "src/Api.php"].sha256, run.php.declarationsSha256);
		for(const { mode, observation } of run.php.executions)
		{
			const source = publicSource.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
				.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${run.path === "reviewed-ir" ? "value" : "arg"}';`);
			assert.equal(run.php.consumerSources[mode], sha256(source)); assert.equal(run.php.deployment[mode + ".php"].sha256, sha256(source));
			assert.equal(observation.checks, 37686); assert.equal(observation.calls, 4460); assert.equal(observation.rejected, 54);
			assert.equal(observation.word_bits, 64); assert.equal(observation.families, 7); assert.equal(observation.constructors, 18);
			assert.deepEqual([...observation.primitives].sort(), ["unit", "bool", "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "nat", "int", "float32", "float64", "string", "bytes", "char", "usize", "isize"].sort());
			assert.equal(Object.keys(observation.native_libraries).length, 4);
			for(const [path, hash] of Object.entries(observation.native_libraries)) assert.equal(hash, run.php.packageReceipt.files[path].sha256);
			assert.deepEqual(observation.native_libraries, record.executions[0].php.executions[0].observation.native_libraries);
		}
		const faults = run.faults;
		assert.equal(faults.sourceSha256, record.sourceHashes["tests/fixtures/variant-consumers/php-faults.php"]);
		assert.equal(faults.failures, 460); assert.equal(faults.checks, 7123); assert.equal(faults.selectedBranches, 188);
		assert.equal(faults.checkpoints.reduce((sum, site) => sum + site.count, 0), faults.failures); assert.equal(faults.checkpoints.length, 23);
		assert.equal(faults.partialInputs, 64); assert.equal(faults.nativeFailureCases, 2);
		assert.equal(faults.malformedTags, 7); assert.equal(faults.inactivePayloadCases, 6); assert.equal(faults.malformedPayloads, 5);
		assert.equal(faults.constructors.length, 18); assert.equal(new Set(faults.constructors).size, 18);
		for(const key of ["inMemoryProbeOnly", "separateProcess", "compilerFree", "unchangedDeployment", "publicConsumersRepeatedAfterProbe"]) assert.equal(faults[key], true, key);
		const native = run.nativeFaults, probe = await readFile("tests/fixtures/variant-consumers/native-probe.c", "utf8");
		assert.equal(native.baseConsumerSha256, sha256(probe)); assert.equal(native.consumerSha256, sha256("#define variants_echo variants_echo_signal\n" + probe));
		assert.equal(native.checks, 1182); assert.equal(native.allocationFailures, 242); assert.equal(native.rejected, 70); assert.equal(native.malformedNativeTags, 1);
		assert.deepEqual(native.sanitizers, ["address", "leak", "undefined"]); assert.equal(native.realLeanExecution, true);
		assert.equal(native.startupLeakBaseline.bytes, 128); assert.equal(native.startupLeakBaseline.allocations, 12); assert.equal(native.startupLeakBaseline.unchangedAfterConversions, true);
	}
	assert.equal(record.reproduction.paths, 2); assert.equal(record.reproduction.archivesIdentical, true); assert.equal(record.reproduction.packageFilesIdentical, true);
	assert.match(record.reproduction.firstReportSha256, /^[a-f0-9]{64}$/);
	for(const run of record.reproduction.runs)
	{
		const current = record.executions.find(other => other.path === run.path);
		assert.ok(current); assert.equal(run.packageFilesSha256, run.previousPackageFilesSha256);
		assert.equal(run.packageFilesSha256, sha256(canonicalJson(current.php.packageReceipt.files)));
		assert.match(run.previousApi, /\/php-native\/relocated\/vendor\/lean-bridge-variants\/api\/src\/Api\.php$/);
		assert.notEqual(run.previousApi, current.observation.api);
	}
});

test("native PHP variants promote six copied cells and require installed CI reports", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes("php-native-variants-installed"));
	assert.equal(cells.length, 6);
	for(const cell of cells)
	{
		assert.equal(cell.profile, "php-native"); assert.equal(cell.shape, "variant"); assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["php-native-variants-installed"]); }
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_PHP_VARIANT_TEST=1 node --test tests\/php-variants.test.mjs tests\/php-variant-contract.test.mjs/);
	assert.match(workflow, /test -s build\/variants\/php-native\.json/);
	assert.match(workflow, /path: \|[^]*?build\/variants\/php-native\.json/);
});
