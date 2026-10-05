/**
 * Independent named WIT contracts for copied Lean variants.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cVariantReviewedIr, cVariantSignatures } from "./c-variant-fixture.mjs";
import { witListConsumer } from "./wit-list-fixture.mjs";

const named = name => ({ kind: "named", id: `lean:Variants.${name}` });
const extra = [["echo_alias", "SignalView"], ["echo_alias_batch", "SignalBatch"], ["echo_aliased", "Aliased"], ["echo_wide", "Wide"], ["echo_joined", "Joined"]];
export const witVariantSignatures = [...cVariantSignatures(), ...extra.map(([name, type]) => ({ name: `Variants.${name}`, parameters: [named(type)], result: named(type) }))];
/** Add independently specified aliases and both sides of the tag-width boundary. */
export const witVariantReviewedIr = () => {
	const ir = cVariantReviewedIr(), source = ir.types.find(type => type.name === "Signal");
	const make = (name, kind, options) => ({ ...structuredClone(source)
		, id: `lean:Variants.${name}`, name, kind, cases: []
		, source: { ...source.source, declaration: `Variants.${name}` }, ...options });
	const field = (name, type) => ({ name, type, mutability: "immutable", documentation: source.documentation });
	const branch = (name, fields) => ({ name, fields, documentation: source.documentation });
	ir.types.push(make("SignalView", "alias", { target: named("Signal") })
		, make("SignalBatch", "alias", { target: { kind: "apply", constructor: "array", arguments: [{ kind: "apply", constructor: "list", arguments: [named("SignalView")] }] } })
		, make("Aliased", "variant", { cases: [branch("empty", []), branch("values", [field("label", { kind: "primitive", name: "string" }), field("current", named("SignalView")), field("batch", named("SignalBatch"))])] })
		, make("Wide", "variant", { cases: Array.from({ length: 257 }, (_, index) => branch(`c${index}`, index <= 243 ? [field("value", { kind: "primitive", name: "uint8" })] : [])) })
		, make("Joined", "variant", { cases: [["small", "uint32"], ["large", "uint64"], ["single", "float32"], ["double", "float64"]].map(([name, type]) => branch(name, [field("value", { kind: "primitive", name: type })])) }));
	for(const [name, type] of extra)
	{
		const fn = structuredClone(ir.declarations.find(fn => fn.name === "echo"));
		Object.assign(fn, { id: `lean:Variants.${name}`, name, overloadKey: `Variants.${name}` });
		fn.source.declaration = `Variants.${name}`; fn.parameters[0].type = named(type); fn.result.type = named(type); ir.declarations.push(fn);
	}
	ir.types.sort((a, b) => a.id.localeCompare(b.id)); return ir;
};
export const witVariantNames = { Signal: "signal", Mode: "mode", Packet: "packet", Nested: "nested", Scalars: "scalars", Anonymous: "anonymous", One: "one", Buffers: "buffers", SignalView: "signal-view", SignalBatch: "signal-batch", Aliased: "aliased", Wide: "wide", Joined: "joined" };
const originalNames = Object.fromEntries(Object.entries(witVariantNames).map(([lean, wit]) => [wit, lean]));
const member = name => ({ signedWord: "signed-word", arg1_: "lean-field-x00006100007200006700003100005f" })[name] ?? name;
const primitives = { unit: { enum: ["unit"] }, bool: "bool"
	, uint8: "u8", uint16: "u16", uint32: "u32", uint64: "u64"
	, int8: "s8", int16: "s16", int32: "s32", int64: "s64"
	, usize: "u64", isize: "s64", char: "char"
	, float32: "f32", float64: "f64", string: "string"
	, bytes: { list: "u8" }, nat: { list: "u32" }
	, int: { record: [{ name: "negative", type: "bool" }, { name: "limbs", type: { list: "u32" } }] } };
const expected = ref => ref.kind === "primitive" ? primitives[ref.name]
	: ref.kind === "named" ? { named: ref.id.split(".").at(-1) }
		: ["list", "array"].includes(ref.constructor) ? { list: expected(ref.arguments[0]) }
			: ref.constructor === "option" ? { option: expected(ref.arguments[0]) } : { [ref.constructor]: ref.arguments.map(expected) };

/**
 * Inspect parsed text and binary types, independently of production converters.
 *
 * @param document - Parsed wasm-tools component wit JSON.
 * @param ir - Independently reviewed source contracts.
 */
