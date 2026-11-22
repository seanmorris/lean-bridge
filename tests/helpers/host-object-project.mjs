/**
 * Exercise the public host-wheel build and compare a reviewed API to fresh Lean interfaces.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import hostImports from "../fixtures/python-host-meter/lean-bridge.hosts.json" with { type: "json" };
import config from "../fixtures/python-host-meter/lean-bridge.exports.json" with { type: "json" };

const exec = promisify(execFile), enabled = process.env.LEAN_BRIDGE_HOST_OBJECT_TEST === "1";
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const python = resolve(process.env.LEAN_BRIDGE_HOST_PYTHON ?? ".toolchains/python311/bin/python3");
const env = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PYTHON: python };
const component = { id: "workshop@1.0.0", name: "workshop", version: "1.0.0" };
const fixture = resolve("tests/fixtures/python-host-meter");
const source = await readFile(join(fixture, "Workshop.lean"), "utf8");
const internal = await readFile(join(fixture, "Workshop/Internal.lean"), "utf8");
const scratch = async t => {
	const root = await mkdtemp(join(tmpdir(), "host-source-test-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	return root;
};
const retain = async (handoff, project, route, receipt, inputs) => {
	const root = process.env.LEAN_BRIDGE_HOST_OBJECT_EVIDENCE_DIR;
	if(!root) return null;
	const tag = basename(receipt.packages.find(p => p.role === "component").artifacts[0].path).split("-").slice(-3).join("-").replace(/\.whl$/u, "");
	const dest = resolve(root, "projects", tag, route);
	await mkdir(dirname(dest), { recursive: true }); await mkdir(dest);
	for(const p of receipt.packages)
	{
		const a = p.artifacts[0], path = resolve(p.role === "runtime" ? join(root, "wheels") : dest, basename(a.path));
		await mkdir(dirname(path), { recursive: true });
		try
		{ await copyFile(join(handoff, a.path), path, constants.COPYFILE_EXCL); }
		catch(error)
		{ if(error.code !== "EEXIST") throw error; }
		assert.equal(sha256(await readFile(path)), a.sha256);
	}
	for(const path of ["package-set-receipt.json", "package-set-receipt.json.sha256", "native-release.json", "binding-ir.json", "host-export-evidence.json"])
		await copyFile(join(handoff, path), join(dest, path));
	for(const path of inputs)
	{
		const target = join(dest, "source", path);
		await mkdir(dirname(target), { recursive: true }); await copyFile(join(project, path), target);
	}
	return dest;
};
const compile = async (root, sourceText, review) => compileHostSources({
	app: await mkdtemp(join(root, "probe-"))
	, leanPrefix
	, environment: env
	, ir: hostImports
	, sources: [{ module: "Workshop", source: sourceText }, { module: "Workshop.Internal", source: internal }]
	, projectContract: { component
		, exports: config.exports
		, modules: config.modules
		, sourceTreeSha256: sha256(sourceText)
		, configurationSha256: sha256(canonicalJson(config))
		, hostImportsSourceSha256: sha256(canonicalJson(hostImports)), review }
	, run: (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env })
});

test("fresh Lean host signatures and transitive calls reject dishonest reviews and foreign bodies", { skip: !enabled }, async t => {
	const root = await scratch(t);
	const built = await compile(root, source);
	const row = built.api.declarations[0];
	assert.equal(row.name, "read_level");
	assert.deepEqual(row.result.type, { kind: "primitive", name: "uint32" });
	assert.equal(row.parameters[0].type.id, "host:meter.Box");
	assert.deepEqual(row.source.extensions["lean-bridge.dev/host-members"], ["LeanBridge.Host.Python.Box.read"]);
	assert.ok(row.effects.includes("reads-resource"));
	assert.deepEqual(built.evidence.interfaces.map(i => i.module), ["LeanBridge.Host.Python", "Workshop.Internal", "Workshop"]);
	row.result.type.name = "string";
	await assert.rejects(compile(root, source, { source: canonicalJson(built.api) }), /Reviewed API differs/u);
	const original = "def readLevel (box : Box) : IO UInt32 := Internal.level box";
	const typed = source.replace(original, "def readLevel (box : Box) : EIO String UInt32 := IO.toEIO (fun _ => \"reading failed\") (Internal.level box)");
	const domain = (await compile(root, typed)).api;
	assert.deepEqual(domain.declarations[0].failure.errors, ["error:EIO.Workshop.readLevel"]);
	assert.deepEqual(domain.errors[0].payload, { kind: "primitive", name: "string" });
	domain.errors[0].payload.name = "bytes";
	await assert.rejects(compile(root, typed, { source: canonicalJson(domain) }), /Reviewed API differs/u);
	for(const [body, diagnostic] of [
		["def readLevel (_box : Box) : UInt32 := 7", "expected synchronous IO result"]
		, ["axiom unproved : UInt32\ndef readLevel (_box : Box) : IO UInt32 := pure unproved", "Workshop.unproved.*not supported by code generator"]
		, ["axiom unproved : UInt32\nnoncomputable def readLevel (_box : Box) : IO UInt32 := pure unproved", "unimplemented application axiom"]
		, ["@[extern \"unknown_host_member\"] opaque foreignRead : @& Box → IO UInt32\ndef readLevel (box : Box) := foreignRead box", "unreviewed unsafe, partial or foreign"]
		, ["def readLevel (box : Box) : IO (Except String Box) := pure (.ok box)", "owned host object cannot be a copied"]
		, ["def readLevel (box : Box) : EIO Box UInt32 := throw box", "owned host object cannot be a copied"]
		, ["initialize invalid : IO.Ref UInt32 ← IO.mkRef (sorry : UInt32)\ndef readLevel (_box : Box) : IO UInt32 := invalid.get", "depends on sorry"]
		, ["@[extern \"unknown_host_member\"] opaque badInit : IO Unit\ninitialize badInit\ndef readLevel (box : Box) : IO UInt32 := Internal.level box", "unreviewed unsafe, partial or foreign"]
	]) {
		const reason = error => {
			assert.match(`${error.message} ${error.details?.stderr} ${error.details?.stdout}`, new RegExp(diagnostic, "u"));
			return true;
		};
		await assert.rejects(compile(root, source.replace(original, body)), reason);
	}
});

test("CLI builds ordinary and reviewed Python host packages and pip consumes the verified handoff offline", { skip: !enabled, timeout: 600000 }, async t => {
	const root = await scratch(t), project = join(root, "src"), installed = join(root, "installed");
	const packed = await buildCliNpmPackage({ outputRoot: join(root, "candidate") });
	const tools = join(root, "author-tools");
	await exec("npm", ["install"
		, "--prefix"
		, tools
		, "--offline"
		, "--ignore-scripts"
		, "--no-audit"
		, "--no-fund"
		, "--cache", join(root, "npm-cache"), packed.archive], { cwd: root, env });
	const cli = join(tools, "node_modules/.bin/lean-bridge");
	await rm(packed.output, { recursive: true });
	await mkdir(join(project, "Workshop"), { recursive: true });
	const files = ["lean-toolchain", "lakefile.toml", "lean-bridge.hosts.json", "lean-bridge.exports.json", "Workshop.lean", "Workshop/Internal.lean", "LICENSE"];
	for(const name of files) await copyFile(join(fixture, name), join(project, name));
	const run = async (...args) => {
		const { stdout } = await exec(process.execPath, [cli, ...args, "--format", "json"], { cwd: root, env }).catch(error => {
			throw new Error(`${error.message}\n${error.stdout}\n${error.stderr}`);
		});
		return JSON.parse(stdout);
	};
	let publicApi, interfaces;
	const retained = new Map();
	await assert.rejects(run("build", "--project", project, "--target", "pypi", "--target", "c", "--output", join(root, "invalid")), /pypi-only/u);
	for(const route of ["ordinary", "reviewed"])
	{
		const handoff = join(root, route);
		if(route === "reviewed")
		{
			await writeFile(join(project, "api.binding-ir.json"), canonicalJson(publicApi));
			const reviewedConfig = { ...config }; delete reviewedConfig.exports;
			await writeFile(join(project, "lean-bridge.exports.json"), canonicalJson(reviewedConfig));
			await writeFile(join(project, "lake-manifest.json"), canonicalJson({ version: "1.2.0", name: "workshop", packagesDir: ".lake/packages", packages: [] }));
		}
		const result = await run("build", "--project", project, "--target", "pypi", "--output", handoff);
		assert.equal(result.status, "ok", JSON.stringify(result.diagnostics));
		const api = JSON.parse(await readFile(join(handoff, "binding-ir.json")));
		if(publicApi) assert.deepEqual(api, publicApi);
		publicApi = api;
		const evidence = JSON.parse(await readFile(join(handoff, "host-export-evidence.json")));
		if(interfaces) assert.deepEqual(evidence.interfaces, interfaces, "the same source must compile identically in relocated staging");
		interfaces = evidence.interfaces;
		assert.equal(evidence.reviewedSourceSha256 !== null, route === "reviewed");
		assert.equal(evidence.hostImportsSourceSha256, sha256(await readFile(join(fixture, "lean-bridge.hosts.json"))));
		assert.ok(evidence.lake.resolution.externalImports.includes("LeanBridge.Host.Python"));
		assert.deepEqual(evidence.lake.resolution.generatedImports, ["LeanBridge.Host.Python"]);
		const verified = await run("verify", "--receipt", join(handoff, "package-set-receipt.json"));
		assert.equal(verified.result.archives, 2);
		const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
		assert.deepEqual(receipt.component, component);
		assert.equal(receipt.profiles[0].bindingIrSha256, hashBindingIr(api));
		assert.ok(receipt.packages.every(p => p.artifacts.every(a => a.path.startsWith("archives/"))));
		retained.set(route, await retain(handoff, project, route, receipt
			, [...files, ...(route === "reviewed" ? ["api.binding-ir.json", "lake-manifest.json"] : [])]));
		await exec(python, ["-I"
			, "-m"
			, "pip"
			, "--isolated"
			, "--disable-pip-version-check"
			, "install"
			, "--no-cache-dir"
			, "--no-index"
			, "--only-binary"
			, ":all:"
			, "--find-links"
			, join(handoff, "archives")
			, "--target", join(installed, route), "lean-meter==2.0.1"], { env });
		await rm(handoff, { recursive: true });
	}
	const wrong = structuredClone(publicApi); wrong.declarations[0].result.type.name = "string";
	await writeFile(join(project, "api.binding-ir.json"), canonicalJson(wrong));
	const invalid = join(root, "invalid");
	await assert.rejects(run("build", "--project", project, "--target", "pypi", "--output", invalid), /Reviewed API differs/u);
	await assert.rejects(access(invalid), { code: "ENOENT" });
	await rm(project, { recursive: true }); await rm(tools, { recursive: true });
	const relocated = join(root, "consumer"); await rename(installed, relocated);
	await copyFile(resolve("tests/fixtures/host-object/host_app.py"), join(root, "host_app.py"));
	for(const route of ["ordinary", "reviewed"])
	{
		const dir = join(relocated, route);
		const program = "import lean_meter as m\nfrom host_app import Box\nwith m.bind_hosts(Box=Box): assert m.read_level(box=Box(47)) == 47";
		await exec(python, ["-S", "-B", "-c", program], { cwd: root, env: { PATH: "/unavailable", PYTHONPATH: dir } });
		const metadata = join(dir, "lean_meter-2.0.1.dist-info");
		assert.match(await readFile(join(metadata, "METADATA"), "utf8"), /Summary: Installed source-checked meter\nLicense-Expression: MIT/u);
		assert.deepEqual(await readFile(join(metadata, "licenses/source/0/LICENSE")), await readFile(join(fixture, "LICENSE")));
		if(retained.get(route))
		{
			const dest = retained.get(route);
			await writeFile(join(dest, "consumer.py"), program + "\n");
			await copyFile(join(root, "host_app.py"), join(dest, "host_app.py"));
			await writeFile(join(dest, "acceptance.json"), canonicalJson({ route
				, cli: "installed npm archive"
				, offlinePip: true
				, relocated: true
				, sourceAndToolsRemoved: true
				, readLevel: 47
				, cliArchiveSha256: packed.report.archive.sha256 }));
		}
	}
	await assert.rejects(access(project), { code: "ENOENT" });
});
