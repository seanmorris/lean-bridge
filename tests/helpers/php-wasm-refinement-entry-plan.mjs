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
		: family === "recursive-subtype" ? "RecursiveSubtypes"
			: family === "recursive-checked-record" ? "RecursiveCheckedRecords"
				: family.startsWith("dependent-") ? "DependentRecords"
					: family.startsWith("value-index-") ? "CheckedRecordValueIndices"
						: family.startsWith("zero-payload-") ? "ZeroPayloadCheckedRecords"
							: null;
	assert.ok(namespace, `unknown entry family: ${family}`);
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
	const refinement = (name, constructorName = null) => {
		const candidates = selected.filter(item => item.kind === "validator"
			&& item.label.startsWith(`${namespace}.${name}:refinement_0`)
			&& !item.label.includes(":graph_refinement_"));
		if(constructorName === null) return candidates
			.filter(item => item.label === `${namespace}.${name}:refinement_0`)
			.map(item => ({ kind: item.kind, label: item.label }));
		if(candidates.length <= 1) return candidates.map(item => ({ kind: item.kind, label: item.label }));
		const matches = candidates.filter(item => {
			const start = generatedLeanSource.indexOf(`@[export ${item.symbol}]`);
			assert.ok(start >= 0, item.symbol);
			const next = generatedLeanSource.indexOf("\n@[export ", start + 9);
			return generatedLeanSource.slice(start, next < 0 ? undefined : next)
				.includes(`_root_.${namespace}.${constructorName}`);
		});
		assert.equal(matches.length, 1, `${name} refinement validator for ${constructorName}`);
		return [{ kind: "validator", label: matches[0].label }];
	};
	const graph = (name, constructorName) => {
		const candidates = selected.filter(item => item.kind === "validator"
			&& item.label.startsWith(`${namespace}.${name}:graph_refinement_0_`));
		if(candidates.length === 0) return [];
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
		return [{ kind: "validator", label: matches[0].item.label }, constructor(constructorName)];
	};
	const constructors = names => names.map(constructor);
	const call = (publicName, entries) => ({ publicName, entries, counts: counts(entries) });
	const accepted = (control, name, names = [], sourceNames = [name]) => {
		const values = constructors(names);
		const entries = [
			...fin(name), ...refinement(name, names[0] ?? null), ...values
			, adapter(name), ...values, ...sourceNames.map(source)
		];
		return { control, outcome: "accepted", call: call(name, entries) };
	};
	const refused = (control, name, names, diagnosis = []) => {
		const entries = [
			...fin(name), ...refinement(name, names[0] ?? null), ...constructors(names)
			, ...diagnosis.flatMap(constructorName => graph(name, constructorName))
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
	else if(family === "recursive-checked-record")
	{
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
	else if(family === "dependent-full") cases = [
		accepted("direct", "dependentTotal", ["mkDependent"])
		, refused("first-refusal", "dependentTotal", ["mkDependent"], ["mkDependent"])
		, accepted("recovery", "dependentTotal", ["mkDependent"])
		, accepted("roundtrip", "dependentRoundtrip", ["mkDependent"])
		, accepted("constructor-free", "dependentResult")
	];
	else if(family === "dependent-result-only") cases = [
		accepted("constructor-free", "dependentResult")
		, accepted("repeated-result", "dependentResult")
	];
	else if(family === "value-index-full") cases = [
		accepted("direct-bool", "trueBoolIndex", ["mkOn"])
		, accepted("direct-string", "abStringIndex", ["mkAb"])
		, accepted("direct-nat", "emptySizedIndex", ["mkEmptySized"])
		, refused("bool-refusal", "trueBoolIndex", ["mkOn"])
		, accepted("bool-recovery", "zeroNatIndex", ["mkZeroToken"])
		, refused("string-refusal", "abStringIndex", ["mkAb"])
		, accepted("string-recovery", "zeroNatIndex", ["mkZeroToken"])
		, refused("nat-refusal", "emptySizedIndex", ["mkEmptySized"])
		, accepted("nat-recovery", "zeroNatIndex", ["mkZeroToken"])
		, accepted("wide-index", "wideNatIndex", ["mkWideToken"])
		, accepted("constructor-free", "produceWideNat")
	];
	else if(family === "value-index-result-only") cases = [
		accepted("bool-true-result", "produceTrueBool")
		, accepted("bool-false-result", "produceFalseBool")
		, accepted("string-result", "produceAb")
		, accepted("empty-string-result", "produceEmptyString")
		, accepted("unicode-string-result", "produceUnicodeString")
		, accepted("empty-nat-result", "produceEmptySized")
		, accepted("zero-nat-result", "produceZeroNat")
		, accepted("constructor-free", "produceWideNat")
	];
	else if(family === "zero-payload-full") cases = [
		accepted("direct", "witnessCount", ["mkWitness"])
		, refused("first-refusal", "absentCount", ["mkAbsent"], ["mkAbsent"])
		, accepted("recovery", "witnessCount", ["mkWitness"])
		, accepted("unit-payload", "tokenTag", ["mkToken"])
		, accepted("inactive-branch", "markCount")
		, accepted("active-branch", "markCount", ["mkWitness"])
		, accepted("constructor-free", "produceWitness")
		, accepted("array-result", "witnesses")
		, accepted("absent-result", "maybeWitness")
		, accepted("variant-result", "produceMark")
	];
	else
	{
		assert.equal(family, "zero-payload-result-only");
		cases = [
			accepted("constructor-free", "produceWitness")
			, accepted("unit-result", "produceToken")
			, accepted("array-result", "witnesses")
			, accepted("present-result", "maybeWitness")
			, accepted("plain-empty-result", "produceMarker")
			, accepted("variant-result", "produceMark")
		];
	}
	assert.ok(cases.some(item => item.call.counts.adapter > 0));
	assert.ok(cases.some(item => item.call.counts.source > 0));
	assert.equal(new Set(cases.map(item => item.control)).size, cases.length);
	return { scope: "separate-instrumented-probe", family
		, selected: structuredClone(selected), cases };
};
