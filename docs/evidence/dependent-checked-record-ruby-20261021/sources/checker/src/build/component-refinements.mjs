/**
 * Render compiler-owned refinements around a generated Lean source call.
 * Runtime ABIs carry Fin values as Nat; only this checked adapter constructs Fin.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";

/**
 * Name the conversion that builds a checked record from its payload mirror with one constructor.
 * Each site chooses its constructor, so a mirror carries one conversion per constructor in use.
 *
 * @param constructor - Fully qualified Lean checked constructor.
 * @param refinement - Optional complete rich checked-record tree. Legacy leaves retain their old identity.
 */
export const checkedRecordVia = (constructor, refinement = null) =>
	`via_${sha256(refinement === null ? constructor : canonicalJson(refinement)).slice(0, 16)}`;

/**
 * Enumerate constructor leaves and their erased native inputs in transport order.
 * The suffix identifies a type position, not a runtime collection index.
 *
 * @param refinement - Validated refinement tree.
 * @param type - Matching erased native type.
 * @param suffix - Exported validator suffix, empty for an existing scalar site.
 */
export const constructorRefinementLeaves = (refinement, type, suffix = "") => {
	if(refinement === null || ["fin", "fin-field"].includes(refinement.kind)) return [];
	if(type.kind === "alias") return constructorRefinementLeaves(refinement, type.target, suffix);
	if(refinement.kind === "subtype") return [{ refinement, type, suffix }];
	if(refinement.kind === "checked-record")
	{
		const nested = Object.hasOwn(refinement, "arguments")
			? refinement.arguments.flatMap((child, index) =>
				constructorRefinementLeaves(child, type.fields[index].type, `${suffix}_${index}`)) : [];
		return [...nested, { refinement, type, suffix }];
	}
	if(refinement.kind === "record") return refinement.arguments.flatMap((child, index) =>
		constructorRefinementLeaves(child, type.fields[index].type, `${suffix}_${index}`));
	if(refinement.kind === "variant") return refinement.cases.flatMap((branch, index) => branch.arguments.flatMap((child, field) =>
		constructorRefinementLeaves(child, type.cases[index].fields[field].type, `${suffix}_${index}_${field}`)));
	if(!["array", "list", "option", "tuple", "result"].includes(refinement.kind)) return [];
	return refinement.arguments.flatMap((child, index) => constructorRefinementLeaves(child, type.arguments?.[index] ?? type.element, `${suffix}_${index}`));
};

/**
 * Give a constructor leaf in a finite copied graph a stable private identity.
 * The path is deliberately absent: one checked constructor can validate the
 * same erased leaf at every runtime occurrence of a recursive value.
 *
 * @param refinement - A normalized Subtype or checked-record leaf.
 * @param type - Its erased copied transport type.
 */
export const componentRecursiveRefinementLeafKey = (refinement, type) =>
	sha256(canonicalJson({ refinement, type })).slice(0, 20);

/**
 * Enumerate constructor leaves in one normalized finite refinement graph.
 * Recursive markers follow their authenticated target once; runtime walkers
 * reuse the resulting validator at every occurrence instead of unfolding the
 * schema forever.
 *
 * @param refinement - Normalized refinement tree from componentRefinementMirrors.
 * @param type - Matching private copied-graph reference.
 * @param definitions - Private nominal definitions, keyed by lean: identity.
 * @param cycles - Authenticated recursive refinement targets, keyed by token.
 */
