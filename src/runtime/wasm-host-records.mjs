/** @file Keep application objects as JS identities and copied record fields as immutable snapshots. */
import {scalarCopyLimit, validateComponentScalar} from "../abi/component-scalars.mjs";

/**
 * Each component owns its constructors. No JS record stores a Wasm pointer,
 * token, session, or binding. Disposing it releases its references without
 * revoking another record or an object previously obtained from a getter.
 *
 * @param definitions - Record descriptors derived from the checked interface.
 */
export const wasmHostRecordTypes = definitions => {
	const types = new Map();
	for(const {type, name, fields} of definitions)
	{
		const values = new WeakMap();
		const read = row => {
			if(!values.has(row)) throw new TypeError("Closed or wrong " + name + " record");
			return values.get(row);
		};
		const copy = (kind, v) => {
			if(typeof kind === "number")
			{
				if(v === null || !["object", "function"].includes(typeof v)) throw new TypeError("Expected application object");
				return v; // The active binding checks the declared class before the native call.
			}
			validateComponentScalar(kind, v);
			if(kind !== "bytes") return v;
			if(v.byteLength > scalarCopyLimit) throw new RangeError("Record byte field exceeds copy budget");
			return new Uint8Array(v); // Buffer.slice() would keep a mutable alias.
		};
		/** An instance belongs to one component's public record type. */
		class RecordValue
		{
			/**
			 * Capture the fields in their declared order.
			 *
			 * @param args - Original objects or scalar values.
			 */
			constructor(...args)
			{
				if(args.length !== fields.length) throw new TypeError(name + " expects " + fields.length + " fields");
				values.set(this, fields.map((field, i) => copy(field.type, args[i])));
				Object.freeze(this);
			}
			/** Release this instance's references, without closing any other instance. */
			dispose() { return values.delete(this); }
		}
		Object.defineProperty(RecordValue, "name", {value: name});
		for(const [i, field] of fields.entries())
		{
			const descriptor = {
				/** Return the original object or a fresh copy of the byte field. */
				get() {
					const v = read(this)[i]; return field.type === "bytes" ? new Uint8Array(v) : v;
				}
			};
			Object.defineProperty(RecordValue.prototype, field.name, descriptor);
		}
		Object.freeze(RecordValue.prototype); Object.freeze(RecordValue);
		const adopt = decoded => {
			// Only the private decoder supplies this fresh array and its buffers.
			const row = Object.freeze(Object.create(RecordValue.prototype));
			values.set(row, decoded); return row;
		};
		types.set(type, {ctor: RecordValue, fields, read, adopt});
	}
	return types;
};
