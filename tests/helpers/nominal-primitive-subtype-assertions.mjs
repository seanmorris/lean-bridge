/**
 * Independent executable Lean checks for generated nominal primitive adapters.
 * Host-width source evaluation is separate from installed native and wasm32 evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";

const standard = {
	unitValue: "()", boolValue: "true"
	, uint8Value: "42", uint16Value: "42", uint32Value: "42", uint64Value: "42"
	, int8Value: "-42", int16Value: "-42", int32Value: "-42", int64Value: "-42"
	, natValue: "42", intValue: "-42", float32Value: "1.5", float64Value: "1.5"
	, textValue: '"a"', bytesValue: "⟨#[0, 128, 255]⟩", charValue: "'a'"
	, usizeValue: "42", isizeValue: "-42", digit: "2"
};
const normalized = {
	...standard, boolValue: "true"
	, uint8Value: "44", uint16Value: "44", uint32Value: "44", uint64Value: "44"
	, int8Value: "-40", int16Value: "-40", int32Value: "-40", int64Value: "-40"
	, natValue: "44", intValue: "-40", float32Value: "-1.5", float64Value: "-1.5"
	, textValue: '"a!"', bytesValue: "⟨#[0, 128, 255, 255]⟩", charValue: "'b'"
	, usizeValue: "44", isizeValue: "-40"
};
const produced = {
	...standard
	, uint8Value: "200", uint16Value: "200", uint32Value: "200", uint64Value: "200"
	, int8Value: "120", int16Value: "120", int32Value: "120", int64Value: "120"
	, natValue: "1267650600228229401496703205376"
	, intValue: "-1267650600228229401496703205376"
	, float32Value: "12.5", float64Value: "12.5"
	, textValue: '"long λ text"'
	, bytesValue: "⟨#[0, 1, 2, 3, 4, 5, 128, 254, 255]⟩"
	, charValue: "'λ'"
	, usizeValue: "200", isizeValue: "200"
};
const record = (changes = {}) => `⟨${Object.values({ ...standard, ...changes }).map(value => `(${value})`).join(", ")}⟩`;
const primitive = name => nominalPrimitiveSubtypeFields.find(field => field.name === name)?.primitive ?? "nat";
const project = (name, value = "value") => `${value}.${name}${name.startsWith("float") ? ".toBits" : name === "bytesValue" ? ".toList" : ""}`;
const scalar = (name, value) => {
	if(name === "bytesValue") return value.replace("⟨#[", "[").replace("]⟩", "]");
	if(name.startsWith("float"))
		return `(${value} : ${name === "float32Value" ? "Float32" : "Float"}).toBits`;
	return value;
};

/**
 * Render assertions against actual generated wrappers without consulting output values.
 *
 * @param options - Public wrapper resolver, adapter profile and API selection.
 */
