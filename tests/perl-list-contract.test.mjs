/**
 * Perl List admission, typed Lean helpers and exception-safe sequence copies.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { createNativeModel, nativeTypeKey, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { generatePerlBindingPackage, validatePerlModel } from "../src/backends/perl/generate.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { listSignatures } from "./helpers/list-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const unit = { kind: "primitive", name: "unit", lean: "Unit", abi: { ...abi, heap: false } };
const list = element => ({ kind: "list", element, abi });
const model = (shape = list(list(unit))) => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	projection.parameters[0].type = shape; projection.result = shape;
	return createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" }, moduleName: "LeanBridge::Sample" });
};
const receipt = { library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64), initializer: "initialize_Sample" };

test("Perl List evidence binds eight executions to unchanged relocated installations", async () => {
	const record = JSON.parse(await readFile("docs/evidence/perl-lists-20260921.json"));
	const consumer = await readFile("tests/fixtures/list-consumers/perl.pl", "utf8");
	assert.doesNotMatch(consumer, /LeanBridge::Runtime|Lists::_|XSLoader|DynaLoader|lean_ctor_/);
	assert.equal(record.wordBits, 64); assert.deepEqual(record.signatures, listSignatures);
	assert.deepEqual(record.perlAbis, ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"]);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.equal(record.executions.length, 8);
	const expected = ["ordinary-source", "reviewed-ir"].flatMap(path => record.perlAbis.map(abi => `${path}/${abi}`));
	assert.deepEqual(record.executions.map(run => `${run.path}/${run.perl.slice(1)}-${run.threaded ? "threaded" : "unthreaded"}`), expected);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "perl"); assert.equal(run.checks, 112738);
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/list-consumers/perl.pl"]);
		for(const key of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeExecution", "relocatedInstallation", "producerHandoffRemoved", "publicApiOnly", "repeatExecution", "installedFilesUnchanged", "isolatedCompiledFaultProbe"]) assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "perlSha256", "probeSha256", "probeSourceSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.deepEqual(run.faults, { checks: 710, conversion_checkpoints: 687, host_exceptions: 4, partial_inputs: 16, reentrant_lists: 3 });
		assert.deepEqual(run.nativeLibraries, Object.fromEntries(Object.entries(run.installedFiles).filter(([path]) => path.endsWith(".so")).map(([path, file]) => [path, file.sha256])));
		assert.equal(Object.keys(run.nativeLibraries).length, 5);
		assert.equal(run.packages.length, 2); assert.ok(run.packages.every(pkg => pkg.ecosystem === "cpan"));
	}
});

test("Perl Lists use typed bounded Lean helpers and preserve native List/Array identity", () => {
	const original = model(), files = generatePerlBindingPackage(original, receipt);
	assert.deepEqual(files, generatePerlBindingPackage(structuredClone(original), receipt));
	const xs = files["Component.xs"], pm = files["lib/LeanBridge/Sample.pm"];
	assert.match(xs, /lean_inc\(result\); return lbp_keep\(scope, lb_t[a-f0-9]+_from_array\(result\)\)/);
	assert.match(xs, /lean_inc\(value\); value = lbp_keep\(scope, lb_t[a-f0-9]+_to_array\(value\)\)/);
	assert.match(xs, /length > 16 \* 1024 \* 1024 \/ sizeof\(void \*\)/);
	assert.doesNotMatch(xs, /lean_ctor_|lean_obj_tag|JSON|dispatch/);
	assert.notEqual(nativeTypeKey(list(unit)), nativeTypeKey({ kind: "array", element: unit, abi }));
	assert.match(pm, /Lean List inputs, results and record fields use copied plain array references/);
	assert.doesNotMatch(generatePerlBindingPackage(model(unit), receipt)["lib/LeanBridge/Sample.pm"], /=head1 LISTS/);
	const glue = generateNativeLeanAdapters(original);
	assert.match(glue.leanSource, /value\.toList/);
	assert.match(glue.leanSource, /loop 2097153 value #\[\]/);
});

test("Perl List input checks precede host calls and ownership registration sees initialized arrays", () => {
	const xs = generatePerlBindingPackage(model(), receipt)["Component.xs"];
	assert.match(xs, /SvOBJECT\(SvRV\(value\)\) \|\| \(SvMAGICAL\(SvRV\(value\)\) && mg_find\(SvRV\(value\), PERL_MAGIC_tied\)\)/);
	assert.match(xs, /sparse Perl Lists are unsupported/);
	assert.ok(xs.indexOf("av_push(slots, SvREFCNT_inc(*entry))") < xs.indexOf("lean_alloc_array(length, length)"));
	assert.ok(xs.indexOf("lean_array_set_core(result, i, lean_box(0))") < xs.indexOf("lbp_keep(scope, result)"));
	assert.doesNotMatch(xs, /lbp_keep\(scope, lean_alloc_array/);
	assert.match(xs, /av_fetch\(slots, i, 0\)/);
});

test("Perl List callback payloads retain copied identity and depth checks", () => {
	const children = [list(unit), { kind: "array", element: list(unit), abi }
		, { kind: "record", name: "Sample.P", lean: "Sample.P", constructor: "Sample.P.mk", fields: [{ name: "value", projection: "Sample.P.value", type: list(unit) }], abi }];
	for(const child of children) for(const [parameters, result] of [[[child], unit], [[unit], child]])
	{
		const callback = { kind: "callback", parameters, result, abi }, checked = model();
		checked.types.push({ ...callback, key: nativeTypeKey(callback) });
		assert.doesNotThrow(() => validatePerlModel(checked));
	}
	for(const child of [{ kind: "callback", parameters: [unit], result: unit, abi }
		, { kind: "resource", name: "Sample.R", lean: "Sample.R", module: "Sample", abi }])
		assert.throws(() => model(list(child)), /retention policy|ownership policy/);
	let deep = unit; for(let i = 0; i < 34; i++) deep = list(deep);
	assert.throws(() => model(deep), /nesting/);
});

const perl = process.env.LEAN_BRIDGE_CORPUS_PERL ?? "/usr/bin/perl";
test("Perl List consumer assertions cannot mistake a regex failure's message for success", { skip: !existsSync(perl) }, async () => {
	for(const file of ["perl.pl", "perl-faults.pl"])
	{
		const source = await readFile(`tests/fixtures/list-consumers/${file}`, "utf8");
		const check = source.split("\n").find(line => line.startsWith("sub check "));
		assert.match(check, /^sub check \(\$;\$\)/);
		const script = `use strict; use warnings; use Carp qw(confess); my $checks = 0; my $context = 'assertion test';
${check}
my $passed = eval { check('wrong' =~ /expected/, 'failure message'); 1 };
die 'false regex accepted' if $passed;
check('expected' =~ /expected/, 'success');`;
		await runCopied(perl, ["-e", script], process.cwd());
	}
});
