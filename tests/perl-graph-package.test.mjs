/**
 * Authenticated recursive CPAN generation and original source-free installations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { compileCopiedPerlGraphPackageModel } from "../src/backends/perl/copied-graph-package.mjs";
import { perlStringLiteral } from "../src/backends/perl/naming.mjs";
import { generateNativeBindingPackages } from "../src/binding-ir/package-gate.mjs";
import { createCompiledNativeModel } from "../src/build/native-graph-model.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { normalizedPerlInstallerRecord } from "./helpers/perl-graph-packages.mjs";
import { assertPerlGraphSourceTransition, assertPerlGraphRegressions, assertPerlInstalledRegressions, perlRegressionExecutions, perlCompoundSourceTrees } from "./helpers/native-perl-graph-regression.mjs";
import { assertAdministrativeSourceUpdate } from "./helpers/test-registration-history.mjs";
import { assertPerlGraphReports } from "./helpers/perl-graph-receipt.mjs";

test("recursive Perl package generation isolates native symbols and defers initialization", () => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const reference = { kind: "reference", name: "Sample.Tree", lean: "Sample.Tree", abi };
	const tree = { kind: "variant", name: "Sample.Tree", lean: "Sample.Tree", abi
		, cases: [{ name: "leaf", constructor: "Sample.Tree.leaf", fields: [{ name: "value", type: projection.result }] }
			, { name: "next", constructor: "Sample.Tree.next", fields: [{ name: "child", type: reference }] }] };
	const graph = { kind: "graph", root: reference, types: [tree], abi };
	projection.parameters[0].type = graph; projection.result = graph;
	const options = { ...input, moduleName: "LeanBridge::Sample"
		, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } };
	const model = createCompiledNativeModel(options);
	const receipt = { bindingIrSha256: model.bindingIrSha256
		, initializer: `initialize_LeanBridgeNative${sha256(model.component.id).slice(0, 16)}`
		, library: `libcomponent_${"a".repeat(20)}.so`
		, nativeLibrary: { sha256: "b".repeat(64) }
		, runtimeIdentity: "c".repeat(64) };
	const before = canonicalJson(model), { perl: files } = generateNativeBindingPackages(model, receipt);
	assert.equal(canonicalJson(model), before); assert.deepEqual(generateNativeBindingPackages(model, receipt).perl, files);
	assert.match(files["sample-graph.h"], /__attribute__\(\(visibility\("hidden"\)\)\) uint32_t sample_increment_graph\(/);
	assert.match(files["Component.xs"], /static void lpg_check_context\(pTHX\) \{ lbp_check_interpreter\(aTHX\); \}/);
	assert.equal(files["Component.xs"].split("BOOT:\n")[1], "  lbp_check_interpreter(aTHX);\n");
	assert.match(files["lib/LeanBridge/Sample.pm"], /package LeanBridge::Sample::Tree::Next;/);
	assert.match(files["lib/LeanBridge/Sample.pm"], /LeanBridge::Runtime::_load_component/);
	assert.match(files["lib/LeanBridge/Sample.pm"], /\}, 'sample@1\.0\.0'\);/);
	assert.doesNotMatch(files["lib/LeanBridge/Sample.pm"], /lpg_|ng_|lean_object|constructor_tag/);
	assert.match(JSON.parse(files["binding-manifest.json"]).copiedGraph.layoutSha256, /^[a-f0-9]{64}$/);
});

test("Perl source literals preserve coordinates, sigils, quotes and backslashes", () => {
	assert.equal(perlStringLiteral("sample@1.0.0"), "'sample@1.0.0'");
	assert.equal(perlStringLiteral("$name@items"), "'$name@items'");
	assert.equal(perlStringLiteral("a'b\\c"), "'a\\'b\\\\c'");
	assert.equal(perlStringLiteral("\\n\n\t\""), "'\\\\n\n\t\"'");
});

test("Perl installation comparison normalizes only known installer bookkeeping", () => {
	const pack = "arch/auto/LeanBridge/Recursive/.packlist";
	assert.equal(normalizedPerlInstallerRecord(pack, "/one/lib/a\n/one/lib/b\n", "/one"), normalizedPerlInstallerRecord(pack, "/two/lib/a\n/two/lib/b\n", "/two"));
	assert.throws(() => normalizedPerlInstallerRecord(pack, "/unknown/file\n", "/one"));
	assert.throws(() => normalizedPerlInstallerRecord(pack, "/one/../file\n", "/one"));
	assert.throws(() => normalizedPerlInstallerRecord("arch/Recursive.pm", "", "/one"));
	const pod = (prefix, date) => ["Runtime", "Recursive"].map(module => `=head2 ${date}: C<Module> L<LeanBridge::${module}|LeanBridge::${module}>\n\nC<installed into: ${prefix}/lib/perl5>\n\nC<VERSION: 0.001>\n`).join("\n");
	const first = normalizedPerlInstallerRecord("arch/perllocal.pod", pod("/one", "Wed Sep 23 11:55:01 2026"), "/one");
	const second = normalizedPerlInstallerRecord("arch/perllocal.pod", pod("/two", "Thu Sep 24 12:35:12 2026"), "/two");
	assert.equal(first, second);
	assert.notEqual(first, normalizedPerlInstallerRecord("arch/perllocal.pod", pod("/two", "Thu Sep 24 12:35:12 2026").replace("0.001", "0.002"), "/two"));
	assert.throws(() => normalizedPerlInstallerRecord("arch/perllocal.pod", pod("/one", "not a date"), "/one"));
});

test("CPAN finite admission validates the Perl namespace without adding a C target", () => {
	const ir = nativeRecursiveReviewedIr(), original = canonicalJson(ir);
	const model = compileCopiedPerlGraphPackageModel(ir, "LeanBridge::Recursive");
	assert.deepEqual(compileNativeGraphProjection(ir, ["cpan"], model.moduleName), model);
	assert.equal(model.layout.roots.length, 18); assert.equal(canonicalJson(ir), original);
	assert.throws(() => compileNativeGraphProjection(ir, ["c", "cpan"], "LeanBridge::Runtime"), /module/);
	for(const target of ["nuget", "maven", "php-native", "wit-wasi"])
	{
		assert.deepEqual(compileNativeGraphProjection(ir, ["cpan", target], model.moduleName), model);
		assert.deepEqual(compileNativeGraphProjection(ir, [target, "cpan"], model.moduleName), model);
		assert.throws(() => compileNativeGraphProjection(ir, ["cpan", target], "LeanBridge::Runtime"), /module/);
	}
	for(const target of ["unknown", "invalid"])
		assert.throws(() => compileNativeGraphProjection(ir, ["cpan", target], model.moduleName), { code: "native-graph-projection-unavailable" });
});

test("Perl probe lineage permits only the three unchanged instrumentation exports", async () => {
	const path = "tests/helpers/perl-native-graphs.mjs", source = await readFile(path, "utf8");
	const record = JSON.parse(await readFile("docs/evidence/perl-recursive-conversions-20260923.json"));
	const expected = record.sourceHashes[path]; assert.ok(expected);
	assert.equal(await assertPerlGraphSourceTransition(path, source, expected), true);
	for(const changed of [source + "\n", source.replace("native_live", "changed_live"), source + "export const nativeXs = 0;\n"])
		await assert.rejects(() => assertPerlGraphSourceTransition(path, changed, expected));
	assert.equal(await assertPerlGraphSourceTransition("src/build/native-component.mjs", source, expected), false);
});

test("Perl regression signatures preserve parameter order and reconstruct the named compound review", async () => {
	const first = { name: "first", parameters: ["uint32", "string"], result: "uint32" };
	const second = { name: "second", parameters: [], result: "string" };
	const normalize = signatures => perlRegressionExecutions("compounds", { reports: [{ signatures }] });
	assert.deepEqual(normalize([first, second]), normalize([second, first]));
	assert.notDeepEqual(normalize([first, second]), normalize([{ ...first, parameters: [...first.parameters].reverse() }, second]));
	const trees = await perlCompoundSourceTrees();
	assert.equal(trees.previous.sourceTreeSha256, "bd181e57a6cdb0d0ce2b0fe9d69ba670986c11543e7b4db80c523b14d4d757a6");
	assert.equal(trees.current.sourceTreeSha256, "4bbbdf20a1bd653b93a77913577090ee1df1eb113d9fcc211f3abbf6c59aec68");
	assert.deepEqual(trees.previous.inputs.filter(input => input.path !== "reviewed.binding-ir.json"), trees.current.inputs.filter(input => input.path !== "reviewed.binding-ir.json"));
});

test("recursive CPAN acceptance binds every ABI, original archive, lifecycle probe and documented call", async () => {
	const record = JSON.parse(await readFile("docs/evidence/perl-recursive-packages-20260923.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.installedPackage, true); assert.equal(record.wordBits, 64);
	assert.equal(record.reportSha256, sha256(canonicalJson(record.reports)));
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	assertPerlGraphReports(record.reports);
	assert.equal(record.logs.length, 3);
	for(const log of record.logs)
	{
		assert.equal(log.sha256, sha256(log.text));
		assert.match(log.text, /# pass [1-9][0-9]*\n# fail 0\n# cancelled 0/);
	}
	const logText = record.logs.map(log => log.text).join("\n");
	for(const name of ["ordinary and reviewed CPAN graphs install source-free on selected Perl ABIs"
		, "Perl rejects conflicting native component coordinates before loading their code"
		, "installed recursive and acyclic Perl packages share lifecycle without symbol collisions"
		, "recursive Perl documentation builds original archives and rejects installed native tampering"])
		assert.ok(logText.split("\n").some(line => /^ok \d+ - /.test(line) && line.endsWith(` - ${name}`)), name);
	const installed = record.reports.installed;
	assert.equal(installed.fixtureSha256, sha256(await readFile("tests/fixtures/structured-types/recursive-perl-fixture.pl")));
	assert.equal(installed.consumerSha256, sha256(await readFile("tests/fixtures/structured-types/recursive-perl-package.pl")));
	const snippet = async (path, heading, language) => {
		const document = await readFile(path, "utf8"); assert.equal(document.split(`${heading}\n`).length, 2);
		const section = document.split(`${heading}\n`)[1].split(/\n#{1,3} /)[0];
		const blocks = [...section.matchAll(new RegExp("```" + language + "\\n([^]*?)\\n```", "g"))];
		assert.equal(blocks.length, 1); return sha256(blocks[0][1] + "\n");
	};
	const documentation = record.reports.documentation;
	assert.equal(documentation.sourceSha256, await snippet("docs/publish/cpan.md", "## Export recursive values", "lean"));
	assert.equal(documentation.configurationSha256, await snippet("docs/publish/cpan.md", "## Export recursive values", "json"));
	assert.equal(documentation.consumerSha256, await snippet("docs/consume/perl.md", "### Recursive values", "perl"));
	assert.equal(sha256(await readFile(record.regressions.path)), record.regressions.sha256);
	const { record: regressions, baselines } = await assertPerlGraphRegressions();
	for(const change of [
		runs => runs.collections.executions.pop()
		, runs => { runs.callables.executions[0].checks++; }
		, runs => { runs.compounds.executions[0].faults.conversion_checkpoints--; }
		, runs => { runs.aliases.executions[0].contractSha256 = "0".repeat(64); }
		, runs => { runs.lists.executions[0].signaturesSha256 = "0".repeat(64); }
	]){
		const changed = structuredClone(regressions.runs); change(changed);
		assert.throws(() => assertPerlInstalledRegressions(changed, baselines, regressions.compoundReviewedSource));
	}
	const sharedSource = "src/build/native-project.mjs", currentSource = await readFile(sharedSource, "utf8");
	await assert.rejects(() => assertPerlGraphSourceTransition(sharedSource, currentSource + "\n", baselines.sharedBaseline.sourceHashes[sharedSource]));
	await assert.rejects(() => assertPerlGraphSourceTransition(sharedSource, currentSource, "0".repeat(64)));
	for(const change of [
		reports => reports.installed.observations[0].installs.pop()
		, reports => { reports.installed.observations[2].installs[0].installedFiles["x86_64-linux-thread-multi/LeanBridge/Recursive.pm"].sha256 = "0".repeat(64); }
		, reports => { reports.installed.observations[0].installs[0].faults.isolatedXsCopy = false; }
		, reports => { reports.composition.observations[0].reports[0].forkedClosureCleanup = false; }
		, reports => { reports.collision.results[0].openedAfterConflict = 1; }
		, reports => reports.documentation.observations[0].installs[0].nativeTamperRejections.pop()
	]){
		const changed = structuredClone(record.reports); change(changed); assert.throws(() => assertPerlGraphReports(changed));
	}
	const { document, ...contracts } = await readTypeSurface(), cells = typeSurfaceCells(document, contracts);
	const accepted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("perl-recursive-installed"));
	assert.equal(accepted.length, 6);
	for(const cell of accepted)
	{
		assert.equal(cell.profile, "perl"); assert.equal(cell.shape, "recursive");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages)) assert.equal(stage.state, "passed");
	}
	for(const cell of cells.filter(cell => cell.profile === "perl" && cell.shape === "recursive" && cell.position.startsWith("callback-")))
		assert.notEqual(cell.stages.installedExecution.state, "passed");
});

test("ordinary and reviewed CPAN graphs install source-free on selected Perl ABIs", {
	skip: process.env.LEAN_BRIDGE_PERL_GRAPH_PACKAGE_TEST !== "1"
	, timeout: 3_600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-perl-graph-packages-"));
	t.after(async () => {
		if(process.env.LEAN_BRIDGE_KEEP_PERL_GRAPH_PACKAGES === "1") t.diagnostic(`Perl graph package workspace: ${root}`);
		else await rm(root, { recursive: true, force: true });
	});
	const { checkPerlGraphPackages } = await import("./helpers/perl-graph-packages.mjs");
	const report = await checkPerlGraphPackages(root, message => t.diagnostic(message));
	assert.deepEqual(report.observations.map(item => item.reviewed), [false, true, false, true]);
	await saveLakeFile("build/recursive", "perl-packages.json", canonicalJson(report));
});

test("Perl rejects conflicting native component coordinates before loading their code", {
	skip: process.env.LEAN_BRIDGE_PERL_GRAPH_COLLISION_TEST !== "1"
	, timeout: 600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-perl-component-collision-"));
	t.after(async () => {
		if(process.env.LEAN_BRIDGE_KEEP_PERL_GRAPH_PACKAGES === "1") t.diagnostic(`Perl component collision workspace: ${root}`);
		else await rm(root, { recursive: true, force: true });
	});
	const { checkPerlComponentCollision } = await import("./helpers/perl-component-collision.mjs");
	const report = await checkPerlComponentCollision(root);
	await saveLakeFile("build/recursive", "perl-component-collision.json", canonicalJson(report));
});

test("installed recursive and acyclic Perl packages share lifecycle without symbol collisions", {
	skip: process.env.LEAN_BRIDGE_PERL_GRAPH_COMPOSITION_TEST !== "1"
	, timeout: 900_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-perl-graph-composition-"));
	t.after(async () => {
		if(process.env.LEAN_BRIDGE_KEEP_PERL_GRAPH_PACKAGES === "1") t.diagnostic(`Perl graph composition workspace: ${root}`);
		else await rm(root, { recursive: true, force: true });
	});
	const { checkPerlGraphComposition } = await import("./helpers/perl-graph-composition.mjs");
	const report = await checkPerlGraphComposition(root, message => t.diagnostic(message));
	await saveLakeFile("build/recursive", "perl-composition.json", canonicalJson(report));
});

test("recursive Perl documentation builds original archives and rejects installed native tampering", {
	skip: process.env.LEAN_BRIDGE_PERL_GRAPH_DOCUMENTATION_TEST !== "1"
	, timeout: 900_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-perl-graph-documentation-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkPerlGraphDocumentation } = await import("./helpers/perl-graph-documentation.mjs");
	const report = await checkPerlGraphDocumentation(root, message => t.diagnostic(message));
	await saveLakeFile("build/recursive", "perl-documentation.json", canonicalJson(report));
});
