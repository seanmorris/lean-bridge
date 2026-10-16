/**
 * Exercise rich checked-record normalization without importing the historical promotion matrix.
 * Compiler admission and installed consumers remain separate acceptance gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { assertRefinement } from "../src/abi/refinements.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { componentRefinementMirrors } from "../src/build/component-refinement-mirrors.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { nativeFinRefinements, nativeFinSummary, nativeRefinementReadme } from "../src/backends/native/fin-refinements.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { checkedRefinementSelection, projectionCheckedSelection, validateCheckedRefinementSelection } from "../src/analyze/checked-refinement-selection.mjs";
import { checkNestedCheckedRecords } from "./fixtures/nested-checked-record-consumers/javascript.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { nestedCheckedRecordReview } from "./helpers/nested-checked-record-fixture.mjs";

const fixture = () => {
	const nat = { kind: "primitive", name: "nat" };
	const named = name => ({ kind: "named", id: `lean:NestedChecked.${name}` });
	const apply = (constructor, ...arguments_) => ({ kind: "apply", constructor, arguments: arguments_ });
	const field = (name, type) => ({ name, type });
	const choice = (name, refinement) => ({ name, refinement });
	const fin = { kind: "fin", bound: "10" };
	const subtype = constructor => ({ kind: "subtype"
		, constructor: constructor === null ? null : `NestedChecked.${constructor}` });
	const checked = (constructor, word) => ({
		kind: "checked-record"
		, name: "NestedChecked.Packet"
		, constructor: constructor === null ? null : `NestedChecked.${constructor}`
		, fields: [choice("digit", fin), choice("word", subtype(word))]
	});
	const packet = named("Packet"), holder = named("Holder"), choiceType = named("Choice");
	const types = [
		{ kind: "record", id: packet.id, erased: ["valid"], fields: [field("digit", nat), field("word", nat)] }
		, { kind: "record", id: holder.id, fields: [field("packet", packet), field("tag", nat)] }
		, {
			kind: "variant"
			, id: choiceType.id
			, cases: [
				{ name: "empty", fields: [] }
				, { name: "packet", fields: [field("value", packet)] }
			]
		}
	];
	const signatures = [], exports = [];
	const add = (name, parameter, selection, result = nat, resultSelection = null) => {
		const bindingId = `lean:NestedChecked.${name}`, symbol = `lean_bridge_${sha256(bindingId).slice(0, 24)}`;
		signatures.push({ bindingId, symbol, parameters: [parameter], result, resultMode: "value" });
		exports.push({
			bindingId, symbol
			, sourceDeclaration: `NestedChecked.${name}`
			, wrapper: `export_${name}`
			, parameters: [{ name: "value", leanType: "not normalized" }]
			, leanResultType: "not normalized"
			, refinements: { parameters: [selection], result: resultSelection }
		});
	};
	add("first", packet, checked("mkPacket", "mkWord"));
	add("second", packet, checked("normalizePacket", "normalizeWord"));
	add("array", apply("array", packet), { kind: "array", arguments: [checked("mkPacket", "mkWord")] });
	add("holder", holder, {
		kind: "record", name: "NestedChecked.Holder"
		, fields: [
			choice("packet", checked("normalizePacket", "mkWord"))
			, choice("tag", null)
		]
	});
	add("choice", choiceType, {
		kind: "variant", name: "NestedChecked.Choice"
		, cases: [
			{ name: "empty", fields: [] }
			, {
				name: "packet"
				, fields: [choice("value", checked("mkPacket", "normalizeWord"))]
			}
		]
	});
	add("produce", nat, null, apply("option", packet), { kind: "option", arguments: [checked(null, null)] });
	return {
		abi: { version: 8, dispatch: "copied-graph-frame-v1", types, exports: signatures }
		, exports
		, nominalRefinements: [{ id: packet.id, refinement: { kind: "record", fields: [fin, null] } }]
	};
};

const render = type => {
	assert.deepEqual(type, { kind: "primitive", name: "nat" });
	return "_root_.Nat";
};
const normalize = value => componentRefinementMirrors(value.abi, value.exports, render, value.nominalRefinements);
const site = (model, name) => model.sites.find(item => item.sourceDeclaration === `NestedChecked.${name}`);

test("the installed caller oracle fixes full and result-only behavior and counts", () => {
	const failed = () => { throw new Error("failed (5)"); };
	const shape = () => { throw new TypeError("value does not match the declared copied fields"); };
	const exact = (value, fields) => {
		if(value === null || typeof value !== "object" || Array.isArray(value)
			|| JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...fields].sort())) shape();
		return value;
	};
	const packet = (value, path, outer, inner) => {
		const source = exact(value, ["digit", "word"]);
		if(typeof source.digit !== "bigint" || typeof source.word !== "bigint") shape();
		if(source.digit < 0n || source.digit >= 10n) throw new TypeError(`${path}.digit must be bigint below 10`);
		const word = inner === "normalize" ? source.word + 1n : source.word > 0n ? source.word : failed();
		if(outer === "normalize") return { digit: source.digit, word: source.digit + 1n };
		if(source.digit > word) failed();
		return { digit: source.digit, word };
	};
	const sum = values => values.reduce((total, value) => total + value.word, 0n);
	const produced = value => ({ digit: 0n, word: value + 1n });
	const output = {
		produceOption: value => ({ tag: "some", value: produced(value) })
		, produceArray: value => [produced(value), produced(value + 1n)]
	};
	const full = { ...output
		, first: value => packet(value, "first.arg0", "keep", "keep").word
		, second: value => packet(value, "second.arg0", "normalize", "normalize").word
		, pair: (left, right) => packet(left, "pair.arg0", "keep", "keep").word
			+ packet(right, "pair.arg1", "normalize", "normalize").word
		, inArray: values => sum(values.map((value, index) => packet(value, `inArray.arg0.${index}`, "keep", "keep")))
		, inList: values => sum(values.map((value, index) => packet(value, `inList.arg0.${index}`, "normalize", "normalize")))
		, inOption: value => {
			const selected = exact(value, value?.tag === "none" ? ["tag"] : ["tag", "value"]);
			return selected.tag === "none" ? 0n : packet(selected.value, "inOption.arg0.value", "keep", "normalize").word;
		}
		, inProduct: value => {
			if(!Array.isArray(value) || value.length !== 2) shape();
			return packet(value[0], "inProduct.arg0.0", "keep", "keep").word
				+ packet(value[1], "inProduct.arg0.1", "normalize", "normalize").word;
		}
		, inExcept: value => {
			const selected = exact(value, Object.hasOwn(value ?? {}, "ok") ? ["ok"] : ["error"]);
			return Object.hasOwn(selected, "ok")
				? packet(selected.ok, "inExcept.arg0.ok", "normalize", "keep").word
				: packet(selected.error, "inExcept.arg0.error", "keep", "normalize").word;
		}
		, inHolder: value => {
			const selected = exact(value, ["packet", "tag"]);
			return packet(selected.packet, "inHolder.arg0.packet", "normalize", "keep").word + selected.tag;
		}
		, inChoice: value => {
			const selected = exact(value, value?.kind === "empty" ? ["kind"] : ["kind", "value"]);
			return selected.kind === "empty" ? 0n : packet(selected.value, "inChoice.arg0.value", "keep", "normalize").word;
		}
		, echoArray: values => values.map((value, index) => packet(
			value, `echoArray.arg0.${index}`, "keep", "keep"
		))
	};
	assert.deepEqual(checkNestedCheckedRecords(output, { resultOnly: true })
		, { checks: 4023, rejections: 0, calls: 2006, snapshots: 2006, recoveries: 0 });
	assert.deepEqual(checkNestedCheckedRecords(full)
		, { checks: 10077, rejections: 2017, calls: 5037, snapshots: 5037, recoveries: 1000 });
});

test("JavaScript nested validators traverse checked-record result fields", async () => {
	const review = nestedCheckedRecordReview("result-only");
	const files = generateJavaScriptPackage(review);
	const validators = await import(`data:text/javascript,${encodeURIComponent(files["internal/validators.mjs"])}`);
	const produceOption = review.declarations.find(item => item.name === "produceOption");
	const refinement = produceOption.source.extensions["lean-lang.org/refinements"].result;
	assert.doesNotThrow(() => validators.assertNestedFin({
		tag: "some", value: { digit: 9n, word: 1n }
	}, refinement, "produceOption.result"));
	assert.throws(() => validators.assertNestedFin({
		tag: "some", value: { digit: 10n, word: 1n }
	}, refinement, "produceOption.result"), /produceOption\.result\.value\.digit must be bigint below 10/u);
});

test("rich checked records retain outer and field constructors through nested copied carriers", () => {
	const value = fixture(), before = canonicalJson(value), model = normalize(value), source = model.lines.join("\n");
	assert.equal(canonicalJson(value), before);
	const first = site(model, "first").refinements.parameters[0];
	assert.deepEqual(first, {
		kind: "checked-record", definition: "NestedChecked.Packet"
		, constructor: "NestedChecked.mkPacket", fields: ["digit", "word"]
		, arguments: [
			{ kind: "fin", bound: "10" }
			, { kind: "subtype", constructor: "NestedChecked.mkWord" }
		]
	});
	assert.equal(site(model, "array").refinements.parameters[0].arguments[0].definition, "NestedChecked.Packet");
	assert.equal(site(model, "holder").refinements.parameters[0].arguments[0].constructor, "NestedChecked.normalizePacket");
	assert.equal(site(model, "choice").refinements.parameters[0].cases[1].arguments[0].arguments[1].constructor
		, "NestedChecked.normalizeWord");
	const produced = site(model, "produce").refinements.result.arguments[0];
	assert.equal(produced.constructor, null);
	assert.equal(produced.arguments[1].constructor, null);
	assert.match(source, /def LbErased\.NestedChecked\.Packet\.via_[a-f0-9]+ \(value/u);
	assert.match(source, /let a0 ← \(if proof : \(value\.«digit»\) < 10/u);
	assert.match(source, /let a1 ← _root_\.NestedChecked\.(?:mkWord|normalizeWord) value\.«word»/u);
	assert.match(source, /_root_\.NestedChecked\.(?:mkPacket|normalizePacket) a0 a1/u);
	assert.match(source, /Packet\.mk \(value\.«digit»\)\.val \(value\.«word»\)\.val/u);
	assert.match(source, /def LbErased\.NestedChecked\.Packet\.validFin[\s\S]*value\.«digit»/u);
	assert.match(source, /def LbErased\.NestedChecked\.Holder\.validFin[\s\S]*Packet\.validFin \(value\.«packet»\)/u);
	assert.match(source, /def LbErased\.NestedChecked\.Choice\.validFin[\s\S]*Packet\.validFin \(_bridgeFinField0\)/u);
	assert.doesNotMatch(source, /_root_\.Except\.(?:ok|error) _bridgeFinValue0 => \(decide \(\(_bridgeFinValue0\) < 10\)\)/u);
	assert.equal((source.match(/def LbErased\.NestedChecked\.Packet\.erase/gu) ?? []).length, 1);
	assert.equal((source.match(/def LbErased\.NestedChecked\.Packet\.via_/gu) ?? []).length, 4);
});

test("rich checked records refuse incomplete fields, input projection and legacy nesting", () => {
	const incomplete = fixture();
	incomplete.exports[0].refinements.parameters[0].fields.pop();
	assert.throws(() => normalize(incomplete), /Refinement does not match its transport type/u);
	const projectedInput = fixture();
	projectedInput.exports[0].refinements.parameters[0].constructor = null;
	assert.throws(() => normalize(projectedInput), /Refinement does not match its transport type/u);
	const legacyNested = fixture();
	legacyNested.exports[2].refinements.parameters[0].arguments[0] = {
		kind: "checked-record", constructor: "NestedChecked.mkPacket"
	};
	assert.throws(() => normalize(legacyNested), /Refinement does not match its transport type/u);
	const inputResultConstructor = fixture();
	inputResultConstructor.exports.at(-1).refinements.result.arguments[0].constructor = "NestedChecked.mkPacket";
	assert.throws(() => normalize(inputResultConstructor), /Refinement does not match its transport type/u);
});

test("recursive checked records remain reserved for their separate representation", () => {
	const nat = { kind: "primitive", name: "nat" };
	const packet = { kind: "named", id: "lean:NestedChecked.Packet" };
	const bindingId = "lean:NestedChecked.recursive";
	const symbol = `lean_bridge_${sha256(bindingId).slice(0, 24)}`;
	const abi = {
		version: 8, dispatch: "copied-graph-frame-v1"
		, types: [{
			kind: "record", id: packet.id, erased: ["valid"]
			, fields: [
				{
					name: "next"
					, type: { kind: "apply", constructor: "option", arguments: [packet] }
				}
				, { name: "value", type: nat }
			]
		}]
		, exports: [{
			bindingId, symbol
			, parameters: [packet], result: nat, resultMode: "value"
		}]
	};
	const selected = { kind: "checked-record", name: "NestedChecked.Packet"
		, constructor: "NestedChecked.mkPacket"
		, fields: [
			{ name: "next", refinement: null }, { name: "value", refinement: null }
		]
	};
	const exports = [{ bindingId, symbol
		, sourceDeclaration: "NestedChecked.recursive", wrapper: "export_recursive"
		, parameters: [{ name: "value", leanType: "not normalized" }]
		, leanResultType: "not normalized"
		, refinements: { parameters: [selected], result: null }
	}];
	assert.throws(() => componentRefinementMirrors(abi, exports, render)
		, /recursive checked records require another representation/u);
});

test("legacy generic checked records stay top-level while rich and nested generic forms remain separate work", () => {
	const nat = { kind: "primitive", name: "nat" };
	const packet = { kind: "named", id: "lean:NestedChecked.Packet" };
	const definition = {
		id: packet.id, kind: "record", representation: "copied"
		, fields: [{ name: "digit", type: nat }, { name: "word", type: nat }]
		, source: {
			declaration: "NestedChecked.Packet"
			, extensions: {
				"lean-lang.org/erased-proofs": ["valid"]
				, "lean-lang.org/instantiation": {
					structure: "NestedChecked.GenericPacket"
					, arguments: [{ kind: "type", type: nat }]
				}
			}
		}
	};
	const legacy = { kind: "checked-record", constructor: "NestedChecked.mkPacket" };
	assert.doesNotThrow(() => assertRefinement(legacy, packet, 0, true, [definition]));
	const rich = { kind: "checked-record", name: "NestedChecked.Packet"
		, constructor: "NestedChecked.mkPacket"
		, fields: [
			{ name: "digit", refinement: null }, { name: "word", refinement: null }
		]
	};
	assert.throws(() => assertRefinement(rich, packet, 0, true, [definition]), /Refinement does not match its transport type/u);
	assert.throws(() => assertRefinement(legacy, packet, 1, true, [definition]), /Refinement does not match its transport type/u);
});

test("native models retain rich checked-record checks and projections at nested sites", () => {
	const input = nativeMetadataFixture();
	const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const nat = { kind: "primitive", name: "nat", lean: "Nat"
		, abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false } };
	const fin = { kind: "refinement", base: nat, predicate: { kind: "fin", bound: "10" }, abi: nat.abi };
	const word = constructor => ({ kind: "refinement", base: nat
		, predicate: { kind: "subtype", constructor }, abi: nat.abi });
	const packet = constructor => ({
		kind: "record", name: "NestedChecked.Packet", lean: "NestedChecked.Packet"
		, constructor: "NestedChecked.Packet.mk", erased: ["valid"], abi
		, fields: [
			{ name: "digit", projection: "NestedChecked.Packet.digit", type: fin }
			, { name: "word", projection: "NestedChecked.Packet.word", type: word(constructor) }
		]
	});
	const checked = { kind: "refinement", base: packet("NestedChecked.mkWord")
		, predicate: { kind: "checked-record", constructor: "NestedChecked.mkPacket" }
		, abi };
	const projection = input.metadata.modules[0].declarations[0].projection;
	projection.parameters[0].type = { kind: "array", element: checked, abi };
	projection.result = { kind: "option", element: packet(null), abi };
	const model = createNativeModel({ ...input, component: {
		id: "nestedchecked@1.0.0", name: "nestedchecked", version: "1.0.0"
	} }, { refinements: true });
	const trees = model.exports[0].refinements;
	assert.equal(trees.parameters[0].arguments[0].constructor, "NestedChecked.mkPacket");
	assert.deepEqual(trees.parameters[0].arguments[0].arguments, [
		{ kind: "fin", bound: "10" }
		, { kind: "subtype", constructor: "NestedChecked.mkWord" }
	]);
	assert.equal(trees.result.arguments[0].constructor, null);
	assert.equal(trees.result.arguments[0].arguments[1].constructor, null);
	const source = generateNativeLeanAdapters(model).leanSource;
	assert.match(source, /NestedChecked\.mkPacket a0 a1/u);
	assert.match(source, /NestedChecked\.mkWord value\.«word»/u);
	assert.match(source, /Packet\.mk \(value\.«digit»\)\.val \(value\.«word»\)\.val/u);
});

test("native package summaries name outer and field checks at exact nested paths", () => {
	const nat = { kind: "primitive", name: "nat" }, packet = { kind: "named", id: "lean:NestedChecked.Packet" };
	const types = [{
		id: packet.id, kind: "record", representation: "copied"
		, name: "NestedChecked.Packet"
		, fields: [{ name: "digit", type: nat }, { name: "word", type: nat }]
		, source: {
			declaration: "NestedChecked.Packet", module: "NestedChecked"
			, extensions: {
				"lean-lang.org/erased-proofs": { fields: ["valid"] }
				, "lean-lang.org/nominal-refinements": {
					kind: "record"
					, fields: [{ kind: "fin", bound: "10" }, null]
				}
			}
		}
	}];
	const rich = {
		kind: "checked-record", name: "NestedChecked.Packet"
		, constructor: "NestedChecked.mkPacket"
		, fields: [{ name: "digit", refinement: { kind: "fin", bound: "10" } }
			, { name: "word", refinement: { kind: "subtype", constructor: "NestedChecked.mkWord" } }]
	};
	const declaration = { id: "lean:NestedChecked.consume", name: "consume"
		, parameters: [{ name: "packets", type: { kind: "apply", constructor: "array", arguments: [packet] } }]
		, result: { type: { kind: "apply", constructor: "option", arguments: [packet] } }
		, source: { extensions: { "lean-lang.org/refinements": {
			parameters: [{ kind: "array", arguments: [rich] }]
			, result: { kind: "option"
			, arguments: [{
				...rich, constructor: null
				, fields: rich.fields.map(field => ({
					...field
					, refinement: field.refinement.kind === "subtype"
						? { ...field.refinement, constructor: null } : field.refinement
				}))
			}] }
		} } }
	};
	const trees = nativeFinRefinements(declaration, types);
	assert.equal(trees.parameters[0].arguments[0].definition, "NestedChecked.Packet");
	assert.equal(trees.result.arguments[0].constructor, null);
	assert.equal(nativeFinSummary(declaration, ["packets"], types), [
		"packets[*] checked by NestedChecked.mkPacket"
		, "packets[*].digit < 10"
		, "packets[*].word checked by NestedChecked.mkWord"
		, "result? projects proof-backed record payload fields"
		, "result?.digit < 10"
		, "result?.word projects the Subtype base value"
	].join("; "));
	const readme = nativeRefinementReadme([declaration], "EXACT FIN PARAGRAPH", "native packages", types);
	assert.match(readme, /^EXACT FIN PARAGRAPH/mu);
	assert.match(readme, /^Lean Subtype parameters cross as their base value\./mu);
	assert.match(readme, /Nested arrays, Lists, options, products, Except values, plain records and active variant cases/u);
	assert.doesNotMatch(readme, /Nested checked records.*unsupported/u);
});

test("author selections preserve rich checked-record identity while dropping compiler-owned bounds", () => {
	const publicTree = {
		kind: "checked-record", name: "NestedChecked.Packet"
		, constructor: "NestedChecked.mkPacket"
		, fields: [
			{ name: "digit", refinement: { kind: "fin", bound: "10" } }
			, { name: "word", refinement: { kind: "subtype", constructor: "NestedChecked.mkWord" } }
		]
	};
	const expected = {
		kind: "checked-record", name: "NestedChecked.Packet"
		, constructor: "NestedChecked.mkPacket"
		, fields: [{ name: "digit", refinement: null }
			, { name: "word", refinement: { constructor: "NestedChecked.mkWord" } }]
	};
	assert.deepEqual(checkedRefinementSelection(publicTree), expected);
	assert.equal(validateCheckedRefinementSelection(expected), expected);
	assert.equal(checkedRefinementSelection({ ...publicTree, constructor: null }), null);
	const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const nat = { kind: "primitive", name: "nat", lean: "Nat", abi };
	const packet = {
		kind: "record", name: "NestedChecked.Packet", lean: "NestedChecked.Packet"
		, constructor: "NestedChecked.Packet.mk", erased: ["valid"], abi
		, fields: [{ name: "digit", projection: "NestedChecked.Packet.digit", type: nat }
			, { name: "word", projection: "NestedChecked.Packet.word", type: nat }]
	};
	const checked = { kind: "refinement", base: packet
		, predicate: { kind: "checked-record", constructor: "NestedChecked.mkPacket" }
		, abi };
	assert.deepEqual(projectionCheckedSelection(checked), { constructor: "NestedChecked.mkPacket" });
	assert.deepEqual(projectionCheckedSelection({ kind: "array", element: checked, abi }), {
		kind: "array"
		, arguments: [{
			kind: "checked-record", name: "NestedChecked.Packet"
			, constructor: "NestedChecked.mkPacket"
			, fields: [
				{ name: "digit", refinement: null }, { name: "word", refinement: null }
			]
		}]
	});
});
