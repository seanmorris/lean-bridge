/**
 * Closed native-library-v1 artifact inventories, independent of wasm32 policies.
 *
 * @file
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "./native-model.mjs";
import { readVerifiedSourceNotices } from "../release/source-notices.mjs";
import { verifyPackageMetadataSource } from "../analyze/package-metadata.mjs";
import { verifyReviewedSourceInputs } from "../analyze/reviewed-source.mjs";

/**
 * List regular payload files and reject symlinks and special filesystem entries.
 *
 * @param root - Filesystem root containing the native artifacts.
 * @param prefix - Relative path prefix or installed Perl library location.
 */
export async function nativeArtifactPaths(root, prefix = "")
{
	const result = [];
	for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
	{
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		if(entry.isDirectory()) result.push(...await nativeArtifactPaths(root, path));
		else if(entry.isFile()) result.push(path);
    else throw new Error(`unsupported native artifact: ${path}`);
	}
	return result.sort();
}

/**
 * Require the compiled Linux x86-64 ELF ABI before staging any native library.
 *
 * @param bytes - Exact compiled shared-library bytes.
 */
export const validateNativeElf = bytes => {
	if(bytes.length < 64 || bytes.subarray(0, 4).toString("hex") !== "7f454c46" || bytes[4] !== 2
    || bytes[5] !== 1 || bytes.readUInt16LE(18) !== 62 || bytes.readUInt16LE(16) !== 3) throw new Error("native-library-v1 requires Linux x86-64 little-endian shared ELF");
};

/**
 * Verify a closed, path-safe file inventory against the supplied artifact root.
 *
 * @param root - Filesystem root containing the native artifacts.
 * @param files - Expected artifact paths and SHA-256 identities.
 */
export async function verifyNativeFiles(root, files)
{
	if(!files || typeof files !== "object" || Array.isArray(files) || !Object.keys(files).length) throw new Error("invalid native file inventory");
	const actual = new Set(await nativeArtifactPaths(root));
	for(const [path, identity] of Object.entries(files))
	{
		// javac names nested classes Outer$Inner.class. Keep dollars out of directories
		// and non-class payloads; no shell interpretation is used for these paths.
		const safe = /^[A-Za-z0-9_.+/-]+$/.test(path) || /^(?:[A-Za-z0-9_.+-]+\/)*[A-Za-z_][A-Za-z0-9_]*(?:\$[A-Za-z0-9_]+)+\.class$/.test(path);
		if(!actual.has(path) || !safe || path.split("/").some(part => !part || part === "." || part === "..")) throw new Error(`invalid native artifact path: ${path}`);
		if(!identity || Object.keys(identity).sort().join(",") !== "bytes,sha256" || !Number.isSafeInteger(identity.bytes)
      || identity.bytes < 0 || !/^[a-f0-9]{64}$/.test(identity.sha256)) throw new Error("invalid native file identity");
		const bytes = await readFile(join(root, path));
		if(sha256(bytes) !== identity.sha256 || bytes.length !== identity.bytes) throw new Error(`native artifact drift: ${path}`);
		if(path.endsWith(".so")) validateNativeElf(bytes);
	}
}

/**
 * Read the exact runtime manifest and verify all its binaries and C headers.
 *
 * @param root - Filesystem root containing the native artifacts.
 */
export async function readVerifiedNativeRuntime(root)
{
	const bytes = await readFile(join(root, "runtime.json"));
	const manifest = JSON.parse(bytes);
	if(Object.keys(manifest).sort().join(",") !== "files,leanCommit,pointerBits,profile,schemaVersion"
    || manifest.schemaVersion !== 1 || manifest.profile !== "native-library-v1" || manifest.pointerBits !== 64
    || !/^[a-f0-9]{40}$/.test(manifest.leanCommit)
    || !["lib/libleanshared.so", "lib/liblean_bridge_native.so", "include/lean_bridge_native_runtime.h", "include/lean/lean.h"].every(path => Object.hasOwn(manifest.files, path))) throw new Error("invalid native runtime manifest");
	await verifyNativeFiles(root, manifest.files);
	if((await nativeArtifactPaths(root)).some(path => path !== "runtime.json" && !Object.hasOwn(manifest.files, path))) throw new Error("unrecorded native runtime artifact");
	return { manifest, identity: sha256(bytes) };
}

/**
 * Reconstruct source semantics and adapters before a new host projection.
 *
 * @param root - Compiled component directory.
 * @param runtimeIdentity - Expected shared runtime manifest identity.
 */
export async function readVerifiedNativeComponent(root, runtimeIdentity)
{
	const read = async path => JSON.parse(await readFile(join(root, path), "utf8"));
	const inventory = await read("artifacts.json"), receipt = await read("native-component.json"), model = await read("model.json");
	await verifyNativeFiles(root, inventory.files);
	if((await nativeArtifactPaths(root)).some(path => path !== "artifacts.json" && !Object.hasOwn(inventory.files, path))) throw new Error("unrecorded native component artifact");
	const metadata = await read("metadata.json");
	const reconstructed = createNativeModel({ metadata, component: model.component, moduleName: model.moduleName, sourceIdentity: receipt.sourceIdentity });
	const adapters = generateNativeLeanAdapters(reconstructed);
	if(receipt.profile !== "native-library-v1" || receipt.schemaVersion !== 1
		|| receipt.runtimeIdentity !== runtimeIdentity
		|| canonicalJson(model) !== canonicalJson(reconstructed)
		|| receipt.modelSha256 !== sha256(canonicalJson(model))
		|| receipt.bindingIrSha256 !== model.bindingIrSha256
		|| canonicalJson(await read("binding-ir.json")) !== canonicalJson(model.bindingIr)
		|| receipt.metadataSha256 !== sha256(await readFile(join(root, "metadata.json")))
		|| receipt.headerSha256 !== sha256(adapters.header)
		|| adapters.header !== await readFile(join(root, "component.h"), "utf8")
		|| receipt.adaptersSha256 !== sha256(adapters.leanSource)
		|| adapters.leanSource !== await readFile(join(root, "generated.lean"), "utf8")
		|| receipt.initializer !== `initialize_${adapters.module}`
		|| !/^libcomponent_[0-9a-f]{20}\.so$/.test(receipt.library)) throw new Error("native component differs from compiler metadata or runtime");
	const bytes = await readFile(join(root, receipt.library));
	validateNativeElf(bytes);
	if(receipt.nativeLibrary.sha256 !== sha256(bytes) || receipt.nativeLibrary.bytes !== bytes.length) throw new Error("native component binary drift");
	const notices = await readVerifiedSourceNotices(root, receipt.sourceIdentity);
	verifyPackageMetadataSource(receipt.sourceIdentity, notices.document.packages[0].source.inputs);
	verifyReviewedSourceInputs(receipt.sourceIdentity, notices.document.packages[0].source.inputs);
	return { model, receipt };
}
