/**
 * Reconcile a reviewed copied-value or synchronous primitive callable contract
 * with fresh compiler-owned facts.
 * Review documents select declarations, never native layouts or proof evidence.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { hashBindingIr, parseBindingIr } from "../binding-ir/canonical.mjs";
import { validateExportConfiguration } from "./export-configuration.mjs";
import { createMetadataRequest } from "./elaborated-metadata.mjs";

const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const fail = (code, message, details = {}) => { throw Object.assign(new Error(message), { code, details }); };
const unsupported = (message, details) => fail("reviewed-ir-build-unsupported", message, details);
const mismatch = (message, details) => fail("reviewed-ir-source-mismatch", message, details);
const leanName = value => typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/.test(value);
const ordered = values => values.toSorted();
const callbackFailure = { mode: "declared", errors: ["error:native-callback"], unexpected: "poison-runtime" };
const pureFailure = { mode: "none", errors: [], unexpected: "poison-runtime" };

/**
 * Modules authorize compilation roots; the review owns all export decisions.
 *
 * @param configuration - Validated shared export configuration.
 */
export const assertReviewedSourceConfiguration = configuration => {
	if(["exports", "resources", "arities", "specializations", "contracts"].some(key => configuration[key] !== undefined))
		fail("export-configuration-reviewed-ir", "Keep export decisions in the reviewed Binding IR; modules may select its Lean source roots");
};

const checkReview = document => {
	const reject = (condition, path) => {
		if(condition) unsupported(`Reviewed builds do not support this decision: ${path}`, { path });
	};
	for(const field of ["capabilities", "assurance"]) reject(document[field].length, field);
	const callbacks = new Map(document.types.filter(type => type.kind === "callback").map(type => [type.id, type]));
	const isCallback = type => type.kind === "named" && callbacks.has(type.id);
	reject(!same(document.errors.map(({ documentation, ...error }) => { void documentation; return error; }), callbacks.size ? [{
		id: "error:native-callback", name: "NativeCallbackFailure"
		, category: "boundary", payload: null
	}] : []), "errors");
	for(const producer of document.producers) reject(Object.keys(producer.extensions).length, `producers.${producer.id}.extensions`);
	const source = (item, callbackName) => {
		reject(callbackName ? item.id !== `bridge:${callbackName}` || item.source.declaration !== callbackName || item.name !== callbackName
			: !leanName(item.source.declaration) || item.id !== `lean:${item.source.declaration}`, `${item.id}.source.declaration`);
		reject(Object.keys(item.source.extensions).length, `${item.id}.source.extensions`);
		reject(item.assurance.length, `${item.id}.assurance`);
	};
	const type = (value, path, copied = true) => {
		reject(copied && isCallback(value), path);
		if(value.kind === "primitive" || value.kind === "named") return;
		const arity = { array: 1, list: 1, option: 1, result: 2, tuple: 2 }[value.constructor];
		reject(value.kind !== "apply" || !arity || value.arguments.length !== arity, path);
		value.arguments.forEach((argument, index) => type(argument, `${path}.arguments[${index}]`));
	};
	const site = (value, path, result = false) => {
		const identity = isCallback(value.type);
		reject(value.ownership !== (identity ? result ? "lease" : "borrow" : "copy")
			|| !same(value.lifetime, identity ? { scope: result ? "explicit" : "call", anchor: null } : null), path);
		type(value.type, `${path}.type`, false);
	};
	const parameter = (value, path) => {
		reject(value.optional || value.default !== null || value.mutability !== "immutable", path);
		site(value, path);
	};
	for(const definition of document.types)
	{
		if(definition.kind === "callback")
		{
			const callable = definition.callable;
			const signature = { parameters: callable.parameters.map(parameter => parameter.type), result: callable.result.type };
			const name = `Callback${sha256(canonicalJson(signature)).slice(0, 20)}`;
			source(definition, name);
			reject(definition.representation !== "identity" || definition.mutability !== "immutable"
				|| definition.typeParameters.length || definition.fields.length || definition.target !== null
				|| definition.resource !== null || definition.cases.length || definition.host !== null, definition.id);
			reject(callable.invocation !== "many" || callable.reentry !== "same-agent" || callable.selfDisposal !== "defer"
				|| callable.resultMode !== "value" || !same(callable.effects.toSorted(), ["fails", "host-call"])
				|| !same(callable.failure, callbackFailure) || !callable.parameters.length || callable.parameters.length > 16, `${definition.id}.callable`);
			for(const [index, value] of callable.parameters.entries())
			{
				reject(value.type.kind !== "primitive", `${definition.id}.parameters[${index}].type`);
				parameter(value, `${definition.id}.parameters[${index}]`);
			}
			reject(callable.result.type.kind !== "primitive", `${definition.id}.result.type`);
			site(callable.result, `${definition.id}.result`, true);
			continue;
		}
		source(definition);
		if(definition.kind === "alias")
		{
			reject(definition.representation !== "copied" || definition.mutability !== "immutable"
				|| definition.typeParameters.length || definition.target === null || definition.fields.length || definition.cases.length
				|| definition.resource !== null || definition.callable !== null || definition.host !== null, definition.id);
			type(definition.target, `${definition.id}.target`);
			continue;
		}
		reject(!["record", "variant"].includes(definition.kind) || definition.representation !== "copied" || definition.mutability !== "immutable"
			|| definition.typeParameters.length || definition.target !== null || definition.resource !== null
			|| definition.callable !== null || definition.host !== null
			|| (definition.kind === "record" ? definition.cases.length : definition.fields.length), definition.id);
		const fields = definition.kind === "record" ? definition.fields : definition.cases.flatMap(item => item.fields);
		for(const field of fields)
		{
			reject(field.mutability !== "immutable", `${definition.id}.${field.name}.mutability`);
			type(field.type, `${definition.id}.${field.name}.type`);
		}
	}
	for(const declaration of document.declarations)
	{
		source(declaration);
		const hasCallback = declaration.parameters.some(parameter => isCallback(parameter.type));
		reject(declaration.kind !== "function" || declaration.owner !== null || declaration.receiver !== null
			|| declaration.typeParameters.length || !same(declaration.effects.toSorted(), hasCallback ? ["fails", "host-call"] : []) || declaration.capabilities.length
			|| declaration.mutability !== "immutable" || declaration.resultMode !== "value"
			|| !same(declaration.failure, hasCallback ? callbackFailure : pureFailure), declaration.id);
		for(const [index, value] of declaration.parameters.entries()) parameter(value, `${declaration.id}.parameters[${index}]`);
		site(declaration.result, `${declaration.id}.result`, true);
	}
	return document;
};

