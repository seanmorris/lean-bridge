/**
 * Checked native-library-v1 projection. Independent of the wasm32 scalar frame.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { validateNativeType } from "../analyze/native-types.mjs";
import { projectNativeMetadata, containsGraph } from "../analyze/native-metadata.mjs";
import { createElaboratedSemanticModel } from "../analyze/semantic-model.mjs";
import { reconcileReviewedSource } from "../analyze/reviewed-source.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { projectPerlNames } from "../backends/perl/naming.mjs";
import { componentRefinedCall, componentRefinementConversion, componentRefinementGuards } from "./component-refinements.mjs";

export { validateNativeType };

export const nativeAbiVersion = 1;
export const nativeCopyLimit = 16 * 1024 * 1024;
const identifier = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/;
const fail = message => { throw new TypeError(`native-library-v1: ${message}`); };

/**
	Render a validated native type as Lean source syntax.

 * @param type - Checked native type and compiler representation.
 */
export const nativeLeanType = type => {
	if(type.kind === "array") return `(Array ${nativeLeanType(type.element)})`;
	if(type.kind === "list") return `(List ${nativeLeanType(type.element)})`;
	if(type.kind === "option") return `(Option ${nativeLeanType(type.element)})`;
	if(type.kind === "result") return `(Except ${nativeLeanType(type.arguments[1])} ${nativeLeanType(type.arguments[0])})`;
	if(type.kind === "tuple") return `(Prod ${type.arguments.map(nativeLeanType).join(" ")})`;
	if(type.kind === "callback") return `(${[...type.parameters, type.result].map(nativeLeanType).join(" → ")})`;
	return type.lean;
};
// A record or variant with checked Fin fields crosses as its erased mirror (see nativeErasedMirrors).
const absoluteLeanType = (type, mirrors = new Set()) => {
	const inner = child => absoluteLeanType(child, mirrors);
	if(type.kind === "array") return `(_root_.Array ${inner(type.element)})`;
	if(type.kind === "list") return `(_root_.List ${inner(type.element)})`;
	if(type.kind === "option") return `(_root_.Option ${inner(type.element)})`;
	if(type.kind === "result") return `(_root_.Except ${inner(type.arguments[1])} ${inner(type.arguments[0])})`;
	if(type.kind === "tuple") return `(_root_.Prod ${type.arguments.map(inner).join(" ")})`;
	// A leased closure with checked arguments carries its rejection as none, never as a default.
	if(type.kind === "callback") return `(${[...type.parameters, type.checked ? { kind: "option", element: type.result } : type.result].map(inner).join(" → ")})`;
	if(["record", "variant"].includes(type.kind) && mirrors.has(type.lean)) return erasedMirror(type.lean);
	return `_root_.${type.lean}`;
};
const erasedMirror = lean => `LbErased.${lean}`;
/**
	Hash the checked representation and semantic type, excluding its cached key.

 * @param type - Checked native type and compiler representation.
 */
export const nativeTypeKey = type => {
	const { key, ...shape } = type;
	void key;
	return sha256(canonicalJson(shape)).slice(0, 20);
};
/**
	Read the compiler-checked C representation for a native type.

 * @param type - Checked native type and compiler representation.
 */
export const nativeCType = type => {
	if(type.abi) return type.abi.cType === "lean_object*" ? "lean_object *" : type.abi.cType;
	if(type.kind !== "primitive") return "lean_object *";
	if(/^u?int(?:8|16|32|64)$/.test(type.name)) return `uint${type.name.match(/\d+/)[0]}_t`;
	if(type.name === "bool") return "uint8_t";
	if(type.name === "char") return "uint32_t";
	if(type.name === "usize" || type.name === "isize") return "size_t";
	if(type.name === "float32") return "float";
	if(type.name === "float64") return "double";
	return "lean_object *";
};
/**
	Identify values represented by a Lean object pointer.

 * @param type - Checked native type and compiler representation.
 */
export const nativeObjectType = type => nativeCType(type) === "lean_object *";

/**
 * A valid copied value used only while a callback exception awaits cleanup.
 *
 * @param type - Checked native type and compiler representation.
 */
