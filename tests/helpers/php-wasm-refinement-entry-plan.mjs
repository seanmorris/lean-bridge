/**
 * Independent compact call plans for nominal and recursive graph entry probes.
 * Compiler output supplies identities; these cases supply semantic order.
 *
 * @file
 */
import assert from "node:assert/strict";
import { nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";
import { validateSubtypeEntrySelection } from "./php-wasm-subtype-entry-c.mjs";

const kinds = ["validator", "constructor", "adapter", "source"];
const counts = entries => Object.fromEntries(kinds.map(kind => [
	kind, entries.filter(item => item.kind === kind).length
]));

/**
 * Build the exact expected marker sequence for each compact installed call.
 *
 * @param family - One explicit #1824 graph family.
 * @param selected - Compiler-derived plus authored marker identities.
 * @param generatedLeanSource - Exact generated adapter source compiled by the probe.
 */
export const phpWasmRefinementEntryPlan = (family, selected, generatedLeanSource) => {
	validateSubtypeEntrySelection(selected); assert.equal(typeof generatedLeanSource, "string");
	const namespace = family.startsWith("nominal-") ? "NominalPrimitiveSubtypes"
		: family === "recursive-subtype" ? "RecursiveSubtypes" : "RecursiveCheckedRecords";
	const find = (kind, label) => {
		const matches = selected.filter(item => item.kind === kind && item.label === label);
		assert.equal(matches.length, 1, `${kind}/${label}`);
		return { kind, label };
	};
	const optional = (kind, label) => selected.some(item => item.kind === kind && item.label === label)
		? [find(kind, label)] : [];
	const constructor = name => find("constructor", `${namespace}.${name}`);
	const source = name => find("source", `${namespace}.${name}`);
	const adapter = name => find("adapter", `${namespace}.${name}`);
	const fin = name => optional("validator", `${namespace}.${name}:fin_guard_0`);
	const refinement = name => optional("validator", `${namespace}.${name}:refinement_0`);
	const graph = (name, constructorName) => {
		const candidates = selected.filter(item => item.kind === "validator"
			&& item.label.startsWith(`${namespace}.${name}:graph_refinement_0_`));
		const indirectConstructor = block => {
			const references = [...block.matchAll(/\b(LbErased\.[A-Za-z0-9_.]+\.via_[a-f0-9]+)\b/gu)]
				.map(match => match[1]);
			return references.some(reference => {
				const start = generatedLeanSource.indexOf(`def ${reference} `);
				assert.ok(start >= 0, reference);
				const next = generatedLeanSource.indexOf("\ndef ", start + 4);
				const definition = generatedLeanSource.slice(start, next < 0 ? undefined : next);
				return definition.includes(`_root_.${namespace}.${constructorName}`);
			});
		};
		const blocks = candidates.map(item => {
			const annotation = `@[export ${item.symbol}]`, start = generatedLeanSource.indexOf(annotation);
			assert.ok(start >= 0, annotation);
			const next = generatedLeanSource.indexOf("\n@[export ", start + annotation.length);
			return { item, block: generatedLeanSource.slice(start, next < 0 ? undefined : next) };
		});
		const direct = blocks.filter(({ block }) => block.includes(`_root_.${namespace}.${constructorName}`));
		const matches = direct.length ? direct : blocks.filter(({ block }) => indirectConstructor(block));
		assert.equal(matches.length, 1, `${name} graph validator for ${constructorName}`);
		return { kind: "validator", label: matches[0].item.label };
	};
	const constructors = names => names.map(constructor);
	const call = (publicName, entries) => ({ publicName, entries, counts: counts(entries) });
	const accepted = (control, name, names = [], sourceNames = [name]) => {
		const values = constructors(names);
		const entries = [
			...fin(name), ...refinement(name), ...values
			, adapter(name), ...values, ...sourceNames.map(source)
		];
		return { control, outcome: "accepted", call: call(name, entries) };
	};
	const refused = (control, name, names, diagnosis = []) => {
		const entries = [
			...fin(name), ...refinement(name), ...constructors(names)
			, ...diagnosis.flatMap(constructorName => [graph(name, constructorName), constructor(constructorName)])
		];
		return { control, outcome: "refused", call: call(name, entries) };
	};
	let cases;
	if(family === "nominal-full")
	{
		const a = nominalPrimitiveSubtypeFields.map(item => item.constructor + "A");
		const b = nominalPrimitiveSubtypeFields.map(item => item.constructor + "B");
		cases = [
			accepted("direct", "echoA", a)
			, refused("first-refusal", "echoA", a)
			, accepted("recovery", "echoA", a)
			, accepted("repeated-fields", "combine", [...a, ...b])
			, accepted("inactive-branch", "echoEventA")
			, accepted("active-branch", "echoEventA", a)
			, accepted("constructor-free", "produce")
		];
	}
	else if(family === "nominal-result-only") cases = [
		accepted("present-result", "produce")
		, accepted("absent-result", "produce")
		, accepted("repeated-result", "producePair", [], [
			"producePair", "produceGroup", "produce", "produceGroup", "produce"
		])
		, accepted("constructor-free", "wordBits")
	];
	else if(family === "recursive-subtype") cases = [
		accepted("direct", "first", ["plusOne", "plusOne"])
		, refused("first-refusal", "first", ["plusOne", "plusOne"])
		, accepted("recovery", "first", ["plusOne"])
		, accepted("repeated-fields", "groups", ["plusOne", "plusOne"])
		, accepted("inactive-branch", "echo")
		, accepted("active-branch", "echo", ["plusOne"])
		, accepted("constructor-free", "produce")
	];
	else
	{
		assert.equal(family, "recursive-checked-record");
		cases = [
			accepted("direct", "first", ["plusOne", "mkPacket"])
			, refused("first-refusal", "first", ["plusOne", "plusOne"], ["plusOne", "plusOne"])
			, refused("record-refusal", "first", ["plusOne", "mkPacket"], ["plusOne", "mkPacket"])
			, accepted("recovery", "first", ["plusOne", "mkPacket"])
			, accepted("repeated-fields", "groups", ["plusOne", "mkPacket", "plusOne", "mkPacket"])
			, accepted("inactive-branch", "groups")
			, accepted("constructor-free", "produce")
		];
	}
	assert.ok(cases.some(item => item.call.counts.adapter > 0));
	assert.ok(cases.some(item => item.call.counts.source > 0));
	assert.equal(new Set(cases.map(item => item.control)).size, cases.length);
	return { scope: "separate-instrumented-probe", family
		, selected: structuredClone(selected), cases };
};
