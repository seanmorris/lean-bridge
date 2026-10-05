/**
 * Host-value conversion and observations shared by Node and real browsers.
 *
 * @file
 */

const check = (condition, message) => {
	if(!condition) throw new Error(message ?? "Unexpected JavaScript host value");
};
const same = (actual, expected, id) => check(JSON.stringify(actual) === JSON.stringify(expected), `Oracle mismatch: ${id}`);

/**
 * Decode IEEE bits without a JSON floating-point round trip.
 *
 * @param kind - Float width.
 * @param bits - Decimal bit pattern or NaN marker.
 */
export const floatFromBits = (kind, bits) => {
	if(bits === "nan") return NaN;
	const view = new DataView(new ArrayBuffer(8));
	if(kind === "float32")
	{ view.setUint32(0, Number(bits)); return view.getFloat32(0); }
	view.setBigUint64(0, BigInt(bits));
	return view.getFloat64(0);
};
const decode = (wire, type) => {
	if(Object.hasOwn(wire, "integer")) return ["nat", "int", "uint64", "int64"].includes(type) ? BigInt(wire.integer) : Number(wire.integer);
	if(Object.hasOwn(wire, "bool")) return wire.bool;
	if(Object.hasOwn(wire, "string")) return wire.string;
	if(Object.hasOwn(wire, "unit")) return undefined;
	if(Object.hasOwn(wire, "bytes")) return Uint8Array.from(wire.bytes);
	for(const kind of ["float32", "float64"]) if(Object.hasOwn(wire, kind)) return floatFromBits(kind, wire[kind]);
	throw new Error("Unsupported wire input reached a public call");
};
const encode = (value, type, encoding) => {
	if(encoding === "float32" || encoding === "float64")
	{
		check(typeof value === "number");
		if(Number.isNaN(value)) return { [encoding]: "nan" };
		const view = new DataView(new ArrayBuffer(8));
		if(encoding === "float32")
		{ view.setFloat32(0, value); return { float32: String(view.getUint32(0)) }; }
		view.setFloat64(0, value);
		return { float64: String(view.getBigUint64(0)) };
	}
	if(type === "unit")
	{ check(value === undefined); return { unit: true }; }
	if(type === "bool" || type === "string")
	{ check(typeof value === (type === "bool" ? "boolean" : "string")); return { [type]: value }; }
	if(type === "bytes")
	{ check(value instanceof Uint8Array); return { bytes: [...value] }; }
	check(typeof value === (["nat", "int", "uint64", "int64"].includes(type) ? "bigint" : "number"));
	if(typeof value === "number") check(Number.isSafeInteger(value));
	return { integer: String(value) };
};

/**
 * Call only installed public exports and return tagged, JSON-safe observations.
 *
 * @param request - Catalog inputs, independent signatures and fresh Lean oracle.
 * @param api - Installed public package namespace.
 * @param typedCall - Optional statically checked TypeScript dispatcher.
 */
export const executeCorpus = (request, api, typedCall) => {
	const supported = new Set(Object.keys(request.signatures));
	const call = entry => {
		if(typedCall) return typedCall(entry.id);
		const signature = request.signatures[entry.operation];
		return api[entry.operation](...entry.arguments.map((wire, index) => decode(wire, signature.parameters[index])));
	};
	const recovery = request.cases.find(entry => entry.id.endsWith("/dependency"));
	return request.cases.map(entry => {
		if(!supported.has(entry.operation)) return { id: entry.id, status: "unsupported", export: `${request.leanModule}.${entry.operation}` };
		if(entry.expectation.kind === "host-rejection")
		{
			let exception;
			try
			{ call(entry); }
			catch(error)
			{ exception = error; }
			check(exception instanceof TypeError, `Expected public TypeError: ${entry.id}`);
			check(exception.name === request.errors[entry.expectation.category], entry.id);
			same(encode(call(recovery), "uint32", "value"), request.oracle[recovery.oracleKey], entry.id);
			return { id: entry.id, status: "rejected-as-expected", exception: exception.name, recovered: true };
		}
		const observed = encode(call(entry), request.signatures[entry.operation].result, entry.resultEncoding);
		same(observed, request.oracle[entry.oracleKey], entry.id);
		return { id: entry.id, status: "matched", observed, independentCopy: false };
	});
};
