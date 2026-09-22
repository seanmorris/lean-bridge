/**
 * Lower compiler-owned signatures into one language-neutral Binding IR.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { validateBindingIr } from "../binding-ir/contract.mjs";
import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { validateElaboratedMetadata } from "./elaborated-metadata.mjs";
import { exportContractFor, exportContractOwnership, exportContractEffects } from "./export-configuration.mjs";

const doc = summary => ({ summary, details: "" });
const source = declaration => ({ producer: "lean", declaration, extensions: {} });
const identity = type => ["resource", "callback"].includes(type.kind);

/**
 * Give source packages the same component identity in every compiled profile.
 *
 * @param facts - Captured Lake package name and version.
 */
export const elaboratedComponent = facts => ({
	id: `${facts.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[^a-z0-9]+/, "") || "lean-project"}@${facts.version}`
	, name: facts.name, version: facts.version
});

/**
 * Compare source APIs without conflating toolchain-specific evidence with meaning.
 * Source locations and producer hashes remain bound by the complete Binding IR.
 *
 * @param document - Validated compiler-derived Binding IR, before host naming.
 */
export const sourceApiIdentity = document => {
	validateBindingIr(document);
	const declarations = document.declarations.map(declaration => {
		const extensions = { ...declaration.source.extensions };
		delete extensions["lean-lang.org/source-position"];
		return { ...declaration, source: { ...declaration.source, extensions } };
	});
	const api = { schemaVersion: 1, kind: "lean-bridge-source-api"
		, component: document.component
		, types: document.types, declarations, errors: document.errors
		, capabilities: document.capabilities, assurance: document.assurance };
	return Object.freeze({ document: api, sha256: sha256(canonicalJson(api)) });
};

/**
 * Project admitted scalar and native types without applying a consumer's names.
 *
 * @param options - Compiler report and its independently retained invocation.
 * @param options.metadata - Fresh scalar or native compiler report.
 * @param options.request - Authorized request validated against that report.
 * @param options.component - Language-neutral component identity.
 * @param options.elaborationSha256 - Digest of the enclosing compiler evidence.
 * @param options.include - Optional subset of supported selections for partial analysis.
 */
