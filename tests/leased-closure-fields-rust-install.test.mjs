/** @file Exercise public direct function replies from an installed, offline Cargo crate. */
import assert from "node:assert/strict";
import {copyFile, mkdir, mkdtemp, readFile, rename, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../src/build/canonical-build.mjs";
import {canonicalJson, sha256} from "../src/capsule/node.mjs";
import {generateOwnedRustCallables} from "../src/backends/rust/owned-callables.mjs";
import {generateOwnedRustPackage} from "../src/backends/rust/owned-package.mjs";
import {readVerifiedPackageSetReceipt} from "../src/release/package-set-receipt.mjs";
import {copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied} from "./helpers/copied-fixture-install.mjs";
import {saveLakeFile} from "./helpers/lake-workspace.mjs";
import {leasedClosureFieldReviewedIr} from "./helpers/owned-aggregate-fixture.mjs";
import {copyPackageSetHandoff, retainPackageSetEvidence} from "./helpers/package-set.mjs";
import {prepareStagedQuoteProject} from "./helpers/staged-quote-project.mjs";
import {prepareRustCorpusDependencies} from "./helpers/type-corpus-rust.mjs";

const fixtures = resolve("tests/fixtures/structured-types");
const source = () => readFile(join(fixtures, "tariff-staged.rs"), "utf8");
const cases = ["flat scalar reply", "fresh Lean function reply"
	, "independent caller still owns reply"
	, "closed recovery refused before host entry"
	, "original Rust error after allocation", "original panic resumes in Rust"
	, "closed reply refused and binding reusable"];
const parseResult = stdout => {
	const scenarios = stdout.trim().split("\n");
	assert.deepEqual(scenarios, cases);
	return {checks: cases.length, scenarios};
};
const json = async f => JSON.parse(await readFile(f));
const environment = {...nativeFixtureEnvironment(["rust"]), CARGO_NET_OFFLINE: "true"
	, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied")};
const replay = process.env.LEAN_BRIDGE_RUST_TARIFF_REPLAY, keep = process.env.LEAN_BRIDGE_RUST_TARIFF_KEEP;

test("Rust exposes an inferred closure entry without stealing a declared function's name", () => {
	const ir=leasedClosureFieldReviewedIr({staged: true,incoming: true});
	const d=ir.declarations.find(x=>x.name==="visitQuote"), other=structuredClone(d);
	other.name+="With";other.id+="With";other.overloadKey+="With";other.source.declaration+="With";
	ir.declarations.push(other);
	const p=generateOwnedRustPackage(ir),entry=p.contract.directClosureEntries.find(e=>e.declaration===d.id);
	assert.deepEqual(entry,{declaration: d.id,original: "visit_quote",name: "visit_quote_with_closure"});
	assert.match(p.apiSource,/pub fn visit_quote<F1: OwnedCallback\d+>/u);
	assert.match(p.apiSource,/pub fn visit_quote_with_closure<F1: FnMut\(Callback\w+, u32\) -> Result<u32, Error>>/u);
	assert.ok(p.files["README.md"].includes("visit_quote → visit_quote_with_closure"));
	const old=generateOwnedRustPackage(leasedClosureFieldReviewedIr({staged: true}));
	assert.equal(old.contract.directClosureEntries,undefined);
	assert.ok(!old.files["README.md"].includes("closure entry below"));
	assert.deepEqual(generateOwnedRustCallables(ir,{hostCallbacks: false}).closureEntries,[]);
});

test("Rust borrows sibling fields and keeps each callback parameter independently typed", async t => {
	const ir = leasedClosureFieldReviewedIr({exchange: true});
	const record = ir.types.find(def => def.name === "Tariff");
	const apply = ir.declarations.find(decl => decl.name === "applyTariff");
	record.fields.push({...record.fields[0], name: "rebate"}
		, {...record.fields[0], name: "label", type: {kind: "primitive", name: "string"}}
		, {...record.fields[0], name: "base", type: {kind: "primitive", name: "uint32"}});
	ir.aggregatePolicy.closureFields.push("Owned.Tariff.rebate");
	apply.parameters[1] = {...apply.parameters[0], name: "other"};
	const api = generateOwnedRustCallables(ir);
	const fields = api.types.find(node => node.id === record.id).hostInput.fields;
	assert.deepEqual(fields.filter(f => f.host).map(f => f.name), ["quote", "rebate"]);
	assert.equal(fields.find(f => f.name === "label").rustType, "&'a str");
	assert.equal(fields.find(f => f.name === "base").rustType, "u32");
	assert.equal(generateOwnedRustCallables(ir, {hostCallbacks: false}).c.hostFieldCalls.length, 0);
	if(!process.env.LEAN_BRIDGE_RUSTC && !replay && process.env.LEAN_BRIDGE_OWNED_RUST_STAGED_TEST !== "1") return;
	const dir = await mkdtemp(join(tmpdir(), "rust-mixed-input-records-"));
	t.after(() => rm(dir, {recursive: true, force: true}));
	await saveLakeFile(dir, "lib.rs", "mod owned_values;\n" + api.apiSource);
	await saveLakeFile(dir, "owned_values.rs", api.source);
	const compile = args => runCopied(environment.LEAN_BRIDGE_RUSTC, ["--edition=2021", ...args], dir, {PATH: "/usr/bin:/bin"});
	await compile(["--crate-name", "tariff_quotes", "--crate-type", "rlib", "lib.rs"]);
	const check = name => compile(["--emit=metadata", "--crate-type", "lib"
		, "--extern", "tariff_quotes=libtariff_quotes.rlib", name + ".rs"]);
	await saveLakeFile(dir, "mixed.rs", `use tariff_quotes::*;
pub fn mixed(leased: &Tariff, text: &str) -> Result<u32, Error> {
    let mut n = 1;
    let mut row = TariffInput { quote: |x| { n += 1; Ok(x + n) }, rebate: &leased.rebate, label: text, base: 2 };
    let mut from_lean = TariffInput::from(leased);
    apply_tariff_with_host_fields(&mut row, &mut from_lean)?;
    apply_tariff_with_host_fields(&mut from_lean, &mut row)
}`);
	await check("mixed");
	await saveLakeFile(dir, "expired.rs", `use tariff_quotes::*;
pub fn misuse() -> Result<u32, Error> {
    let source = make_tariff(1)?;
    let mut view = TariffInput::from(&source);
    drop(source);
    apply_tariff_with_host_fields(&mut view, &mut TariffInput::from(&make_tariff(2)?))
}`);
	await assert.rejects(check("expired"), err => {
		assert.match(err.details.stderr, /error\[E0505\]: cannot move out of `source` because it is borrowed/u);
		return true;
	});
});

const prepare = async ({dir, route, handoff, deps, t}) => {
	await mkdir(deps, {recursive: true});
	if(replay)
	{
		const original = join(resolve(replay), route);
		await copyPackageSetHandoff(join(original, "package"), handoff);
		const record = await json(join(original, "dependencies.json"));
		assert.equal(record.archive, "rust-dependencies.tar.gz");
		await copyFile(join(original, record.archive), join(deps, record.archive));
		return record;
	}
	const project = join(dir, "source"), output = join(dir, "producer");
	await prepareStagedQuoteProject(project, route, "cargo");
	try
	{
		await buildCanonicalProject({projectRoot: project, outputRoot: output
			, targets: ["cargo"]
			, environment
			, onProgress: e => t.diagnostic(e.message)});
	}
	catch(error)
	{
		if(error.details) t.diagnostic(JSON.stringify(error.details));
		throw error;
	}
	await copyPackageSetHandoff(output, handoff);
	const dependencies = await prepareRustCorpusDependencies({rustRoot: join(output, "native/rust")
		, directory: dir, handoff: deps, environment});
	await rm(project, {recursive: true}); await rm(output, {recursive: true});
	if(keep)
	{
		const dest = join(resolve(keep), route);
		await retainPackageSetEvidence(handoff, join(dest, "package"));
		await copyFile(join(deps, dependencies.archive), join(dest, dependencies.archive));
		await saveLakeFile(dest, "dependencies.json", canonicalJson(dependencies));
	}
	return dependencies;
};

const rejected = [
	["missing_recovery", "let _ = staged_quote(|b| Ok(make_tariff(b)?.quote), 9, 3);"]
	, ["scalar_reply", "let _ = staged_quote(with_recovery(|_| Ok(42u32), make_tariff(9)?.quote), 9, 3);"]
];
for(const route of ["ordinary", "reviewed"]) test("installed Rust direct function replies: " + route, {
	skip: !replay && process.env.LEAN_BRIDGE_OWNED_RUST_STAGED_TEST !== "1"
	, timeout: 1200000
}, async t => {
	const dir = await mkdtemp(join(tmpdir(), "rust-tariff-")), handoff = join(dir, "handoff");
	t.after(() => rm(dir, {recursive: true, force: true}));
	const consumer = join(dir, "consumer"), deps = join(consumer, "dependencies");
	const dependencies = await prepare({dir, route, handoff, deps, t});
	const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(handoff, "package-set-receipt.json")});
	assert.deepEqual(result.packages, [{target: "cargo", ecosystem: "cargo", name: "tariff-quotes", version: "1.0.0"}]);
	const installed = await installCopiedConsumer({profile: "rust", consumer
		, handoff, packages: receipt.packages, dependencies, environment
		, fixture: {source, parseResult, expectedChecks: cases.length}});
	const root = join(consumer, "rust"), crate = join(root, "tariff-quotes-1.0.0");
	const model = await json(join(crate, "lean-bridge/component/model.json"));
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), route === "reviewed");
	const {contract} = await json(join(crate, "binding-manifest.json"));
	const hostFields = !replay || process.env.LEAN_BRIDGE_RUST_TARIFF_REQUIRE_HOST_FIELDS === "1" || Boolean(contract.hostInputRecords);
	if(hostFields) assert.deepEqual(contract.hostInputRecords, [{type: "lean:Owned.Tariff", input: "TariffInput", fields: ["quote"], lifetime: "call"}]);
	assert.equal(sha256(await readFile(join(crate, "Cargo.lock"))), dependencies.lockSha256);
	const compilerEnv = {...copiedCleanEnvironment, PATH: "/usr/bin:/bin"
		, RUSTC: environment.LEAN_BRIDGE_RUSTC, CARGO_HOME: join(root, "cargo-home")
		, CARGO_NET_OFFLINE: "true"};
	const cargo = args => runCopied(environment.LEAN_BRIDGE_CARGO, args, root, compilerEnv);
	const probe = await readFile(join(fixtures, "tariff-rust-probe.rs"));
	await saveLakeFile(root, "observer.rs", probe);
	const fields = await readFile(join(fixtures, "tariff-fields.rs"));
	await saveLakeFile(root, "field-tests/consumer.rs", fields);
	await saveLakeFile(root, "field-tests/observer.rs", probe);
	const invalid = [...rejected];
	const hostSource = await readFile(join(fixtures, "tariff-host-fields.rs"));
	if(hostFields)
	{
		await saveLakeFile(root, "host-tests/consumer.rs", hostSource);
		await saveLakeFile(root, "host-tests/observer.rs", probe);
		invalid.push(["wrong_field_reply", "let _ = apply_tariff_with_host_fields(&mut TariffInput { quote: |_| Ok(true) }, 1);"]);
	}
	const bins = ["observer", ...invalid.map(([name]) => name)];
	let manifest = await readFile(join(root, "Cargo.toml"), "utf8");
	for(const name of bins) manifest += `\n[[bin]]\nname = "${name}"\npath = "${name}.rs"\n`;
	manifest += '\n[[bin]]\nname = "fields"\npath = "field-tests/observer.rs"\n';
	if(hostFields) manifest += '\n[[bin]]\nname = "host_fields"\npath = "host-tests/observer.rs"\n';
	await saveLakeFile(root, "Cargo.toml", manifest);
	const refused = [];
	for(const [name, statement] of invalid)
	{
		await saveLakeFile(root, name + ".rs", `use tariff_quotes::*;\nfn main() -> Result<(), Error> { ${statement} Ok(()) }\n`);
		await assert.rejects(cargo(["check", "--offline", "--locked", "--bin", name]), error => {
			assert.match(error.details.stderr, /OwnedCallback\d+/u);
			assert.match(error.details.stderr, /error\[E027[17]\]/u);
			return true;
		});
		refused.push(name);
	}
	await cargo(["build", "--offline", "--locked", "--bin", "observer", "--bin", "fields", ...hostFields ? ["--bin", "host_fields"] : []]);
	const binary = join(dir, "relocated-observer"), plain = join(dir, "relocated-consumer");
	await rename(join(root, "target/debug/observer"), binary);
	const fieldBinary = join(dir, "relocated-fields");
	await rename(join(root, "target/debug/fields"), fieldBinary);
	const hostBinary = join(dir, "relocated-host-fields");
	if(hostFields) await rename(join(root, "target/debug/host_fields"), hostBinary);
	await rename(join(root, "target/debug/consumer"), plain);
	await rm(consumer, {recursive: true}); await rm(handoff, {recursive: true});
	await rm(join(dir, "rust-dependencies"), {recursive: true, force: true});
	const publicRun = await runCopied(plain, [], dir);
	assert.equal(publicRun.stderr, "");
	parseResult(publicRun.stdout);
	const run = await runCopied(binary, [], dir);
	assert.equal(run.stderr, "");
	const lines = run.stdout.trim().split("\n");
	const identities = /^identities:([\d,]+)$/u.exec(lines.pop())?.[1].split(",").map(Number);
	assert.deepEqual(identities, Array(8).fill(0));
	const held = Number(/^held:(\d+)$/u.exec(lines.pop())?.[1]);
	assert.ok(held > 0, "the observer must see a known live lease");
	assert.deepEqual(lines, cases);
	const dest = resolve("build/staged-rust-callback");
	await saveLakeFile(dest, route + ".package-set.json", canonicalJson(receipt));
	const evidence = {schemaVersion: 1, route
		, packageSetSha256: result.receiptSha256
		, consumerSha256: installed.consumerSha256, probeSha256: sha256(probe)
		, dependenciesSha256: dependencies.sha256, lockSha256: dependencies.lockSha256
		, compileRejected: refused, relocated: lines, held, identities};
	await saveLakeFile(dest, route + ".execution.json", canonicalJson(evidence));
	const fieldRun = await runCopied(fieldBinary, [], dir);
	assert.equal(fieldRun.stderr, "");
	const fieldCases = fieldRun.stdout.trim().split("\n");
	assert.equal(fieldCases.pop(), "identities:0,0,0,0,0,0,0,0");
	assert.equal(fieldCases.pop(), "held:" + held);
	assert.deepEqual(fieldCases, [
		"clone survives explicit close of the original field"
		, "caller-built record survives a round trip and drop"
		, "extracted function owns its captured price"
		, "repacked function outlives the original owner"
		, "host FnMut borrow expires even inside a returned record"
		, "closed field is not a valid input", "a later valid record still works"
	]);
	await saveLakeFile(dest, route + ".fields.json", canonicalJson({route
		, packageSetSha256: result.receiptSha256, clientSha256: sha256(fields)
		, probeSha256: sha256(probe), relocated: fieldCases, held, identities}));
	if(hostFields)
	{
		const run = await runCopied(hostBinary, [], dir);
		assert.equal(run.stderr, "");
		const rows = run.stdout.trim().split("\n");
		assert.equal(rows.pop(), "identities:0,0,0,0,0,0,0,0"); assert.equal(rows.pop(), "held:" + held);
		assert.deepEqual(rows, ["FnMut capture survives two calls"
			, "nested callbacks borrow local state"
			, "returned record and function reject expired callback"
			, "original returned error and healthy retry"
			, "original panic resumes after the call"
			, "closed field rejected before dispatch"
			, "genuine Lean lease outlives its source"]);
		await saveLakeFile(dest, route + ".host-fields.json", canonicalJson({route
			, packageSetSha256: result.receiptSha256, clientSha256: sha256(hostSource)
			, dependenciesSha256: dependencies.sha256
			, lockSha256: dependencies.lockSha256
			, probeSha256: sha256(probe), relocated: rows, held, identities
			, compileRejected: "wrong_field_reply"}));
	}
	t.diagnostic("Offline Cargo and relocated observer passed: " + result.receiptSha256);
});
