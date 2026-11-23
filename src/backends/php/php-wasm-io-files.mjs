/** @file Generate an ordinary typed PHP API over the synchronous Zend calls. */
import { readFile } from "node:fs/promises";
import { phpConversionBudget, phpScalarCodec } from "./copied-support.mjs";
import { phpValueSemantics } from "./copied-equality.mjs";
import { phpIOPublicDeclarations } from "./io-package.mjs";
import { copiedPhpWasmLoader } from "./php-wasm-copied-loader.mjs";

const quote = s => "'" + s.replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";
const shape = s => Array.isArray(s) ? "[" + s.map(shape).join(",") + "]" : quote(s);

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
	const branches = methods.some(m => Array.isArray(m.result) || Array.isArray(m.error)) ? ["Ok","Err"] : [];
	const calls = methods.map((m,i) => {
		const args = m.parameters.map(p => "$"+p.name), fn = zend.transport+"\\call"+i;
		// Reserve the application argument names: transport locals may not shadow them.
		const temp = key => { let n = "$"+key; while(args.includes(n)) n += "_"; return n; };
		const budget = temp("budget"), data = temp("data"), reply = temp("reply"), status = temp("status"), tags = temp("tags");
		return `    public static function call${i}(${args.map(v=>"mixed "+v).join(", ")}): mixed {
        ${budget}=new Budget();
        ${data}=[${m.args.map((k,j)=>`WireValues::input(${quote(k)},${args[j]},${budget})`).join(",")}];
        if (!function_exists(${quote(fn)})) \\LeanBridge\\CopiedPhpWasmV1\\Loader::load(${quote(zend.library)},${quote(fn)});
        ${reply}=\\${fn}(...${data});
        if (!is_string(${reply}) || strlen(${reply})<${1+m.tagBytes}) throw new \\${ns}\\LeanBridgeError('Malformed Lean response');
        ${status}=ord(${reply}[0]); ${tags}=substr(${reply},1,${m.tagBytes}); ${data}=substr(${reply},${1+m.tagBytes});
        if (${status}===0) return WireValues::output(${shape(m.result)},${tags},${data});
        ${m.failure ? `if (${status}===${m.effect==="IO"?4:3}) throw new \\${ns}\\${m.failure}(${quote(m.declaration)},WireValues::output(${shape(m.error)},${tags},${data}));` : ""}
        throw new \\${ns}\\LeanBridgeError(${quote("Bridge failure in "+m.declaration+" (status ")}.${status}.')');
    }`;
	});
	const api = `<?php
declare(strict_types=1);
namespace ${ns};
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
${calls.join("\n")}
}
}
`;
	const codec = await readFile(new URL("./php-wasm-io-codec.php", import.meta.url), "utf8");
	return { "src/Api.php": api, "src/Internal/Native.php": native, "src/Internal/WireValues.php": codec.replaceAll("__LB_PUBLIC__", ns) };
};
