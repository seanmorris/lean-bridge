/** @file Owner-agent wire for calls made by generated JavaScript host-member externs. */
import { scalarCopyLimit } from "../abi/component-scalars.mjs";
import { readComponentScalarSlot, writeComponentScalarSlot } from "../release/component-scalar-codec.mjs";
import { bindWasmHostMembers } from "./wasm-host-members.mjs";

const malformed = () => { throw new TypeError("Invalid JavaScript host member frame"); };
const u32 = n => Number.isInteger(n) && n > 0 && n <= 0xffff_ffff;

/** Create the shared heap's private table of original thrown values and boundary faults. */
export const createWasmHostErrorStore = () => {
	const held = new Map(); let next = 0;
	const take = token => {
		if(!held.has(token)) throw new Error("Unknown JavaScript host error token");
		const value = held.get(token); held.delete(token); return value;
	};
	return Object.freeze({
		keep: failure => {
			if(next === 0xffff_ffff) throw new RangeError("JavaScript host error tokens exhausted");
			const id = ++next; held.set(id, failure); return id;
		}
		, take, discard: token => { take(token); }, size: () => held.size
	});
};

/**
 * Keep the result of each synchronous invocation alive until the native
 * caller has copied it. Nested application reentry gets a distinct frame;
 * thrown values (including undefined) never unwind through the Wasm stack.
 *
 * @param wasm - Prepared shared Wasm module on this agent.
 * @param model - Generated member table of this component.
 * @param supplied - Application-supplied nominal constructors.
 * @param domain - Internal resolve/pin/release operations of this heap's nominal domain.
 * @param lifecycle - Shared-heap guard, including retirement during an application callback.
 */
export const createWasmHostWire = (wasm, model, supplied, domain, lifecycle) => {
	const frames = new Map(), faults = new WeakMap();
	const native=fn=>{
		try
		{lifecycle?.assertOpen();const result=fn();lifecycle?.assertOpen();return result;}
		catch(error)
		{lifecycle?.poison();throw error;}
	};
	const send = bindWasmHostMembers(model, supplied, error => {
		// Do not brand the public error itself. The application can subsequently
		// throw that same error, which is then an application exception.
		const marker = {}; faults.set(marker,error); throw marker;
	});
	const span = (p, size) => u32(p) && p % 8 === 0 && p + size <= wasm.HEAP8.length;
	const overlap = (p, size, q, bytes) => size && bytes && p < q + bytes && q < p + size;
	const call = (slot, n, args, reply) => {
		lifecycle?.assertOpen();
		const m = Number.isInteger(slot) && slot >= 0 && model.members[slot];
		// Never acquire a pre-existing frame or let an inner call finish it.
		if(!span(reply, 16) || frames.has(reply)) throw new Error("Invalid or overlapping active host reply");
		const frame = {status: 3, allocations: [], pin: 0};
		frames.set(reply, frame);
		try
		{
			if(!m || n !== m.args.length || !span(args, 16*n) || overlap(args, 16*n, reply, 16)
				|| wasm.HEAP8.subarray(reply, reply + 16).some(Boolean)) malformed();
			let budget = scalarCopyLimit - 16*(n+1);
			const charge = size => { if(!Number.isSafeInteger(size) || size < 0 || size > budget) throw new RangeError("Host member copy budget exceeded"); budget -= size; };
			const values = m.args.map((type, i) => {
				const p = args + 16*i;
				if(typeof type !== "number") return readComponentScalarSlot(wasm, p, type, charge);
				const v = new DataView(wasm.HEAP8.buffer), token = v.getUint32(p + 8, true);
				if(v.getUint32(p, true) !== 64+type || v.getUint32(p + 4, true) || v.getUint32(p + 12, true) || !token) malformed();
				return domain.resolve(type,token);
			});
			let result;
			try
			{ result = send(slot, values); }
			catch(error)
			{
				lifecycle?.assertOpen();
				const invalid = faults.has(error);
				frame.status = invalid ? 3 : 1;
				frame.error = invalid ? faults.get(error) : error; return frame.status;
			}
			lifecycle?.assertOpen(); // A nested call can retire the heap even if the application caught the trap.
			if(typeof m.result === "number")
			{
				const token = domain.pin(m.result,result,m.anchor === null ? null : values[m.anchor]);
				if(!u32(token)) malformed();
				frame.pin = token;
				const v = new DataView(wasm.HEAP8.buffer);
				v.setUint32(reply,64 + m.result,true); v.setBigUint64(reply+8,BigInt(token),true);
			}
			else writeComponentScalarSlot(wasm, reply, m.result, result, size => {
				charge(size);
				const p = native(()=>wasm._malloc(Math.max(1,size))) >>> 0;
				if(!span(p,Math.max(1,size))) malformed();
				frame.allocations.push(p); return p;
			});
			frame.status = 0;
		}
		catch(error)
		{ frame.error = error; }
		try
		{ lifecycle?.assertOpen(); }
		catch(error)
		{ frames.delete(reply);throw error; }
		return frame.status;
	};
	const failure = reply => {
		const frame = frames.get(reply);
		if(!frame || !frame.status) malformed();
		return {application: frame.status === 1, error: frame.error};
	};
	const finish = reply => {
		lifecycle?.assertOpen();
		const f = frames.get(reply);
		if(!f) malformed();
		frames.delete(reply);
		try
		{ if(f.pin) domain.release(f.pin); }
		finally
		{ for(const p of f.allocations) native(()=>wasm._free(p)); }
	};
	return Object.freeze({call,failure,finish,observed: reply => frames.get(reply)?.status ? failure(reply) : null});
};
