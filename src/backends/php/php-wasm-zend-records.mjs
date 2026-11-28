/** @file Carry flat Zend records through the standalone component without copying object identities. */
import {scalarCopyLimit} from "../../abi/component-scalars.mjs";
import {writePhpTaskValue} from "./php-wasm-task-wire.mjs";

/**
 * The ordinary PHP object stores actual zvals. At each call the existing
 * Zend object scope pins the leaves; the Wasm record holds only temporary
 * mirrors from that interpreter. No JS object is exposed to PHP as a field.
 *
 * @param layouts - Ordered record fields from the checked component ABI.
 * @param compiled - Installed standalone component with its own record constructors.
 * @param objects - Object domain private to this PHP interpreter.
 */
export const phpZendRecords = (layouts, compiled, objects) => {
	const records = new Map(layouts.map(r => [r.type, {...r, ctor: compiled.recordClass(r.type)}]));
	const flatten = (method, invoke) => {
		const rows = method.args.map(t => records.get(t));
		if(!rows.some(Boolean)) return {method, invoke};
		const args = method.args.flatMap((t, i) => rows[i]?.fields.map(f => f.type) ?? [t]);
		const call = (...flat) => {
			if(flat.length !== args.length) throw new TypeError("Invalid Zend record arguments");
			const temps = [];
			try
			{
				let offset = 0;
				return invoke(...rows.map(row => {
					if(!row) return flat[offset++];
					const fields = flat.slice(offset, offset += row.fields.length);
					const value = new row.ctor(...fields);
					temps.push(value);
					return value;
				}));
			} finally
			{for(const value of temps) value.dispose();}
		};
		return {method: {...method, args}, invoke: call};
	};
	const packet = (phase, type, row) => {
		const layout = records.get(type);
		if(!layout || phase !== "value" || !(row instanceof layout.ctor)) throw new TypeError("Invalid Zend record result");
		// Finish encoding before handing any field to Zend. A late copy failure
		// or foreign mirror cannot expose a valid prefix of an invalid row.
		let slots, remaining = scalarCopyLimit;
		try
		{
			slots = layout.fields.map(({name, type: kind}) => {
				const value = row[name];
				if(objects.has(kind)) return objects.key(kind, value);
				const [, bytes] = writePhpTaskValue(kind, value);
				const length = bytes.length / 4 * 3 - (bytes.endsWith("==") ? 2 : bytes.endsWith("=") ? 1 : 0);
				if(length > remaining) throw new RangeError("Zend record exceeds copy budget");
				remaining -= length;
				return bytes;
			});
		} finally
		{row.dispose();}
		const field = (i, kind) => {
			if(!slots || !Number.isSafeInteger(i) || !layout.fields[i] || layout.fields[i].type !== kind) return null;
			const value = slots[i]; slots[i] = null;
			return value;
		};
		return Object.freeze({form: () => phase, field, discard: () => { slots = null; }});
	};
	return {has: type => records.has(type), flatten, packet};
};