/**
 * Recheck the retained raw document, including its exact file identity.
 *
 * @param review - Versioned reviewed-source input retained in the receipt.
 */
export const validateReviewedSource = review => {
	if(!review || !same(Object.keys(review).sort(), ["path", "schemaVersion", "semanticSha256", "source", "sourceSha256"])
		|| review.schemaVersion !== 1 || typeof review.source !== "string" || typeof review.path !== "string"
		|| !review.path.endsWith(".binding-ir.json") || review.path.includes("\\")
		|| review.path.split("/").some(part => ["", ".", ".."].includes(part)) || sha256(review.source) !== review.sourceSha256)
		mismatch("Invalid reviewed-source input identity");
	const document = parseBindingIr(review.source);
	if(hashBindingIr(document) !== review.semanticSha256) mismatch("Reviewed contract digest differs from its retained source");
	return checkReview(document);
};

/**
 * Derive the compiler selection from reviewed signatures. A returned callable
 * fixes the outer export's arity; the compiler still verifies both signatures.
 *
 * @param review - Captured, independently reviewed contract.
 */
export const reviewedSourceSelection = review => {
	const document = validateReviewedSource(review);
	const callbacks = new Set(document.types.filter(type => type.kind === "callback").map(type => type.id));
	return { exports: document.declarations.map(item => item.source.declaration).sort()
		, arities: document.declarations.filter(item => item.result.type.kind === "named" && callbacks.has(item.result.type.id))
			.map(item => [item.source.declaration, item.parameters.length]).sort(([a], [b]) => a.localeCompare(b)) };
};

/**
 * Capture one review before tools run. Explicit modules avoid namespace guessing.
 *
 * @param projectRoot - Original read-only Lean project.
 * @param inventory - Independently captured source and configuration inputs.
 * @param signal - Optional cancellation signal.
 */
export const readReviewedSource = async (projectRoot, inventory, signal) => {
	const inputs = inventory.inputs.filter(input => input.path.endsWith(".binding-ir.json"));
	if(!inputs.length) return null;
	const paths = inputs.map(input => input.path).sort();
	if(inputs.length !== 1) unsupported("Compilation requires exactly one reviewed Binding IR", { paths });
	const config = inventory.configurationRecord.configuration;
	assertReviewedSourceConfiguration(config);
	if(!config.modules?.length) unsupported("Set modules in lean-bridge.exports.json to authorize the reviewed contract's Lean source roots", { paths });
	signal?.throwIfAborted();
	const bytes = await readFile(join(projectRoot, inputs[0].path));
	if(bytes.length !== inputs[0].bytes || sha256(bytes) !== inputs[0].sha256) mismatch("Reviewed contract changed after source capture");
	const source = bytes.toString("utf8"), document = parseBindingIr(source);
	const review = { schemaVersion: 1, path: inputs[0].path, source
		, sourceSha256: sha256(bytes), semanticSha256: hashBindingIr(document) };
	validateReviewedSource(review);
	return review;
};

const contract = document => {
	const strip = (value, key = "") => {
		if(Array.isArray(value)) return value.map(item => strip(item));
		if(value === null || typeof value !== "object") return value;
		if(key === "source") return { declaration: value.declaration };
		return Object.fromEntries(Object.entries(value).filter(([field]) => field !== "documentation")
			.map(([field, item]) => [field, field === "parameters" ? item.map(parameter => strip({ ...parameter, name: null })) : strip(item, field)]));
	};
	return strip({ ...document, producers: []
		, declarations: document.declarations.toSorted((a, b) => a.id.localeCompare(b.id))
		, types: document.types.toSorted((a, b) => a.id.localeCompare(b.id)) });
};

