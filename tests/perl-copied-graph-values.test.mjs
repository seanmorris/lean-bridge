/**
 * Finite Perl declarations preserve recursive nominal and compound identities.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedPerlGraphValues } from "../src/backends/perl/copied-graph-values.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { perlAliasGraphIr, perlLinkedGraphIr, perlBuiltinGraphIr } from "./helpers/perl-graph-values-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const generate = ir => generateCopiedPerlGraphValues(ir, "LeanBridge::Recursive");

test("Perl recursive declarations retain nominal edges and transparent aliases", () => {
	const ir = nativeRecursiveReviewedIr(), before = structuredClone(ir), model = generate(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generate(ir), model);
	const reversed = structuredClone(ir); reversed.types.reverse();
	assert.deepEqual(generate(reversed), model);
	assert.equal(model.functions.length, 18); assert.equal(model.types.length, 38);
	assert.match(model.source, /package LeanBridge::Recursive::Spine::Next;/);
	assert.match(model.source, /our @ISA = \('LeanBridge::Recursive::Spine'\);/);
	assert.match(model.source, /# value: Spine\nsub value/);
	assert.match(model.source, /# Forest = list<Tree>; Perl: array reference/);
	assert.match(model.source, /sub char \{/); assert.doesNotMatch(model.source, /sub char_ \{/);
	assert.ok(model.types.filter(type => type.kind === "primitive").every(type => typeof type.publicType === "string"));
	assert.deepEqual(model.aliases.find(type => type.name === "TreeAlias"), {
		id: "lean:Recursive.TreeAlias", name: "TreeAlias"
		, target: { kind: "named", id: "lean:Recursive.Tree" }
		, contractType: "Tree", perlType: "LeanBridge::Recursive::Tree" });
	assert.doesNotMatch(model.source, /XSLoader|DynaLoader|lean_object|constructor_tag|JSON|sub spine|package LeanBridge::Recursive::(?:Forest|TreeAlias);/);
	assert.throws(() => compileNativeGraphProjection(ir, ["cpan"]), { code: "native-graph-projection-unavailable" });
});

test("Perl graph declarations reject unsafe namespace, lifecycle and constructor names", () => {
	for(const moduleName of ["Other::Recursive", "LeanBridge::Runtime", "LeanBridge::Runtime::Child", "LeanBridge::Recursive;die"])
		assert.throws(() => generateCopiedPerlGraphValues(nativeRecursiveReviewedIr(), moduleName), /module/);
	for(const name of ["Some", "Ok", "Err", "Runtime", "Spine"])
	{
		const ir = nativeRecursiveReviewedIr(); ir.types.find(type => type.name === "Scalars").name = name;
		assert.throws(() => generate(ir), /reserved|collision|invalid/i);
	}
	for(const name of ["new", "DESTROY", "CLONE", "CLONE_SKIP", "AUTOLOAD", "can", "isa", "import", "VERSION"])
	{
		const ir = perlLinkedGraphIr(); ir.types[0].fields[1].name = name;
		assert.throws(() => generate(ir), /field|collision/i);
	}
	const duplicate = nativeRecursiveReviewedIr();
	duplicate.types.find(type => type.name === "Spine").cases[1].name = "Next";
	assert.throws(() => generate(duplicate), /constructor|collision/i);
	const reserved = nativeRecursiveReviewedIr();
	reserved.types.find(type => type.name === "Spine").cases[0].name = "DESTROY";
	assert.throws(() => generate(reserved), /constructor/);
	for(const name of ["new", "can", "isa", "import", "true", "false"])
	{
		const ir = perlLinkedGraphIr(); ir.declarations[0].source.declaration = `Recursive.${name}`;
		assert.throws(() => generate(ir), /function|collision/i);
	}
});

test("Perl graph declaration size follows finite nodes, not alias expansion", () => {
	const deep = generate(perlAliasGraphIr());
	assert.equal(deep.types.length, 700); assert.equal(deep.aliases.length, 700);
	assert.ok(deep.source.length < 100000);
	assert.match(deep.source, /# Alias699 = tuple<Alias698, Alias698>; Perl: array reference/);
	assert.doesNotMatch(deep.source, /package LeanBridge::Recursive::Alias/);
	const linked = generate(perlLinkedGraphIr());
	assert.match(linked.source, /# tail: option<Link>/);
	assert.match(generate(perlBuiltinGraphIr()).source, /CORE::bless/);
});

test("Perl recursive declarations execute on selected pinned interpreter ABIs", {
	skip: process.env.LEAN_BRIDGE_PERL_GRAPH_TEST !== "1", timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-perl-graph-values-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const perls = process.env.LEAN_BRIDGE_PERLS ? JSON.parse(process.env.LEAN_BRIDGE_PERLS)
		: process.env.LEAN_BRIDGE_CORPUS_PERL ? [process.env.LEAN_BRIDGE_CORPUS_PERL]
			: ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"].map(abi => resolve(`.toolchains/perl/${abi}/bin/perl`));
	assert.ok(Array.isArray(perls) && perls.length && perls.every(perl => typeof perl === "string" && perl.length));
	const generated = Object.fromEntries(Object.entries({ Recursive: nativeRecursiveReviewedIr()
		, Linked: perlLinkedGraphIr()
		, Deep: perlAliasGraphIr()
		, Builtins: perlBuiltinGraphIr() })
		.map(([name, ir]) => [`LeanBridge/${name}.pm`, generateCopiedPerlGraphValues(ir, `LeanBridge::${name}`).source]));
	for(const [path, source] of Object.entries(generated)) await saveLakeFile(root, path, source);
	const probe = await readFile("tests/fixtures/structured-types/recursive-values.pl", "utf8");
	await saveLakeFile(root, "check.pl", probe);
	const reports = [];
	for(const perl of perls)
	{
		const result = await runCopied(resolve(perl), ["-I", root, "check.pl"], root);
		assert.equal(result.stderr, ""); const report = JSON.parse(result.stdout);
		assert.ok(["5.36.3", "5.38.2"].includes(report.perl));
		assert.equal(report.wordBits, 64); assert.equal(report.pointerBits, 64); assert.ok(report.checks >= 100);
		reports.push(report);
	}
	await saveLakeFile("build/recursive", "perl-values.json", canonicalJson({ schemaVersion: 1
		, installedPackage: false, compiledLean: false
		, reports, probeSha256: sha256(probe)
		, sourceHashes: Object.fromEntries(Object.entries(generated).map(([path, source]) => [path, sha256(source)])) }));
});

test("Perl CI requires declaration execution and retains its per-ABI report", async () => {
	const workflow = await readFile(".github/workflows/perl-consumer.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_PERL_GRAPH_TEST=1 node --test tests/perl-copied-graph-values.test.mjs"));
	assert.ok(workflow.includes("test -s build/recursive/perl-values.json"));
	assert.ok(workflow.includes("            build/recursive/perl-values.json\n"));
});
