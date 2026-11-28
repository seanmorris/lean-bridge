/** @file Install independent C11 packages and measure the lifetime of a synchronous EIO resource. */
import assert from "node:assert/strict";
import {copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson, sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

const json = async p => JSON.parse(await readFile(p, "utf8"));
const fixture = resolve("tests/fixtures/resource-tasks"), desk = resolve("tests/fixtures/ruby-task-resources");
const client = resolve("tests/fixtures/native-sync-resource/last-owner.c");
const execute = process.env.LEAN_BRIDGE_C_ERROR_OWNER_TEST === "1";
const env = {...process.env, LEAN_NUM_THREADS: "1"};
test("installed C11 synchronous declared error is the last owner across independently compiled packages", {
	skip: !execute, timeout: 3_600_000
}, async t => {
	const work = await mkdtemp(join(tmpdir(), "c11-error-owner-")); t.after(() => rm(work, {recursive: true, force: true}));
	const out = resolve(env.LEAN_BRIDGE_C_ERROR_OWNER_OUTPUT ?? "build/c11-error-owner"), reviews = new Map();
	await mkdir(out, {recursive: true});
	for(const route of ["ordinary", "reviewed"])
	{
		const base = join(work, route), author = join(base, "author"), app = join(base, "deployed");
		await mkdir(app, {recursive: true});
		const packages = [], paths = [];
		for(const [name, mod, names] of [
			["lease-desk", "Desk", ["issue", "count", "checkTicket"]]
			, ["lease-counter", "Depot", ["closes", "add", "count"]]
		]){
			const src = join(author, name), handoff = join(author, name + "-release"), prefix = join(author, name + "-installed");
			await mkdir(src, {recursive: true}); await mkdir(prefix);
			for(const file of ["lean-toolchain", "Shared.lean"]) await copyFile(join(fixture, file), join(src, file));
			await copyFile(join(mod === "Desk" ? desk : fixture, mod + ".lean"), join(src, mod + ".lean"));
			await writeFile(join(src, "lakefile.toml"), `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Shared"\n[[lean_lib]]\nname = "${mod}"\n`);
			const cfg = {schemaVersion: 1, modules: [mod], resources: ["Shared.Ticket"]
				, nativeEffects: ["filesystem"], targets: {c: {name, version: "1.0.0"}}};
			if(route === "ordinary") cfg.exports = names.map(n => mod + "." + n);
			else await writeFile(join(src, "public.binding-ir.json"), reviews.get(name));
			await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(cfg));
			await buildCanonicalProject({projectRoot: src, outputRoot: handoff, targets: ["c"], environment: env});
			const api = await json(join(handoff, "binding-ir.json")), evidence = await json(join(handoff, "host-export-evidence.json"));
			const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(handoff, "package-set-receipt.json")});
			assert.equal(receipt.packages.length, 1); const [pkg] = receipt.packages;
			assert.equal(pkg.name, name); assert.equal(pkg.profile, "native-c-io-v1");
			const digest = hashBindingIr(api); assert.equal(receipt.profiles[0].bindingIrSha256, digest);
			assert.equal(evidence.sourceTreeSha256, receipt.source.treeSha256);
			if(route === "ordinary") reviews.set(name, canonicalJson(api)); else assert.equal(reviews.get(name), canonicalJson(api));
			assert.equal(evidence.reviewedSourceSha256, route === "reviewed" ? sha256(reviews.get(name)) : null);
			const ticket = api.types.find(type => type.id === "lean:Shared.Ticket");
			if(mod === "Desk")
			{
				const signature = api.declarations.find(d => d.name === "check_ticket");
				assert.equal(signature.resultMode, "value"); assert.equal(signature.parameters[1].ownership, "borrow");
				assert.equal(signature.result.ownership, "lease");
				assert.equal(api.errors.find(e => e.id === signature.failure.errors[0]).payload.id, ticket.id);
			}
			await run("tar", ["-xzf", join(handoff, pkg.artifacts[0].path), "--strip-components=1", "-C", prefix], base, env);
			paths.push(prefix);
			packages.push({name, receiptSha256: result.receiptSha256
				, archive: pkg.artifacts[0]
				, bindingIrSha256: digest
				, reviewedSourceSha256: evidence.reviewedSourceSha256
				, sourceTreeSha256: evidence.sourceTreeSha256
				, runtimeIdentity: pkg.runtimeIdentity
				, nominal: ticket.resource.kindId});
		}
		assert.equal(packages[0].nominal, packages[1].nominal); assert.equal(packages[0].runtimeIdentity, packages[1].runtimeIdentity);
		const pc = {...env, PKG_CONFIG_PATH: "", PKG_CONFIG_LIBDIR: paths.map(p => join(p, "lib/pkgconfig")).join(":")};
		const flags = (await run("pkg-config", ["--cflags", "--libs", ...packages.map(p => p.name)], base, pc)).split(/\s+/u);
		const cc = env.CC ?? "cc", binary = join(app, "consumer");
		await run(cc, ["-std=c11", "-Wall", "-Wextra", "-Werror", "-I", fixture, client, ...flags, "-ldl", "-o", binary], base, env);
		for(const [i, p] of packages.entries()) await rename(paths[i], join(app, p.name));
		await rm(author, {recursive: true});
		const isolated = {PATH: "/unavailable", LANG: "C", LEAN_NUM_THREADS: "1"
			, LD_LIBRARY_PATH: packages.map(p => join(app, p.name, "lib")).join(":")};
		const calls = [];
		for(const order of ["desk-first", "peer-first"])
		{
			const result = await run(binary, [order], app, isolated);
			assert.equal(result, "typed error retained the last ticket; peer wrote 42, stale read refused, zero owners and descriptor delta");
			calls.push({order, result});
		}
		const report = {route, packages, calls
			, consumerSha256: sha256(await readFile(client))
			, observerSha256: sha256(await readFile(join(fixture, "audit.h")))};
		await writeFile(join(out, route + ".json"), canonicalJson(report)); t.diagnostic(route + ": both C11 process orders passed");
	}
});
