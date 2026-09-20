/**
 * Render ordinary PHP functions, immutable records, and private native calls.
 *
 * @file
 */
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { compileCopiedPhpModel } from "./copied-model.mjs";
import { copiedPhpAssets, copiedPhpLoader } from "./copied-assets.mjs";
import { copiedPhpValues, copiedPhpHelpers } from "./copied-support.mjs";
import { copiedPhpChecks, copiedPhpConversions, copiedPhpDefinitions } from "./copied-conversions.mjs";
import { phpValue, phpClosurePublic, phpCallableState, phpCallableRuntime, phpNativeCall } from "./callables.mjs";

/**
 * Render the public value API shared by the FFI and Zend transports.
 *
 * @param model - Admitted copied PHP projection.
 */
export const copiedPhpPublicSource = model => `<?php
declare(strict_types=1);
namespace ${model.namespace};

${copiedPhpValues}
${model.branches.map(name => `/** @template T */
final readonly class ${name}
{
    /** @var T */
    public mixed $value;
    /** @param T $value */
    public function __construct(mixed $value) {
        if (func_num_args() !== 1) throw new \\ArgumentCountError('${name} requires one payload');
        $this->value = $value;
    }
}`).join("\n\n")}
${model.surface.callbacks.size ? phpClosurePublic : ""}
${model.surface.copies.filter(copy => copy.record).map(copy => `final readonly class ${copy.publicName}
{
${copy.fields.map(field => `    /** @var ${field.type.docType} */\n    public ${field.type.publicType} $${field.name};`).join("\n")}
    public function __construct(${copy.fields.map(field => `mixed $${field.name}`).join(", ")}) {
        $__lbBudget = new Internal\\Budget();
${copy.fields.map(field => `        $this->${field.name} = Internal\\Checks::check${field.type.index}($${field.name}, $__lbBudget);`).join("\n")}
    }
}`).join("\n\n")}

require_once __DIR__ . '/Internal/Native.php';

${model.surface.functions.map((fn, index) => `/**
${fn.parameters.map((parameter, i) => ` * @param ${phpValue(model, fn.declaration.parameters[i].type).docType} $${parameter.name}`).join("\n")}
 * @return ${phpValue(model, fn.declaration.result.type).type?.callable ? "LeanClosure" : phpValue(model, fn.declaration.result.type).docType}
 */
function ${fn.field}(${fn.parameters.map(parameter => `mixed $${parameter.name}`).join(", ")}): ${phpValue(model, fn.declaration.result.type).type?.callable ? "LeanClosure" : phpValue(model, fn.declaration.result.type).publicType} {
    return Internal\\Native::call${index}(${fn.parameters.map(parameter => `$${parameter.name}`).join(", ")});
}`).join("\n\n")}
`;

const nativeSource = (model, evidence) => `<?php
declare(strict_types=1);
namespace ${model.namespace}\\Internal;

require_once __DIR__ . '/Runtime.php';

${copiedPhpHelpers}
${model.surface.callbacks.size ? phpCallableState : ""}
final class Checks
{
${copiedPhpChecks(model)}
}

final class Native
{
    private const DEFINITIONS = <<<'CDEFS'
${copiedPhpDefinitions(model)}
CDEFS;
    private static ?\\FFI $ffi = null;
    private static function load(): \\FFI {
        ${copiedPhpAssets(evidence)}
    }
${copiedPhpConversions(model)}

${phpCallableRuntime(model)}
${model.surface.functions.map((fn, index) => phpNativeCall(model, { name: `call${index}`, symbol: fn.name, parameters: fn.declaration.parameters, result: fn.declaration.result })).join("\n\n")}
}
`;

/**
 * Render the complete source projection; native package assembly adds libraries.
 *
 * @param model - Admitted PHP copied projection.
 * @param evidence - Optional verified compiled library identities.
 */