export const nominalPrimitiveSubtypeAssertions = options => {
	const { call, component, resultOnly } = options;
	assert.equal(typeof call, "function"); assert.equal(typeof component, "boolean"); assert.equal(typeof resultOnly, "boolean");
	const invoke = (name, ...args) => `${call(`NominalPrimitiveSubtypes.${name}`)} ${args.length ? args.map(arg => component ? `#[${arg}]` : `(${arg})`).join(" ") : "()"}`;
	const checked = value => component ? `#[${value}]` : `some (${value})`;
	const wrap = value => component ? `#[${value}]` : value;
	const cases = [];
	const add = (label, actual, expected) => cases.push({ label
		, source: `#eval show IO Unit from do\n  unless (${actual}) == (${expected}) do\n    throw (IO.userError ${JSON.stringify(label)})` });
	const map = (actual, expression) => `(${actual}).map (fun value => ${expression})`;
	const projectResult = (name, input, expression) => component
		? map(invoke(name, input), expression) : `(let value := (${invoke(name, input)}); ${expression})`;
	const packetA = record(), packetB = record({ boolValue: "false" }), output = record(produced);
	for(const field of [...nominalPrimitiveSubtypeFields, { name: "digit", primitive: "nat" }])
	{
		const name = field.name;
		if(!resultOnly)
		{
			add(`A-${name}`, map(invoke("echoA", packetA), project(name)), checked(scalar(name, standard[name])));
			add(`B-${name}`, map(invoke("echoB", packetB), project(name)), checked(scalar(name, normalized[name])));
		}
		const actual = component ? map(invoke("produce", output), `value.map (fun value => ${project(name)})`)
			: map(invoke("produce", output), project(name));
		add(`result-${name}`, actual, wrap(`some (${scalar(name, produced[name])})`));
	}
	const failures = {
		boolValue: "false"
		, uint8Value: "43", uint16Value: "43", uint32Value: "43", uint64Value: "43"
		, int8Value: "-43", int16Value: "-43", int32Value: "-43", int64Value: "-43"
		, natValue: "43", intValue: "-43"
		, float32Value: "Float32.ofBits 0x7f800000"
		, float64Value: "Float.ofBits 0x7ff0000000000000"
		, textValue: '""', bytesValue: "⟨#[]⟩", charValue: "Char.ofNat 0"
		, usizeValue: "43", isizeValue: "-43", digit: "3"
	};
	for(const [name, invalid] of Object.entries(failures))
	{
		const value = record({ [name]: invalid });
		if(!resultOnly)
			add(`reject-A-${primitive(name)}-${name}`, component ? `(${invoke("echoA", value)}).isEmpty` : `(${invoke("echoA", value)}).isNone`, "true");
		add(`absent-result-${primitive(name)}-${name}`, projectResult("produce", value, "value.isNone"), wrap("true"));
	}
	add("absent-group", projectResult("produceGroup", record({ natValue: "43" }), "value.map (fun item => item.isNone)"), wrap("#[true]"));
	add("absent-event", projectResult("produceEvent", record({ natValue: "43" }), "match value with | .empty => true | _ => false"), wrap("true"));
	const nested = "value.map (fun item => item.map (fun packet => packet.natValue))";
	add("produced-group", projectResult("produceGroup", output, nested), wrap(`#[none, some ${produced.natValue}]`));
	add("produced-pair", projectResult("producePair", output, "value.right.map (fun item => item.map (fun packet => packet.natValue))"), wrap(`#[none, some ${produced.natValue}]`));
	add("produced-event", projectResult("produceEvent", output, "match value with | .box packet => packet.natValue | _ => 0"), wrap(produced.natValue));
	const choices = "match value with | .choices values => values.map (fun item => item.map (fun branch => match branch with | .ok packet => (true, packet.natValue) | .error packet => (false, packet.natValue))) | _ => #[]";
	add("produced-both-branches", projectResult("produceChoices", output, choices), wrap(`#[none, some (true, ${produced.natValue}), some (false, ${produced.natValue})]`));
	add("source-word-width", invoke("wordBits"), wrap("System.Platform.numBits.toUInt32"));
	if(!resultOnly)
	{
		add("unit-refusal", component ? `(${invoke("refuseUnit", packetA)}).isEmpty` : `(${invoke("refuseUnit", packetA)}).isNone`, "true");
		add("two-input-selections", map(invoke("combine", packetA, packetB), "(value.1.natValue, value.2.natValue)"), checked("(42, 44)"));
		add("late-fin-rejection", component ? `(${invoke("combine", packetA, record({ boolValue: "false", digit: "3" }))}).isEmpty`
			: `(${invoke("combine", packetA, record({ boolValue: "false", digit: "3" }))}).isNone`, "true");
		add("nested-record-selections", map(invoke("echoPair", `⟨#[some ${packetA}], #[some ${packetB}]⟩`), "value.right.map (fun item => item.map (fun packet => packet.natValue))"), checked("#[some 44]"));
		add("aliases", map(invoke("aliases", `#[none, some ${packetA}]`, `#[none, some ${packetB}]`), nested), checked("#[none, some 42, none, some 44]"));
		add("empty-active-variant", map(invoke("echoEventA", ".empty"), "match value with | .empty => true | _ => false"), checked("true"));
		add("box-A", map(invoke("echoEventA", `.box ${packetA}`), "match value with | .box packet => packet.natValue | _ => 0"), checked("42"));
		add("box-B", map(invoke("echoEventB", `.box ${packetB}`), "match value with | .box packet => packet.natValue | _ => 0"), checked("44"));
		add("active-both-branches", map(invoke("echoEventA", `.choices #[none, some (.ok ${packetA}), some (.error ${packetB})]`), choices), checked("#[none, some (true, 42), some (false, 44)]"));
		for(const [name, bits] of [["float32Value", "0x80000000"], ["float64Value", "0x8000000000000000"]])
			add(`negative-zero-${name}`, map(invoke("echoB", record({ boolValue: "false", [name]: "0.0" })), project(name)), checked(bits));
		for(const [name, type, bits] of [["float32Value", "Float32", "0x7fc00001"], ["float64Value", "Float", "0x7ff8000000000001"]])
			add(`nan-refusal-${name}`, component ? `(${invoke("echoB", record({ boolValue: "false", [name]: `${type}.ofBits ${bits}` }))}).isEmpty`
				: `(${invoke("echoB", record({ boolValue: "false", [name]: `${type}.ofBits ${bits}` }))}).isNone`, "true");
		for(const [name, value, expected] of [
			["uint8Value", "254", "0"], ["uint16Value", "65534", "0"]
			, ["uint32Value", "4294967294", "0"]
			, ["uint64Value", "18446744073709551614", "0"]
			, ["int8Value", "126", "-128"], ["int16Value", "32766", "-32768"]
			, ["int32Value", "2147483646", "-2147483648"]
			, ["int64Value", "9223372036854775806", "-9223372036854775808"]
		]) add(`normalizing-wrap-${name}`, map(invoke("echoB", record({ boolValue: "false", [name]: value })), project(name)), checked(expected));
		add("Unicode-NUL", map(invoke("echoB", record({ boolValue: "false", textValue: "String.ofList ['a', Char.ofNat 0, 'λ', '😀']" })), "value.textValue.toList"), checked("['a', Char.ofNat 0, 'λ', '😀', '!']"));
		add("empty-byte-normalization", map(invoke("echoB", record({ boolValue: "false", bytesValue: "⟨#[]⟩" })), "value.bytesValue.toList"), checked("[255]"));
		add("valid-after-refusal", map(invoke("echoA", packetA), "value.natValue"), checked("42"));
	}
	assert.equal(new Set(cases.map(item => item.label)).size, cases.length);
	return cases;
};
