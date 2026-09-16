/**
 * Closed wasm32 copied-component receipts, separate from native and npm ABIs.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { nativeArtifactPaths } from "./native-artifacts.mjs";
import { createPhpWasmCopiedModel, generateNativeLeanAdapters } from "./native-model.mjs";
import { generateCopiedPhpZendAdapter } from "../backends/php/copied-zend.mjs";
import { readVerifiedSourceNotices } from "../release/source-notices.mjs";
import { verifyPackageMetadataSource } from "../analyze/package-metadata.mjs";

export const phpWasmCopiedProfile = "php-wasm-copied-v1";
export const phpWasmCopiedCompilerFiles = Object.freeze(["upstream/emscripten/emcc", "upstream/emscripten/em++.py", "upstream/emscripten/emcc.py", "upstream/emscripten/tools/link.py", "upstream/bin/clang", "upstream/bin/wasm-ld"]);
export const phpWasmCopiedPins = Object.freeze({
	leanCommit: "f3b06c705e6c85f5314019d5d3baab0fec5b580c"
	, patchSetSha256: "743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3"
	, emscriptenVersion: "3.1.68"
	, emscriptenCommit: "ceee49d2ecdab36a3feb85a684f8e5a453dde910"
	, emsdkCommit: "54ef088329e5a329614b3659a579d2ccd31fd621"
	, phpVersion: "8.4.1"
	, phpCommit: "0454901ed1518cfb42bc77ac91728591b58c3e6e"
	, phpWasmVersion: "0.1.0"
	, phpWasmCommit: "bd9a46bf4984bfbdfef4bb6f5b04b7dcd6264c89"
});
const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const closed = (object, keys) => object && typeof object === "object" && !Array.isArray(object) && same(Object.keys(object).sort(), [...keys].sort());
const file = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$(?![\s\S])/.test(value);
const fileIdentity = value => closed(value, ["bytes", "sha256"]) && Number.isSafeInteger(value.bytes) && value.bytes >= 0 && hash(value.sha256);
const compilerIdentity = value => closed(value, ["version", "emsdkCommit", "files"])
	&& value.emsdkCommit === phpWasmCopiedPins.emsdkCommit && typeof value.version === "string"
	&& value.version.endsWith(` ${phpWasmCopiedPins.emscriptenVersion} (${phpWasmCopiedPins.emscriptenCommit})`)
	&& closed(value.files, phpWasmCopiedCompilerFiles) && Object.values(value.files).every(item => fileIdentity(item) && item.bytes > 0);

/**
 * Every side module must borrow the PHP host's single memory and function table.
 *
 * @param bytes - Compiled WebAssembly side module.
 * @param extension - Require the private Zend entry point and no public Lean ABI.
 */
export const validatePhpWasmCopiedBinary = async (bytes, extension = false) => {
	const module = await WebAssembly.compile(bytes);
	const imports = WebAssembly.Module.imports(module), exports = WebAssembly.Module.exports(module);
	if(!same(imports.filter(item => item.kind === "memory" || item.kind === "table").map(item => [item.module, item.name]).sort(), [["env", "__indirect_function_table"], ["env", "memory"]])
		|| exports.some(item => ["memory", "table"].includes(item.kind))) throw new Error("PHP-Wasm copied modules must share the host memory and table");
	if(extension && (!exports.some(item => item.name === "get_module")
		|| exports.some(item => !["get_module", "__wasm_call_ctors", "__wasm_apply_data_relocs"].includes(item.name) && !/^dynCall_[vifdj][ifdj]*$/.test(item.name))))
		throw new Error(`PHP-Wasm extension must keep component symbols private: ${exports.map(item => item.name).join(", ")}`);
	return module;
};

/**
 * Check regular files, safe paths, exact lengths and digests; reject extra files.
 *
 * @param root - Artifact directory.
 * @param inventory - Closed relative-path inventory.
 * @param manifestName - The sole file excluded from its own inventory.
 */
export const verifyPhpWasmCopiedFiles = async (root, inventory, manifestName) => {
	if(!inventory || typeof inventory !== "object" || Array.isArray(inventory) || !Object.keys(inventory).length) throw new Error("Invalid PHP-Wasm file inventory");
	const actual = await nativeArtifactPaths(root);
	if(!same(actual, [...Object.keys(inventory), manifestName].sort())) throw new Error("Unrecorded or missing PHP-Wasm artifact");
	for(const [path, identity] of Object.entries(inventory))
	{
		if(!/^[A-Za-z0-9_.+/-]+$/.test(path) || path.split("/").some(part => !part || part === "." || part === "..")
			|| !closed(identity, ["bytes", "sha256"]) || !same(identity, file(await readFile(join(root, path))))) throw new Error(`PHP-Wasm artifact drift: ${path}`);
	}
};

/**
 * Verify a separately compiled wasm32 runtime and its target Lean headers.
 *
 * @param root - Shared PHP-Wasm runtime output.
 */
