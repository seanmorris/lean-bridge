/** @file Emit the public binding and its private FFI declarations for a checked native PHP program. */
import { readFile } from "node:fs/promises";
import { canonicalJson } from "../../capsule/node.mjs";
import { reconcileHostExports } from "../../analyze/host-export-model.mjs";
import { copiedPhpAssets, copiedPhpLoader } from "./copied-assets.mjs";
import { copiedPhpHelpers } from "./copied-support.mjs";
import { phpValueSemantics } from "./copied-equality.mjs";
import { phpClassName, phpFieldName } from "./copied-names.mjs";
import { phpIOPublicDeclarations } from "./io-package.mjs";
import { phpHostMembers } from "./host-members.mjs";
import { phpHostTaskApi } from "./host-task-api.mjs";
import { phpReturnedMethod } from "./host-returned.mjs";

const fail = why => { throw new TypeError("Invalid PHP native host surface: " + why); };
const pascal = s => s.split(/[-_]/u).map(p => p[0].toUpperCase() + p.slice(1)).join("");
const literal = v => Array.isArray(v) ? "[" + v.map(literal).join(",") + "]" : JSON.stringify(v);
const hex = s => /^[a-f0-9]{64}$/u.test(s);
const types = { string: "string", char: "string", bytes: "Bytes"
	, unit: "null", bool: "bool"
	, uint64: "\\Brick\\Math\\BigInteger"
	, usize: "\\Brick\\Math\\BigInteger"
	, int: "\\Brick\\Math\\BigInteger"
	, nat: "\\Brick\\Math\\BigInteger"
	, float32: "float"
	, float64: "float"
	, isize: "int"
	, uint8: "int"
	, uint16: "int"
	, uint32: "int"
	, int8: "int"
	, int16: "int"
	, int32: "int"
	, int64: "int" };
const hint = t => Array.isArray(t) ? "Ok|Err" : Number.isInteger(t) ? "object" : types[t];

/**
 * Generate the binding, lazy loader, typed public errors and private owner frame.
 *
 * @param linked - Fresh compiler evidence and native libraries from compilePhpHostComponent.
 * @param ir - Captured host import contract (not the exported API).
 * @param runtime - Verified shared runtime manifest.
 */
