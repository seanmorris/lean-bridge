/**
 * Named Perl constructors, compiler-owned accessors and pinned copied payloads.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createNativeModel, generateNativeLeanAdapters, nativeTypeKey } from "../src/build/native-model.mjs";
import { generatePerlBindingPackage, validatePerlModel } from "../src/backends/perl/generate.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";

const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const word = { kind: "primitive", name: "uint32", lean: "UInt32", abi: { cType: "uint32_t", box: "lean_box_uint32", unbox: "lean_unbox_uint32", heap: false } };
const text = { kind: "primitive", name: "string", lean: "String", abi };
const signal = () => ({
	kind: "variant", name: "Sample.Signal", lean: "Sample.Signal", abi
	, cases: [
		{ name: "idle", constructor: "Sample.Signal.idle", fields: [] }
		, { name: "data", constructor: "Sample.Signal.data", fields: [{ name: "count", type: word }, { name: "label", type: text }] }
	]
});
const model = (shape = signal()) => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	projection.parameters[0].type = projection.result = shape;
	return createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" }, moduleName: "LeanBridge::Sample" });
};
const receipt = { library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64), initializer: "initialize_Sample" };

test("Perl variants expose named constructors and schema-checked keyword fields", () => {
	const original = model(), files = generatePerlBindingPackage(original, receipt);
	assert.deepEqual(files, generatePerlBindingPackage(structuredClone(original), receipt));
	const pm = files["lib/LeanBridge/Sample.pm"];
	assert.match(pm, /package LeanBridge::Sample::Signal;/);
	assert.match(pm, /package LeanBridge::Sample::Signal::Data;/);
	assert.match(pm, /our @ISA = \('LeanBridge::Sample::Signal'\)/);
	assert.match(pm, /qw\(count label\)/);
	assert.match(pm, /duplicate constructor field/);
	assert.match(pm, /constructor fields do not match/);
	assert.match(pm, /sub count \{ \$_\[0\]->\{count\} \}/);
	assert.doesNotMatch(pm, /constructor_tag|lean_obj_tag|XS::|JSON::/);
	assert.match(pm, /=head1 TAGGED VARIANTS/);
});

test("Perl variants pin all fields before child conversions and validate tags before accessors", () => {
	const original = model(), xs = generatePerlBindingPackage(original, receipt)["Component.xs"];
	const key = original.types.find(type => type.kind === "variant").key;
	assert.match(xs, /lbp_is_branch\(value, "LeanBridge::Sample::Signal::Data"\)/);
	assert.match(xs, /HvUSEDKEYS\(input\) != 2/);
	assert.ok(xs.indexOf('SV *slot1 = lbp_field(aTHX_ input, "label", 5)') < xs.indexOf(`lb_read_${nativeTypeKey(word)}(aTHX_ scope, slot0)`));
	assert.match(xs, /switch \(tag\)/);
	assert.ok(xs.indexOf(`lb_t${key}_tag(value)`) < xs.indexOf(`lb_t${key}_get1_0(value)`));
	assert.match(xs, /Invalid native .* constructor/);
	assert.doesNotMatch(xs, /lean_ctor_|lean_obj_tag|sv_derived_from\(value, "LeanBridge::Sample::Signal/);
	const lean = generateNativeLeanAdapters(original).leanSource;
	assert.match(lean, /match value with \| \.idle/);
	assert.match(lean, /_root_\.Sample\.Signal\.data a0 a1/);
});

test("Perl variant naming rejects collisions and reserved methods without losing underscores", () => {
	for(const name of ["can", "isa", "VERSION", "AUTOLOAD", "import", "BEGIN", "UNITCHECK", "CHECK", "INIT", "END"])
	{
		const shape = signal(); shape.cases[1].fields[0].name = name;
		assert.throws(() => validatePerlModel(model(shape)), /reserved.*field/);
	}
	const collision = signal(); collision.cases[1] = { name: "Idle", constructor: "Sample.Signal.Idle", fields: [] };
	assert.throws(() => validatePerlModel(model(collision)), /class name collision/);
	const underscore = signal(); underscore.cases[0].name = "idle_"; underscore.cases[0].constructor = "Sample.Signal.idle_";
	assert.match(generatePerlBindingPackage(model(underscore), receipt)["lib/LeanBridge/Sample.pm"], /package LeanBridge::Sample::Signal::Idle_;/);
	const some = signal(); some.name = some.lean = "Sample.Some";
	for(const branch of some.cases) branch.constructor = `Sample.Some.${branch.name}`;
	assert.throws(() => validatePerlModel(model({ kind: "option", element: some, abi })), /class name collision/);
});

test("Perl aliases retain their named variant family without an extra wrapper", () => {
	const shape = { kind: "alias", name: "Sample.SignalView", lean: "Sample.SignalView", target: signal(), abi };
	const files = generatePerlBindingPackage(model(shape), receipt);
	assert.deepEqual(JSON.parse(files["binding-manifest.json"]).aliases.map(alias => alias.perlType), ["LeanBridge::Sample::Signal"]);
	assert.doesNotMatch(files["lib/LeanBridge/Sample.pm"], /package LeanBridge::Sample::SignalView;/);
});

test("Perl variants retain recursive, copied-identity and compound-callback gates", () => {
	const recursive = signal(); recursive.cases[1].fields[0].type = recursive;
	assert.throws(() => model(recursive), /nesting/);
	const callback = { kind: "callback", parameters: [signal()], result: word, abi };
	assert.throws(() => validatePerlModel(model(callback)), /compound callbacks/);
	for(const child of [{ kind: "resource", name: "Sample.R", lean: "Sample.R", module: "Sample", abi }, { kind: "callback", parameters: [word], result: word, abi }])
	{
		const shape = signal(); shape.cases[1].fields[0].type = child;
		assert.throws(() => model(shape), /ownership policy|retention policy/);
	}
});
