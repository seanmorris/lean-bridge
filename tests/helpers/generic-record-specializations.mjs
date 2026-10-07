/**
 * Generic function specializations over named records and closed containers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertGenericRecordIr, genericRecordExports, genericRecordNodeConsumer, genericRecordSource } from "./generic-record-packages.mjs";

const types = Object.freeze({ echoNatBox: "NatBox"
	, echoAgain: "NatBoxAgain"
	, echoTextBox: "TextBox"
	, echoLeft: "Left.LeftBox", echoRight: "Right.RightBox", echoBoxes: "Boxes"
	, echoOptionalBoxes: "OptionalBoxes"
	, echoNats: "Nats"
	, echoOptionalNat: "OptionalNat" });
/**
 * Name concrete exports without adding monomorphic Lean wrappers.
 *
 * @param module - Root Lean namespace.
 */
export const genericRecordSpecializations = (module = "GenericRecords") => Object.entries(types).map(([name, type]) => ({
	name: `${module}.${name}`
	, declaration: `${module}.echo`
	, types: [`${module}.${type}`]
}));

/**
 * Keep the original fixture intact and add one polymorphic declaration.
 *
 * @param module - Concrete Lean module and root namespace.
 */
const source = async (module = "GenericRecords") => await genericRecordSource(module)
	+ "\n" + (await readFile("tests/fixtures/generic-record-specializations.lean", "utf8")).replaceAll("GenericRecords", module);
const configuration = (module = "GenericRecords") => ({
	exports: [...genericRecordExports.map(name => name.replace("GenericRecords.", `${module}.`)), ...genericRecordSpecializations(module).map(item => item.name)]
	, specializations: genericRecordSpecializations(module)
});

/**
 * Require full nominal identities and concrete, source-linked declarations.
 *
 * @param ir - Compiler-derived Binding IR.
 * @param module - Root Lean namespace.
 */
const assertIr = (ir, module) => {
	const extras = ["Left.LeftBox", "Right.RightBox"].map(name => `lean:${module}.${name}`);
	assertGenericRecordIr({ ...ir, types: ir.types.filter(type => !extras.includes(type.id)) }, module);
	const original = ir.types.find(type => type.id === `lean:${module}.NatBox`);
	for(const id of extras)
	{
		const record = ir.types.find(type => type.id === id);
		assert.equal(record.kind, "record");
		assert.deepEqual(record.fields, original.fields);
		assert.deepEqual(record.source.extensions["lean-lang.org/instantiation"], original.source.extensions["lean-lang.org/instantiation"]);
	}
	for(const { name, declaration, types: [type] } of genericRecordSpecializations(module))
	{
		const entry = ir.declarations.find(item => item.id === `lean:${name}`);
		assert.equal(entry.source.declaration, declaration);
		assert.deepEqual(entry.typeParameters, []);
		assert.deepEqual(entry.assurance, []);
		assert.deepEqual(entry.source.extensions["lean-lang.org/theorem-references"], [`${module}.echo_spec`]);
		assert.equal(entry.parameters.length, 1);
		assert.deepEqual(entry.parameters[0].type, { kind: "named", id: `lean:${type}` });
		assert.deepEqual(entry.result.type, { kind: "named", id: `lean:${type}` });
	}
	assert.ok(!ir.declarations.some(item => item.id === `lean:${module}.echo`));
};

