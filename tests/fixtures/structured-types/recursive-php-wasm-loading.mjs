/**
 * The same installed multi-package caller runs in Node and Chromium.
 *
 * @file
 */

/**
 * Reject an unexpected actual host result.
 *
 * @param value - Required condition.
 * @param message - Failure diagnostic.
 */
const check = (value, message) => { if(!value) throw new Error(message); };
const same = (left, right, message) => check(JSON.stringify(left) === JSON.stringify(right), message);
const isLibrary = name => name.startsWith("php8.4-lb_") || name.startsWith("liblean_bridge_php_wasm_copied_");
const runHost = php => {
	let stdout = "", stderr = "";
	php.addEventListener("output", event => { stdout += event.detail.join(""); });
	php.addEventListener("error", event => { stderr += event.detail.join(""); });
	return async source => {
		stdout = ""; stderr = "";
		const status = await php.run(source);
		check(status === 0 && stderr === "", JSON.stringify({ status, stdout, stderr }));
		return stdout;
	};
};

/**
 * Use original graph and acyclic packages, including a separately evaluated duplicate.
 *
 * @param options - Actual PHP host, installed descriptors and platform file access.
 */
export const runComposition = async options => {
	const { Host, apis, duplicate, loading, arrangement, mode, order, probe, read, mountVendor } = options;
	const libraries = [], phases = [];
	const selected = [...apis.slice(0, 3).map((api, index) => ({ api, index })), { api: duplicate.api0, index: 0 }, { api: duplicate.api2, index: 2 }].map(({ api, index }) => {
		const lazy = loading === "lazy" || loading === "mixed" && index !== 2;
		api = lazy ? api.lazy : api;
		return { api: arrangement === "composer" ? api.extensions : api, lazy };
	});
	const php = new Host({ version: "8.4", autoTransaction: false
		, ini: "memory_limit=256M"
		, sharedLibs: selected.filter(item => !item.lazy).map(item => item.api)
		, dynamicLibs: [{ name: "probe.so", url: probe, ini: false }, ...selected.filter(item => item.lazy).map(item => item.api)]
		, locateFile: name => { if(isLibrary(name)) libraries.push(name); }
	});
	const run = runHost(php), initial = loading === "lazy" ? 0 : loading === "mixed" ? 2 : 4;
	await php.binary; same(libraries.length, initial, "Initial libraries");
	phases.push({ stage: "ready", libraries: libraries.length });
	if(arrangement === "composer")
	{ await mountVendor(php); await run("<?php require '/app-vendor/autoload.php';"); }
	else for(const api of [...apis.slice(0, 3), duplicate.api0, duplicate.api2]) await run("<?php require_once '" + api.autoload + "';");
	same(libraries.length, initial, "Autoload fetched a lazy library"); phases.push({ stage: "autoload", libraries: libraries.length });
	await run(String.raw`<?php try { LeanCedar\echo_(new stdClass()); throw new Exception('Accepted bad input'); } catch (TypeError $error) {} try { LeanMaple\echo_(new stdClass()); throw new Exception('Accepted bad input'); } catch (TypeError $error) {}`);
	same(libraries.length, initial, "Invalid input fetched a lazy library"); phases.push({ stage: "invalid", libraries: libraries.length });
	await php.writeFile("/request.json", JSON.stringify({ order }));
	await php.writeFile("/consumer.php", (await read("consumer.php")).replace("strict_types=0", "strict_types=" + (mode === "strict" ? "1" : "0")));
	const observed = JSON.parse(await run("<?php require '/consumer.php';"));
	same(observed.snapshot, [1, 2, 1, 3, 3, 0], "Shared runtime initialization");
	same(libraries.length, 4, "Duplicate libraries"); same(new Set(libraries).size, 4, "Duplicate library names");
	phases.push({ stage: "complete", libraries: libraries.length });
	for(let index = 0; index < 20; index++) same(await run(String.raw`<?php echo LeanCedar\value(), ':', LeanMaple\value(), ':', LeanStone\value();`), "41:43:47", "Repeated installed call");
	const retired = JSON.parse(await run("<?php echo json_encode(LoadingProbe::retire(), JSON_THROW_ON_ERROR);"));
	same(retired.snapshot, [1, 3, 1, 3, 3, 0], "Shared runtime retirement");
	same(await run("<?php echo 42;"), "42", "PHP interpreter did not survive retirement");
	same(libraries.length, 4, "Retirement reloaded libraries");
	return { arrangement, loading, mode, order, observed, retired, phases
		, libraries: libraries.sort(), repeatedRequests: 20
		, duplicateDescriptor: true, interpreterSurvived: true };
};

