/**
 * Reconcile explicitly owned reviews with fresh compiler-owned type graphs.
 * Version 3 readers and builders remain closed to these version 4 contracts.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { canonicalizeJsonValue, BindingIrCanonicalError } from "../binding-ir/canonical.mjs";
import { validateOwnedAggregateBindingIr } from "../binding-ir/contract.mjs";
import { compileOwnedAggregateModel } from "../abi/owned-aggregate-model.mjs";
import {
	callbackDefinitionRefinement, callbackSubtypeDirection
	, declarationRefinements
} from "../abi/refinements.mjs";
import { validateExportConfiguration } from "./export-configuration.mjs";
import { callbackSemanticSignature } from "./callback-signature.mjs";
import { checkedRefinementSelection } from "./checked-refinement-selection.mjs";
import { createMetadataRequest } from "./elaborated-metadata.mjs";
import { assertReviewedSourceConfiguration, validateReviewedSourceIdentity, reviewedContractDifference, readReviewedSource } from "./reviewed-source.mjs";

const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const hash = document => sha256(canonicalizeJsonValue(document));
const fail = (code, message, details = {}) => { throw Object.assign(new Error(message), { code, details }); };
const mismatch = (message, details) => fail("reviewed-ir-source-mismatch", message, details);
const unsupported = (message, details) => fail("reviewed-ir-build-unsupported", message, details);
const callbackFailure = { mode: "declared", errors: ["error:native-callback"], unexpected: "poison-runtime" };
const pureFailure = { mode: "none", errors: [], unexpected: "poison-runtime" };

const validErasedProofs = (item, value) => {
	if(value === null || typeof value !== "object" || Array.isArray(value)
		|| !same(Object.keys(value), ["parameters"]) || !Array.isArray(value.parameters)
		|| !value.parameters.length || value.parameters.length > 1024) return false;
	const sourceArity = item.parameters.length + value.parameters.length;
	let previous = -1;
	for(const proof of value.parameters)
	{
		if(proof === null || typeof proof !== "object" || Array.isArray(proof)
			|| !same(Object.keys(proof).sort(), ["name", "proposition", "sourceIndex", "witness"])
			|| !Number.isSafeInteger(proof.sourceIndex) || proof.sourceIndex <= previous
			|| proof.sourceIndex >= sourceArity || typeof proof.name !== "string" || !proof.name.length
			|| typeof proof.proposition !== "string" || !proof.proposition.length
			|| proof.witness !== "True.intro") return false;
		previous = proof.sourceIndex;
	}
	return true;
};

const parse = source => {
	let document;
	try
	{ document = JSON.parse(source); }
	catch(cause)
	{ throw new BindingIrCanonicalError("invalid-json", "Binding IR is not valid JSON", { cause: cause.message }); }
	validateOwnedAggregateBindingIr(document);
	return document;
};

const checkReview = document => {
	const reject = (condition, path) => {
		if(condition) unsupported(`Reviewed owned builds do not support this decision: ${path}`, { path });
	};
	const definitions = new Map(document.types.map(type => [type.id, type]));
	const isCallback = type => type.kind === "named"
		&& definitions.get(type.id)?.kind === "callback";
	const copied = type => type.kind === "primitive" || (type.kind === "named"
		? definitions.get(type.id).representation === "copied" : type.arguments.every(copied));
	const callbacks = new Map(document.types.filter(type => type.kind === "callback")
		.map(type => [type.id, type]));
	for(const field of ["capabilities", "assurance"]) reject(document[field].length, field);
	reject(!same(document.errors.map(({ documentation, ...error }) => { void documentation; return error; }), callbacks.size ? [{
		id: "error:native-callback", name: "NativeCallbackFailure"
		, category: "boundary", payload: null
	}] : []), "errors");
	for(const producer of document.producers) reject(Object.keys(producer.extensions).length, `producers.${producer.id}.extensions`);
	const source = (item, callbackName, declaration = false) => {
		reject(callbackName ? item.id !== `bridge:${callbackName}` || item.source.declaration !== callbackName || item.name !== callbackName
			: !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$(?![\s\S])/u.test(item.source.declaration)
				|| item.id !== `lean:${item.source.declaration}`, `${item.id}.source.declaration`);
		const refinementKey = "lean-lang.org/refinements", erasedProofsKey = "lean-lang.org/erased-proofs";
		// A checked record names its erased proof fields once, whether its value is copied or
		// owned; every other definition and every declaration-level key stays closed.
		const record = !declaration && !callbackName && item.kind === "record";
		let allowed = [];
		if(declaration) allowed = [refinementKey, erasedProofsKey];
		else if(callbackName) allowed = [refinementKey];
		else if(record) allowed = [erasedProofsKey];
		reject(Object.keys(item.source.extensions).some(key => !allowed.includes(key))
			, `${item.id}.source.extensions`);
		if(record && Object.hasOwn(item.source.extensions, erasedProofsKey))
		{
			const erased = item.source.extensions[erasedProofsKey];
			reject(!erased || typeof erased !== "object" || Array.isArray(erased) || Object.keys(erased).join() !== "fields"
				|| !Array.isArray(erased.fields) || !erased.fields.length || erased.fields.length > 1024 || new Set(erased.fields).size !== erased.fields.length
				|| erased.fields.some(name => typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_']*$/u.test(name) || item.fields.some(field => field.name === name))
			, `${item.id}.source.extensions.${erasedProofsKey}`);
		}
		if(declaration && Object.hasOwn(item.source.extensions, erasedProofsKey))
			reject(!validErasedProofs(item, item.source.extensions[erasedProofsKey])
				, `${item.id}.source.extensions.${erasedProofsKey}`);
		if((declaration || callbackName)
			&& Object.hasOwn(item.source.extensions, refinementKey)){
			try
			{
				if(declaration) declarationRefinements(
					item, item.source.extensions[refinementKey], document.types
					, { ownedStructural: true }
				);
				else callbackDefinitionRefinement(
					item, document.types, { ownedStructural: true }
				);
			}
			catch
			{ unsupported("Reviewed owned refinement decisions must match their transport signature", { path: `${item.id}.source.extensions.${refinementKey}` }); }
			}
		reject(item.assurance.length, `${item.id}.assurance`);
	};
	const reference = (type, path, nested = false) => {
		reject(nested && isCallback(type), path);
		if(type.kind === "primitive" || type.kind === "named") return;
		const arity = { array: 1, list: 1, option: 1, result: 2, tuple: 2 }[type.constructor];
		reject(type.kind !== "apply" || !arity || type.arguments.length !== arity, path);
		type.arguments.forEach((item, index) => reference(item, `${path}.arguments[${index}]`, true));
	};
	const site = (value, path, result = false, transfers = false, anchors = false) => {
		reference(value.type, `${path}.type`);
		const copy = copied(value.type);
		if(transfers && !copy && !result && value.ownership === "transfer"
			&& ["call", "explicit"].includes(value.lifetime?.scope) && value.lifetime.anchor === null) return;
		if(anchors && !copy && result && value.ownership === "borrow" && ["parameter", "receiver"].includes(value.lifetime?.scope)) return;
		reject(value.ownership !== (copy ? "copy" : result ? "lease" : "borrow")
			|| !same(value.lifetime, copy ? null : { scope: result ? "explicit" : "call", anchor: null }), path);
		if(isCallback(value.type))
		{
			const definition = callbacks.get(value.type.id);
			const refinement = callbackDefinitionRefinement(
				definition, document.types, { ownedStructural: true }
			);
			if(refinement !== null)
			{
				const direction = callbackSubtypeDirection({
					parameters: definition.callable.parameters.map(parameter => parameter.type)
					, result: definition.callable.result.type
				}, refinement, document.types, { ownedStructural: true });
				reject(direction !== null && direction !== (result ? "closure" : "host")
					, `${path}.type`);
			}
		}
	};
	const parameter = (value, path, transfers = false) => {
		reject(value.optional || value.default !== null || value.mutability !== "immutable", path);
		site(value, path, false, transfers);
	};
	for(const definition of document.types)
	{
		reject(!["record", "variant", "alias", "resource", "callback"].includes(definition.kind)
			|| definition.typeParameters.length || definition.host !== null
			|| definition.mutability !== (definition.kind === "resource" ? "read" : "immutable"), definition.id);
		if(definition.kind === "callback")
		{
			const callable = definition.callable;
			const refinement = definition.source.extensions["lean-lang.org/refinements"];
			const signature = { ...callbackSemanticSignature(callable)
				, ...(refinement === undefined ? {} : { refinements: refinement }) };
			source(definition, `Callback${sha256(canonicalJson(signature)).slice(0, 20)}`);
			reject(callable.invocation !== "many" || callable.reentry !== "same-agent" || callable.selfDisposal !== "defer"
				|| callable.resultMode !== "value" || !same(callable.effects.toSorted(), ["fails", "host-call"])
				|| !same(callable.failure, callbackFailure) || !callable.parameters.length || callable.parameters.length > 16, `${definition.id}.callable`);
			callable.parameters.forEach((value, index) => parameter(value, `${definition.id}.parameters[${index}]`));
			site(callable.result, `${definition.id}.result`, true, false, true);
			continue;
		}
		source(definition);
		if(definition.kind === "resource")
			reject(definition.resource.kindId !== `resource:${definition.source.declaration}`, `${definition.id}.resource.kindId`);
		if(definition.target) reference(definition.target, `${definition.id}.target`, true);
		const fields = definition.kind === "variant" ? definition.cases.flatMap(branch => branch.fields) : definition.fields;
		for(const field of fields)
		{
			reject(field.mutability !== "immutable", `${definition.id}.${field.name}.mutability`);
			reference(field.type, `${definition.id}.${field.name}.type`, true);
		}
	}
	// Every consumed occurrence of a checked record, copied or owned, names its exact
	// constructor; a produced occurrence names none. A null tree is valid only for a top-level
	// produced position, where Lean already holds the proof. Receivers keep their established
	// boundary and never carry a checked record in a reviewed owned build.
	const erasedProofsKey = "lean-lang.org/erased-proofs";
	const checked = definition => Object.hasOwn(definition?.source?.extensions ?? {}, erasedProofsKey);
	const reachesChecked = (type, seen = new Set()) => {
		if(type?.kind === "apply") return type.arguments.some(child => reachesChecked(child, seen));
		if(type?.kind !== "named" || seen.has(type.id)) return false;
		const definition = definitions.get(type.id), inner = new Set([...seen, type.id]);
		if(!definition || definition.kind === "resource") return false;
		if(definition.kind === "callback") return [...definition.callable.parameters, definition.callable.result].some(value => reachesChecked(value.type, inner));
		if(checked(definition)) return true;
		if(definition.kind === "alias") return reachesChecked(definition.target, inner);
		const fields = definition.kind === "variant" ? definition.cases.flatMap(branch => branch.fields) : definition.fields;
		return fields.some(field => reachesChecked(field.type, inner));
	};
	const checkedRecordCoverage = (type, tree, produced, depth = 0, seen = new Set()) => {
		if(type?.kind === "apply")
		{
			const children = tree?.arguments ?? type.arguments.map(() => null);
			if(tree !== null && tree !== undefined && (!Array.isArray(children) || children.length !== type.arguments.length)) return false;
			return type.arguments.every((child, index) => checkedRecordCoverage(child, children[index], produced, depth + 1, seen));
		}
		if(type?.kind !== "named") return true;
		const definition = definitions.get(type.id);
		if(!definition) return false;
		if(seen.has(type.id)) return !checked(definition) || tree === null || tree === undefined;
		if(definition.kind === "resource") return true;
		if(definition.kind === "callback")
			return !reachesChecked(type)
				|| callbackDefinitionRefinement(
					definition, document.types, { ownedStructural: true }
				) !== null;
		const inner = new Set([...seen, type.id]);
		if(definition.kind === "alias") return checkedRecordCoverage(definition.target, tree, produced, depth, inner);
		if(checked(definition))
		{
			if(tree === null || tree === undefined) return produced && depth === 0;
			if(tree.kind !== "checked-record" || (produced ? tree.constructor !== null : typeof tree.constructor !== "string")) return false;
			if(tree.name !== definition.source.declaration || !Array.isArray(tree.fields) || tree.fields.length !== definition.fields.length) return false;
			return definition.fields.every((field, index) => tree.fields[index]?.name === field.name
				&& checkedRecordCoverage(field.type, tree.fields[index].refinement, produced, depth + 1, inner));
		}
		if(definition.kind === "record")
		{
			const fields = tree?.kind === "record" ? tree.fields : definition.fields.map(() => null);
			return definition.fields.every((field, index) => checkedRecordCoverage(field.type, fields[index]?.refinement ?? null, produced, depth + 1, inner));
		}
		const cases = tree?.kind === "variant" ? tree.cases : definition.cases.map(branch => ({ fields: branch.fields.map(() => null) }));
		return definition.cases.every((branch, index) => branch.fields.every((field, position) =>
			checkedRecordCoverage(field.type, cases[index]?.fields[position]?.refinement ?? null, produced, depth + 1, inner)));
	};
	// A callback reaching a checked record needs an authenticated direction; each of its
	// positions then follows the declaration rule for whoever produces it there. Host
	// callbacks receive Lean-produced parameters and return a consumed result; returned
	// closures are the reverse.
	for(const definition of callbacks.values())
	{
		if(!reachesChecked({ kind: "named", id: definition.id })) continue;
		const refinement = callbackDefinitionRefinement(
			definition, document.types, { ownedStructural: true }
		);
		const direction = refinement === null ? null : callbackSubtypeDirection({
			parameters: definition.callable.parameters.map(parameter => parameter.type)
			, result: definition.callable.result.type
		}, refinement, document.types, { ownedStructural: true });
		reject(direction === null, `${definition.id}.callable`);
		for(const [index, value] of definition.callable.parameters.entries())
			reject(!checkedRecordCoverage(value.type, refinement.parameters[index]
				, direction === "host"), `${definition.id}.parameters[${index}]`);
		reject(!checkedRecordCoverage(definition.callable.result.type, refinement.result
			, direction === "closure"), `${definition.id}.result`);
	}
	for(const declaration of document.declarations)
	{
		const refinements = declaration.source.extensions["lean-lang.org/refinements"];
		if(declaration.receiver) reject(!checkedRecordCoverage(declaration.receiver.type, null, false), `${declaration.id}.receiver`);
		for(const [index, value] of declaration.parameters.entries())
			reject(!checkedRecordCoverage(value.type, refinements?.parameters?.[index] ?? null, false), `${declaration.id}.parameters[${index}]`);
		reject(!checkedRecordCoverage(declaration.result.type, refinements?.result ?? null, true), `${declaration.id}.result`);
	}
	for(const declaration of document.declarations)
	{
		source(declaration, undefined, true);
		const inputs = [...declaration.receiver ? [declaration.receiver] : [], ...declaration.parameters];
		const hasCallback = declaration.parameters.some(value => isCallback(value.type));
		const effects = [...(hasCallback ? ["fails", "host-call"] : [])
			, ...(inputs.some(value => !copied(value.type)) ? ["reads-resource"] : [])
			, ...(!copied(declaration.result.type) ? ["allocates"] : [])].sort();
		reject(!["function", "method", "property"].includes(declaration.kind)
			|| (declaration.kind === "property" && declaration.parameters.length !== 0)
			|| declaration.typeParameters.length || declaration.capabilities.length || declaration.mutability !== "immutable"
			|| declaration.resultMode !== "value" || !same(declaration.effects.toSorted(), effects)
			|| !same(declaration.failure, hasCallback ? callbackFailure : pureFailure), declaration.id);
		if(declaration.receiver)
		{
			reject(declaration.receiver.mutability !== "immutable", `${declaration.id}.receiver`);
			site(declaration.receiver, `${declaration.id}.receiver`, false, true);
		}
		declaration.parameters.forEach((value, index) => parameter(value, `${declaration.id}.parameters[${index}]`, true));
		site(declaration.result, `${declaration.id}.result`, true, false, true);
	}
	compileOwnedAggregateModel(document);
	return document;
};

/**
 * Validate a v4 review without accepting author-supplied compiler evidence.
 *
 * @param review - Captured source bytes and raw/semantic identities.
 */
