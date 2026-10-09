/**
 * Keep the seven-host FinContainers entry counters wired into the hosted consumer jobs (VO #1438): every selection
 * runs counted, records the counted command, keeps its enforced outcome and budget, and passes a report gate that a
 * skipped, unobserved, partial or relabelled report cannot pass.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertFinContainerEntryCiReport, assertFinContainerEntryWorkflow, disableFinContainerEntryWorkflow, enableFinContainerEntryWorkflow, finContainerEntryCiBlock, finContainerEntryCiChecker, finContainerEntryCiFlag, finContainerEntryCiInvocation, finContainerEntryCiSelections } from "./helpers/fin-container-entry-ci.mjs";
import { finContainerEntryExpected } from "./helpers/fin-container-entry-dispatch.mjs";

const workflow = () => readFile(".github/workflows/consumer-matrix.yml", "utf8");
const selection = report => finContainerEntryCiSelections.find(item => item.report === report);

test("every selected installed host runs counted, records that command and gates both route reports", async () => {
	const text = await workflow();
	assertFinContainerEntryWorkflow(text);
	// The wiring is exactly the counters: removing it restores the uncounted workflow, which no longer passes.
	const uncounted = disableFinContainerEntryWorkflow(text);
	assert.equal(enableFinContainerEntryWorkflow(uncounted), text);
	assert.throws(() => assertFinContainerEntryWorkflow(uncounted), assert.AssertionError);
	assert.deepEqual(finContainerEntryCiSelections.map(item => item.report), ["php-native", "c-cpp", "dotnet", "java-kotlin", "ruby", "wit-wasi"]);
});

test("the workflow gate refuses a missing flag, recorded command, profile, route, report gate or enforcement", async () => {
	const text = await workflow();
	const jvm = selection("java-kotlin"), cpp = selection("c-cpp"), wit = selection("wit-wasi");
	const mutations = [
		// A missing flag on one step, or on one recorded command.
		value => value.replace(`          ${finContainerEntryCiInvocation(jvm)}\n`, `          ${finContainerEntryCiInvocation(jvm).replace(`${finContainerEntryCiFlag} `, "")}\n`)
		, value => value.replace(`&& ${finContainerEntryCiInvocation(cpp)}`, `&& ${finContainerEntryCiInvocation(cpp).replace(`${finContainerEntryCiFlag} `, "")}`)
		// A missing recorded command, and an extra uncounted run beside the counted one.
		, value => value.replace(`consumer_command="$consumer_command && ${finContainerEntryCiInvocation(jvm)}"`, "consumer_command=\"$consumer_command\"")
		, value => value.replace(finContainerEntryCiBlock(wit), `${finContainerEntryCiBlock(wit)}          ${finContainerEntryCiInvocation(wit).replace(`${finContainerEntryCiFlag} `, "")}\n`)
		// A removed profile, a removed route report and a removed report gate.
		, value => value.replaceAll("LEAN_BRIDGE_FIN_CONTAINER_PROFILES=java,kotlin LEAN_BRIDGE_REVIEWED_FIN_CONTAINER_PROFILES=java,kotlin", "LEAN_BRIDGE_FIN_CONTAINER_PROFILES=java LEAN_BRIDGE_REVIEWED_FIN_CONTAINER_PROFILES=java")
		, value => value.replace("          test -s build/native-fin-containers/reviewed-dotnet.json\n", "")
		, value => value.replace(`          node ${finContainerEntryCiChecker} ruby build/native-fin-containers/ruby.json build/native-fin-containers/reviewed-ruby.json\n`, "")
		// The debugger setting, its installation, an enforced outcome, a budget and the step's failure mode.
		, value => value.replace(`${finContainerEntryCiFlag} LEAN_BRIDGE_GDB=/usr/bin/gdb LEAN_BRIDGE_FIN_CONTAINER_PROFILES=ruby`, `${finContainerEntryCiFlag} LEAN_BRIDGE_FIN_CONTAINER_PROFILES=ruby`)
		, value => value.replace("          sudo apt-get install -y python3-venv pkg-config gdb\n", "          sudo apt-get install -y python3-venv pkg-config\n")
		, value => value.replace("steps.type_corpus_jvm.outcome != 'success'", "steps.type_corpus_jvm.outcome == 'skipped'")
		, value => value.replace("        id: type_corpus_ruby\n", "        id: type_corpus_ruby_counted\n")
		, value => value.replace(/(\n {2}wasi-consumer:\n(?:.*\n)*? {4}timeout-minutes: )240\n/u, "$1300\n")
		, value => value.replace(finContainerEntryCiBlock(cpp), `          set +e\n${finContainerEntryCiBlock(cpp)}`)
		// Counting widened to an unselected host.
		, value => value.replace("&& LEAN_BRIDGE_FIN_CONTAINER_PROFILES=python LEAN_BRIDGE_REVIEWED_FIN_CONTAINER_PROFILES=python", `&& ${finContainerEntryCiFlag} LEAN_BRIDGE_FIN_CONTAINER_PROFILES=python LEAN_BRIDGE_REVIEWED_FIN_CONTAINER_PROFILES=python`)
	];
	for(const [index, mutate] of mutations.entries())
	{
		const value = mutate(text);
		assert.notEqual(value, text, `mutation ${index} applies`);
		assert.throws(() => assertFinContainerEntryWorkflow(value), assert.AssertionError, `mutation ${index}`);
	}
});

// Actual installed reports: the local seven-host archive and the retained reviewed C container report. Only the
// reviewed C report exists, so c,cpp is exercised on that route.
const archive = "docs/evidence/fin-container-entry-20261009";
const located = {
	cpp: ["cpp-php/cpp-php-native.json", 0]
	, "php-native": ["cpp-php/cpp-php-native.json", 1]
	, ruby: ["ruby-wit/ruby-wit-wasi.json", 0]
	, "wit-wasi": ["ruby-wit/ruby-wit-wasi.json", 1]
	, dotnet: ["dotnet/dotnet.json", 0]
	, java: ["jvm/java-kotlin.json", 0]
	, kotlin: ["jvm/java-kotlin.json", 1]
};
const json = async path => JSON.parse(await readFile(path, "utf8"));
/**
 * One CI selection's route report, assembled from the actual installed report entries of its hosts.
 *
 * @param profiles - The selection's hosts.
 * @param route - Route: ordinary-source or reviewed-ir.
 */
