/**
 * Alias-wrapped synthetic contracts for independent Zend ownership probes.
 *
 * @file
 */
import { zendListFaultIr } from "./php-wasm-list-faults.mjs";

/** Wrap every copied site and nested field while keeping the same target values. */
export const zendAliasFaultIr = () => {
	const ir = zendListFaultIr(), aliases = [], seen = new Map();
	const add = target => {
		const name = `Copied${aliases.length}`, id = `lean:Probe.${name}`;
		aliases.push({ ...structuredClone(ir.types[0]), id, name, kind: "alias"
			, fields: [], target
			, source: { ...ir.types[0].source, declaration: `Probe.${name}` } });
		return { kind: "named", id };
	};
	const wrap = ref => {
		const key = JSON.stringify(ref);
		if(seen.has(key)) return seen.get(key);
		const target = ref.kind === "apply" ? { ...ref, arguments: ref.arguments.map(wrap) } : ref;
		const result = add(target); seen.set(key, result); return result;
	};
	for(const type of ir.types) for(const field of type.fields) field.type = wrap(field.type);
	for(const fn of ir.declarations) for(const site of [...fn.parameters, fn.result]) site.type = wrap(site.type);
	const numbers = ir.declarations.find(fn => fn.name === "numbers");
	numbers.parameters[0].type = add(numbers.parameters[0].type);
	numbers.result.type = add(numbers.result.type);
	ir.types.push(...aliases);
	return ir;
};
