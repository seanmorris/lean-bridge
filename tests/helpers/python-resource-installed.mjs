/**
 * Build and install independently packaged Lean resources with native CPython IO and tasks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { appendFile, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { generatePythonHostExtension } from "../../src/backends/python/host-exports.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { prepareLeaseProject, verifyLeaseModel } from "./native-lease-project.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" };
const json = async file => JSON.parse(await readFile(file, "utf8"));
const build = env.LEAN_BRIDGE_PYTHON_LEASE_BUILD;
const roleSelection = env.LEAN_BRIDGE_PYTHON_LEASE_ROLE;
test("Python resource types carry their source identity into the stubs without exposing lease handles", async () => {
	const name = "Ticket", lean = "Shared." + name, id = "lean:" + lean, digest = "a".repeat(64);
	const definition = { id, kind: "resource", host: null
		, resource: { kindId: "resource:" + lean + "/" + digest }
		, source: { declaration: lean, extensions: { "lean-bridge.dev/resource-identity": digest } } };
	const t = { kind: "named", id };
	const entry = { name: "issue", declaration: "Desk.issue", parameters: [], result: t, effect: "IO" };
	const options = { module: "Desk", entries: [entry], synchronousIO: true
		, runtimeIdentity: digest, componentIdentity: digest
		, leanResources: [definition], ledgerId: digest };
	const { stub, python } = generatePythonHostExtension(options);
	assert.ok(stub.includes('def _lean_resource_kind(self) -> _Literal["' + digest + '"]'));
	assert.match(stub, /def issue\(\) -> Ticket:/u); assert.doesNotMatch(stub, /ctypes|capsule|handle:/iu);
	assert.match(python, /from \._native import Ticket/u);
	assert.throws(() => generatePythonHostExtension({ ...options, ledgerId: null }), /resource ledger identity/u);
	const failures = [t, { kind: "primitive", name: "string" }].map((error, i) => ({
		...entry, effect: "EIO", name: "check_" + i
		, declaration: "Desk.check" + i, error }));
	assert.match(generatePythonHostExtension({ ...options, entries: failures }).stub, /payload: Ticket \| str/u);
	const guide = (await readFile("docs/consume/python.md", "utf8")).split("### Share a Lean resource across packages\n")[1];
	assert.equal(guide.match(/\x60{3}python\n([\s\S]*?)\x60{3}/u)[1], await readFile(join(cases, "example.py"), "utf8"));
	const author = (await readFile("docs/publish/pypi.md", "utf8")).split("## Export a shared Lean resource\n")[1];
	const sample = JSON.parse(author.match(/\x60{3}json\n([\s\S]*?)\x60{3}/u)[1]);
	await assertJsonSchema("lean-export-configuration", sample); validateExportConfiguration(sample);
	assert.deepEqual(sample.resources, ["Shared.Ticket"]);
	for(const path of ["package.json", "config/cli-package.v1.json", "nix/perl-engine-source-boundary.json"])
	{
		const manifest = await json(path), files = manifest.files ?? manifest.includedFiles;
		for(const f of ["src/backends/python/resource-lease.h", "src/backends/python/resource-loader.py", "src/build/task-resource-ledger.mjs"])
			assert.ok(files.includes(f), path + ": " + f);
	}
});
test("compiler-selected Python IO and task wheels share a nominal Lean resource", { skip: !build, timeout: 3_600_000 }, async t => {
	const root = resolve(build);
	const routes = env.LEAN_BRIDGE_PYTHON_LEASE_ROUTE ? [env.LEAN_BRIDGE_PYTHON_LEASE_ROUTE] : ["ordinary", "lookalike", "reviewed"];
	if(roleSelection) assert.ok(["desk", "depot"].includes(roleSelection) && !(routes.includes("lookalike") && roleSelection === "depot"));
	for(const route of routes)
	{
		assert.ok(["ordinary", "reviewed", "lookalike"].includes(route));
		for(const role of route === "lookalike" ? ["desk"] : ["desk", "depot"])
		{
			if(roleSelection && role !== roleSelection) continue;
			const { src, dir } = await prepareLeaseProject(root, route, role, "pypi");
			const outputRoot = join(dir, "handoff");
			await buildCanonicalProject({ projectRoot: src, outputRoot, targets: ["pypi"], environment: env })
				.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
			const api = await json(join(outputRoot, "binding-ir.json")), evidence = await json(join(outputRoot, "host-export-evidence.json"));
			verifyLeaseModel(api, evidence, role === "depot");
			if(route === "reviewed") assert.deepEqual(api, await json(join(src, "public.binding-ir.json")));
			t.diagnostic("built " + route + "/" + role);
		}
	}
});

const cases = resolve("tests/fixtures/python-task-resources");
const fixtures = ["installed.py", "observe.py", "example.py", "verify_install.py"];
const staticCheck = async (work, installed, tag) => {
	const checker = env.LEAN_BRIDGE_PYTHON_LEASE_MYPY, clients = {};
	for(const f of ["typed.py", "wrong_types.py"])
	{
		const bytes = await readFile(join(cases, f)); clients[f] = sha256(bytes);
		await writeFile(join(work, f), bytes, { flag: "wx" });
	}
	const version = tag === "cpython-311" ? "3.11" : "3.12";
	const flags = ["--strict", "--no-incremental", "--cache-dir=/dev/null"
		, "--no-pretty", "--no-error-summary"
		, "--show-error-codes", "--config-file=", "--python-version", version];
	const config = { cwd: work, env: { ...env, MYPYPATH: installed, MYPY_NUM_WORKERS: "1" }, timeout: 180_000 };
	const exec = promisify(execFile), checkerVersion = (await exec(checker, ["--version"], config)).stdout.trim();
	assert.equal((await exec(checker, [...flags, "typed.py"], config)).stdout.trim(), "");
	const wrong = await readFile(join(work, "wrong_types.py"), "utf8");
	const expected = wrong.split("\n").flatMap((s, i) => s.includes("  # ") ? [i+1] : []);
	let errors;
	await assert.rejects(exec(checker, [...flags, "wrong_types.py"], config), e => {
		assert.equal(e.code, 1);
		const lines = e.stdout.split("\n").filter(l => l.includes(": error: "));
		errors = lines.map(line => {
			const match = /^wrong_types\.py:(\d+): error: .*\[arg-type\]$/u.exec(line);
			assert.ok(match, line); return Number(match[1]);
		});
		assert.deepEqual(errors, expected); assert.equal(errors.length, 3); return true;
	});
	return { checkerVersion, clients, rejectedArgumentLines: errors };
};
const inspect = async (root, route, role) => {
	const dir = join(root, route, role, "handoff"), task = role === "depot";
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
	const component = receipt.packages.find(p => p.role === "component"), runtime = receipt.packages.find(p => p.role === "runtime");
	assert.equal(receipt.packages.length, 2); assert.equal(component.runtimeDelivery, "dependency"); assert.equal(runtime.runtimeDelivery, "provided");
	assert.equal(component.profile, task ? "native-python-task-v1" : "native-python-io-v1");
	assert.equal(component.name, route === "lookalike" ? "other-desk" : "lease-" + role);
	assert.equal(component.version, "1.0.0"); assert.equal(runtime.name, "lean-bridge-host-runtime");
	assert.deepEqual(component.requires, [{ ecosystem: "pypi", name: runtime.name, version: runtime.version }]);
	const api = await json(join(dir, "binding-ir.json")), evidence = await json(join(dir, "host-export-evidence.json"));
	const { nominal, entries } = verifyLeaseModel(api, evidence, task);
	assert.equal(hashBindingIr(api), receipt.profiles[0].bindingIrSha256);
	assert.equal(evidence.sourceTreeSha256, receipt.source.treeSha256); assert.equal(Boolean(evidence.reviewedSourceSha256), route === "reviewed");
	const proof = { route, role, name: component.name, profile: component.profile
		, component: component.artifacts[0], runtime: runtime.artifacts[0]
		, runtimeIdentity: component.runtimeIdentity
		, runtimePackageVersion: runtime.version, nominal: nominal.resource.kindId
		, sourceTreeSha256: evidence.sourceTreeSha256
		, bindingIrSha256: hashBindingIr(api)
		, reviewedSourceSha256: evidence.reviewedSourceSha256
		, receiptSha256: result.receiptSha256 };
	return { dir, api, evidence, entries, proof };
};
const second = env.LEAN_BRIDGE_PYTHON_LEASE_INDEPENDENT;
test("independent Python producer roots make byte-identical resource wheels", { skip: !second }, async () => {
	const first = resolve(env.LEAN_BRIDGE_PYTHON_LEASE_ORIGINAL), other = resolve(second);
	assert.notEqual(first, other);
	const a = await inspect(first, "ordinary", "desk"), b = await inspect(other, "ordinary", "desk");
	assert.deepEqual(a.proof, b.proof);
	assert.deepEqual(a.evidence, b.evidence);
	if(env.LEAN_BRIDGE_PYTHON_LEASE_REPRO_RESULT)
	{
		const { receiptSha256, sourceTreeSha256, component, runtime } = a.proof;
		await writeFile(env.LEAN_BRIDGE_PYTHON_LEASE_REPRO_RESULT, canonicalJson({ receiptSha256, sourceTreeSha256, component, runtime }), { flag: "wx" });
	}
});
const compareGenerator = async (pkg, lib, module) => {
	const { api, entries, evidence, proof } = pkg;
	const options = { ir: null, entries, module: module.module
		, modules: evidence.selection.exportModules
		, leanResources: api.types.filter(t => t.kind === "resource")
		, ledgerId: module.resourceLedger.identity
		, runtimeIdentity: proof.runtimeIdentity
		, synchronousIO: proof.role === "desk" };
	const skeleton = generatePythonHostExtension({ ...options, componentIdentity: "0".repeat(64) });
	const leaseLoader = await readFile("src/backends/python/resource-loader.py");
	const identity = { sourceTreeSha256: proof.sourceTreeSha256, skeleton
		, tag: module.tag, runtimePackageVersion: proof.runtimePackageVersion
		, provenance: evidence, resourceLedger: options.ledgerId
		, loader: sha256(leaseLoader) };
	assert.equal(module.componentIdentity, sha256(canonicalJson(identity)));
	const generated = generatePythonHostExtension({ ...options, componentIdentity: module.componentIdentity });
	assert.equal(await readFile(join(lib, "__init__.pyi"), "utf8"), generated.stub);
	assert.ok((await readFile(join(lib, "__init__.py"), "utf8")).includes(generated.python));
};

// Fast feedback on stub changes from real, previously checked signatures.
// This is not a substitute for checking the stubs installed by pip below.
const preview = env.LEAN_BRIDGE_PYTHON_LEASE_STUB_PREFLIGHT;
test("type-check candidate resource stubs before rebuilding native wheels", { skip: !preview, timeout: 300_000 }, async t => {
	const root = resolve(preview), work = await mkdtemp(join(tmpdir(), "python-resource-stubs-"));
	t.after(() => rm(work, { recursive: true, force: true }));
	const site = join(work, "types");
	for(const [route, role] of [["ordinary", "desk"], ["ordinary", "depot"], ["lookalike", "desk"]])
	{
		const { proof, api, entries, evidence } = await inspect(root, route, role);
		const dir = join(site, proof.name.replaceAll("-", "_"));
		const modules = evidence.selection.exportModules;
		const options = { ir: null, entries, module: modules[0], modules
			, leanResources: api.types.filter(t => t.kind === "resource")
			, ledgerId: "0".repeat(64), runtimeIdentity: proof.runtimeIdentity
			, componentIdentity: "0".repeat(64), synchronousIO: role === "desk" };
		const { stub } = generatePythonHostExtension(options);
		await mkdir(dir, { recursive: true }); await writeFile(join(dir, "__init__.pyi"), stub, { flag: "wx" });
	}
	const checks = await staticCheck(work, site, "cpython-311");
	t.diagnostic(checks.checkerVersion + ": accepted typed exchange and caught payloads; rejected three incompatible calls");
});

const capture = env.LEAN_BRIDGE_PYTHON_LEASE_CAPTURE, replay = env.LEAN_BRIDGE_PYTHON_LEASE_REPLAY;
const terminal = env.LEAN_BRIDGE_PYTHON_STREAM_TERMINAL_ORIGINAL;
test("installed, relocated Python wheels share exact Lean resource types through IO, asyncio tasks and streams", {
	skip: !capture && !replay && !terminal, timeout: 3_600_000
}, async t => {
	const root = resolve(terminal ?? replay ?? capture), python = env.LEAN_BRIDGE_PYTHON ?? "python3";
	const tag = await run(python, ["-I", "-c", "import sys; print(sys.implementation.cache_tag)"], root, env);
	assert.ok(["cpython-311", "cpython-312"].includes(tag));
	const work = await mkdtemp(join(tmpdir(), "installed-python-resources-"));
	t.after(() => rm(work, { recursive: true, force: true }));
	const clients = {};
	for(const f of fixtures)
	{
		const from = join(replay || terminal ? root : cases, f);
		clients[f] = sha256(await readFile(from)); await copyFile(from, join(work, f), constants.COPYFILE_EXCL);
	}
	const terminalFile = join(work, "terminal.py"), terminalRows = [];
	if(!replay) await copyFile(join(cases, "terminal.py"), terminalFile, constants.COPYFILE_EXCL);
	let prior;
	if(terminal)
	{
		prior = (await json(resolve("docs/evidence/python-resource-leases-20261123.json"))).interpreters[tag];
		const bytes = await readFile(join(root, "acceptance.json"));
		assert.equal(sha256(bytes), prior.acceptanceSha256); assert.deepEqual(JSON.parse(bytes), prior.installed);
		assert.deepEqual(clients, prior.installed.clients);
	}
	const rows = [], staticResults = [];
	for(const route of ["ordinary", "reviewed"])
	{
		const pkgs = [];
		for(const [r, role] of [[route, "desk"], [route, "depot"], ["lookalike", "desk"]]) pkgs.push(await inspect(root, r, role));
		if(terminal) assert.deepEqual(pkgs.map(p => p.proof), prior.installed.rows.find(r => r.route === route).packages);
		const [desk, depot, other] = pkgs.map(p => p.proof);
		assert.equal(desk.nominal, depot.nominal); assert.notEqual(desk.nominal, other.nominal);
		const base = join(work, route), feed = join(base, "feed"), stage = join(base, "target"), installed = join(base, "relocated");
		await mkdir(feed, { recursive: true });
		const archives = new Map(), names = pkgs.map(p => p.proof.name);
		for(const { dir, proof } of pkgs)
		{
			assert.deepEqual(proof.runtime, desk.runtime);
			for(const a of [proof.component, proof.runtime])
			{
				const n = basename(a.path);
				if(archives.has(n))
				{
					assert.equal(archives.get(n), a.sha256); continue;
				}
				await copyFile(join(dir, a.path), join(feed, n), constants.COPYFILE_EXCL); archives.set(n, a.sha256);
			}
		}
		const install = ["-I", "-m", "pip", "--isolated"
			, "--disable-pip-version-check"
			, "install", "--no-index", "--no-compile", "--no-cache-dir"
			, "--only-binary", ":all:", "--target", stage, "--find-links", feed
			, ...names.map(n => n + "==1.0.0")];
		await run(python, install, work, env);
		const wheels = [...archives.keys()].map(n => join(feed, n));
		const check = ["-I", "-B", join(work, "verify_install.py"), stage, ...wheels];
		const verified = JSON.parse(await run(python, check, work, env));
		assert.deepEqual(Object.keys(verified).sort(), [...archives.keys()].sort());
		await rename(stage, installed); await rm(feed, { recursive: true });
		const isolated = { PATH: "/unavailable", PYTHONPATH: installed, PYTHONNOUSERSITE: "1", LEAN_NUM_THREADS: "1", PYTHONFAULTHANDLER: "1" };
		const invoke = args => run(python, ["-S", "-B", "-W", "error", ...args], work, isolated, 180_000);
		let ledger;
		for(const pkg of pkgs)
		{
			const lib = join(installed, pkg.proof.name.replaceAll("-", "_")), module = await json(join(lib, "host-component.json"));
			assert.equal(module.bindingIrSha256, pkg.proof.bindingIrSha256); assert.equal(module.runtimeIdentity, pkg.proof.runtimeIdentity);
			assert.equal(module.tag, tag.replace("cpython-", "cp") + "-" + tag.replace("cpython-", "cp") + "-linux_x86_64");
			assert.equal(module.resourceLedger.name, "liblb_task_resources_" + module.resourceLedger.identity + ".so");
			assert.equal(sha256(await readFile(join(lib, module.resourceLedger.name))), module.resourceLedger.sha256);
			if(ledger) assert.deepEqual(module.resourceLedger, ledger); else ledger = module.resourceLedger;
			if((!replay && !terminal) || env.LEAN_BRIDGE_PYTHON_LEASE_COMPARE_SOURCES) await compareGenerator(pkg, lib, module);
		}
		if(!replay)
		{
			const orders = [["lease_desk", "lease_depot"], ["lease_depot", "lease_desk"]], calls = [];
			for(const order of orders)
			{
				const result = await invoke(["terminal.py", ...order]);
				assert.equal(result, "exhaustion and typed failure finalized before aclose; early close finalized on request; last error owner usable, zero owner and descriptor delta");
				calls.push({order, result});
			}
			terminalRows.push({route, packages: [desk, depot], verified, calls});
			if(terminal) continue;
		}
		assert.equal(await invoke(["example.py"]), "42");
		if(env.LEAN_BRIDGE_PYTHON_LEASE_MYPY) staticResults.push({ route, ...await staticCheck(base, installed, tag) });
		// A foreign definition imported first must not reserve the visible Ticket name.
		const orders = [names, [names[1], names[0], names[2]], [names[2], names[0], names[1]]]
			.map(order => order.map(n => n.replaceAll("-", "_")));
		for(const order of orders)
			assert.equal(await invoke(["installed.py", ...order]), "three components, one runtime, zero live identities, zero leaked descriptors");
		await appendFile(join(installed, "lease_desk", ledger.name), Buffer.from([0]));
		const tamper = "import lease_depot\ntry:\n import lease_desk\nexcept ImportError as e:\n assert 'resource ledger digest differs' in str(e)\nelse:\n raise AssertionError('accepted modified ledger')";
		await invoke(["-c", tamper]);
		rows.push({ route, packages: pkgs.map(p => p.proof), verified, ledger, orders });
		t.diagnostic(route + " installed consumers, native cleanup and ledger tamper passed");
	}
	const emitTerminal = async digest => {
		const report = {schemaVersion: 1, interpreter: tag
			, originalAcceptanceSha256: digest
			, observerSha256: clients["observe.py"]
			, clientSha256: sha256(await readFile(terminalFile)), rows: terminalRows};
		return canonicalJson(report);
	};
	if(terminal)
	{
		const out = resolve(env.LEAN_BRIDGE_PYTHON_STREAM_TERMINAL_OUTPUT ?? "build/python-stream-terminal");
		await mkdir(out, {recursive: true});
		await writeFile(join(out, tag + ".json"), await emitTerminal(prior.acceptanceSha256));
		return;
	}
	const report = { schemaVersion: 1, interpreter: tag, clients, rows };
	if(replay)
	{
		const prior = await readFile(join(root, "acceptance.json"));
		assert.deepEqual(report, JSON.parse(prior));
		if(env.LEAN_BRIDGE_PYTHON_LEASE_EXPECTED)
		{
			const pin = (await json(env.LEAN_BRIDGE_PYTHON_LEASE_EXPECTED)).interpreters[tag];
			assert.equal(sha256(prior), pin.acceptanceSha256); assert.deepEqual(report, pin.installed);
			if(staticResults.length) assert.deepEqual(staticResults, pin.staticChecks);
		}
	}
	else
	{
		for(const f of fixtures) await copyFile(join(work, f), join(root, f), constants.COPYFILE_EXCL);
		const bytes = canonicalJson(report);
		await writeFile(join(root, "acceptance.json"), bytes, { flag: "wx" });
		await writeFile(join(root, "stream-terminal.json"), await emitTerminal(sha256(bytes)), {flag: "wx"});
	}
	if(env.LEAN_BRIDGE_PYTHON_LEASE_TYPE_RESULT)
	{
		assert.equal(staticResults.length, 2);
		await writeFile(env.LEAN_BRIDGE_PYTHON_LEASE_TYPE_RESULT, canonicalJson(staticResults), { flag: "wx" });
	}
});