export const nativeCallbackDefault = type => {
	if(type.kind === "array") return "lean_mk_empty_array()";
	if(type.kind === "list") return `lb_t${nativeTypeKey(type)}_from_array(lean_mk_empty_array())`;
	if(type.kind === "option") return `lb_t${nativeTypeKey(type)}_none(lean_box(0))`;
	if(type.kind === "result") return `lb_t${nativeTypeKey(type)}_ok(${nativeCallbackDefault(type.arguments[0])})`;
	if(type.kind === "tuple") return `lb_t${nativeTypeKey(type)}_make(${type.arguments.map(nativeCallbackDefault).join(", ")})`;
	if(type.kind === "variant") return `lb_t${nativeTypeKey(type)}_make0(${type.cases[0].fields.map(field => nativeCallbackDefault(field.type)).join(", ") || "lean_box(0)"})`;
	if(type.kind === "record") return `lb_t${nativeTypeKey(type)}_make(${type.fields.map(f => nativeCallbackDefault(f.type)).join(", ") || "lean_box(0)"})`;
	if(type.kind !== "primitive") fail("callback results must be copied values; identity results need a failure representation");
	if(type.name === "string") return 'lean_mk_string("")';
	if(type.name === "bytes") return "lean_alloc_sarray(1, 0, 0)";
	return nativeObjectType(type) ? "lean_box(0)" : "0";
};

const callbackLeanDefault = (type, mirrors = new Set()) => {
	const inner = child => callbackLeanDefault(child, mirrors);
	if(type.kind === "array") return "#[]";
	if(type.kind === "list") return "[]";
	if(type.kind === "option") return "_root_.Option.none";
	if(type.kind === "result") return `(_root_.Except.ok ${inner(type.arguments[0])})`;
	if(type.kind === "tuple") return `(_root_.Prod.mk ${type.arguments.map(inner).join(" ")})`;
	if(type.kind === "record") return `(${mirrors.has(type.lean) ? `${erasedMirror(type.lean)}.mk` : `_root_.${type.constructor}`} ${type.fields.map(f => inner(f.type)).join(" ")})`;
	if(type.kind === "variant") return `(${mirrors.has(type.lean) ? `${erasedMirror(type.lean)}.«${type.cases[0].name}»` : `_root_.${type.cases[0].constructor}`} ${type.cases[0].fields.map(f => inner(f.type)).join(" ")})`;
	if(type.kind !== "primitive") fail("callback results must be copied values");
	return { unit: "()", bool: "false", char: "(_root_.Char.ofNat 0)", string: '""', bytes: "_root_.ByteArray.empty" }[type.name] ?? "0";
};

const closed = (value, fields, label) => {
	if(!value || typeof value !== "object" || Array.isArray(value)
	  || Object.keys(value).sort().join(",") !== [...fields].sort().join(",")) fail(`invalid ${label} fields`);
};

// Alias names remain in compiler metadata and Binding IR. Native conversion
// helpers use the compiler-checked target representation without a new wrapper.
const nativeRepresentation = type => {
	if(type.kind === "refinement") return type.base;
	if(type.kind === "alias") return nativeRepresentation(type.target);
	if(["array", "list", "option"].includes(type.kind)) return { ...type, element: nativeRepresentation(type.element) };
	if(["result", "tuple"].includes(type.kind)) return { ...type, arguments: type.arguments.map(nativeRepresentation) };
	if(type.kind === "record") return { ...type, fields: type.fields.map(field => ({ ...field, type: nativeRepresentation(field.type) })) };
	if(type.kind === "variant") return { ...type, cases: type.cases.map(branch => ({ ...branch, fields: branch.fields.map(field => ({ ...field, type: nativeRepresentation(field.type) })) })) };
	if(type.kind === "callback") return { ...type, parameters: type.parameters.map(nativeRepresentation), result: nativeRepresentation(type.result) };
	return type;
};

/**
 * Retain exact Fin bounds beside the Nat transport, at top-level sites and inside
 * their structural containers, as the same refinement trees the component adapters
 * check. Only exports with a checked adapter may carry them. A callback carries a tree
 * only in its safe directions: the arguments of a Lean closure leased to the host, which
 * are checked before it runs, and values Lean produces for the host. A host callback's
 * result would reach running Lean before any check, so it is refused.
 *
 * @param declaration - Compiler-selected native declaration.
 * @param callbacks - Whether the selected packages check Fin in callbacks (C and C++).
 */
