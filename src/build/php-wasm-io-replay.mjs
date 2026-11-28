/** @file Reconstruct synchronous PHP-Wasm bindings without Lean, Emscripten or the source checkout. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateCTaskExports } from "../backends/c/task-exports.mjs";
import { generateSyncWire } from "../backends/c/sync-wire.mjs";
import { compilePhpWasmSyncSurface } from "../backends/php/io-surface.mjs";
import { generatePhpWasmIOFiles } from "../backends/php/php-wasm-io-files.mjs";
import { generatePhpWasmIOZend } from "../backends/php/php-wasm-io-zend.mjs";
import { validatePhpWasmCopiedBinary } from "./php-wasm-copied-artifacts.mjs";
import { nativeArtifactPaths } from "./native-artifacts.mjs";

const asset = path => readFile(new URL("../backends/c/" + path, import.meta.url), "utf8");
const hex = s => typeof s === "string" && /^[a-f0-9]{64}$(?![\s\S])/u.test(s);
const phpPaths = ["src/Api.php", "src/Internal/Native.php", "src/Internal/WireValues.php"];
const sameKeys = (left, right) => canonicalJson([...left].sort()) === canonicalJson([...right].sort());
const expectedReceipt = r => {
	if(!r || !sameKeys(Object.keys(r), ["schemaVersion","profile","name","version","componentIdentity","runtimeIdentity","phpHeadersSha256","bindingIrSha256","zendIdentity","library","librarySha256"])
		|| r.profile !== "php-wasm-sync-io-v1" || r.schemaVersion !== 1 || !hex(r.zendIdentity)
		|| r.library !== "php8.4-lb_wasm_io_" + r.zendIdentity + ".so" || !hex(r.librarySha256))
		throw new Error("Expected a synchronous PHP-Wasm build receipt");
};
const owner = `#if !defined(__wasm32__) || !defined(__EMSCRIPTEN__) || defined(__EMSCRIPTEN_PTHREADS__) || !LB_SYNC_ONLY
#error Expected synchronous IO on a single-threaded PHP-Wasm instance
#endif
static int lb_context(void) { return lean_bridge_native_process_valid(); }
`;

/**
 * Derive precisely the same private entry symbols for the compiler and the reader.
 *
 * @param input - Runtime identity, reconciled entries, public IR and compiler evidence.
 */
export const phpWasmIOCoreRecipe = async input => {
	const { runtimeIdentity, api, entries, evidence } = input;
	if(!hex(runtimeIdentity)) throw new TypeError("Invalid PHP-Wasm IO runtime identity");
	const common = { name: "php-wasm-" + sha256(api.component.id)
		, modules: evidence.selection.exportModules
		, entries, synchronousIO: true, integerMode: "words" };
	const skeleton = generateCTaskExports({ ...common, componentIdentity: "0".repeat(64) });
	const wire = generateSyncWire(skeleton.prefix, entries, { phpWasm: true });
	const delivery = await asset("task-delivery.h"), integers = skeleton.integerMode ? await asset("task-integers.h") : "";
	const componentIdentity = sha256(canonicalJson({ runtime: runtimeIdentity
		, evidence, skeleton, wire: sha256(wire.source), delivery: sha256(delivery)
		, owner: sha256(owner)
		, integers: sha256(integers) }));
	return { componentIdentity, wire, gen: generateCTaskExports({ ...common, componentIdentity }), owner, delivery, integers };
};

/**
 * Bind public PHP wrappers and the private Zend transport to the same core and target headers.
 *
 * @param input - Reconciled PHP model and input digests.
 */
export const phpWasmIOZendRecipe = async input => {
	const { model, componentIdentity, phpHeadersSha256, bindingIrSha256 } = input;
	if(![componentIdentity, phpHeadersSha256, bindingIrSha256].every(hex)) throw new TypeError("Invalid PHP-Wasm IO build identity");
	const template = generatePhpWasmIOZend(model, "0".repeat(64));
	const php = await generatePhpWasmIOFiles(model, template);
	const zendIdentity = sha256(canonicalJson({ componentIdentity
		, phpHeadersSha256, bindingIrSha256
		, zend: sha256(template.source), port: sha256(template.port.source)
		, header: sha256(template.port.header)
		, php: Object.fromEntries(Object.entries(php).map(([p,src]) => [p,sha256(src)])) }));
	const gen = generatePhpWasmIOZend(model, zendIdentity);
	return { zendIdentity, gen, files: await generatePhpWasmIOFiles(model, gen) };
};

