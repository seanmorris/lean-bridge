/**
 * Independently authored private component graphs and per-use choices, not compiler admission evidence.
 *
 * @file
 */
import { sha256 } from "../../src/capsule/node.mjs";

/** Build fresh closed graphs so malformed-choice checks cannot mutate another test. */
export const componentRefinementMirrorsFixture = () => {
	const nat = { kind: "primitive", name: "nat" };
	const named = name => ({ kind: "named", id: `lean:NominalConversion.${name}` });
	const apply = (constructor, ...arguments_) => ({ kind: "apply", constructor, arguments: arguments_ });
	const field = (name, type) => ({ name, type });
	const record = (name, ...fields) => ({ kind: "record", id: named(name).id, fields });
	const choice = (name, refinement) => ({ name, refinement });
	const sub = name => ({ kind: "subtype", constructor: name === null ? null : `NominalConversion.${name}` });
	const fin = { kind: "fin", bound: "3" };
	const envelope = constructor => ({ kind: "record"
		, name: "NominalConversion.Envelope"
		, fields: [choice("payload", sub(constructor)), choice("digit", null)] });
	const tree = (kind, ...arguments_) => ({ kind, arguments: arguments_ });
	const event = (first, second) => ({ kind: "variant"
		, name: "NominalConversion.Event"
		, cases: [
			{ name: "empty", fields: [] }
			, { name: "box", fields: [choice("value", envelope(first))] }
			, { name: "choices", fields: [choice("values", tree("array", tree("option", tree("result", sub(first), sub(second)))))] }
		]
	});
	const types = [record("Envelope", field("payload", nat), field("digit", nat))
		, record("Pair", field("left", named("Envelope")), field("right", named("Envelope")))
		, { kind: "variant", id: named("Event").id
			, cases: [
				{ name: "empty", fields: [] }
				, { name: "box", fields: [field("value", named("Envelope"))] }
				, { name: "choices", fields: [field("values", apply("array", apply("option", apply("result", nat, nat))))] }
			]
		}
		, { kind: "alias", id: named("EnvelopeAlias").id, target: named("Envelope") }
		, { kind: "alias", id: named("Envelopes").id, target: apply("array", named("EnvelopeAlias")) }
		, { kind: "alias", id: named("DigitAlias").id, target: nat }
		, record("Digit", field("value", named("DigitAlias")))
		, record("WithDigit", field("payload", nat), field("digit", named("Digit")))
	];
	const signatures = [], exports = [];
	const add = (name, parameters, refinements, result = nat, resultTree = null) => {
		const bindingId = `lean:NominalConversion.${name}`, symbol = `lean_bridge_${sha256(bindingId).slice(0, 24)}`;
		signatures.push({ bindingId, symbol, parameters, result, resultMode: "value" });
		exports.push({ bindingId, symbol
			, sourceDeclaration: `NominalConversion.${name}`
			, wrapper: `export_${name}`
			, parameters: parameters.map((_, index) => ({ name: `a${index}`, leanType: "unused before normalization" }))
			, leanResultType: "unused before normalization"
			, refinements: { parameters: refinements, result: resultTree } });
	};
	add("first", [named("Envelope")], [envelope("plusOne")]);
	add("second", [named("Envelope")], [envelope("plusTwo")]);
	add("combine", [named("Envelope"), named("Envelope")], [envelope("plusOne"), envelope("plusTwo")]);
	add("nested", [named("Pair")], [{ kind: "record"
		, name: "NominalConversion.Pair"
		, fields: [choice("left", envelope("plusOne")), choice("right", envelope("plusTwo"))] }]);
	add("eventFirst", [named("Event")], [event("plusOne", "plusTwo")]);
	add("eventSecond", [named("Event")], [event("plusTwo", "plusOne")]);
	add("echo", [named("Envelope")], [envelope("plusOne")], named("Envelope"), envelope("plusTwo"));
	add("produce", [nat], [null], named("Envelope"), envelope(null));
	add("produceEvent", [nat], [null], named("Event"), event(null, null));
	add("echoAliases", [named("Envelopes")], [tree("array", envelope("plusOne"))], named("Envelopes"), tree("array", envelope(null)));
	add("withDigit", [named("WithDigit")], [{ kind: "record"
		, name: "NominalConversion.WithDigit"
		, fields: [choice("payload", sub("plusOne")), choice("digit", null)] }]);
	add("echoDigit", [named("Digit")], [null], named("Digit"));
	return { abi: { version: 8, dispatch: "copied-graph-frame-v1", types, exports: signatures }
		, exports
		, nominalRefinements: [
			{ id: named("DigitAlias").id, refinement: { kind: "alias", target: fin } }
			, { id: named("Envelope").id, refinement: { kind: "record", fields: [null, fin] } }
		]
	};
};