const nodeExtra = `
check(api.echoNatBox({ value: 4n, count: 1n }).value === 4n, "specialized record");
check(api.echoAgain({ value: 4n, count: 1n }).count === 1n, "specialized second alias");
check(api.echoTextBox({ value: "héllo 🙂", count: 1n }).value === "héllo 🙂", "specialized other application");
check(api.echoLeft({ value: 5n, count: 2n }).value === 5n, "left namespace");
check(api.echoRight({ value: 6n, count: 3n }).value === 6n, "right namespace");
const echoBoxes = api.echoBoxes([{ value: 2n ** 70n, count: 0n }]);
check(echoBoxes.length === 1 && echoBoxes[0].value === 2n ** 70n && api.echoBoxes([]).length === 0, "specialized record list");
const echoOptional = api.echoOptionalBoxes({ tag: "some", value: [{ value: 3n, count: 0n }] });
check(echoOptional.tag === "some" && echoOptional.value[0].value === 3n && api.echoOptionalBoxes({ tag: "none" }).tag === "none" && api.echoOptionalBoxes({ tag: "some", value: [] }).tag === "some", "specialized optional list");
check(api.echoNats([0n, 2n ** 70n])[1] === 2n ** 70n && api.echoNats([]).length === 0, "specialized list");
check(api.echoOptionalNat({ tag: "some", value: 2n ** 70n }).value === 2n ** 70n && api.echoOptionalNat({ tag: "none" }).tag === "none", "specialized option");
rejected(() => api.echoLeft({ value: -1n, count: 0n }), "negative specialized field");
rejected(() => api.echoRight({ value: 1n }), "missing specialized field");
rejected(() => api.echoBoxes([{ value: 1, count: 0n }]), "invalid specialized list element");
rejected(() => api.echoOptionalBoxes({ tag: "some", value: [{}] }), "invalid specialized nested record");
rejected(() => api.echoOptionalNat({ tag: "some", value: 1 }), "invalid specialized option element");
assert.equal(api.echoNatBox({ value: 7n, count: 0n }).value, 7n);
`;
const typescript = `
const specializedBox: api.NatBox = api.echoNatBox(box);
const specializedAgain: api.NatBoxAgain = api.echoAgain(again);
const specializedText: api.TextBox = api.echoTextBox({ value: "text", count: 0n });
const specializedLeft: api.LeftBox = api.echoLeft({ value: 5n, count: 0n });
const specializedRight: api.RightBox = api.echoRight({ value: 6n, count: 0n });
const specializedBoxes: api.Boxes = api.echoBoxes(boxes);
const specializedOptional: api.OptionalBoxes = api.echoOptionalBoxes({ tag: "some", value: boxes });
const specializedNats: api.Nats = api.echoNats([1n, 2n]);
const specializedNat: api.OptionalNat = api.echoOptionalNat({ tag: "none" });
// @ts-expect-error A specialized record still requires exact field types.
api.echoLeft({ value: "bad", count: 0n });
// @ts-expect-error A specialized nested list still requires both record fields.
api.echoOptionalBoxes({ tag: "some", value: [{ value: 1n }] });
void specializedBox; void specializedAgain; void specializedText; void specializedLeft; void specializedRight;
void specializedBoxes; void specializedOptional; void specializedNats; void specializedNat;
`;

export const specializedGenericRecordCase = { source
	, configuration
	, assertIr
	, typescript
	, expectedNodeResult: { checks: 1019, rejections: 1010 }
	, nodeConsumer: () => genericRecordNodeConsumer().replace("console.log(JSON.stringify({ checks, rejections }));", `${nodeExtra}\nconsole.log(JSON.stringify({ checks, rejections }));`) };

// Each fragment uses the original consumer's public values and check function.
const markers = { c: "  for (unsigned long i"
	, cpp: "  for (unsigned i"
	, python: "for i in range(1000):"
	, rust: "    for i in 0..1000u64"
	, dotnet: "        for (int i"
	, java: "        for (long i"
	, kotlin: "    for (i in 0L"
	, ruby: "1000.times do"
	, perl: "for my $i (0 .. 999)"
	, "php-native": "for ($i = 0;"
	, "wit-wasi": "  for (uint64_t i" };

/**
 * Add language-owned calls without changing any previous fixture's bytes.
 *
 * @param profile - Installed native profile.
 * @param extension - Language source suffix.
 */
export const specializedGenericRecordConsumer = async (profile, extension) => {
	const original = await readFile(`tests/fixtures/generic-record-consumers/${profile}.${extension}`, "utf8");
	const fragment = await readFile(`tests/fixtures/generic-record-specialization-consumers/${profile}.${extension}`, "utf8");
	const marker = markers[profile];
	assert.equal(original.split(marker).length, 2, `Exactly one insertion site for ${profile}`);
	return original.replace(marker, `${fragment}\n${marker}`);
};
