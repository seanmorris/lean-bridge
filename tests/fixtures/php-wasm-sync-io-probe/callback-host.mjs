/** @file Real installed PHP functions in a fresh VM for each terminal fault. */
import ledger from "php-wasm-ledger";
import switchboard from "php-wasm-switchboard";

/**
 * Run a fault through an otherwise unmodified pair of installed packages.
 *
 * @param options - Host constructor, test PHP and observer, fault case and IR method order.
 */
export const runCallbackHost = async options => {
	const { Host, program, probe, fault, slots } = options;
	const php = new Host({ version: "8.4", autoTransaction: false
		, sharedLibs: [switchboard]
		, dynamicLibs: [ledger.lazy, { name: "snapshot.so", url: probe, ini: false }] });
	let stdout = "", stderr = "";
	php.addEventListener("output",e=>{stdout+=e.detail.join("");});
	php.addEventListener("error",e=>{stderr+=e.detail.join("");});
	await php.binary;
	await php.writeFile("/case.json",JSON.stringify([fault,slots]));
	await php.writeFile("/callbacks.php",program);
	const code = await php.run("<?php require '/callbacks.php';");
	if(code || stderr || stdout!=="callbacks:"+fault+":retired:0") throw new Error(JSON.stringify({code,stderr,stdout}));
	return stdout;
};