export const validateWitVariantSignatures = (document, ir = witVariantReviewedIr()) => {
	const reference = ref => {
		if(typeof ref === "string") return ref;
		const type = document.types[ref]; assert.ok(type, `Missing WIT type ${ref}`);
		return originalNames[type.name] ? { named: originalNames[type.name] } : shape(type.kind);
	};
	const shape = kind => {
		if(kind.type !== undefined) return reference(kind.type);
		if(kind.list !== undefined) return { list: reference(kind.list) };
		if(kind.option !== undefined) return { option: reference(kind.option) };
		if(kind.result) return { result: [reference(kind.result.ok), reference(kind.result.err)] };
		if(kind.tuple) return { tuple: kind.tuple.types.map(reference) };
		if(kind.record) return { record: kind.record.fields.map(field => ({ name: field.name, type: reference(field.type) })) };
		if(kind.enum) return { enum: kind.enum.cases.map(branch => branch.name) };
		if(kind.variant) return { variant: kind.variant.cases.map(branch => ({ name: branch.name, payload: branch.type === null ? null : reference(branch.type) })) };
		throw new Error(`Unexpected WIT variant shape: ${JSON.stringify(kind)}`);
	};
	const record = fields => ({ record: fields.map(field => ({ name: member(field.name), type: expected(field.type) })) });
	const signatures = ir.declarations.map(fn => ({ name: fn.name.replaceAll("_", "-")
		, parameters: fn.parameters.map(site => expected(site.type))
		, result: expected(fn.result.type) })).sort((a, b) => a.name.localeCompare(b.name));
	for(const name of ["native", "api"])
	{
		const iface = document.interfaces.find(item => item.name === name); assert.ok(iface);
		assert.deepEqual(Object.entries(iface.functions).map(([name, fn]) => ({ name, parameters: fn.params.map(site => reference(site.type)), result: reference(fn.result) }))
			.sort((a, b) => a.name.localeCompare(b.name)), signatures, name + " signatures");
		for(const type of ir.types)
		{
			const index = iface.types[witVariantNames[type.name]]; assert.ok(Number.isInteger(index), type.name);
			assert.deepEqual(reference(index), { named: type.name });
			if(name !== "native") continue;
			assert.deepEqual(shape(document.types[index].kind), type.kind === "alias" ? expected(type.target) : type.kind === "variant"
				? { variant: type.cases.map(branch => ({ name: branch.name, payload: branch.fields.length ? record(branch.fields) : null })) }
				: record(type.fields), type.name);
			if(type.kind === "variant") for(const [position, branch] of type.cases.entries()) if(branch.fields.length)
			{
				const payload = document.types[document.types[index].kind.variant.cases[position].type];
				assert.equal(payload.name, `${witVariantNames[type.name]}-${branch.name}-fields`);
			}
		}
	}
	return signatures;
};

/**
 * Retain original names and field types in the prepared archive's manifest.
 *
 * @param manifest - Generated WIT binding manifest.
 * @param ir - Original source contract.
 */
export const checkWitVariantManifest = (manifest, ir = witVariantReviewedIr()) => {
	for(const type of ir.types.filter(type => type.kind === "variant"))
	{
		const item = manifest.contracts.variants.find(item => item.id === type.id); assert.ok(item);
		assert.equal(item.name, type.name);
		assert.equal(item.witName, witVariantNames[type.name]);
		assert.deepEqual(item.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(({ name, type }) => ({ name, type })) }))
			, type.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(({ name, type }) => ({ name, type })) })));
		for(const branch of item.cases) for(const field of branch.fields) assert.equal(field.witName, member(field.name));
	}
};

/** Assemble independent public-value builders and deep variant comparisons. */
export const witVariantConsumer = async () => {
	const lists = await witListConsumer(), start = lists.indexOf("static void ok("), end = lists.indexOf("static value run(");
	assert.ok(start > 0 && end > start);
	const branch = `  case WASMTIME_COMPONENT_VARIANT:
    CHECK(a->of.variant.discriminant.size == b->of.variant.discriminant.size);
    CHECK(memcmp(a->of.variant.discriminant.data, b->of.variant.discriminant.data, a->of.variant.discriminant.size) == 0);
    CHECK((a->of.variant.val == NULL) == (b->of.variant.val == NULL));
    if (a->of.variant.val) { CHECK(a->of.variant.val != b->of.variant.val); equal(a->of.variant.val, b->of.variant.val); }
    break;
  default: abort();
  }
}
`;
	const builders = lists.slice(start, end).replace("  default: abort();\n  }\n}\n", branch);
	assert.ok(builders.includes("case WASMTIME_COMPONENT_VARIANT:"));
	return (await readFile("tests/fixtures/variant-consumers/wit-wasi.c", "utf8")).replace("/* COPIED_BUILDERS */", builders);
};