export const renderCopiedPhpPackage = (model, evidence = null) => {
	const files = { "src/Api.php": copiedPhpPublicSource(model)
		, "src/Internal/Native.php": nativeSource(model, evidence)
		, "src/Internal/Runtime.php": copiedPhpLoader
		, "README.md": `# ${model.namespace}\n\nInstall the prepared Composer archive and require vendor/autoload.php. Call the generated ${model.namespace} functions. The package includes the compiled Lean libraries and loads its runtime automatically. Consumers do not compile Lean or configure a package-specific Zend extension.\n\nRequires PHP 8.2+ (below 9), NTS CLI, Linux x86-64, the packaged glibc floor, and FFI enabled. This copied-value profile does not cover FPM, Apache, cli-server, ZTS or PHP-Wasm. Compatible packages share one process runtime; post-fork calls and an already loaded foreign Lean runtime are rejected. No per-package or shared runtime files are written during use.\n\nUnit is null. Fixed-width integers use range-checked PHP int except UInt64, which uses BigInteger. Nat and Int also use Brick\\Math\\BigInteger::of with decimal text. Composer installs brick/math 1.0.0 automatically. Lean Bridge accepts integer objects up to 16384 decimal digits. String requires UTF-8, including NUL. ByteArray uses Bytes::fromString. Floats require PHP float; Float32 rounds to binary32 and preserves NaN classification, infinities and signed zero. Arrays are consecutive-key lists; records are final readonly value classes.\n\nInput parameters deliberately use mixed with precise PHPDoc: generated checks reject coercion even if the caller omits strict_types. Records and lists have independent copied results. Copied types must be pure and acyclic, at most 32 levels deep. Validation, FFI scratch/output conversion, and native input/output copies each have a 16 MiB limit; PHP lists account for at least 32 bytes per element. These budgets do not bound the Lean algorithm's working memory. Native output owners are released in finally.\n\n${model.surface.functions.map(fn => `- ${model.namespace}\\${fn.field}: ${fn.declaration.id}`).join("\n")}\n` };
	if(model.surface.copies.some(copy => copy.compound))
	{
		files["README.md"] += "\n## Options, results and products\n\nOption uses null for None or new Some($value) for Some. Unit is null, so new Some(null) preserves a present Unit or an outer Some containing None, according to the declared type. Except uses new Ok($value) or new Err($error); both expose a readonly value property. Branch classes are final readonly classes in this component's namespace and require one payload. PHPDoc records the payload type; every call checks it recursively, including weak-mode callers. Domain errors return Err; bridge failures throw. Prod uses an exact two-element list, retaining nested binary products. These types compose with arrays and records. Returned values are independently copied. PHP === compares wrapper identity, while == follows PHP's property-comparison rules. Readonly wrappers do not make arbitrary constructor payloads deeply immutable; only values accepted by the declared copied type may cross a call. Compound callbacks, identity-bearing copied values, lists and recursive copied schemas remain unsupported.\n";
	}
	if(model.surface.callbacks.size)
	{
		files["README.md"] += "\n## Primitive callbacks and returned functions\n\nPass a PHP callable directly. Generated PHPDoc records its primitive signature. The adapter validates values in both weak and strict callers, contains Throwable failures until native cleanup, then rethrows the same object. Reference parameters, reference returns and generators reject. Callbacks borrow one synchronous call and cannot be retained by Lean. One FFI trampoline per signature is cached until request shutdown; completed calls release their callback targets and buffers.\n\nReturned LeanClosure objects are invokable with exactly the declared positional arguments. Call close in finally; close is idempotent and defers native release while active. isClosed reports explicit closure. Destruction is a fallback. Saved callable aliases retain the same lease. Cloning, serialization and direct construction reject. Callable operations require the main NTS CLI execution context, not a Fiber. Use a fresh process after fork. No async or compound callables are admitted. Each native adapter allows 64 nested invocations per thread and the shared runtime allows 4096 closure identities.\n";
	}
	files["binding-manifest.json"] = canonicalJson({ schemaVersion: 1, generator: { id: "lean-wasm/php-copied", version: 1 }, component: model.ir.component.id, bindingIrSha256: hashBindingIr(model.ir), namespace: model.namespace, publicFiles: ["src/Api.php"], exports: ["Bytes", "LeanBridgeError", ...model.branches, ...model.surface.callbacks.size ? ["LeanClosure"] : [], ...model.surface.copies.filter(copy => copy.record).map(copy => copy.publicName), ...model.surface.functions.map(fn => fn.field)].map(name => `${model.namespace}\\${name}`), files: [...Object.keys(files), "binding-manifest.json"], filesSha256: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)])) });
	return Object.freeze(files);
};

/**
 * Generate a closed ordinary PHP API from authoritative semantics.
 *
 * @param ir - Compiler-derived Binding IR.
 * @param evidence - Optional compiled native library inventory.
 */
export const generateCopiedPhpPackage = (ir, evidence = null) => renderCopiedPhpPackage(compileCopiedPhpModel(ir), evidence);
