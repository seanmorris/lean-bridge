/** @file Generate an ordinary typed PHP API over the synchronous Zend calls. */
import { readFile } from "node:fs/promises";
import { phpConversionBudget, phpScalarCodec } from "./copied-support.mjs";
import { phpValueSemantics } from "./copied-equality.mjs";
import { phpIOPublicDeclarations } from "./io-package.mjs";
import { copiedPhpWasmLoader } from "./php-wasm-copied-loader.mjs";

const quote = s => "'" + s.replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";
const shape = s => Array.isArray(s) ? "[" + s.map(shape).join(",") + "]" : quote(s);

// A Zend resource is never exposed by the public API. Only a value or a
// declared failure has payload bytes; END, including for Unit, is separate.
const cursorBody = (m, i, ns, transport, invoke) => {
	const cursor = "\\" + ns + "\\Cursor", next = "\\" + transport + "\\next" + i, close = "\\" + transport + "\\close" + i;
	const decl = quote(m.declaration), step = quote(m.stepDeclaration);
	const failure = (cls, status, d, type) => cls ? `if ($status===${status}) throw new \\${ns}\\${cls}(${d},WireValues::output(${shape(type)},$tags,$data));` : "";
	return `${invoke}
        if (!is_resource($reply)) {
            [$status,$tags,$data]=self::cursorFrame($reply,${m.tagBytes},${decl});
            try { ${failure(m.failure,m.effect === "IO" ? 4 : 3,decl,m.error)} }
            catch (\\UnexpectedValueException $e) { self::malformed(${decl},$e); }
            self::cursorFault($status,$tags,$data,${decl});
        }
        $take=static function() use ($reply) {
            [$status,$tags,$data]=self::cursorFrame(${next}($reply),${m.tagBytes},${step});
            if ($status===2 && $data==='' && trim($tags,"\\0")==='') return [];
            try {
                if ($status===0) return [WireValues::output(${shape(m.result)},$tags,$data)];
                ${failure(m.terminalFailure,m.stepIO ? 4 : 3,step,m.terminal)}
            } catch (\\UnexpectedValueException $e) { self::malformed(${step},$e); }
            self::cursorFault($status,$tags,$data,${step});
        };
        $release=static function() use ($reply) {
            if (${close}($reply)!==0) self::malformed(${decl});
        };
        return (\\Closure::bind(static fn()=>new ${cursor}($take,$release),null,${cursor}::class))();
    }`;
};

/**
 * Keep wire strings and typed failure codes private. Parameter checks run
 * before loading a lazy extension or calling any effectful Lean function.
 *
 * @param model - Reconciled IO surface for PHP-Wasm.
 * @param zend - Generated transport namespace and extension basename.
 */
export const generatePhpWasmIOFiles = async (model, zend) => {
	const { namespace: ns, methods } = model;
	if(!model.phpWasm || !/^LeanBridge\\WasmIO\\C[a-f0-9]{64}$/u.test(zend.transport)
		|| zend.library !== "php8.4-lb_wasm_io_" + zend.transport.slice(-64) + ".so") throw new TypeError("Invalid generated PHP-Wasm IO transport");
	const direct = methods.some(m => m.delivery === "iterator");
	const branches = methods.some(m => [m.result,m.error,m.terminal].some(Array.isArray)) ? ["Ok","Err"] : [];
	const calls = methods.map((m,i) => {
		const args = m.parameters.map(p => "$"+p.name), fn = zend.transport+"\\call"+i;
		// Reserve the application argument names: transport locals may not shadow them.
		const temp = key => { let n = "$"+key; while(args.includes(n)) n += "_"; return n; };
		const budget = temp("budget"), data = temp("data");
		const decl = quote(m.declaration), errorStatus = m.effect === "IO" ? 4 : 3;
		const preamble = `    public static function call${i}(${args.map(v=>"mixed "+v).join(", ")}): mixed {
        ${budget}=new Budget();
        ${data}=[${m.args.map((k,j)=>`WireValues::input(${quote(k)},${args[j]},${budget})`).join(",")}];
        if (!function_exists(${quote(fn)})) \\LeanBridge\\CopiedPhpWasmV1\\Loader::load(${quote(zend.library)},${quote(fn)});`;
		if(m.delivery === "iterator") return cursorBody(m,i,ns,zend.transport,preamble + `\n        $reply=\\${fn}(...${data});`);
		return `${preamble}
        return self::reply${i}(\\${fn}(...${data}));
    }
    private static function reply${i}(mixed $reply): mixed {
        if (!is_string($reply) || strlen($reply)<${1+m.tagBytes}) self::malformed(${decl});
        $status=ord($reply[0]);
        if ($status!==0${m.failure ? " && $status!=="+errorStatus : ""}) {
            if (!in_array($status,[5,9,10,11,12],true) || strlen($reply)!==${1+m.tagBytes}) self::malformed(${decl});
            throw new \\${ns}\\LeanBridgeError(${quote("Bridge failure in "+m.declaration+" (status ")}.$status.')');
        }
        $tags=substr($reply,1,${m.tagBytes}); $data=substr($reply,${1+m.tagBytes});
        try {
            $value=WireValues::output(${m.failure ? `$status===0 ? ${shape(m.result)} : ${shape(m.error)}` : shape(m.result)},$tags,$data);
        } catch (\\UnexpectedValueException $e) { self::malformed(${decl},$e); }
        ${m.failure ? `if ($status===${errorStatus}) throw new \\${ns}\\${m.failure}(${decl},$value);` : ""}
        return $value;
    }`;
	});
	const header = direct ? (await readFile(new URL("./php-wasm-iterator.php",import.meta.url),"utf8")).replaceAll("__LB_PUBLIC__",ns) : `<?php
declare(strict_types=1);
namespace ${ns};`;
	const api = `${header}
require_once __DIR__.'/Internal/Native.php';
${phpIOPublicDeclarations(methods,branches)}
`;
	const native = `<?php
declare(strict_types=1);
${copiedPhpWasmLoader}
namespace ${ns}\\Internal {
require_once __DIR__.'/WireValues.php';
${phpConversionBudget}
${phpScalarCodec}
${phpValueSemantics({ namespace: ns, branches, surface: { copies: [] } })}
final class Native {
    private static function malformed(string $declaration, ?\\Throwable $cause=null): never {
        \\${zend.transport}\\retire();
        throw new \\${ns}\\LeanBridgeError('Malformed Lean response in '.$declaration.'; shared runtime retired',0,$cause);
    }
${direct ? `    private static function cursorFrame(mixed $reply, int $n, string $decl): array {
        if (!is_string($reply) || strlen($reply)<1+$n) self::malformed($decl);
        return [ord($reply[0]),substr($reply,1,$n),substr($reply,1+$n)];
    }
    private static function cursorFault(int $status,string $tags,string $data,string $decl): never {
        if (!in_array($status,[5,9,10,11,12],true) || $data!=='' || trim($tags,"\\0")!=='') self::malformed($decl);
        throw new \\${ns}\\LeanBridgeError('Bridge failure in '.$decl.' (status '.$status.')');
    }\n` : ""}${calls.join("\n")}
}
}
`;
	const codec = await readFile(new URL("./php-wasm-io-codec.php", import.meta.url), "utf8");
	return { "src/Api.php": api, "src/Internal/Native.php": native, "src/Internal/WireValues.php": codec.replaceAll("__LB_PUBLIC__", ns) };
};
