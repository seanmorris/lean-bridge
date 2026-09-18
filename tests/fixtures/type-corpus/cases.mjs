/**
 * Host-neutral inputs for two ordinary libraries, with explicit type-position scope.
 *
 * @file
 */

const integer = value => ({ integer: String(value) });
const array = values => ({ array: values });
const numbers = values => array(values.map(integer));
const coverage = (shape, positions = ["parameter", "result"]) => ({ shape, positions });
const large = 2n ** 4096n;

export const corpusLibraries = [
	{
		id: "shop", module: "Shop.Pricing", oracle: "ShopOracle.lean"
		, pythonModule: "lean_shop", pendingModule: "Shop.Pending"
		, rubyModule: "LeanBridge::Shop", rubyRequire: "lean_bridge/shop"
		, perlModule: "LeanBridge::Shop", npmModule: "shop-corpus"
		, rustModule: "shop_corpus", cModule: "shop"
		, dotnetModule: "LeanBridge.Shop"
		, jvmModule: "org.leanbridge.shop"
		, phpModule: "LeanShop"
		, recordFields: { Basket: ["label", "units", "credit", "batches", "active"] }
		, pendingExport: "Shop.Pending.discount", pendingShape: "option"
		, operations: ["quoteUnits", "basketTotal", "refund", "receiptLabel", "restock", "regroup", "revise", "nextSerial", "previousBalance", "enabled", "keepMarker", "reverseBlob", "nextTag", "nextBatch", "reduceGrade", "reduceStock", "reduceOffset", "reverseRate", "reversePrice"]
		, snakeOperations: ["quote_units", "basket_total", "refund", "receipt_label", "restock", "regroup", "revise", "next_serial", "previous_balance", "enabled", "keep_marker", "reverse_blob", "next_tag", "next_batch", "reduce_grade", "reduce_stock", "reduce_offset", "reverse_rate", "reverse_price"]
	}
	, {
		id: "telemetry", module: "Telemetry.Readings", oracle: "TelemetryOracle.lean"
		, pythonModule: "lean_telemetry", pendingModule: "Telemetry.Pending"
		, rubyModule: "LeanBridge::Telemetry", rubyRequire: "lean_bridge/telemetry"
		, perlModule: "LeanBridge::Telemetry", npmModule: "telemetry-corpus"
		, rustModule: "telemetry_corpus", cModule: "telemetry"
		, dotnetModule: "LeanBridge.Telemetry"
		, jvmModule: "org.leanbridge.telemetry"
		, phpModule: "LeanTelemetry"
		, recordFields: { Frame: ["samples", "counter", "bias", "title", "valid"] }
		, pendingExport: "Telemetry.Pending.checkedCount", pendingShape: "result"
		, operations: ["measureTick", "accumulate", "calibrate", "channelLabel", "offsetSamples", "rotateRows", "advanceFrame", "wrapClock", "nextOffset", "invertStatus", "acknowledge", "mirrorPayload", "advanceTag", "advanceSequence", "raiseGrade", "raiseLevel", "raiseBaseline", "halveSample", "halveMeasure"]
		, snakeOperations: ["measure_tick", "accumulate", "calibrate", "channel_label", "offset_samples", "rotate_rows", "advance_frame", "wrap_clock", "next_offset", "invert_status", "acknowledge", "mirror_payload", "advance_tag", "advance_sequence", "raise_grade", "raise_level", "raise_baseline", "halve_sample", "halve_measure"]
	}
];

/**
 * Independent expected declarations, checked against compiler metadata before use.
 *
 * @param library - One of the two source libraries.
 */
export const corpusSignatures = library => {
	const vector = { array: "uint32" }, matrix = { array: vector };
	const fields = library.id === "shop"
		? { label: "string", units: "nat", credit: "int", batches: matrix, active: "bool" }
		: { samples: matrix, counter: "nat", bias: "int", title: "string", valid: "bool" };
	const record = { record: `${library.module}.${Object.keys(library.recordFields)[0]}`, fields };
	const signatures = [
		[["uint32"], "uint32"], [["nat", "uint32"], "nat"], [["int", "int"], "int"]
		, [["string", "string"], "string"], [[vector, "uint32"], vector]
		, [[matrix], matrix], [[record], record]
		, ...["uint64", "int64", "bool", "unit", "bytes", "uint8", "uint16", "int8", "int16", "int32", "float32", "float64"].map(type => [[type], type])
	];
	return library.operations.map((operation, index) => ({ name: `${library.module}.${operation}`
		, parameters: signatures[index][0], result: signatures[index][1] }));
};

