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
const exceptions=m=>[m.failure,m.terminalFailure].filter(Boolean);
const cursorNative=(m,i,model,port,decode)=>{
	const ns="\\"+model.namespace+"\\", fn=port.symbols[i+1];
	const fail=(cls,code,decl,type)=>cls ? `if ($status===${code}) throw new ${ns}${cls}(${q(decl)},${decode}(${expr(type)},$tags,$data));` : "";
	const bad=`throw new ${ns}LeanBridgeError('Unexpected Lean iterator status '.$status);`;
	return `    public static function call${i}(${m.parameters.map(p=>"mixed $"+p.name).join(", ")}): ${ns}Cursor {
        $ffi=self::ffi(); $h=$ffi->new('uint64_t[2]');
        $take=static function() use ($h) {
            [$status,$tags,$data]=self::invoke(${q(fn+"_next")},[],[],${m.tagBytes},$h,true);
            if ($status===2) return [];
            if ($status===0) return [${decode}(${expr(m.result)},$tags,$data)];
            ${fail(m.terminalFailure,m.stepIO ? 4 : 3,m.stepDeclaration,m.terminal)}
            ${bad}
        };
        $release=static function() use ($ffi,$h) {
            if ($h[0]!==0) {
                $status=$ffi->${m.names.close}($h);
                if ($status!==0 && $status!==6) ${bad}
            }
        };
        $make=\\Closure::bind(static fn()=>new ${ns}Cursor($take,$release),null,${ns}Cursor::class);
        $cursor=$make();
        try {
            [$status,$tags,$data]=self::invoke(${q(fn)},${expr(m.args)},[${m.parameters.map(p=>"$"+p.name).join(",")}],${m.tagBytes},$h);
            if ($status===0) return $cursor;
            ${fail(m.failure,m.effect==="IO" ? 4 : 3,m.declaration,m.error)}
            ${bad}
        } catch (\\Throwable $e) { $cursor->close(); throw $e; }
    }`;
};
const taskPublic=(m,i)=>{
	const stream=m.delivery==="async-iterator", type=stream ? "PullStream" : "\\Amp\\Future";
	const args=m.parameters.map(p=>"$"+p.name), params=args.map(a=>"mixed "+a);
	let token="$cancellation";
	while(args.includes(token)) token+="_";
	return `/** ${m.parameters.map(p=>"@param "+p.type+" $"+p.name).join(" ")} @return ${type}<${m.returnType}> */
function ${m.publicName}(${[...params,"?\\Amp\\Cancellation "+token+"=null"].join(", ")}): ${type} {
    if (func_num_args()>${args.length+1}) throw new \\ArgumentCountError('Unexpected arguments');
    return Internal\\Native::call${i}([${args.join(", ")}],${token});
}`;
};
/**
 * Emit the language-level values, failures and functions independent of the ABI.
 *
 * @param methods - Compiler-reconciled public methods.
 * @param branches - Required PHP wrappers for returned sums.
 */
export const phpIOPublicDeclarations = (methods, branches) => `${copiedPhpValues}
${branches.map(c=>`final readonly class ${c} {
    public function __construct(public mixed $value) { if (func_num_args()!==1) throw new \\ArgumentCountError('Expected one payload'); }
${phpValueMethods}
}`).join("\n")}
abstract class DeclaredFailure extends \\RuntimeException {
    final public function __construct(public readonly string $declaration, public readonly mixed $payload) {
        parent::__construct(is_string($payload)?$payload:$declaration.': '.static::class);
    }
}
${[...new Set(methods.flatMap(exceptions))].map(f=>"final class "+f+" extends DeclaredFailure {}").join("\n")}
${methods.map((m,i)=>m.delivery && m.delivery!=="iterator" ? taskPublic(m,i) : `/** ${m.parameters.map(p=>"@param "+p.type+" $"+p.name).join(" ")} @return ${m.delivery==="iterator" ? "Cursor<"+m.returnType+">" : m.returnType} */
function ${m.publicName}(${m.parameters.map(p=>"mixed $"+p.name).join(", ")}): ${m.delivery==="iterator" ? "Cursor" : m.returnType} {
    if (func_num_args()!==${m.args.length}) throw new \\ArgumentCountError('Expected ${m.args.length} arguments');
    return Internal\\Native::call${i}(${m.parameters.map(p=>"$"+p.name).join(", ")});
}`).join("\n")}`;

