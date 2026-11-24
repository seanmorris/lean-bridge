/** @file Build an ordinary or reviewed host-object Maven handoff from checked application source. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { copyFile, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { prepareNativeHostFixture } from "./native-host-import-check.mjs";

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
/**
 * Verify the whole receipt before deleting the producer, retaining only JAR/POM and public review input.
 *
 * @param o - Private scratch and archive directories, CLI, component and source route.
 * @param o.root - Private publisher scratch.
 * @param o.archives - Directory receiving just the verified artifacts.
 * @param o.peer - Build the independently named second component.
 * @param o.reviewed - Require the ordinary build's public IR.
 * @param o.cli - Path to the author's CLI entry point.
 */
export const captureJvmHostHandoff = async ({ root, archives, peer, reviewed, cli }) => {
	assert.ok(isAbsolute(archives) && (await stat(archives)).isDirectory(), "expected an existing absolute archive directory");
	const stage = await mkdtemp(join(root, "publisher-")), project = join(stage, "src"), out = join(stage, "out");
	const name = peer ? "workshop-peer" : "workshop", mod = peer ? "Peer" : "Workshop";
	const review = join(archives, name + ".binding-ir.json");
	try
	{
		await prepareNativeHostFixture(project, "jvm"); await copyFile(resolve("LICENSE"), join(project, "LICENSE"));
		const source = join(project, "Workshop.lean"), main = join(project, mod + ".lean");
		const body = (await readFile(source, "utf8")).replace("end Workshop", extra + "\nend Workshop").replaceAll("Workshop", mod);
		if(peer) await rename(source, main); await writeFile(main, body);
		await writeFile(join(project, "lakefile.toml"), 'name = "' + name + '"\nversion = "1.0.0"\n[[lean_lib]]\nname = "' + mod + '"\n');
		const config = join(project, "lean-bridge.exports.json"), cfg = await json(config);
		cfg.targets.maven.name = "org.leanbridge:" + name; cfg.modules = [mod];
		cfg.exports = [...cfg.exports.map(n => n.replace("Workshop", mod)), ...["keep", "held", "forget", "replaced", "verdict", "layered"].map(n => mod + "." + n)];
		await writeFile(config, canonicalJson(cfg));
		if(reviewed) await copyFile(review, join(project, "workshop.binding-ir.json"));
		try
		{ await exec(process.execPath, [cli, "build", "--project", project, "--target", "maven", "--output", out, "--json", "--progress", "none"]); }
		catch(e)
		{ throw new Error(e.stdout + "\n" + e.stderr, { cause: e }); }
		const { result, receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(out, "package-set-receipt.json") });
		const api = await json(join(out, "binding-ir.json")), ev = await json(join(out, "host-export-evidence.json")), [pkg] = receipt.packages;
		assert.equal(pkg.name, cfg.targets.maven.name); assert.equal(pkg.profile, "native-jvm-io-v1"); assert.equal(pkg.runtimeDelivery, "embedded");
		assert.equal(ev.selection.hostModule, "LeanBridge.Host.Jvm"); assert.equal(ev.sourceTreeSha256, receipt.source.treeSha256);
		assert.equal(ev.reviewedSourceSha256, reviewed ? sha256(await readFile(review)) : null);
		if(reviewed) assert.deepEqual(api, await json(review)); else await writeFile(review, canonicalJson(api), { flag: "wx" });
		const files = [];
		for(const a of pkg.artifacts)
		{
			const dest = join(archives, basename(a.path)); await copyFile(join(out, a.path), dest, constants.COPYFILE_EXCL); files.push(dest);
		}
		assert.deepEqual(files.map(f => f.slice(-4)).sort(), [".jar", ".pom"]);
		return { name, files, receiptSha256: result.receiptSha256, artifacts: pkg.artifacts };
	} finally
	{ await rm(stage, { recursive: true, force: true }); }
};