/**
 * Apply a documented host policy while retaining the same input and Lean oracle.
 *
 * @param entry - Shared case with optional per-profile expectations.
 * @param profile - Consumer profile whose public API is called.
 */
export const corpusHostCase = (entry, profile) => ({ ...entry, ...entry.hostExpectations[profile] });

/**
 * Every positive oracle result, including host-specific numeric acceptance.
 *
 * @param cases - Unmodified library catalog cases.
 */
export const corpusOracleKeys = cases => [...new Set(cases.flatMap(entry => [entry.oracleKey, ...Object.values(entry.hostExpectations).map(policy => policy.oracleKey)]).filter(key => key != null))].sort();

const perlRejection = id => {
	if(["negative-nat", "bad-record"].includes(id)) return "Nat cannot be negative";
	if(id === "wrong-bytes") return "ByteArray requires an octet string, not Unicode text";
	if(id === "wrong-boolean") return "Bool requires true() or false()";
	if(id.startsWith("int")) return "signed integer is out of range or not an exact integer scalar";
	return "unsigned integer is out of range or not an exact integer scalar";
};

const phpRejection = id => {
	if(["negative-nat", "bad-record"].includes(id)) return "Expected an unsigned integer";
	if(id === "wrong-bytes") return "Expected Bytes";
	if(id === "wrong-boolean") return "Bool requires bool";
	if(id.startsWith("float")) return "Expected a float without numeric coercion";
	if(["bool-as-number", "bad-nested"].includes(id)) return "Expected an int without numeric coercion";
	return id === "overflow-u64" ? "Integer is outside the UInt64 range" : "Integer is outside the declared Lean range";
};

const phpWasmExpectation = id => {
	if(["bool-as-number", "bad-nested"].includes(id)) return { rejectionMessage: "Expected Brick Math BigInteger" };
	if(id === "overflow-u32") return { rejectionMessage: "Integer is outside the UInt32 range" };
	if(["int32-below", "int32-above"].includes(id))
		return { expectation: { kind: "host-rejection", category: "type" }, rejectionMessage: "Expected an int without numeric coercion" };
	return { rejectionMessage: phpRejection(id) };
};

const javascriptFloatExpectation = id => {
	const policy = { expectation: { kind: "lean-oracle" }, oracleKey: id
		, resultEncoding: id.split("-")[0] };
	const profiles = ["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"];
	return Object.fromEntries(profiles.map(profile => [profile, policy]));
};

const rustRejection = (id, category) => ({ expectation: { kind: "compile-rejection"
	, category
	, diagnostic: ["uint8-below", "uint16-below"].includes(id) ? "E0600"
		: id.startsWith("overflow-") || /^(?:uint|int)\d+-(?:below|above)$/.test(id) ? "overflowing_literals" : "E0308" } });

const cFamilyExpectation = (id, category, profile) => {
	if(["bool-as-number", "wrong-boolean", "float32-wrong-type", "float64-wrong-type", ...(profile === "c" ? ["bad-nested"] : [])].includes(id))
		return { expectation: { kind: "lean-oracle" }, oracleKey: id
			, resultEncoding: id.startsWith("float") ? id.split("-")[0] : "value" };
	return { expectation: { kind: "compile-rejection", category
		, diagnostic: id.startsWith("overflow-") || /^(?:uint|int)\d+-(?:below|above)$/.test(id) ? "narrowing" : "incompatible-type" } };
};

const witExpectation = (id, category) => id.startsWith("overflow-") || /^(?:uint|int)\d+-(?:below|above)$/.test(id)
	? { expectation: { kind: "compile-rejection", category, diagnostic: "narrowing" } }
	: { expectation: { kind: "host-rejection", category: "type" }
		, rejectionMessage: "Unknown export, invalid WIT input or 16 MiB conversion limit" };

