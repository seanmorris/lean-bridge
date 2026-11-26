/** @file Exercise application-owned Ruby objects in compiled Lean record fields. */
import assert from "node:assert/strict";
import {access, copyFile, cp, mkdir, mkdtemp, readFile, rename, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, join, resolve} from "node:path";
import test from "node:test";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installOfflineAuthor} from "./offline-author-cli.mjs";

const fixture = resolve("tests/fixtures/ruby-host-record");
const enabled = process.env.LEAN_BRIDGE_RUBY_HOST_RECORD_TEST === "1";
const json = async file => JSON.parse(await readFile(file));
test("installed MRI gems keep the original application objects in compiled records", {skip: !enabled, timeout: 1_800_000}, async t => {
	const root = await mkdtemp(join(tmpdir(), "ruby-host-record-"));
	t.after(() => rm(root, {recursive: true, force: true}));
	const cli = await installOfflineAuthor(root), ruby = process.env.LEAN_BRIDGE_RUBY ?? "ruby";
	const rubyVersion = await run(ruby, ["-e", "print RUBY_DESCRIPTION"], root, process.env);
	const report = resolve(process.env.LEAN_BRIDGE_RUBY_HOST_RECORD_EVIDENCE ?? "build/ruby-host-record");
	let reviewed;
	for(const route of ["ordinary", "reviewed"])
	{
		const author = join(root, route + "-author"), out = join(root, route + "-built");
		await cp(resolve("tests/fixtures/ruby-host-meter"), author, {recursive: true, filter: p => !p.endsWith(".rb")});
		await copyFile(join(fixture, "Workshop.lean"), join(author, "Workshop.lean"));
		await copyFile(resolve("LICENSE"), join(author, "LICENSE"));
		const cfg = await json(join(author, "lean-bridge.exports.json"));
		if(route === "ordinary") cfg.exports = ["Station.mirror", "Station.switchMeters", "Station.current", "Station.combined"];
		else
		{
			delete cfg.exports;
			await saveLakeFile(author, "public.binding-ir.json", reviewed);
		}
		await saveLakeFile(author, "lean-bridge.exports.json", canonicalJson(cfg));
		const build = dir => run(process.execPath, [cli, "build", "--project", author, "--target", "rubygems", "--output", dir, "--json", "--progress", "none"], root, process.env);
		await build(out);
		const api = await json(join(out, "binding-ir.json"));
		assert.equal(api.schemaVersion, 4);
		const def = api.types.find(v => v.id === "lean:Station.Panel");
		assert.deepEqual(def.fields.map(f => [f.name, f.type.id ?? f.type.name]), [["active_meter", "host:meter.Box"], ["threshold", "uint32"], ["spare_meter", "host:meter.Box"]]);
		const swap = api.declarations.find(d => d.source.declaration === "Station.switchMeters");
		assert.equal(swap.result.ownership, "lease"); assert.equal(swap.parameters[0].ownership, "borrow");
		assert.ok(api.declarations.find(d => d.source.declaration === "Station.combined").parameters.every(p => p.ownership === "borrow"));
		const metadata = await json(join(out, "host-export-evidence.json"));
		if(route === "ordinary")
		{
			assert.equal(metadata.reviewedSourceSha256, null);
			def.fields[2].documentation.summary = "The application's reserve sensor.";
			reviewed = JSON.stringify(api, null, 2) + "\n";
		}
		else
		{
			assert.equal(metadata.reviewedSourceSha256, sha256(reviewed)); assert.deepEqual(api, JSON.parse(reviewed));
			const wrong = structuredClone(api);
			wrong.types.find(v => v.id === def.id).fields.reverse();
			await saveLakeFile(author, "public.binding-ir.json", canonicalJson(wrong));
			const refused = join(root, "no-release");
			await assert.rejects(build(refused), /Reviewed API differs/u);
			await assert.rejects(access(refused), {code: "ENOENT"});
		}
		const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(out, "package-set-receipt.json")});
		assert.equal(receipt.packages.length, 1);
		const pkg = receipt.packages[0]; assert.equal(pkg.profile, "native-ruby-host-v1");
		const gem = join(root, basename(pkg.artifacts[0].path));
		await rename(join(out, pkg.artifacts[0].path), gem);
		await rm(author, {recursive: true}); await rm(out, {recursive: true});
		const installed = join(root, route + "-installed"), restored = join(root, route + "-restored");
		await mkdir(restored);
		await run(ruby, ["-S", "gem", "install", "--local", "--no-document", "--ignore-dependencies", "--install-dir", restored, gem], root, {...process.env, GEM_HOME: restored, GEM_PATH: restored});
		await rm(gem); await rm(join(restored, "cache", basename(gem)), {force: true}); await rename(restored, installed);
		const source = await readFile(join(fixture, "consumer.rb"));
		await saveLakeFile(installed, "consumer.rb", source);
		const observed = await run(ruby, ["consumer.rb"], installed, {PATH: "/no-tools", GEM_PATH: installed, GEM_HOME: installed, LEAN_NUM_THREADS: "1"});
		assert.equal(observed, "installed Ruby panel: original objects, two borrowed records, checked inputs, exact exception, alias and lifetime");
		const execution = {route, rubyVersion, observed, consumerSha256: sha256(source), reviewedSourceSha256: metadata.reviewedSourceSha256, packageSetSha256: result.receiptSha256};
		await mkdir(report, {recursive: true});
		await saveLakeFile(report, route + ".package-set.json", canonicalJson(receipt));
		await saveLakeFile(report, route + ".execution.json", canonicalJson(execution));
		t.diagnostic(route + ": " + result.receiptSha256);
	}
});
