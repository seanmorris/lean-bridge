/**
 * Bind native PHP collection support to original Composer archives and callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { generateCopiedPhpPackage } from "../src/backends/php/copied-values.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { copiedPhpDefinitions } from "../src/backends/php/copied-conversions.mjs";
import { collectionReviewedIr, collectionSignatures } from "./helpers/collection-fixture.mjs";
import { phpCollectionConsumer, phpCollectionDocumentation, phpCollectionRequest } from "./helpers/php-collection-fixture.mjs";
import { compoundReviewedIr } from "./helpers/compound-fixture.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";
import { nativeAliasReviewedIr } from "./helpers/native-alias-fixture.mjs";
import { phpVariantReviewedIr } from "./helpers/php-variant-fixture.mjs";
import { composerProbe, phpIsolationFlags } from "./helpers/type-corpus-php.mjs";
import { validateBrickMathInstall } from "./helpers/brick-math.mjs";

const receipt = async () => JSON.parse(await readFile("docs/evidence/php-native-collections-20260922.json"));
const observations = run => ({
	public: run.php.executions.map(({ mode, observation }) => ({ mode, observation: Object.fromEntries(Object.entries(observation).filter(([key]) => key !== "api")) }))
	, faults: run.faults, documentation: run.documentation
});

test("native PHP collections retain original packages, exact public calls and executable documentation", async () => {
	const record = await receipt();
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64);
	assert.deepEqual(record.profiles, ["php-native"]);
	assert.equal(record.hostGlibc, "2.36"); assert.equal(record.packageGlibcFloor, "2.36");
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(record.signatures), sort(collectionSignatures));
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(collectionReviewedIr())));
	const reports = record.executions.map(({ signaturesSha256, ...run }) => {
		assert.equal(signaturesSha256, sha256(canonicalJson(record.signatures)));
		return { ...run, signatures: record.signatures };
	});
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports })));
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	const example = phpCollectionDocumentation();
	for(const run of record.executions)
	{
		assert.equal(run.profile, "php-native");
		assert.equal(run.sourceRemovedBeforeInstallation, true); assert.equal(run.handoffRemovedBeforeExecution, true);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"])
			assert.match(run[key], /^[a-f0-9]{64}$/);
		const php = run.php;
		for(const key of phpIsolationFlags) assert.equal(php[key], true, key);
		assert.equal(php.version, "8.2.33"); assert.match(php.composerVersion, /^Composer version 2\./);
		assert.equal(php.composerProbeSha256, sha256(composerProbe));
		assert.equal(php.requestSha256, sha256(phpCollectionRequest(run.path)));
		assert.equal(php.manifestSha256, sha256(canonicalJson(php.manifest)));
		validateBrickMathInstall(php, php.deployment);
		assert.equal(php.packageReceiptSha256, sha256(canonicalJson(php.packageReceipt)));
		assert.equal(run.packages.length, 1); const pkg = run.packages[0];
		assert.equal(pkg.ecosystem, "composer"); assert.equal(pkg.name, "lean-bridge-collections/api"); assert.equal(pkg.version, "1.0.0");
		assert.equal(pkg.artifacts[0].sha256, php.archiveSha256);
		const prefix = `vendor/${pkg.name}/`;
		assert.equal(Object.keys(php.packageReceipt.files).length, 25); assert.equal(Object.keys(php.deployment).length, 67);
		for(const [path, identity] of Object.entries(php.packageReceipt.files)) assert.deepEqual(php.deployment[prefix + path], identity);
		assert.equal(php.deployment[prefix + "src/Api.php"].sha256, php.declarationsSha256);
		assert.deepEqual(php.executions.map(run => run.mode), ["weak", "strict"]);
		assert.deepEqual(run.documentation, example);
		for(const { mode, observation } of php.executions)
		{
			const source = phpCollectionConsumer(mode, run.path);
			assert.equal(php.consumerSources[mode], sha256(source)); assert.equal(php.deployment[mode + ".php"].sha256, sha256(source));
			assert.doesNotMatch(source, /Internal\\|FFI|CData|lean_ctor_|::check[0-9]|::from[0-9]/);
			assert.equal(observation.checks, 191516); assert.equal(observation.calls, 4317); assert.equal(observation.rejections, 67);
			assert.equal(observation.word_bits, 64); assert.equal(observation.records, 7); assert.equal(observation.documentation, example.stdout);
			assert.deepEqual(observation.primitives.map(item => item.name).sort(), Object.values(collectionReviewedIr().types.find(type => type.name === "Primitives").fields).map(field => field.type.name).sort());
			for(const primitive of observation.primitives) assert.equal(primitive.checks, primitive.name === "bytes" ? 3091 : 2065);
			assert.equal(Object.keys(observation.native_libraries).length, 4);
			for(const [path, hash] of Object.entries(observation.native_libraries)) assert.equal(hash, php.packageReceipt.files[path].sha256);
			assert.deepEqual(observation.native_libraries, record.executions[0].observation.native_libraries);
		}
		const faults = run.faults;
		assert.equal(faults.sourceSha256, record.sourceHashes["tests/fixtures/collection-consumers/php-faults.php"]);
		assert.equal(faults.failures, 1354); assert.equal(faults.checks, 66164);
		assert.equal(faults.partialInputCases, 64); assert.equal(faults.malformedOutputCases, 516);
		assert.equal(faults.checkpoints.length, 9); assert.equal(faults.checkpoints.reduce((sum, site) => sum + site.count, 0), faults.failures);
		for(const key of ["inMemoryProbeOnly", "separateProcess", "compilerFree", "unchangedDeployment", "publicConsumersRepeatedAfterProbe"])
			assert.equal(faults[key], true, key);
	}
	for(const key of ["archivesIdentical", "nativeLibrariesIdentical", "packageFilesIdentical", "publicObservationsIdentical"])
		assert.equal(record.reproduction[key], true);
	assert.equal(record.reproduction.runs.length, 2);
	for(const previous of record.reproduction.runs)
	{
		const run = record.executions.find(run => run.path === previous.path); assert.ok(run);
		assert.notEqual(previous.api, run.observation.api);
		assert.equal(previous.packageFilesSha256, sha256(canonicalJson(run.php.packageReceipt.files)));
		assert.equal(previous.packagesSha256, sha256(canonicalJson(run.packages)));
		assert.equal(previous.nativeLibrariesSha256, sha256(canonicalJson(run.observation.native_libraries)));
		assert.equal(previous.observationsSha256, sha256(canonicalJson(observations(run))));
		assert.deepEqual(previous.differentDeploymentFiles, ["vendor/autoload.php", "vendor/composer/autoload_real.php", "vendor/composer/autoload_static.php", "vendor/composer/installed.json"]);
	}
	const { firstLog, secondLog } = record.reproduction; assert.notEqual(firstLog.sha256, secondLog.sha256);
	for(const log of [firstLog, secondLog])
	{
		assert.equal(log.sha256, sha256(log.text)); assert.match(log.text, /# tests 1\n# suites 0\n# pass 1\n# fail 0/);
		for(const path of ["ordinary-source", "reviewed-ir"])
			for(const mode of ["weak", "strict"]) assert.ok(log.text.includes(`${path}/${mode}: 191516 assertions across 4317 public calls`));
	}
});

test("PHP preflight and regression evidence preserves each tested execution boundary", async () => {
	const { conversion, equality, regressions } = await receipt();
	for(const preflight of [conversion, equality])
	{ assert.equal(preflight.compiledLean, false); assert.equal(preflight.installedPackage, false); }
	assert.deepEqual(conversion.observation, { checks: 1665, nativeCalls: 0, primitives: 19, rejected: 803 });
	assert.equal(conversion.probeSourceSha256, sha256(await readFile("tests/fixtures/collection-consumers/php-conversions.php")));
	const sourceHashes = files => Object.fromEntries(Object.entries(files).filter(([path]) => path.endsWith(".php")).map(([path, source]) => [path, sha256(source)]));
	assert.deepEqual(conversion.generatedSourceHashes, sourceHashes(generateCopiedPhpPackage(collectionReviewedIr())));
	const definitions = copiedPhpDefinitions(compileCopiedPhpModel(collectionReviewedIr())).split("\n").filter(line => line.startsWith("typedef ")).join("\n");
	assert.equal(conversion.definitionsSha256, sha256(definitions));
	assert.equal(equality.sourceSha256, sha256(await readFile("tests/fixtures/collection-consumers/php-equality.php")));
	assert.deepEqual(equality.reports.map(run => run.profile), ["ffi", "zend32", "zend64"]);
	const fixtures = { collections: collectionReviewedIr(), compounds: compoundReviewedIr(), lists: listReviewedIr(), aliases: nativeAliasReviewedIr(), variants: phpVariantReviewedIr() };
	for(const run of equality.reports)
	{
		assert.deepEqual(run.observation, { checks: 6293, nativeCalls: 0, projections: 5, rejections: 56 });
		assert.equal(run.integerBits, run.profile === "zend32" ? 32 : 64);
		const sources = Object.fromEntries(Object.entries(fixtures).flatMap(([name, ir]) => {
			const files = run.profile === "ffi" ? generateCopiedPhpPackage(ir) : generateCopiedPhpZendAdapter(ir, { integerBits: run.integerBits });
			return Object.entries(sourceHashes(files)).map(([path, hash]) => [`${name}/${path}`, hash]);
		}));
		assert.deepEqual(run.sourceHashes, sources);
	}
	assert.deepEqual(regressions.map(run => run.name), ["callables", "compounds", "lists", "aliases", "variants", "native"]);
	for(const run of regressions)
	{
		assert.equal(run.sourceSha256, sha256(await readFile(run.test)));
		assert.equal(run.log.sha256, sha256(run.log.text));
		assert.equal(run.tests, run.name === "native" ? 4 : 1);
		assert.ok(run.log.text.includes(`# tests ${run.tests}\n# suites 0\n# pass ${run.tests}\n# fail 0`));
	}
});

test("PHP collections promote reviewed copied positions and require original CI evidence", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("php-native-collections-installed"));
	assert.equal(observed.length, 22);
	for(const cell of observed)
	{
		assert.equal(cell.profile, "php-native"); assert.equal(cell.path, "reviewed-ir");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.ok(["array", "record"].includes(cell.shape) || cell.position === "field" && document.irFacets.primitive.includes(cell.shape));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["php-native-collections-installed"]); }
	}
	for(const cell of cells.filter(cell => cell.profile === "php-native" && ["array", "record"].includes(cell.shape) && cell.position.startsWith("callback-")))
		assert.notEqual(cell.stages.installedExecution.state, "passed");
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const [command, report] of [
		["LEAN_BRIDGE_PHP_COLLECTION_TEST=1 node --test tests/php-collections.test.mjs tests/php-collection-contract.test.mjs", "collections/php-native"]
		, ["LEAN_BRIDGE_PHP_CONVERSIONS_TEST=1 node --test tests/php-collection-conversions.test.mjs", "collections/php-native-conversions"]
		, ["LEAN_BRIDGE_PHP_EQUALITY_TEST=1 node --test tests/php-value-equality.test.mjs", "equality/php"]
	]) {
		assert.ok(workflow.includes(command)); assert.ok(workflow.includes(`test -s build/${report}.json`));
		assert.ok(workflow.split("path: |\n").some(block => block.includes(`build/${report}.json`)));
	}
});