const nativeRefinements = (declaration, callbacks = false) => {
	const unsupported = message => Object.assign(new TypeError(`${declaration.name}: ${message}`), { code: "native-refinements-unsupported", details: { declaration: declaration.name } });
	const tree = (type, top = true, site = undefined) => {
		if(type.kind === "callback")
		{
			if(site === undefined)
			{
				if(containsGraph(type, "refinement")) throw unsupported("checked Fin refinements inside nested callbacks are not supported by native packages");
				return null;
			}
			const parameters = type.parameters.map(child => tree(child, false)), result = tree(type.result, false);
			if(parameters.every(child => child === null) && result === null) return null;
			if(site === "parameter" && result !== null) throw unsupported("Fin refinements in a host callback result are refused: the host produces the value while Lean runs");
			if(!callbacks) throw unsupported("checked Fin refinements in callbacks are implemented only for C and C++ packages");
			return { kind: "callback", parameters, result };
		}
		if(type.kind === "refinement")
		{
			if(type.predicate.kind === "subtype")
			{
				if(!top) throw Object.assign(new TypeError(`${declaration.name}: checked Subtype refinements inside containers are not supported by native packages`), { code: "native-refinements-unsupported", details: { declaration: declaration.name } });
				return { kind: "subtype", constructor: type.predicate.constructor };
			}
			return { kind: type.predicate.kind, bound: type.predicate.bound };
		}
		if(type.kind === "alias") return tree(type.target, top);
		if(["array", "list", "option"].includes(type.kind))
		{
			const element = tree(type.element, false);
			return element === null ? null : { kind: type.kind, arguments: [element] };
		}
		// Products keep [first, second]; results keep [ok, error], as the transport does.
		if(["tuple", "result"].includes(type.kind))
		{
			const children = type.arguments.map(child => tree(child, false));
			return children.every(child => child === null) ? null : { kind: type.kind, arguments: children };
		}
		// A plain record or variant names its definition and carries every field's tree in
		// declaration order; a variant checks only its active case. Definitions are acyclic here.
		if(type.kind === "record" && !Object.hasOwn(type, "provenance") && !containsGraph(type, "callback"))
		{
			const fields = type.fields.map(field => tree(field.type, false));
			return fields.every(child => child === null) ? null
				: { kind: "record", definition: type.lean, fields: type.fields.map(field => field.name), arguments: fields };
		}
		if(type.kind === "variant" && !containsGraph(type, "callback"))
		{
			const cases = type.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(field => field.name), arguments: branch.fields.map(field => tree(field.type, false)) }));
			return cases.flatMap(branch => branch.arguments).every(child => child === null) ? null : { kind: "variant", definition: type.lean, cases };
		}
		// Any other container would erase a bound the extractor admitted; refuse rather than drop it.
		if(containsGraph(type, "refinement")) throw Object.assign(new TypeError(`${declaration.name}: checked Fin refinements inside ${type.kind} values are not supported by native packages`), { code: "native-refinements-unsupported", details: { declaration: declaration.name } });
		return null;
	};
	const predicate = (type, site) => {
		const value = tree(type, true, site);
		if(value !== null) validateNativeType(type, 0, false, site);
		return value;
	};
	const value = { parameters: declaration.parameters.map(parameter => predicate(parameter.type, "parameter")), result: predicate(declaration.result, "result") };
	if(value.result === null && value.parameters.every(item => item === null)) return null;
	// Bounds on ordinary sites still need the Option-returning export adapter, which callbacks do not share yet.
	const sites = [...declaration.parameters.map(parameter => parameter.type), declaration.result];
	if(sites.some(type => type.kind === "callback") && [...value.parameters, value.result].some(item => item !== null && item.kind !== "callback"))
		throw unsupported("checked Fin refinements cannot share a native export with callbacks");
	return value;
};

/**
	Project elaborated native declarations into a checked model and canonical Binding IR.

 * @param root0 - Named inputs for this operation.
 * @param root0.metadata - Fresh elaborated Lean metadata.
 * @param root0.component - Canonical component name and version.
 * @param root0.moduleName - Optional Perl projection namespace; omitted for other native targets.
 * @param root0.sourceIdentity - Pinned compiler, source and interface identities.
 * @param profile - Fixed compilation profile.
 * @param pointerBits - Fixed target pointer width.
 * @param root1 - Explicit consumer capabilities for this model.
 * @param root1.refinements - Admit checked top-level Fin sites for C-family adapters.
 * @param root1.callbackRefinements - Admit Fin in a leased closure's arguments and in values Lean gives the host (C and C++).
 */
