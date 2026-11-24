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
	const methods=[],errors=[];
	for(const [i,e] of checked.entries.entries())
	{
		const name=phpClassName(e.name);
		if(!/^[A-Za-z][A-Za-z0-9_]*$/u.test(name) || names.has(name.toLowerCase())) fail("colliding export "+name);
		names.add(name.toLowerCase());
		const params=e.parameters.map(p=>phpFieldName(p.name,fail)), args=params.map(p=>"$"+p);
		if(new Set(params).size!==params.length) fail("duplicate parameter");
		const inputs=e.parameters.map(p=>site(p.type)), result=site(e.result), error=e.effect==="EIO"?site(e.error):null;
		const ex=pascal(e.name)+"Error";
		if(error!==null)
		{
			if(errorNames.has(ex.toLowerCase())) fail("colliding exception "+ex);
			errorNames.add(ex.toLowerCase()); errors.push("final class "+ex+" extends DeclaredFailure {}");
		}
		methods.push(`    /** ${params.map((p,j)=>"@param "+hint(inputs[j])+" $"+p).join(" ")} @return ${hint(result)} */
    public function ${name}(${args.map(a=>"mixed "+a).join(", ")}): ${hint(result)} {
        if (func_num_args()!==${args.length}) throw new \\ArgumentCountError('Wrong number of arguments');
        if (!$this->open) throw new \\LogicException('PHP host binding is closed');
        [$channel,$value]=Internal\\HostFrame::call($this->ffi,Internal\\Native::PREFIX,$this->members,${i},[${args.join(",")}],${literal(inputs)},${literal(result)},${literal(error)});
        if ($channel==='io') throw new IOError(${JSON.stringify(e.declaration)},$value);${error===null?"":"\n        if ($channel==='declared') throw new "+ex+"("+JSON.stringify(e.declaration)+",$value);"}
        return $value;
    }`);
	}
	const libraries = {...linked.binaries};
	for(const n of ["libleanshared.so","liblean_bridge_native.so"])
	{
		const h=runtime.files["lib/"+n]?.sha256;if(!hex(h)) fail("missing runtime library"); libraries[n]=h;
	}
	const defs = "typedef int (*php_host_dispatch)(uint64_t,int32_t,const uint64_t*,size_t,uint64_t*,uint32_t*); typedef struct { php_host_dispatch fn; } php_host_gate; "
		+"int "+prefix+"_call(uint64_t,php_host_dispatch,int,const uint64_t*,size_t,uint64_t*,uint8_t*,uint32_t*); void "+prefix+"_clear(uint64_t*);";
	const templates = {"References": "host-refs","HostMembers": "host-members","HostFrame": "host-frame","HostWords": "host-words","WireValues": "io-codec"};
	const files = {"src/Internal/Loader.php": copiedPhpLoader};
	for(const [file,source] of Object.entries(templates))
		files["src/Internal/"+file+".php"]=(await readFile(new URL("./"+source+".php",import.meta.url),"utf8")).replaceAll("__LB_PUBLIC__",ns);
	files["src/Internal/Native.php"]=`<?php
declare(strict_types=1);
namespace ${ns}\\Internal;
${copiedPhpHelpers}
${phpValueSemantics({namespace: ns,branches: ["Ok","Err"],surface: {copies: []}})}
final class Native {
    public const PREFIX='${prefix}';
    private const DEFINITIONS='${defs}';
    public static function ffi(): \\FFI { ${copiedPhpAssets({componentId: api.component.id, componentIdentity: identity,runtimeIdentity,library: component,libraries})} }
    public static function members(array $classes): HostMembers { return new HostMembers(json_decode(<<<'MODEL'
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
${errors.join("\n")}
function withHosts(array $classes): Binding { return new Binding($classes); }
final class Binding {
    private bool $open=false;
    private readonly Internal\\HostMembers $members;
    private readonly \\FFI $ffi;
    private readonly int $pid;
    public function __construct(array $classes) {
        $this->pid=getmypid(); $this->members=Internal\\Native::members($classes); $this->ffi=Internal\\Native::ffi();
        Internal\\HostFrame::call($this->ffi,Internal\\Native::PREFIX,$this->members,-2,[],[]);
        $this->open=true;
    }
    private function __clone() {}
    public function __serialize(): array { throw new \\LogicException('Cannot serialize a PHP host binding'); }
    public function __unserialize(array $data): void { throw new \\LogicException('Cannot restore a PHP host binding'); }
    public function close(): void {
        if (!$this->open) return;
        Internal\\HostFrame::call($this->ffi,Internal\\Native::PREFIX,$this->members,-1,[],[]); $this->open=false;
    }
    public function __destruct() { if ($this->open && getmypid()===$this->pid) { try { $this->close(); } catch (\\Throwable) {} } }
${methods.join("\n")}
}
`;
	return { namespace: ns, files };
};
