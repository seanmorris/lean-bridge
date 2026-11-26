/** @file Install C-family application records from ordinary and reviewed Lean sources. */
import assert from "node:assert/strict";
import {access, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import test from "node:test";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";
import {installOfflineAuthor} from "./offline-author-cli.mjs";

const json = async path => JSON.parse(await readFile(path));
const checkPackage = target => async t => {
	const cpp = target === "cpp";
	const root = await mkdtemp(join(tmpdir(), target + "-host-record-"));
	t.after(() => rm(root, {recursive: true, force: true}));
	const env = process.env, cmake = env.LEAN_BRIDGE_CMAKE ?? "cmake";
	await run(cmake, ["--version"], root, env);
	const cli = await installOfflineAuthor(root), file = "consumer." + target, source = resolve("tests/fixtures/" + target + "-host-record", file);
	const out = resolve(env["LEAN_BRIDGE_" + target.toUpperCase() + "_HOST_RECORD_OUTPUT"] ?? "build/" + target + "-host-record");
	const lean = (await readFile("tests/fixtures/dotnet-host-record/Workshop.lean", "utf8")).replaceAll("LeanBridge.Host.Dotnet", "LeanBridge.Host." + (cpp ? "Cpp" : "C"));
	await mkdir(out, {recursive: true});
	let review;
	for(const route of ["ordinary", "reviewed"])
	{
		const work = join(root, route), src = join(work, "author"), release = join(work, "release");
		const unpacked = join(work, "unpacked"), install = join(work, "relocated"), app = join(work, "app");
		await mkdir(work); await prepareNativeHostFixture(src, target); await copyFile(resolve("LICENSE"), join(src, "LICENSE"));
		await writeFile(join(src, "Workshop.lean"), lean);
		const cfgFile = join(src, "lean-bridge.exports.json"), cfg = await json(cfgFile);
		if(route === "ordinary") cfg.exports = ["Gauge.createPair", "Gauge.flip", "Gauge.sumRead", "Gauge.choose", "Gauge.duplicateSample"];
		else
		{
			delete cfg.exports;
			await writeFile(join(src, "records.binding-ir.json"), review);
		}
		await writeFile(cfgFile, canonicalJson(cfg));
		const build = dest => run(process.execPath, [cli, "build", "--project", src, "--target", target, "--output", dest, "--json", "--progress", "none"], work, env);
		await build(release);
		const api = await json(join(release, "binding-ir.json")), evidence = await json(join(release, "host-export-evidence.json"));
		const pair = api.types.find(v => v.id === "lean:Gauge.Pair");
		assert.equal(api.schemaVersion, 4); assert.deepEqual(pair.fields.map(f => f.name), ["lead", "sample", "sequence", "spare"]);
		if(route === "ordinary")
		{
			assert.equal(evidence.reviewedSourceSha256, null); pair.fields[0].documentation.summary = "Original meter retained by the " + (cpp ? "C++" : "C") + " owner."; review = canonicalJson(api);
		}
		else
		{
			assert.deepEqual(api, JSON.parse(review)); assert.equal(evidence.reviewedSourceSha256, sha256(review));
			pair.fields.reverse(); await writeFile(join(src, "records.binding-ir.json"), canonicalJson(api));
			const rejected = join(work, "bad-review"); await assert.rejects(build(rejected), /Reviewed API differs/u); await assert.rejects(access(rejected), {code: "ENOENT"});
		}
		const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(release, "package-set-receipt.json")});
		const [pkg] = receipt.packages; assert.equal(pkg.profile, "native-" + target + "-host-v1"); assert.equal(pkg.name, "workshop");
		await mkdir(unpacked); await mkdir(app); await run("tar", ["-xzf", join(release, pkg.artifacts[0].path), "--strip-components=1", "-C", unpacked], work, env);
		await rename(unpacked, install); await rm(release, {recursive: true}); await rm(src, {recursive: true});
		await copyFile(source, join(app, file));
		const pc = {...env, PKG_CONFIG_PATH: "", PKG_CONFIG_LIBDIR: join(install, "lib/pkgconfig")};
		const flags = (await run("pkg-config", ["--cflags", "--libs", "workshop"], app, pc)).split(/\s+/u);
		await run(cpp ? "c++" : "cc", [cpp ? "-std=c++20" : "-std=c11", "-Wall", "-Wextra", "-Werror", file, ...flags, "-o", "pkg-client"], app, pc);
		if(!cpp)
		{
			await writeFile(join(app, "wrong.c"), '#include "workshop.h"\nvoid wrong(workshop_binding b,workshop_box x,workshop_pair *r,workshop_diagnostic *d){(void)workshop_flip(b,x,r,d);}\n');
			await assert.rejects(run("cc", ["-std=c11", "-fsyntax-only", "wrong.c", ...flags], app, pc), /incompatible type for argument/u);
		}
		await writeFile(join(app, "CMakeLists.txt"), "cmake_minimum_required(VERSION 3.18)\nproject(record_client " + (cpp ? "CXX" : "C") + ")\nfind_package(LeanBridgeWorkshop CONFIG REQUIRED)\nadd_executable(cmake-client " + file + ")\ntarget_link_libraries(cmake-client PRIVATE LeanBridge::workshop)\n");
		await run(cmake, ["-S", ".", "-B", "cmake", "-DCMAKE_PREFIX_PATH=" + install], app, pc);
		await run(cmake, ["--build", "cmake", "--parallel", "1"], app, pc);
		const observations = [];
		for(const executable of ["pkg-client", "cmake/cmake-client"])
		{
			const observed = await run(join(app, executable), [], app, {PATH: "/no-tools", LEAN_NUM_THREADS: "1"});
			assert.equal(observed, cpp ? "C++ records: original shared owners, copied values, typed identity, rollback and independent RAII" : "C11 records: original objects, copied bytes and Nat, validation, capture, failed partial output and independent final owners");
			observations.push({executable, observed});
		}
		const resultRow = {route, observations, consumerSha256: sha256(await readFile(source)), packageSetSha256: result.receiptSha256, reviewedSourceSha256: evidence.reviewedSourceSha256};
		await writeFile(join(out, route + ".package-set.json"), canonicalJson(receipt));
		await writeFile(join(out, route + ".execution.json"), canonicalJson(resultRow));
		t.diagnostic(route + " " + result.receiptSha256);
	}
};
for(const [target, label] of [["c", "C11"], ["cpp", "C++"]])
	test("installed " + label + " records retain application objects and reclaim partial results", {timeout: 3_600_000}, checkPackage(target));
