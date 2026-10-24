/**
 * Installed driver for one independently planned synchronous callback trace matrix.
 *
 * @file
 */
import {
	parsePhpWasmCallbackEntryTrace, phpWasmCallbackEntryKinds
} from "./callback-entry-trace.mjs";

const require = (condition, message) => { if(!condition) throw new Error(message); };
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const exact = (value, keys, label) => {
	require(value && typeof value === "object" && !Array.isArray(value), `invalid ${label}`);
	require(same(Object.keys(value).sort(), [...keys].sort()), `open ${label}`);
};

const validatePlan = plan => {
	exact(plan, ["scope", "family", "selected", "cases"], "callback entry plan");
	require(plan.scope === "separate-instrumented-probe", "callback entry scope");
	require(["callback-fin", "callback-checked-record", "callback-subtype"].includes(plan.family)
		, "callback entry family");
	require(Array.isArray(plan.selected) && plan.selected.length > 0
		, "callback entry selection");
	require(Array.isArray(plan.cases) && plan.cases.length > 0
		, "callback entry cases");
	const controls = new Set();
	for(const item of plan.cases)
	{
		exact(item, ["control", "outcome", "calls"], "callback entry case");
		require(/^[a-z][a-z0-9-]*$/u.test(item.control) && !controls.has(item.control)
			, "callback control identity");
		controls.add(item.control);
		require(["accepted", "refused"].includes(item.outcome), "callback outcome");
		require(Array.isArray(item.calls), "callback calls");
		for(const call of item.calls)
		{
			exact(call, ["publicName", "entries", "counts"], "callback call");
			require(typeof call.publicName === "string" && Array.isArray(call.entries)
				, "callback call shape");
			exact(call.counts, phpWasmCallbackEntryKinds, "callback entry counts");
			for(const kind of phpWasmCallbackEntryKinds)
				require(call.counts[kind] === call.entries.filter(entry => entry.kind === kind).length
					, `callback ${kind} count`);
			require(call.counts.cleanup === 1, "callback call cleanup");
		}
	}
	return [...controls];
};

/**
 * Execute every control as a distinct PHP call and compare its complete stderr delta.
 *
 * @param options - Installed host, descriptor and independently authored inputs.
 */
export const executePhpWasmCorpus = async options => {
	const { Php, api, loading, mode, request, source, mount } = options;
	require(["startup", "lazy"].includes(loading) && ["weak", "strict"].includes(mode)
		, "unknown callback probe mode");
	const input = JSON.parse(request);
	exact(input, ["module", "operations", "autoload", "entryProbe"], "callback request");
	require(typeof input.module === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/u.test(input.module)
		&& typeof input.autoload === "string" && !input.autoload.startsWith("/")
	, "invalid callback request");
	exact(input.operations, ["probe"], "callback operations");
	require(typeof input.operations.probe === "string"
		&& /^[a-z_][a-z0-9_]*$/u.test(input.operations.probe), "invalid callback operation");
	const controls = validatePlan(input.entryProbe);
	const libraries = [], phases = [], descriptor = loading === "lazy" ? api.lazy : api;
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
		require(status === 0, JSON.stringify({ status, stdout, stderr }));
	};
	await php.binary; require(stdout === "" && stderr === "", "callback probe startup output");
	phases.push({ stage: "ready", libraries: [...libraries] });
	if(mount) await mount(php);
	await run("<?php require_once '/" + input.autoload + "';");
	require(stdout === "" && stderr === "", "callback probe autoload output");
	phases.push({ stage: "autoload", libraries: [...libraries] });
	const probe = input.module + "\\" + input.operations.probe;
	await run("<?php try { " + probe + "(1); throw new Exception('Expected TypeError'); } catch (TypeError $error) {}");
	require(stdout === "" && stderr === "", "callback probe invalid-call output");
	phases.push({ stage: "invalid", libraries: [...libraries] });
	await php.writeFile("/" + mode + ".php", source);
	await run("<?php require '/" + mode + ".php';");
	require(stdout === "" && stderr === "", "callback probe caller-load output");
	const cases = [];
	for(const planned of input.entryProbe.cases)
	{
		const outputStart = stdout.length, traceStart = stderr.length;
		await run(`<?php echo json_encode(lean_bridge_callback_probe(${JSON.stringify(planned.control)}), JSON_THROW_ON_ERROR) . "\\n";`);
		const output = stdout.slice(outputStart), trace = stderr.slice(traceStart);
		require(output.endsWith("\n") && output.slice(0, -1).split("\n").length === 1
			, "callback probe control output");
		const result = JSON.parse(output);
		exact(result, ["control", "outcome"], "callback control result");
		require(result.control === planned.control && result.outcome === planned.outcome
			, "callback control outcome differs");
		const calls = parsePhpWasmCallbackEntryTrace(trace, input.entryProbe.selected);
		require(same(calls, planned.calls), `callback trace differs: ${planned.control}: `
			+ JSON.stringify({ actual: calls, expected: planned.calls }));
		cases.push({ control: planned.control, outcome: planned.outcome, trace, calls });
	}
	const observation = { controls: cases.length
		, accepted: cases.filter(item => item.outcome === "accepted").length
		, refused: cases.filter(item => item.outcome === "refused").length };
	phases.push({ stage: "complete", libraries: [...libraries] });
	return { phases, observation
		, entryProbe: {
			scope: input.entryProbe.scope
			, family: input.entryProbe.family
			, controls
			, cases
		}
	};
};