const dotnetExpectation = (id, category) => {
	if(["float32-wrong-type", "float64-wrong-type"].includes(id))
		return { expectation: { kind: "lean-oracle" }, oracleKey: id, resultEncoding: id.split("-")[0] };
	if(["negative-nat", "bad-record"].includes(id)) return { rejectionMessage: "Lean Nat cannot be negative" };
	return { expectation: { kind: "compile-rejection", category
		, diagnostic: id === "overflow-u64" ? "CS0220"
			: id.startsWith("overflow-") || /^(?:uint|int)\d+-(?:below|above)$/.test(id) ? "CS0221"
				: id === "bad-nested" ? "CS0029" : "CS1503" } };
};

const jvmExpectation = (id, category, profile) => {
	if(profile === "java" && ["float32-wrong-type", "float64-wrong-type"].includes(id))
		return { expectation: { kind: "lean-oracle" }, oracleKey: id, resultEncoding: id.split("-")[0] };
	if(["negative-nat", "bad-record"].includes(id)) return { rejectionMessage: "Nat cannot be negative" };
	if(id.startsWith("overflow-") || /^uint(?:8|16)-(?:below|above)$/.test(id))
		return { rejectionMessage: `${id === "overflow-u32" ? "uint32" : id === "overflow-u64" ? "uint64" : id.split("-")[0]} is out of range` };
	return { expectation: { kind: "compile-rejection", category
		, diagnostic: profile === "kotlin" ? "ARGUMENT_TYPE_MISMATCH"
			: id === "bad-nested" ? "compiler.err.prob.found.req" : "compiler.err.cant.apply.symbol" } };
};

/**
 * Return immutable-by-convention JSON inputs; consumers receive a serialized copy.
 *
 * @param library - One declared corpus library, never inferred from an Alpha API.
 */
