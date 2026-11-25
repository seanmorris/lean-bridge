/** @file Check host member identity against the real Lake graph and fresh Lean object code. */
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
const diagnostic = e => [e.message, e.details?.stderr, e.details?.stdout].join("\n");
const run = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env });
const hosts = {
	c: { target: "c", label: "C", error: "CHostError", coordinates: {name: "workshop",version: "1.0.0"} }
	, cpp: {target: "cpp",label: "Cpp",error: "CppHostException",coordinates: {name: "workshop",version: "1.0.0"}}
	, ruby: { target: "rubygems", label: "Ruby", error: "RubyHostException" }
	, jvm: { target: "maven", label: "Jvm", error: "JvmHostException", coordinates: {name: "org.leanbridge:workshop", version: "1.0.0"} }
	, dotnet: { target: "nuget", label: "Dotnet", error: "DotNetHostException", coordinates: {name: "Workshop.Host", version: "1.0.0"} }
	, perl: { target: "cpan", label: "Perl", error: "PerlHostException", coordinates: {module: "LeanBridge::Workshop", version: "0.001"} }
	, php: { target: "php-native", label: "Php", error: "PhpHostException", coordinates: {name: "lean-bridge/workshop", version: "1.0.0"} }
	, javascript: { target: "npm", label: "Javascript", error: "JavaScriptHostException" }
};

/**
 * Prepare the same host contract for each native source-review gate.
 *
 * @param project - New directory for the test input.
 * @param backend - Compiler host target.
 */
export const prepareNativeHostFixture = async (project, backend) => {
	if(backend==="cpp")
	{
		await cp(resolve("tests/fixtures/cpp-host-workshop"),project,{recursive: true});
		return;
	}
	if(backend === "perl" || backend === "javascript")
	{
		const path=backend==="perl"?"perl-host-project":"javascript-host-meter";
		await cp(resolve("tests/fixtures",path),project,{recursive: true});
		return;
	}
	await cp(fixture, project, { recursive: true });
	if(backend === "ruby") return;
	assert.ok(Object.hasOwn(hosts, backend)); const { label, target } = hosts[backend];
	const file = join(project, "lean-bridge.hosts.json"), contract = JSON.parse(await readFile(backend==="c"?resolve("tests/fixtures/c-host-members/lean-bridge.hosts.json"):file, "utf8"));
	contract.types[0].host.targets = [backend];
	contract.types[0].documentation.summary = {c: "An application-owned C object with a read method.", cpp: "An application-owned C++ object with a read method.", jvm: "A JVM object with a read method.", dotnet: "A .NET object with a read method.", php: "A PHP object with a read method."}[backend];
	await writeFile(file, canonicalJson(contract));
	const cfg = join(project, "lean-bridge.exports.json"), config = JSON.parse(await readFile(cfg, "utf8"));
	config.targets = { [target]: hosts[backend].coordinates };
	if(["c","cpp","php"].includes(backend)) config.exports.push("Workshop.choose","Workshop.failWith");
	await writeFile(cfg, canonicalJson(config));
	const lean = join(project, "Workshop.lean");
	if(["c","cpp","php"].includes(backend))
	{
		const sample=await readFile(resolve("tests/fixtures/php-host-members/Workshop.lean"),"utf8");
		await writeFile(lean,sample.replaceAll("LeanBridge.Host.Php","LeanBridge.Host."+label));
		return;
	}
	await writeFile(lean, (await readFile(lean, "utf8")).replaceAll("LeanBridge.Host.Ruby", "LeanBridge.Host." + label));
};

/**
 * Run ordinary, reviewed and negative cases for the selected host.
 *
 * @param backend - Compiler host target.
 */