const createCompiledModel = ({ metadata, component, moduleName, sourceIdentity }, profile, pointerBits, { refinements: admitRefinements = false, callbackRefinements = false } = {}) => {
	const elaborated = projectNativeMetadata(metadata, sourceIdentity, { refinements: admitRefinements });
	const allTypes = new Map();
	const visit = type => {
		// A leased closure's checked trees distinguish its key; the representation itself is validated.
		const { checked, ...shape } = type;
		void checked;
		validateNativeType(shape);
		const key = nativeTypeKey(type);
		if(allTypes.has(key)) return;
		if(["array", "list", "option"].includes(type.kind)) visit(type.element);
		if(["result", "tuple"].includes(type.kind)) type.arguments.forEach(visit);
		if(type.kind === "record") for(const field of type.fields) visit(field.type);
		// Provenance arguments are not transport types; the Binding IR carries a definition that only an instantiation names.
		if(type.kind === "variant") for(const branch of type.cases) for(const field of branch.fields) visit(field.type);
		if(type.kind === "callback")
		{ type.parameters.forEach(visit); visit(type.result); }
		allTypes.set(key, { ...type, key });
	};
	// In the graph form a record's provenance references only nominal definitions the model
	// carries, and the reference's representation must agree with that definition.
	const resolveProvenance = () => {
		const named = new Map([...allTypes.values()].filter(type => ["alias", "record", "variant"].includes(type.kind)).map(type => [type.name, type]));
		const resolve = (argument, owner) => {
			if(argument.kind === "reference")
			{
				const definition = named.get(argument.name);
				if(!definition) fail(`${owner}: record provenance references an undefined nominal type ${argument.name}`);
				if(canonicalJson(definition.abi) !== canonicalJson(argument.abi)) fail(`${owner}: record provenance reference disagrees with its definition's representation`);
			}
			if(["array", "list", "option"].includes(argument.kind)) resolve(argument.element, owner);
			if(["result", "tuple"].includes(argument.kind)) argument.arguments.forEach(child => resolve(child, owner));
		};
		for(const type of allTypes.values()) if(type.kind === "record" && type.provenance) type.provenance.arguments.forEach(argument => resolve(argument, type.name));
	};
	const checked = elaborated.declarations.map(source => {
		const refinements = nativeRefinements(source, callbackRefinements);
		const parameters = source.parameters.map(parameter => ({ ...parameter, type: nativeRepresentation(parameter.type) }));
		// A leased closure whose arguments are checked is a different native type: its key, lease
		// kind and Lean carrier differ from an unchecked closure with the same representation.
		const leased = refinements?.result?.kind === "callback" && refinements.result.parameters.some(item => item !== null)
			? { checked: refinements.result.parameters } : {};
		const declaration = { ...source, parameters, result: { ...nativeRepresentation(source.result), ...leased }, ...(refinements ? { refinements } : {}) };
		if(!identifier.test(declaration.name) || !identifier.test(declaration.module)) fail("invalid declaration identity");
		declaration.parameters.forEach(parameter => { closed(parameter, ["name", "type"], "native parameter"); visit(parameter.type); });
		visit(declaration.result);
		return { ...declaration, symbol: `lb_${sha256(`${component.id}\0${declaration.name}`).slice(0, 24)}` };
	});
	if(!checked.length) fail("empty export set");
	resolveProvenance();
	const exports = moduleName === undefined ? checked : projectPerlNames(moduleName, checked);
	const semantic = createElaboratedSemanticModel({
		metadata, request: sourceIdentity.request, component
		, elaborationSha256: elaborated.sha256
	});
	const bindingIr = sourceIdentity.reviewedBindingIr === undefined ? semantic.document
		: reconcileReviewedSource(sourceIdentity.reviewedBindingIr, semantic.document, sourceIdentity);
	const model = { schemaVersion: sourceIdentity.reviewedBindingIr === undefined ? 2 : 3
		, profile
		, pointerBits
		, byteOrder: "little"
		, component
		, ...(moduleName === undefined ? {} : { moduleName })
		, bindingIr
		, bindingIrSha256: hashBindingIr(bindingIr)
		, sourceIdentity
		, exports
		, types: [...allTypes.values()] };
	return Object.freeze(model);
};

/**
 * Build the fixed 64-bit native profile from fresh compiler metadata.
 *
 * @param options - Elaborated metadata, component and source identity.
 * @param capabilities - Optional consumer capabilities, such as checked Fin sites.
 */
export const createNativeModel = (options, capabilities) => createCompiledModel(options, "native-library-v1", 64, capabilities);

/**
 * Reuse C-shape elaboration, not a compiled native receipt, for wasm32.
 * The target C compiler checks the emitted definitions against these prototypes.
 *
 * @param options - Elaborated metadata, component and source identity.
 */
