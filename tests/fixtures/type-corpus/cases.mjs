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
		, pendingExport: "Shop.Pending.discount", pendingShape: "option"
		, operations: ["quoteUnits", "basketTotal", "refund", "receiptLabel", "restock", "regroup", "revise", "nextSerial", "previousBalance", "enabled", "keepMarker", "reverseBlob"]
		, pythonOperations: ["quote_units", "basket_total", "refund", "receipt_label", "restock", "regroup", "revise", "next_serial", "previous_balance", "enabled", "keep_marker", "reverse_blob"]
	}
	, {
		id: "telemetry", module: "Telemetry.Readings", oracle: "TelemetryOracle.lean"
		, pythonModule: "lean_telemetry", pendingModule: "Telemetry.Pending"
		, pendingExport: "Telemetry.Pending.checkedCount", pendingShape: "result"
		, operations: ["measureTick", "accumulate", "calibrate", "channelLabel", "offsetSamples", "rotateRows", "advanceFrame", "wrapClock", "nextOffset", "invertStatus", "acknowledge", "mirrorPayload"]
		, pythonOperations: ["measure_tick", "accumulate", "calibrate", "channel_label", "offset_samples", "rotate_rows", "advance_frame", "wrap_clock", "next_offset", "invert_status", "acknowledge", "mirror_payload"]
	}
];

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
		, ["wrong-bytes", bytes, [{ string: "raw" }], [coverage("bytes", ["parameter"])], "type"]
		, ["wrong-boolean", bool, [integer(1)], [coverage("bool", ["parameter"])], "type"]
		, ["overflow-u64", u64, [integer(2n ** 64n)], [coverage("uint64", ["parameter"])], "range"]
	];
	return entries.map(([id, operation, args, cells, rejection]) => ({
		id: `${library.id}/${id}`, library: library.id
		, oracleKey: rejection ? null : id
		, operation, arguments: args, coverage: cells
		, expectation: rejection ? { kind: "host-rejection", category: rejection } : { kind: "lean-oracle" }
		, checkIndependentCopy: id === "record"
	}));
};
