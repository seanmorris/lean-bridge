/** @file Exercise immediate Lean pulls through relocated native consumer packages. */
import assert from "node:assert/strict";
import { access, appendFile, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runEffectConsumers, runNativeTool } from "./native-effect-consumers.mjs";
import { exerciseJvmCursors } from "./native-immediate-jvm.mjs";
import { exercisePerlCursors } from "./native-immediate-perl.mjs";

const fixture = resolve("tests/fixtures/native-immediate-cursor");
const target = process.env.LEAN_BRIDGE_IMMEDIATE_TARGET ?? "c";
const profiles = {c: "native-c-io-v1", cpp: "native-cpp-io-v1", cargo: "native-rust-io-v1", rubygems: "native-ruby-io-v1", "php-native": "native-php-io-v1", maven: "native-jvm-io-v1", cpan: "native-perl-io-v1"};
if(!Object.hasOwn(profiles, target)) throw new Error("Unsupported immediate cursor consumer: " + target);
const json = async file => JSON.parse(await readFile(file, "utf8"));
const check = async (handoff, ordinary) => {
	const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(handoff, "package-set-receipt.json")});
	const api = await json(join(handoff, "binding-ir.json"));
	const evidence = await json(join(handoff, "host-export-evidence.json"));
	assert.equal(receipt.profiles[0].id, profiles[target]);
	assert.equal(evidence.reviewedSourceSha256, ordinary ? sha256(canonicalJson(ordinary)) : null);
	assert.equal(evidence.selection.synchronousIO, true);
	assert.deepEqual(evidence.selection.taskExports, []);
	assert.deepEqual(evidence.selection.asyncIterators, []);
	if(ordinary) assert.deepEqual(api, ordinary);
	const cursors = api.declarations.filter(d => d.resultMode === "iterator");
	assert.equal(cursors.length, ["maven", "cpan"].includes(target) ? 4 : 3);
	for(const decl of cursors)
	{
		assert.ok(!decl.effects.includes("async"));
		const effects = decl.source.extensions["lean-bridge.dev/native-effects-v1"];
		if(decl.source.declaration === "TicketPulls.tickets")
		{
			assert.equal(effects, undefined);
			assert.equal(decl.result.ownership, "lease");
			const step = api.errors.find(e => e.id === "error:Step.TicketPulls.tickets");
			assert.ok(decl.failure.errors.includes(step.id));
			assert.deepEqual(step.payload, decl.result.type);
		}
		else assert.deepEqual(effects, {close: ["capability:native.filesystem"]});
	}
	return {receipt, api, report: {receiptSha256: result.receiptSha256}};
};
test(target + " installs pull immediate Lean iterators without a poller", async t => {
	if(installed.cmakeProject)
		await runNativeTool(process.env.LEAN_BRIDGE_CMAKE ?? process.env.LEAN_BRIDGE_C_TASK_CMAKE ?? "cmake", ["--version"], fixture, process.env);
	const root = await mkdtemp(join(tmpdir(), "lean-direct-c-"));
	t.after(() => rm(root, {recursive: true, force: true}));
	let ordinary;
	for(const route of ["ordinary", "reviewed"])
	{
		const dir = join(root, target, route), source = join(dir, "source"), output = join(dir, "handoff");
		await mkdir(source, {recursive: true});
		for(const name of ["Dials.lean", "lean-toolchain", "lakefile.toml", "lean-bridge.exports.json"])
			await copyFile(join(fixture, name), join(source, name));
		const config = join(source, "lean-bridge.exports.json");
		const cfg = await json(config);
		if(["maven", "cpan"].includes(target))
		{
			await copyFile(join(fixture, "TicketPulls.lean"), join(source, "TicketPulls.lean"));
			await appendFile(join(source, "lakefile.toml"), '\n[[lean_lib]]\nname = "TicketPulls"\n');
			cfg.modules.push("TicketPulls");
			cfg.resources = ["TicketPulls.Ticket"];
			cfg.exports.push("TicketPulls.issue", "TicketPulls.readTicket", "TicketPulls.tickets", "TicketPulls.closedTickets");
			cfg.iterators.push({open: "TicketPulls.tickets", next: "TicketPulls.nextTicket", close: "TicketPulls.closeTicket"});
		}
		if(target !== "c") cfg.targets = {[target]: {name: target === "php-native" ? "example/dials" : target === "maven" ? "org.example:dials" : "dials", version: "1.0.0"}};
		if(target === "cpan") cfg.targets = {cpan: {module: "LeanBridge::Dials", version: "0.001"}};
		if(ordinary)
		{
			delete cfg.exports;
			await writeFile(join(source, "dials.binding-ir.json"), canonicalJson(ordinary));
		}
		if(target !== "c" || ordinary) await writeFile(config, canonicalJson(cfg));
		await buildCanonicalProject({projectRoot: source, targets: [target], outputRoot: output})
			.catch(e => { throw new Error(e.message + " " + JSON.stringify(e.details), {cause: e}); });
		await rm(source, {recursive: true});
		if(["maven", "cpan"].includes(target))
		{
			const {api, receipt, report} = await check(output, ordinary); ordinary ??= api;
			await (target === "maven" ? exerciseJvmCursors : exercisePerlCursors)(dir, fixture, output, receipt);
			t.diagnostic(route + ": " + report.receiptSha256);
			await rm(output, {recursive: true});
			continue;
		}
		const previous = ordinary;
		const reports = await runEffectConsumers(root, root, target, process.env, {
			...installed, routes: [route], clients: fixture, check: async handoff => {
				const result = await check(handoff, previous);
				ordinary ??= result.api;
				return result;
			}
		});
		t.diagnostic(route + ": " + reports[0].receiptSha256);
		await rm(output, {recursive: true});
	}
});
const installed = {
		cmakeProject: target === "cpp" ? join(fixture, "CMakeLists.txt") : null,
		inspectPackage: async (_, prefix) => {
			if(target === "php-native")
			{
				await access(join(prefix, "src/Internal/Cursor.php"));
				await assert.rejects(access(join(prefix, "src/Internal/Delivery.php")), {code: "ENOENT"});
				const api = await readFile(join(prefix, "src/Api.php"), "utf8");
				assert.doesNotMatch(api, /\\Amp\\|\\Revolt\\|FFI::/u);
				return;
			}
			if(target === "rubygems")
			{
				await access(join(prefix, "lib/lean_bridge/dials/sync_iterator.rb"));
				await assert.rejects(access(join(prefix, "lib/lean_bridge/dials/task_runtime.rb")), {code: "ENOENT"});
				return;
			}
			if(target === "cargo")
			{
				const api = await readFile(join(prefix, "src/lib.rs"), "utf8");
				assert.match(api, /pub use native::Cursor/u);
				assert.doesNotMatch(api, /\b(?:Task|Stream|Future)\b/u);
				return;
			}
			const header = await readFile(join(prefix, "include/lbc_dials.h"), "utf8");
			assert.match(header, /lbc_dials_sequence_next\(/u);
			assert.doesNotMatch(header, /_poll\(|_take\(|_PENDING|lean_object/u);
			if(target === "cpp")
			{
				const api = await readFile(join(prefix, "include/lbc_dials.hpp"), "utf8");
				assert.match(api, /Cursor<std::uint32_t> sequence/u);
				assert.doesNotMatch(api, /coroutine|async_v2|Future|_poll\(/u);
			}
		}, checkCargoGraph: (graph, runtime) => {
			const id = graph.packages.find(p => p.name === runtime.name && p.version === runtime.version).id;
			const node = graph.resolve.nodes.find(n => n.id === id);
			assert.deepEqual(node.features, []); assert.deepEqual(node.deps, []);
			assert.ok(!graph.packages.some(p => ["futures-core", "async-io", "polling"].includes(p.name)));
		}
};
