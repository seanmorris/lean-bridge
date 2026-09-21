/**
 * Perl Array and record admission, pinned inputs and named constructors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createNativeModel, nativeTypeKey } from "../src/build/native-model.mjs";
import { generatePerlBindingPackage } from "../src/backends/perl/generate.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { collectionReviewedIr, collectionSignatures } from "./helpers/collection-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const unit = { kind: "primitive", name: "unit", lean: "Unit", abi: { ...abi, heap: false } };
const array = element => ({ kind: "array", element, abi });
const fields = ["first", "second"].map(name => ({ name, projection: `Sample.Point.${name}`, type: unit }));
const record = { kind: "record", name: "Sample.Point", lean: "Sample.Point"
	, constructor: "Sample.Point.mk", fields, abi };
const model = shape => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	projection.parameters[0].type = shape; projection.result = shape;
	return createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" }, moduleName: "LeanBridge::Sample" });
};
const receipt = { library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64), initializer: "initialize_Sample" };

test("the independent collection contract covers every primitive, seven records and 24 nested arrays", async () => {
	const ir = collectionReviewedIr();
	assert.equal(ir.declarations.length, 35); assert.equal(ir.types.length, 7);
	assert.equal(collectionSignatures.filter(item => item.name.startsWith("Collections.arrayReverse")).length, 19);
	let depth = 0, type = collectionSignatures.find(item => item.name === "Collections.deep").result;
	while(typeof type !== "string")
	{ depth++; type = type.array; }
	assert.equal(depth, 24); assert.equal(type, "uint32");
	const source = await readFile("tests/fixtures/collection-consumers/perl.pl", "utf8");
	assert.doesNotMatch(source, /LeanBridge::Runtime|Collections::_|XSLoader|DynaLoader|lean_ctor_/);
	assert.match(source, /sub check \(\$;\$\)/);
});

test("Perl Arrays pin dense plain input slots before allocating or converting Lean elements", () => {
	const checked = model(array(array(unit))), files = generatePerlBindingPackage(checked, receipt);
	assert.deepEqual(files, generatePerlBindingPackage(structuredClone(checked), receipt));
	const xs = files["Component.xs"];
	assert.match(xs, /SvOBJECT\(SvRV\(value\)\).*mg_find\(SvRV\(value\), PERL_MAGIC_tied\)/);
	assert.match(xs, /Array requires a plain array reference/);
	assert.match(xs, /sparse Perl arrays/);
	assert.ok(xs.indexOf("av_push(slots, SvREFCNT_inc(*entry))") < xs.indexOf("lean_alloc_array(length, length)"));
	assert.ok(xs.indexOf("lean_array_set_core(result, i, lean_box(0))") < xs.indexOf("lbp_keep(scope, result)"));
	assert.match(xs, /av_fetch\(slots, i, 0\)/);
	assert.match(xs, /length > 16 \* 1024 \* 1024 \/ sizeof\(void \*\)/);
	assert.doesNotMatch(xs, /lean_ctor_|lean_obj_tag|JSON|dispatch/);
	assert.match(files["lib/LeanBridge/Sample.pm"], /=head1 ARRAYS AND RECORDS/);
});

test("Perl records validate exact nominal types and pin every field before any conversion", () => {
	const files = generatePerlBindingPackage(model(record), receipt), xs = files["Component.xs"];
	assert.match(xs, /lbp_is_branch\(value, "LeanBridge::Sample::Point"\)/);
	assert.doesNotMatch(xs, /sv_derived_from/);
	assert.ok(xs.indexOf('SV *slot1 = lbp_field(aTHX_ input, "second", 6)') < xs.indexOf(`lb_read_${nativeTypeKey(unit)}(aTHX_ scope, slot0)`));
	assert.match(xs, /HvUSEDKEYS.*!= 2/);
	assert.match(files["lib/LeanBridge/Sample.pm"], /last-value-wins hash semantics/);
	assert.match(files["lib/LeanBridge/Sample.pm"], /unless @_ % 2 == 1 && \$_\[0\] eq 'LeanBridge::Sample::Point'/);
});

test("Perl record fields cannot replace constructors, object methods or phase hooks", () => {
	for(const name of ["new", "DESTROY", "CLONE", "CLONE_SKIP", "can", "isa", "DOES", "VERSION", "import", "unimport", "AUTOLOAD", "BEGIN", "UNITCHECK", "CHECK", "INIT", "END"])
	{
		const shape = { ...record, fields: [{ ...record.fields[0], name, projection: `Sample.Point.${name}` }] };
		const common = ["new", "DESTROY", "CLONE", "CLONE_SKIP"].includes(name);
		assert.throws(() => generatePerlBindingPackage(model(shape), receipt), common ? /native-library-v1: invalid or reserved record field/ : /Perl reserved record field/);
	}
});

const perl = process.env.LEAN_BRIDGE_CORPUS_PERL ?? "/usr/bin/perl";
test("generated Perl record constructors reject malformed named fields without warnings", { skip: !existsSync(perl) }, async () => {
	const pm = generatePerlBindingPackage(model(record), receipt)["lib/LeanBridge/Sample.pm"];
	const constructors = `package LeanBridge::Sample::Point;${pm.split("package LeanBridge::Sample::Point;")[1].split("\n1;\n")[0]}`;
	const script = `use strict; use warnings; $SIG{__WARN__} = sub { die @_ };
${constructors}
package Child; our @ISA = ('LeanBridge::Sample::Point');
package main;
my $point = LeanBridge::Sample::Point->new(first => undef, second => undef);
die 'wrong class' unless ref($point) eq 'LeanBridge::Sample::Point';
for my $args ([], ['first'], [first => undef], [first => undef, second => undef, extra => 1],
    [undef, 1], [[], 1]) {
  my $ok = eval { LeanBridge::Sample::Point->new(@$args); 1 };
  die 'accepted malformed constructor' if $ok;
  die 'unexpected warning or error' unless $@ =~ /expects named fields|record field/;
}
die 'subclass accepted' if eval { Child->new(first => undef, second => undef); 1 };
my $updated = LeanBridge::Sample::Point->new(%$point, first => 9);
die 'record update changed Perl hash semantics' unless $updated->first == 9 && !defined($point->first);`;
	const result = await runCopied(perl, ["-e", script], process.cwd());
	assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
});
