/**
 * Directional adapter identities for checked refinements inside owned values.
 * The erased carrier shape is shared; constructor choice remains per use site.
 *
 * @file
 */
import { canonicalizeJsonValue } from "../binding-ir/canonical.mjs";
import { sha256Text } from "../binding-ir/sha256.mjs";

const fail = message => { throw new TypeError(`Owned refinement model: ${message}`); };
const freeze = value => {
	if(value && typeof value === "object" && !Object.isFrozen(value))
	{
		Object.values(value).forEach(freeze); Object.freeze(value);
	}
	return value;
};
const digest = value => sha256Text(canonicalizeJsonValue(value));

const carrierShape = refinement => {
	if(refinement === null) return null;
	if(["fin", "subtype"].includes(refinement.kind)) return { kind: refinement.kind };
	if(refinement.kind === "checked-record") return {
		kind: refinement.kind, name: refinement.name
		, fields: refinement.fields?.map(field => ({ name: field.name
			, refinement: carrierShape(field.refinement) })) ?? null
	};
	if(refinement.kind === "record") return { kind: refinement.kind
		, name: refinement.name
		, fields: refinement.fields.map(field => ({
			name: field.name, refinement: carrierShape(field.refinement)
		}))
	};
	if(refinement.kind === "variant") return { kind: refinement.kind
		, name: refinement.name
		, cases: refinement.cases.map(branch => ({
			name: branch.name
			, fields: branch.fields.map(field => ({
				name: field.name, refinement: carrierShape(field.refinement)
			}))
		}))
	};
	return { kind: refinement.kind
		, arguments: refinement.arguments.map(carrierShape) };
};

/**
 * Compile authenticated declaration refinements into site-specific adapter IR.
 * Carrier identity deliberately excludes direction and constructor names, while
 * adapter identity includes both. Backends can therefore share storage without
 * sharing an input constructor or confusing construction with projection.
 *
 * @param model - Complete owned model declarations and finite type graph.
 */
export const compileOwnedRefinementModel = model => {
	const types = new Map(model.types.map(type => [type.id, type]));
	if(types.size !== model.types.length) fail("duplicate type identity");
	const visit = (typeId, refinement, direction, path, active = new Set()) => {
		if(refinement === null) return null;
		const type = types.get(typeId);
		if(!type) fail(`missing type ${typeId}`);
		if(type.kind === "alias")
		{
			if(active.has(type.id)) fail(`recursive alias ${type.id}`);
			return { kind: "alias", type: type.id
				, target: visit(type.target, refinement, direction, path
					, new Set([...active, type.id])) };
		}
		if(["fin", "subtype"].includes(refinement.kind))
		{
			if(type.kind !== "primitive") fail(`non-primitive ${refinement.kind} leaf`);
			return { kind: refinement.kind, type: type.id, path
				, operation: direction === "input" ? "construct" : "project"
				, ...(refinement.kind === "fin" ? { bound: refinement.bound }
					: { constructor: refinement.constructor }) };
		}
		if(refinement.kind === "checked-record")
		{
			if(type.kind !== "record") fail("checked-record transport mismatch");
			return { kind: refinement.kind, type: type.id, path
				, operation: direction === "input" ? "construct" : "project"
				, constructor: refinement.constructor
				, fields: refinement.fields?.map((field, index) => ({
					name: field.name
					, refinement: visit(type.fields[index].type, field.refinement
						, direction, [...path, { kind: "field", name: field.name }], active)
				})) ?? null };
		}
		if(refinement.kind === "record")
		{
			if(type.kind !== "record" || type.fields.length !== refinement.fields.length)
				fail("record transport mismatch");
			return { kind: refinement.kind, type: type.id, path
				, fields: refinement.fields.map((field, index) => ({
					name: field.name
					, refinement: visit(type.fields[index].type, field.refinement
						, direction, [...path, { kind: "field", name: field.name }], active)
				}))
			};
		}
		if(refinement.kind === "variant")
		{
			if(type.kind !== "variant" || type.cases.length !== refinement.cases.length)
				fail("variant transport mismatch");
			return { kind: refinement.kind, type: type.id, path
				, cases: refinement.cases.map((branch, branchIndex) => ({
					name: branch.name
					, fields: branch.fields.map((field, fieldIndex) => ({
						name: field.name
						, refinement: visit(type.cases[branchIndex].fields[fieldIndex].type
							, field.refinement, direction, [...path
								, { kind: "case", name: branch.name }
								, { kind: "field", name: field.name }], active)
					}))
				}))
			};
		}
		if(!["array", "host-null", "list", "option", "tuple", "result"].includes(refinement.kind)
			|| type.kind !== refinement.kind
			|| type.arguments.length !== refinement.arguments.length)
			fail(`${refinement.kind} transport mismatch`);
		return { kind: refinement.kind, type: type.id, path
			, arguments: refinement.arguments.map((child, index) => visit(
				type.arguments[index], child, direction
				, [...path, { kind: "argument", index }], active
			))
		};
	};
	const sites = [];
	for(const declaration of model.declarations)
	{
		if(declaration.refinements === undefined) continue;
		declaration.refinements.parameters.forEach((refinement, index) => {
			if(refinement === null) return;
			const type = declaration.parameters[index].type;
			const tree = visit(type, refinement, "input", []);
			const carrierKey = digest({ type, refinement: carrierShape(refinement) });
			const adapterKey = digest({ direction: "input", type, refinement });
			sites.push({ declaration: declaration.id
				, position: { kind: "parameter", index }
				, direction: "input", type, carrierKey, adapterKey, tree });
		});
		if(declaration.refinements.result !== null)
		{
			const refinement = declaration.refinements.result;
			const type = declaration.result.type;
			const tree = visit(type, refinement, "result", []);
			const carrierKey = digest({ type, refinement: carrierShape(refinement) });
			const adapterKey = digest({ direction: "result", type, refinement });
			sites.push({ declaration: declaration.id, position: { kind: "result" }
				, direction: "result", type, carrierKey, adapterKey, tree });
		}
	}
	const callbacks = model.types.filter(type => type.kind === "callback"
		&& type.callable.refinements !== undefined);
	for(const callback of callbacks)
	{
		const { direction, refinements } = callback.callable;
		if(!["host", "closure"].includes(direction))
			fail(`${callback.id} requires one checked callback direction`);
		const add = (refinement, type, position, produced) => {
			if(refinement === null) return;
			const adapterDirection = produced ? "result" : "input";
			const tree = visit(type, refinement, adapterDirection, []);
			const carrierKey = digest({ type
				, refinement: carrierShape(refinement) });
			const adapterKey = digest({ direction: adapterDirection
				, type, refinement });
			sites.push({ declaration: callback.id, position
				, direction: adapterDirection, type, carrierKey, adapterKey, tree });
		};
		callback.callable.parameters.forEach((parameter, index) => add(
			refinements.parameters[index], parameter.type
			, { kind: "parameter", index }, direction === "host"
		));
		add(refinements.result, callback.callable.result.type
			, { kind: "result" }, direction === "closure");
	}
	if(!sites.length) return null;
	return freeze({ schemaVersion: 1, kind: "owned-refinement-model", sites });
};