export const validateReviewedOwnedSource = review => {
	validateReviewedSourceIdentity(review);
	const document = parse(review.source);
	if(hash(document) !== review.semanticSha256) mismatch("Reviewed contract digest differs from its retained source");
	return checkReview(document);
};

/**
 * Select exports, resource identities, closure arities and aggregate policy.
 *
 * @param review - Independently authored owned-value contract.
 */
export const reviewedOwnedSourceSelection = review => {
	const document = validateReviewedOwnedSource(review);
	const callbacks = new Set(document.types.filter(type => type.kind === "callback").map(type => type.id));
	const types = new Map(document.types.map(type => [type.id, type]));
	const selected = new Map(), active = new Set();
	const decision = (value, inputs, callable, refinement) => {
		const selected = refinement === undefined ? null : checkedRefinementSelection(refinement);
		return { ownership: value.ownership
			, lifetime: value.lifetime?.scope === "parameter" ? { scope: "parameter"
				, anchor: `arg${inputs.findIndex(input => input.name === value.lifetime.anchor)}` } : structuredClone(value.lifetime)
			, ...callable ? { callable } : {}
			, ...(selected === null ? {} : { refinement: selected }) };
	};
	const callableDecision = type => {
		if(type.kind !== "named" || !callbacks.has(type.id)) return undefined;
		if(selected.has(type.id)) return selected.get(type.id);
		if(active.has(type.id)) unsupported("Recursive callable signatures require a finite compiler signature", { type: type.id });
		active.add(type.id);
		const callable = types.get(type.id).callable;
		const refinements = types.get(type.id).source.extensions["lean-lang.org/refinements"];
		const parameters = callable.parameters.map(value => callableDecision(value.type));
		const result = callableDecision(callable.result.type);
		const value = parameters.some(Boolean) || result
			|| callable.result.ownership === "borrow" || refinements ? {
				...parameters.some(Boolean) || refinements ? {
					parameters: callable.parameters.map((value, index) => decision(
						value, callable.parameters, parameters[index]
						, refinements?.parameters[index]
					))
				} : {}
				, ...result || callable.result.ownership === "borrow" || refinements ? {
					result: decision(callable.result, callable.parameters, result
						, refinements?.result)
				} : {}
			} : undefined;
		active.delete(type.id); selected.set(type.id, value); return value;
	};
	const contracts = Object.fromEntries(document.declarations
		.map(item => {
			const inputs = [...item.receiver ? [item.receiver] : [], ...item.parameters];
			const refinements = item.source.extensions["lean-lang.org/refinements"];
			const parameters = inputs.map(value => callableDecision(value.type));
			const result = callableDecision(item.result.type);
			return [item.source.declaration, {
				...item.receiver ? { receiver: item.kind } : {}
				, ...parameters.some(Boolean) || inputs.some(value => value.ownership === "transfer") || refinements?.parameters.some(value => value !== null)
					? { parameters: inputs.map((value, index) => decision(value, inputs, parameters[index], refinements?.parameters[index])) } : {}
				, ...item.result.ownership === "borrow" || result
					? { result: decision(item.result, inputs, result, refinements?.result) } : {}
			}];
		})
		.filter(([, contract]) => Object.keys(contract).length)
		.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
	return { exports: document.declarations.map(item => item.source.declaration).sort()
		, resources: document.types.filter(type => type.kind === "resource").map(item => item.source.declaration).sort()
		, arities: document.declarations.filter(item => item.result.type.kind === "named" && callbacks.has(item.result.type.id))
			.map(item => [item.source.declaration, item.parameters.length + Number(item.receiver !== null)]).sort(([a], [b]) => a.localeCompare(b))
		, ownedAggregates: structuredClone(document.aggregatePolicy)
		, ...(Object.keys(contracts).length ? { contracts } : {}) };
};

/**
 * Capture one v4 review before compilation in an ownership-aware build.
 *
 * @param projectRoot - Read-only Lean source root.
 * @param inventory - Independently captured source and configuration inputs.
 * @param signal - Optional cancellation signal.
 */
export const readReviewedOwnedSource = async (projectRoot, inventory, signal) => {
	const inputs = inventory.inputs.filter(input => input.path.endsWith(".binding-ir.json"));
	if(!inputs.length) return null;
	const paths = inputs.map(input => input.path).sort();
	if(inputs.length !== 1) unsupported("Compilation requires exactly one reviewed Binding IR", { paths });
	const config = inventory.configurationRecord.configuration;
	validateExportConfiguration(config); assertReviewedSourceConfiguration(config);
	if(!config.modules?.length) unsupported("Set modules in lean-bridge.exports.json to authorize the reviewed contract's Lean source roots", { paths });
	signal?.throwIfAborted();
	const bytes = await readFile(join(projectRoot, inputs[0].path), { signal });
	if(bytes.length !== inputs[0].bytes || sha256(bytes) !== inputs[0].sha256) mismatch("Reviewed contract changed after source capture");
	const source = bytes.toString("utf8"), document = parse(source);
	const review = { schemaVersion: 1, path: inputs[0].path, source, sourceSha256: sha256(bytes), semanticSha256: hash(document) };
	validateReviewedOwnedSource(review);
	return review;
};

/**
 * Read a review with the explicitly selected native transport's capabilities.
 * Default and unsupported targets keep the existing v3 rejection behavior.
 *
 * @param projectRoot - Original Lean project.
 * @param inventory - Captured source inputs.
 * @param signal - Optional cancellation signal.
 * @param ownedGraphs - Whether this caller implements the owned transport.
 */
export const readNativeReviewedSource = async (projectRoot, inventory, signal, ownedGraphs = false) => {
	try
	{ return await readReviewedSource(projectRoot, inventory, signal); }
	catch(error)
	{
		if(!ownedGraphs || error.code !== "consumer-upgrade-required") throw error;
		return readReviewedOwnedSource(projectRoot, inventory, signal);
	}
};

/**
 * Bind a retained v4 review to its independently captured source-notice input.
 *
 * @param sourceIdentity - Measured compilation identity containing the review.
 * @param inputs - Verified root input identities.
 */
export const verifyReviewedOwnedSourceInputs = (sourceIdentity, inputs) => {
	const reviews = inputs.filter(input => input.path.endsWith(".binding-ir.json"));
	const review = sourceIdentity.reviewedBindingIr;
	if(review === undefined && !reviews.length) return;
	validateReviewedOwnedSource(review);
	if(reviews.length !== 1 || reviews[0].path !== review.path || reviews[0].sha256 !== review.sourceSha256
		|| reviews[0].bytes !== Buffer.byteLength(review.source)) mismatch("Reviewed contract differs from captured source inputs");
};

const normalizeEffects = document => ({ ...document
	, declarations: document.declarations.map(item => ({ ...item, effects: item.effects.toSorted()
		, result: item.result.ownership === "borrow" && item.result.lifetime.scope === "parameter"
			? { ...item.result, lifetime: { scope: "parameter", anchor: `arg${item.parameters.findIndex(value => value.name === item.result.lifetime.anchor) + Number(item.receiver !== null)}` } } : item.result }))
	, types: document.types.map(item => item.callable ? { ...item, callable: { ...item.callable, effects: item.callable.effects.toSorted()
		, result: item.callable.result.ownership === "borrow" && item.callable.result.lifetime.scope === "parameter"
			? { ...item.callable.result, lifetime: { scope: "parameter"
				, anchor: `arg${item.callable.parameters.findIndex(value => value.name === item.callable.result.lifetime.anchor)}` } } : item.callable.result
	} } : item) });

const retainAnnotations = (reviewed, compiled) => {
	const declarations = new Map(reviewed.declarations.map(item => [item.id, item]));
	const types = new Map(reviewed.types.map(item => [item.id, item]));
	const errors = new Map(reviewed.errors.map(item => [item.id, item]));
	const fields = (actual, authored) => actual.map((item, index) => ({ ...item, documentation: structuredClone(authored[index].documentation) }));
	const parameters = (actual, authored) => actual.map((item, index) => ({ ...item, name: authored[index].name }));
	const result = (item, authored) => item.result.ownership === "borrow" && item.result.lifetime.scope === "parameter"
		? { ...item.result, lifetime: { scope: "parameter"
			, anchor: authored.parameters[item.parameters.findIndex(value => value.name === item.result.lifetime.anchor)].name } }
		: item.result;
	return { ...compiled, documentation: structuredClone(reviewed.documentation)
		, declarations: compiled.declarations.map(item => ({ ...item, documentation: structuredClone(declarations.get(item.id).documentation)
			, result: result(item, declarations.get(item.id))
			, parameters: parameters(item.parameters, declarations.get(item.id).parameters) }))
		, errors: compiled.errors.map(item => ({ ...item, documentation: structuredClone(errors.get(item.id).documentation) }))
		, types: compiled.types.map(item => {
			const author = types.get(item.id);
			return { ...item, documentation: structuredClone(author.documentation)
				, fields: fields(item.fields, author.fields)
				, cases: item.cases.map((branch, index) => ({ ...branch, documentation: structuredClone(author.cases[index].documentation)
					, fields: fields(branch.fields, author.cases[index].fields) }))
				, callable: item.callable ? { ...item.callable, parameters: parameters(item.callable.parameters, author.callable.parameters)
					, result: result(item.callable, author.callable) } : null };
		})
	};
};

/**
 * Reconcile ownership, ordered value shapes and signatures against fresh Lean.
 * Retain annotations only; layouts, producers and proof references stay compiled.
 *
 * @param review - Captured independently authored v4 document.
 * @param compiled - Fresh validated compiler semantic projection.
 * @param sourceIdentity - Authorized request and measured source identities.
 */
export const reconcileReviewedOwnedSource = (review, compiled, sourceIdentity) => {
	const document = validateReviewedOwnedSource(review);
	validateOwnedAggregateBindingIr(compiled);
	const config = JSON.parse(sourceIdentity.exportConfigurationSource ?? "null");
	validateExportConfiguration(config); assertReviewedSourceConfiguration(config);
	const request = sourceIdentity.request, selection = reviewedOwnedSourceSelection(review);
	if(!config.modules?.length || sha256(canonicalJson(config)) !== sourceIdentity.exportConfigurationSha256
		|| !same(sourceIdentity.reviewedBindingIr, review)
		|| !same(config.modules.toSorted(), request.exportModules.toSorted())
		|| !same(request.exports.toSorted(), selection.exports) || !same(request.resources.toSorted(), selection.resources)
		|| !same(request.arities, selection.arities) || !same(request.ownedAggregates, selection.ownedAggregates)
		|| request.specializations !== undefined || !same(request.contracts ?? null, selection.contracts ?? null))
		mismatch("Reviewed contract differs from the authorized compiler selection");
	const field = reviewedContractDifference(normalizeEffects(document), normalizeEffects(compiled));
	if(field) mismatch("Reviewed contract does not match the freshly compiled Lean API", {
		path: review.path, field, reviewedSha256: review.semanticSha256
		, compiledSha256: hash(compiled)
	});
	return validateOwnedAggregateBindingIr(retainAnnotations(document, compiled));
};

/**
 * Reconcile an owned review without compiling adapters or inventing build evidence.
 *
 * @param inventory - Independently captured source and author configuration.
 * @param elaboration - Fresh interface metadata and its retained invocation.
 * @param compiled - Language-neutral ownership projection from that metadata.
 */
export const reconcileReviewedOwnedElaboration = (inventory, elaboration, compiled) => {
	const { reviewedBindingIr, request } = elaboration;
	verifyReviewedOwnedSourceInputs(elaboration, inventory.inputs);
	if(reviewedBindingIr === undefined) return compiled;
	const { metadata, ...selection } = request;
	const expected = createMetadataRequest(selection, { toolchain: inventory.project.toolchain
		, snapshotSha256: elaboration.snapshotSha256
		, generatedSourcesSha256: elaboration.generatedSourcesSha256
		, leanCompilerSha256: elaboration.leanCompilerSha256
		, extractorSha256: elaboration.extractorSha256
		, reviewedBindingIrSha256: sha256(canonicalJson(reviewedBindingIr))
		, modules: metadata.modules });
	if(!same(request, expected)) mismatch("Reviewed owned invocation differs from retained compiler/source evidence");
	return reconcileReviewedOwnedSource(reviewedBindingIr, compiled, {
		request, reviewedBindingIr
		, exportConfigurationSource: canonicalJson(inventory.configurationRecord.configuration)
		, exportConfigurationSha256: inventory.configurationRecord.sha256
	});
};
