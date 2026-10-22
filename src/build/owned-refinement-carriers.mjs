/**
 * Erased Lean mirrors and per-use checked conversions for owned values.
 * Mirrors share storage; constructors remain attached to declaration sites.
 *
 * @file
 */
import { sha256 } from "../capsule/node.mjs";

const fail = message => { throw Object.assign(new TypeError(`Owned refinement carriers: ${message}`), {
	code: "owned-refinement-carriers"
}); };
const primitiveNames = { unit: "Unit", bool: "Bool", char: "Char"
	, nat: "Nat", int: "Int", uint8: "UInt8", uint16: "UInt16"
	, uint32: "UInt32", uint64: "UInt64", int8: "Int8", int16: "Int16"
	, int32: "Int32", int64: "Int64", usize: "USize", isize: "ISize"
	, float32: "Float32", float64: "Float", string: "String", bytes: "ByteArray" };

const children = tree => tree === null ? []
	: tree.kind === "alias" ? [tree.target]
		: tree.kind === "variant" ? tree.cases.flatMap(branch => branch.fields.map(field => field.refinement))
			: ["record", "checked-record"].includes(tree.kind) ? tree.fields?.map(field => field.refinement) ?? []
				: tree.arguments ?? [];

/**
 * Build the private mirror declarations and site-specific conversions used by
 * owned carrier generation. This layer deliberately has no host projection.
 *
 * @param model - Validated owned aggregate model with directional refinement sites.
 * @param definitions - Public Binding IR definitions keyed by identity.
 */
