/**
 * One installed public-API scenario for Node and Chromium PHP-Wasm hosts.
 *
 * @file
 */

/**
 * Check cold validation, package autoloading and repeated requests in one host.
 *
 * @param options - Selected host, descriptor, loading mode and fixture readers.
 */
export const runRecursiveHost = async options => {
	const { Php, descriptor, loading, mode, request, readConsumer, mountComposer, readDocumentation } = options;
	const api = loading === "lazy" ? descriptor.lazy : descriptor;
	const selected = mountComposer ? api.extensions : api, libraries = [], phases = [];
	const php = new Php({ version: "8.4", autoTransaction: false
		, ini: "memory_limit=256M"
		, sharedLibs: loading === "startup" ? [selected] : []
		, dynamicLibs: loading === "lazy" ? [selected] : []
		, locateFile: name => {
			if(name.startsWith("php8.4-lb_") || name.startsWith("liblean_bridge_php_wasm_copied_")) libraries.push(name);
		}
	});
	let stdout = "", stderr = "";
	php.addEventListener("output", event => { stdout += event.detail.join(""); });
	php.addEventListener("error", event => { stderr += event.detail.join(""); });
	const run = async source => {
		const status = await php.run(source);
		if(status || stderr) throw new Error(JSON.stringify({ status, stdout, stderr }));
	};
	await php.binary; phases.push({ stage: "ready", libraries: [...libraries] });
	if(mountComposer)
	{
		await mountComposer(php);
		await run("<?php require '/app/vendor/autoload.php';");
	}
	else await run("<?php require '" + api.autoload + "';");
	phases.push({ stage: "autoload", libraries: [...libraries] });
	await run("<?php try { LeanStructured\\call_recursive(false, false); throw new Exception('Expected TypeError'); } catch (TypeError $error) {} try { LeanStructured\\make_recursive(new stdClass()); throw new Exception('Expected TypeError'); } catch (TypeError $error) {}");
	phases.push({ stage: "invalid", libraries: [...libraries] });
	await php.writeFile("/request.json", JSON.stringify(request));
	await php.writeFile("/consumer.php", (await readConsumer()).replace("strict_types=0", "strict_types=" + (mode === "strict" ? "1" : "0")));
	await run("<?php require '/consumer.php';");
	phases.push({ stage: "complete", libraries: [...libraries] });
	const observed = JSON.parse(stdout); stdout = "";
	let documentation;
	if(mountComposer)
	{
		await php.writeFile("/app/recursive-callbacks.php", await readDocumentation());
		await run("<?php require '/app/recursive-callbacks.php';");
		if(stdout !== "42\n20\n42\n") throw new Error("Unexpected documentation output: " + stdout);
		documentation = { verbatim: true, stdout }; stdout = "";
	}
	for(let index = 0; index < 20; index++)
		await run("<?php $tree = new LeanStructured\\TreeBranch([]); $lease = LeanStructured\\make_recursive($tree); if (!equal($lease(true, new LeanStructured\\TreeLeaf(Brick\\Math\\BigInteger::of(7))), $tree)) throw new Exception('Repeat failed'); $lease->close(); unset($lease); gc_collect_cycles();");
	if(stdout !== "") throw new Error("Unexpected repeated-call output");
	const initial = loading === "lazy" ? 0 : 2;
	if(phases.some((phase, index) => phase.libraries.length !== (index === 3 ? 2 : initial))
		|| libraries.length !== 2 || new Set(libraries).size !== 2)
		throw new Error("Unexpected extension loading: " + JSON.stringify({ phases, libraries }));
	return { observed, phases, repeatedRequests: 20, invalidStayedCold: true, documentation };
};
