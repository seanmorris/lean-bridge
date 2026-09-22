/**
 * Bounded recursive copied values over finite, immutable nominal type graphs.
 * Explicit work stacks keep host and wire recursion off the JavaScript stack.
 * Compiled export admission and native cleanup remain separate responsibilities.
 *
 * @file
 */
import { scalarSlotBytes, validateComponentScalar } from "../abi/component-scalars.mjs";
import { componentCopiedTags } from "../abi/component-copied.mjs";
import { compileComponentCopiedGraph, componentRecursiveLimits, createComponentRecursiveBudget, assertComponentRecursiveBudget } from "../abi/component-recursive.mjs";
import { readComponentScalarSlot, writeComponentScalarSlot } from "./component-scalar-codec.mjs";

const view = module => new DataView(module.HEAP8.buffer);
const span = (module, pointer, bytes, alignment = 8) => {
	if(!Number.isSafeInteger(pointer) || pointer < 0 || !Number.isSafeInteger(bytes) || bytes < 0
		|| (bytes && !pointer) || pointer % alignment || pointer + bytes > module.HEAP8.length)
		throw new RangeError("Invalid component recursive buffer");
};
const dataField = (value, key) => {
	const field = Object.getOwnPropertyDescriptor(value, key);
	if(!field || !Object.hasOwn(field, "value")) throw new TypeError("Copied values require own data fields");
	return field.value;
};
const record = (value, keys) => {
	if(!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError("Expected a copied tagged value");
	const own = Reflect.ownKeys(value);
	if(own.length !== keys.length || own.some(key => !keys.includes(key))) throw new TypeError("Invalid copied value fields");
	for(const key of keys) dataField(value, key);
};
const payloadBytes = (type, value, budget) => {
	if(type === "bytes") budget.charge(value.byteLength);
	else if(type === "string")
	{
		// Charge before TextEncoder allocates. Scalar validation checked Unicode.
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
const kindOf = type => ["record", "variant"].includes(type.kind) ? type.kind : type.constructor;
const sequence = kind => ["array", "list", "tuple"].includes(kind);
const layout = (type, kind, branch) => {
	const fields = kind === "record" ? type.fields : kind === "variant" ? type.cases[branch].fields : null;
	if(fields) return { count: fields.length, key: index => fields[index].name, type: index => fields[index].type };
	if(kind === "array" || kind === "list") return { count: null, key: index => index, type: () => type.arguments[0] };
	if(kind === "tuple") return { count: type.arguments.length, key: index => index, type: index => type.arguments[index] };
	if(kind === "option") return { count: branch, key: () => "value", type: () => type.arguments[0] };
	return { count: 1, key: () => branch ? "error" : "ok", type: () => type.arguments[branch] };
};
const depthCheck = depth => {
	if(depth > componentRecursiveLimits.valueDepth) throw new RangeError("Component recursive value depth exceeded");
};

/**
 * Compile a finite descriptor graph. Repeated host objects are copied separately;
 * ancestor cycles are rejected. The caller owns every allocation, even on error.
 *
 * @param descriptor - Version one copied graph, not an installed component ABI.
 */
export const compileComponentRecursiveCodec = descriptor => {
	const { graph, resolve } = compileComponentCopiedGraph(descriptor);
	const write = (module, slot, input, allocate, budget = createComponentRecursiveBudget()) => {
		assertComponentRecursiveBudget(budget);
		budget.reserve(1); budget.charge(scalarSlotBytes);
		const active = new Set(), stack = [{ type: graph.root, slot, value: input, depth: 0 }];
		while(stack.length)
		{
			const frame = stack.at(-1);
			if(!frame.children)
			{
				depthCheck(frame.depth); span(module, frame.slot, scalarSlotBytes);
				const type = resolve(frame.type), value = frame.value;
				if(type.kind === "primitive")
				{
					validateComponentScalar(type.name, value); payloadBytes(type.name, value, budget);
					writeComponentScalarSlot(module, frame.slot, type.name, value, bytes => {
						const pointer = allocate(bytes);
						span(module, pointer, bytes, ["nat", "int"].includes(type.name) ? 4 : 1);
						return pointer;
					});
					stack.pop(); continue;
				}
				if(!value || typeof value !== "object") throw new TypeError("Expected a recursive copied value");
				if(active.has(value)) throw new TypeError("Cyclic copied value");
				const kind = kindOf(type);
				let branch = 0;
				if(kind === "variant")
				{
					const tag = dataField(value, "kind");
					branch = type.cases.findIndex(item => item.name === tag);
					if(branch < 0) throw new TypeError("Invalid variant constructor");
				}
				else if(kind === "option")
				{
					const tag = dataField(value, "tag");
					if(tag !== "none" && tag !== "some") throw new TypeError("Invalid Option tag");
					branch = tag === "some" ? 1 : 0;
				}
				else if(kind === "result") branch = Object.hasOwn(value, "error") ? 1 : 0;
				const children = layout(type, kind, branch);
				if(sequence(kind) && !Array.isArray(value)) throw new TypeError("Expected a copied array or tuple");
				const count = children.count ?? value.length;
				budget.reserve(count); budget.charge(count * scalarSlotBytes);
				if(sequence(kind))
				{
					if(value.length !== count) throw new TypeError("Tuple length mismatch");
					if(Reflect.ownKeys(value).length !== count + 1) throw new TypeError("Copied arrays must be dense and have no extra fields");
				}
				else record(value, [...(kind === "variant" ? ["kind"] : kind === "option" ? ["tag"] : []), ...Array.from({ length: count }, (_, index) => children.key(index))]);
				const pointer = count ? allocate(count * scalarSlotBytes) : 0;
				span(module, pointer, count * scalarSlotBytes);
				// The allocator may grow memory. Take a fresh view after every allocation.
				const data = view(module);
				data.setUint32(frame.slot, componentCopiedTags[kind], true);
				data.setUint32(frame.slot + 4, kind === "variant" ? branch * 4 : branch, true);
				data.setUint32(frame.slot + 8, pointer, true); data.setUint32(frame.slot + 12, count, true);
				Object.assign(frame, { children, pointer, count, index: 0 }); active.add(value);
			}
			if(frame.index === frame.count)
			{ active.delete(frame.value); stack.pop(); continue; }
			const index = frame.index++;
			stack.push({
				type: frame.children.type(index)
				, slot: frame.pointer + index * scalarSlotBytes
				, value: dataField(frame.value, frame.children.key(index))
				, depth: frame.depth + 1 });
		}
	};
	const read = (module, slot, budget = createComponentRecursiveBudget()) => {
		assertComponentRecursiveBudget(budget);
		budget.reserve(1); budget.charge(scalarSlotBytes);
		const result = {}, active = new Set(), stack = [{ type: graph.root, slot, depth: 0, owner: result, key: "value" }];
		while(stack.length)
		{
			const frame = stack.at(-1);
			if(!frame.children)
			{
				depthCheck(frame.depth); span(module, frame.slot, scalarSlotBytes);
				if(active.has(frame.slot)) throw new TypeError("Cyclic copied wire value");
				const type = resolve(frame.type);
				if(type.kind === "primitive")
				{
					frame.owner[frame.key] = readComponentScalarSlot(module, frame.slot, type.name, budget.charge);
					stack.pop(); continue;
				}
				const kind = kindOf(type), data = view(module);
				if(data.getUint32(frame.slot, true) !== componentCopiedTags[kind]) throw new TypeError("Component copied type mismatch");
				const flags = data.getUint32(frame.slot + 4, true), branch = kind === "variant" ? flags >>> 2 : flags & 1;
				if(kind === "variant" ? (flags & 1) || branch >= type.cases.length : flags & ~(["option", "result"].includes(kind) ? 3 : 2)) throw new TypeError("Invalid component copied flags");
				const pointer = data.getUint32(frame.slot + 8, true), count = data.getUint32(frame.slot + 12, true), children = layout(type, kind, branch);
				if(children.count !== null && count !== children.count || !count && (pointer || flags & 2)) throw new TypeError("Invalid component copied shape");
				span(module, pointer, count * scalarSlotBytes);
				budget.reserve(count); budget.charge(count * scalarSlotBytes);
				// Reserve all immediate children before allocating their host container.
				const value = sequence(kind) ? new Array(count) : kind === "option" ? { tag: branch ? "some" : "none" }
					: kind === "variant" ? { kind: type.cases[branch].name } : {};
				frame.owner[frame.key] = value;
				Object.assign(frame, { children, pointer, count, value, index: 0 }); active.add(frame.slot);
			}
			if(frame.index === frame.count)
			{ active.delete(frame.slot); stack.pop(); continue; }
			const index = frame.index++;
			stack.push({
				type: frame.children.type(index)
				, slot: frame.pointer + index * scalarSlotBytes
				, depth: frame.depth + 1
				, owner: frame.value
				, key: frame.children.key(index) });
		}
		return result.value;
	};
	return Object.freeze({ graph, write, read });
};