export const componentRecursiveRefinementLeaves = (refinement, type, definitions, cycles) => {
	const leaves = new Map();
	const resolve = (reference, aliases = new Set()) => {
		if(reference.kind !== "named") return reference;
		const definition = definitions.get(reference.id);
		if(definition?.kind !== "alias") return reference;
		if(aliases.has(reference.id)) throw new TypeError(`Recursive refinement alias ${reference.id}`);
		return resolve(definition.target, new Set([...aliases, reference.id]));
	};
	const visit = (tree, reference, active = new Set()) => {
		if(tree === null || tree === undefined || ["fin", "fin-field"].includes(tree.kind)) return;
		const concrete = resolve(reference);
		if(tree.kind === "subtype")
		{
			const key = componentRecursiveRefinementLeafKey(tree, concrete);
			leaves.set(key, { key, refinement: tree, type: concrete });
			return;
		}
		if(tree.kind === "checked-record")
		{
			if(Object.hasOwn(tree, "arguments"))
			{
				const definition = concrete.kind === "named" ? definitions.get(concrete.id) : null;
				if(definition?.kind !== "record" || definition.fields.length !== tree.arguments.length)
					throw new TypeError(`Recursive checked-record refinement differs from ${tree.definition}`);
				tree.arguments.forEach((child, index) => visit(child, definition.fields[index].type, active));
			}
			const key = componentRecursiveRefinementLeafKey(tree, concrete);
			leaves.set(key, { key, refinement: tree, type: concrete });
			return;
		}
		if(tree.kind === "recursive")
		{
			if(active.has(tree.cycle)) return;
			const target = cycles.get(tree.cycle);
			if(!target || target.definition !== tree.definition)
				throw new TypeError(`Missing recursive refinement target: ${tree.definition}`);
			visit(target, concrete, new Set([...active, tree.cycle]));
			return;
		}
		const nested = tree.cycle ? new Set([...active, tree.cycle]) : active;
		if(tree.kind === "record")
		{
			const definition = concrete.kind === "named" ? definitions.get(concrete.id) : null;
			if(definition?.kind !== "record" || definition.fields.length !== tree.arguments.length)
				throw new TypeError(`Recursive record refinement differs from ${tree.definition}`);
			tree.arguments.forEach((child, index) => visit(child, definition.fields[index].type, nested));
			return;
		}
		if(tree.kind === "variant")
		{
			const definition = concrete.kind === "named" ? definitions.get(concrete.id) : null;
			if(definition?.kind !== "variant" || definition.cases.length !== tree.cases.length)
				throw new TypeError(`Recursive variant refinement differs from ${tree.definition}`);
			tree.cases.forEach((branch, index) => branch.arguments.forEach((child, field) =>
				visit(child, definition.cases[index].fields[field].type, nested)));
			return;
		}
		if(concrete.kind !== "apply" || concrete.constructor !== tree.kind || concrete.arguments.length !== tree.arguments.length)
			throw new TypeError(`Recursive ${tree.kind} refinement differs from its transport`);
		tree.arguments.forEach((child, index) => visit(child, concrete.arguments[index], nested));
	};
	visit(refinement, type);
	return [...leaves.values()].sort((left, right) => left.key.localeCompare(right.key));
};

const refinements = (item, count) => item.refinements ?? {
	parameters: Array.from({ length: count }, () => null)
	, result: null
};

// New structural Subtype expressions may be elaborated before a monadic product's
// expected type is known. Qualify sum patterns so Lean can infer their input shape.
const containsSubtype = refinement => refinement?.kind === "subtype"
	|| refinement?.kind === "recursive"
	|| (refinement?.arguments ?? []).some(containsSubtype)
	|| (refinement?.cases ?? []).some(branch => branch.arguments.some(containsSubtype));
const containsRecursive = refinement => refinement?.kind === "recursive"
	|| (refinement?.arguments ?? []).some(containsRecursive)
	|| (refinement?.cases ?? []).some(branch => branch.arguments.some(containsRecursive));

/**
 * Share Fin-only checks, but key constructor-bearing conversions by the complete site tree.
 * Field/case order, nested choices and bounds are part of that identity.
 *
 * @param refinement - A validated record or variant refinement tree.
 */
export const nominalRefinementCheck = refinement => containsSubtype(refinement)
	? `via_${sha256(canonicalJson(refinement))}` : "check";

