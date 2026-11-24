/** @file Check Ruby member identity against the real Lake graph and fresh Lean object code. */
import assert from "node:assert/strict";
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { openHostProjectSource } from "../../src/build/host-project-source.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

const fixture = resolve("tests/fixtures/ruby-host-meter");
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const host = "LeanBridge.Host.Ruby", box = host + ".Box.";
const run = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env });
const diagnostic = e => [e.message, e.details?.stderr, e.details?.stdout].join("\n");

test("Ruby host imports bind the generated module, actual native symbols and both source routes", { timeout: 360_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "ruby-host-imports-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const project = join(root, "src");
	await cp(fixture, project, { recursive: true });
	await copyFile(resolve("LICENSE"), join(project, "LICENSE"));
	const capture = async () => {
		const inventory = await inspectLeanProject(project);
		return openHostProjectSource({ project, inventory, targets: ["rubygems"]
			, component: elaboratedComponent(inventory.project), leanPrefix });
	};
	const build = async () => {
		const source = await capture();
		try
		{
			const app = await mkdtemp(join(root, "objects-"));
			const compiled = { ...source, app, ir: source.projectContract.ir };
			const built = await compileHostSources({ ...compiled, target: "rubygems", environment: process.env, run });
			await source.verify();
			return { ...built, ir: source.projectContract.ir };
		} finally
		{ await source.dispose(); }
	};
	const first = await build(), { api, evidence, ir } = first;
	assert.equal(evidence.selection.hostModule, host);
	assert.deepEqual(evidence.lake.resolution.generatedImports, [host]);
	assert.deepEqual(evidence.interfaces.map(i => i.module), [host, "Workshop"]);
	assert.deepEqual(api.types[0].host.targets, ["ruby"]);
	const entry = name => api.declarations.find(d => d.source.declaration === "Workshop." + name);
	for(const [name, member] of [["make", "create"], ["identity", "identity"]])
	{
		assert.deepEqual(entry(name).source.extensions["lean-bridge.dev/host-members"], [box + member]);
		assert.deepEqual(entry(name).result, { type: { kind: "named", id: api.types[0].id }, ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
	}
	assert.deepEqual(entry("update").source.extensions["lean-bridge.dev/host-members"], [box + "getLevel", box + "setLevel"]);
	assert.ok(entry("update").effects.includes("writes-resource"));
	assert.deepEqual(entry("read").failure.errors, ["error:IO.Error", "error:RubyHostException"]);
	assert.deepEqual(entry("mapped").failure.errors, ["error:EIO.Workshop.mapped"]);
	const leaves = evidence.metadata.nativeEffectAudit.roots.flatMap(r => r.leaves).filter(l => l.module === host);
	assert.ok(leaves.some(l => l.name === box + "setLevel" && l.symbol === "lean_bridge_host_ruby_box_set_level"));
	assert.equal(evidence.reviewedSourceSha256, null);
	const replay = (selection, metadata) => reconcileHostExports({ selection, metadata, ir, component: api.component });
	assert.throws(() => replay({ ...evidence.selection, hostModule: "LeanBridge.Host.Python" }, evidence.metadata), /host import/i);
	assert.throws(() => replay({ ...evidence.selection, pythonTaskCallbacks: true }, evidence.metadata), /same runtime/u);
	const wrongSymbol = structuredClone(evidence.metadata);
	wrongSymbol.nativeEffectAudit.roots.flatMap(r => r.leaves).find(l => l.module === host).symbol = "lean_bridge_host_python_box_read";
	assert.throws(() => replay(evidence.selection, wrongSymbol), /unclassified native operation/u);
	const review = join(project, "workshop.binding-ir.json");
	await writeFile(review, canonicalJson(api));
	const checked = await build();
	assert.deepEqual(checked.api, api);
	assert.equal(checked.evidence.reviewedSourceSha256, sha256(canonicalJson(api)));
	assert.deepEqual(checked.evidence.interfaces, evidence.interfaces);
	t.diagnostic("Public IR SHA-256: " + sha256(canonicalJson(api)) + "; generated host C SHA-256: " + evidence.interfaces[0].cSha256);
	const changed = structuredClone(api);
	changed.declarations.find(d => d.name === "read").source.extensions["lean-bridge.dev/host-members"] = [box + "getLevel"];
	await writeFile(review, canonicalJson(changed));
	await assert.rejects(build(), /Reviewed API differs/u);
	await mkdir(join(project, "LeanBridge/Host"), { recursive: true });
	await writeFile(join(project, "LeanBridge/Host/Ruby.lean"), "def unrelated : Nat := 1\n");
	// Lake needs to know that a source package claims this module.
	const lake = join(project, "lakefile.toml");
	await writeFile(lake, (await readFile(lake, "utf8")) + '\n[[lean_lib]]\nname = "LeanBridge"\n');
	await assert.rejects(capture(), e => /shadowed generated host module/u.test(diagnostic(e)));
	t.diagnostic("Checked constructor, mutable property, method, owned result and mapped EIO; rejected cross-host symbol, stale review and source shadow.");
});