const taskNative=(m,i,model,port,decode)=>{
	const {namespace: ns,wire}=model, fn=port.symbols[i+1], stream=m.delivery==="async-iterator";
	const ops={ poll: m.names.poll, close: m.names.close, watch: wire.wait.open, unwatch: wire.wait.close, ...stream ? {pull: m.names.pull} : {} };
	const callback=m.callbacks?.length>0;
	const queue=callback ? { callbacks: m.names.callbacks,next: m.names.next,arg: fn+"_arg",reply: fn+"_reply",fail: fn+"_fail",trap: m.names.trap,dispose: port.dispose } : {};
	const pairs=obj=>"["+Object.entries(obj).map(([k,v])=>q(k)+"=>"+q(v)).join(",")+"]";
	const bindings=callback ? "["+m.callbacks.map(([slot,a,b])=>"["+slot+","+q(a)+","+q(b)+"]").join(",")+"]" : "";
	const failure=(cls,code,decl,shape)=>cls ? `if ($status===${code}) throw new \\${ns}\\${cls}(${q(decl)},${decode}(${expr(shape)},$tags,$data));` : "";
	const bad=`throw new \\${ns}\\LeanBridgeError(${q("Lean bridge failure in "+m.declaration+" (status ")}.$status.')');`;
	const result=`${decode}(${expr(m.result)},$tags,$data)`;
	return `    public static function call${i}(array $args,?\\Amp\\Cancellation $cancel): mixed {
        $cancel?->throwIfRequested();
        $ffi=self::ffi(); $h=$ffi->new('uint64_t[2]');${callback ? `
        $pump=new CallbackPump($ffi,$h,${pairs(queue)},${bindings},$args,$cancel);` : ""}
        $take=static function() use ($h${callback ? ",$pump" : ""}) {
            [$status,$tags,$data]=self::invoke(${q(fn+"_take")},[],[],${m.tagBytes},$h,true);
            if ($status===0) return ${stream ? "["+result+"]" : result};
            ${stream ? "if ($status===2) return [];" : ""}
            ${failure(m.terminalFailure,stream ? 3 : 4,m.stepDeclaration??m.declaration,m.terminal)}${callback ? `
            if ($status===14) throw $pump->original(WireValues::output('uint32',$tags,$data));${m.once ? `
            if ($status===16) throw new \\${ns}\\CallbackAlreadyInvoked(${q(m.declaration)});` : ""}
            ${failure(m.failure,m.effect==="IO" ? 13 : 3,m.declaration,m.error)}` : ""}
            ${bad}
        };
        $owner=new Delivery($ffi,$h,[${Object.entries(ops).map(([k,v])=>q(k)+"=>"+q(v)).join(",")}${callback ? ",'releaseCallbacks'=>[$pump,'close']" : ""}],$take,$cancel);
        try {
            [$status,$tags,$data]=self::invoke(${q(fn)},${expr(m.args)},$args,${m.tagBytes},$h);
            ${failure(m.failure,m.effect==="IO" ? 4 : 3,m.declaration,m.error)}
            if ($status!==0) ${bad}
            $owner->subscribe();${callback ? `
            $pump->listen($owner);
            return $owner->read();` : `
            ${stream ? `$make=\\Closure::bind(static fn()=>new \\${ns}\\PullStream($owner),null,\\${ns}\\PullStream::class);
            return $make();` : "return $owner->read();"}`}
        } catch (\\Throwable $error) { ${callback ? "$pump->close(); " : ""}$owner->close(); throw $error; }
    }`;
};

/**
 * Generate the public API with exact byte-verified native loading. Only the
 * private PHP class knows the fixed symbol of each declared Lean function.
 *
 * @param model - Compiler-reconciled PHP IO surface.
 * @param assets - Actual native ELF hashes, runtime and component identities.
 */
