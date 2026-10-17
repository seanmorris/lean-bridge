/**
 * Finite PHP-Wasm schemas over the private, resource-bearing wasm32 ABI.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { ownedCallbackRecovery } from "../../build/owned-callback-carriers.mjs";
import { compileOwnedNativeValueLayout } from "../native/owned-value-layout.mjs";
import { generateOwnedPhpValues } from "./owned-values.mjs";

/**
 * Keep the public PHP types separate from C's GMP and pointer-based projection.
 * Result wire booleans mean error: false is Ok, true is Err. This matches the
 * private ownership ABI's canonical [success, error] order.
 *
 * @param ir - Explicit, compiler-authenticated resource ownership contract.
 * @param options - Explicit transport capabilities.
 * @param options.transferredInputs - Admit atomic consuming arguments.
 * @param options.anchoredResults - Carry exact whole-result owner lifetimes.
 * @param options.receiverExports - Admit typed receiver methods and properties.
 * @param options.callbackResultAnchors - Preserve callback-local result owners.
 * @param options.hostCallbacks - Admit synchronous PHP callback transport.
 */
export const compileOwnedPhpZendModel = (ir, { transferredInputs = false, anchoredResults = false, receiverExports = false, callbackResultAnchors = false, hostCallbacks = true } = {}) => {
	const values = generateOwnedPhpValues(ir, { integerBits: 32, wordBits: 32, transferredInputs, anchoredResults, receiverExports, callbackResultAnchors, hostCallbacks });
	const layout = compileOwnedNativeValueLayout(ir, { wordBits: 32, transferredInputs, anchoredResults, receiverExports, callbackResultAnchors });
	anchoredResults = values.c.anchoredResults;
	receiverExports = values.receiverExports;
	callbackResultAnchors = values.callbackResultAnchors;
	const wholeOwners = Boolean(anchoredResults || receiverExports || callbackResultAnchors);
	const fail = message => { throw new TypeError(`Owned PHP-Wasm values: ${message}`); };
	const types = layout.nodes.map((node, index) => {
		const php = values.types[index];
		if(php?.id !== node.id || php.index !== index) fail("PHP and native type identities differ");
		const fields = (native, publicFields) => native.map((field, position) => {
			const publicField = publicFields[position];
			if(field.type !== publicField?.type || field.sourceName !== publicField.sourceName) fail("PHP and native fields differ");
			return { ...field, publicKey: ["option", "result"].includes(node.kind) ? "value" : publicField.publicName };
		});
		return { ...node, identity: php.identity
			, ...php.ownerType ? { ownerType: php.ownerType } : {}
			, publicType: php.publicType, docType: php.docType
			, fields: fields(node.fields, php.fields)
			, cases: node.cases.map((branch, position) => ({ ...branch
				, publicName: php.cases[position].publicName
				, fields: fields(branch.fields, php.cases[position].fields) })) };
	});
	if(types.length !== values.types.length) fail("PHP and native type counts differ");
	const nodes = new Map(types.map(node => [node.id, node]));
	const inhabited = new Set();
	for(let changed = true; changed;)
	{
		changed = false;
		for(const node of types)
		{
			const all = fields => fields.every(field => inhabited.has(field.type));
			const finite = node.leaf || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields))
					: node.kind === "result" ? node.fields.some(field => inhabited.has(field.type)) : all(node.fields));
			if(finite && !inhabited.has(node.id))
			{ inhabited.add(node.id); changed = true; }
		}
	}
	const qualify = name => `${values.namespace}\\${name}`;
	const descriptors = types.map(node => {
		const fields = (items, prefix = "") => items.map(field => ({
			type: nodes.get(field.type).index, pointer: field.pointer
			, path: prefix + field.name, publicKey: field.publicKey
		}));
		const branches = node.kind === "variant" ? node.cases.map(branch => ({
			class: qualify(branch.publicName)
			, fields: fields(branch.fields, `cases.${branch.name}.`)
		})) : node.kind === "option" ? [{ class: null, fields: [] }, { class: qualify("Some"), fields: fields(node.fields) }]
			: node.kind === "result" ? node.fields.map((field, index) => ({ class: qualify(index ? "Err" : "Ok"), fields: fields([field]) }))
				: node.leaf || node.element ? [] : [{ class: node.kind === "record" ? qualify(node.publicType) : null, fields: fields(node.fields) }];
		return { id: node.id, index: node.index, kind: node.kind, cName: node.cName
			, scalar: node.kind === "primitive" ? node.name : null
			, publicType: node.publicType, identity: node.identity
			, identityKind: node.identityKind ?? null
			, inhabited: inhabited.has(node.id)
			, element: node.element ? nodes.get(node.element).index : null
			, tag: ["option", "result", "variant"].includes(node.kind) ? "tag" : null
			, resultTag: node.kind === "result" ? "error" : null, branches };
	});
	const functions = layout.functions.map((fn, index) => {
		const php = values.functions[index];
		if(php?.id !== fn.id || canonicalJson(php.parameters) !== canonicalJson(fn.parameters) || php.result !== fn.result)
			fail("PHP and native function signatures differ");
		return { ...fn, index, publicName: php.publicName
			, publicParameters: php.publicParameters
			, ...receiverExports ? { declaration: php.declaration } : {}
			, ...wholeOwners ? { whole: nodes.get(fn.result).representation !== "copied" } : {}
			, hostArguments: php.parameters.map((_, position) => hostCallbacks && values.c.hostArgument(php, position)) };
	});
	if(functions.length !== values.functions.length) fail("PHP and native export counts differ");
	if(hostCallbacks && functions.some(fn => fn.publicName.toLowerCase() === "with_recovery")) fail("function collides with with_recovery");
	if(wholeOwners && functions.some(fn => fn.publicName.toLowerCase() === "copy_value")) fail("function collides with copy_value");
	const semantic = new Map(layout.model.types.map(node => [node.id, node]));
	const callbacks = layout.callbacks.map((callback, index) => ({ ...callback, index
		, type: nodes.get(callback.id).index
		, hostArguments: callback.parameters.map((id, position) => hostCallbacks && position > 0 && nodes.get(id).kind === "callback")
		, automaticRecovery: ownedCallbackRecovery(layout.model, semantic.get(callback.id), id => id) !== null }));
	const identity = layout.model.bindingIrSha256, stem = `lb_owned_${identity.slice(0, 20)}`;
	return { namespace: values.namespace, integerBits: 32, wordBits: 32
		, ...anchoredResults ? { anchoredResults: true } : {}
		, ...callbackResultAnchors ? { callbackResultAnchors: true } : {}
		, ...receiverExports ? { receiverExports: true, wholeOwners: true, hostCallbacks } : callbackResultAnchors ? { wholeOwners: true, ...!hostCallbacks ? { hostCallbacks: false } : {} } : !hostCallbacks ? { hostCallbacks: false } : {}
		, files: values.files, aliases: values.aliases
		, publicFiles: values.publicFiles
		, layout, types, descriptors, functions, callbacks
		, identity, layoutSha256: sha256(canonicalJson(layout)), stem
		, library: `php8.4-${stem}.so`
		, transport: `${values.namespace}\\Internal\\OwnedZend${identity.slice(0, 20)}` };
};
