/** @file Build independent gems, remove producer inputs and run an ordinary offline MRI consumer. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
const exec = promisify(execFile), fixture = resolve("tests/fixtures/ruby-host-meter");
const ruby = process.env.LEAN_BRIDGE_RUBY ?? "ruby";
const held = `
initialize saved : IO.Ref (Option Box) ← IO.mkRef none
def keep (box : Box) : IO Unit := saved.set (some box)
def held : IO Box := do
  let some v ← saved.get | throw (IO.userError "empty")
  return v
def forget : IO Unit := saved.set none
def retainChild (parent : Box) : IO Unit := do keep (← parent.child)
def retainFrom (receiver parent : Box) : IO Unit := do keep (← receiver.from_parent parent)
def consume (box : Box) : IO UInt32 := box.finish
def tokenIdentity (token : Token) : IO Token := token.identity
def lookupToken (box : Box) : IO Token := box.lookup
def checkPair (token : Token) (other : Box) (_limit : UInt8) : IO UInt32 := do
  let _ ← other.read
  token.read
initialize tokenSlot : IO.Ref (Option Token) ← IO.mkRef none
def rememberToken (token : Token) : IO Unit := tokenSlot.set (some token)
def recalledToken : IO Token := do
  let some v ← tokenSlot.get | throw (IO.userError "no token")
  return v
def forgetToken : IO Unit := tokenSlot.set none
def caught (box : Box) : IO String := do
  try
    let _ ← box.read
    return "ok"
  catch
    | .userError msg => return msg
    | _ => return "other IO error"
def replaced (box : Box) : IO UInt32 := do
  try box.read
  catch _ => throw (IO.userError "replacement")
def verdict (success : Bool) : Except String UInt32 :=
  if success then .ok 42 else .error "ordinary refusal"
def layered (box : Box) (success : Bool) : EIO String (Except String (Except String UInt32)) := do
  let v ← box.read.toEIO (fun _ => "declared refusal")
  if success then return .ok (.ok v) else return .ok (.error "inner refusal")
def pickObject (box : Box) (token : Token) (ok : Bool) : Except Token Box :=
  if ok then .ok box else .error token
def rejectBox (box : Box) : EIO Box Unit := throw box
def rejectSaved : EIO (Except String Box) Unit := do
  let some box ← saved.get | throw (.error "empty")
  throw (.ok box)
def mixedFault (box : Box) (token : Token) (mode : UInt8) : EIO (Except String (Except Box Token)) Unit := do
  if mode == 0 then throw (.error "outer")
  if mode == 1 then throw (.ok (.error box))
  if mode == 2 then throw (.ok (.ok token))
`;
const scalars = {
	unit: "Unit", bool: "Bool", string: "String", char: "Char"
	, bytes: "ByteArray", nat: "Nat", int: "Int", usize: "USize", isize: "ISize"
	, float32: "Float32", float64: "Float"
	, uint8: "UInt8"
	, uint16: "UInt16"
	, uint32: "UInt32"
	, uint64: "UInt64"
	, int8: "Int8"
	, int16: "Int16"
	, int32: "Int32"
	, int64: "Int64"
};
const installEchoes = async project => {
	const path = join(project, "lean-bridge.hosts.json"), ir = await json(path);
	const read = ir.declarations.find(d => d.name === "read"), arg = ir.declarations.find(d => d.kind === "constructor").parameters[0];
	const box = ir.types[0], tokenId = "host:meter.Token", token = { kind: "named", id: tokenId };
	ir.types.push({ ...box, id: tokenId, name: "Token"
		, resource: { ...box.resource, kindId: "resource:meter.Token" }
		, host: { ...box.host, identity: "strong-canonical" }
		, source: { ...box.source, declaration: "Token" } });
	const identity = ir.declarations.find(d => d.name === "identity");
	for(const d of [read, identity])
	{
		const decl = "Token." + d.name;
		ir.declarations.push({ ...d, owner: tokenId, id: tokenId + "." + d.name
			, overloadKey: decl, receiver: { ...d.receiver, type: token }
			, result: d === read ? d.result : { ...d.result, type: token }
			, source: { ...d.source, declaration: decl } });
	}
	ir.declarations.push({ ...identity, id: read.owner + ".lookup", name: "lookup"
		, overloadKey: "Box.lookup"
		, result: { ...identity.result, type: token }
		, source: { ...identity.source, declaration: "Box.lookup" } });
	for(const [name, scope, anchor] of [["child", "receiver", "receiver"], ["from_parent", "parameter", "parent"]])
	{
		const parameters = scope === "parameter" ? [{ ...arg, ...read.receiver, name: anchor }] : [];
		const result = { type: read.receiver.type, ownership: "borrow", lifetime: { scope, anchor } };
		ir.declarations.push({ ...read, name, id: read.owner + "." + name, overloadKey: "Box." + name, parameters, result, source: { ...read.source, declaration: "Box." + name } });
	}
	ir.declarations.push({ ...read, name: "finish", id: read.owner + ".finish", overloadKey: "Box.finish", receiver: { ...read.receiver, ownership: "transfer" }, source: { ...read.source, declaration: "Box.finish" } });
	for(const tag of Object.keys(scalars))
	{
		const name = "echo_" + tag, type = { kind: "primitive", name: tag }, decl = "Box." + name;
		ir.declarations.push({ ...read, id: read.owner + "." + name, name, overloadKey: decl, parameters: [{ ...arg, type }], result: { ...read.result, type }, source: { ...read.source, declaration: decl } });
	}
	await writeFile(path, canonicalJson(ir));
	return Object.entries(scalars).map(([tag, type]) => "def test_" + tag + " (box : Box) (v : " + type + ") : IO " + type + " := box.echo_" + tag + " v").join("\n");
};
const json = async p => JSON.parse(await readFile(p, "utf8"));
test("ordinary and reviewed installed gems call real Ruby-owned objects across independent Lean components", { timeout: 900000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "ruby-host-gems-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const handoffs = await mkdtemp(join(process.env.LEAN_BRIDGE_RUBY_HOST_HANDOFF_TMP ?? tmpdir(), "ruby-host-archives-"));
	t.after(() => rm(handoffs, { recursive: true, force: true }));
	const reviews = new Map(), seen = new Set();
	const packed = await buildCliNpmPackage({ outputRoot: join(root, "candidate") }), tools = join(root, "author-tools");
	await exec("npm", ["install", "--prefix", tools, "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(root, "npm-cache"), packed.archive], { cwd: root });
	await rm(packed.output, { recursive: true });
	const cli = join(tools, "node_modules/.bin/lean-bridge");
	for(const route of ["ordinary", "reviewed"])
	{
		const packs = [];
		for(const [name, mod] of [["workshop", "Workshop"], ["workshop-peer", "Peer"]])
		{
			const project = join(root, name), out = join(root, name + "-out");
			await cp(fixture, project, { recursive: true, filter: p => !p.endsWith(".rb") }); await copyFile(resolve("LICENSE"), join(project, "LICENSE"));
			const echoes = await installEchoes(project);
			const src = (await readFile(join(project, "Workshop.lean"), "utf8")).replace("end Workshop", held + echoes + "\nend Workshop").replaceAll("Workshop", mod);
			if(mod !== "Workshop") await rename(join(project, "Workshop.lean"), join(project, mod + ".lean"));
			await writeFile(join(project, mod + ".lean"), src);
			await writeFile(join(project, "lakefile.toml"), 'name = "' + name + '"\nversion = "1.0.0"\n[[lean_lib]]\nname = "' + mod + '"\n');
			const cfg = await json(join(project, "lean-bridge.exports.json")); cfg.modules = [mod]; cfg.targets.rubygems.name = name;
			cfg.exports = [...cfg.exports.map(n => n.replace("Workshop", mod)), ...["keep", "held", "forget", "caught", "replaced", "verdict", "layered", "retainChild", "retainFrom", "consume", "tokenIdentity", "lookupToken", "checkPair", "rememberToken", "recalledToken", "forgetToken", ...Object.keys(scalars).map(tag => "test_" + tag)].map(n => mod + "." + n)];
			cfg.exports.push(...["pickObject", "rejectBox", "rejectSaved", "mixedFault"].map(n => mod + "." + n));
			await writeFile(join(project, "lean-bridge.exports.json"), canonicalJson(cfg));
			if(route === "reviewed")
			{
				const file = join(project, "workshop.binding-ir.json");
				if(mod === "Workshop")
				{
					const stale = structuredClone(reviews.get(name));
					const source = stale.declarations.find(d => d.source.declaration === "Workshop.mixedFault").source;
					delete source.extensions["lean-bridge.dev/error-payload-site"];
					await writeFile(file, canonicalJson(stale));
					const rejected = join(root, "stale-out");
					await assert.rejects(exec(process.execPath, [cli, "build", "--project", project, "--target", "rubygems", "--output", rejected, "--json", "--progress", "none"]),
						e => /Reviewed API differs from compiled host exports/u.test(e.stdout + e.stderr));
					await assert.rejects(readFile(join(rejected, "package-set-receipt.json")), { code: "ENOENT" });
				}
				await writeFile(file, canonicalJson(reviews.get(name)));
			}
			try
			{ await exec(process.execPath, [cli, "build", "--project", project, "--target", "rubygems", "--output", out, "--json", "--progress", "none"]); }
			catch(e)
			{ throw new Error(e.stdout + "\n" + e.stderr, { cause: e }); }
			const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(out, "package-set-receipt.json") });
			assert.equal(receipt.profiles[0].id, "native-ruby-host-v1");
			const [a] = receipt.packages[0].artifacts, api = await json(join(out, "binding-ir.json")), ev = await json(join(out, "host-export-evidence.json"));
			assert.equal(receipt.packages[0].name, name); assert.equal(receipt.source.treeSha256, ev.sourceTreeSha256);
			assert.equal(api.types.find(t => t.id === "host:meter.Box").host.identity, "weak-canonical");
			assert.equal(api.types.find(t => t.id === "host:meter.Token").host.identity, "strong-canonical");
			const decl = n => api.declarations.find(d => d.source.declaration === mod + "." + n);
			const lease = { scope: "explicit", anchor: null }, [box, token] = ["Box", "Token"].map(n => ({ kind: "named", id: "host:meter." + n }));
			const picked = decl("pickObject").result, failure = n => decl(n).source.extensions["lean-bridge.dev/error-payload-site"];
			assert.deepEqual(picked.type.arguments, [box, token]); assert.equal(picked.ownership, "lease"); assert.deepEqual(picked.lifetime, lease);
			assert.deepEqual(failure("rejectBox"), { type: box, ownership: "lease", lifetime: lease });
			const nested = failure("mixedFault"); assert.deepEqual(nested.type.arguments[0].arguments, [token, box]);
			assert.equal(nested.ownership, "lease"); assert.deepEqual(nested.lifetime, lease);
			assert.equal(ev.reviewedSourceSha256, route === "ordinary" ? null : sha256(canonicalJson(reviews.get(name))));
			if(route === "ordinary") reviews.set(name, api); else assert.deepEqual(api, reviews.get(name));
			assert.ok(!seen.has(a.sha256)); seen.add(a.sha256);
			const path = join(handoffs, basename(a.path)); await copyFile(join(out, a.path), path); packs.push(path);
			await rm(project, { recursive: true }); await rm(out, { recursive: true });
			t.diagnostic(route + " " + name + " " + a.bytes + " " + a.sha256 + "; receipt " + result.receiptSha256);
		}
		const gems = join(root, "installed"), relocated = join(root, "consumer gems");
		await mkdir(gems);
		for(const p of packs)
		{
			await exec(ruby, ["-S", "gem", "install", "--local", "--no-document", "--ignore-dependencies", "--install-dir", gems, p], { env: { ...process.env, GEM_HOME: gems, GEM_PATH: gems } });
			await rm(p); await rm(join(gems, "cache", basename(p)), { force: true });
		}
		await rename(gems, relocated); const app = join(root, "consumer.rb"); await copyFile(join(fixture, "consumer.rb"), app);
		const scalarApp = join(root, "scalars.rb"); await copyFile(join(fixture, "scalars.rb"), scalarApp);
		const kindApp = join(root, "nominals.rb"); await copyFile(join(fixture, "nominals.rb"), kindApp);
		const scalarResult = await exec(ruby, [kindApp], { cwd: root, env: { PATH: "/no-consumer-tools", GEM_HOME: relocated, GEM_PATH: relocated, LEAN_NUM_THREADS: "1" }, timeout: 30000 });
		assert.match(scalarResult.stdout, /strong and weak kinds; both binding orders; live=0/u);
		assert.match(scalarResult.stdout, /leased values and declared errors survived GC after both bindings closed; live=0/u);
		assert.match(scalarResult.stdout, /two installed gems: .*live=0/u);
		assert.match(scalarResult.stdout, /19 primitive types; live=0/u); t.diagnostic(route + " " + scalarResult.stdout.trim()); await rm(relocated, { recursive: true });
	}
});