export const createPhpWasmCopiedModel = options => {
	if(options.moduleName !== undefined) throw new TypeError("PHP-Wasm models cannot carry a Perl namespace");
	const model = createCompiledModel(options, "php-wasm-copied-v1", 32, { refinements: true });
	// The plain copied side module carries the same caller-limb Fin walk and Lean guards as native
	// packages. Author-checked Subtype constructors and components with callbacks have no PHP-Wasm
	// acceptance yet, so they stay refused rather than inferred from native PHP.
	const refined = model.exports.filter(item => item.refinements);
	const subtype = refined.find(item => [...item.refinements.parameters, item.refinements.result].some(value => value?.kind === "subtype"));
	if(subtype) throw Object.assign(new TypeError(`${subtype.name}: checked Subtype refinements are not yet supported by PHP-Wasm packages`), { code: "native-refinements-unsupported", details: { declaration: subtype.name } });
	const callback = refined.length ? model.types.find(type => type.kind === "callback") : null;
	if(callback) throw Object.assign(new TypeError(`${refined[0].name}: checked Fin refinements cannot share a PHP-Wasm package with callables`), { code: "native-refinements-unsupported", details: { declaration: refined[0].name } });
	const copied = type => type.kind === "primitive" || (["array", "list", "option"].includes(type.kind) && copied(type.element))
		|| (["result", "tuple"].includes(type.kind) && type.arguments.every(copied)) || (type.kind === "record" && type.fields.every(field => copied(field.type)))
		|| (type.kind === "variant" && type.cases.every(branch => branch.fields.every(field => copied(field.type))));
	const admitted = type => copied(type) || (type.kind === "callback" && type.parameters.every(copied) && copied(type.result));
	const unsupported = model.exports.find(item => !item.parameters.every(parameter => admitted(parameter.type)) || !admitted(item.result));
	if(unsupported)
	{
		const declaration = model.bindingIr.declarations.find(item => item.source.declaration === unsupported.name);
		const source = declaration.source.extensions?.["lean-lang.org/source-position"];
		throw Object.assign(new TypeError(`${source ? `${source.path}:${source.startLine}:${source.startColumn}: ` : ""}${unsupported.name}: PHP-Wasm compilation admits copied primitives, arrays, Lists, records, concrete variants, options, results, binary products and synchronous copied-value callables`), { code: "unsupported-php-wasm-signature", details: { declaration: declaration.id, source: source ?? null } });
	}
	return model;
};

/**
 * Box a checked export's result so rejected Fin inputs need no fabricated value.
 *
 * @param result - Native representation of the source result.
 */
export const nativeRefinedResult = result => ({ kind: "option", element: result
	, abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } });

/**
 * List a refinement tree's children: a callback keeps them as parameters and result, a variant
 * in its cases, and every other node as arguments.
 *
 * @param tree - Validated native refinement tree.
 */
const refinementChildren = tree => tree.kind === "variant" ? tree.cases.flatMap(branch => branch.arguments)
	: tree.kind === "callback" ? [...tree.parameters, tree.result] : tree.arguments ?? [];

/**
 * Collect the Lean names of records and variants whose fields carry checked Fin bounds,
 * from every export's refinement trees, including those inside callbacks.
 *
 * @param model - Compiler-checked native model.
 */
const nativeErasedMirrors = model => {
	const names = new Set();
	const walk = tree => {
		if(!tree || typeof tree !== "object") return;
		if(["record", "variant"].includes(tree.kind)) names.add(tree.definition);
		for(const child of refinementChildren(tree)) walk(child);
	};
	for(const item of model.exports) if(item.refinements) [...item.refinements.parameters, item.refinements.result].forEach(walk);
	return names;
};

/**
 * Define each erased mirror and its check and erase functions, children before parents.
 *
 * @param model - Compiler-checked native model; its types are already Nat-erased.
 * @param mirrors - Lean names of the mirrored definitions.
 */
