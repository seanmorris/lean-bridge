/**
 * Public PHP-Wasm host calls, with no oracle values or private ABI access.
 *
 * @file
 */

/**
 * Execute one lexical PHP caller in a fresh startup or first-call host.
 *
 * @param options - Installed descriptor, host, independent inputs and PHP file.
 */
export const executePhpWasmCorpus = async options => {
	const { Php, api, loading, mode, request, source, mount } = options;
	const libraries = [], phases = [];
	const descriptor = loading === "lazy" ? api.lazy : api;
	const selected = mount ? descriptor.extensions : descriptor;
	const php = new Php({ version: "8.4", autoTransaction: false
		, ini: "memory_limit=512M"
		, sharedLibs: loading === "startup" ? [selected] : []
		, dynamicLibs: loading === "lazy" ? [selected] : []
		, locateFile: name => { if(name.endsWith(".so") && name !== "libxml2.so") libraries.push(name); } });
	let stdout = "", stderr = "";
	php.addEventListener("output", event => { stdout += event.detail.join(""); });
	php.addEventListener("error", event => { stderr += event.detail.join(""); });
	const run = async code => {
		const status = await php.run(code);
		if(status !== 0 || stderr) throw new Error(JSON.stringify({ status, stdout, stderr }));
	};
	await php.binary;
	phases.push({ stage: "ready", libraries: [...libraries] });
	if(mount) await mount(php);
	const input = JSON.parse(request);
	await run("<?php require_once '/" + input.autoload + "';");
	phases.push({ stage: "autoload", libraries: [...libraries] });
	const call = input.module + "\\" + Object.values(input.operations)[0];
	await run("<?php try { " + call + "(1); throw new Exception('Expected TypeError'); } catch (TypeError $error) {}");
	phases.push({ stage: "invalid", libraries: [...libraries] });
	if(stdout !== "") throw new Error("Unexpected output before corpus: " + stdout);
	await php.writeFile("/request.json", request);
	await php.writeFile("/" + mode + ".php", source);
	await run("<?php require '/" + mode + ".php';");
	phases.push({ stage: "complete", libraries: [...libraries] });
	return { phases, observation: JSON.parse(stdout) };
};