export const generatePhpIOFiles=async(model,assets)=>{
	const {methods,namespace: ns,prefix}=model,port=generatePhpIOPort(model);
	const leased = model.leases?.size > 0, ledger = assets?.ledger;
	if(leased ? !hex(ledger?.id) || ledger.library !== "liblb_task_resources_"+ledger.id+".so" || !hex(ledger.sha256) || assets.libraries?.[ledger.library] !== ledger.sha256 : ledger)
		throw new TypeError("Unverified native PHP lease library");
	const deps = ["libleanshared.so","liblean_bridge_native.so",...leased ? [ledger.library] : []];
	if(!assets||!hex(assets.componentIdentity)||!hex(assets.runtimeIdentity)||!assets.componentId
		||assets.library!=="lib"+prefix+".so"||Object.keys(assets.libraries).sort().join("/")!==[assets.library,...deps].sort().join("/")
		||!Object.values(assets.libraries).every(hex)) throw new TypeError("Unverified native PHP synchronous IO libraries");
	const tasks=Boolean(model.wire.wait);
	const direct=methods.some(m=>m.delivery==="iterator");
	const retained=methods.some(m=>m.callbacks?.length);
	const branches=methods.some(m=>Array.isArray(m.result)||Array.isArray(m.error)||Array.isArray(m.terminal))?["Ok","Err"]:[];
	const extra = {};
	if(direct) extra["src/Internal/Cursor.php"]=(await readFile(new URL("./io-iterator.php",import.meta.url),"utf8")).replaceAll("__LB_PUBLIC__",ns);
	if(retained) extra["src/Internal/Callbacks.php"]=(await readFile(new URL("./io-callbacks.php",import.meta.url),"utf8")).replaceAll("__LB_PUBLIC__",ns);
	if(tasks) extra["src/Internal/Delivery.php"]=(await readFile(new URL("./io-delivery.php",import.meta.url),"utf8")).replaceAll("__LB_PUBLIC__",ns)
		.replace("/*__LB_RELEASE_CALLBACKS__*/",retained ? "\n                if (isset($this->ops['releaseCallbacks'])) ($this->ops['releaseCallbacks'])();" : "");
	if(leased)
	{
		const types = [...model.leases.values()];
		const canonical = r => "LeanBridge\\HeapV1\\H"+r.hash;
		const base = await readFile(new URL("./io-lease.php",import.meta.url),"utf8");
		extra["src/Internal/Leases.php"] = base + types.map(r =>
			`\nif (!class_exists(H${r.hash}::class,false)) { final class H${r.hash} extends Lease {} }\nclass_alias(H${r.hash}::class,${q(ns+"\\"+r.publicName)});\n`).join("");
		const specs = types.map(r => q(r.type)+"=>["+q(canonical(r))+","+r.tag+","+q(r.symbol+"_same")+","+q(r.symbol+"_retain")+"]");
		extra["src/Internal/LeaseCodec.php"] = (await readFile(new URL("./io-lease-codec.php",import.meta.url),"utf8"))
			.replaceAll("__LB_PUBLIC__",ns).replaceAll("__LB_LEDGER__",ledger.id)
			.replaceAll("__LB_DISPOSE__",port.dispose).replaceAll("__LB_LEASES__","["+specs.join(",")+"]");
	}
	const decode = leased ? "self::decoded" : "WireValues::output";
	const publicSource=`<?php
declare(strict_types=1);
namespace ${ns};
require_once __DIR__ . '/Internal/Loader.php';${leased ? "\nrequire_once __DIR__ . '/Internal/Leases.php';\nrequire_once __DIR__ . '/Internal/LeaseCodec.php';" : ""}
require_once __DIR__ . '/Internal/Native.php';
require_once __DIR__ . '/Internal/WireValues.php';${direct ? "\nrequire_once __DIR__ . '/Internal/Cursor.php';" : ""}${tasks ? "\nrequire_once __DIR__ . '/Internal/Delivery.php';" : ""}${retained ? "\nrequire_once __DIR__ . '/Internal/Callbacks.php';" : ""}
${phpIOPublicDeclarations(methods,branches)}${methods.some(m=>m.once) ? `
final class CallbackAlreadyInvoked extends \\RuntimeException {
    public function __construct(public readonly string $declaration) { parent::__construct('callback-already-invoked'); }
}` : ""}
`;
	const native=`<?php
declare(strict_types=1);
namespace ${ns}\\Internal;
${copiedPhpHelpers}
${phpValueSemantics({namespace: ns,branches,surface: {copies: []}})}
final class Native {${leased ? "\n    use LeaseCodec;" : ""}
    private const DEFINITIONS = <<<'TYPES'
${port.definitions.trimEnd()}
TYPES;
    private static ?\\FFI $ffi=null;
    private static function load(): \\FFI { ${copiedPhpAssets(assets)} }
    private static function ffi(): \\FFI {
        \\LeanBridge\\CopiedNativeV1\\Runtime::ensureProcess();
        return self::$ffi??=self::load();
    }
    private static function invoke(string $fn,array $types,array $args,int $depth${tasks || direct ? ",?\\FFI\\CData $handle=null,bool $taking=false" : ""}): array {
        $budget=new Budget(); $bytes=[];
        foreach ($types as $i=>$kind) $bytes[]=${retained ? "$kind==='callback' ? '' : " : ""}${leased ? "self::encoded" : "WireValues::input"}($kind,$args[$i],$budget);
        $ffi=self::ffi(); $scope=new Scope($ffi);
        $in=$ffi->new('lbphp_buffer['.max(1,count($bytes)).']');
        $out=$ffi->new('lbphp_buffer'); $tags=$ffi->new('uint8_t['.$depth.']');${leased ? " $kept=false;" : ""}
        try {
            foreach ($bytes as $i=>$data) {
                $in[$i]->data=$scope->buffer($data);
                $in[$i]->length=strlen($data);
            }
            $status=${tasks || direct ? `$taking ? $ffi->$fn($handle,\\FFI::addr($out),\\FFI::addr($tags[0]),$depth)
                : ($handle!==null ? $ffi->$fn(\\FFI::addr($in[0]),count($bytes),\\FFI::addr($out),\\FFI::addr($tags[0]),$depth,$handle)
                : $ffi->$fn(\\FFI::addr($in[0]),count($bytes),\\FFI::addr($out),\\FFI::addr($tags[0]),$depth))` : `$ffi->$fn(\\FFI::addr($in[0]),count($bytes),\\FFI::addr($out),\\FFI::addr($tags[0]),$depth)`};
            $length=$out->length;${leased ? `
            if ($out->lease[3]) {
                $owner=self::adopted($ffi,$out);
                $kept=true;
                return [$status,\\FFI::string(\\FFI::addr($tags[0]),$depth),$owner];
            }` : ""}
            if ($length<0 || $length>16777216 || ($length && ($out->data===null || \\FFI::isNull($out->data)))) throw new \\UnexpectedValueException('Malformed native IO output');
            return [$status,\\FFI::string(\\FFI::addr($tags[0]),$depth),$length?\\FFI::string($out->data,$length):''];
        } finally {
            ${leased ? "if (!$kept) " : ""}$ffi->${port.dispose}(\\FFI::addr($out));
            $scope->close();
        }
    }
${methods.map((m,i)=>m.delivery==="iterator" ? cursorNative(m,i,model,port,decode) : m.delivery ? taskNative(m,i,model,port,decode) : `    public static function call${i}(${m.parameters.map(p=>"mixed $"+p.name).join(", ")}): mixed {
        [$status,$tags,$data]=self::invoke(${q(port.symbols[i+1])},${expr(m.args)},[${m.parameters.map(p=>"$"+p.name).join(",")}],${m.tagBytes});
        if ($status===0) return ${decode}(${expr(m.result)},$tags,$data);
        ${m.failure?`if ($status===${m.effect==="IO"?4:3}) throw new \\${ns}\\${m.failure}(${q(m.declaration)},${decode}(${expr(m.error)},$tags,$data));`:""}
        throw new \\${ns}\\LeanBridgeError(${q("Lean bridge failure in "+m.declaration+" (status ")}.$status.')');
    }`).join("\n")}
}
`;
	const codec=(await readFile(new URL("./io-codec.php",import.meta.url),"utf8")).replaceAll("__LB_PUBLIC__",ns);
	return {"src/Api.php": publicSource,"src/Internal/Loader.php": copiedPhpLoader,"src/Internal/Native.php": native,"src/Internal/WireValues.php": codec,...extra};
};