/**
 * Convert an erased value to proof-carrying Lean data through Option, or project
 * a result back to transport data. Every Fin proof comes from a decidable check.
 *
 * @param refinement - Validated scalar or structural refinement tree.
 * @param value - Lean value expression.
 * @param checked - Construct checked input when true; erase result when false.
 * @param depth - Fresh binder suffix for nested conversions.
 * @param recursive - Optional resolver for a normalized finite backedge.
 */
export const componentRefinementConversion = (refinement, value, checked = true, depth = 0, recursive = null) => {
	const input = `(${value})`, name = `_bridgeValue${depth}`;
	if(refinement === null) return checked ? `(_root_.Option.some ${input})` : input;
	if(refinement.kind === "recursive")
	{
		if(typeof recursive !== "function") throw new TypeError("A recursive refinement requires its finite target map");
		return recursive(refinement, value, checked);
	}
	if(refinement.kind === "fin") return checked
		? `(if proof : ${input} < ${refinement.bound} then _root_.Option.some (⟨${input}, proof⟩ : _root_.Fin ${refinement.bound}) else _root_.Option.none)`
		: `${input}.val`;
	// The surrounding checked-record constructor validates the relationship between
	// sibling fields. This leaf only transports the dependent Fin as its Nat value.
	if(refinement.kind === "fin-field") return checked
		? `(_root_.Option.some ${input})`
		: `${input}.val`;
	if(refinement.kind === "subtype")
	{
		if(checked && typeof refinement.constructor !== "string") throw new TypeError("A Subtype input requires its site's constructor");
		return checked ? `_root_.${refinement.constructor} ${value}` : `(_root_.Subtype.val ${input})`;
	}
	// A checked record crosses as its payload mirror: only the site's constructor builds the source
	// value, and a Lean-produced one is projected back without any check.
	if(refinement.kind === "checked-record")
	{
		if(checked && typeof refinement.constructor !== "string") throw new TypeError("A checked record input requires its site's constructor");
		const rich = Object.hasOwn(refinement, "arguments");
		return `(LbErased.${refinement.definition}.${checked ? checkedRecordVia(refinement.constructor, rich ? refinement : null) : "erase"} ${input})`;
	}
	// Native packages pass records and variants with checked fields as erased mirrors whose
	// check and erase functions the native adapter module defines.
	if(["record", "variant"].includes(refinement.kind)) return `(LbErased.${refinement.definition}.${checked ? nominalRefinementCheck(refinement) : "erase"} ${input})`;
	const child = (index, expression) => componentRefinementConversion(refinement.arguments[index], expression, checked, depth + 1, recursive);
	if(["array", "list"].includes(refinement.kind)) return `(${input}.${checked ? "mapM" : "map"} (fun ${name} => ${child(0, name)}))`;
	const qualified = containsSubtype(refinement);
	if(refinement.kind === "option") return checked
		? `(match ${input} with | ${qualified ? "_root_.Option" : ""}.none => _root_.Option.some _root_.Option.none | ${qualified ? "_root_.Option" : ""}.some ${name} => (${child(0, name)}).map _root_.Option.some)`
		: containsRecursive(refinement)
			? `(match ${input} with | _root_.Option.none => _root_.Option.none | _root_.Option.some ${name} => _root_.Option.some ${child(0, name)})`
			: `(${input}.map (fun ${name} => ${child(0, name)}))`;
	if(refinement.kind === "tuple") return checked
		? `(do let ${name}a ← ${child(0, `${input}.fst`)}; let ${name}b ← ${child(1, `${input}.snd`)}; pure (${name}a, ${name}b))`
		: `(${child(0, `${input}.fst`)}, ${child(1, `${input}.snd`)})`;
	return `(match ${input} with | ${qualified ? "_root_.Except" : ""}.ok ${name} => ${checked ? `(${child(0, name)}).map _root_.Except.ok` : `.ok ${child(0, name)}`}`
		+ ` | ${qualified ? "_root_.Except" : ""}.error ${name} => ${checked ? `(${child(1, name)}).map _root_.Except.error` : `.error ${child(1, name)}`})`;
};

