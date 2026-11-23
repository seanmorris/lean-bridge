/** @file Application exercise shared by the real Node and Chromium installed-package tests. */
import api from "php-wasm-ledger";

/**
 * Load only the installed public descriptor and (optionally) Composer's vendor files.
 *
 * @param options - Pinned PHP host constructor, loading mode, PHP application and optional vendor payloads.
 */
export const runInstalled = async options => {
	const { Host, loading, program, vendor } = options;
	const lazy = loading === "lazy", locations = [];
	const binding = lazy ? api.lazy : api, selected = vendor ? binding.extensions : binding;
	const php = new Host({ version: "8.4", autoTransaction: false
		, sharedLibs: lazy ? [] : [selected], dynamicLibs: lazy ? [selected] : []
		, locateFile: name => { if(/^php8\.4-lb_wasm_io_/u.test(name)) locations.push(name); } });
	let stdout = "", stderr = "";
	php.addEventListener("output", e => { stdout += e.detail.join(""); });
	php.addEventListener("error", e => { stderr += e.detail.join(""); });
	await php.binary;
	const autoload = vendor ? "/consumer-vendor/autoload.php" : api.autoload;
	if(vendor)
	{
		const dirs = new Set();
		for(const [path,bytes] of vendor)
		{
			let dir = "";
			for(const part of ("consumer-vendor/"+path).split("/").slice(0,-1))
			{
				dir += "/"+part;
				if(!dirs.has(dir))
				{ await php.mkdir(dir); dirs.add(dir); }
			}
			await php.writeFile("/consumer-vendor/"+path,bytes);
		}
	}
	const run = async code => {
		const status = await php.run(code);
		if(status || stderr) throw new Error(JSON.stringify({status,stdout,stderr}));
	};
	await run(`<?php require_once '${autoload}'; try { \\LeanLedger\\add(1); throw new Exception('expected TypeError'); } catch (TypeError $e) {}`);
	if(locations.length !== (lazy ? 0 : 1)) throw new Error("Unexpected extension loads after invalid input: "+locations.length);
	const bootstrap = "/vendor/lean-bridge/ledger/bootstrap.php";
	if(!program.includes(bootstrap)) throw new Error("Expected the embedded consumer fixture");
	await php.writeFile("/application.php",program.replace(bootstrap,autoload));
	await run("<?php require '/application.php';");
	if(stdout !== "php-api:30" || locations.length !== 1) throw new Error(JSON.stringify({stdout,locations}));
	return stdout;
};
