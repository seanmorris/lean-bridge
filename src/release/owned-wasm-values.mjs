/**
 * Iterative host projection for compiler-checked wasm32 owned-value layouts.
 * The enclosing call owns all allocations and provisional identity leases,
 * including those created before a later field fails validation.
 *
 * @file
 */
import { assertOwnedWasmSpan, readOwnedWasmScalar, writeOwnedWasmScalar } from "./owned-wasm-scalars.mjs";

export const ownedWasmValueLimits = Object.freeze({ depth: 128, visits: 262144, bytes: 16777216, retained: 4096 });
const budgets = new WeakSet();
const invalid = message => { throw new TypeError(`Owned wasm32 values: ${message}`); };
const view = module => new DataView(module.HEAP8.buffer);
const dataField = (value, key) => {
	const field = value && Object.getOwnPropertyDescriptor(value, key);
	if(!field || !Object.hasOwn(field, "value")) invalid("expected an own data field");
	return field.value;
};
const record = (value, keys) => {
	if(!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
		invalid("expected a plain record or tagged value");
	const own = Reflect.ownKeys(value);
	if(own.length !== keys.length || own.some(key => !keys.includes(key))) invalid("unexpected or missing fields");
	for(const key of keys) dataField(value, key);
};
const sequence = (value, count) => {
	if(!Array.isArray(value) || dataField(value, "length") !== count) invalid("expected an array with the declared length");
	if(Reflect.ownKeys(value).length !== count + 1) invalid("arrays must be dense and have no extra fields");
};
const put = (owner, key, value) => Object.defineProperty(owner, key, {
	value, enumerable: true, writable: true, configurable: true
});

/**
 * Share one bounded budget across all arguments and callback frames of a call.
 * Tests or callers may lower a limit, but cannot widen the transport contract.
 *
 * @param limits - Optional stricter limits.
 */
export const createOwnedWasmValueBudget = (limits = ownedWasmValueLimits) => {
	const remaining = { ...ownedWasmValueLimits, ...limits };
	for(const [key, limit] of Object.entries(remaining))
		if(!Object.hasOwn(ownedWasmValueLimits, key) || !Number.isSafeInteger(limit) || limit < 0 || limit > ownedWasmValueLimits[key])
			invalid("invalid conversion limits");
	const take = (key, count) => {
		if(!Number.isSafeInteger(count) || count < 0 || count > remaining[key])
			throw new RangeError(`Owned wasm32 ${key} budget exceeded`);
		remaining[key] -= count;
	};
	const budget = Object.freeze({
		reserve: count => take("visits", count), charge: count => take("bytes", count)
		, retain: () => take("retained", 1)
		, depth: depth => {
			if(depth > remaining.depth) throw new RangeError("Owned wasm32 depth limit exceeded");
		}
	});
	budgets.add(budget); return budget;
};

/**
 * Bind value walkers to a private snapshot of an authenticated generated layout.
 * This is not backend admission or an ownership registry. The private controls
 * authenticate resource/closure handles, track allocations, and roll back leases.
 * Output claims must authenticate complete native allocations, not just bounds.
 *
 * @param layout - Compiler-checked wasm32 layout from the component build.
 */
export const createOwnedWasmValueCodec = layout => {
	if(layout?.schemaVersion !== 1 || layout.kind !== "owned-javascript-wasm32-layout" || layout.native?.wordBits !== 32)
		invalid("expected the compiler-checked wasm32 layout");
	for(const [key, limit] of Object.entries(ownedWasmValueLimits))
		if(layout.native.model.limits[key] !== limit) invalid("layout conversion limits differ from the transport");
	const types = new Map(structuredClone(layout.types).map(type => [type.id, type]));
	for(const alias of layout.native.aliases) types.set(alias.id, types.get(alias.target));
	const typeOf = id => types.get(id) ?? invalid("unknown layout type");
	for(const type of types.values())
		if(type.kind === "variant" && type.cases.some(branch => branch.fields.some(field => field.sourceName === "kind")))
			invalid("variant payload fields cannot use the discriminator name kind");
	const start = (id, budget) => {
		if(!budgets.has(budget)) invalid("expected a bounded call budget");
		const type = typeOf(id); budget.reserve(1); budget.charge(type.size); return type;
	};
	const tokenValue = token => {
		if(typeof token !== "bigint" || token <= 0n || token > 0xffffffffffffffffn) invalid("invalid private identity token");
		return token;
	};
	const fieldsFor = (type, branch) => type.kind === "variant" ? type.cases[branch].fields
		: type.kind === "option" ? branch ? type.fields : []
			: type.kind === "result" ? [type.fields[branch]] : type.fields;
	const keyFor = (type, field, index, branch) => type.kind === "tuple" ? index
		: type.kind === "option" ? "value" : type.kind === "result" ? branch ? "error" : "ok" : field.sourceName;
	const write = (module, id, pointer, input, controls, budget = createOwnedWasmValueBudget()) => {
		const root = start(id, budget), active = new Set();
		const stack = [{ type: root, pointer, value: input, depth: 0 }];
		const allocate = (bytes, alignment) => {
			budget.charge(bytes); const address = bytes ? controls.allocate(bytes) : 0;
			assertOwnedWasmSpan(module, address, bytes, alignment); return address;
		};
		while(stack.length)
		{
			const frame = stack.at(-1), { type, pointer, value, depth } = frame;
			if(frame.index === undefined)
			{
				budget.depth(depth); assertOwnedWasmSpan(module, pointer, type.size, type.alignment);
				module.HEAP8.fill(0, pointer, pointer + type.size);
				if(type.kind === "primitive")
				{
					writeOwnedWasmScalar(module, pointer, type.name, value, { charge: budget.charge, allocate: controls.allocate });
					stack.pop(); continue;
				}
				if(type.kind === "resource" || type.kind === "callback")
				{
					budget.retain();
					const token = tokenValue(controls.toToken(type, value));
					view(module).setBigUint64(pointer, token, true); stack.pop(); continue;
				}
				if(!value || typeof value !== "object") invalid("expected an aggregate value");
				if(active.has(value)) invalid("cyclic input value");
				let branch = 0;
				if(type.kind === "option")
				{
					const tag = dataField(value, "tag");
					if(tag !== "none" && tag !== "some") invalid("invalid Option tag");
					branch = tag === "some" ? 1 : 0;
				}
				else if(type.kind === "result") branch = Object.hasOwn(value, "error") ? 1 : 0;
				else if(type.kind === "variant")
				{
					const kind = dataField(value, "kind"); branch = type.cases.findIndex(item => item.sourceName === kind);
					if(branch < 0) invalid("invalid variant constructor");
				}
				const fields = fieldsFor(type, branch), count = type.element ? dataField(value, "length") : fields.length;
				budget.reserve(count);
				if(type.element || type.kind === "tuple") sequence(value, count);
				else record(value, [...type.kind === "variant" ? ["kind"] : type.kind === "option" ? ["tag"] : []
					, ...fields.map((field, index) => keyFor(type, field, index, branch))]);
				let data = 0;
				if(type.element)
				{
					data = allocate(count * type.elementSize, typeOf(type.element).alignment);
					view(module).setUint32(pointer, data, true); view(module).setUint32(pointer + 4, count, true);
				}
				else if(type.kind === "variant") view(module).setUint32(pointer, branch, true);
				else if(["option", "result"].includes(type.kind)) view(module).setUint8(pointer, branch);
				Object.assign(frame, { fields, count, data, branch, index: 0 }); active.add(value);
			}
			if(frame.index === frame.count)
			{ active.delete(value); stack.pop(); continue; }
			const index = frame.index++, field = frame.fields[index];
			const child = typeOf(type.element ?? field.type);
			let address = type.element ? frame.data + index * type.elementSize : pointer + field.offset;
			if(!type.element && field.pointer)
			{
				const target = allocate(child.size, child.alignment);
				view(module).setUint32(address, target, true); address = target;
			}
			const key = type.element ? index : keyFor(type, field, index, frame.branch);
			stack.push({ type: child, pointer: address, value: dataField(value, key), depth: depth + 1 });
		}
	};
	const read = (module, id, pointer, controls, budget = createOwnedWasmValueBudget()) => {
		if(typeof controls.claim !== "function") invalid("output requires native allocation claims");
		const root = start(id, budget), result = {}, active = new Set();
		const stack = [{ type: root, pointer, depth: 0, owner: result, key: "value" }];
		const claim = (address, bytes, alignment) => {
			budget.charge(bytes); assertOwnedWasmSpan(module, address, bytes, alignment);
			if(bytes) controls.claim(address, bytes);
			assertOwnedWasmSpan(module, address, bytes, alignment);
		};
		while(stack.length)
		{
			const frame = stack.at(-1), { type, pointer, depth } = frame;
			if(frame.index === undefined)
			{
				budget.depth(depth); assertOwnedWasmSpan(module, pointer, type.size, type.alignment);
				if(type.kind === "primitive")
				{
					put(frame.owner, frame.key, readOwnedWasmScalar(module, pointer, type.name, { charge: budget.charge, claim: controls.claim }));
					stack.pop(); continue;
				}
				if(type.kind === "resource" || type.kind === "callback")
				{
					budget.retain();
					const token = tokenValue(view(module).getBigUint64(pointer, true));
					put(frame.owner, frame.key, controls.fromToken(type, token)); stack.pop(); continue;
				}
				const identity = `${type.id}@${pointer}`;
				if(active.has(identity)) invalid("cyclic output value");
				const branch = type.kind === "variant" ? view(module).getUint32(pointer, true)
					: ["option", "result"].includes(type.kind) ? view(module).getUint8(pointer) : 0;
				if(type.kind === "variant" ? branch >= type.cases.length : branch > 1) invalid("invalid output tag");
				const fields = fieldsFor(type, branch), count = type.element ? view(module).getUint32(pointer + 4, true) : fields.length;
				budget.reserve(count);
				const data = type.element ? view(module).getUint32(pointer, true) : 0;
				if(type.element)
				{
					if(!count && data) invalid("noncanonical empty sequence");
					claim(data, count * type.elementSize, typeOf(type.element).alignment);
				}
				const value = type.element || type.kind === "tuple" ? new Array(count)
					: type.kind === "option" ? { tag: branch ? "some" : "none" }
						: type.kind === "variant" ? { kind: type.cases[branch].sourceName } : {};
				put(frame.owner, frame.key, value);
				Object.assign(frame, { fields, count, data, branch, identity, value, index: 0 }); active.add(identity);
			}
			if(frame.index === frame.count)
			{ active.delete(frame.identity); stack.pop(); continue; }
			const index = frame.index++, field = frame.fields[index];
			const child = typeOf(type.element ?? field.type);
			let address = type.element ? frame.data + index * type.elementSize : pointer + field.offset;
			if(!type.element && field.pointer)
			{
				address = view(module).getUint32(address, true); claim(address, child.size, child.alignment);
			}
			stack.push({ type: child, pointer: address, depth: depth + 1
				, owner: frame.value
				, key: type.element ? index : keyFor(type, field, index, frame.branch) });
		}
		return result.value;
	};
	return Object.freeze({ write, read });
};
