/**
 * Transparent Perl alias contracts, target mappings and generated POD checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { generatePerlBindingPackage } from "../src/backends/perl/generate.mjs";
import { perlCopiedAliases, perlAliasPod } from "../src/backends/perl/copied-aliases.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { aliasPrimitives, nativeAliasReviewedIr, nativeAliasSignatures } from "./helpers/native-alias-fixture.mjs";
import { perlAliasValueTypes } from "./helpers/perl-alias-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const model = (mutate = () => {}) => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	const target = projection.parameters[0].type;
	const count = { kind: "alias", name: "Sample.Count", lean: "Sample.Count", target, abi: target.abi };
	projection.parameters[0].type = count;
	projection.result = { kind: "alias", name: "Sample.OtherCount", lean: "Sample.OtherCount", target: count, abi: target.abi };
	mutate(projection);
	return createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" }, moduleName: "LeanBridge::Sample" });
};
const receipt = { library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64), initializer: "initialize_Sample" };

test("Perl alias evidence binds all eight executions to unchanged relocated installations", async () => {
	const record = JSON.parse(await readFile("docs/evidence/perl-aliases-20260921.json"));
	assert.equal(record.wordBits, 64); assert.deepEqual(record.signatures, nativeAliasSignatures); assert.deepEqual(record.primitives, aliasPrimitives);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(nativeAliasReviewedIr())));
	assert.deepEqual(record.perlAbis, ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"]);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.equal(record.executions.length, 8);
	assert.deepEqual(record.executions.map(run => `${run.path}/${run.perl.slice(1)}-${run.threaded ? "threaded" : "unthreaded"}`), ["ordinary-source", "reviewed-ir"].flatMap(path => record.perlAbis.map(abi => `${path}/${abi}`)));
	const expected = nativeAliasReviewedIr().types.filter(type => type.kind === "alias").map(({ id, name, target }) => ({ id, name, target, perlType: perlAliasValueTypes[name] }));
	for(const run of record.executions)
	{
		assert.equal(run.profile, "perl"); assert.equal(run.checks, 11732); assert.equal(run.primitives.length, 19);
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/alias-consumers/perl.pl"]);
		for(const key of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeExecution", "relocatedInstallation", "producerHandoffRemoved", "publicApiOnly", "repeatExecution", "installedFilesUnchanged", "isolatedCompiledFaultProbe"]) assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256", "perlSha256", "probeSha256", "probeSourceSha256", "contractSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.deepEqual(run.faults, { checks: 574, conversion_checkpoints: 506, host_exceptions: 4, partial_inputs: 64 });
		assert.deepEqual(run.catalog.aliases, expected);
		for(const flag of ["transparentTargetValues", "installedSourceDocumentation", "originalAliasChains"]) assert.equal(run.catalog[flag], true);
		assert.deepEqual(run.nativeLibraries, Object.fromEntries(Object.entries(run.installedFiles).filter(([path]) => path.endsWith(".so")).map(([path, file]) => [path, file.sha256])));
		assert.equal(Object.keys(run.nativeLibraries).length, 5);
		const sibling = record.executions.find(other => other.path !== run.path && other.perl === run.perl && other.threaded === run.threaded);
		assert.deepEqual(run.nativeLibraries, sibling.nativeLibraries);
		assert.equal(run.packages.length, 2); assert.ok(run.packages.every(pkg => pkg.ecosystem === "cpan"));
	}
	const consumer = await readFile("tests/fixtures/alias-consumers/perl.pl", "utf8");
	assert.doesNotMatch(consumer, /LeanBridge::Runtime|Aliases::_|XSLoader|DynaLoader|lean_ctor_/);
});

test("Perl alias installed evidence promotes exactly six copied cells and runs in CI", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes("perl-aliases-installed"));
	assert.equal(cells.length, 6);
	for(const cell of cells)
	{
		assert.equal(cell.profile, "perl"); assert.equal(cell.shape, "alias"); assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["perl-aliases-installed"]); }
	}
	const workflow = await readFile(".github/workflows/perl-consumer.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_PERL_ALIAS_TEST=1 node --test tests\/perl-aliases.test.mjs tests\/perl-alias-contract.test.mjs/);
	assert.match(workflow, /test -s build\/aliases\/perl\.json/);
	assert.match(workflow, /path: \|[^]*?build\/aliases\/perl\.json/);
});

test("Perl aliases keep source names and chains while native converters use target types", () => {
	const original = model(), files = generatePerlBindingPackage(original, receipt);
	assert.deepEqual(files, generatePerlBindingPackage(structuredClone(original), receipt));
	const manifest = JSON.parse(files["binding-manifest.json"]), pod = files["lib/LeanBridge/Sample.pm"];
	assert.deepEqual(manifest.aliases.map(({ name, target }) => ({ name, target })), [
		{ name: "Count", target: { kind: "primitive", name: "uint32" } }
		, { name: "OtherCount", target: { kind: "named", id: "lean:Sample.Count" } }
	]);
	assert.ok(manifest.aliases.every(alias => alias.perlType === "unsigned integer scalar"));
	assert.match(pod, /Parameter C<arg0>: C<Count>\. Returns C<OtherCount>\./);
	assert.match(pod, /=item C<OtherCount>\n\nContract: C<Count>/);
	assert.doesNotMatch(pod, /package LeanBridge::Sample::(?:Count|OtherCount)/);
	assert.equal(original.types.length, 1); assert.equal(original.types[0].kind, "primitive");
	const plain = model(projection => {
		projection.parameters[0].type = projection.parameters[0].type.target;
		projection.result = projection.parameters[0].type;
	});
	assert.equal(files["Component.xs"], generatePerlBindingPackage(plain, receipt)["Component.xs"]);
	assert.doesNotMatch(generatePerlBindingPackage(plain, receipt)["lib/LeanBridge/Sample.pm"], /=head1 COPIED ALIASES|Returns C</);
	assert.equal(JSON.parse(generatePerlBindingPackage(plain, receipt)["binding-manifest.json"]).aliases, undefined);
});

test("Perl alias host catalog preserves all 27 independently specified targets", () => {
	const ir = nativeAliasReviewedIr();
	const original = { bindingIr: ir, moduleName: "LeanBridge::Aliases", types: ir.types.filter(type => type.kind === "record").map(type => ({ kind: "record", name: type.source.declaration })) };
	const aliases = perlCopiedAliases(original);
	assert.equal(aliases.length, 27);
	assert.deepEqual(aliases.map(({ id, name, target }) => ({ id, name, target })), ir.types.filter(type => type.kind === "alias").map(({ id, name, target }) => ({ id, name, target })));
	for(const alias of aliases) assert.equal(alias.perlType, perlAliasValueTypes[alias.name], alias.name);
	const pod = perlAliasPod(original, aliases).join("\n");
	assert.match(pod, /C<Maybe>/); assert.match(pod, /optionE<lt>optionE<lt>AUnitE<gt>E<gt>/);
	assert.match(pod, /C<Packet.rows>/); assert.match(pod, /C<Scalars.v_nat>/);
	assert.match(pod, /do not create separate packages or wrapper classes/);
});

test("Perl alias admission retains ownership, representation and nesting checks", () => {
	assert.throws(() => model(p => { p.parameters[0].type.name = "Sample.Count\n=cut"; }), /alias identity/);
	assert.throws(() => model(p => { p.parameters[0].type.abi = { cType: "uint64_t", box: "lean_box_uint64", unbox: "lean_unbox_uint64", heap: false }; }), /alias representation/);
	assert.throws(() => model(p => { p.parameters[0].type.target = p.parameters[0].type; }), /nesting|circular/i);
	assert.throws(() => model(p => { p.parameters[0].type.target = { kind: "resource", name: "Sample.R", lean: "Sample.R", module: "Sample", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } }; }), /ownership policy/);
	const cyclic = model(); cyclic.bindingIr.types[0].target = { kind: "named", id: cyclic.bindingIr.types[0].id };
	assert.throws(() => perlCopiedAliases(cyclic), /cyclic/);
});

test("Perl alias POD escapes formatting and never adds executable declarations", () => {
	const original = model(); original.bindingIr.types[0].name = "Count<&>\n=cut";
	const aliases = perlCopiedAliases(original), pod = perlAliasPod(original, aliases).join("\n");
	assert.match(pod, /CountE<lt>E<amp>E<gt> =cut/); assert.doesNotMatch(pod, /^=cut$/m);
});

const perl = process.env.LEAN_BRIDGE_CORPUS_PERL ?? "/usr/bin/perl";
test("Perl alias POD parses and consumer assertions reject failed regex checks", { skip: !existsSync(perl) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-perl-alias-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await saveLakeFile(root, "Sample.pm", generatePerlBindingPackage(model(), receipt)["lib/LeanBridge/Sample.pm"]);
	await runCopied(perl, ["-MPod::Checker", "-e", 'exit Pod::Checker::podchecker("Sample.pm", "/dev/null")'], root);
	for(const name of ["perl.pl", "perl-faults.pl"])
	{
		const source = await readFile(`tests/fixtures/alias-consumers/${name}`, "utf8");
		const check = source.split("\n").find(line => line.startsWith("sub check ")); assert.match(check, /^sub check \(\$;\$\)/);
		await runCopied(perl, ["-e"
			, `use strict; use warnings; use Carp qw(confess); my $checks = 0; my $context = 'test';
${check}
my $passed = eval { check('wrong' =~ /expected/, 'failure'); 1 }; die 'false regex accepted' if $passed;
check('expected' =~ /expected/, 'success');`], root);
	}
});
