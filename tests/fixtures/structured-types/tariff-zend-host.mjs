/** @file Run the installed Tariff package inside Zend, not in its JavaScript host. */
import api from "@example/tariff-quotes";

export const runInstalled = async ({Host, loading, program, vendor}) => {
	const lazy = loading === "lazy", binding = lazy ? api.lazy : api;
	const selected = vendor ? binding.extensions : binding;
	const observer = {name: "observer.so", url: new URL("./observer.so", import.meta.url), ini: false};
	const php = new Host({version: "8.4", autoTransaction: false, sharedLibs: lazy ? [] : [selected],
		dynamicLibs: [...lazy ? [selected] : [], observer]});
	let stdout = "", stderr = "";
	php.addEventListener("output", e => { stdout += e.detail.join(""); });
	php.addEventListener("error", e => { stderr += e.detail.join(""); });
	await php.binary;
	const autoload = vendor ? "/consumer-vendor/autoload.php" : binding.autoload;
	if(vendor) {
		const dirs = new Set();
		for(const [path, bytes] of vendor) {
			let dir = "";
			for(const part of ("consumer-vendor/"+path).split("/").slice(0,-1)) {
				dir += "/"+part;
				if(!dirs.has(dir)) { await php.mkdir(dir); dirs.add(dir); }
			}
			await php.writeFile("/consumer-vendor/"+path,bytes);
		}
	}
	const run = async source => {
		const status = await php.run(source);
		if(status || stderr) throw new Error(JSON.stringify({status, stdout, stderr}));
	};
	await run("<?php require_once '"+autoload+"';");
	await php.writeFile("/application.php",program);
	await run("<?php require '/application.php';");
	const observed = JSON.parse(stdout);
	// After ending the request the broker can be observed independently of the
	// previous PHP variables, without installing hooks in the published API.
	await php.refresh(); stdout = ""; stderr = "";
	await run("<?php require_once '"+autoload+"'; $q=\\LeanTariffQuotes\\make_tariff(\\Brick\\Math\\BigInteger::of(41))->quote; "+
		"$n=(string)$q(\\Brick\\Math\\BigInteger::of(1)); $q->close(); unset($q); "+
		"if (!function_exists('owned_installed_snapshot')) dl('observer.so'); gc_collect_cycles(); "+
		"echo json_encode([$n,owned_installed_snapshot()['liveIdentities']]);");
	return JSON.stringify({...observed, refreshed: JSON.parse(stdout)});
};
