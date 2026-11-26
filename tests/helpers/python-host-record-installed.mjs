/** @file Check records holding real Python objects from both source-authoring routes. */
import assert from "node:assert/strict";
import {access, copyFile, cp, mkdir, mkdtemp, readFile, rename, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {retainPackageSetEvidence} from "./package-set.mjs";

const fixture = new URL("../fixtures/python-host-record/", import.meta.url);
const helpers = new URL("../fixtures/python-host-meter/", import.meta.url);
const cli = fileURLToPath(new URL("../../scripts/lean-bridge.mjs", import.meta.url));
const json = async f => JSON.parse(await readFile(f));
const names = ["Workshop.shared", "Workshop.reorder", "Workshop.selectPrimary", "Workshop.weigh"];
const enabled = process.env.LEAN_BRIDGE_PYTHON_HOST_RECORD_TEST === "1";

test("installed Python application records preserve their original host objects", {skip: !enabled, timeout: 1800000}, async t => {
	const root = await mkdtemp(join(tmpdir(), "python-host-record-"));
	t.after(() => rm(root, {recursive: true, force: true}));
	const python = await run(process.env.LEAN_BRIDGE_PYTHON ?? "python3", ["-I", "-c", "import sys; print(sys.executable)"], root);
	const pythonVersion = await run(python, ["-I", "-c", "import platform; print(platform.python_version())"], root);
	const report = resolve(process.env.LEAN_BRIDGE_PYTHON_HOST_RECORD_EVIDENCE ?? "build/python-host-record");
	let reviewed;
	for(const route of ["ordinary", "reviewed"])
	{
		const author = join(root, route + "-author"), out = join(root, route + "-built");
		const build = dest => run(process.execPath, [cli, "build", "--project", author, "--target", "pypi", "--output", dest, "--json", "--progress", "none"], root, process.env);
		await cp(helpers, author, {recursive: true});
		await copyFile(new URL("Workshop.lean", fixture), join(author, "Workshop.lean"));
		const cfg = await json(join(author, "lean-bridge.exports.json"));
		if(route === "ordinary") cfg.exports = names;
		else
		{
			delete cfg.exports;
			await saveLakeFile(author, "public.binding-ir.json", reviewed);
		}
		await saveLakeFile(author, "lean-bridge.exports.json", canonicalJson(cfg));
		await build(out);
		const api = await json(join(out, "binding-ir.json"));
		assert.equal(api.schemaVersion, 4);
		const record = api.types.find(v => v.id === "lean:Workshop.Rack");
		assert.equal(record.representation, "owned");
		assert.deepEqual(record.fields.map(f => [f.name, f.type.id ?? f.type.name]), [["primary", "host:meter.Box"], ["offset", "uint32"], ["backup", "host:meter.Box"]]);
		const reorder = api.declarations.find(d => d.name === "reorder");
		assert.equal(reorder.parameters[0].ownership, "borrow");
		assert.equal(reorder.result.ownership, "lease");
		const metadata = await json(join(out, "host-export-evidence.json"));
		if(route === "ordinary")
		{
			assert.equal(metadata.reviewedSourceSha256, null);
			api.documentation.summary = "Independently reviewed records containing real meter objects.";
			record.fields[0].documentation.summary = "The application's primary meter.";
			reviewed = JSON.stringify(api, null, 2) + "\n";
		}
		else
		{
			assert.equal(metadata.reviewedSourceSha256, sha256(reviewed));
			assert.deepEqual(api, JSON.parse(reviewed));
			const bad = structuredClone(api);
			bad.types.find(q => q.id === record.id).fields.reverse();
			await saveLakeFile(author, "public.binding-ir.json", canonicalJson(bad));
			const refused = join(root, "refused");
			await assert.rejects(build(refused), /Reviewed API differs/u);
			await assert.rejects(access(refused), {code: "ENOENT"});
		}
		const handoff = join(root, route + "-feed"), captured = await retainPackageSetEvidence(out, handoff);
		await rm(author, {recursive: true}); await rm(out, {recursive: true});
		const {receipt} = await readVerifiedPackageSetReceipt({receiptPath: join(handoff, "package-set-receipt.json")});
		const env = join(root, route + "-env"), exe = join(env, "bin/python");
		await run(python, ["-I", "-m", "venv", env], root);
		const wheels = receipt.packages.map(pkg => join(handoff, pkg.artifacts[0].path));
		await run(exe, ["-I", "-m", "pip", "--isolated", "install", "--no-index", "--no-deps", "--no-cache-dir", ...wheels], root);
		await rm(handoff, {recursive: true});
		const installed = join(root, route + "-installed");
		await rename(env, installed);
		const source = await readFile(new URL("consumer.py", fixture));
		await saveLakeFile(installed, "consumer.py", source);
		const observed = await run(join(installed, "bin/python"), ["-I", "consumer.py"], installed, {LANG: "C.UTF-8", PATH: "/no-author-tools"});
		assert.equal(observed, "installed Python record: identity, aliasing, input validation, exception identity, disposal");
		await mkdir(report, {recursive: true});
		await saveLakeFile(report, route + ".package-set.json", canonicalJson(receipt));
		const execution = {route, pythonVersion
			, packageSetSha256: captured.receiptSha256
			, reviewedSourceSha256: metadata.reviewedSourceSha256
			, consumerSha256: sha256(source)
			, observed};
		await saveLakeFile(report, route + ".execution.json", canonicalJson(execution));
		t.diagnostic(route + ": " + captured.receiptSha256);
	}
});