const renderErasedMirrors = (model, mirrors) => {
	const trees = new Map();
	const walk = tree => {
		if(!tree || typeof tree !== "object") return;
		if(["record", "variant"].includes(tree.kind) && !trees.has(tree.definition)) trees.set(tree.definition, tree);
		for(const child of refinementChildren(tree)) walk(child);
	};
	for(const item of model.exports) if(item.refinements) [...item.refinements.parameters, item.refinements.result].forEach(walk);
	const lines = [], done = new Set();
	for(const type of model.types)
	{
		if(!["record", "variant"].includes(type.kind) || !mirrors.has(type.lean) || done.has(type.lean)) continue;
		done.add(type.lean);
		const mirror = erasedMirror(type.lean), tree = trees.get(type.lean), source = `_root_.${type.lean}`;
		const convert = (refinement, value, checked) => componentRefinementConversion(refinement, value, checked);
		if(type.kind === "record")
		{
			lines.push(`structure ${mirror} where`, ...type.fields.map(field => `  «${field.name}» : ${absoluteLeanType(field.type, mirrors)}`), "");
			lines.push(`def ${mirror}.check (value : ${mirror}) : _root_.Option ${source} := do`
				, ...type.fields.map((field, i) => `  let a${i} ← ${convert(tree.arguments[i], `value.«${field.name}»`, true)}`)
				, `  pure (_root_.${type.constructor} ${type.fields.map((_, i) => `a${i}`).join(" ")})`, "");
			lines.push(`def ${mirror}.erase (value : ${source}) : ${mirror} :=`
				, `  ${mirror}.mk ${type.fields.map((field, i) => convert(tree.arguments[i], `value.«${field.name}»`, false)).join(" ")}`, "");
			continue;
		}
		lines.push(`inductive ${mirror} where`, ...type.cases.map(branch => `  | «${branch.name}» ${branch.fields.map((field, j) => `(a${j} : ${absoluteLeanType(field.type, mirrors)})`).join(" ")} : ${mirror}`), "");
		const pattern = branch => `.«${branch.name}» ${branch.fields.map((_, j) => `a${j}`).join(" ")}`;
		lines.push(`def ${mirror}.check (value : ${mirror}) : _root_.Option ${source} :=`, "  match value with"
			, ...type.cases.map((branch, i) => `  | ${pattern(branch)} => do ${branch.fields.map((_, j) => `let b${j} ← ${convert(tree.cases[i].arguments[j], `a${j}`, true)}; `).join("")}pure (_root_.${branch.constructor} ${branch.fields.map((_, j) => `b${j}`).join(" ")})`), "");
		lines.push(`def ${mirror}.erase (value : ${source}) : ${mirror} :=`, "  match value with"
			, ...type.cases.map((branch, i) => `  | ${pattern(branch)} => ${mirror}.«${branch.name}» ${branch.fields.map((_, j) => convert(tree.cases[i].arguments[j], `a${j}`, false)).join(" ")}`), "");
	}
	return lines;
};

/**
 * Call an export whose only bounds sit in callbacks. A host callback receives the values
 * Lean produces, erased to their transport; a leased closure checks every argument and
 * builds each Fin from its decidable proof before the source closure runs, returning none
 * instead of any substitute, and erases the values Lean returns to the host.
 *
 * @param item - Native export whose refinement trees are callbacks or null.
 * @param application - Source application of the exported declaration.
 */
const nativeCallbackRefinedCall = (item, application) => {
	const binders = count => Array.from({ length: count }, (_, i) => `_bridgeArg${i}`);
	const args = item.parameters.map((parameter, i) => {
		const tree = item.refinements.parameters[i];
		if(tree === null) return `a${i}`;
		const names = binders(tree.parameters.length);
		return `(fun ${names.join(" ")} => a${i} ${names.map((name, k) => componentRefinementConversion(tree.parameters[k], name, false)).join(" ")})`;
	});
	const call = `${application} ${args.join(" ")}`;
	const tree = item.refinements.result;
	if(tree === null) return call;
	const names = binders(tree.parameters.length);
	const closure = { refinements: { parameters: tree.parameters, result: tree.result }, sourceApplication: "_bridgeClosure" };
	const { call: inner, guards } = componentRefinedCall(closure, names);
	const body = guards.length ? componentRefinementGuards(guards, `_root_.Option.some (${inner})`, "_root_.Option.none") : inner;
	return `(let _bridgeClosure := ${call}; fun ${names.join(" ")} =>\n    ${body.replaceAll("\n", "\n    ")})`;
};

/**
 * Per-type constructor/projection functions keep Lean object layout private.
 *
 * @param model - Compiler-checked native model and Binding IR.
 */
