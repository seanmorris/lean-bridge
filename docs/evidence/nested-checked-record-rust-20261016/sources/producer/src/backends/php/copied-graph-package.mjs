/**
 * Public recursive PHP functions with authenticated, private native loading.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { generateCopiedPhpGraphConversions } from "./copied-graph-conversions.mjs";
import { copiedPhpLoader } from "./copied-assets.mjs";
import { phpGraphAssets } from "./copied-graph-assets.mjs";

/**
 * Validate the full PHP graph projection before compiling a native package.
 *
 * @param ir - Compiler-checked copied graph contract.
 */
export const compileCopiedPhpGraphPackageModel = ir => {
	const model = generateCopiedPhpGraphConversions(ir), prefix = model.layout.prefix;
	if(["gmp", "lean_bridge_native", "leanshared"].includes(prefix) || ir.component.id.length >= 160)
		throw new TypeError("PHP graph component name collides with a dependency or exceeds its name limit");
	return { ...model, ir, prefix, layoutSha256: sha256(canonicalJson(model.layout)) };
};

/**
 * Generate the public API and its closed, hash-bound private implementation.
 *
 * @param ir - Compiler-checked copied graph contract.
 * @param evidence - Verified native inventories, or null for source inspection.
 */
export const generateCopiedPhpGraphPackage = (ir, evidence = null) => {
	const model = compileCopiedPhpGraphPackageModel(ir), nodes = new Map(model.types.map(node => [node.id, node]));
	const files = { ...model.files };
	files["src/Api.php"] += `\nrequire_once __DIR__ . '/Internal/Native.php';\n\n${model.functions.map((fn, index) => {
		const root = model.layout.roots[index], result = nodes.get(root.result);
		return `/**
${root.parameters.map((id, n) => ` * @param ${nodes.get(id).docType} $${fn.parameters[n]}`).join("\n")}
 * @return ${result.docType}
 */
function ${fn.publicName}(${fn.parameters.map(name => `mixed $${name}`).join(", ")}): ${result.publicType} {
    if (\\func_num_args() !== ${fn.parameters.length}) throw new \\ArgumentCountError('${fn.publicName} requires exactly ${fn.parameters.length} arguments');
    return Internal\\Native::call(${index}, [${fn.parameters.map(name => `$${name}`).join(", ")}]);
}`;
	}).join("\n\n")}\n`;
	files["src/Internal/Native.php"] = phpGraphAssets(model, evidence);
	files["src/Internal/Runtime.php"] = copiedPhpLoader;
	files["README.md"] = `# ${model.namespace}

Install the prepared Composer release and require vendor/autoload.php. Call the generated ${model.namespace} functions. The archive includes the compiled Lean component and shared runtime. The loader verifies their hashes and loads them automatically. Composer installs brick/math 1.0.0. Consumers do not need Lean, a C compiler, native library paths or a package-specific Zend extension.

Requires PHP 8.2 or newer, below PHP 9, NTS CLI on Linux x86-64 with the declared glibc floor and FFI enabled. This native package does not target FPM, Apache, cli-server, ZTS or PHP-Wasm. Compatible packages share one process runtime. Start a fresh process after fork. Libraries remain mapped for the process lifetime; calls do not write runtime files.

Records and variant cases are final readonly classes. Arrays and Lists use consecutive-key PHP arrays. Product values retain their nested two-element array shape. Option uses null for None and new Some(value) for Some. Some(null) and Some(new Some(null)) preserve their declared nesting. Except uses Ok(value) or Err(error), retaining the active branch. Aliases retain their target PHP values without additional wrappers. Generated PHPDoc describes nested types. Parameters use mixed with strict generated checks, so weak and strict callers reject the same invalid values. Functions and constructors require exactly their declared arguments.

Unit is null. Fixed-width integers use checked PHP int, except UInt64 and USize, which use Brick\\Math\\BigInteger. Nat and Int also use BigInteger, with a 16384-decimal-digit limit. ISize is a signed 64-bit PHP int. Char is one UTF-8 Unicode scalar. String preserves UTF-8 and NUL. Bytes::fromString preserves arbitrary bytes. Floats require PHP float; Float32 rounds to binary32. Value equality and hashes preserve NaN equality and distinguish signed zero.

Recursive copied values may share acyclic subvalues; returned values own independent copies. Cycles, uninitialized instances, unknown subclasses and malformed branches reject. Each call permits at most 128 value levels and 262144 visits, with separate 16 MiB accounted PHP storage and native-copy budgets. These limits do not measure all PHP allocation overhead or Lean working memory. Readonly properties do not recursively freeze arbitrary Some, Ok or Err payloads. Do not mutate input values during a call.

All arguments validate before FFI schema creation. Combined copy budgets are checked before allocating input scratch, and input copying completes before native libraries load. Native output owners are released in finally. Allocation and limit failures are recoverable. Malformed native output retires the shared runtime; already copied PHP values remain usable. Structured callbacks, closures, resource-containing aggregates and asynchronous values are not admitted by this copied graph profile.
`;
	const exports = ["Bytes", "LeanBridgeError", "Some", "Ok", "Err"
		, ...model.types.filter(node => node.kind === "variant").map(node => node.publicType)
		, ...model.records.map(record => record.name)
		, ...model.functions.map(fn => fn.publicName)].map(name => `${model.namespace}\\${name}`);
	files["binding-manifest.json"] = canonicalJson({ schemaVersion: 1
		, generator: { id: "lean-wasm/php-copied-graph", version: 1 }
		, component: ir.component.id, bindingIrSha256: hashBindingIr(ir)
		, namespace: model.namespace
		, copiedGraph: { schemaVersion: 1, layoutSha256: model.layoutSha256 }
		, nativeEvidence: evidence, aliases: model.aliases, exports
		, publicFiles: model.publicFiles
		, internalFiles: Object.keys(files).filter(path => path.startsWith("src/Internal/"))
		, files: [...Object.keys(files), "binding-manifest.json"]
		, filesSha256: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)])) });
	return Object.freeze(files);
};
