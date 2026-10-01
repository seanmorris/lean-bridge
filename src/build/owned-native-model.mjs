/**
 * Compiler-authenticated ownership-aware native component artifacts.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { projectNativeMetadata } from "../analyze/native-metadata.mjs";
import { compileOwnedNativeValueLayout } from "../backends/native/owned-value-layout.mjs";
import { generateOwnedAggregateCarriers, generateOwnedBindingCarriers } from "./owned-aggregate-carriers.mjs";

const callbackSource = carriers => carriers.callbackSource.replace('#include "carriers.h"', '#include "component.h"');
const callbackCapability = carriers => ({ schemaVersion: 1
	, lifetime: "call", recovery: "typed-value-v1"
	, signatures: carriers.hostCallbacks
	, trampolineSha256: sha256(callbackSource(carriers)) });

const inputTransferCapability = (ir, enabled, anchoredResults = false, receiverExports = false) => {
	if(!ir.declarations.some(item => item.receiver?.ownership === "transfer" || item.parameters.some(parameter => parameter.ownership === "transfer"))) return null;
	if(!enabled) throw Object.assign(new TypeError("This native component requires an owned input-transfer consumer adapter"), { code: "native-owned-transfers-unavailable" });
	const layout = compileOwnedNativeValueLayout(ir, { transferredInputs: true, anchoredResults, receiverExports });
	return { schemaVersion: 1, ownership: "whole-result-owner"
		, validation: "before-consumption", consumption: "before-lean-call"
		, failure: "consumed-after-handoff", viewLifetime: "until-call-returns"
		, exports: layout.functions.filter(item => item.transfers?.length)
			.map(item => ({ bindingId: item.id, parameters: item.transfers })) };
};

const anchoredResultCapability = (ir, enabled, transferredInputs, receiverExports = false) => {
	if(!ir.declarations.some(item => item.result.ownership === "borrow")) return null;
	if(!enabled) throw Object.assign(new TypeError("This native component requires an owner-anchored result consumer adapter"), { code: "native-owned-anchors-unavailable" });
	const layout = compileOwnedNativeValueLayout(ir, { transferredInputs, anchoredResults: true, receiverExports });
	const receiver = ir.declarations.some(item => item.receiver);
	return { schemaVersion: receiver ? 2 : 1, ownership: "borrow"
		, lifetime: receiver ? "receiver-or-parameter" : "parameter"
		, anchor: "original-result-owner", expiration: "owner-release-or-transfer"
		, descendants: "transitive", validation: "generation-and-owner-tree"
		, independentOwnership: "explicit-retain-or-copy", maximumDepth: 128
		, exports: layout.functions.filter(item => item.anchor !== undefined)
			.map(item => ({ bindingId: item.id
				, ...(item.receiver === 0 && item.anchor === 0 ? { receiver: true }
					: { parameter: item.anchor - Number(item.receiver === 0) }) })) };
};

const receiverCapability = (ir, enabled, transferredInputs, anchoredResults) => {
	if(!ir.declarations.some(item => item.receiver)) return null;
	if(!enabled) throw Object.assign(new TypeError("This native component requires a receiver-capable consumer adapter"), { code: "native-owned-receivers-unavailable" });
	compileOwnedNativeValueLayout(ir, { transferredInputs, anchoredResults, receiverExports: true });
	return { schemaVersion: 1, callingConvention: "receiver-first"
		, exports: ir.declarations.filter(item => item.receiver).map(item => ({
			bindingId: item.id, kind: item.kind, owner: item.owner, argument: 0
		}))
	};
};

/**
 * Retain complete v4 semantics and measured compiler evidence for package readers.
 *
 * @param options - Fresh compiler report, source identities and package coordinates.
 */
