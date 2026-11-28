/** @file Build a host-object Maven or NuGet handoff from ordinary or reviewed Lean source. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, copyFile, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { prepareNativeHostFixture } from "./native-host-import-check.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";

const exec = promisify(execFile);
const extra = `
initialize saved : IO.Ref (Option Box) ← IO.mkRef none
def keep (box : Box) : IO Unit := saved.set (some box)
def held : IO Box := do
  let some v ← saved.get | throw (IO.userError "empty")
  return v
def forget : IO Unit := saved.set none
def replaced (box : Box) : IO UInt32 := do
  try box.read
  catch _ => throw (IO.userError "replacement")
def verdict (success : Bool) : Except String UInt32 :=
  if success then .ok 42 else .error "ordinary refusal"
def layered (box : Box) (success : Bool) : EIO String (Except String (Except String UInt32)) := do
  let v ← box.read.toEIO (fun _ => "declared refusal")
  if success then return .ok (.ok v) else return .ok (.error "inner refusal")
`;
const json = async p => JSON.parse(await readFile(p, "utf8"));
const clrTypes = "Unit Bool Char UInt8 UInt16 UInt32 UInt64 USize Int8 Int16 Int32 Int64 ISize Float32 Float String ByteArray Nat Int".split(" ");
const clrEcho = t => "echo_" + (({ ByteArray: "bytes", Float: "float64" })[t] ?? t.toLowerCase());
/**
 * Verify the receipt before deleting the producer; keep only package artifacts and the review input.
 *
 * @param o - Private scratch and archive directories, CLI, component and source route.
 * @param o.root - Private publisher scratch.
 * @param o.archives - Directory receiving just the verified artifacts.
 * @param o.peer - Build the independently named second component.
 * @param o.reviewed - Require the ordinary build's public IR.
 * @param o.cli - Path to the author's CLI entry point.
 * @param o.backend - JVM or CLR package route for the common Lean example.
 * @param o.retain - Optional private directory for the original release, interface and elaboration evidence.
 */
