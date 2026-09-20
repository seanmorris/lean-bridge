/**
 * Independently specified reviewed contracts for the two corpus libraries.
 * These documents are analysis inputs, never compiler or runtime evidence.
 *
 * @file
 */
import { corpusSignatures } from "../fixtures/type-corpus/cases.mjs";

const documentation = () => ({ summary: "Independent corpus contract.", details: "" });
const source = declaration => ({ producer: "corpusReview", declaration, extensions: {} });
const typeReference = type => typeof type === "string" ? { kind: "primitive", name: type }
	: type.array ? { kind: "apply", constructor: "array", arguments: [typeReference(type.array)] }
		: type.option ? { kind: "apply", constructor: "option", arguments: [typeReference(type.option)] }
			: type.result ? { kind: "apply", constructor: "result", arguments: type.result.map(typeReference) }
				: type.tuple ? { kind: "apply", constructor: "tuple", arguments: type.tuple.map(typeReference) }
					: { kind: "named", id: `lean:${type.record}` };

/**
 * Describe the catalog API without importing a compiler model or Alpha fixture.
 *
 * @param library - Independent library and its expected signatures.
 * @param signatures - Optional independently selected signatures for a narrower ABI.
 */
export const corpusReviewedIr = (library, signatures = corpusSignatures(library)) => {
	const records = new Map();
	const visit = type => {
		if(type.array) visit(type.array);
		if(type.option) visit(type.option);
		if(type.result || type.tuple) (type.result ?? type.tuple).forEach(visit);
		if(type.record && !records.has(type.record))
		{ records.set(type.record, type); Object.values(type.fields).forEach(visit); }
	};
	signatures.flatMap(signature => [...signature.parameters, signature.result]).forEach(visit);
	return { schemaVersion: 3
		, component: { id: `${library.id}@1.0.0`, name: library.id, version: "1.0.0" }
		, producers: [{ id: "corpusReview"
			, adapter: "independent-corpus-contract", adapterVersion: 1
			, tool: "Corpus contract review", toolVersion: "1", extensions: {} }]
		, types: [...records.values()].map(type => ({ id: `lean:${type.record}`
			, name: type.record.split(".").at(-1), kind: "record"
			, representation: "copied", mutability: "immutable"
			, typeParameters: []
			, fields: Object.entries(type.fields).map(([name, field]) => ({ name
				, type: typeReference(field), mutability: "immutable"
				, documentation: documentation() }))
			, target: null, resource: null, callable: null, cases: [], host: null
			, documentation: documentation(), source: source(type.record)
			, assurance: [] }))
		, declarations: signatures.map(signature => ({ id: `lean:${signature.name}`
			, name: signature.name.split(".").at(-1), kind: "function", owner: null
			, overloadKey: signature.name, typeParameters: [], receiver: null
			, parameters: signature.parameters.map((type, index) => ({ name: `value${index}`
				, type: typeReference(type), ownership: "copy", lifetime: null
				, mutability: "immutable"
				, optional: false, default: null }))
			, result: { type: typeReference(signature.result), ownership: "copy", lifetime: null }
			, mutability: "immutable", effects: []
			, failure: { mode: "none", errors: [], unexpected: "poison-runtime" }
			, resultMode: "value", capabilities: [], assurance: []
			, documentation: documentation()
			, source: source(signature.name) }))
		, errors: [], capabilities: [], assurance: []
		, documentation: documentation() };
};