export const generateNativeLeanAdapters = model => {
	const module = `LeanBridgeNative${sha256(model.component.id).slice(0, 16)}`;
	const lines = [...new Set(model.exports.map(item => `import ${item.module}`)), "", `namespace ${module}`, ""];
	// Records and variants with checked Fin fields cross as erased mirrors: the same fields with
	// every bound erased to Nat. Only check builds the source value, through Option, and only
	// erase projects one back; no Fin is ever constructed without its decidable proof.
	const mirrors = nativeErasedMirrors(model);
	lines.push(...renderErasedMirrors(model, mirrors));
	// A named one-field carrier prevents Lean's eta expansion from adding a
	// returned closure's arguments to the exported C function. Trivial-structure
	// elimination preserves the closure object's representation without copying.
	for(const type of model.types.filter(type => type.kind === "callback"))
	  lines.push(`structure ClosureCarry${type.key} where`, `  value : ${absoluteLeanType(type, mirrors)}`, "");
	const prototypes = ["#include <lean/lean.h>", "#include <stdint.h>", `LEAN_CASSERT(sizeof(size_t) * 8 == ${model.pointerBits});`];
	const emit = (symbol, parameters, result, body) => {
		const ps = parameters.length ? parameters : [{ name: "unit", type: { kind: "primitive", name: "unit", lean: "Unit" } }];
		const callback = result.kind === "callback";
		lines.push(`@[export ${symbol}]`, `def f_${symbol} ${ps.map(p => `(${p.name} : ${absoluteLeanType(p.type, mirrors)})`).join(" ")} : ${callback ? `ClosureCarry${nativeTypeKey(result)}` : absoluteLeanType(result, mirrors)} :=`, `  ${callback ? `⟨${body}⟩` : body}`, "");
		prototypes.push(`${nativeCType(result)} ${symbol}(${ps.map(p => `${nativeCType(p.type)} ${p.name}`).join(", ")});`);
	};
	for(const item of model.exports)
	{
		const parameters = item.parameters.map((p, i) => ({ name: `a${i}`, type: p.type }));
		const application = item.specialization ? `(${item.specialization.application})` : `_root_.${item.name}`;
		if(!item.refinements)
		{
			emit(item.symbol, parameters, item.result, `${application} ${item.parameters.map((_, i) => `a${i}`).join(" ")}`);
			continue;
		}
		if([...item.refinements.parameters, item.refinements.result].every(tree => tree === null || tree.kind === "callback"))
		{
			emit(item.symbol, parameters, item.result, nativeCallbackRefinedCall(item, application));
			continue;
		}
		// Every proof exists only inside a decidable branch; container elements are checked
		// by the same conversions the component adapters use. Rejected inputs return none.
		const source = { refinements: item.refinements, sourceDeclaration: item.name, ...(item.specialization ? { sourceApplication: item.specialization.application } : {}) };
		const { call, guards } = componentRefinedCall(source, item.parameters.map((_, i) => `a${i}`), true);
		if(!guards.length) emit(item.symbol, parameters, item.result, call);
		else emit(item.symbol, parameters, nativeRefinedResult(item.result)
			, componentRefinementGuards(guards, `_root_.Option.some (${call})`, "_root_.Option.none").replaceAll("\n", "\n  "));
		// One validator per author-constructed parameter lets the C adapter name the rejected site before dispatch.
		item.refinements.parameters.forEach((refinement, i) => {
			if(refinement?.kind !== "subtype") return;
			emit(`${item.symbol}_refinement_${i}`, [{ name: "value", type: item.parameters[i].type }], { kind: "primitive", name: "uint8", lean: "UInt8", abi: { cType: "uint8_t", box: "lean_box", unbox: "lean_unbox", heap: false } }
				, `match _root_.${refinement.constructor} value with\n  | .some _ => 1\n  | .none => 0`);
		});
	}
	for(const type of model.types)
	{
		const bool = { kind: "primitive", name: "bool", lean: "Bool" };
		if(type.kind === "list")
		{
			const array = { kind: "array", element: type.element };
			emit(`lb_t${type.key}_from_array`, [{ name: "value", type: array }], type, "value.toList");
			// One excess pointer makes any truncated result exceed the copy budget.
			// The tail-recursive walker avoids allocating an intermediate List.
			emit(`lb_t${type.key}_to_array`, [{ name: "value", type }], array,
				`let rec loop : _root_.Nat → ${absoluteLeanType(type, mirrors)} → ${absoluteLeanType(array, mirrors)} → ${absoluteLeanType(array, mirrors)}\n`
				+ "    | 0, _, acc => acc\n    | _, [], acc => acc\n    | fuel + 1, head :: tail, acc => loop fuel tail (acc.push head)\n"
				+ `  loop ${nativeCopyLimit / (model.pointerBits / 8) + 1} value #[]`);
		}
		if(type.kind === "option")
		{
			emit(`lb_t${type.key}_none`, [], type, "_root_.Option.none");
			emit(`lb_t${type.key}_some`, [{ name: "value", type: type.element }], type, "_root_.Option.some value");
			emit(`lb_t${type.key}_has`, [{ name: "value", type }], bool, "match value with | .none => false | .some _ => true");
			emit(`lb_t${type.key}_get0`, [{ name: "value", type }], type.element, `match value with | .none => ${callbackLeanDefault(type.element, mirrors)} | .some item => item`);
		}
		if(type.kind === "result")
		{
			emit(`lb_t${type.key}_has`, [{ name: "value", type }], bool, "match value with | .ok _ => true | .error _ => false");
			for(const [i, branch] of ["ok", "error"].entries())
			{
				emit(`lb_t${type.key}_${branch}`, [{ name: "value", type: type.arguments[i] }], type, `_root_.Except.${branch} value`);
				emit(`lb_t${type.key}_get${i}`, [{ name: "value", type }], type.arguments[i], `match value with | .${branch} item => item | _ => ${callbackLeanDefault(type.arguments[i], mirrors)}`);
			}
		}
		if(type.kind === "tuple")
		{
			emit(`lb_t${type.key}_make`, type.arguments.map((child, i) => ({ name: `a${i}`, type: child })), type, "_root_.Prod.mk a0 a1");
			type.arguments.forEach((child, i) => emit(`lb_t${type.key}_get${i}`, [{ name: "value", type }], child, `value.${i + 1}`));
		}
		if(type.kind === "record")
		{
			const mirrored = mirrors.has(type.lean);
			emit(`lb_t${type.key}_make`, type.fields.map((f, i) => ({ name: `a${i}`, type: f.type })), type, `${mirrored ? `${erasedMirror(type.lean)}.mk` : `_root_.${type.constructor}`} ${type.fields.map((_, i) => `a${i}`).join(" ")}`);
			type.fields.forEach((field, i) => emit(`lb_t${type.key}_get${i}`, [{ name: "value", type }], field.type, mirrored ? `value.«${field.name}»` : `_root_.${field.projection} value`));
		}
		if(type.kind === "variant")
		{
			emit(`lb_t${type.key}_tag`, [{ name: "value", type }], { kind: "primitive", name: "uint32", lean: "UInt32" },
				`match value with ${type.cases.map((branch, i) => `| .${branch.name} ${branch.fields.map(() => "_").join(" ")} => ${i}`).join(" ")}`);
			type.cases.forEach((branch, i) => {
				emit(`lb_t${type.key}_make${i}`, branch.fields.map((f, j) => ({ name: `a${j}`, type: f.type })), type,
					`${mirrors.has(type.lean) ? `${erasedMirror(type.lean)}.«${branch.name}»` : `_root_.${branch.constructor}`} ${branch.fields.map((_, j) => `a${j}`).join(" ")}`);
				branch.fields.forEach((field, j) => emit(`lb_t${type.key}_get${i}_${j}`, [{ name: "value", type }], field.type,
					`match value with | .${branch.name} ${branch.fields.map((_, k) => k === j ? "item" : "_").join(" ")} => item${type.cases.length > 1 ? ` | _ => ${callbackLeanDefault(field.type, mirrors)}` : ""}`));
			});
		}
		if(type.kind === "callback")
		{
			const parameters = type.parameters.map((parameter, i) => ({ name: `value${i}`, type: parameter }));
			const arguments_ = parameters.map(parameter => parameter.name).join(" ");
			// A checked closure answers none for an argument outside its bound; its C caller reports it.
			const answer = type.checked ? { kind: "option", element: type.result, abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } } : type.result;
			emit(`lb_t${type.key}_call`, [{ name: "closure", type }, ...parameters], answer, `closure ${arguments_}`);
			// Only a leased closure is checked, and the host never supplies one, so it has no trampoline.
			if(type.checked) continue;
			// No Perl symbol or Perl interpreter pointer enters the compiled component.
			// A synchronous callback uses a private C trampoline installed by XS.
			lines.push(`@[extern "lb_t${type.key}_invoke"]`, `opaque invoke_${type.key} (token : _root_.USize) ${parameters.map(p => `(${p.name} : ${absoluteLeanType(p.type, mirrors)})`).join(" ")} : ${absoluteLeanType(type.result, mirrors)} := ${callbackLeanDefault(type.result, mirrors)}`, "");
			lines.push(`@[export lb_t${type.key}_wrap]`, `def wrap_${type.key} (token : _root_.USize) : ClosureCarry${type.key} := ⟨fun ${arguments_} => invoke_${type.key} token ${arguments_}⟩`, "");
			prototypes.push(`lean_object * lb_t${type.key}_wrap(size_t token);`);
		}
	}
	// Exact Nat/Int decimal conversion uses checked Lean operations, independent of limb layout.
	emit("lb_native_nat_text", [{ name: "value", type: { kind: "primitive", name: "nat", lean: "Nat" } }], { kind: "primitive", name: "string", lean: "String" }, "_root_.Nat.repr value");
	emit("lb_native_int_text", [{ name: "value", type: { kind: "primitive", name: "int", lean: "Int" } }], { kind: "primitive", name: "string", lean: "String" }, "_root_.Int.repr value");
	emit("lb_native_int_parse", [{ name: "value", type: { kind: "primitive", name: "string", lean: "String" } }], { kind: "primitive", name: "int", lean: "Int" }, "_root_.String.toInt! value");
	lines.push(`end ${module}`, "");
	return { module, leanSource: lines.join("\n"), header: `${prototypes.join("\n")}\n` };
};
