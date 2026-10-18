/**
 * Authenticate the private owned Ruby adapter before generating a gem loader.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateOwnedCPackage } from "../backends/c/owned-package.mjs";
import { generateOwnedRubyPackage } from "../backends/ruby/owned-package.mjs";
import { gmpIdentity } from "../backends/c/gmp.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime, validateNativeElf, verifyNativeFiles } from "./native-artifacts.mjs";

/**
 * Keep the checked C implementation and Ruby forwarders in one translation unit.
 *
 * @param c - Generated public C package.
 * @param ruby - Generated Ruby package and exact ABI assertions.
 */
export const ownedRubyAdapterSources = (c, ruby) => ({ ...c.files
	, "internal/ruby-abi.h": ruby.abiHeader
	, [`src/${c.values.prefix}-ruby.c`]: `#include "ruby-abi.h"\n${c.source}\n${ruby.cSource}` });

/**
 * Reconstruct source and lifetime rules from authenticated compiler metadata.
 *
 * @param options - Private native staging directories.
 * @param options.nativeRoot - Compiled Lean component.
 * @param options.runtimeRoot - Shared Lean runtime.
 * @param options.adapterRoot - Ruby adapter and isolated GMP dependency.
 */
export const ownedRubyEvidence = async ({ nativeRoot, runtimeRoot, adapterRoot }) => {
	const { manifest: runtime, identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true, ownedReceiverExports: true, ownedCallbackResultAnchors: true });
	if(!model.ownedGraph?.hostCallbacks && !model.ownedGraph?.receiverExports && !model.ownedGraph?.callbackResultAnchors) throw new TypeError("Owned Ruby requires authenticated callback/copy, receiver or callback-result support");
	const metadata = JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8"));
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const anchoredResults = Boolean(model.ownedGraph.resultAnchors);
	const receiverExports = Boolean(model.ownedGraph.receiverExports), hostCallbacks = Boolean(model.ownedGraph.hostCallbacks);
	const callbackResultAnchors = Boolean(model.ownedGraph.callbackResultAnchors);
	const options = { transferredInputs, anchoredResults, receiverExports, hostCallbacks, callbackResultAnchors, valueCopies: callbackResultAnchors };
	const c = generateOwnedCPackage({ metadata, sourceIdentity: model.sourceIdentity, component: model.component, ...options });
	const ruby = generateOwnedRubyPackage(model.bindingIr, null, options), prefix = c.values.prefix;
	const adapter = JSON.parse(await readFile(join(adapterRoot, "native-ruby-adapter.json"), "utf8"));
	await verifyNativeFiles(adapterRoot, adapter.files);
	const sources = ownedRubyAdapterSources(c, ruby), gmpLibrary = "libgmp-lean-bridge.so.10";
	const gmpFiles = ["include/gmp.h", `lib/${gmpLibrary}`
		, "share/lean-bridge/gmp.json"
		, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"
		, ...["COPYING", "COPYING.LESSERv3", "COPYINGv2", "COPYINGv3"].map(name => `share/lean-bridge/licenses/GMP-${name}`)];
	const expectedPaths = [...Object.keys(sources), `lib/lib${prefix}_ruby.so`, ...gmpFiles.map(path => `gmp/${path}`)].sort();
	if(adapter.schemaVersion !== (callbackResultAnchors ? 5 : receiverExports ? 4 : anchoredResults ? 3 : transferredInputs ? 2 : 1) || adapter.profile !== "native-library-v1" || adapter.runtimeIdentity !== identity
		|| adapter.bindingIrSha256 !== model.bindingIrSha256 || adapter.componentReceiptSha256 !== sha256(canonicalJson(receipt))
		|| adapter.library !== `lib${prefix}_ruby.so` || adapter.ownedValues?.schemaVersion !== (callbackResultAnchors ? 6 : receiverExports ? 5 : anchoredResults ? 4 : transferredInputs ? 3 : 2)
		|| canonicalJson(adapter.ownedValues.callbackResultAnchors ?? null) !== canonicalJson(model.ownedGraph.callbackResultAnchors ?? null)
		|| canonicalJson(adapter.ownedValues.receiverExports ?? null) !== canonicalJson(model.ownedGraph.receiverExports ?? null)
		|| canonicalJson(adapter.ownedValues.resultAnchors ?? null) !== canonicalJson(model.ownedGraph.resultAnchors ?? null)
		|| canonicalJson(adapter.ownedValues.inputTransfers ?? null) !== canonicalJson(model.ownedGraph.inputTransfers ?? null)
		|| canonicalJson(adapter.ownedValues.hostCallbacks ?? null) !== canonicalJson(model.ownedGraph.hostCallbacks ?? null)
		|| adapter.ownedValues.headerSha256 !== sha256(c.publicHeader) || adapter.ownedValues.sourceSha256 !== sha256(c.source)
		|| canonicalJson(adapter.rubyValues ?? null) !== canonicalJson(ruby.contract)
		|| canonicalJson(adapter.gmp) !== canonicalJson({ version: "6.3.0", soname: gmpLibrary, binding: "local-symbols" })
		|| canonicalJson(Object.keys(adapter.files).sort()) !== canonicalJson(expectedPaths)
		|| canonicalJson(await nativeArtifactPaths(adapterRoot)) !== canonicalJson([...expectedPaths, "native-ruby-adapter.json"].sort()))
		throw new Error("Owned Ruby adapter differs from compiler-authenticated types or lifetime rules");
	for(const [path, source] of Object.entries(sources))
		if(source !== await readFile(join(adapterRoot, path), "utf8")) throw new Error(`Owned Ruby generated adapter source differs: ${path}`);
	const gmpRoot = join(adapterRoot, "gmp"), gmp = JSON.parse(await readFile(join(gmpRoot, "share/lean-bridge/gmp.json"), "utf8"));
	await verifyNativeFiles(gmpRoot, gmp.files);
	if(Object.entries(gmpIdentity).some(([key, value]) => gmp[key] !== value)
		|| gmp.soname !== gmpLibrary || gmp.binding !== "local-symbols" || gmp.checked !== true
		|| !gmp.configure?.includes("LIBGMP_LDFLAGS=-release lean-bridge -Wl,-Bsymbolic")
		|| !gmp.configure?.some(flag => flag.startsWith("CFLAGS=") && flag.split(" ").includes("-fPIC"))
		|| canonicalJson(Object.keys(gmp.files).sort()) !== canonicalJson(gmpFiles.filter(path => !["share/lean-bridge/gmp.json", "share/lean-bridge/sources/gmp-6.3.0.tar.xz"].includes(path)).sort())
		|| sha256(await readFile(join(gmpRoot, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"))) !== gmpIdentity.sha256)
		throw new Error("Owned Ruby GMP differs from its isolated, checked source build");
	validateNativeElf(await readFile(join(gmpRoot, "lib", gmpLibrary)));
	const libraries = { [adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [receipt.library]: receipt.nativeLibrary.sha256
		, [gmpLibrary]: adapter.files[`gmp/lib/${gmpLibrary}`].sha256
		, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256])) };
	const libraryPaths = Object.fromEntries(Object.keys(libraries).map(file => [file
		, file === adapter.library ? join(adapterRoot, "lib", file)
			: file === receipt.library ? join(nativeRoot, file)
				: file === gmpLibrary ? join(gmpRoot, "lib", file) : join(runtimeRoot, "lib", file)]));
	const evidence = { runtimeIdentity: identity, componentId: model.component.id
		, componentReceiptSha256: sha256(canonicalJson(receipt))
		, ownedValues: ruby.contract
		, library: adapter.library, libraries };
	return { model, receipt, prefix, evidence, libraryPaths, adapter, runtime, ruby };
};