export const createOwnedCompiledNativeModel = options => {
	if(options.moduleName !== undefined) throw new TypeError("Owned native models cannot contain a host-language namespace");
	const { metadata, sourceIdentity, component } = options;
	const hostCallbacks = options.hostCallbacks ?? false;
	if(typeof hostCallbacks !== "boolean") throw new TypeError("Owned host callback capability must be explicit");
	const transferredInputs = options.transferredInputs ?? false;
	if(typeof transferredInputs !== "boolean") throw new TypeError("Owned input transfer capability must be explicit");
	const anchoredResults = options.anchoredResults ?? false;
	if(typeof anchoredResults !== "boolean") throw new TypeError("Owned anchored result capability must be explicit");
	const receivers = options.receiverExports ?? false;
	if(typeof receivers !== "boolean") throw new TypeError("Owned receiver capability must be explicit");
	const elaborated = projectNativeMetadata(metadata, sourceIdentity, { copiedGraphs: true, ownedGraphs: true });
	const carriers = generateOwnedAggregateCarriers(options);
	const receiverExports = receiverCapability(carriers.model.bindingIr, receivers, transferredInputs, anchoredResults);
	const resultAnchors = anchoredResultCapability(carriers.model.bindingIr, anchoredResults, transferredInputs, receivers);
	const inputTransfers = inputTransferCapability(carriers.model.bindingIr, transferredInputs, anchoredResults, receivers);
	return Object.freeze({ schemaVersion: receiverExports ? 10 : resultAnchors ? 9 : inputTransfers ? 8 : hostCallbacks ? 7 : 6
		, profile: "native-library-v1"
		, pointerBits: 64, byteOrder: "little", component
		, bindingIr: carriers.model.bindingIr
		, bindingIrSha256: carriers.model.bindingIrSha256
		, sourceIdentity, types: []
		, exports: elaborated.declarations.map(item => {
			const declaration = carriers.model.bindingIr.declarations.find(value =>
				(value.source.extensions["lean-lang.org/specialization"]?.name ?? value.source.declaration) === item.name);
			if(!declaration) throw new TypeError("Owned native export lacks a compiler-selected declaration");
			return { ...item, bindingId: declaration.id, symbol: carriers.symbols.exports[declaration.id] };
		})
		, ownedGraph: { schemaVersion: receiverExports ? 5 : resultAnchors ? 4 : inputTransfers ? 3 : hostCallbacks ? 2 : 1
			, module: carriers.module
			, metadataSha256: elaborated.sha256, symbols: carriers.symbols
			, ...(inputTransfers ? { inputTransfers } : {})
			, ...(resultAnchors ? { resultAnchors } : {})
			, ...(receiverExports ? { receiverExports } : {})
			, ...(hostCallbacks ? { hostCallbacks: callbackCapability(carriers) } : {}) } });
};

/**
 * Generate exactly the helpers described by a reconstructed owned component.
 *
 * @param model - Independently authenticated native model, never a copied graph.
 */
export const generateOwnedNativeLeanAdapters = model => {
	const receivers = model.schemaVersion === 10;
	const anchoredResults = model.schemaVersion === 9 || (receivers && model.ownedGraph?.resultAnchors !== undefined);
	const transferredInputs = model.schemaVersion === 8 || ((receivers || anchoredResults) && model.ownedGraph?.inputTransfers !== undefined);
	const hostCallbacks = model.schemaVersion === 7 || ((receivers || transferredInputs || anchoredResults) && model.ownedGraph?.hostCallbacks !== undefined);
	if(![6, 7, 8, 9, 10].includes(model.schemaVersion) || model.profile !== "native-library-v1"
		|| model.pointerBits !== 64 || model.byteOrder !== "little" || model.ownedGraph?.schemaVersion !== (receivers ? 5 : anchoredResults ? 4 : transferredInputs ? 3 : hostCallbacks ? 2 : 1)
		|| (!hostCallbacks && model.ownedGraph.hostCallbacks !== undefined))
		throw new TypeError("Owned native component differs from the supported transport");
	const receiverExports = receiverCapability(model.bindingIr, receivers, transferredInputs, anchoredResults);
	if(Boolean(receiverExports) !== receivers
		|| canonicalJson(receiverExports) !== canonicalJson(model.ownedGraph.receiverExports ?? null))
		throw new TypeError("Owned native receiver exports differ from the checked contract");
	const resultAnchors = anchoredResultCapability(model.bindingIr, anchoredResults, transferredInputs, receivers);
	if(Boolean(resultAnchors) !== anchoredResults
		|| canonicalJson(resultAnchors) !== canonicalJson(model.ownedGraph.resultAnchors ?? null))
		throw new TypeError("Owned native result anchors differ from the checked contract");
	const inputTransfers = inputTransferCapability(model.bindingIr, transferredInputs, anchoredResults, receivers);
	if(Boolean(inputTransfers) !== transferredInputs
		|| canonicalJson(inputTransfers) !== canonicalJson(model.ownedGraph.inputTransfers ?? null))
		throw new TypeError("Owned native input transfers differ from the checked contract");
	const generated = generateOwnedBindingCarriers({ document: model.bindingIr
		, sourceIdentity: model.sourceIdentity, declarations: model.exports
		, metadataSha256: model.ownedGraph.metadataSha256, hostCallbacks });
	if(generated.model.bindingIrSha256 !== model.bindingIrSha256 || generated.module !== model.ownedGraph.module
		|| canonicalJson(generated.symbols) !== canonicalJson(model.ownedGraph.symbols)
		|| model.exports.some(item => item.symbol !== generated.symbols.exports[item.bindingId])
		|| (hostCallbacks && canonicalJson(model.ownedGraph.hostCallbacks) !== canonicalJson(callbackCapability(generated))))
		throw new TypeError("Owned native carrier identity differs from the checked contract");
	return { module: generated.module, leanSource: generated.leanSource
		, header: generated.header
		, ...(hostCallbacks ? { callbackSource: callbackSource(generated) } : {}) };
};
