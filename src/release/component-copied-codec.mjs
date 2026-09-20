/**
 * Recursive copied slots, reusing the installed primitive wire codecs.
 * Arrays and Lists share sequence slots; records, tuples, Option and Except compose.
 *
 * @file
 */
import { scalarSlotBytes, validateComponentScalar } from "../abi/component-scalars.mjs";
import { componentCopiedTags, snapshotComponentCopiedType, createComponentCopyBudget } from "../abi/component-copied.mjs";
import { readComponentScalarSlot, writeComponentScalarSlot } from "./component-scalar-codec.mjs";

const view = module => new DataView(module.HEAP8.buffer);
const span = (module, pointer, bytes, alignment = 8) => {
	if(!Number.isSafeInteger(pointer) || pointer < 0 || !Number.isSafeInteger(bytes) || bytes < 0
		|| (bytes && !pointer) || pointer % alignment || pointer + bytes > module.HEAP8.length)
		throw new RangeError("Invalid component copied buffer");
};
const dataField = (value, key) => {
	const field = Object.getOwnPropertyDescriptor(value, key);
	if(!field || !Object.hasOwn(field, "value")) throw new TypeError("Copied values require own data fields");
	return field.value;
};
const record = (value, keys) => {
	if(!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
		throw new TypeError("Expected a copied tagged value");
	const own = Reflect.ownKeys(value);
	if(own.length !== keys.length || own.some(key => !keys.includes(key))) throw new TypeError("Invalid copied value fields");
	return keys.map(key => dataField(value, key));
};
const payloadBytes = (type, value, budget) => {
	if(type === "bytes") budget.charge(value.byteLength);
	else if(type === "string")
	{
		// Charge before TextEncoder allocates. Unicode validation already ran.
		budget.charge(value.length);
		for(const character of value)
		{
			const point = character.codePointAt(0);
			if(point >= 128) budget.charge(point < 2048 ? 1 : 2);
		}
	}
	else if(type === "nat" || type === "int")
	{
		const magnitude = value < 0n ? -value : value;
		budget.charge(magnitude === 0n ? 0 : Math.ceil(magnitude.toString(16).length / 8) * 4);
	}
};

/**
 * Compile a descriptor once and keep a private immutable snapshot.
 * Allocations belong to the caller's arena, including on validation failure.
 *
 * @param descriptor - Primitive or bounded array/tuple/Option/Except type tree.
 */
export const compileComponentCopiedCodec = descriptor => {
	const type = snapshotComponentCopiedType(descriptor);
	const write = (module, slot, input, allocate, budget = createComponentCopyBudget()) => {
		const active = new Set();
		const visit = (type, slot, value) => {
			span(module, slot, scalarSlotBytes);
			if(type.kind === "primitive")
			{
				validateComponentScalar(type.name, value);
				payloadBytes(type.name, value, budget);
				writeComponentScalarSlot(module, slot, type.name, value, bytes => {
					const pointer = allocate(bytes);
					span(module, pointer, bytes, ["nat", "int"].includes(type.name) ? 4 : 1);
					return pointer;
				});
				return;
			}
			if(active.has(value)) throw new TypeError("Cyclic copied value");
			active.add(value);
			try
			{
				const kind = type.kind === "record" ? "record" : type.constructor;
				let count, branch = 0, childValue, childType;
				if(kind === "record")
				{
					count = type.fields.length;
					budget.charge(count * scalarSlotBytes);
					const values = record(value, type.fields.map(field => field.name));
					childValue = index => values[index]; childType = index => type.fields[index].type;
				}
				else if(kind === "array" || kind === "list" || kind === "tuple")
				{
					if(!Array.isArray(value)) throw new TypeError("Expected a copied array or tuple");
					count = value.length;
					if(kind === "tuple" && count !== type.arguments.length) throw new TypeError("Tuple length mismatch");
					// Bound the allocation before inspecting a potentially large array.
					budget.charge(count * scalarSlotBytes);
					if(Reflect.ownKeys(value).length !== count + 1) throw new TypeError("Copied arrays must be dense and have no extra fields");
					childValue = index => dataField(value, index);
					childType = index => type.arguments[kind === "tuple" ? index : 0];
				}
				else if(kind === "option")
				{
					if(!value || typeof value !== "object") throw new TypeError("Expected a tagged Option");
					const tag = dataField(value, "tag");
					if(tag !== "none" && tag !== "some") throw new TypeError("Invalid Option tag");
					const values = record(value, tag === "none" ? ["tag"] : ["tag", "value"]);
					count = branch = tag === "some" ? 1 : 0;
					childValue = () => values[1]; childType = () => type.arguments[0];
					budget.charge(count * scalarSlotBytes);
				}
				else
				{
					if(!value || typeof value !== "object") throw new TypeError("Expected a tagged result");
					branch = Object.hasOwn(value, "error") ? 1 : 0;
					const values = record(value, [branch ? "error" : "ok"]);
					count = 1; childValue = () => values[0]; childType = () => type.arguments[branch];
					budget.charge(scalarSlotBytes);
				}
				const bytes = count * scalarSlotBytes, pointer = count ? allocate(bytes) : 0;
				span(module, pointer, bytes);
				// Allocation can grow memory. Never retain a DataView across it.
				view(module).setUint32(slot, componentCopiedTags[kind], true);
				view(module).setUint32(slot + 4, branch, true);
				view(module).setUint32(slot + 8, pointer, true);
				view(module).setUint32(slot + 12, count, true);
				for(let index = 0; index < count; index++) visit(childType(index), pointer + index * scalarSlotBytes, childValue(index));
			} finally
			{ active.delete(value); }
		};
		budget.charge(scalarSlotBytes);
		visit(type, slot, input);
	};
	const read = (module, slot, budget = createComponentCopyBudget()) => {
		const active = new Set();
		const visit = (type, slot) => {
			span(module, slot, scalarSlotBytes);
			if(active.has(slot)) throw new TypeError("Cyclic copied wire value");
			if(type.kind === "primitive") return readComponentScalarSlot(module, slot, type.name, budget.charge);
			active.add(slot);
			try
			{
				const data = view(module), kind = type.kind === "record" ? "record" : type.constructor;
				if(data.getUint32(slot, true) !== componentCopiedTags[kind]) throw new TypeError("Component copied type mismatch");
				const flags = data.getUint32(slot + 4, true), branch = flags & 1;
				const pointer = data.getUint32(slot + 8, true), count = data.getUint32(slot + 12, true);
				if(flags & ~(kind === "option" || kind === "result" ? 3 : 2)) throw new TypeError("Invalid component copied flags");
				if((kind === "record" && count !== type.fields.length) || (kind === "tuple" && count !== type.arguments.length)
					|| (kind === "option" && count !== branch) || (kind === "result" && count !== 1)
					|| (!count && (pointer || (flags & 2)))) throw new TypeError("Invalid component copied shape");
				const bytes = count * scalarSlotBytes;
				span(module, pointer, bytes); budget.charge(bytes);
				if(kind === "option") return branch ? { tag: "some", value: visit(type.arguments[0], pointer) } : { tag: "none" };
				if(kind === "result") return { [branch ? "error" : "ok"]: visit(type.arguments[branch], pointer) };
				if(kind === "record") return Object.fromEntries(type.fields.map((field, index) => [field.name, visit(field.type, pointer + index * scalarSlotBytes)]));
				const values = new Array(count);
				for(let index = 0; index < count; index++) values[index] = visit(type.arguments[kind === "tuple" ? index : 0], pointer + index * scalarSlotBytes);
				return values;
			} finally
			{ active.delete(slot); }
		};
		budget.charge(scalarSlotBytes);
		return visit(type, slot);
	};
	return Object.freeze({ type, write, read });
};
