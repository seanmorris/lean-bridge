/**
 * Authenticate the private C# ownership adapter and its GMP dependency.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateOwnedCPackage } from "../backends/c/owned-package.mjs";
import { generateOwnedDotnetPackage } from "../backends/dotnet/owned-package.mjs";
import { gmpIdentity } from "../backends/c/gmp.mjs";
import { nativeArtifactPaths, readVerifiedNativeComponent, readVerifiedNativeRuntime, validateNativeElf, verifyNativeFiles } from "./native-artifacts.mjs";

/**
 * Keep managed lifetime cleanup beside the unchanged C ownership implementation.
 *
 * @param c - Authenticated public C adapter sources.
 * @param dotnet - Generated managed model and native thread-exit guard.
 */
export const ownedDotnetAdapterSources = (c, dotnet) => ({ ...c.files
	, [`src/${c.values.prefix}-dotnet.c`]: c.source + dotnet.cleanup.source
	, [`src/${c.values.prefix}-dotnet-thread-exit.cpp`]: dotnet.cleanup.guardSource });

/**
 * Derive loader identities from compiled artifacts, never caller-supplied hashes.
 *
 * @param options - Closed producer staging roots.
 * @param options.nativeRoot - Compiler-authenticated Lean component.
 * @param options.runtimeRoot - Prepared shared runtime and broker.
 * @param options.adapterRoot - C# adapter, TLS guard and private GMP artifacts.
 */
export const ownedDotnetEvidence = async ({ nativeRoot, runtimeRoot, adapterRoot }) => {
	const { manifest: runtime, identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true });
	if(!model.ownedGraph?.hostCallbacks) throw new TypeError("Owned C# requires authenticated callback/copy support");
	const metadata = JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8"));
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const c = generateOwnedCPackage({ metadata, sourceIdentity: model.sourceIdentity, component: model.component, hostCallbacks: true, transferredInputs });
	const projection = generateOwnedDotnetPackage(model.bindingIr, null, { transferredInputs }), prefix = c.values.prefix;
	const adapter = JSON.parse(await readFile(join(adapterRoot, "native-dotnet-adapter.json"), "utf8"));
	await verifyNativeFiles(adapterRoot, adapter.files);
	const sources = ownedDotnetAdapterSources(c, projection), gmpLibrary = "libgmp-lean-bridge.so.10";
	const gmpFiles = ["include/gmp.h", `lib/${gmpLibrary}`
		, "share/lean-bridge/gmp.json", "share/lean-bridge/sources/gmp-6.3.0.tar.xz"
		, ...["COPYING", "COPYING.LESSERv3", "COPYINGv2", "COPYINGv3"].map(name => `share/lean-bridge/licenses/GMP-${name}`)];
	const expectedPaths = [...Object.keys(sources), `lib/lib${prefix}_dotnet.so`, ...gmpFiles.map(path => `gmp/${path}`)].sort();
	if(adapter.schemaVersion !== (transferredInputs ? 2 : 1) || adapter.profile !== "native-library-v1" || adapter.runtimeIdentity !== identity
		|| adapter.bindingIrSha256 !== model.bindingIrSha256 || adapter.componentReceiptSha256 !== sha256(canonicalJson(receipt))
		|| adapter.library !== `lib${prefix}_dotnet.so` || adapter.ownedValues?.schemaVersion !== (transferredInputs ? 3 : 2)
		|| canonicalJson(adapter.ownedValues.inputTransfers ?? null) !== canonicalJson(model.ownedGraph.inputTransfers ?? null)
		|| canonicalJson(adapter.ownedValues.hostCallbacks) !== canonicalJson(model.ownedGraph.hostCallbacks)
		|| adapter.ownedValues.headerSha256 !== sha256(c.publicHeader) || adapter.ownedValues.sourceSha256 !== sha256(c.source)
		|| canonicalJson(adapter.dotnetValues ?? null) !== canonicalJson(projection.contract)
		|| canonicalJson(adapter.gmp) !== canonicalJson({ version: "6.3.0", soname: gmpLibrary, binding: "local-symbols" })
		|| canonicalJson(Object.keys(adapter.files).sort()) !== canonicalJson(expectedPaths)
		|| canonicalJson(await nativeArtifactPaths(adapterRoot)) !== canonicalJson([...expectedPaths, "native-dotnet-adapter.json"].sort()))
		throw new Error("Owned C# adapter differs from compiler-authenticated types or lifetime rules");
	for(const [path, source] of Object.entries(sources))
		if(source !== await readFile(join(adapterRoot, path), "utf8")) throw new Error(`Owned C# generated adapter source differs: ${path}`);
	const gmpRoot = join(adapterRoot, "gmp"), gmp = JSON.parse(await readFile(join(gmpRoot, "share/lean-bridge/gmp.json"), "utf8"));
	await verifyNativeFiles(gmpRoot, gmp.files);
	if(Object.entries(gmpIdentity).some(([key, value]) => gmp[key] !== value)
		|| gmp.soname !== gmpLibrary || gmp.binding !== "local-symbols" || gmp.checked !== true
		|| !gmp.configure?.includes("LIBGMP_LDFLAGS=-release lean-bridge -Wl,-Bsymbolic")
		|| !gmp.configure?.some(flag => flag.startsWith("CFLAGS=") && flag.split(" ").includes("-fPIC"))
		|| canonicalJson(Object.keys(gmp.files).sort()) !== canonicalJson(gmpFiles.filter(path => !["share/lean-bridge/gmp.json", "share/lean-bridge/sources/gmp-6.3.0.tar.xz"].includes(path)).sort())
		|| sha256(await readFile(join(gmpRoot, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"))) !== gmpIdentity.sha256)
		throw new Error("Owned C# GMP differs from its isolated, checked source build");
	validateNativeElf(await readFile(join(gmpRoot, "lib", gmpLibrary)));
	validateNativeElf(await readFile(join(adapterRoot, "lib", adapter.library)));
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
		, ownedValues: projection.contract, library: adapter.library, libraries };
	return { model, receipt, projection, prefix, evidence, libraryPaths, adapter, runtime };
};
