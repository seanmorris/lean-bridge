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
import { validateExportConfiguration } from "./export-configuration.mjs";
import { assertReviewedSourceConfiguration, validateReviewedSourceIdentity, reviewedContractDifference, readReviewedSource } from "./reviewed-source.mjs";

const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const hash = document => sha256(canonicalizeJsonValue(document));
const fail = (code, message, details = {}) => { throw Object.assign(new Error(message), { code, details }); };
const mismatch = (message, details) => fail("reviewed-ir-source-mismatch", message, details);
const unsupported = (message, details) => fail("reviewed-ir-build-unsupported", message, details);
const callbackFailure = { mode: "declared", errors: ["error:native-callback"], unexpected: "poison-runtime" };
const pureFailure = { mode: "none", errors: [], unexpected: "poison-runtime" };

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
	compileOwnedAggregateModel(document);
	const definitions = new Map(document.types.map(type => [type.id, type]));
	const isCallback = type => type.kind === "named" && definitions.get(type.id).kind === "callback";
	const copied = type => type.kind === "primitive" || (type.kind === "named"
		? definitions.get(type.id).representation === "copied" : type.arguments.every(copied));
	const callbacks = document.types.filter(type => type.kind === "callback");
	for(const field of ["capabilities", "assurance"]) reject(document[field].length, field);
	reject(!same(document.errors.map(({ documentation, ...error }) => { void documentation; return error; }), callbacks.length ? [{
		id: "error:native-callback", name: "NativeCallbackFailure"
		, category: "boundary", payload: null
	}] : []), "errors");
	for(const producer of document.producers) reject(Object.keys(producer.extensions).length, `producers.${producer.id}.extensions`);
	const source = (item, callbackName) => {
		reject(callbackName ? item.id !== `bridge:${callbackName}` || item.source.declaration !== callbackName || item.name !== callbackName
			: !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$(?![\s\S])/u.test(item.source.declaration)
				|| item.id !== `lean:${item.source.declaration}`, `${item.id}.source.declaration`);
		reject(Object.keys(item.source.extensions).length, `${item.id}.source.extensions`);
		reject(item.assurance.length, `${item.id}.assurance`);
	};
	const reference = (type, path, nested = false) => {
		reject(nested && isCallback(type), path);
		if(type.kind === "primitive" || type.kind === "named") return;
		const arity = { array: 1, list: 1, option: 1, result: 2, tuple: 2 }[type.constructor];
		reject(type.kind !== "apply" || !arity || type.arguments.length !== arity, path);
		type.arguments.forEach((item, index) => reference(item, `${path}.arguments[${index}]`, true));
	};
	const site = (value, path, result = false) => {
		reference(value.type, `${path}.type`);
		const copy = copied(value.type);
		reject(value.ownership !== (copy ? "copy" : result ? "lease" : "borrow")
			|| !same(value.lifetime, copy ? null : { scope: result ? "explicit" : "call", anchor: null }), path);
	};
	const parameter = (value, path) => {
		reject(value.optional || value.default !== null || value.mutability !== "immutable", path);
		site(value, path);
	};
	for(const definition of document.types)
	{
		reject(!["record", "variant", "alias", "resource", "callback"].includes(definition.kind)
			|| definition.typeParameters.length || definition.host !== null
			|| definition.mutability !== (definition.kind === "resource" ? "read" : "immutable"), definition.id);
		if(definition.kind === "callback")
		{
			const callable = definition.callable;
			const signature = { parameters: callable.parameters.map(value => value.type), result: callable.result.type };
			source(definition, `Callback${sha256(canonicalJson(signature)).slice(0, 20)}`);
			reject(callable.invocation !== "many" || callable.reentry !== "same-agent" || callable.selfDisposal !== "defer"
				|| callable.resultMode !== "value" || !same(callable.effects.toSorted(), ["fails", "host-call"])
				|| !same(callable.failure, callbackFailure) || !callable.parameters.length || callable.parameters.length > 16, `${definition.id}.callable`);
			callable.parameters.forEach((value, index) => parameter(value, `${definition.id}.parameters[${index}]`));
			site(callable.result, `${definition.id}.result`, true);
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
	for(const declaration of document.declarations)
	{
		source(declaration);
		const hasCallback = declaration.parameters.some(value => isCallback(value.type));
		const effects = [...(hasCallback ? ["fails", "host-call"] : [])
			, ...(declaration.parameters.some(value => !copied(value.type)) ? ["reads-resource"] : [])
			, ...(!copied(declaration.result.type) ? ["allocates"] : [])].sort();
		reject(declaration.kind !== "function" || declaration.owner !== null || declaration.receiver !== null
			|| declaration.typeParameters.length || declaration.capabilities.length || declaration.mutability !== "immutable"
			|| declaration.resultMode !== "value" || !same(declaration.effects.toSorted(), effects)
			|| !same(declaration.failure, hasCallback ? callbackFailure : pureFailure), declaration.id);
		declaration.parameters.forEach((value, index) => parameter(value, `${declaration.id}.parameters[${index}]`));
		site(declaration.result, `${declaration.id}.result`, true);
	}
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
	return { exports: document.declarations.map(item => item.source.declaration).sort()
		, resources: document.types.filter(type => type.kind === "resource").map(item => item.source.declaration).sort()
		, arities: document.declarations.filter(item => item.result.type.kind === "named" && callbacks.has(item.result.type.id))
			.map(item => [item.source.declaration, item.parameters.length]).sort(([a], [b]) => a.localeCompare(b))
		, ownedAggregates: structuredClone(document.aggregatePolicy) };
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
	, declarations: document.declarations.map(item => ({ ...item, effects: item.effects.toSorted() }))
	, types: document.types.map(item => item.callable ? { ...item, callable: { ...item.callable, effects: item.callable.effects.toSorted() } } : item) });