export const createOwnedRefinementCarriers = (model, definitions) => {
	if(model.refinementModel === undefined) return null;
	const nodes = new Map(model.types.map(type => [type.id, type]));
	const sites = model.refinementModel.sites;
	const mirrors = new Set();
	const collect = tree => {
		if(tree === null) return;
		if(["record", "variant", "checked-record"].includes(tree.kind)) mirrors.add(tree.type);
		children(tree).forEach(collect);
	};
	sites.forEach(site => collect(site.tree));
	const sourceName = id => {
		const definition = definitions.get(id);
		if(!definition?.source?.declaration) fail(`missing source declaration for ${id}`);
		return definition.source.declaration;
	};
	const sourceValueType = (id, active = new Set()) => {
		if(active.has(id)) fail(`recursive callable type ${id}`);
		const node = nodes.get(id);
		if(!node) fail(`missing type ${id}`);
		if(node.kind === "primitive") return `_root_.${primitiveNames[node.name]}`;
		if(node.kind === "callback")
		{
			const seen = new Set([...active, id]);
			return `(${[...node.callable.parameters, node.callable.result]
				.map(site => sourceValueType(site.type, seen)).join(" → ")})`;
		}
		if(definitions.has(id)) return `_root_.${sourceName(id)}`;
		const values = node.arguments.map(child => sourceValueType(child, active));
		if(node.kind === "result")
			return `(_root_.Except ${values[1]} ${values[0]})`;
		return `(_root_.${{ array: "Array", list: "List", option: "Option"
			, tuple: "Prod" }[node.kind]} ${values.join(" ")})`;
	};
	const sourceType = (id, active = new Set()) => {
		if(active.has(id)) fail(`recursive callable type ${id}`);
		const node = nodes.get(id);
		if(!node) fail(`missing type ${id}`);
		if(node.kind === "primitive") return `_root_.${primitiveNames[node.name]}`;
		if(node.kind === "alias") return sourceType(node.target, new Set([...active, id]));
		if(mirrors.has(id)) return `LbOwnedErased.${sourceName(id)}`;
		if(node.kind === "callback") return sourceValueType(id, active);
		if(["record", "variant", "resource"].includes(node.kind)) return `_root_.${sourceName(id)}`;
		const values = node.arguments.map(child => sourceType(child, active));
		if(node.kind === "result") return `(_root_.Except ${values[1]} ${values[0]})`;
		return `(_root_.${{ array: "Array", list: "List", option: "Option", tuple: "Prod" }[node.kind]} ${values.join(" ")})`;
	};
	const reachesMirror = (id, active = new Set()) => {
		if(mirrors.has(id)) return true;
		if(active.has(id)) return false;
		const node = nodes.get(id), seen = new Set([...active, id]);
		if(node.kind === "alias") return reachesMirror(node.target, seen);
		if(node.arguments) return node.arguments.some(child => reachesMirror(child, seen));
		if(node.fields) return node.fields.some(field => reachesMirror(field.type, seen));
		if(node.cases) return node.cases.some(branch => branch.fields.some(field => reachesMirror(field.type, seen)));
		if(node.callable) return [...node.callable.parameters, node.callable.result].some(site => reachesMirror(site.type, seen));
		return false;
	};
	const siteKey = (declaration, kind, index = -1) => `${declaration}\0${kind}\0${index}`;
	const byPosition = new Map(sites.map(site => {
		const index = site.position.kind === "parameter" ? site.position.index : -1;
		return [siteKey(site.declaration, site.position.kind, index), site];
	}));
	for(const declaration of model.declarations)
	{
		if(declaration.receiver && reachesMirror(declaration.receiver.type))
			fail(`${declaration.id} has a refined receiver without an authenticated receiver adapter`);
		declaration.parameters.forEach((parameter, index) => {
			if(nodes.get(parameter.type)?.kind !== "callback"
				&& reachesMirror(parameter.type)
				&& !byPosition.has(siteKey(declaration.id, "parameter", index)))
				fail(`${declaration.id} parameter ${index} is missing its per-use refinement`);
		});
		if(nodes.get(declaration.result.type)?.kind !== "callback"
			&& reachesMirror(declaration.result.type)
			&& !byPosition.has(siteKey(declaration.id, "result")))
			fail(`${declaration.id} result is missing its per-use refinement`);
	}
	for(const node of model.types.filter(type => type.kind === "callback"))
	{
		node.callable.parameters.forEach((parameter, index) => {
			if(reachesMirror(parameter.type)
				&& !byPosition.has(siteKey(node.id, "parameter", index)))
				fail(`${node.id} parameter ${index} requires a directional callback refinement adapter`);
		});
		if(reachesMirror(node.callable.result.type)
			&& !byPosition.has(siteKey(node.id, "result")))
			fail(`${node.id} result requires a directional callback refinement adapter`);
	}

	const dependencyOrder = [], done = new Set(), active = new Set();
	const visit = id => {
		if(done.has(id) || !mirrors.has(id)) return;
		if(active.has(id)) fail(`recursive mirrored definition ${id} requires the recursive owned carrier ABI`);
		active.add(id);
		const node = nodes.get(id);
		const members = node.kind === "record" ? node.fields
			: node.kind === "variant" ? node.cases.flatMap(branch => branch.fields) : [];
		members.forEach(field => {
			const child = nodes.get(field.type);
			if(child?.kind === "alias") visit(child.target); else visit(field.type);
		});
		active.delete(id); done.add(id); dependencyOrder.push(id);
	};
	[...mirrors].sort().forEach(visit);
	const lines = [];
	for(const id of dependencyOrder)
	{
		const node = nodes.get(id), name = `LbOwnedErased.${sourceName(id)}`;
		if(node.kind === "record" || node.kind === "checked-record") lines.push(`structure ${name} where`
			, ...node.fields.map(field => `  «${field.name}» : ${sourceType(field.type)}`), "");
		else if(node.kind === "variant") lines.push(`inductive ${name} where`
			, ...node.cases.map(branch => `  | «${branch.name}» ${branch.fields.map((field, index) => `(a${index} : ${sourceType(field.type)})`).join(" ")} : ${name}`), "");
		else fail(`${id} is not a nominal mirror`);
	}

	const inputConversion = (tree, value, depth = 0) => {
		if(tree === null) return `(_root_.Option.some (${value}))`;
		if(tree.kind === "alias") return inputConversion(tree.target, value, depth);
		const input = `(${value})`, name = `_ownedValue${depth}`;
		if(tree.kind === "fin") return `(if proof : ${input} < ${tree.bound} then _root_.Option.some (⟨${input}, proof⟩ : _root_.Fin ${tree.bound}) else _root_.Option.none)`;
		if(tree.kind === "subtype") return `_root_.${tree.constructor} ${input}`;
		if(tree.kind === "record" || tree.kind === "checked-record")
		{
			const fields = tree.fields ?? [];
			const names = fields.map((_, index) => `a${depth}_${index}`);
			const bindings = fields.map((field, index) => `let ${names[index]} ← ${inputConversion(field.refinement, `${input}.«${field.name}»`, depth + 1)};`).join(" ");
			if(tree.kind === "checked-record") return `(do ${bindings} _root_.${tree.constructor} ${names.join(" ")})`;
			return `(do ${bindings} pure (({ ${fields.map((field, index) => `«${field.name}» := ${names[index]}`).join(", ")} } : _root_.${sourceName(tree.type)})))`;
		}
		if(tree.kind === "variant") return `(match ${input} with ${tree.cases.map(branch => {
			const names = branch.fields.map((_, index) => `a${depth}_${index}`);
			const binds = branch.fields.map((field, index) => `let b${index} ← ${inputConversion(field.refinement, names[index], depth + 1)};`).join(" ");
			return `| LbOwnedErased.${sourceName(tree.type)}.«${branch.name}» ${names.join(" ")} => do ${binds} pure (_root_.${sourceName(tree.type)}.«${branch.name}» ${branch.fields.map((_, index) => `b${index}`).join(" ")})`;
		}).join(" ")})`;
		const child = (index, expression) => inputConversion(tree.arguments[index], expression, depth + 1);
		if(["array", "list"].includes(tree.kind)) return `(${input}.mapM (fun ${name} => ${child(0, name)}))`;
		if(tree.kind === "option") return `(match ${input} with | _root_.Option.none => _root_.Option.some _root_.Option.none | _root_.Option.some ${name} => (${child(0, name)}).map _root_.Option.some)`;
		if(tree.kind === "tuple") return `(do let ${name}a ← ${child(0, `${input}.fst`)}; let ${name}b ← ${child(1, `${input}.snd`)}; pure (${name}a, ${name}b))`;
		if(tree.kind === "result") return `(match ${input} with | _root_.Except.ok ${name} => (${child(0, name)}).map _root_.Except.ok | _root_.Except.error ${name} => (${child(1, name)}).map _root_.Except.error)`;
		fail(`unsupported input refinement ${tree.kind}`);
	};
	const resultConversion = (tree, value, depth = 0) => {
		if(tree === null) return `(${value})`;
		if(tree.kind === "alias") return resultConversion(tree.target, value, depth);
		const input = `(${value})`, name = `_ownedValue${depth}`;
		if(["fin", "subtype"].includes(tree.kind)) return `(_root_.Subtype.val ${input})`;
		if(["record", "checked-record"].includes(tree.kind)) return `(LbOwnedErased.${sourceName(tree.type)}.mk ${tree.fields.map(field => resultConversion(field.refinement, `${input}.«${field.name}»`, depth + 1)).join(" ")})`;
		if(tree.kind === "variant") return `(match ${input} with ${tree.cases.map(branch => {
			const names = branch.fields.map((_, index) => `a${depth}_${index}`);
			return `| _root_.${sourceName(tree.type)}.«${branch.name}» ${names.join(" ")} => LbOwnedErased.${sourceName(tree.type)}.«${branch.name}» ${branch.fields.map((field, index) => resultConversion(field.refinement, names[index], depth + 1)).join(" ")}`;
		}).join(" ")})`;
		const child = (index, expression) => resultConversion(tree.arguments[index], expression, depth + 1);
		if(["array", "list"].includes(tree.kind)) return `(${input}.map (fun ${name} => ${child(0, name)}))`;
		if(tree.kind === "option") return `(${input}.map (fun ${name} => ${child(0, name)}))`;
		if(tree.kind === "tuple") return `(${child(0, `${input}.fst`)}, ${child(1, `${input}.snd`)})`;
		if(tree.kind === "result") return `(match ${input} with | _root_.Except.ok ${name} => .ok ${child(0, name)} | _root_.Except.error ${name} => .error ${child(1, name)})`;
		fail(`unsupported result refinement ${tree.kind}`);
	};
	const validators = new Map(), emittedValidators = new Set();
	for(const site of sites.filter(item => item.direction === "input"))
	{
		const symbol = `lean_bridge_owned_refine_${sha256(site.adapterKey).slice(0, 20)}`;
		validators.set(siteKey(site.declaration, site.position.kind
			, site.position.index), symbol);
		if(emittedValidators.has(symbol)) continue;
		emittedValidators.add(symbol);
		lines.push(`@[export ${symbol}]`
			, `def ${symbol} (carrier : _root_.Array ${sourceType(site.type)}) : _root_.UInt8 :=`
			, "  match carrierValue carrier with", "  | .none => 0", "  | .some value =>"
			, `    match ${inputConversion(site.tree, "value")} with`, "    | .some _ => 1", "    | .none => 0", "");
	}
	return { lines, sourceType, sourceValueType, inputConversion, resultConversion
		, byPosition, validators, siteKey
		, header: [...emittedValidators].map(
			symbol => `uint8_t ${symbol}(lean_object *);`
		)
	};
};