export const generatePhpHostFiles = async (linked, ir, runtime) => {
	const { prefix, identity, runtimeIdentity, component, domain, api, evidence } = linked;
	if(!hex(identity) || !hex(runtimeIdentity) || prefix !== "lb_php_host_" + identity || component !== "lib" + prefix + ".so"
		|| domain !== "liblb_php_host_domain_" + runtimeIdentity + ".so" || ![component,domain].every(n => hex(linked.binaries[n]))) fail("native library identity");
	const model = phpHostMembers(ir);
	const checked = reconcileHostExports({ ir, selection: evidence.selection, metadata: evidence.metadata, component: api.component });
	if(canonicalJson(checked.api)!==canonicalJson(api) || canonicalJson(checked.entries)!==canonicalJson(linked.entries)
		|| canonicalJson(model.members)!==canonicalJson(linked.members)) fail("export or member table differs from compiler");
	if(!/^[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*$/u.test(api.component.name)) fail("invalid namespace");
	const ns = "Lean" + pascal(api.component.name), site = t => {
		if(t.kind === "primitive" && Object.hasOwn(types,t.name)) return t.name;
		if(t.kind === "named")
		{ const index = ir.types.findIndex(v => v.id === t.id); if(index >= 0) return index; }
		if(t.kind === "apply" && t.constructor === "result" && t.arguments.length === 2) return t.arguments.map(site);
		return fail("unsupported export type");
	};
	const names = new Set(["close"]), errorNames = new Set(["ioerror","declaredfailure","bytes","err","ok","binding","leanbridgeerror"]);
	const async=Boolean(linked.task), worker=async && await phpHostTaskApi({linked,checked,ir,model,ns});
	const methods=[],errors=[]; let syncIndex=0;
	const returned=checked.entries.some(e=>e.result.kind==="io-closure"),bounded=async || returned;
	const n=checked.entries.filter(e=>!e.delivery).length;
	if(async) for(const n of ["taskioerror","retainedcallback","callbackclosed","pullstream"]) errorNames.add(n);
	for(const e of checked.entries)
	{
		const name=phpClassName(e.name);
		if(!/^[A-Za-z][A-Za-z0-9_]*$/u.test(name) || names.has(name.toLowerCase())) fail("colliding export "+name);
		names.add(name.toLowerCase());
		const params=e.parameters.map(p=>phpFieldName(p.name,fail)), args=params.map(p=>"$"+p);
		if(new Set(params).size!==params.length) fail("duplicate parameter");
		const error=e.effect==="EIO"?site(e.error):null;
		const ex=pascal(e.name)+"Error";
		if(error!==null)
		{
			if(errorNames.has(ex.toLowerCase())) fail("colliding exception "+ex);
			errorNames.add(ex.toLowerCase()); errors.push("final class "+ex+" extends DeclaredFailure {}");
		}
		if(e.delivery)
		{
			if(!worker) fail("missing PHP worker implementation");
			const stepEx=e.delivery==="task"?"TaskIOError":e.stepIO || e.stepError?pascal(e.name)+"StepError":null;
			if(stepEx && stepEx!=="TaskIOError")
			{
				if(errorNames.has(stepEx.toLowerCase())) fail("colliding step exception "+stepEx);
				errorNames.add(stepEx.toLowerCase()); errors.push("final class "+stepEx+" extends DeclaredFailure {}");
			}
			methods.push(worker.method({entry: e,name,args,ex: error===null?null:ex,stepEx})); continue;
		}
		const inputs=e.parameters.map(p=>site(p.type)), i=syncIndex++;
		if(e.result.kind==="io-closure")
		{
			const cls="Returned"+pascal(e.name),arg=site(e.result.argument),reply=site(e.result.reply);
			if(errorNames.has(cls.toLowerCase()) || e.effect!=="IO")fail("invalid returned PHP function "+name);
			errorNames.add(cls.toLowerCase());errors.push("interface "+cls+" { public function __invoke(mixed $value): "+hint(reply)+"; public function close(): void; }");
			methods.push(phpReturnedMethod({name,cls,args,i,n,inputs: literal(inputs),arg: literal(arg),reply: literal(reply),hint: hint(reply),declaration: JSON.stringify(e.declaration)}));
			continue;
		}
		const result=site(e.result);
		methods.push(`    /** ${params.map((p,j)=>"@param "+hint(inputs[j])+" $"+p).join(" ")} @return ${hint(result)} */
    public function ${name}(${args.map(a=>"mixed "+a).join(", ")}): ${hint(result)} {
        if (func_num_args()!==${args.length}) throw new \\ArgumentCountError('Wrong number of arguments');
        if (!$this->open${bounded?" || $this->closing":""}) throw new \\LogicException('PHP host binding is closed');
        return $this->_call(${i},[${args.join(",")}],${literal(inputs)},${literal(result)},${literal(error)},${JSON.stringify(e.declaration)},${error===null?"null":ex+"::class"});
    }`);
	}
	const libraries = {...linked.binaries};
	for(const n of ["libleanshared.so","liblean_bridge_native.so"])
	{
		const h=runtime.files["lib/"+n]?.sha256;if(!hex(h)) fail("missing runtime library"); libraries[n]=h;
	}
	const defs = "typedef int (*php_host_dispatch)(uint64_t,int32_t,const uint64_t*,size_t,uint64_t*,uint32_t*); typedef struct { php_host_dispatch fn; } php_host_gate; "
		+"int "+prefix+"_call(uint64_t,php_host_dispatch,int,const uint64_t*,size_t,uint64_t*,uint8_t*,uint32_t*); void "+prefix+"_clear(uint64_t*);"+(async?linked.task.port.definitions:"");
	const templates = {"References": "host-refs","HostMembers": "host-members","HostFrame": "host-frame","HostWords": "host-words","WireValues": "io-codec"};
	if(returned)templates.HostFunctionCell="host-functions";
	if(async) Object.assign(templates,{HostTaskObjects: "host-task-objects",HostTasks: "host-tasks",Callbacks: "io-callbacks",Delivery: "io-delivery"});
	const files = {"src/Internal/Loader.php": copiedPhpLoader};
	for(const [file,source] of Object.entries(templates))
		files["src/Internal/"+file+".php"]=(await readFile(new URL("./"+source+".php",import.meta.url),"utf8")).replaceAll("__LB_PUBLIC__",ns);
	if(async) files["src/Internal/Delivery.php"]=files["src/Internal/Delivery.php"].replace("/*__LB_RELEASE_CALLBACKS__*/","\n                if (isset($this->ops['releaseCallbacks'])) ($this->ops['releaseCallbacks'])();");
	files["src/Internal/Native.php"]=`<?php
declare(strict_types=1);
namespace ${ns}\\Internal;
${copiedPhpHelpers}
${phpValueSemantics({namespace: ns,branches: ["Ok","Err"],surface: {copies: []}})}
final class Native {
    public const PREFIX='${prefix}';
    private const DEFINITIONS='${defs}';
    public static function ffi(): \\FFI { ${copiedPhpAssets({componentId: api.component.id, componentIdentity: identity,runtimeIdentity,library: component,libraries})} }
${worker?worker.factory():""}    public static function members(array $classes): HostMembers { return new HostMembers(json_decode(<<<'MODEL'
${canonicalJson(model).trim()}
MODEL, true, 128, JSON_THROW_ON_ERROR),$classes); }
}
`;
	files["src/Api.php"]=`<?php
declare(strict_types=1);
namespace ${ns};
${Object.keys(files).map(k=>"require_once __DIR__ . '/"+k.slice(4)+"';").join("\n")}
${phpIOPublicDeclarations([],["Ok","Err"])}
final class IOError extends DeclaredFailure {}
${async?"final class TaskIOError extends DeclaredFailure {}\n":""}${errors.join("\n")}
function withHosts(array $classes): Binding { return new Binding($classes); }
${returned?"function drain_host_functions(): void { Internal\\FunctionReleases::drain(); }\n":""}final class Binding {
    private bool $open=false;
    private readonly Internal\\HostMembers $members;
    private readonly \\FFI $ffi;
    private readonly int $pid;${async?"\n    private readonly Internal\\HostTasks $tasks;":""}${bounded?"\n    private int $nativeDepth=0;\n    private bool $closing=false;":""}${returned?"\n    private ?int $functionBinder=null;":""}
    private function _call(int $op,array $args,array $params,string|int|array $result='unit',string|int|array|null $error=null,
                           string $name='',?string $exception=null${returned?",?\\Closure $commit=null":""}): mixed {
        \\LeanBridge\\NativeHostV2\\References::enter();
        $failed=false;
        try {
            ${bounded?"++$this->nativeDepth;\n            try { ":""}[$channel,$value]=Internal\\HostFrame::call($this->ffi,Internal\\Native::PREFIX,$this->members,$op,$args,$params,$result,$error);${bounded?" } finally { --$this->nativeDepth; }":""}
            if ($channel==='io') throw new IOError($name,$value);
            if ($channel==='declared') throw new $exception($name,$value);
            if (${returned?"$op===-1 || $op===-2":"$op<0"}) $this->open=($op===-2);${returned?`
            if ($op===-1 && $this->functionBinder!==null) {
                \\LeanBridge\\NativeHostV2\\References::drop($this->functionBinder); $this->functionBinder=null;
            }
            if ($commit!==null) $commit($value);`:""}
            return $value;
        } catch (\\Throwable $e) { $failed=true; throw $e; }
        finally { \\LeanBridge\\NativeHostV2\\References::leave($failed);${returned?" Internal\\FunctionReleases::drain();":""} }
    }
    public function __construct(array $classes) {
        $this->pid=getmypid(); $this->members=Internal\\Native::members($classes); $this->ffi=Internal\\Native::ffi();
        ${async?"$this->tasks=Internal\\Native::tasks($this->ffi,$this->members);\n        ":""}${returned?"$this->functionBinder=\\LeanBridge\\NativeHostV2\\References::hold($this->members);\n        ":""}try { $this->_call(-2,[],[]); }
        catch (\\Throwable $e) {
            if ($this->open) { try { $this->close(); } catch (\\Throwable) {} }${returned?" else if ($this->functionBinder!==null) { \\LeanBridge\\NativeHostV2\\References::drop($this->functionBinder); $this->functionBinder=null; }":""}
            throw $e;
        }
    }
    private function __clone() {}
    public function __serialize(): array { throw new \\LogicException('Cannot serialize a PHP host binding'); }
    public function __unserialize(array $data): void { throw new \\LogicException('Cannot restore a PHP host binding'); }
    public function close(): void {
        if (!$this->open) return;
        ${bounded?`if ($this->closing) return;
        if ($this->nativeDepth) throw new \\RuntimeException('Native PHP host call failed (status 14)');
        \\LeanBridge\\NativeHostV2\\References::enter();
        $this->closing=true; $failed=true;
        try {
            ${async?"try { $this->tasks->close(); } finally { ":""}${returned?"$this->_call(-7,[],[]); ":""}$this->_call(-1,[],[]);${async?" }":""}
            $failed=false;
        } finally { $this->closing=false; \\LeanBridge\\NativeHostV2\\References::leave($failed); }`:"$this->_call(-1,[],[]);"}
    }
    public function __destruct() { if ($this->open && getmypid()===$this->pid) { ${returned?"Internal\\FunctionReleases::abandon(fn()=>$this->close());":"try { $this->close(); } catch (\\Throwable) {}"} } }
${methods.join("\n")}
}
`;
	return { namespace: ns, files };
};
