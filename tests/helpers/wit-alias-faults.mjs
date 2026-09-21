/**
 * Alias-wrapped synthetic conversion probe, separate from compiled Lean evidence.
 *
 * @file
 */
import { nativeAliasReviewedIr } from "./native-alias-fixture.mjs";
import { witListFaultIr } from "./wit-list-faults.mjs";

/** Wrap every copied level and both public sites, including two alias chains. */
export const witAliasFaultIr = () => {
	const ir = witListFaultIr(), aliases = [], seen = new Map();
	const template = nativeAliasReviewedIr().types.find(type => type.kind === "alias");
	const add = target => {
		const name = `Copied${aliases.length}`, id = `lean:Probe.${name}`;
		aliases.push({ ...structuredClone(template), id, name, target
			, source: { producer: ir.producers[0].id, declaration: `Probe.${name}`, extensions: {} } });
		return { kind: "named", id };
	};
	const wrap = ref => {
		const key = JSON.stringify(ref);
		if(seen.has(key)) return seen.get(key);
		const target = ref.kind === "apply" ? { ...ref, arguments: ref.arguments.map(wrap) } : ref;
		const result = add(target); seen.set(key, result); return result;
	};
	for(const fn of ir.declarations) for(const site of [...fn.parameters, fn.result]) site.type = add(wrap(site.type));
	ir.types.push(...aliases);
	return ir;
};