export const createElaboratedSemanticModel = ({ metadata, request, component, elaborationSha256, include }) => {
	validateElaboratedMetadata(metadata, request);
	if(!/^[a-f0-9]{64}$/.test(elaborationSha256)) throw new TypeError("Semantic lowering requires its compiler evidence identity");
	const selected = metadata.modules.flatMap(module => module.declarations).filter(item => item.selected && item.projection.status === "supported");
	if(include && (new Set(include).size !== include.length || include.some(name => !selected.some(item => item.identity === name))))
		throw new TypeError("Semantic lowering can select only admitted compiler declarations");
	const definitions = new Map(), namedFacts = new Map(), namedTypes = new Map();
	const included = selected.filter(item => !include || include.includes(item.identity));
	// Compare a nominal definition by its immediate edges, regardless of whether
	// another export spells its dependencies inline or in a finite graph table.
	// Visit every inline definition, including duplicates, so conflicting nested
	// facts cannot hide behind a previously encountered parent type.
	const remember = type => {
		if(type.kind === "graph")
		{
			type.types.forEach(remember);
			return remember(type.root);
		}
		const value = { ...type };
		if(type.kind === "alias") value.target = remember(type.target);
		if(["array", "list", "option"].includes(type.kind)) value.element = remember(type.element);
		if(["result", "tuple"].includes(type.kind)) value.arguments = type.arguments.map(remember);
		if(type.kind === "record") value.fields = type.fields.map(field => ({ ...field, type: remember(field.type) }));
		if(type.kind === "variant") value.cases = type.cases.map(branch => ({ ...branch, fields: branch.fields.map(field => ({ ...field, type: remember(field.type) })) }));
		if(type.kind === "callback")
		{ value.parameters = type.parameters.map(remember); value.result = remember(type.result); }
		if(!["alias", "record", "variant", "resource"].includes(type.kind)) return value;
		const facts = canonicalJson(value);
		if(namedFacts.has(type.name) && namedFacts.get(type.name) !== facts) throw new TypeError(`Conflicting compiler type definitions: lean:${type.name}`);
		namedFacts.set(type.name, facts); namedTypes.set(type.name, type);
		return { kind: "reference", name: type.name, ...(type.abi ? { lean: type.lean, abi: type.abi } : {}) };
	};
	for(const { projection } of included)
	{
		projection.parameters.forEach(parameter => remember(parameter.type));
		remember(projection.result);
	}
	const callbackFailure = { mode: "declared", errors: ["error:native-callback"], unexpected: "poison-runtime" };
	const site = (type, result = false) => ({ type: reference(type), ...exportContractOwnership(type, result) });
	const parameter = (type, index) => ({ name: `arg${index}`, ...site(type), mutability: "immutable", optional: false, default: null });
	const reference = type => {
		if(type.kind === "graph") return reference(type.root);
		if(type.kind === "reference")
		{
			const target = namedTypes.get(type.name);
			if(!target) throw new TypeError(`Missing compiler type definition: ${type.name}`);
			return reference(target);
		}
		if(type.kind === "primitive") return { kind: "primitive", name: type.name };
		if(["array", "list", "option"].includes(type.kind)) return { kind: "apply", constructor: type.kind, arguments: [reference(type.element)] };
		if(["result", "tuple"].includes(type.kind)) return { kind: "apply", constructor: type.kind, arguments: type.arguments.map(reference) };
		// Callback identity describes its semantic signature, not native boxing or C layout.
		const signature = type.kind === "callback" ? { parameters: type.parameters.map(reference), result: reference(type.result) } : null;
		const callbackName = signature && `Callback${sha256(canonicalJson(signature)).slice(0, 20)}`;
		const id = callbackName ? `bridge:${callbackName}` : `lean:${type.name}`;
		if(!definitions.has(id))
		{
			const definition = { id, name: callbackName || type.name.split(".").at(-1)
				, kind: type.kind, representation: identity(type) ? "identity" : "copied"
				, mutability: type.kind === "resource" ? "read" : "immutable"
				, typeParameters: [], fields: [], target: null, resource: null
				, callable: null, cases: [], host: null
				, documentation: doc(callbackName ? "Checked Lean callback." : `Checked Lean ${type.name}.`)
				, source: source(type.name ?? callbackName), assurance: [] };
			definitions.set(id, definition);
			if(type.kind === "alias") definition.target = reference(type.target);
			if(type.kind === "record") definition.fields = type.fields.map(field => ({ name: field.name, type: reference(field.type), mutability: "immutable", documentation: doc(field.name) }));
			if(type.kind === "variant") definition.cases = type.cases.map(item => ({ name: item.name
				, fields: item.fields.map(field => ({ name: field.name, type: reference(field.type), mutability: "immutable", documentation: doc(field.name) }))
				, documentation: doc(item.name) }));
			if(type.kind === "resource") definition.resource = { kindId: `resource:${type.name}`, disposal: "required", fallback: "queued-finalizer", cycles: "explicit-cut" };
			if(type.kind === "callback") definition.callable = {
				parameters: type.parameters.map(parameter), result: site(type.result, true)
				, effects: ["host-call", "fails"], failure: callbackFailure
				, resultMode: "value", invocation: "many", reentry: "same-agent"
				, selfDisposal: "defer" };
		}
		return { kind: "named", id };
	};
	const declarations = included.map(item => {
		const { projection } = item;
		const hasCallback = projection.parameters.some(parameter => parameter.type.kind === "callback");
		return { id: `lean:${item.identity}`, name: item.identity.split(".").at(-1)
			, kind: "function", owner: null, overloadKey: item.identity
			, typeParameters: [], receiver: null
			, parameters: projection.parameters.map((p, i) => parameter(p.type, i))
			, result: site(projection.result, true), mutability: "immutable"
			, effects: exportContractEffects(projection)
			, failure: hasCallback ? callbackFailure : { mode: "none", errors: [], unexpected: "poison-runtime" }
			, resultMode: "value", capabilities: [], assurance: []
			, documentation: doc(item.documentation ?? `Call ${item.identity}.`)
			, source: { producer: "lean"
				, declaration: item.specialization?.declaration ?? item.identity
				, extensions: { "lean-lang.org/theorem-references": item.theoremReferences
					, "lean-lang.org/source-position": item.source
					, ...(item.specialization ? { "lean-lang.org/specialization": { name: item.identity, ...item.specialization } } : {})
					, ...(exportContractFor(request.contracts, item.identity) ? { "lean-lang.org/export-contract": request.contracts[item.identity] } : {}) } } };
	}).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
	const errors = [...definitions.values()].some(type => type.kind === "callback") ? [{
		id: "error:native-callback", name: "NativeCallbackFailure"
		, category: "boundary", payload: null
		, documentation: doc("A synchronous host callback failed; the adapter preserves the exception after cleanup.")
	}] : [];
	const document = { schemaVersion: 3, component
		, producers: [{ id: "lean", adapter: metadata.producer.adapter
			, adapterVersion: metadata.producer.adapterVersion, tool: "Lean"
			, toolVersion: metadata.producer.toolVersion
			, extensions: { "lean-lang.org/toolchain": request.metadata.toolchain, "lean-lang.org/elaboration-sha256": elaborationSha256 } }]
		, types: [...definitions.values()].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
		, declarations, errors, capabilities: [], assurance: []
		, documentation: doc(`Compiler-checked exports for ${component.name}.`) };
	if(declarations.length) validateBindingIr(document);
	return Object.freeze({ document, semanticSha256: declarations.length ? hashBindingIr(document) : null });
};
