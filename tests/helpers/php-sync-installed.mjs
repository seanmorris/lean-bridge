/**
 * Compile genuine Lake packages and call the relocated Composer distributions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { access, copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" };
const build = env.LEAN_BRIDGE_PHP_IO_BUILD, json = async f => JSON.parse(await readFile(f, "utf8"));
const target = "php-native", profile = "native-php-io-v1";
const onlyNew = { flag: "wx" };

const policy = env.LEAN_BRIDGE_PHP_IO_POLICY;
test("PHP IO refuses undeclared filesystem effects, asynchronous delivery and an altered review before packaging"
	, { skip: !policy, timeout: 1_800_000 }
	, async t => {
	const work = await mkdtemp(join(tmpdir(), "php-io-policy-"));
	t.after(() => rm(work, { recursive: true, force: true }));
	const ordinary = join(resolve(policy), "ordinary"), src = join(work, "source"), out = join(work, "handoff");
	await cp(join(ordinary, "source"), src, { recursive: true });
	const file = join(src, "lean-bridge.exports.json"), cfg = await json(file);
	const reject = async (config, reason) => {
		await writeFile(file, canonicalJson(config));
		await assert.rejects(buildCanonicalProject({ projectRoot: src, outputRoot: out, targets: [target], environment: env }), error => {
			assert.match([error.message, error.details?.stderr, error.details?.stdout].join("\n"), reason);
			return true;
		});
		await assert.rejects(access(out), { code: "ENOENT" });
	};
	await reject({ ...cfg, nativeEffects: [] }, /requires nativeEffects "filesystem"/u);
	await reject({ ...cfg, taskExports: ["Journal.store"] }, /requires a synchronous API/u);
	const ir = await json(join(ordinary, "handoff/binding-ir.json"));
	const err = ir.errors.find(e => e.id === "error:EIO.ScalarIO.nested");
	err.payload.arguments[0] = { kind: "primitive", name: "uint64" };
	delete cfg.exports; await writeFile(join(src, "public.binding-ir.json"), canonicalJson(ir), onlyNew);
		await reject(cfg, /Reviewed API differs/u);}
);

test("compile ordinary, reviewed and independent PHP native IO distributions"
	, { skip: !build, timeout: 7_200_000 }
	, async t => {
	const root = resolve(build), selected = env.LEAN_BRIDGE_PHP_IO_ROUTE;
	for(const route of selected ? [selected] : ["ordinary", "reviewed", "peer"])
	{
		assert.ok(["ordinary", "reviewed", "peer"].includes(route));
		const dir = join(root, route), src = join(dir, "source"), out = join(dir, "handoff");
		const fixture = resolve("tests/fixtures/native-sync-io"), peer = route === "peer";
		const mod = peer ? "Companion" : "Journal", name = "lean-bridge/" + mod.toLowerCase();
		await mkdir(src, { recursive: true });
		await copyFile(join(fixture, "lean-toolchain"), join(src, "lean-toolchain"), constants.COPYFILE_EXCL);
		const journal = await readFile(join(fixture, "Journal.lean"), "utf8");
		const files = [[mod, journal.replaceAll("Journal", mod)]];
		if(!peer)
		{
			const scalar = await readFile("tests/fixtures/ruby-sync-io/RubyIO.lean", "utf8");
			files.push(["ScalarIO", scalar.replaceAll("RubyIO", "ScalarIO")]);
		}
		const modules = [], exports = [];
		for(const [n, code] of files)
		{
			modules.push(n); exports.push(...[...code.matchAll(/^def (\w+)/gmu)].map(m => n+"."+m[1]));
			await writeFile(join(src, n+".lean"), code, onlyNew);
		}
		const libs = modules.map(n => '[[lean_lib]]\nname="'+n+'"\n').join("");
		await writeFile(join(src, "lakefile.toml"), 'name="'+mod.toLowerCase()+'"\nversion="1.0.0"\n'+libs, onlyNew);
		const cfg = { schemaVersion: 1, modules, exports, nativeEffects: ["filesystem"], targets: { [target]: { name, version: "1.0.0" } } };
		if(route === "reviewed")
		{
			delete cfg.exports;
			await copyFile(join(root, "ordinary/handoff/binding-ir.json"), join(src, "public.binding-ir.json"), constants.COPYFILE_EXCL);
		}
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(cfg), onlyNew);
		await buildCanonicalProject({ projectRoot: src, outputRoot: out, targets: [target], environment: env })
			.catch(e => { throw new Error(e.message+"\n"+JSON.stringify(e.details), { cause: e }); });
		const { receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(out, "package-set-receipt.json") });
		assert.equal(receipt.profiles[0].id, profile);
		assert.equal(receipt.packages.length, 1); const [pkg] = receipt.packages;
		assert.equal(pkg.name, name); assert.equal(pkg.target, target); assert.equal(pkg.runtimeDelivery, "embedded");
		if(route === "reviewed") assert.deepEqual(await json(join(src,"public.binding-ir.json")), await json(join(out,"binding-ir.json")));
		t.diagnostic("verified "+route+" Composer archive: "+pkg.artifacts[0].sha256);
	}}
);
