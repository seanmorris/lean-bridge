/**
 * Probe-only PHP-Wasm driver. Normal installed callers retain empty-stderr enforcement.
 * Executes the complete original corpus plus one explicit unrefined positive control.
 *
 * @file
 */
import { parseSubtypeEntryTrace } from "./entry-trace.mjs";
import { subtypeEntryCall, subtypeEntryCorpusCalls } from "./entry-cases.mjs";

const require = (condition, message) => { if(!condition) throw new Error(message); };
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const corpus = subtypeEntryCorpusCalls(), control = subtypeEntryCall("unrestricted");
const selection = [...new Map([...corpus, control].flatMap(call => [
	{ kind: "public", label: call.publicName }, ...call.entries
]).map(item => [`${item.kind}/${item.label}`, item])).values()];

/**
 * Run one installed instrumented component in an exclusive PHP host.
 *
 * @param options - Same prepared-package inputs as the ordinary driver.
 */
export const executePhpWasmCorpus = async options => {
	const { Php, api, loading, mode, request, source, mount } = options;
	require(["startup", "lazy"].includes(loading) && ["weak", "strict"].includes(mode), "unknown probe execution mode");
	const input = JSON.parse(request);
	require(input.module === "LeanSubtypes" && same(input.operations, { probe: "half" }), "unexpected probe caller");
	const libraries = [], phases = [], descriptor = loading === "lazy" ? api.lazy : api;
	const selected = mount ? descriptor.extensions : descriptor;
	const php = new Php({ version: "8.4"
		, autoTransaction: false
		, ini: "memory_limit=512M"
		, sharedLibs: loading === "startup" ? [selected] : []
		, dynamicLibs: loading === "lazy" ? [selected] : []
		, locateFile: name => { if(name.endsWith(".so") && name !== "libxml2.so") libraries.push(name); } });
	let stdout = "", stderr = "";
	php.addEventListener("output", event => { stdout += event.detail.join(""); });
	php.addEventListener("error", event => { stderr += event.detail.join(""); });
	const run = async code => {
		const status = await php.run(code);
		require(status === 0, JSON.stringify({ status, stdout, stderr }));
	};
	const silent = () => require(stdout === "" && stderr === "", "unexpected output before entry corpus");
	await php.binary; silent();
	phases.push({ stage: "ready", libraries: [...libraries] });
	if(mount) await mount(php);
	await run("<?php require_once '/" + input.autoload + "';"); silent();
	phases.push({ stage: "autoload", libraries: [...libraries] });
	await run("<?php try { \\LeanSubtypes\\half(1); throw new Exception('Expected TypeError'); } catch (TypeError $error) {}"); silent();
	phases.push({ stage: "invalid", libraries: [...libraries] });
	await php.writeFile("/request.json", request); await php.writeFile("/" + mode + ".php", source);
	await run("<?php require '/" + mode + ".php';");
	const observation = JSON.parse(stdout), trace = stderr;
	require(same(observation, { checks: 2024, word_bits: 32, php: "8.4.1" }), "incomplete public corpus");
	const calls = parseSubtypeEntryTrace(trace, selection);
	require(same(calls, corpus), "probe entry sequence does not match all original public calls");
	stdout = ""; stderr = "";
	await run("<?php echo json_encode((string) \\LeanSubtypes\\unrestricted(\\Brick\\Math\\BigInteger::of('7')), JSON_THROW_ON_ERROR);");
	require(JSON.parse(stdout) === "7", "unrefined positive control failed");
	const controlTrace = stderr;
	require(same(parseSubtypeEntryTrace(controlTrace, selection), [control]), "missing unrefined adapter/source entry control");
	phases.push({ stage: "complete", libraries: [...libraries] });
	return { phases, observation
		, entryProbe: {
			scope: "separate-instrumented-probe"
			, trace, controlTrace, calls: calls.length
			, counts: Object.fromEntries(["validator", "constructor", "adapter", "source"].map(kind => [kind, calls.reduce((sum, call) => sum + call.counts[kind], 0)]))
		}
	};
};
