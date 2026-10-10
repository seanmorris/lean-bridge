/**
 * Bind prepared CPAN consuming and borrowed APIs to authenticated compiler input.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../build/native-graph-model.mjs";
import { generateOwnedPerlPackage } from "../backends/perl/owned-package.mjs";

/**
 * Verify the transfer-specific contract after the complete payload is hashed.
 * Older borrow-only packages retain their original package and generator format.
 *
 * @param manifest - Prepared CPAN manifest.
 * @param files - Exact inventoried payload bytes, indexed by relative path.
 */
export const verifyOwnedCpanTransfers = (manifest, files) => {
	const bytes = path => {
		const value = files.get(path);
		if(!value) throw new TypeError(`Missing owned CPAN transfer artifact: ${path}`);
		return value;
	};
	const json = path => JSON.parse(bytes(path));
	const model = files.has("model.json") ? json("model.json") : null;
	const binding = files.has("binding-manifest.json") ? json("binding-manifest.json") : null;
	const ir = files.has("binding-ir.json") ? json("binding-ir.json") : null;
	const native = files.has("native-component.json") ? json("native-component.json") : null;
	const hasCallbackAnchors = manifest.ownedValues?.schemaVersion === 5
		|| binding?.schemaVersion === 5 || binding?.owned?.schemaVersion === 5
		|| manifest.ownedValues?.callbackResultAnchors || binding?.owned?.callbackResultAnchors
		|| model?.schemaVersion === 11 || model?.ownedGraph?.schemaVersion === 6
		|| model?.ownedGraph?.callbackResultAnchors || native?.schemaVersion === 7
		|| native?.callbackResultAnchors
		|| [model?.bindingIr, ir].some(value => value?.types?.some(type =>
			type.kind === "callback" && type.callable?.result?.ownership === "borrow"));
	const hasTransfers = manifest.ownedValues?.schemaVersion === 2 || binding?.owned?.schemaVersion === 2
		|| model?.schemaVersion === 8 || model?.ownedGraph?.inputTransfers
		|| model?.bindingIr?.declarations?.some(fn => fn.parameters.some(site => site.ownership === "transfer"));
	const hasAnchors = manifest.ownedValues?.schemaVersion === 3 || binding?.owned?.schemaVersion === 3
		|| manifest.ownedValues?.resultAnchors || binding?.owned?.resultAnchors
		|| model?.schemaVersion === 9 || model?.ownedGraph?.resultAnchors
		|| model?.bindingIr?.declarations?.some(fn => fn.result.ownership === "borrow");
	const hasReceivers = manifest.ownedValues?.schemaVersion === 4 || binding?.owned?.schemaVersion === 4
		|| manifest.ownedValues?.receiverExports || binding?.owned?.receiverExports
		|| model?.schemaVersion === 10 || model?.ownedGraph?.receiverExports
		|| model?.bindingIr?.declarations?.some(fn => fn.receiver !== null);
	if(!hasTransfers && !hasAnchors && !hasReceivers && !hasCallbackAnchors) return;
	const fail = message => { throw new TypeError("Owned CPAN transfer contract differs from " + message); };
	const version = hasCallbackAnchors ? 5 : hasReceivers ? 4 : hasAnchors ? 3 : 2;
	const hostCallbacks = Boolean(model?.ownedGraph?.hostCallbacks);
	if(manifest.ownedValues?.schemaVersion !== version || binding?.schemaVersion !== version
		|| model?.schemaVersion !== (hasCallbackAnchors ? 11 : hasReceivers ? 10 : hasAnchors ? 9 : 8)
		|| (!hasCallbackAnchors && !hasReceivers && !hostCallbacks)) fail("its supported schema");
	const receipt = json("native-component.json"), metadata = json("metadata.json");
	const reconstructed = createCompiledNativeModel({ metadata, component: model.component, sourceIdentity: receipt.sourceIdentity }
		, { ownedGraphs: true, ownedHostCallbacks: hostCallbacks
			, ownedInputTransfers: true, ownedAnchoredResults: Boolean(hasAnchors)
			, ownedReceiverExports: Boolean(hasReceivers)
			, ownedCallbackResultAnchors: Boolean(hasCallbackAnchors) });
	const adapters = generateCompiledNativeLeanAdapters(reconstructed);
	if(canonicalJson(model) !== canonicalJson(reconstructed)
		|| receipt.schemaVersion !== (hasCallbackAnchors ? 7 : hasReceivers ? 6 : hasAnchors ? 5 : 4) || receipt.profile !== "native-library-v1"
		|| receipt.runtimeIdentity !== manifest.nativeRuntimeIdentity
		|| receipt.modelSha256 !== sha256(canonicalJson(model))
		|| receipt.bindingIrSha256 !== model.bindingIrSha256
		|| canonicalJson(json("binding-ir.json")) !== canonicalJson(model.bindingIr)
		|| canonicalJson(receipt.inputTransfers ?? null) !== canonicalJson(model.ownedGraph.inputTransfers ?? null)
		|| canonicalJson(receipt.resultAnchors ?? null) !== canonicalJson(model.ownedGraph.resultAnchors ?? null)
		|| canonicalJson(receipt.receiverExports ?? null) !== canonicalJson(model.ownedGraph.receiverExports ?? null)
		|| canonicalJson(receipt.callbackResultAnchors ?? null) !== canonicalJson(model.ownedGraph.callbackResultAnchors ?? null)
		|| receipt.metadataSha256 !== sha256(bytes("metadata.json"))
		|| receipt.headerSha256 !== sha256(adapters.header) || bytes("component.h").toString() !== adapters.header
		|| receipt.adaptersSha256 !== sha256(adapters.leanSource) || bytes("generated.lean").toString() !== adapters.leanSource
		|| (hostCallbacks ? receipt.callbackSourceSha256 !== sha256(adapters.callbackSource) || bytes("callbacks.c").toString() !== adapters.callbackSource
			: receipt.callbackSourceSha256 !== undefined || files.has("callbacks.c"))
		|| receipt.allocationGuardSha256 !== sha256(bytes("allocation-guard.h"))
		|| receipt.initializer !== `initialize_${adapters.module}`
		|| !/^libcomponent_[0-9a-f]{20}\.so$/u.test(receipt.library)) fail("compiler-authenticated native inputs");
	const relative = manifest.module.replaceAll("::", "/"), nativePath = `lib/${relative}/native/`;
	const library = bytes(nativePath + receipt.library), gmp = bytes(nativePath + "libgmp-lean-bridge.so.10");
	if(receipt.nativeLibrary.sha256 !== sha256(library) || receipt.nativeLibrary.bytes !== library.length)
		fail("its compiled Lean library");
	const generated = generateOwnedPerlPackage({ model, metadata
		, receipt: { ...receipt, runtimeIdentity: manifest.runtimeIdentity }
		, moduleName: manifest.module, gmpSha256: sha256(gmp) });
	if(canonicalJson(manifest.ownedValues) !== canonicalJson(generated.owned)) fail("its generated ownership policy");
	for(const [path, source] of Object.entries(generated.files))
	{
		const expected = path.endsWith(".pm") ? source.replace("our $VERSION = '0.001';", `our $VERSION = '${manifest.version}';`)
			.replace("use LeanBridge::Runtime;", `use LeanBridge::Runtime;\ndie "Incompatible shared Lean runtime package version\\n" unless $LeanBridge::Runtime::VERSION eq '${manifest.runtimeVersion}';`) : source;
		if(bytes(path).toString() !== expected) fail(`its generated source ${path}`);
	}
};
