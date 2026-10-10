/**
 * Independent Fin 0 nominal-field contracts and installed acceptance selection.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { installCopiedConsumer } from "./copied-fixture-install.mjs";
import { finRecordCompilerInput } from "./fin-record-model.mjs";
import { createNativeModel } from "../../src/build/native-model.mjs";

const coordinate = { name: "finrecordzero", version: "1.0.0" };
export const finRecordZeroTargets = Object.freeze({
	c: ["c", coordinate], cpp: ["cpp", coordinate], python: ["pypi", coordinate]
	, rust: ["cargo", coordinate], ruby: ["rubygems", coordinate]
	, dotnet: ["nuget", { name: "FinRecordZero.Api", version: "1.0.0" }]
	, java: ["maven", { name: "org.leanbridge:finrecordzero", version: "1.0.0" }]
	, kotlin: ["maven", { name: "org.leanbridge:finrecordzero", version: "1.0.0" }]
	, "php-native": ["php-native", { name: "example/finrecordzero", version: "1.0.0" }]
	, "wit-wasi": ["wit-wasi", coordinate]
	, perl: ["cpan", { module: "LeanBridge::FinRecordZero", version: "1.000" }]
});
export const finRecordZeroChecks = 2046;
const zero = { kind: "fin", bound: "0" };
const collection = (kind, element) => ({ kind, arguments: [element] });
const empty = { kind: "record", definition: "FinRecordZero.Zero", fields: ["digit"], arguments: [zero] };
const fields = { kind: "record", definition: "FinRecordZero.Fields"
	, fields: ["label", "payload", "array", "list"]
	, arguments: [null, null, collection("array", zero), collection("list", zero)] };
export const finRecordZeroRefinements = Object.freeze(Object.fromEntries([
	["arrayFields", collection("array", fields)]
	, ["arrayRecords", collection("array", empty)]
	, ["fieldCollections", fields]
	, ["listFields", collection("list", fields)]
	, ["listRecords", collection("list", empty)]
].map(([name, tree]) => [`FinRecordZero.${name}`, { parameters: [tree], result: tree }])));

/** Independently authored reviewed metadata, without inspecting compiled output. */
export const finRecordZeroReviewedIr = () => {
	const zero = { kind: "fin", bound: "0" };
	const empty = { record: "FinRecordZero.Zero", fields: { digit: "nat" } };
	const fields = { record: "FinRecordZero.Fields", fields: { label: "string", payload: { array: "nat" }, array: { array: "nat" }, list: { list: "nat" } } };
	const ir = corpusReviewedIr({ id: "finrecordzero" }, [
		["arrayFields", { array: fields }], ["arrayRecords", { array: empty }]
		, ["fieldCollections", fields]
		, ["listFields", { list: fields }]
		, ["listRecords", { list: empty }]
	].map(([name, type]) => ({ name: `FinRecordZero.${name}`, parameters: [type], result: type })));
	for(const declaration of ir.declarations) declaration.parameters[0].name = "arg0";
	for(const type of ir.types) type.source.extensions["lean-lang.org/nominal-refinements"] = {
		kind: "record"
		, fields: type.id === "lean:FinRecordZero.Zero" ? [zero]
			: [null, null, collection("array", zero), collection("list", zero)]
	};
	return ir;
};

/** Compiler-shaped types for generated public-declaration checks, not installed evidence. */
export const finRecordZeroCompilerModel = () => {
	const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { ...heap, heap: false } };
	const fin = { kind: "refinement", base: nat, predicate: zero, abi: nat.abi };
	const sequence = (kind, element) => ({ kind, element, abi: heap });
	const record = (name, members) => {
		const lean = `FinRecordZero.${name}`;
		return { kind: "record", name: lean, lean
			, constructor: `${lean}.mk`, abi: heap
			, fields: members.map(([name, type]) => ({ name, projection: `${lean}.${name}`, type })) };
	};
	const empty = record("Zero", [["digit", fin]]);
	const fields = record("Fields", [["label", { kind: "primitive", name: "string", lean: "String", abi: heap }]
		, ["payload", sequence("array", nat)]
		, ["array", sequence("array", fin)]
		, ["list", sequence("list", fin)]]);
	const signatures = Object.fromEntries([
		["arrayFields", sequence("array", fields)]
		, ["arrayRecords", sequence("array", empty)]
		, ["fieldCollections", fields]
		, ["listFields", sequence("list", fields)]
		, ["listRecords", sequence("list", empty)]
	].map(([name, type]) => [name, [type, type]]));
	return createNativeModel({ ...finRecordCompilerInput({}, signatures)
		, component: { id: "finrecordzero@1.0.0", ...coordinate } }, { refinements: true });
};

export const finRecordZeroWitPatterns = [
	/record zero \{\s*digit: (bridge-value-\d+),?\s*\}/u
	, /record fields \{\s*label: string,\s*payload: (bridge-value-\d+),\s*array: \1,\s*%list: bridge-value-\d+,?\s*\}/u
];

/** Installed test specification; every consumer must execute the same number of assertions. */
export const finRecordZeroSpec = {
	fixture: "tests/fixtures/onboarding/native-fin-record-zero"
	, module: "FinRecordZero", label: "fin-record-zero"
	, targets: finRecordZeroTargets, refinements: finRecordZeroRefinements
	, reviewedIr: finRecordZeroReviewedIr
	, report: { variable: "LEAN_BRIDGE_FIN_RECORD_ZERO_REPORT", reviewedVariable: "LEAN_BRIDGE_REVIEWED_FIN_RECORD_ZERO_REPORT", directory: "build/native-fin-record-zero" }
	, install: options => installCopiedConsumer({ ...options, fixture: {
		source: (profile, extension) => readFile(`tests/fixtures/fin-record-zero-consumers/${profile}.${extension}`, "utf8")
		, wit: finRecordZeroWitPatterns
		, success: "fin-record-zero-ok", expectedChecks: finRecordZeroChecks
	} })
};
