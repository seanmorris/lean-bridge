/**
 * Perl compound admission, branch semantics and private typed-constructor calls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createNativeModel, nativeTypeKey } from "../src/build/native-model.mjs";
import { generatePerlBindingPackage, validatePerlModel } from "../src/backends/perl/generate.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { compoundSignatures } from "./helpers/compound-fixture.mjs";
import { assertCompoundSourceHash } from "./helpers/compound-source-history.mjs";

const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const unit = { kind: "primitive", name: "unit", lean: "Unit", abi: { ...abi, heap: false } };
const option = element => ({ kind: "option", element, abi });
const pair = (kind, a, b) => ({ kind, arguments: [a, b], abi });
const model = (shape = option(pair("result", pair("tuple", unit, option(unit)), option(unit)))) => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	projection.parameters[0].type = shape; projection.result = shape;
	return createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" }, moduleName: "LeanBridge::Sample" });
};
const receipt = { library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64), initializer: "initialize_Sample" };

test("Perl compounds use typed constructors, independent branches and nested binary products", () => {
	const original = model(), files = generatePerlBindingPackage(original, receipt);
	assert.deepEqual(files, generatePerlBindingPackage(structuredClone(original), receipt));
	const xs = files["Component.xs"], pm = files["lib/LeanBridge/Sample.pm"];
	for(const suffix of ["none", "some", "has", "ok", "error", "get0", "get1", "make"]) assert.match(xs, new RegExp(`lb_t[a-f0-9]+_${suffix}\\(`));
	assert.doesNotMatch(xs, /lean_ctor_|lean_obj_tag|JSON|dispatch/);
	for(const name of ["Some", "Ok", "Err"])
	{
		assert.ok(pm.includes(`package LeanBridge::Sample::${name};`));
		assert.ok(pm.includes(`unless @_ == 2 && $_[0] eq 'LeanBridge::Sample::${name}'`));
	}
	assert.match(xs, /if \(!SvOK\(value\)\) return lbp_keep/);
	assert.match(xs, /av_count\(input\) != 2/);
	assert.match(xs, /SvOBJECT\(SvRV\(value\)\) \|\| SvMAGICAL/);
	assert.ok(xs.indexOf("SV *slot1 =") < xs.indexOf("aTHX_ scope, slot0"));
	assert.match(pm, /Some->new\(undef\)/);
	assert.match(pm, /reference equality is not deep value equality/);
	assert.doesNotMatch(generatePerlBindingPackage(model(unit), receipt)["lib/LeanBridge/Sample.pm"], /::Some;/);
	const array = generatePerlBindingPackage(model({ kind: "array", element: option(unit), abi }), receipt)["Component.xs"];
	assert.ok(array.indexOf("lean_array_set_core(result, i, lean_box(0))") < array.indexOf("lbp_keep(scope, result)"));
	assert.doesNotMatch(array, /lbp_keep\(scope, lean_alloc_array/);
});

for(const name of ["Some", "Ok", "Err"]) test(`Perl compound helper ${name} cannot collide with a generated record`, () => {
	const record = { kind: "record", name: `Sample.${name}`, lean: `Sample.${name}`, constructor: `Sample.${name}.mk`, fields: [], abi };
	assert.throws(() => validatePerlModel(model(option(pair("result", record, unit)))), /class name collision/);
});

test("Perl compound admission keeps callable payloads, copied identity and deep schemas closed", () => {
	const children = [option(unit)
		, pair("tuple", unit, unit), pair("result", unit, unit)
		, { kind: "array", element: option(unit), abi }
		, { kind: "record", name: "Sample.P", lean: "Sample.P", constructor: "Sample.P.mk", fields: [{ name: "value", projection: "Sample.P.value", type: option(unit) }], abi }];
	for(const child of children)
	{
		for(const [parameters, result] of [[[child], unit], [[unit], child]])
		{
			// Exercise early admission directly; binding IR resource declarations are separate.
			const callback = { kind: "callback", parameters, result, abi }, checked = model();
			checked.types.push({ ...callback, key: nativeTypeKey(callback) });
			assert.throws(() => validatePerlModel(checked), /compound callbacks are not implemented/);
		}
	}
	for(const child of [{ kind: "callback", parameters: [unit], result: unit, abi }
		, { kind: "resource", name: "Sample.R", lean: "Sample.R", module: "Sample", abi }])
		assert.throws(() => model(option(child)), /retention policy|ownership policy/);
	let deep = unit; for(let i = 0; i < 34; i++) deep = option(deep);
	assert.throws(() => model(deep), /nesting/);
});

test("Perl compound evidence binds eight executions to unchanged relocated installations", async () => {
	const record = JSON.parse(await readFile("docs/evidence/perl-compounds-20260920.json"));
	const consumer = await readFile("tests/fixtures/compound-consumers/perl.pl", "utf8");
	assert.doesNotMatch(consumer, /LeanBridge::Runtime|Compounds::_|XSLoader|DynaLoader|lean_ctor_/);
	assert.equal(record.wordBits, 64);
	assert.deepEqual(record.signatures, compoundSignatures);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assertCompoundSourceHash(path, await readFile(path), hash);
	assert.equal(record.executions.length, 8);
	const expected = ["ordinary-source", "reviewed-ir"].flatMap(path => record.perlAbis.map(abi => `${path}/${abi}`));
	assert.deepEqual(record.executions.map(run => `${run.path}/${run.perl.slice(1)}-${run.threaded ? "threaded" : "unthreaded"}`), expected);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "perl"); assert.equal(run.checks, 78980);
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/compound-consumers/perl.pl"]);
		for(const key of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeExecution", "relocatedInstallation", "producerHandoffRemoved", "publicApiOnly", "repeatExecution", "installedFilesUnchanged", "isolatedCompiledFaultProbe"]) assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "perlSha256", "probeSha256", "probeSourceSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.deepEqual(run.faults, { checks: 263, conversion_checkpoints: 242, host_exceptions: 4, partial_inputs: 16, reentrant_products: 1 });
		assert.deepEqual(run.nativeLibraries, Object.fromEntries(Object.entries(run.installedFiles).filter(([path]) => path.endsWith(".so")).map(([path, file]) => [path, file.sha256])));
		assert.equal(Object.keys(run.nativeLibraries).length, 5);
		assert.equal(run.packages.length, 2);
		assert.ok(run.packages.every(pkg => pkg.ecosystem === "cpan"));
	}
});
