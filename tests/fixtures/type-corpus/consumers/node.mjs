/**
 * Source-free public npm consumer, also used by the strict TypeScript program.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
	assert.fail("Unsupported wire input reached a public call");
};

const encode = (value, type, encoding) => {
	if(encoding === "float32" || encoding === "float64")
	{
		assert.equal(typeof value, "number");
		if(Number.isNaN(value)) return { [encoding]: "nan" };
		const view = new DataView(new ArrayBuffer(8));
		if(encoding === "float32")
		{ view.setFloat32(0, value); return { float32: String(view.getUint32(0)) }; }
		view.setFloat64(0, value);
		return { float64: String(view.getBigUint64(0)) };
	}
	if(type === "unit")
	{ assert.equal(value, undefined); return { unit: true }; }
	if(type === "bool" || type === "string")
	{ assert.equal(typeof value, type === "bool" ? "boolean" : "string"); return { [type]: value }; }
	if(type === "bytes")
	{ assert.ok(value instanceof Uint8Array); return { bytes: [...value] }; }
	assert.equal(typeof value, ["nat", "int", "uint64", "int64"].includes(type) ? "bigint" : "number");
	if(typeof value === "number") assert.ok(Number.isSafeInteger(value));
	return { integer: String(value) };
};

/** Load only the supplied host-neutral cases and Lean oracle results. */
export const loadRequest = async () => JSON.parse(await readFile(process.argv[2], "utf8"));

/**
 * Exercise installed exports, host rejections and recovery against fresh Lean.
 *
 * @param request - Serialized catalog cases and oracle results.
 * @param api - Installed public package namespace.
 * @param typedCall - Optional compiled TypeScript case dispatcher.
 */
export const runCorpus = async (request, api, typedCall) => {
	const modulePath = await realpath(fileURLToPath(import.meta.resolve(request.module)));
	assert.ok(modulePath.startsWith(`${await realpath(request.installRoot)}/node_modules/`));
	const supported = new Set(Object.keys(request.signatures));
	const call = entry => {
		if(typedCall) return typedCall(entry.id);
		const signature = request.signatures[entry.operation];
		return api[entry.operation](...entry.arguments.map((wire, index) => decode(wire, signature.parameters[index])));
	};
	const recovery = request.cases.find(entry => entry.id.endsWith("/dependency"));
	const results = [];
	for(const entry of request.cases)
	{
		if(!supported.has(entry.operation))
		{ results.push({ id: entry.id, status: "unsupported", export: `${request.leanModule}.${entry.operation}` }); continue; }
		if(entry.expectation.kind === "host-rejection")
		{
			let exception;
			try
			{ call(entry); }
			catch(error)
			{ exception = error; }
			assert.ok(exception instanceof TypeError, entry.id);
			assert.equal(exception.name, request.errors[entry.expectation.category]);
			assert.deepEqual(encode(call(recovery), "uint32", "value"), request.oracle[recovery.oracleKey]);
			results.push({ id: entry.id, status: "rejected-as-expected", exception: exception.name, recovered: true });
		}
		else
		{
			const observed = encode(call(entry), request.signatures[entry.operation].result, entry.resultEncoding);
			assert.deepEqual(observed, request.oracle[entry.oracleKey], entry.id);
			results.push({ id: entry.id, status: "matched", observed, independentCopy: false });
		}
	}
	process.stdout.write(JSON.stringify({ schemaVersion: 1
		, profile: request.profile, module: request.module
		, hostVersion: process.versions.node, modulePath, results }));
};

if(process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
{
	const request = await loadRequest();
	await runCorpus(request, await import(request.module));
}