export const captureNativeHostHandoff = async ({ root, archives, peer, reviewed, cli, backend = "jvm", retain }) => {
	assert.ok(["jvm", "dotnet"].includes(backend)); const dotnet = backend === "dotnet", target = dotnet ? "nuget" : "maven";
	assert.ok(isAbsolute(archives) && (await stat(archives)).isDirectory(), "expected an existing absolute archive directory");
	const stage = await mkdtemp(join(root, "publisher-")), project = join(stage, "src"), out = join(stage, "out");
	const name = peer ? "workshop-peer" : "workshop", mod = peer ? "Peer" : "Workshop";
	const review = join(archives, name + ".binding-ir.json");
	try
	{
		await prepareNativeHostFixture(project, backend); await copyFile(resolve("LICENSE"), join(project, "LICENSE"));
		const source = join(project, "Workshop.lean"), main = join(project, mod + ".lean");
		const scalars = [...(dotnet ? clrTypes.map(t => "def " + clrEcho(t) + " (v : " + t + ") : IO " + t + " := pure v") : [])
			, "def rejectBox (box : Box) : EIO Box Unit := throw box"
			, "def chooseBox (box : Box) (ok : Bool) : Except Box Box := if ok then .ok box else .error box"
			, ...dotnet ? [] : ["def mixedFault (box : Box) (mode : UInt8) : EIO (Except String (Except Box UInt32)) Unit := do"
				, "  if mode == 0 then throw (.error \"outer\")"
				, "  if mode == 1 then throw (.ok (.error box))"
				, "  if mode == 2 then throw (.ok (.ok 29))"]].join("\n");
		const body = (await readFile(source, "utf8")).replace("end Workshop", extra + scalars + "\nend Workshop").replaceAll("Workshop", mod);
		if(peer) await rename(source, main); await writeFile(main, body);
		await writeFile(join(project, "lakefile.toml"), 'name = "' + name + '"\nversion = "1.0.0"\n[[lean_lib]]\nname = "' + mod + '"\n');
		const config = join(project, "lean-bridge.exports.json"), cfg = await json(config);
		cfg.targets[target].name = dotnet ? "Acme." + mod : "org.leanbridge:" + name; cfg.modules = [mod];
		cfg.exports = [...cfg.exports.map(n => n.replace("Workshop", mod)), ...["keep", "held", "forget", "replaced", "verdict", "layered"].map(n => mod + "." + n)];
		cfg.exports.push(...[...dotnet ? clrTypes.map(clrEcho) : ["mixedFault"], "rejectBox", "chooseBox"].map(n => mod + "." + n));
		await writeFile(config, canonicalJson(cfg));
		if(reviewed)
		{
			const reviewedFile = join(project, "workshop.binding-ir.json");
			if(!dotnet && !peer)
			{
				const stale = await json(review);
				const declared = stale.declarations.find(d => d.source.declaration === mod + ".mixedFault");
				delete declared.source.extensions["lean-bridge.dev/error-payload-site"];
				await writeFile(reviewedFile, canonicalJson(stale));
				const rejected = join(stage, "stale");
				await assert.rejects(exec(process.execPath, [cli, "build", "--project", project, "--target", target, "--output", rejected, "--json", "--progress", "none"]),
					e => /Reviewed API differs from compiled host exports/u.test(e.stdout + e.stderr));
				await assert.rejects(access(join(rejected, "package-set-receipt.json")), { code: "ENOENT" });
			}
			await copyFile(review, reviewedFile);
		}
		try
		{ await exec(process.execPath, [cli, "build", "--project", project, "--target", target, "--output", out, "--json", "--progress", "none"]); }
		catch(e)
		{ throw new Error(e.stdout + "\n" + e.stderr, { cause: e }); }
		const { result, receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(out, "package-set-receipt.json") });
		const api = await json(join(out, "binding-ir.json")), ev = await json(join(out, "host-export-evidence.json")), [pkg] = receipt.packages;
		assert.equal(pkg.name, cfg.targets[target].name); assert.equal(pkg.profile, "native-" + backend + "-io-v1"); assert.equal(pkg.runtimeDelivery, "embedded");
		assert.equal(ev.selection.hostModule, "LeanBridge.Host." + (dotnet ? "Dotnet" : "Jvm")); assert.equal(ev.sourceTreeSha256, receipt.source.treeSha256);
		assert.equal(ev.reviewedSourceSha256, reviewed ? sha256(await readFile(review)) : null);
		{
			const decl = n => api.declarations.find(d => d.source.declaration === mod + "." + n);
			const payload = decl("rejectBox").source.extensions["lean-bridge.dev/error-payload-site"];
			assert.deepEqual(payload, { type: { kind: "named", id: "host:meter.Box" }, ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
			assert.equal(decl("chooseBox").result.ownership, "lease"); assert.deepEqual(decl("chooseBox").result.lifetime, payload.lifetime);
			if(!dotnet)
			{
				const nested = decl("mixedFault").source.extensions["lean-bridge.dev/error-payload-site"];
				assert.deepEqual(nested.type.arguments[0].arguments[1], payload.type);
				assert.equal(nested.ownership, "lease"); assert.deepEqual(nested.lifetime, payload.lifetime);
			}
		}
		if(reviewed) assert.deepEqual(api, await json(review)); else await writeFile(review, canonicalJson(api), { flag: "wx" });
		if(retain)
		{
			await copyPackageSetHandoff(out,join(retain,"handoff"));
			for(const path of ["binding-ir.json","host-export-evidence.json"]) await copyFile(join(out,path),join(retain,path),constants.COPYFILE_EXCL);
		}
		const files = [];
		for(const a of pkg.artifacts)
		{
			const dest = join(archives, basename(a.path)); await copyFile(join(out, a.path), dest, constants.COPYFILE_EXCL); files.push(dest);
		}
		assert.deepEqual(files.map(f => f.slice(f.lastIndexOf("."))).sort(), dotnet ? [".nupkg"] : [".jar", ".pom"]);
		return { name, files, receiptSha256: result.receiptSha256, artifacts: pkg.artifacts };
	} finally
	{ await rm(stage, { recursive: true, force: true }); }
};