export const checkNativeHostImports = backend => {
	assert.ok(Object.hasOwn(hosts, backend)); const { label, target, error } = hosts[backend];
	const host = "LeanBridge.Host." + label, box = host + ".Box.";
	test(label + " host imports bind the generated module, actual native symbols and both source routes", { timeout: 360_000 }, async t => {
		const root = await mkdtemp(join(tmpdir(), backend + "-host-imports-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const project = join(root, "src");
		await prepareNativeHostFixture(project, backend);
		await copyFile(resolve("LICENSE"), join(project, "LICENSE"));
		const capture = async () => {
			const inventory = await inspectLeanProject(project);
			return openHostProjectSource({ project, inventory, targets: [target]
				, component: elaboratedComponent(inventory.project), leanPrefix });
		};
		const build = async () => {
			const source = await capture();
			try
			{
				const app = await mkdtemp(join(root, "objects-"));
				const compiled = { ...source, app, ir: source.projectContract.ir };
				if(["c","cpp","php"].includes(backend) && !source.projectContract.review)
				{
					const options = { ...compiled, target, environment: process.env, run: () => assert.fail("unexpected Lean invocation") };
					const original = source.projectContract;
					const mismatched = { ...original, hostImportsSource: original.hostImportsSource + " " };
					await assert.rejects(compileHostSources({ ...options, projectContract: mismatched }), /captured import source/u);
					const ir = structuredClone(compiled.ir);
					ir.types[0].host.identity = "strong-canonical";
					await assert.rejects(compileHostSources({ ...options, ir }), /captured import source/u);
				}
				const built = await compileHostSources({ ...compiled, target, environment: process.env, run });
				await source.verify();
				return { ...built, ir: source.projectContract.ir };
			} finally
			{ await source.dispose(); }
		};
		const first = await build().catch(e => { throw new Error(diagnostic(e), {cause: e}); }), { api, evidence, ir } = first;
		assert.equal(evidence.selection.hostModule, host);
		assert.deepEqual(evidence.lake.resolution.generatedImports, [host]);
		assert.deepEqual(evidence.interfaces.map(i => i.module), [host, "Workshop"]);
		assert.deepEqual(api.types[0].host.targets, [backend]);
		const entry = name => api.declarations.find(d => d.source.declaration === "Workshop." + name);
		for(const [name, member] of [["make", "create"], ["identity", "identity"]])
		{
			assert.deepEqual(entry(name).source.extensions["lean-bridge.dev/host-members"], [box + member]);
			assert.deepEqual(entry(name).result, { type: { kind: "named", id: api.types[0].id }, ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
		}
		assert.deepEqual(entry("update").source.extensions["lean-bridge.dev/host-members"], [box + "getLevel", box + "setLevel"]);
		assert.ok(entry("update").effects.includes("writes-resource"));
		assert.deepEqual(entry("read").failure.errors, ["error:IO.Error", "error:" + error]);
		assert.deepEqual(entry("mapped").failure.errors, ["error:EIO.Workshop.mapped"]);
		if(["c","cpp","php"].includes(backend))
		{
			const leased={type: {kind: "named",id: api.types[0].id},ownership: "lease",lifetime: {scope: "explicit",anchor: null}};
			assert.deepEqual(entry("failWith").source.extensions["lean-bridge.dev/error-payload-site"],leased);
			assert.deepEqual(entry("failWith").failure.errors,["error:EIO.Workshop.failWith"]);
			assert.deepEqual(entry("choose").failure.errors,[]);
			assert.deepEqual(entry("choose").result.type.arguments,[leased.type,{kind: "primitive",name: "uint32"}]);
			assert.equal(entry("choose").result.ownership,"lease");
			assert.equal(entry("read").resultMode,"value");
			assert.ok(!entry("read").effects.includes("async"));
		}
		if(backend==="javascript")
		{
			assert.equal(entry("read").resultMode,"value");
			assert.ok(!entry("read").effects.includes("async"));
		}
		const leaves = evidence.metadata.nativeEffectAudit.roots.flatMap(r => r.leaves).filter(l => l.module === host);
		assert.ok(leaves.some(l => l.name === box + "setLevel" && l.symbol === "lean_bridge_host_" + backend + "_box_set_level"));
		assert.equal(evidence.reviewedSourceSha256, null);
		const replay = (selection, metadata) => reconcileHostExports({ selection, metadata, ir, component: api.component });
		assert.throws(() => replay({ ...evidence.selection, hostModule: "LeanBridge.Host.Python" }, evidence.metadata), /host import/i);
		assert.throws(() => replay({ ...evidence.selection, pythonTaskCallbacks: true }, evidence.metadata), /same runtime/u);
		if(["c","cpp","php"].includes(backend))
		{
			assert.throws(()=>replay({...evidence.selection,[backend+"TaskCallbacks"]: true},evidence.metadata),/synchronous owner/u);
			assert.throws(()=>replay({...evidence.selection,taskExports: ["Workshop.identity"]},evidence.metadata),/synchronous owner/u);
			assert.throws(()=>replay({...evidence.selection,asyncIterators: [{open: "Workshop.identity"}]},evidence.metadata),/synchronous owner/u);
			const omitted=structuredClone(evidence.metadata);
			omitted.entries.find(e=>e.declaration==="Workshop.update").hostMembers=[];
			assert.throws(()=>replay(evidence.selection,omitted),/Unverified host member dependencies/u);
			const grant={...evidence.selection};delete grant.nativeEffectPolicy;delete grant.nativeEffects;
			assert.throws(()=>replay(grant,evidence.metadata),/compiled member evidence/u);
		}
		if(backend==="javascript")
			assert.throws(() => replay({ ...evidence.selection, javascriptTaskCallbacks: true }, evidence.metadata), /owning agent/u);
		const wrongSymbol = structuredClone(evidence.metadata);
		wrongSymbol.nativeEffectAudit.roots.flatMap(r => r.leaves).find(l => l.module === host).symbol = backend==="cpp"?"lean_bridge_host_c_box_set_level":"lean_bridge_host_python_box_read";
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
		await writeFile(join(project, "LeanBridge/Host/" + label + ".lean"), "def unrelated : Nat := 1\n");
		// Lake needs to know that a source package claims this module.
		const lake = join(project, "lakefile.toml");
		await writeFile(lake, (await readFile(lake, "utf8")) + '\n[[lean_lib]]\nname = "LeanBridge"\n');
		await assert.rejects(capture(), e => /shadowed generated host module/u.test(diagnostic(e)));
		t.diagnostic("Checked constructor, mutable property, method, owned result and mapped EIO; rejected cross-host symbol, stale review and source shadow.");
	});
};