const retainAnnotations = (reviewed, compiled) => {
	const declarations = new Map(reviewed.declarations.map(item => [item.id, item]));
	const types = new Map(reviewed.types.map(item => [item.id, item]));
	const errors = new Map(reviewed.errors.map(item => [item.id, item]));
	const fields = (actual, authored) => actual.map((item, index) => ({ ...item, documentation: structuredClone(authored[index].documentation) }));
	const parameters = (actual, authored) => actual.map((item, index) => ({ ...item, name: authored[index].name }));
	return { ...compiled, documentation: structuredClone(reviewed.documentation)
		, declarations: compiled.declarations.map(item => ({ ...item, documentation: structuredClone(declarations.get(item.id).documentation)
			, parameters: parameters(item.parameters, declarations.get(item.id).parameters) }))
		, errors: compiled.errors.map(item => ({ ...item, documentation: structuredClone(errors.get(item.id).documentation) }))
		, types: compiled.types.map(item => {
			const author = types.get(item.id);
			return { ...item, documentation: structuredClone(author.documentation)
				, fields: fields(item.fields, author.fields)
				, cases: item.cases.map((branch, index) => ({ ...branch, documentation: structuredClone(author.cases[index].documentation)
					, fields: fields(branch.fields, author.cases[index].fields) }))
				, callable: item.callable ? { ...item.callable, parameters: parameters(item.callable.parameters, author.callable.parameters) } : null };
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
		|| request.specializations !== undefined || request.contracts !== undefined)
		mismatch("Reviewed contract differs from the authorized compiler selection");
	const field = reviewedContractDifference(normalizeEffects(document), normalizeEffects(compiled));
	if(field) mismatch("Reviewed contract does not match the freshly compiled Lean API", {
		path: review.path, field, reviewedSha256: review.semanticSha256
		, compiledSha256: hash(compiled)
	});
	return validateOwnedAggregateBindingIr(retainAnnotations(document, compiled));
};
