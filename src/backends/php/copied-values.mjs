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

/**
 * Render the public value API shared by the FFI and Zend transports.
 *
 * @param model - Admitted copied PHP projection.
 */
export const copiedPhpPublicSource = model => `<?php
declare(strict_types=1);
namespace ${model.namespace};

${copiedPhpValues}
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
${fn.parameters.map((parameter, i) => ` * @param ${model.surface.copy(fn.declaration.parameters[i].type).docType} $${parameter.name}`).join("\n")}
 * @return ${model.surface.copy(fn.declaration.result.type).docType}
 */
function ${fn.field}(${fn.parameters.map(parameter => `mixed $${parameter.name}`).join(", ")}): ${model.surface.copy(fn.declaration.result.type).publicType} {
    return Internal\\Native::call${index}(${fn.parameters.map(parameter => `$${parameter.name}`).join(", ")});
}`).join("\n\n")}
`;

const nativeSource = (model, evidence) => `<?php
declare(strict_types=1);
namespace ${model.namespace}\\Internal;

require_once __DIR__ . '/Runtime.php';

${copiedPhpHelpers}
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

${model.surface.functions.map((fn, index) => {
	const result = model.surface.copy(fn.declaration.result.type), unit = fn.resultType === "void";
	return `    public static function call${index}(${fn.parameters.map((_, i) => `mixed $arg${i}`).join(", ")}): mixed {
        \\LeanBridge\\CopiedNativeV1\\Runtime::ensureProcess();
        $ffi = self::$ffi ??= self::load();
        $scope = new Scope($ffi);
        $validation = new Budget();
        ${unit ? "" : `$out = $ffi->new('${result.ctype}');`}
        $error = $ffi->new('BridgeError');
        try {
${fn.declaration.parameters.map((site, i) => { const copy = model.surface.copy(site.type); return `            $input${i} = self::to${copy.index}(Checks::check${copy.index}($arg${i}, $validation), $scope);`; }).join("\n")}
            $status = $ffi->${fn.name}(${fn.declaration.parameters.map((site, i) => model.surface.copy(site.type).aggregate ? `\\FFI::addr($input${i})` : `$input${i}->cdata`).concat(unit ? [] : ["\\FFI::addr($out)"]).concat("\\FFI::addr($error)").join(", ")});
            if ($status !== 0) {
                $message = $error->message === null || \\FFI::isNull($error->message) ? 'Native Lean call failed' : \\FFI::string($error->message, min($error->message_length, 16384));
                throw new \\${model.namespace}\\LeanBridgeError($message, $status);
            }
            return ${unit ? "null" : `self::from${result.index}($out${result.aggregate ? "" : "->cdata"}, $scope)`};
        } finally {
            try { ${result.aggregate ? `$ffi->${result.name}_clear(\\FFI::addr($out));` : "/* No native output owner. */"} }
            finally { $scope->close(); }
        }
    }`;
}).join("\n\n")}
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
		, "README.md": `# ${model.namespace}\n\nInstall the prepared Composer archive and require vendor/autoload.php. Call the generated ${model.namespace} functions. The package includes the compiled Lean libraries and loads its runtime automatically. Consumers do not compile Lean or configure a package-specific Zend extension.\n\nRequires PHP 8.2+ (below 9), NTS CLI, Linux x86-64, the packaged glibc floor, and FFI enabled. This copied-value profile does not cover FPM, Apache, cli-server, ZTS or PHP-Wasm. Compatible packages share one process runtime; post-fork calls and an already loaded foreign Lean runtime are rejected. No per-package or shared runtime files are written during use.\n\nUnit is null. Fixed-width integers use range-checked PHP int except UInt64, which uses BigInteger. Nat and Int also use Brick\\Math\\BigInteger::of with decimal text. Composer installs brick/math 1.0.0 automatically. Lean Bridge accepts integer objects up to 16384 decimal digits. String requires UTF-8, including NUL. ByteArray uses Bytes::fromString. Floats require PHP float; Float32 rounds to binary32 and preserves NaN classification, infinities and signed zero. Arrays are consecutive-key lists; records are final readonly value classes.\n\nInput parameters deliberately use mixed with precise PHPDoc: generated checks reject coercion even if the caller omits strict_types. Records and lists have independent copied results. Only pure, acyclic types up to 32 levels deep are admitted. Validation, FFI scratch/output conversion, and native input/output copies each have a 16 MiB limit; PHP lists account for at least 32 bytes per element. These budgets do not bound the Lean algorithm's working memory. Native output owners are released in finally.\n\n${model.surface.functions.map(fn => `- ${model.namespace}\\${fn.field}: ${fn.declaration.id}`).join("\n")}\n` };
	files["binding-manifest.json"] = canonicalJson({ schemaVersion: 1, generator: { id: "lean-wasm/php-copied", version: 1 }, component: model.ir.component.id, bindingIrSha256: hashBindingIr(model.ir), namespace: model.namespace, publicFiles: ["src/Api.php"], exports: ["Bytes", "LeanBridgeError", ...model.surface.copies.filter(copy => copy.record).map(copy => copy.publicName), ...model.surface.functions.map(fn => fn.field)].map(name => `${model.namespace}\\${name}`), files: [...Object.keys(files), "binding-manifest.json"], filesSha256: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)])) });
	return Object.freeze(files);
};

/**
 * Generate a closed ordinary PHP API from authoritative semantics.
 *
 * @param ir - Compiler-derived Binding IR.
 * @param evidence - Optional compiled native library inventory.
 */
export const generateCopiedPhpPackage = (ir, evidence = null) => renderCopiedPhpPackage(compileCopiedPhpModel(ir), evidence);
