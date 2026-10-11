/**
 * Hand-built, unadmitted generator models. These are not compiler or installed-package evidence.
 * The matching Lean module lets source checks expose incorrect constructor selection.
 *
 * @file
 */
const nat = { kind: "primitive", name: "nat", lean: "Nat" };
const sourceName = name => `NominalConversion.${name}`;
const field = (owner, name, type) => ({ name, type, projection: `${sourceName(owner)}.${name}` });
const envelope = {
	kind: "record", lean: sourceName("Envelope")
	, constructor: sourceName("Envelope.mk"), key: "envelope"
	, fields: [field("Envelope", "payload", nat), field("Envelope", "digit", nat)] };
const pair = {
	kind: "record", lean: sourceName("Pair")
	, constructor: sourceName("Pair.mk"), key: "pair"
	, fields: [field("Pair", "left", envelope), field("Pair", "right", envelope)] };
const branch = { kind: "result", arguments: [nat, nat], key: "branch" };
const optional = { kind: "option", element: branch, key: "optional" };
const choices = { kind: "array", element: optional, key: "choices" };
const event = {
	kind: "variant", lean: sourceName("Event"), key: "event"
	, cases: [
		{ name: "empty", constructor: sourceName("Event.empty"), fields: [] }
		, { name: "box", constructor: sourceName("Event.box"), fields: [{ name: "value", type: envelope }] }
		, { name: "choices", constructor: sourceName("Event.choices"), fields: [{ name: "values", type: choices }] }
	]
};
const sub = constructor => ({ kind: "subtype", constructor: constructor === null ? null : sourceName(constructor) });
const tree = (kind, ...arguments_) => ({ kind, arguments: arguments_ });
const record = (type, ...arguments_) => ({ kind: "record", definition: type.lean, fields: type.fields.map(field => field.name), arguments: arguments_ });
const envelopeTree = constructor => record(envelope, sub(constructor), { kind: "fin", bound: "3" });
const eventTree = (first, second) => ({
	kind: "variant", definition: event.lean
	, cases: [
		{ name: "empty", fields: [], arguments: [] }
		, { name: "box", fields: ["value"], arguments: [envelopeTree(first)] }
		, { name: "choices", fields: ["values"], arguments: [tree("array", tree("option", tree("result", sub(first), sub(second))))] }
	]
});
const item = (name, parameters, refinements, result = nat, resultTree = null) => ({
	module: "NominalConversion", name: sourceName(name), symbol: `nominal_${name}`
	, parameters: parameters.map((type, index) => ({ name: `arg${index}`, type }))
	, result
	, refinements: { parameters: refinements, result: resultTree }
});

/** Build fresh trees so mutation tests cannot contaminate another case. */
export const nominalSubtypeConversionFixture = () => ({
	component: { id: "nominal-subtype-conversion-probe" }, pointerBits: 64
	, types: [envelope, pair, branch, optional, choices, event]
	, exports: [
		item("first", [envelope], [envelopeTree("plusOne")])
		, item("second", [envelope], [envelopeTree("plusTwo")])
		, item("combine", [envelope, envelope], [envelopeTree("plusOne"), envelopeTree("plusTwo")])
		, item("nested", [pair], [record(pair, envelopeTree("plusOne"), envelopeTree("plusTwo"))])
		, item("eventFirst", [event], [eventTree("plusOne", "plusTwo")])
		, item("eventSecond", [event], [eventTree("plusTwo", "plusOne")])
		, item("echo", [envelope], [envelopeTree("plusOne")], envelope, envelopeTree("plusTwo"))
		, item("produce", [nat], [null], envelope, envelopeTree(null))
		, item("produceEvent", [nat], [null], event, eventTree(null, null))
	]
});

/** A Fin-only control retains the historical, constructor-independent check names and bytes. */
export const nominalFinConversionFixture = () => {
	const model = nominalSubtypeConversionFixture();
	const eraseChoices = value => {
		if(value?.kind === "subtype") return { kind: "fin", bound: "5" };
		if(Array.isArray(value)) return value.map(eraseChoices);
		if(value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, eraseChoices(child)]));
		return value;
	};
	return eraseChoices(model);
};