const actual = async (profiles, route) => {
	const reports = [];
	for(const profile of profiles)
	{
		if(profile === "c")
		{
			assert.equal(route, "reviewed-ir");
			reports.push((await json("docs/evidence/reviewed-fin-20261007/containers.json")).reports.find(item => item.profile === "c"));
			continue;
		}
		const [file, index] = located[profile];
		reports.push((await json(`${archive}/${route === "reviewed-ir" ? file.replace(/\/(?=[^/]+$)/u, "/reviewed-") : file}`)).reports[index]);
	}
	return { schemaVersion: 1, reproducible: true, archives: {}, reports };
};
const routes = selection => (selection.profiles.includes("c") ? ["reviewed-ir"] : ["ordinary-source", "reviewed-ir"]);

test("the report gate accepts the actual installed reports of all seven hosts in their CI selections", async () => {
	let hosts = 0;
	for(const item of finContainerEntryCiSelections) for(const route of routes(item))
	{
		const value = await actual(item.profiles, route);
		assert.deepEqual(value.reports.map(report => [report.profile, report.path]), item.profiles.map(profile => [profile, route]));
		assertFinContainerEntryCiReport(value, item.profiles, route);
		hosts += item.counted.length;
	}
	assert.equal(hosts, 13, "seven hosts, six of them on both routes and cpp on the reviewed C selection");
});

/**
 * Name another installed library as every column's definer, consistently for both callers and every breakpoint.
 *
 * @param dispatch - One counted host's dispatch section.
 * @param name - An installed library other than the component.
 */
