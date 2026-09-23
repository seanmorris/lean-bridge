/**
 * Bounded XS conversions, original Lean calls and exact exceptional cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedPerlGraphConversions } from "../src/backends/perl/copied-graph-conversions.mjs";
import { generateCopiedPerlGraphXs } from "../src/backends/perl/copied-graph-xs.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { assertAdministrativeSourceUpdate } from "./helpers/test-registration-history.mjs";
import { perlAliasGraphIr } from "./helpers/perl-graph-values-fixture.mjs";
import { perlConversionIr, perlGraphCommands, perlGraphIsolatedXs, preparePerlGraphProbe, compilePerlGraphProbe } from "./helpers/perl-graph-probes.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const generate = ir => generateCopiedPerlGraphConversions(ir, "LeanBridge::Recursive");

test("recorded Perl conversions bind all four ABIs without claiming installed CPAN support", async () => {
	const receipt = JSON.parse(await readFile("docs/evidence/perl-recursive-conversions-20260923.json", "utf8"));
	assert.equal(receipt.planNode, 1219); assert.equal(receipt.installedPackage, false);
	for(const [path, hash] of Object.entries(receipt.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	const model = generate(perlConversionIr());
	assert.equal(receipt.isolated.compiledLean, false); assert.equal(receipt.isolated.installedPackage, false);
	assert.equal(receipt.isolated.sourceSha256, sha256(model.source));
	assert.equal(receipt.isolated.valuesSha256, sha256(model.valuesSource));
	assert.equal(receipt.isolated.headerSha256, sha256(model.typesHeader));
	assert.equal(receipt.isolated.xsSha256, sha256(perlGraphIsolatedXs(model)));
	assert.equal(receipt.isolated.probeSha256, sha256(await readFile("tests/fixtures/structured-types/recursive-perl-conversions.pl")));
	const fixtureHash = sha256(await readFile("tests/fixtures/structured-types/recursive-perl-fixture.pl"));
	assert.equal(receipt.isolated.fixtureSha256, fixtureHash);
	const abis = [["5.36.3", true], ["5.36.3", false], ["5.38.2", true], ["5.38.2", false]];
	assert.deepEqual(receipt.isolated.reports.map(item => [item.perl, item.threaded]), abis);
	for(const report of receipt.isolated.reports) assert.deepEqual(report, {
		perl: report.perl, threaded: report.threaded, wordBits: 64, pointerBits: 64
		, checks: 34320, allocations: 30, checkpoints: 228
		, inputFailures: 26, outputFailures: 202 });
	assert.equal(receipt.native.compiledLean, true); assert.equal(receipt.native.installedPackage, false);
	assert.deepEqual(receipt.native.observations.map(item => item.reviewed), [false, true]);
	const ir = nativeRecursiveReviewedIr(); ir.declarations.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	const compiled = generateCopiedPerlGraphXs(ir, "LeanBridge::Recursive");
	for(const observation of receipt.native.observations)
	{
		assert.equal(observation.exports, 18);
		assert.equal(observation.sourceSha256, sha256(compiled.source));
		assert.equal(observation.xsSha256, sha256(compiled.xs));
		assert.equal(observation.valuesSha256, sha256(compiled.valuesSource));
		assert.equal(observation.probeSha256, sha256(await readFile("tests/fixtures/structured-types/recursive-perl-lean.pl")));
		assert.equal(observation.fixtureSha256, fixtureHash);
		assert.deepEqual(observation.scenarios.map(item => [item.perl, item.threaded, item.mode])
			, abis.flatMap(([perl, threaded]) => ["carrier", "raw", "during", "publication"].map(mode => [perl, threaded, mode])));
		for(const scenario of observation.scenarios) assert.deepEqual(scenario, {
			perl: scenario.perl, threaded: scenario.threaded, mode: scenario.mode
			, wordBits: 64, pointerBits: 64
			, checks: scenario.threaded ? 6445 : 6444
			, threadRejections: scenario.threaded ? 1 : 0
			, nativeCheckpoints: 28, perlCheckpoints: 732, mallocCheckpoints: 94
			, inputFailures: 84, outputFailures: 648 });
	}
});

test("Perl graph converters remain finite, deterministic and nominal", () => {
	const ir = perlConversionIr(), original = structuredClone(ir), generated = generate(ir);
	assert.deepEqual(ir, original); assert.deepEqual(generate(ir), generated);
	ir.types.reverse(); assert.deepEqual(generate(ir), generated);
	const aliases = generate(perlAliasGraphIr());
	assert.equal(aliases.types.length, 700); assert.ok(aliases.source.length < 1500000);
	assert.match(generated.source, /SAVEDESTRUCTOR_X\(lpg_end, scope\)/);
	assert.match(generated.source, /no finite value/);
	assert.doesNotMatch(generated.valuesSource, /DynaLoader|lean_object|constructor_tag|JSON/);
});

test("Perl XS calls validate before initialization and register native cleanup before invocation", () => {
	const generated = generateCopiedPerlGraphXs(perlConversionIr(), "LeanBridge::Recursive");
	const call = generated.xs.slice(generated.xs.indexOf("join_trees(...)"), generated.xs.indexOf("inspect(...)"));
	assert.ok(call.includes("input1"));
	assert.ok(call.indexOf("input1") < call.indexOf("lpg_initialize()"));
	assert.ok(call.indexOf("scope->clear =") < call.indexOf("recursive_join_trees_graph("));
	assert.ok(call.indexOf("lpg_write") < call.lastIndexOf("lpg_ready()"));
	assert.match(call, /lpg_close\(scope\);\n\s*LEAVE;[\s\S]*SPAGAIN; SP -= items;/);
	assert.doesNotMatch(call, /SAVETMPS|FREETMPS|SvREFCNT_inc\(out\)/);
});

test("Perl isolated XS conversions reject malformed values and release failures on selected ABIs", {
	skip: process.env.LEAN_BRIDGE_PERL_GRAPH_CONVERSION_TEST !== "1"
	, timeout: 240_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-perl-graph-conversions-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const model = generate(perlConversionIr()), xs = perlGraphIsolatedXs(model), reports = [];
	const probe = await readFile("tests/fixtures/structured-types/recursive-perl-conversions.pl", "utf8");
	const fixture = await readFile("tests/fixtures/structured-types/recursive-perl-fixture.pl", "utf8");
	await preparePerlGraphProbe(root, model, xs);
	await saveLakeFile(root, "check.pl", probe); await saveLakeFile(root, "fixture.pl", fixture);
	for(const perl of perlGraphCommands())
	{
		await compilePerlGraphProbe(root, perl);
		const result = await runCopied(perl, ["-I", root, "check.pl"], root);
		assert.equal(result.stderr, ""); const report = JSON.parse(result.stdout);
		assert.ok(["5.36.3", "5.38.2"].includes(report.perl));
		assert.equal(report.wordBits, 64); assert.equal(report.pointerBits, 64);
		assert.ok(report.checks > 33000); assert.ok(report.checkpoints > 200);
		assert.ok(report.inputFailures > 0); assert.ok(report.outputFailures > 0);
		reports.push(report);
	}
	await saveLakeFile("build/recursive", "perl-conversions.json", canonicalJson({ schemaVersion: 1
		, compiledLean: false, installedPackage: false, reports
		, sourceSha256: sha256(model.source), valuesSha256: sha256(model.valuesSource)
		, xsSha256: sha256(xs), headerSha256: sha256(model.typesHeader)
		, probeSha256: sha256(probe), fixtureSha256: sha256(fixture) }));
});

test("Perl XS executes ordinary and reviewed compiled Lean graphs on selected ABIs", {
	skip: process.env.LEAN_BRIDGE_PERL_GRAPH_NATIVE_TEST !== "1", timeout: 900_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-perl-native-graphs-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkPerlNativeGraphs } = await import("./helpers/perl-native-graphs.mjs");
	const report = await checkPerlNativeGraphs(root);
	assert.deepEqual(report.observations.map(item => item.reviewed), [false, true]);
	await saveLakeFile("build/recursive", "perl-native.json", canonicalJson(report));
});

test("Perl CI requires isolated and compiled graph conversions for every ABI", async () => {
	const workflow = await readFile(".github/workflows/perl-consumer.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_PERL_GRAPH_CONVERSION_TEST=1 LEAN_BRIDGE_PERL_GRAPH_NATIVE_TEST=1 node --test tests/perl-copied-graph-conversions.test.mjs"));
	for(const name of ["perl-conversions", "perl-native"])
	{
		assert.ok(workflow.includes(`test -s build/recursive/${name}.json`));
		assert.ok(workflow.includes(`            build/recursive/${name}.json\n`));
	}
});
