/**
 * Authenticate PHP's owned adapter, isolated GMP and generated ownership rules.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateOwnedCPackage } from "../backends/c/owned-package.mjs";
import { generateOwnedPhpPackage } from "../backends/php/owned-package.mjs";
import { gmpIdentity } from "../backends/c/gmp.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime, validateNativeElf, verifyNativeFiles } from "./native-artifacts.mjs";
import { processBuildRunner } from "./process-runner.mjs";

/**
 * Compile public C ownership conversions and PHP callback snapshots together.
 *
 * @param c - Compiler-authenticated public C implementation.
 * @param php - Generated PHP conversions and callback shims.
 */
export const ownedPhpAdapterSources = (c, php) => ({ ...c.files
	, [`src/${c.values.prefix}-php.c`]: `${c.source}\n${php.nativeSource}` });

/**
 * Reconstruct sources and verify the closed native inventory before packaging.
 *
 * @param options - Authenticated compiled component, runtime and adapter roots.
 */
export const ownedPhpEvidence = async options => {
	const { nativeRoot, runtimeRoot, adapterRoot, environment = process.env, signal } = options;
	const { manifest: runtime, identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true, ownedReceiverExports: true, ownedCallbackResultAnchors: true });
	if(!model.ownedGraph) throw new TypeError("Owned PHP requires an authenticated ownership graph");
	const metadata = JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8"));
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const anchoredResults = Boolean(model.ownedGraph.resultAnchors);
	const callbackResultAnchors = Boolean(model.ownedGraph.callbackResultAnchors);
	const receiverExports = Boolean(model.ownedGraph.receiverExports), hostCallbacks = Boolean(model.ownedGraph.hostCallbacks);
	const capabilities = { transferredInputs, anchoredResults, receiverExports, callbackResultAnchors, hostCallbacks };
	const c = generateOwnedCPackage({ metadata, sourceIdentity: model.sourceIdentity, component: model.component, ...capabilities, valueCopies: callbackResultAnchors, identityEquality: receiverExports });
	const php = generateOwnedPhpPackage(model.bindingIr, null, capabilities), prefix = c.values.prefix;
	const adapter = JSON.parse(await readFile(join(adapterRoot, "native-php-adapter.json"), "utf8"));
	await verifyNativeFiles(adapterRoot, adapter.files);
	const sources = ownedPhpAdapterSources(c, php), gmpLibrary = "libgmp-lean-bridge.so.10";
	const gmpFiles = ["include/gmp.h", `lib/${gmpLibrary}`
		, "share/lean-bridge/gmp.json", "share/lean-bridge/sources/gmp-6.3.0.tar.xz"
		, ...["COPYING", "COPYING.LESSERv3", "COPYINGv2", "COPYINGv3"].map(name => `share/lean-bridge/licenses/GMP-${name}`)];
	const expectedPaths = [...Object.keys(sources), `lib/lib${prefix}_php.so`, ...gmpFiles.map(path => `gmp/${path}`)].sort();
	if(Object.keys(adapter).sort().join(",") !== "bindingIrSha256,componentReceiptSha256,files,gmp,library,ownedValues,phpValues,profile,runtimeIdentity,schemaVersion"
		|| adapter.schemaVersion !== (callbackResultAnchors ? 5 : receiverExports ? 4 : anchoredResults ? 3 : transferredInputs ? 2 : 1) || adapter.profile !== "native-library-v1" || adapter.runtimeIdentity !== identity
		|| adapter.bindingIrSha256 !== model.bindingIrSha256 || adapter.componentReceiptSha256 !== sha256(canonicalJson(receipt))
		|| adapter.library !== `lib${prefix}_php.so`
		|| canonicalJson(adapter.ownedValues) !== canonicalJson({ schemaVersion: callbackResultAnchors ? 6 : receiverExports ? 5 : anchoredResults ? 4 : transferredInputs ? 3 : 2
			, ...hostCallbacks ? { hostCallbacks: model.ownedGraph.hostCallbacks } : {}
			, ...transferredInputs ? { inputTransfers: model.ownedGraph.inputTransfers } : {}
			, ...anchoredResults ? { resultAnchors: model.ownedGraph.resultAnchors } : {}
			, ...receiverExports ? { receiverExports: model.ownedGraph.receiverExports } : {}
			, ...callbackResultAnchors ? { callbackResultAnchors: model.ownedGraph.callbackResultAnchors } : {}
			, headerSha256: sha256(c.publicHeader), sourceSha256: sha256(c.source) })
		|| canonicalJson(adapter.phpValues ?? null) !== canonicalJson(php.contract)
		|| canonicalJson(adapter.gmp) !== canonicalJson({ version: "6.3.0", soname: gmpLibrary, binding: "local-symbols" })
		|| canonicalJson(Object.keys(adapter.files).sort()) !== canonicalJson(expectedPaths)
		|| canonicalJson(await nativeArtifactPaths(adapterRoot)) !== canonicalJson([...expectedPaths, "native-php-adapter.json"].sort()))
		throw new Error("Owned PHP adapter differs from compiler-authenticated types or lifetime rules");
	for(const [path, source] of Object.entries(sources))
		if(source !== await readFile(join(adapterRoot, path), "utf8")) throw new Error(`Owned PHP generated adapter source differs: ${path}`);
	const gmpRoot = join(adapterRoot, "gmp"), gmp = JSON.parse(await readFile(join(gmpRoot, "share/lean-bridge/gmp.json"), "utf8"));
	await verifyNativeFiles(gmpRoot, gmp.files);
	if(Object.entries(gmpIdentity).some(([key, value]) => gmp[key] !== value)
		|| gmp.soname !== gmpLibrary || gmp.binding !== "local-symbols" || gmp.checked !== true
		|| !gmp.configure?.includes("LIBGMP_LDFLAGS=-release lean-bridge -Wl,-Bsymbolic")
		|| !gmp.configure?.some(flag => flag.startsWith("CFLAGS=") && flag.split(" ").includes("-fPIC"))
		|| canonicalJson(Object.keys(gmp.files).sort()) !== canonicalJson(gmpFiles.filter(path => !["share/lean-bridge/gmp.json", "share/lean-bridge/sources/gmp-6.3.0.tar.xz"].includes(path)).sort())
		|| sha256(await readFile(join(gmpRoot, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"))) !== gmpIdentity.sha256)
		throw new Error("Owned PHP GMP differs from its isolated, checked source build");
	validateNativeElf(await readFile(join(gmpRoot, "lib", gmpLibrary)));
	const dynamic = async path => (await processBuildRunner.capture({ command: "readelf", args: ["--dynamic", path], cwd: adapterRoot, env: environment, signal })).stdout;
	const report = await dynamic(join(adapterRoot, "lib", adapter.library));
	const needed = [...report.matchAll(/\(NEEDED\).*?\[([^\]]+)\]/gu)].map(match => match[1]);
	if(needed[0] !== gmpLibrary || ![receipt.library, "liblean_bridge_native.so", "libleanshared.so"].every(name => needed.includes(name))
		|| !report.includes(`(SONAME)`) || !report.includes(`[${adapter.library}]`)
		|| !/\((?:RUNPATH|RPATH)\).*\[\$ORIGIN\]/u.test(report) || !/\(FLAGS_1\).*NODELETE/u.test(report))
		throw new Error("Owned PHP adapter requires private-first GMP, relocatable dependencies and pinned loading");
	const gmpDynamic = await dynamic(join(gmpRoot, "lib", gmpLibrary));
	if(!/\(SONAME\).*\[libgmp-lean-bridge\.so\.10\]/u.test(gmpDynamic) || !/\((?:SYMBOLIC|FLAGS)\).*SYMBOLIC/u.test(gmpDynamic))
		throw new Error("Owned PHP GMP lacks private SONAME or local symbol binding");
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
		, ownedValues: php.contract, library: adapter.library, libraries };
	return { model, receipt, prefix, evidence, libraryPaths, adapter, runtime, php, needed };
};
