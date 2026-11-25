/** @file Build a two-class Lean package and check C++ alias ownership after relocation. */
import assert from "node:assert/strict";
import { copyFile, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const fixture = resolve("tests/fixtures/cpp-host-anchors");
const prepare = async project => {
	await cp("tests/fixtures/cpp-host-workshop", project, { recursive: true });
	await copyFile("LICENSE", join(project, "LICENSE"));
	await copyFile(join(fixture, "Workshop.lean"), join(project, "Workshop.lean"));
	const input = join(project, "lean-bridge.hosts.json");
	const ir = JSON.parse(await readFile(input, "utf8"));
	const [box] = ir.types, dial = structuredClone(box);
	box.host.identity = "strong-canonical";
	dial.name = dial.source.declaration = "Dial";
	dial.id = "host:meter.Dial";
	dial.resource.kindId = "resource:meter.Dial";
	ir.types.push(dial);
	const proto = ir.declarations.find(d => d.name === "read");
	const named = t => ({ kind: "named", id: t.id });
	const member = (owner, name) => {
		const d = structuredClone(proto);
		d.owner = owner.id; d.name = name; d.id = owner.id + "." + name;
		d.source.declaration = d.overloadKey = owner.name + "." + name;
		d.receiver.type = named(owner);
		return d;
	};
	const param = ownership => ({
		...structuredClone(proto.receiver)
		, name: "dial"
		, type: named(dial)
		, ownership
		, lifetime: { scope: ownership === "borrow" ? "call" : "explicit", anchor: null }
		, optional: false
		, default: null
	});
	const child = member(box, "child"), prefer = member(box, "prefer");
	child.result = { type: named(dial), ownership: "borrow", lifetime: { scope: "receiver", anchor: "receiver" } };
	prefer.parameters = [param("borrow")];
	prefer.result = { ...child.result, lifetime: { scope: "parameter", anchor: "dial" } };
	const retain = (name, ownership) => {
		const d = member(box, name);
		d.receiver.mutability = d.mutability = "write";
		d.effects = ["writes-resource", "host-call", "fails"];
		d.parameters = [param(ownership)];
		return d;
	};
	const leased = member(dial, "leased");
	leased.result = { type: named(dial), ownership: "lease", lifetime: { scope: "explicit", anchor: null } };
	ir.declarations = [child, prefer, retain("keep", "lease"), retain("takeOwned", "transfer"), member(dial, "read"), leased];
	await writeFile(input, canonicalJson(ir));
	const path = join(project, "lean-bridge.exports.json"), cfg = JSON.parse(await readFile(path, "utf8"));
	cfg.exports = ["childOf", "preferDial", "keepDial", "takeDial", "readDial", "innerRead", "leasedDial", "exactInt"].map(s => "Workshop." + s);
	await writeFile(path, canonicalJson(cfg));
};

test("installed C++ borrowed members match the declared owner and release strong objects on final close", { timeout: 900_000 }, async t => {
	const env = process.env, root = await mkdtemp(join(tmpdir(), "cpp-host-anchors-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const replay = env.LEAN_BRIDGE_CPP_HOST_ANCHORS_REPLAY, keep = env.LEAN_BRIDGE_CPP_HOST_HANDOFFS;
	const release = replay ? resolve(replay) : keep ? join(await mkdtemp(join(keep, "cpp-anchor-release-")), "handoff") : join(root, "handoff");
	if(!replay)
	{
		const project = join(root, "source");
		await prepare(project);
		await buildCanonicalProject({ projectRoot: project, outputRoot: release, targets: ["cpp"], environment: env });
		await rm(project, { recursive: true });
	}
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(release, "package-set-receipt.json") });
	assert.deepEqual(result.profiles, ["native-cpp-host-v1"]);
	const [pkg] = receipt.packages;
	const stage = join(root, "staging"), installed = join(root, "installed"), app = join(root, "app");
	await mkdir(stage); await mkdir(app);
	await run("tar", ["-xzf", join(release, pkg.artifacts[0].path), "--strip-components=1", "-C", stage], root, env);
	await rename(stage, installed);
	const pc = { ...env, PKG_CONFIG_PATH: "", PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig") };
	const flags = (await run("pkg-config", ["--cflags", "--libs", "workshop"], app, pc)).split(/\s+/u);
	await copyFile(join(fixture, "client.cpp"), join(app, "client.cpp"));
	await run(env.CXX ?? "c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "client.cpp", ...flags, "-o", "client"], app, pc);
	const isolated = { PATH: "/no-producer-tools", LANG: "C", LEAN_NUM_THREADS: "1", LD_LIBRARY_PATH: "" };
	for(const mode of ["valid", "wrong-receiver", "wrong-parameter", "wrong-control-block"])
	{
		const output = await run("./client", [mode], app, isolated);
		assert.match(output, mode === "valid" ? /final strong release/u : /retired both bindings/u);
	}
	t.diagnostic(JSON.stringify({ receipt: result.receiptSha256, archive: pkg.artifacts[0].sha256, release }));
});