const relabel = (dispatch, name) => {
	const installed = Object.keys(dispatch.libraries.sha256 ?? dispatch.libraries.files).map(path => path.replace(/^lib\//u, ""));
	assert.ok(installed.includes(name), `${name} is installed`);
	for(const caller of [dispatch.public, dispatch.rawAdapter]) caller.definers = Array(10).fill(name);
	for(const point of dispatch.public.breakpoints ?? []) point.library = name;
};

test("the report gate refuses unobserved, partial, relabelled or foreign-bound reports", async () => {
	const zero = "0".repeat(64);
	const mutations = [
		// An unobserved report, as an uncounted run writes it, and a missing dispatch.
		[["c", "cpp"], value => { value.reports[1].dispatch = { observed: false, reason: "counted in the C package, whose adapter this host's bundled library shares" }; }]
		, [["dotnet"], value => { delete value.reports[0].dispatch; }]
		// C must keep its own observed dispatch: missing, unobserved, altered rows or relabelled as counted.
		, [["c", "cpp"], value => { delete value.reports[0].dispatch; }]
		, [["c", "cpp"], value => { value.reports[0].dispatch = { observed: false, reason: "not counted" }; }]
		, [["c", "cpp"], value => { value.reports[0].dispatch.observed[2][1] = 0; }]
		, [["c", "cpp"], value => { value.reports[0].dispatch.columns.reverse(); }]
		, [["c", "cpp"], value => { value.reports[0].dispatch = value.reports[1].dispatch; }]
		// A removed, reordered, duplicated or extra host, a swapped route and a skipped host.
		, [["java", "kotlin"], value => { value.reports.pop(); }]
		, [["java", "kotlin"], value => { value.reports.reverse(); }]
		, [["java", "kotlin"], value => { value.reports[1] = structuredClone(value.reports[0]); }]
		, [["ruby"], value => { value.reports.push(structuredClone(value.reports[0])); }]
		, [["ruby"], value => { value.reports[0].path = "reviewed-ir"; }]
		, [["wit-wasi"], value => { value.reports[0].checks = 0; }]
		// Rows, columns, kind, component and instruments that differ from the measured component.
		, [["php-native"], value => { value.reports[0].dispatch.public.observed = value.reports[0].dispatch.public.observed.slice(1); }]
		, [["php-native"], value => { value.reports[0].dispatch.rawAdapter.observed = finContainerEntryExpected; }]
		, [["dotnet"], value => { value.reports[0].dispatch.columns = [...value.reports[0].dispatch.columns].reverse(); }]
		, [["dotnet"], value => { value.reports[0].dispatch.kind = "fin-dispatch-v1"; }]
		, [["dotnet"], value => { value.reports[0].dispatch.componentId = "FinContainers.Api@1.0.0"; }]
		, [["dotnet"], value => { value.reports[0].dispatch.public.instrument = "LD_PRELOAD"; }]
		// Missing or false refusal flags, a swapped probe and a host caller on the raw section.
		, [["dotnet"], value => { value.reports[0].dispatch.public.staleRecordRefused = false; }]
		, [["ruby"], value => { delete value.reports[0].dispatch.public.foreignRootRefused; }]
		, [["java", "kotlin"], value => { value.reports[1].dispatch.public.preloadedCopiesRefused = false; }]
		, [["java", "kotlin"], value => { delete value.reports[0].dispatch.public.outsideRootRefused; }]
		, [["java", "kotlin"], value => { value.reports[0].dispatch.public.probeSha256 = value.reports[1].dispatch.public.probeSha256; }]
		, [["ruby"], value => { value.reports[0].dispatch.rawAdapter.caller = value.reports[0].dispatch.public.caller; }]
		, [["wit-wasi"], value => { value.reports[0].dispatch.public.missingInstrumentRefused = false; }]
		// Generated raw probe and interposer digests, including the public LD_PRELOAD interposer.
		, [["java", "kotlin"], value => { value.reports[0].dispatch.rawAdapter.probeSha256 = zero; }]
		, [["java", "kotlin"], value => { value.reports[1].dispatch.rawAdapter.interposerSha256 = zero; }]
		, [["php-native"], value => { value.reports[0].dispatch.public.interposerSha256 = zero; }]
		, [["c", "cpp"], value => { value.reports[1].dispatch.public.interposerSha256 = value.reports[1].dispatch.rawAdapter.probeSha256; }]
		// Definers that are missing, foreign, swapped between callers or not installed.
		, [["java", "kotlin"], value => { for(const report of value.reports) for(const caller of [report.dispatch.public, report.dispatch.rawAdapter]) caller.definers = Array(10).fill("libforeign.so"); }]
		, [["dotnet"], value => { value.reports[0].dispatch.public.definers.pop(); }]
		, [["dotnet"], value => { delete value.reports[0].dispatch.rawAdapter.definers; }]
		, [["wit-wasi"], value => { value.reports[0].dispatch.rawAdapter.definers[3] = "libforeign.so"; }]
		, [["ruby"], value => { const { definers } = value.reports[0].dispatch.public; [definers[0], definers[9]] = ["libruby.so", definers[0]]; }]
		, [["php-native"], value => { value.reports[0].dispatch.libraries.sha256 = { "libforeign.so": zero }; }]
		, [["c", "cpp"], value => { value.reports[1].dispatch.libraries.files = {}; }]
		, [["dotnet"], value => { const { sha256: digests } = value.reports[0].dispatch.libraries; digests[Object.keys(digests)[0]] = "not-a-digest"; }]
		// Another real installed library substituted consistently for the component in every binding.
		, [["java", "kotlin"], value => { for(const report of value.reports) relabel(report.dispatch, "libleanshared.so"); }]
		, [["php-native"], value => { relabel(value.reports[0].dispatch, "liblean_bridge_native.so"); }]
		, [["c", "cpp"], value => { relabel(value.reports[1].dispatch, "libfincontainers.so"); }]
		, [["ruby"], value => { relabel(value.reports[0].dispatch, "libleanshared.so"); }]
		// GDB breakpoint and extracted-hash bindings, and the debugger identity.
		, [["ruby"], value => { value.reports[0].dispatch.public.breakpoints.reverse(); }]
		, [["dotnet"], value => { value.reports[0].dispatch.public.breakpoints[0].library = "libcoreclr.so"; }]
		, [["dotnet"], value => { value.reports[0].dispatch.public.breakpoints[4].offset = "39b0"; }]
		, [["java", "kotlin"], value => { const { hashes } = value.reports[0].dispatch.public; hashes[Object.keys(hashes)[0]] = zero; }]
		, [["java", "kotlin"], value => { value.reports[1].dispatch.public.hashes = {}; }]
		, [["ruby"], value => { value.reports[0].dispatch.public.gdb = { version: "lldb", sha256: zero }; }]
		// The C++ public process identity.
		, [["c", "cpp"], value => { value.reports[1].dispatch.public.parameterNames.label = ["value0", "value1"]; }]
		, [["c", "cpp"], value => { value.reports[1].dispatch.public.repeatedColdProcess = false; }]
	];
	for(const [index, [profiles, mutate]] of mutations.entries())
	{
		const route = profiles.includes("c") ? "reviewed-ir" : "ordinary-source", value = await actual(profiles, route);
		const before = JSON.stringify(value); mutate(value);
		assert.notEqual(JSON.stringify(value), before, `mutation ${index} applies`);
		assert.throws(() => assertFinContainerEntryCiReport(value, profiles, route), assert.AssertionError, `mutation ${index}`);
	}
	// Requested sets other than a wired selection: duplicated, partial, widened or reordered hosts, and an unknown route.
	for(const [profiles, route] of [[["dotnet", "dotnet"], "ordinary-source"], [["java"], "ordinary-source"], [["cpp", "php-native"], "ordinary-source"], [["kotlin", "java"], "ordinary-source"], [["dotnet"], "relocated"]])
	{
		const value = await actual(profiles, route === "relocated" ? "ordinary-source" : route);
		assert.throws(() => assertFinContainerEntryCiReport(value, profiles, route), assert.AssertionError, `${profiles} ${route}`);
	}
});

test("the report gate command fails on a missing, skipped or unobserved route report", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-container-entry-ci-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const run = (...args) => spawnSync(process.execPath, [finContainerEntryCiChecker, ...args], { encoding: "utf8" });
	const ordinary = join(root, "dotnet.json"), reviewed = join(root, "reviewed-dotnet.json");
	await writeFile(ordinary, JSON.stringify(await actual(["dotnet"], "ordinary-source")));
	await writeFile(reviewed, JSON.stringify(await actual(["dotnet"], "reviewed-ir")));
	const accepted = run("dotnet", ordinary, reviewed);
	assert.equal(accepted.status, 0, accepted.stderr); assert.equal(accepted.stdout, "FinContainers entry counters observed for dotnet on both routes.\n");
	assert.notEqual(run("dotnet", ordinary, join(root, "missing.json")).status, 0);
	assert.notEqual(run("dotnet", reviewed, ordinary).status, 0);
	assert.notEqual(run("dotnet,ruby", ordinary, reviewed).status, 0);
	assert.notEqual(run("dotnet", ordinary).status, 0);
	const unobserved = await actual(["dotnet"], "reviewed-ir"); unobserved.reports[0].dispatch = { observed: false };
	await writeFile(reviewed, JSON.stringify(unobserved));
	assert.notEqual(run("dotnet", ordinary, reviewed).status, 0);
});
