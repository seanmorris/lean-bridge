/**
 * Compiler-authenticated ownership-aware native component artifacts.
 *
 * @file
 */
import { canonicalJson } from "../capsule/node.mjs";
import { projectNativeMetadata } from "../analyze/native-metadata.mjs";
import { generateOwnedAggregateCarriers, generateOwnedBindingCarriers } from "./owned-aggregate-carriers.mjs";

/**
 * Retain complete v4 semantics and measured compiler evidence for package readers.
 *
 * @param options - Fresh compiler report, source identities and package coordinates.
 */
export const createOwnedCompiledNativeModel = options => {
	if(options.moduleName !== undefined) throw new TypeError("Owned native components do not implement Perl namespace projection");
	const { metadata, sourceIdentity, component } = options;
	const elaborated = projectNativeMetadata(metadata, sourceIdentity, { copiedGraphs: true, ownedGraphs: true });
	const carriers = generateOwnedAggregateCarriers(options);
	return Object.freeze({ schemaVersion: 6, profile: "native-library-v1"
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
		, ownedGraph: { schemaVersion: 1, module: carriers.module
			, metadataSha256: elaborated.sha256, symbols: carriers.symbols } });
};

/**
 * Generate exactly the helpers described by a reconstructed owned component.
 *
 * @param model - Independently authenticated native model, never a copied graph.
 */
export const generateOwnedNativeLeanAdapters = model => {
	if(model.schemaVersion !== 6 || model.profile !== "native-library-v1"
		|| model.pointerBits !== 64 || model.byteOrder !== "little" || model.ownedGraph?.schemaVersion !== 1)
		throw new TypeError("Owned native component differs from the supported transport");
	const generated = generateOwnedBindingCarriers({ document: model.bindingIr
		, sourceIdentity: model.sourceIdentity, declarations: model.exports
		, metadataSha256: model.ownedGraph.metadataSha256 });
	if(generated.model.bindingIrSha256 !== model.bindingIrSha256 || generated.module !== model.ownedGraph.module
		|| canonicalJson(generated.symbols) !== canonicalJson(model.ownedGraph.symbols)
		|| model.exports.some(item => item.symbol !== generated.symbols.exports[item.bindingId]))
		throw new TypeError("Owned native carrier identity differs from the checked contract");
	return { module: generated.module, leanSource: generated.leanSource, header: generated.header };
};
