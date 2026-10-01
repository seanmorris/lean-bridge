/**
 * Execute nominal PHP members against real Lean and original ownership slots.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedPhpCalls } from "../src/backends/php/owned-calls.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRustBorrowReviewedIr } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedRustTransferReviewedIr } from "./helpers/owned-rust-transfer-fixture.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./helpers/owned-rust-receiver-fixture.mjs";
import { ownedJvmPlainReceiverConfiguration, ownedJvmPlainReceiverReviewedIr, ownedJvmPlainReceiverSource } from "./helpers/owned-jvm-receiver-fixture.mjs";
import { compileOwnedPhpFixture } from "./helpers/owned-php-native.mjs";
import { ownedPhpReceiverProbe, ownedPhpPlainReceiverProbe, ownedPhpRetiredIdentityProbe, ownedPhpUnanchoredReceiverProbe } from "./helpers/owned-php-receiver-fixture.mjs";
import { rejectOwnedPhpReceiverMutants } from "./helpers/owned-php-receiver-mutants.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const options = { transferredInputs: true, anchoredResults: true, receiverExports: true };
const enabled = process.env.LEAN_BRIDGE_OWNED_PHP_RECEIVER_TEST === "1";

test("PHP receivers preserve native argument positions and nonreceiver generated sources", () => {
	const ir = ownedRustReceiverReviewedIr(), before = structuredClone(ir);
	assert.throws(() => generateOwnedPhpCalls(ir, { ...options, receiverExports: false }), /only synchronous function exports/u);
	const model = generateOwnedPhpCalls(ir, options), api = model.files["src/Api.php"];
	assert.deepEqual(ir, before);
	for(const name of ["Ticket", "Bundle", "Choice", "Tree"])
		assert.match(api, new RegExp(`final class ${name}Value extends Value`, "u"));
	assert.match(api, /public function chooseTicket\(mixed \$owner1\): TicketValue/u);
	assert.match(api, /'serial' => serial\(\$this->get\(\)\)/u);
	assert.match(api, /'primary' => primary\(\$this\)/u);
	const choose = model.functions.findIndex(fn => fn.name === "chooseTicket");
	assert.equal(model.calls[choose].anchor, 1);
	assert.equal(model.calls[choose].parameters[1].anchor, true);
	assert.deepEqual(model.functions[choose].publicParameters, ["receiver", "owner1"]);
	for(const name of ["get", "close", "closed", "share", "retain", "equals", "hashCode", "sameIdentity"])
	{
		const collision = structuredClone(ir);
		collision.declarations.find(fn => fn.name === "serial").name = name;
		assert.throws(() => generateOwnedPhpCalls(collision, options), /Reserved or duplicate PHP receiver member/u);
	}
	const renamed = structuredClone(ir);
	const renamedDeclaration = renamed.declarations.find(fn => fn.name === "chooseTicket");
	renamedDeclaration.parameters[0].name = "receiver";
	renamedDeclaration.result.lifetime.anchor = "receiver";
	const renamedModel = generateOwnedPhpCalls(renamed, options);
	assert.deepEqual(renamedModel.functions.find(fn => fn.name === "chooseTicket").publicParameters, ["receiver_", "receiver"]);
	assert.match(renamedModel.files["src/Api.php"], /return choose_ticket\(\$this->get\(\), \$receiver\);/u);
	for(const fixture of [ownedAggregateReviewedIr, ownedRustTransferReviewedIr, ownedRustBorrowReviewedIr])
	{
		const previous = generateOwnedPhpCalls(fixture(), { transferredInputs: true, anchoredResults: true });
		const optedIn = generateOwnedPhpCalls(fixture(), options);
		assert.deepEqual(optedIn.files, previous.files);
		assert.equal(optedIn.nativeSource, previous.nativeSource);
	}
	for(const consuming of [false, true])
	{
		const plain = generateOwnedPhpCalls(ownedJvmPlainReceiverReviewedIr(consuming), { ...options, hostCallbacks: false });
		assert.ok(plain.wholeOwners && !plain.c.anchoredResults);
		assert.doesNotMatch(plain.files["src/Api.php"], /WithRecovery|with_recovery/u);
		assert.doesNotMatch(plain.files["src/Internal/OwnedRuntime.php"], /_result_validate/u);
		assert.match(plain.files["src/Internal/OwnedRuntime.php"], /function sameIdentity\(NativeBinding \$other\)/u);
		assert.match(plain.c.header, /_equal\([^]*bool \*out\)/u);
	}
});

test("PHP receiver sources parse and native callback signatures compile", { skip: !enabled, timeout: 120000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-receiver-signatures-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const models = [generateOwnedPhpCalls(ownedRustReceiverReviewedIr(), options)
		, generateOwnedPhpCalls(ownedJvmPlainReceiverReviewedIr(true), { ...options, hostCallbacks: false })];
	for(const model of models)
	{
		for(const [path, source] of Object.entries(model.files))
		{
			await saveLakeFile(directory, path, source);
			await runCopied(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", ["-n", "-l", path], directory);
		}
		await saveLakeFile(directory, `${model.c.prefix}.h`, model.c.header);
		await saveLakeFile(directory, "receivers.c", model.nativeSource);
		await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-I", directory, "receivers.c"], directory);
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`PHP receiver methods and properties preserve original owners (${mode})`, {
	skip: !enabled, timeout: 600000
}, async t => {
	const compiled = await compileOwnedPhpFixture(t, {
		...(mode === "ordinary" ? { configuration: await ownedRustReceiverConfiguration() } : { reviewedIr: ownedRustReceiverReviewedIr() })
		, sourceSuffix: ownedRustReceiverSource
		, ...options
		, evidenceName: `php-receivers-${mode}-inputs.json`
	});
	const source = await ownedPhpReceiverProbe();
	const observed = await compiled.execute(source).catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details ?? {})}`, { cause: error }); });
	assert.ok(observed.checks > 2350); assert.ok(observed.heldErrors > 300);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	assert.deepEqual(observed.functions, compiled.model.functions.map(fn => fn.name).sort());
	for(const shape of ["borrow", "move", "mixed"]) for(const domain of ["php", "native"])
	{
		assert.ok(observed.faults[shape][domain].before > 0);
		if(shape !== "borrow") assert.ok(observed.faults[shape][domain].after > 0);
	}
	t.diagnostic(JSON.stringify(observed));
	const weakObserved = await compiled.execute(source.replace("strict_types=1", "strict_types=0"));
	assert.deepEqual(weakObserved, observed);
	const mutants = await rejectOwnedPhpReceiverMutants(compiled, source);
	assert.equal(mutants.length, 9);
	assert.deepEqual(await compiled.execute(source), observed);
	await saveLakeFile("build/owned-php-receivers", `${mode}.json`, canonicalJson({ mode
		, actualLean: true, installedPackage: false, observed, weakObserved, mutants
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.c.native.model.component }
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, text]) => [path, sha256(text)]))
		, nativeSourceSha256: sha256(compiled.implementation)
		, publicHeaderSha256: sha256(compiled.model.c.header)
		, consumerSha256: sha256(source)
	}));
});

for(const mode of ["ordinary", "reviewed"]) for(const consuming of [false, true]) test(`PHP plain resource receivers (${mode}, consuming=${consuming})`, {
	skip: !enabled, timeout: 600000
}, async t => {
	const compiled = await compileOwnedPhpFixture(t, {
		...(mode === "ordinary" ? { configuration: await ownedJvmPlainReceiverConfiguration(consuming, false) } : { reviewedIr: ownedJvmPlainReceiverReviewedIr(consuming) })
		, sourceSuffix: ownedJvmPlainReceiverSource, receiverExports: true
		, transferredInputs: consuming, hostCallbacks: false
		, evidenceName: `php-plain-receivers-${mode}-${consuming}-inputs.json`
	});
	const source = ownedPhpPlainReceiverProbe(consuming);
	const observed = await compiled.execute(source).catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details ?? {})}`, { cause: error }); });
	assert.equal(observed.checks, consuming ? 26 : 25); assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	const retired = await compiled.execute(ownedPhpRetiredIdentityProbe);
	assert.deepEqual(retired, { checks: 5, live: 0, identities: 0 });
	t.diagnostic(JSON.stringify(observed));
	await saveLakeFile("build/owned-php-receivers", `${mode}-plain-${consuming}.json`, canonicalJson({
		mode, consuming, actualLean: true, installedPackage: false
		, anchoredResults: false, hostCallbacks: false, observed, retired
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.c.native.model.component }
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, text]) => [path, sha256(text)]))
		, nativeSourceSha256: sha256(compiled.implementation)
		, publicHeaderSha256: sha256(compiled.model.c.header)
		, consumerSha256: sha256(source)
		, retiredConsumerSha256: sha256(ownedPhpRetiredIdentityProbe)
	}));
});

for(const mode of ["ordinary", "reviewed"]) test(`PHP receiver callbacks and closures need no result anchors (${mode})`, {
	skip: !enabled, timeout: 600000
}, async t => {
	const configuration = await ownedRustReceiverConfiguration();
	for(const [name, contract] of Object.entries(configuration.contracts))
	{
		delete contract.result;
		if(Object.keys(contract).length === 0) delete configuration.contracts[name];
	}
	const ir = ownedRustReceiverReviewedIr();
	for(const fn of ir.declarations) if(fn.result.ownership === "borrow")
		Object.assign(fn.result, { ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
	const compiled = await compileOwnedPhpFixture(t, {
		...mode === "ordinary" ? { configuration } : { reviewedIr: ir }
		, sourceSuffix: ownedRustReceiverSource
		, transferredInputs: true, receiverExports: true, hostCallbacks: true
		, evidenceName: `php-receivers-${mode}-unanchored-inputs.json`
	});
	assert.ok(compiled.model.wholeOwners && !compiled.model.c.anchoredResults);
	assert.ok(!compiled.model.functions.some(fn => fn.anchor !== undefined));
	assert.doesNotMatch(Object.values(compiled.model.files).join("\n"), /_result_validate/u);
	const observed = await compiled.execute(ownedPhpUnanchoredReceiverProbe).catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details ?? {})}`, { cause: error }); });
	assert.deepEqual(observed, { checks: 13, live: 0, identities: 0 });
	await saveLakeFile("build/owned-php-receivers", `${mode}-unanchored.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false
		, resultAnchors: false, observed
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.c.native.model.component }
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, text]) => [path, sha256(text)]))
		, nativeSourceSha256: sha256(compiled.implementation)
		, publicHeaderSha256: sha256(compiled.model.c.header)
		, consumerSha256: sha256(ownedPhpUnanchoredReceiverProbe)
	}));
	t.diagnostic(JSON.stringify({ mode, ...observed }));
});