/**
 * Conflicting compiled packages must stop startup before any library fetch.
 *
 * @param options - Installed descriptors, actual host and selected first package.
 */
export const runConflict = async options => {
	const { Host, apis, first, loading } = options;
	const libraries = [], order = first === 0 ? [apis[0], apis[3]] : [apis[3], apis[0]];
	const args = selected => ({ version: "8.4", autoTransaction: false
		, sharedLibs: loading === "startup" ? selected : []
		, dynamicLibs: loading === "lazy" ? selected.map(api => api.lazy) : []
		, locateFile: name => { if(isLibrary(name)) libraries.push(name); } });
	let code;
	try
	{ const php = new Host(args(order)); await php.binary; }
	catch(error)
	{ code = error.code; }
	same(code, "php-wasm-component-conflict", "Conflicting compiled identities were not rejected");
	same(libraries, [], "Conflicting startup fetched a library");
	const php = new Host(args([order[0], order[0]])), run = runHost(php);
	await php.binary; await run("<?php require_once '" + order[0].autoload + "';");
	const value = await run(String.raw`<?php echo LeanCedar\value();`);
	same(value, first === 0 ? "41" : "99", "Isolated compiled build returned the wrong result");
	same(libraries.length, 2, "Isolated build did not deduplicate");
	return { first, loading, code, rejectedBeforeFetch: true, isolatedBuildUsable: true, value, libraries: libraries.sort() };
};

/**
 * A failed lazy link cannot be retried by either graph or acyclic peers.
 *
 * @param options - Actual host, installed descriptors and an absent local URL.
 */
export const runFailure = async options => {
	const { Host, apis, failure, absent, componentLibrary, mode } = options;
	const libraries = [];
	const php = new Host({ version: "8.4", autoTransaction: false
		, ini: "memory_limit=256M" + (failure === "disabled" ? "\nenable_dl=0" : "")
		, dynamicLibs: apis.slice(0, 3).map(api => failure === "unregistered" ? { getLibs: () => [], getFiles: php => api.getFiles(php) } : api.lazy)
		, locateFile: name => {
			if(isLibrary(name)) libraries.push(name);
			if(failure === "missing-component" && name === componentLibrary || failure === "missing-runtime" && name.startsWith("liblean_bridge_php_wasm_copied_")) return absent.href;
		}
	});
	const run = runHost(php);
	await php.binary;
	for(const api of apis.slice(0, 3)) await run("<?php require_once '" + api.autoload + "';");
	same(libraries.length, 0, "Autoload fetched a library");
	const messages = [];
	let afterFirst;
	for(const namespace of ["LeanCedar", "LeanMaple", "LeanStone", "LeanCedar"])
	{
		const source = `<?php declare(strict_types=${mode === "strict" ? "1" : "0"});
$handler = static function () { return true; }; set_error_handler($handler);
try { ${namespace}\\value(); throw new Exception('Expected loading error'); }
catch (${namespace}\\LeanBridgeError $error) { echo $error->getMessage(); }
finally { $restored = set_error_handler(null); if ($restored !== $handler) throw new Exception('Error handler not restored'); }
`;
		await php.writeFile("/failure-call.php", source);
		messages.push(await run("<?php require '/failure-call.php';"));
		afterFirst ??= libraries.length;
		same(libraries.length, afterFirst, "A failed loader retried or linked a peer");
	}
	const pattern = failure === "disabled" ? /enable_dl=1/ : failure === "unregistered" ? /Register this package lazy descriptor/ : /create a new PHP instance/;
	for(const message of messages) check(pattern.test(message), "Unexpected loading error: " + message);
	if(failure.startsWith("missing-"))
	{ check(afterFirst > 0, "No link attempt"); same(new Set(messages).size, 1, "Shared failure was not retained"); }
	else same(afterFirst, 0, "Configuration error attempted a link");
	same(await run("<?php echo 42;"), "42", "PHP interpreter did not survive failed loading");
	return { failure, mode, afterFirst, messages, libraries: libraries.sort(), interpreterSurvived: true, noRetry: true, handlerRestored: true };
};