export const corpusCases = library => {
	const shop = library.id === "shop";
	const [dependency, exact, signed, label, vector, matrix, revise, u64, i64, bool, unit, bytes] = library.operations;
	const record = shop ? { record: "Basket"
		, fields: {
			label: { string: "basket\0λ" }
			, units: integer(large), credit: integer(-7)
			, batches: array([numbers([1, 2]), numbers([])]), active: { bool: true }
		}
	} : { record: "Frame"
		, fields: {
			samples: array([numbers([1, 2]), numbers([])])
			, counter: integer(large)
			, bias: integer(-7), title: { string: "frame\0λ" }, valid: { bool: true }
		}
	};
	const badRecord = structuredClone(record);
	badRecord.fields[shop ? "units" : "counter"] = integer(-1);
	const entries = [
		["dependency", dependency, [integer(7)], [coverage("uint32")]]
		, ["exact-large", exact, [integer(large + 1n), integer(3)], [coverage("nat"), coverage("uint32", ["parameter"])]]
		, ["zero", exact, [integer(0), integer(0)], [coverage("nat"), coverage("uint32", ["parameter"])]]
		, ["signed-large", signed, [integer(-large), integer(7)], [coverage("int")]]
		, ["text", label, [{ string: "a\0λ🌿" }, { string: "end" }], [coverage("string")]]
		, ["empty-text", label, [{ string: "" }, { string: "" }], [coverage("string")]]
		, ["array", vector, [numbers([0, 4294967295, 41]), integer(1)], [coverage("array"), coverage("uint32", ["parameter"])]]
		, ["empty-array", vector, [numbers([]), integer(1)], [coverage("array")]]
		, ["nested-array", matrix, [array([numbers([1, 2]), numbers([]), numbers([3])])], [coverage("array")]]
		, ["record", revise, [record], [coverage("record"), ...["string", "nat", "int", "array", "bool"].map(shape => coverage(shape, ["field"]))]]
		, ["u64-wrap", u64, [integer(2n ** 64n - 1n)], [coverage("uint64")]]
		, ["i64-wrap", i64, [integer(shop ? -(2n ** 63n) : 2n ** 63n - 1n)], [coverage("int64")]]
		, ["bool", bool, [{ bool: false }], [coverage("bool")]]
		, ["unit", unit, [{ unit: true }], [coverage("unit")]]
		, ["bytes", bytes, [{ bytes: [0, 255, 128, 65] }], [coverage("bytes")]]
		, ["empty-bytes", bytes, [{ bytes: [] }], [coverage("bytes")]]
		, ["negative-nat", exact, [integer(-1), integer(2)], [coverage("nat", ["parameter"])], "range"]
		, ["overflow-u32", dependency, [integer(2n ** 32n)], [coverage("uint32", ["parameter"])], "range"]
		, ["bool-as-number", dependency, [{ bool: true }], [coverage("uint32", ["parameter"])], "type"]
		, ["bad-nested", matrix, [array([array([{ unit: true }])])], [coverage("array", ["parameter"])], "type"]
		, ["bad-record", revise, [badRecord], [coverage("nat", ["field"])], "range"]
		, ["wrong-bytes", bytes, [integer(0)], [coverage("bytes", ["parameter"])], "type"]
		, ["wrong-boolean", bool, [integer(1)], [coverage("bool", ["parameter"])], "type"]
		, ["overflow-u64", u64, [integer(2n ** 64n)], [coverage("uint64", ["parameter"])], "range"]
	];
	for(const [index, [shape, bits, signed]] of [["uint8", 8, false], ["uint16", 16, false], ["int8", 8, true], ["int16", 16, true], ["int32", 32, true]].entries())
	{
		const operation = library.operations[12 + index];
		const low = signed ? -(2n ** BigInt(bits - 1)) : 0n;
		const high = 2n ** BigInt(signed ? bits - 1 : bits) - 1n;
		entries.push([`${shape}-wrap`, operation, [integer(signed && shop ? low : high)], [coverage(shape)]]
			, [`${shape}-zero`, operation, [integer(0)], [coverage(shape)]]
			, [`${shape}-below`, operation, [integer(low - 1n)], [coverage(shape, ["parameter"])], "range"]
			, [`${shape}-above`, operation, [integer(high + 1n)], [coverage(shape, ["parameter"])], "range"]);
	}
	const floating = [
		["float32", [0x3fc00000n, 0n, 0x80000000n, 1n, 0x7f7fffffn, 0x7f800000n, 0xff800000n, "nan"]]
		, ["float64", [0x3ff8000000000000n, 0n, 0x8000000000000000n, 1n, 0x7fefffffffffffffn, 0x7ff0000000000000n, 0xfff0000000000000n, "nan"]]
	];
	for(const [index, [shape, values]] of floating.entries())
	{
		const operation = library.operations[17 + index];
		const labels = ["finite", "zero", "negative-zero", "subnormal", "largest", "positive-infinity", "negative-infinity", "nan"];
		for(const [valueIndex, value] of values.entries())
			entries.push([`${shape}-${labels[valueIndex]}`, operation, [{ [shape]: String(value) }], [coverage(shape)], null, shape]);
		entries.push([`${shape}-wrong-type`, operation, [integer(1)], [coverage(shape, ["parameter"])], "type"]);
	}
	return entries.map(([id, operation, args, cells, rejection, encoding]) => ({
		id: `${library.id}/${id}`, library: library.id
		, oracleKey: rejection ? null : id
		, operation, arguments: args, coverage: cells
		, resultEncoding: encoding ?? "value"
		, expectation: rejection ? { kind: "host-rejection", category: rejection } : { kind: "lean-oracle" }
		, hostExpectations: {
			...(rejection ? { rust: rustRejection(id, rejection) } : {})
			, ...(rejection ? { "php-native": { rejectionMessage: phpRejection(id) } } : {})
			, ...(rejection ? { "php-wasm": phpWasmExpectation(id) } : {})
			, ...(rejection ? { "wit-wasi": witExpectation(id, rejection) } : {})
			, ...(rejection ? { dotnet: dotnetExpectation(id, rejection) } : {})
			, ...(rejection ? Object.fromEntries(["java", "kotlin"].map(profile => [profile, jvmExpectation(id, rejection, profile)])) : {})
			, ...(rejection ? Object.fromEntries(["c", "cpp"].map(profile => [profile, cFamilyExpectation(id, rejection, profile)])) : {})
			, ...(["bool-as-number", "float32-wrong-type", "float64-wrong-type"].includes(id)
				? { perl: { expectation: { kind: "lean-oracle" }, oracleKey: id, resultEncoding: id.startsWith("float") ? id.split("-")[0] : "value" } }
				: rejection ? { perl: { rejectionMessage: perlRejection(id) } } : {})
			, ...(["float32-wrong-type", "float64-wrong-type"].includes(id)
				? javascriptFloatExpectation(id) : {})
		}
		, checkIndependentCopy: id === "record"
	}));
};