/**
 * Build the source-level call and retain the guards needed to construct refined inputs.
 *
 * @param item - Validated compiler export.
 * @param arguments_ - Source-level argument expressions after transport decoding.
 * @param emptyArgumentSpace - Preserve historical generated bytes for adapters whose calls always included a separator.
 */
export const componentRefinedCall = (item, arguments_, emptyArgumentSpace = false) => {
	const selected = refinements(item, arguments_.length);
	const parameters = arguments_.map((argument, index) => {
		const refinement = selected.parameters[index];
		if(refinement === null) return argument;
		return refinement.kind === "fin" ? `⟨${argument}, _bridgeFin${index}⟩` : `_bridgeSubtype${index}`;
	});
	const application = `${item.sourceApplication ? `(${item.sourceApplication})` : `_root_.${item.sourceDeclaration}`}${parameters.length ? ` ${parameters.join(" ")}` : emptyArgumentSpace ? " " : ""}`;
	return {
		call: selected.result === null ? application : ["fin", "subtype"].includes(selected.result.kind)
			? componentRefinementConversion(selected.result, application, false)
			: `(let _bridgeResult := ${application}; ${componentRefinementConversion(selected.result, "_bridgeResult", false)})`
		, guards: selected.parameters.flatMap((refinement, index) => refinement === null ? []
			: refinement.kind === "fin" ? [{ kind: "fin", bound: refinement.bound
				, proof: `_bridgeFin${index}`, value: arguments_[index] }]
				: [{ kind: "checked", binding: `_bridgeSubtype${index}`
					, conversion: componentRefinementConversion(refinement, arguments_[index]) }])
	};
};

/**
 * Nest decidable refinement guards around a successful and rejected expression.
 *
 * @param guards - Guards returned by componentRefinedCall.
 * @param success - Expression evaluated only after every guard succeeds.
 * @param rejected - Expression returned when a runtime value violates its refinement.
 */
export const componentRefinementGuards = (guards, success, rejected) => {
	let body = success;
	for(let index = guards.length - 1; index >= 0; --index)
	{
		const guard = guards[index];
		body = guard.kind === "fin"
			? `if ${guard.proof} : (${guard.value}) < ${guard.bound} then\n  ${body.replaceAll("\n", "\n  ")}\nelse\n  ${rejected}`
			: `match ${guard.conversion} with\n| .some ${guard.binding} =>\n  ${body.replaceAll("\n", "\n  ")}\n| .none =>\n  ${rejected}`;
	}
	return body;
};

/**
 * Validate copied carriers before dispatch so a rejected predicate can return
 * an ordinary call failure rather than an invalid result carrier.
 *
 * @param item - Compiler-owned source export with primitive refinement bases.
 * @param includeFin - Check scalar Fin when nominal construction selects graph transport.
 * @param inputGuard - Optional Fin-only predicate, evaluated before any selected constructor.
 */
export const componentCarrierRefinementValidators = (item, includeFin = false, inputGuard) => (item.refinements?.parameters ?? []).flatMap((refinement, index) => {
	if(!refinement || (!includeFin && refinement.kind === "fin")) return [];
	const guard = inputGuard?.(refinement, "value");
	const body = [`match ${componentRefinementConversion(refinement, "value")} with`, "| .some _ => 1", "| .none => 0"];
	return [
		`@[export ${item.symbol}_refinement_${index}]`
		, `def ${item.wrapper}_refinement_${index} (carrier : _root_.Array ${item.parameters[index].leanType}) : _root_.UInt8 :=`
		, "  match carrierValue carrier with"
		, "  | .none => 0"
		, "  | .some value =>"
		, ...guard && guard !== "true" ? [`    if ${guard} then`, ...body.map(line => `      ${line}`), "    else 0"] : body.map(line => `    ${line}`)
		, ""
	];
});
