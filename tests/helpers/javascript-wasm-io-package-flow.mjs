/** @file Build ordinary and reviewed synchronous npm handoffs with an offline-installed author CLI. */
import assert from "node:assert/strict";
import test from "node:test";
import { access, appendFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const enabled = process.env.LEAN_BRIDGE_JS_IO_PACKAGE_TEST === "1";
test("compile, reproduce, install and check ordinary and reviewed JS IO releases", {skip: !enabled}, async t => {
	const keep = process.env.LEAN_BRIDGE_JS_IO_EVIDENCE, root = keep ?? await mkdtemp(join(tmpdir(), "js-io-releases-"));
	if(keep) await mkdir(root); else t.after(() => rm(root, {recursive: true, force: true}));
	const env = {...process.env}; delete env.NODE_TEST_CONTEXT;
	const run = (command, args, extra = {}) => processBuildRunner.capture({command, args, cwd: root, env: {...env, ...extra}});
	const first = resolve("scripts/lean-bridge.mjs"), installed = join(root, "author"), cli = join(installed, "node_modules/.bin/lean-bridge");
	const call = (bin, args, extra) => run(process.execPath, [bin, ...args], extra);
	const src = join(root, "source"), config = join(src, "lean-bridge.exports.json");
	const build = (bin, project, out, extra) => call(bin, ["build", "--project", project, "--target", "npm", "--output", out, "--json", "--progress", "none"], extra);
	const check = async release => {
		await call(cli, ["verify", "--receipt", join(release, "package-set-receipt.json")]);
		const apiRoot = join(release, "packages/npm");
		const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(apiRoot, "package-set-receipt.json")});
		const report = await run(process.execPath, ["--test", resolve("tests/helpers/javascript-wasm-io-installed.mjs")], {LEAN_BRIDGE_JS_IO_RELEASE: apiRoot});
		const summary = report.stdout.split("\n").find(line => line.startsWith("# {\"node\":"));
		assert.ok(summary, "installed consumer must report both hosts rather than skipping");
		const {node, chromium} = JSON.parse(summary.slice(2));
		assert.deepEqual(node, chromium); assert.equal(node.scalarKinds, 19); assert.equal(node.counter, 3);
		t.diagnostic(receipt.component.id + " " + result.receiptSha256 + ": " + node.checks + " checks per host");
		return join(apiRoot, receipt.packages.find(p => p.role === "component").artifacts[0].path);
	};
	try
	{
		const packed = await buildCliNpmPackage({outputRoot: join(root, "cli-feed")});
		await run("npm", ["install", "--prefix", installed, "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(root, "cache"), packed.archive]);
		await cp(resolve("tests/fixtures/php-wasm-sync-io"), src, {recursive: true});
		const extra = (await readFile(resolve("tests/fixtures/ruby-sync-io/RubyIO.lean"), "utf8")).replace("import Journal", "import Ledger");
		await writeFile(join(src, "RubyIO.lean"), extra, {flag: "wx"});
		await appendFile(join(src, "lakefile.toml"), '\n[[lean_lib]]\nname = "RubyIO"\n');
		const cfg = JSON.parse(await readFile(config));
		cfg.modules.push("RubyIO"); cfg.exports.push(...[...extra.matchAll(/^def (rt_\w+|nested) /gmu)].map(m => "RubyIO." + m[1]));
		cfg.targets = {npm: {name: "@example/ledger-io", version: "1.0.2"}};
		await writeFile(config, canonicalJson(cfg));
		const ordinary = join(root, "ordinary"), copy = join(root, "second-source"), rebuilt = join(root, "reproduced");
		await cp(src, copy, {recursive: true});
		await build(first, src, ordinary); await build(cli, copy, rebuilt);
		const result = out => readVerifiedPackageSetReceipt({receiptPath: join(out, "package-set-receipt.json")});
		assert.deepEqual((await result(ordinary)).receipt, (await result(rebuilt)).receipt);
		t.diagnostic("The offline-installed author CLI reproduced both ordinary archives from a new source directory.");
		const archive = await check(rebuilt);
		const member = (tar, file) => run("tar", ["-xzOf", tar, "package/metadata/" + file]).then(x => x.stdout);
		const ir = JSON.parse(await member(archive, "binding-ir.json"));
		ir.documentation.summary = "Independently reviewed synchronous Ledger.";
		const review = JSON.stringify(ir, null, 4) + "\n", path = join(src, "ledger.binding-ir.json");
		await writeFile(path, review, {flag: "wx"}); delete cfg.exports; await writeFile(config, canonicalJson(cfg));
		const reviewed = join(root, "reviewed");
		await build(cli, src, reviewed); assert.equal(await member(await check(reviewed), "review.binding-ir.json"), review);
		const refuse = (label, rx, settings) => t.test(label, async () => {
			const no = join(root, "refused-" + label);
			await assert.rejects(build(cli, src, no, settings), error => {
				const response = JSON.parse(error.details.stdout);
				assert.equal(response.status, "failed");
				assert.match(response.diagnostics.map(d => d.message).join("\n"), rx);
				return true;
			});
			await assert.rejects(access(no), {code: "ENOENT"});
		});
		ir.declarations.find(d => d.source.declaration === "Ledger.readTotal").result.type.name = "uint64";
		await writeFile(path, canonicalJson(ir)); await refuse("incorrect-review", /Reviewed API differs/u);
		await writeFile(path, review); await refuse("explicit-isolation", /explicit isolated backend/u, {LEAN_BRIDGE_BUILD_BACKEND: "docker"});
		await writeFile(config, canonicalJson({...cfg, nativeEffects: ["filesystem"]})); await refuse("filesystem-grant", /only in-memory/u);
		await writeFile(config, canonicalJson({...cfg, taskExports: ["Ledger.add"]})); await refuse("task-export", /does not yet implement taskExports/u);
		await writeFile(config, canonicalJson(cfg));
		const lean = join(src, "Ledger.lean");
		await writeFile(lean, (await readFile(lean, "utf8")).replace("def magnitude (value : Int) : IO Int := pure value",
			'def magnitude (value : Int) : IO Int := do\n  let _ ← IO.FS.readFile "never-opened"\n  pure value'));
		await refuse("undeclared-filesystem-access", /requires nativeEffects "filesystem"/u);
	} catch(error)
	{
		t.diagnostic([error.details?.stderr, error.details?.stdout].filter(Boolean).join("\n").slice(-5000));
		throw error;
	}
});