export const readVerifiedPhpWasmCopiedRuntime = async root => {
	const bytes = await readFile(join(root, "runtime.json")), manifest = JSON.parse(bytes);
	if(!closed(manifest, ["schemaVersion", "profile", "pointerBits", "pins", "compiler", "inputs", "library", "files"])
		|| manifest.schemaVersion !== 1 || manifest.profile !== phpWasmCopiedProfile || manifest.pointerBits !== 32
		|| !compilerIdentity(manifest.compiler) || !closed(manifest.inputs, ["files", "brokerSha256", "libuvSha256"])
		|| !hash(manifest.inputs.brokerSha256) || !hash(manifest.inputs.libuvSha256)
		|| !manifest.inputs.files || !Object.values(manifest.inputs.files).every(fileIdentity)
		|| !same(manifest.pins, phpWasmCopiedPins) || !/^lib\/liblean_bridge_php_wasm_copied_[a-f0-9]{20}\.so$/.test(manifest.library)
		|| ![manifest.library, "include/lean/lean.h", "include/lean/config.h", "include/lean_bridge_native_runtime.h"].every(path => Object.hasOwn(manifest.files, path))) throw new Error("Invalid PHP-Wasm copied runtime profile");
	const key = sha256(canonicalJson({ profile: phpWasmCopiedProfile, pins: manifest.pins, compiler: manifest.compiler, inputs: manifest.inputs })).slice(0, 20);
	if(manifest.library !== `lib/liblean_bridge_php_wasm_copied_${key}.so`) throw new Error("PHP-Wasm runtime name differs from its build inputs");
	for(const name of ["lean.h", "lean_gmp.h", "lean_libuv.h", "config.h", "version.h"])
		if(!same(manifest.files[`include/lean/${name}`], manifest.inputs.files[`cmake/include/lean/${name}`])) throw new Error("PHP-Wasm runtime header differs from its target build");
	if(!["cmake/lib/lean/libInit.a", "cmake/lib/lean/libleanrt.a", "source/.lean-wasm-patched"].every(path => Object.hasOwn(manifest.inputs.files, path))) throw new Error("PHP-Wasm runtime is missing target archive identities");
	await verifyPhpWasmCopiedFiles(root, manifest.files, "runtime.json");
	await validatePhpWasmCopiedBinary(await readFile(join(root, manifest.library)));
	return { manifest, identity: sha256(canonicalJson(manifest)) };
};

/**
 * Reconstruct the 32-bit model and both adapters before using compiled output.
 *
 * @param root - Compiled PHP-Wasm component output.
 * @param runtimeIdentity - Required shared runtime identity.
 */
export const readVerifiedPhpWasmCopiedComponent = async (root, runtimeIdentity) => {
	const read = async path => JSON.parse(await readFile(join(root, path), "utf8"));
	const inventory = await read("artifacts.json"), receipt = await read("php-wasm-component.json"), model = await read("model.json");
	if(!closed(inventory, ["schemaVersion", "profile", "files"]) || inventory.schemaVersion !== 1 || inventory.profile !== phpWasmCopiedProfile) throw new Error("Invalid PHP-Wasm component inventory");
	await verifyPhpWasmCopiedFiles(root, inventory.files, "artifacts.json");
	const metadata = await read("metadata.json");
	const reconstructed = createPhpWasmCopiedModel({ metadata, component: model.component, sourceIdentity: receipt.sourceIdentity });
	const adapters = generateNativeLeanAdapters(reconstructed), zend = generateCopiedPhpZendAdapter(reconstructed.bindingIr);
	const zendManifest = JSON.parse(zend["copied-zend-manifest.json"]);
	if(!closed(receipt, ["schemaVersion", "profile", "pointerBits", "runtimeIdentity", "bindingIrSha256", "sourceIdentity", "metadataSha256", "modelSha256", "headerSha256", "adaptersSha256", "zendSha256", "initializer", "library", "wasmLibrary", "compiler", "phpHeadersSha256", "exports"])
		|| receipt.schemaVersion !== 1 || receipt.profile !== phpWasmCopiedProfile || receipt.pointerBits !== 32
		|| receipt.sourceIdentity.leanCommit !== phpWasmCopiedPins.leanCommit || !compilerIdentity(receipt.compiler) || !hash(receipt.phpHeadersSha256)
		|| receipt.runtimeIdentity !== runtimeIdentity || !same(model, reconstructed)
		|| receipt.modelSha256 !== sha256(canonicalJson(model)) || receipt.bindingIrSha256 !== model.bindingIrSha256
		|| !same(await read("binding-ir.json"), model.bindingIr)
		|| receipt.metadataSha256 !== sha256(canonicalJson(metadata))
		|| receipt.headerSha256 !== sha256(adapters.header) || adapters.header !== await readFile(join(root, "component.h"), "utf8")
		|| receipt.adaptersSha256 !== sha256(adapters.leanSource) || adapters.leanSource !== await readFile(join(root, "generated.lean"), "utf8")
		|| receipt.zendSha256 !== sha256(zend["copied-zend-manifest.json"])
		|| receipt.initializer !== `initialize_${adapters.module}`
		|| receipt.library !== `lib/php8.4-${zendManifest.extension}.so`
		|| !same(receipt.exports, zendManifest.exports)) throw new Error("PHP-Wasm component differs from compiler metadata, adapters or runtime");
	for(const [path, source] of Object.entries(zend))
		if(source !== await readFile(join(root, path), "utf8")) throw new Error(`PHP-Wasm Zend source drift: ${path}`);
	const bytes = await readFile(join(root, receipt.library));
	if(!same(receipt.wasmLibrary, file(bytes))) throw new Error("PHP-Wasm component binary drift");
	await validatePhpWasmCopiedBinary(bytes, true);
	const notices = await readVerifiedSourceNotices(root, receipt.sourceIdentity);
	verifyPackageMetadataSource(receipt.sourceIdentity, notices.document.packages[0].source.inputs);
	return { model, receipt };
};
