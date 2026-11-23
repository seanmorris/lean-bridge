/**
 * Render ordinary PHP functions for a source-checked native IO component.
 * This Composer transport is for 64-bit NTS PHP CLI; it is not PHP-Wasm.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { copiedPhpAssets, copiedPhpLoader } from "./copied-assets.mjs";
import { phpValueMethods, phpValueSemantics } from "./copied-equality.mjs";
import { copiedPhpValues, copiedPhpHelpers } from "./copied-support.mjs";
import { generatePhpIOPort } from "./io-port.mjs";

const q=s=>"'"+s.replaceAll("\\","\\\\").replaceAll("'","\\'")+"'";
const expr=t=>Array.isArray(t)?"["+t.map(expr).join(",")+"]":q(t);
const hex=s=>typeof s==="string"&&/^[0-9a-f]{64}$/u.test(s);

/**
 * Generate the public API with exact byte-verified native loading. Only the
 * private PHP class knows the fixed symbol of each declared Lean function.
 *
 * @param model - Compiler-reconciled PHP IO surface.
 * @param assets - Actual native ELF hashes, runtime and component identities.
 */
export const generatePhpIOFiles=async(model,assets)=>{
	const {methods,namespace: ns,prefix}=model,port=generatePhpIOPort(model);
	if(!assets||!hex(assets.componentIdentity)||!hex(assets.runtimeIdentity)||!assets.componentId
		||assets.library!=="lib"+prefix+".so"||Object.keys(assets.libraries).sort().join("/")!==[assets.library,"libleanshared.so","liblean_bridge_native.so"].sort().join("/")
		||!Object.values(assets.libraries).every(hex)) throw new TypeError("Unverified native PHP synchronous IO libraries");
	const branches=methods.some(m=>Array.isArray(m.result)||Array.isArray(m.error))?["Ok","Err"]:[];
	const publicSource=`<?php
declare(strict_types=1);
namespace ${ns};
require_once __DIR__ . '/Internal/Loader.php';
require_once __DIR__ . '/Internal/Native.php';
require_once __DIR__ . '/Internal/WireValues.php';
${copiedPhpValues}
${branches.map(c=>`final readonly class ${c} {
    public function __construct(public mixed $value) { if (func_num_args()!==1) throw new \\ArgumentCountError('Expected one payload'); }
${phpValueMethods}
}`).join("\n")}
abstract class DeclaredFailure extends \\RuntimeException {
    final public function __construct(public readonly string $declaration, public readonly mixed $payload) {
        parent::__construct(is_string($payload)?$payload:$declaration.': '.static::class);
    }
}
${[...new Set(methods.map(m=>m.failure).filter(Boolean))].map(f=>"final class "+f+" extends DeclaredFailure {}").join("\n")}
${methods.map((m,i)=>`/** ${m.parameters.map(p=>"@param "+p.type+" $"+p.name).join(" ")} @return ${m.returnType} */
function ${m.publicName}(${m.parameters.map(p=>"mixed $"+p.name).join(", ")}): ${m.returnType} {
    if (func_num_args()!==${m.args.length}) throw new \\ArgumentCountError('Expected ${m.args.length} arguments');
    return Internal\\Native::call${i}(${m.parameters.map(p=>"$"+p.name).join(", ")});
}`).join("\n")}
`;
	const native=`<?php
declare(strict_types=1);
namespace ${ns}\\Internal;
${copiedPhpHelpers}
${phpValueSemantics({namespace: ns,branches,surface: {copies: []}})}
final class Native {
    private const DEFINITIONS = <<<'TYPES'
${port.definitions.trimEnd()}
TYPES;
    private static ?\\FFI $ffi=null;
    private static function load(): \\FFI { ${copiedPhpAssets(assets)} }
    private static function ffi(): \\FFI {
        \\LeanBridge\\CopiedNativeV1\\Runtime::ensureProcess();
        return self::$ffi??=self::load();
    }
    private static function invoke(string $fn,array $types,array $args,int $depth): array {
        $budget=new Budget(); $bytes=[];
        foreach ($types as $i=>$kind) $bytes[]=WireValues::input($kind,$args[$i],$budget);
        $ffi=self::ffi(); $scope=new Scope($ffi);
        $in=$ffi->new('lbphp_buffer['.max(1,count($bytes)).']');
        $out=$ffi->new('lbphp_buffer'); $tags=$ffi->new('uint8_t['.$depth.']');
        try {
            foreach ($bytes as $i=>$data) {
                $in[$i]->data=$scope->buffer($data);
                $in[$i]->length=strlen($data);
            }
            $status=$ffi->$fn(\\FFI::addr($in[0]),count($bytes),\\FFI::addr($out),\\FFI::addr($tags[0]),$depth);
            $length=$out->length;
            if ($length<0 || $length>16777216 || ($length && ($out->data===null || \\FFI::isNull($out->data)))) throw new \\UnexpectedValueException('Malformed native IO output');
            return [$status,\\FFI::string(\\FFI::addr($tags[0]),$depth),$length?\\FFI::string($out->data,$length):''];
        } finally {
            $ffi->${port.dispose}(\\FFI::addr($out));
            $scope->close();
        }
    }
${methods.map((m,i)=>`    public static function call${i}(${m.parameters.map(p=>"mixed $"+p.name).join(", ")}): mixed {
        [$status,$tags,$data]=self::invoke(${q(port.symbols[i+1])},${expr(m.args)},[${m.parameters.map(p=>"$"+p.name).join(",")}],${m.tagBytes});
        if ($status===0) return WireValues::output(${expr(m.result)},$tags,$data);
        ${m.failure?`if ($status===${m.effect==="IO"?4:3}) throw new \\${ns}\\${m.failure}(${q(m.declaration)},WireValues::output(${expr(m.error)},$tags,$data));`:""}
        throw new \\${ns}\\LeanBridgeError(${q("Lean bridge failure in "+m.declaration+" (status ")}.$status.')');
    }`).join("\n")}
}
`;
	const codec=(await readFile(new URL("./io-codec.php",import.meta.url),"utf8")).replaceAll("__LB_PUBLIC__",ns);
	return {"src/Api.php": publicSource,"src/Internal/Loader.php": copiedPhpLoader,"src/Internal/Native.php": native,"src/Internal/WireValues.php": codec};
};
