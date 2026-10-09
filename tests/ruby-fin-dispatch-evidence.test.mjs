/**
 * Preserve the exact Ruby installed entry-counter producer and refuse wider or corrupted evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import "./helpers/ruby-dispatch-integration-source-history-tests.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import { assertRubyDispatchArchive, assertRubyDispatchDeltas, assertRubyDispatchReport, assertRubyDispatchRun, rubyDispatchArchiveDirectory, rubyDispatchArchivePaths, rubyDispatchRows, rubyDispatchSources, writeRubyDispatchArtifact } from "./helpers/ruby-fin-dispatch-evidence.mjs";

const text = name => readFile(`${rubyDispatchArchiveDirectory}/${name}`, "utf8");
const receipt = async () => {
	const bytes = await text("receipt.json");
	assert.equal(sha256(bytes), "b15f2952fcaf6e3e467a31c0faa244eeb80fd9b0498ce6fb11389691ab6f4938");
	return JSON.parse(bytes);
};

test("Ruby dispatch originals authenticate both installed routes and exactly nine producing sources", async () => {
	const record = await receipt(), paths = [];
	await assertRubyDispatchArchive(record, path => { paths.push(path); return readFile(path); }, { currentSources: false });
	assert.deepEqual([...new Set(paths)].sort(), [...rubyDispatchArchivePaths].sort());
	assert.deepEqual([record.scope.otherHosts, record.scope.hostedCi], [false, false]);
});

test("current Ruby counter sources reach the exact installed producer despite later gated-toolchain hardening", async () => {
	const paths = [];
	await assertRubyDispatchArchive(await receipt(), path => { paths.push(path); return readFile(path); });
	assert.deepEqual([...new Set(paths)].sort(), [...rubyDispatchArchivePaths, ...Object.keys(rubyDispatchSources)].sort());
});

test("Ruby run records refuse missing selections, skips, failures, other source identities and unavailable instrumentation", async () => {
	const files = { queue: await text("queue.json"), tap: await text("run.tap"), end: await text("end.txt") };
	assertRubyDispatchRun(files);
	const queue = mutate => {
		const copy = JSON.parse(files.queue); mutate(copy);
		return { ...files, queue: JSON.stringify(copy) };
	};
	const refused = {
		skipped: { ...files, tap: files.tap.replace("ok 9 -", "ok 9 - # SKIP ") }
		, failed: { ...files, tap: files.tap.replace("ok 8 -", "not ok 8 -") }
		, todo: { ...files, tap: files.tap.replace("# pass 9", "# pass 9 # TODO") }
		, renumbered: { ...files, tap: files.tap.replace("ok 9 -", "ok 10 -") }
		, plan: { ...files, tap: files.tap.replace("1..9", "1..9\n1..9") }
		, counted: { ...files, tap: files.tap.replace("# per-step source and adapter counts in the relocated Ruby process under GDB entry breakpoints\n", "") }
		, exit: { ...files, end: files.end.replace("exit=0", "exit=71") }
		, floor: { ...files, end: files.end.replace(/minFree=\d+M/u, "minFree=512M") }
		, revision: queue(copy => { copy.revision = "0".repeat(40); })
		, selection: queue(copy => { copy.selection = "tests/ruby-fin.test.mjs"; })
		, command: queue(copy => { copy.command += " --test-name-pattern=ordinary"; })
		, gate: queue(copy => { copy.environment.LEAN_BRIDGE_RUBY_FIN_TEST = "0"; })
		, glibc: queue(copy => { copy.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR = "2.38"; })
		, debugger: queue(copy => { copy.versions.gdb = "missing"; })
		, ruby: queue(copy => { copy.versions.ruby = "ruby 3.1"; })
		, source: queue(copy => { copy.sources["tests/ruby-fin.test.mjs"] = "0".repeat(64); })
		, droppedSource: queue(copy => { delete copy.sources["src/backends/ruby/verified-assets.mjs"]; })
	};
	for(const [label, changed] of Object.entries(refused)) assert.throws(() => assertRubyDispatchRun(changed), assert.AssertionError, label);
});

test("Ruby reports retain isolated relocated execution and verified entry definitions on both source routes", async () => {
	for(const [name, path] of [["ruby.json", "ordinary-source"], ["ruby-reviewed.json", "reviewed-ir"]])
	{
		const original = JSON.parse(await text(name));
		assertRubyDispatchReport(JSON.stringify(original), path);
		const changes = [
			copy => { copy.reproducible = false; }
			, copy => { copy.reports.push(copy.reports[0]); }
			, copy => { copy.reports[0].path = path === "ordinary-source" ? "reviewed-ir" : "ordinary-source"; }
			, copy => { copy.reports[0].checks--; }
			, copy => { copy.reports[0].packages[0].runtimeDelivery = "external"; }
			, copy => { copy.reports[0].packages[0].requires.push("other-runtime"); }
			, copy => { copy.reports[0].packages[0].artifacts[0].sha256 = "0".repeat(64); }
			, copy => { copy.reports[0].sharedNativeLibraries["libnative_fin.so"] = "0".repeat(64); }
			, copy => { copy.reports[0].consumerSha256 = "0".repeat(64); }
		];
		for(const flag of ["sourceRemovedBeforeInstallation", "compilerFreePath", "offlineInstall", "relocatedInstallation", "repeatExecution"])
			changes.push(copy => { copy.reports[0][flag] = false; });
		for(const field of ["configSha256", "probeSha256", "scriptSha256", "instrument", "scope", "instrumentation", "positiveControl"])
			changes.push(copy => { copy.reports[0].dispatch[field] = "unknown"; });
		for(const field of ["columns", "routes", "definers", "observed", "breakpoints"])
			changes.push(copy => { copy.reports[0].dispatch[field].pop(); });
		changes.push(copy => { copy.reports[0].dispatch.gdb.sha256 = "0".repeat(64); });
		changes.push(copy => { copy.reports[0].dispatch.breakpoints[4].offset = "0x0"; });
		changes.push(copy => { copy.reports[0].dispatch.libraries["libnative_fin.so"] = "0".repeat(64); });
		changes.push(copy => { copy.reports[0].dispatch.observed[2][2][0]++; });
		changes.push(copy => { copy.reports[0].reviewedSourceSha256 = "0".repeat(64); });
		for(const [index, change] of changes.entries())
		{
			const copy = structuredClone(original); change(copy);
			assert.throws(() => assertRubyDispatchReport(JSON.stringify(copy), path), assert.AssertionError, `${name} mutation ${index}`);
		}
	}
});

test("Ruby counter deltas independently refuse rejected entries, Fin 0 entries and missed valid calls", () => {
	assertRubyDispatchDeltas(rubyDispatchRows);
	for(const [row, column, delta] of [[2, 0, 1], [3, 1, 1], [3, 4, 1], [5, 3, -1], [11, 2, -1]])
	{
		const copy = structuredClone(rubyDispatchRows);
		for(const values of copy.slice(row)) values[2][column] += delta;
		assert.throws(() => assertRubyDispatchDeltas(copy), assert.AssertionError);
	}
});

test("Ruby receipt refuses wider claims, unknown paths before reading, corrupt bytes and changed current sources", async () => {
	const original = await receipt();
	for(const change of [
		copy => { copy.scope.hostedCi = true; }
		, copy => { copy.scope.otherHosts = true; }
		, copy => { copy.scope.environment = "any Ruby and Linux"; }
		, copy => { copy.scope.producer = "50d1163 produced this installed run"; }
		, copy => { copy.artifacts[0].originalPath = "build/other.json"; }
		, copy => { copy.artifacts[0].sha256 = "0".repeat(64); }
		, copy => { copy.artifacts[0].bytes++; }
		, copy => { copy.artifacts.push(copy.artifacts[0]); }
	]) {
		const copy = structuredClone(original); change(copy);
		await assert.rejects(() => assertRubyDispatchArchive(copy, path => readFile(path), { currentSources: false }), assert.AssertionError);
	}
	for(const path of ["/etc/hostname", `${rubyDispatchArchiveDirectory}/../../../package.json`, `${rubyDispatchArchiveDirectory}/extra.txt`])
	{
		const copy = structuredClone(original); copy.artifacts[0].path = path;
		let reads = 0;
		await assert.rejects(() => assertRubyDispatchArchive(copy, async () => { reads++; return Buffer.alloc(0); }), assert.AssertionError);
		assert.equal(reads, 0);
	}
	for(const path of [rubyDispatchArchivePaths[0], "src/backends/ruby/verified-assets.mjs"])
		await assert.rejects(() => assertRubyDispatchArchive(original, async candidate => {
			const bytes = await readFile(candidate);
			return candidate === path ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}), assert.AssertionError);
});

test("Ruby archive writer preserves identical bytes and refuses replacement", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-dispatch-archive-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const path = join(root, "nested", "receipt.json");
	await writeRubyDispatchArtifact(path, Buffer.from("one\n"));
	await writeRubyDispatchArtifact(path, Buffer.from("one\n"));
	await assert.rejects(() => writeRubyDispatchArtifact(path, Buffer.from("two\n")), assert.AssertionError);
	assert.equal(await readFile(path, "utf8"), "one\n");
});

test("Ruby archiver parses check and source options before attempting to read originals", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-dispatch-cli-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const script = resolve("scripts/archive-ruby-fin-dispatch-evidence.mjs");
	const missing = spawnSync(process.execPath, [script, "--check", `--from=${root}`], { cwd: root, encoding: "utf8" });
	assert.equal(missing.status, 1);
	assert.match(missing.stderr, /ENOENT/u); assert.match(missing.stderr, /queue\.json/u);
	assert.doesNotMatch(missing.stderr, /TypeError/u);
	const unknown = spawnSync(process.execPath, [script, "--invalid"], { cwd: root, encoding: "utf8" });
	assert.equal(unknown.status, 1); assert.match(unknown.stderr, /Only --check and --from=/u);
});