/**
 * Check the payload against a separately retained build receipt. This checks
 * its consistency and binary digest, not the provenance of an unsigned receipt.
 *
 * @param input - Original receipt, compiler evidence, public IR and unpacked payload bytes.
 */
export const verifyPhpWasmIOPayload = async input => {
	const { receipt, api, evidence, files, library } = input;
	expectedReceipt(receipt);
	const model = compilePhpWasmSyncSurface({ ...receipt, api, evidence });
	const { componentIdentity } = await phpWasmIOCoreRecipe({ ...receipt, api, evidence, entries: model.entries });
	if(componentIdentity !== receipt.componentIdentity) throw new Error("PHP-Wasm IO core identity mismatch");
	const zend = await phpWasmIOZendRecipe({ ...receipt, model, componentIdentity });
	if(zend.zendIdentity !== receipt.zendIdentity || zend.gen.library !== receipt.library || library.name !== zend.gen.library)
		throw new Error("PHP-Wasm IO Zend identity mismatch");
	if(!sameKeys(Object.keys(files), Object.keys(zend.files)))
		throw new Error("Unexpected PHP-Wasm IO wrapper inventory");
	for(const [path, source] of Object.entries(zend.files))
		if(!Buffer.from(source).equals(files[path])) throw new Error("PHP-Wasm IO wrapper differs: " + path);
	if(sha256(library.bytes) !== receipt.librarySha256) throw new Error("PHP-Wasm IO binary digest mismatch");
	await validatePhpWasmCopiedBinary(library.bytes, true);
	return model;
};

/**
 * Read the closed component previously emitted by the producer, with no build tools.
 *
 * @param root - Unpacked, immutable component directory.
 * @param expected - Receipt supplied by the caller, independently of the payload.
 */
export const readPhpWasmIOPayload = async (root, expected) => {
	expectedReceipt(expected);
	const paths = ["io-receipt.json", "binding-ir.json", "host-export-evidence.json", expected.library, ...phpPaths];
	if(!sameKeys(await nativeArtifactPaths(root), paths)) throw new Error("Unexpected PHP-Wasm IO component inventory");
	if(await readFile(join(root, "io-receipt.json"), "utf8") !== canonicalJson(expected)) throw new Error("Different PHP-Wasm IO build receipt");
	const document = async path => JSON.parse(await readFile(join(root, path), "utf8"));
	const api = await document("binding-ir.json"), evidence = await document("host-export-evidence.json");
	const files = Object.fromEntries(await Promise.all(phpPaths.map(async path => [path, await readFile(join(root, path))])));
	const library = { name: expected.library, bytes: await readFile(join(root, expected.library)) };
	const model = await verifyPhpWasmIOPayload({ receipt: expected, api, evidence, files, library });
	return { model, api, evidence, files, library, receipt: expected };
};

/**
 * Write only to a fresh directory inside the caller's private staging area.
 *
 * @param root - New component destination; parent already exists.
 * @param core - Freshly linked compiler output, including Zend metadata.
 */
export const writePhpWasmIOPayload = async (root, core) => {
	const { receipt, files, library } = core.zend;
	expectedReceipt(receipt);
	if(basename(library) !== receipt.library || !sameKeys(Object.keys(files), phpPaths))
		throw new Error("Invalid PHP-Wasm IO compiler output inventory");
	await mkdir(root);
	const emit = (path, data) => writeFile(join(root, path), data, { flag: "wx" });
	await emit("binding-ir.json", canonicalJson(core.api));
	await emit("host-export-evidence.json", canonicalJson(core.evidence));
	await emit(receipt.library, await readFile(library));
	for(const path of phpPaths)
	{
		await mkdir(dirname(join(root,path)), { recursive: true });
		await emit(path, files[path]);
	}
	await emit("io-receipt.json", canonicalJson(receipt));
	return readPhpWasmIOPayload(root, receipt);
};