const difference = (left, right, path = "bindingIr") => {
	if(same(left, right)) return null;
	if(left === null || right === null || typeof left !== "object" || typeof right !== "object") return path;
	if(Array.isArray(left) && left.length !== right.length) return `${path}.length`;
	for(const key of new Set([...Object.keys(left), ...Object.keys(right)]))
	{
		const location = `${path}${Array.isArray(left) ? `[${key}]` : `.${key}`}`;
		if(!Object.hasOwn(left, key) || !Object.hasOwn(right, key)) return location;
		const changed = difference(left[key], right[key], location);
		if(changed) return changed;
	}
	return path;
};

/**
 * Reconcile exact source identities and contracts; retain only author annotations.
 * Compiler producers, layouts and theorem references stay compiler-owned.
 *
 * @param review - Captured reviewed-source input.
 * @param compiled - Fresh elaborated semantic document.
 * @param sourceIdentity - Independently retained compilation request.
 */
export const reconcileReviewedSource = (review, compiled, sourceIdentity) => {
	const document = validateReviewedSource(review);
	const config = JSON.parse(sourceIdentity.exportConfigurationSource ?? "null");
	validateExportConfiguration(config);
	assertReviewedSourceConfiguration(config);
	const request = sourceIdentity.request;
	const selection = reviewedSourceSelection(review);
	if(!config.modules?.length || sha256(canonicalJson(config)) !== sourceIdentity.exportConfigurationSha256
		|| !same(ordered(config.modules), ordered(request.exportModules))
		|| !same(ordered(request.exports), ordered(document.declarations.map(item => item.source.declaration)))
		|| request.resources.length || !same(request.arities, selection.arities) || request.specializations !== undefined || request.contracts !== undefined)
		mismatch("Reviewed contract differs from the authorized compiler selection");
	const field = difference(contract(document), contract(compiled));
	if(field)
		mismatch("Reviewed contract does not match the freshly compiled Lean API", { path: review.path
			, field
			, reviewedSha256: review.semanticSha256
			, compiledSha256: hashBindingIr(compiled) });
	const declarations = new Map(document.declarations.map(item => [item.id, item]));
	const types = new Map(document.types.map(item => [item.id, item]));
	return { ...compiled, documentation: document.documentation
		, declarations: compiled.declarations.map(item => ({ ...item
			, documentation: declarations.get(item.id).documentation
			, parameters: item.parameters.map((parameter, index) => ({ ...parameter, name: declarations.get(item.id).parameters[index].name })) }))
		, types: compiled.types.map(item => ({ ...item, documentation: types.get(item.id).documentation
			, fields: item.fields.map((field, index) => ({ ...field, documentation: types.get(item.id).fields[index].documentation })) })) };
};

/**
 * Bind the review to the same source inventory shipped with compiled artifacts.
 *
 * @param sourceIdentity - Compilation receipt's source identity.
 * @param inputs - Verified root inputs from the source-notice inventory.
 */
export const verifyReviewedSourceInputs = (sourceIdentity, inputs) => {
	const reviews = inputs.filter(input => input.path.endsWith(".binding-ir.json"));
	const review = sourceIdentity.reviewedBindingIr;
	if(review === undefined && !reviews.length) return;
	validateReviewedSource(review);
	if(reviews.length !== 1 || reviews[0].path !== review.path || reviews[0].sha256 !== review.sourceSha256
		|| reviews[0].bytes !== Buffer.byteLength(review.source)) mismatch("Reviewed contract differs from captured source inputs");
};

/**
 * Reconstruct the scalar compiler invocation before reconciling a reviewed API.
 *
 * @param inventory - Independently captured project configuration and inputs.
 * @param elaboration - Retained scalar compiler evidence and reviewed input.
 * @param compiled - Semantic document derived from that compiler's metadata.
 */
export const reconcileReviewedElaboration = (inventory, elaboration, compiled) => {
	const { reviewedBindingIr, request } = elaboration;
	verifyReviewedSourceInputs({ reviewedBindingIr }, inventory.inputs);
	if(reviewedBindingIr === undefined) return compiled;
	const { metadata, ...selection } = request;
	const expected = createMetadataRequest(selection, { toolchain: inventory.project.toolchain
		, snapshotSha256: elaboration.snapshotSha256
		, generatedSourcesSha256: elaboration.generatedSourcesSha256
		, leanCompilerSha256: elaboration.leanCompilerSha256
		, extractorSha256: elaboration.extractorSha256
		, reviewedBindingIrSha256: sha256(canonicalJson(reviewedBindingIr))
		, modules: metadata.modules });
	if(!same(request, expected)) mismatch("Reviewed scalar invocation differs from retained compiler/source evidence");
	return reconcileReviewedSource(reviewedBindingIr, compiled, {
		request
		, exportConfigurationSource: canonicalJson(inventory.configurationRecord.configuration)
		, exportConfigurationSha256: inventory.configurationRecord.sha256
	});
};
