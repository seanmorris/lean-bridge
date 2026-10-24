/**
 * Build actual owned PHP-Wasm archives and consume them after offline install.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, readFile, readdir, rm } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPhpWasmCopiedRuntime, readVerifiedPhpWasmCopiedComponent } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { buildPhpWasmCopiedPackages, readVerifiedPhpWasmCopiedPackageSet } from "../../src/release/php-wasm-copied-package.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./owned-dotnet-callback-fixture.mjs";
import { ownedSubtypePackageReviewedIr } from "./owned-aggregate-fixture.mjs";
import { bindPhpWasmReceiptArchives, installPhpWasmGraphPackages } from "./php-wasm-graph-packages.mjs";
import { bundlePhpWasmGraph } from "./php-wasm-graph-browser.mjs";
import { checkOwnedPhpWasmBrowser } from "./owned-php-wasm-browser.mjs";
import { buildOwnedPhpWasmPeer, checkOwnedPhpWasmCoexistence } from "./owned-php-wasm-coexistence.mjs";
import { checkOwnedPhpWasmCoexistenceBrowser } from "./owned-php-wasm-coexistence-browser.mjs";
import { buildOwnedPhpWasmObserver } from "./owned-php-wasm-observer.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { installOwnedPhpWasmCli } from "./owned-php-wasm-cli.mjs";
import { copyPackageSetHandoff, retainPackageSetEvidence } from "./package-set.mjs";
import { prepareOwnedPhpWasmRuntime } from "./owned-php-wasm-runtime.mjs";
import { compileOwnedPhpZendModel } from "../../src/backends/php/owned-zend-model.mjs";
import { ownedRustTransferConfiguration, ownedRustTransferReviewedIr, ownedRustTransferSource } from "./owned-rust-transfer-fixture.mjs";
import { phpWasmInventory } from "./type-corpus-php-wasm-install.mjs";
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr, ownedRustBorrowSource } from "./owned-rust-borrow-fixture.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./owned-rust-receiver-fixture.mjs";
import { ownedPhpInstalledReceiverProbe } from "./owned-php-receiver-fixture.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { expectedOwnedPhpInstalledCallback, ownedPhpInstalledCallbackProbe } from "./owned-php-callback-result-installed.mjs";
import { ownedCheckedRecordFixture } from "./owned-checked-record-fixture.mjs";
import {
	ownedCheckedRecordJavaScriptConfiguration
	, ownedCheckedRecordJavaScriptReviewedIr
} from "./owned-checked-record-javascript-fixture.mjs";

/**
 * Run an installed package with both autoload and extension-loading modes.
 *
 * @param name - Installed component npm name.
 * @param wholeOwners - Public resource results use whole Value owners.
 * @param phpNamespace - Generated namespace used by the installed component.
 */
const hostSource = (name, wholeOwners = false, phpNamespace = "LeanOwnedAggregates") => `import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {PhpNode} from 'php-wasm/PhpNode';
import descriptor from ${JSON.stringify(name)};
process.setUncaughtExceptionCaptureCallback(error=>{console.error(error.stack);process.exit(1);});
const [arrangement,loading,strict]=process.argv.slice(2),libraries=[];
const api=loading==='lazy'?descriptor.lazy:descriptor;
const selected=arrangement==='composer'?api.extensions:api;
const php=new PhpNode({version:'8.4',autoTransaction:false,ini:'memory_limit=512M',
  sharedLibs:loading==='startup'?[selected]:[],dynamicLibs:[...(loading==='lazy'?[selected]:[]),{name:'observer.so',url:new URL('./observer.so',import.meta.url),ini:false}],
  locateFile:name=>{if(name.startsWith('php8.4-lb_')||name.startsWith('liblean_bridge_php_wasm_copied_'))libraries.push(name);}});
let stdout='',stderr='';
php.addEventListener('output',event=>{stdout+=event.detail.join('');});php.addEventListener('error',event=>{stderr+=event.detail.join('');});
const run=async source=>{const status=await php.run(source);if(status||stderr)throw Error(JSON.stringify({status,stdout,stderr}));};
await php.binary;
const initial=loading==='lazy'?0:2;assert.equal(libraries.length,initial);
const mount=async(source,target)=>{await php.mkdir(target);for(const file of await readdir(source,{withFileTypes:true})){
  if(file.isDirectory())await mount(join(source,file.name),target+'/'+file.name);
  else await php.writeFile(target+'/'+file.name,await readFile(join(source,file.name)));}};
if(arrangement==='composer'){await mount('vendor','/app-vendor');await run("<?php require '/app-vendor/autoload.php';");}
else await run("<?php require '"+api.autoload+"';");
assert.equal(libraries.length,initial);
await run("<?php try { ${phpNamespace}\\\\new_ticket(42,'invalid'); throw new Exception('Missing rejection'); } catch(TypeError $error) {}");
assert.equal(libraries.length,initial,'Invalid input initialized a lazy extension');
await php.writeFile('/consumer.php',(await readFile('consumer.php','utf8')).replace('strict_types=1','strict_types='+strict));
await run("<?php require '/consumer.php';");
const observed=JSON.parse(stdout);assert.equal(libraries.length,2);assert.equal(new Set(libraries).size,2);
const snapshot=async()=>{stdout='';stderr='';await run("<?php if(!function_exists('owned_installed_snapshot'))dl('observer.so'); gc_collect_cycles(); echo json_encode(owned_installed_snapshot());");
  const value=JSON.parse(stdout);assert.equal(value.runtimeState,2);assert.equal(value.runtimeInitRuns,1);assert.equal(value.liveIdentities,0);return value;};
const cleaned=await snapshot();
await php.refresh();
stdout='';stderr='';
const autoload=arrangement==='composer'?'/app-vendor/autoload.php':api.autoload;
await run("<?php require '"+autoload+"'; $ticket=${phpNamespace}\\\\new_ticket(Brick\\\\Math\\\\BigInteger::of(77),'fresh'); "+
  "if((string)${phpNamespace}\\\\serial($ticket${wholeOwners ? "->get()" : ""})!=='77')throw new Exception('Request recovery failed'); $ticket->close(); echo 'recovered';");
assert.equal(stdout,'recovered');assert.equal(libraries.length,2);
const refreshed=await snapshot();
console.log(JSON.stringify({arrangement,loading,strict:Number(strict),observed,libraries,invalidStayedCold:true,requestRecovery:true,cleaned,refreshed}));
`;

export { hostSource as ownedPhpWasmInstalledHost };

const rejectDrift = async (root, runtimeIdentity) => {
	const inventory = JSON.parse(await readFile(join(root, "artifacts.json"), "utf8"));
	const receipt = JSON.parse(await readFile(join(root, "php-wasm-component.json"), "utf8"));
	const rejected = [];
	const check = async (path, bytes) => {
		const original = await readFile(join(root, path));
		try
		{
			await saveLakeFile(root, path, bytes);
			await saveLakeFile(root, "artifacts.json", canonicalJson({ ...inventory
				, files: { ...inventory.files, [path]: { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) } } }));
			await assert.rejects(() => readVerifiedPhpWasmCopiedComponent(root, runtimeIdentity));
			rejected.push(path);
		}
		finally
		{
			await saveLakeFile(root, path, original);
			await saveLakeFile(root, "artifacts.json", canonicalJson(inventory));
		}
	};
	for(const ownedGraph of [undefined, { ...receipt.ownedGraph, layoutSha256: "0".repeat(64) }, { ...receipt.ownedGraph, extra: true }])
		await check("php-wasm-component.json", canonicalJson({ ...receipt, ownedGraph }));
	if(receipt.ownedGraph.inputTransfers)
		for(const mutate of [
			value => { value.schemaVersion = 1; }
			, value => { delete value.inputTransfers; }
			, value => { value.inputTransfers.ownership = "one-wrapper"; }
			, value => { value.inputTransfers.consumption = "after-lean-call"; }
			, value => { value.inputTransfers.exports[0].parameters = []; }
			, value => { value.inputTransfers.exports.pop(); }
		]) {
			const ownedGraph = structuredClone(receipt.ownedGraph); mutate(ownedGraph);
			await check("php-wasm-component.json", canonicalJson({ ...receipt, ownedGraph }));
		}
	for(const path of Object.keys(receipt.ownedGraph.files))
		await check(path, Buffer.concat([await readFile(join(root, path)), Buffer.from("\n/* re-signed drift */\n")]));
	if(receipt.ownedGraph.resultAnchors)
		for(const mutate of [
			value => { value.schemaVersion = 2; }
			, value => { delete value.resultAnchors; }
			, value => { value.resultAnchors.anchor = "snapshot"; }
			, value => { value.resultAnchors.expiration = "never"; }
			, value => { value.resultAnchors.exports[0].parameter++; }
			, value => { value.resultAnchors.exports.pop(); }
		]) {
			const ownedGraph = structuredClone(receipt.ownedGraph); mutate(ownedGraph);
			await check("php-wasm-component.json", canonicalJson({ ...receipt, ownedGraph }));
		}
	if(receipt.ownedGraph.receiverExports)
		for(const mutate of [
			value => { value.schemaVersion = 3; }
			, value => { delete value.receiverExports; }
			, value => { value.receiverExports.exports.pop(); }
			, value => { value.receiverExports.exports[0].kind = "function"; }
			, value => { value.receiverExports.exports[0].argument = 1; }
		]) {
			const ownedGraph = structuredClone(receipt.ownedGraph); mutate(ownedGraph);
			await check("php-wasm-component.json", canonicalJson({ ...receipt, ownedGraph }));
		}
	if(receipt.ownedGraph.callbackResultAnchors)
		for(const mutate of [
			value => { value.schemaVersion = 4; }
			, value => { delete value.callbackResultAnchors; }
			, value => { value.callbackResultAnchors.signatures[0].parameter++; }
			, value => { value.callbackResultAnchors.hostResultHandoff = "after-callback"; }
			, value => { value.callbackResultAnchors.signatures.pop(); }
		]) {
			const ownedGraph = structuredClone(receipt.ownedGraph); mutate(ownedGraph);
			await check("php-wasm-component.json", canonicalJson({ ...receipt, ownedGraph }));
		}
	await readVerifiedPhpWasmCopiedComponent(root, runtimeIdentity);
	return rejected;
};

/**
 * Exercise ordinary and reviewed builds without compiler access in consumers.
 *
 * @param directory - Test-owned root, cleaned by the invoking test.
 * @param diagnostic - Progress reporter.
 * @param options - Select explicit consuming inputs or the borrowed fixture.
 * @param options.transferredInputs - Run all 26 consuming-fixture exports.
 * @param options.anchoredResults - Run original-owner borrowed results and moves.
 * @param options.receiverExports - Run nominal members and original receivers.
 * @param options.callbackVariant - Run callback-result owners in no-host, host or combined mode.
 * @param options.checkedRefinements - Run checked fields inside borrowed and transferred owners.
 * @param options.checkedRecords - Run true owned checked records, callbacks and closures.
 * @param options.resultOnly - Restrict checked-record acceptance to Lean-produced results.
 * @param options.evidenceRoot - Optional external directory retaining each original handoff.
 */
export const checkOwnedPhpWasmPackages = async (directory, diagnostic, { transferredInputs = false, anchoredResults = false, receiverExports = false, callbackVariant = null, checkedRefinements = false, checkedRecords = false, resultOnly = false, evidenceRoot = null } = {}) => {
	if(callbackVariant !== null && !["no-host", "host", "combined"].includes(callbackVariant)) throw new TypeError("Unknown PHP-Wasm callback-result variant");
	if(checkedRefinements && callbackVariant !== null) throw new TypeError("Checked-refinement ownership acceptance is callback-independent");
	if(checkedRecords && (checkedRefinements || callbackVariant !== null || transferredInputs || anchoredResults || receiverExports))
		throw new TypeError("Owned checked-record acceptance selects its complete capability set");
	if(resultOnly && !checkedRecords) throw new TypeError("Result-only mode belongs to owned checked-record acceptance");
	const callbackResultAnchors = callbackVariant !== null;
	if(callbackVariant === "combined") transferredInputs = anchoredResults = receiverExports = true;
	if(checkedRefinements) transferredInputs = true;
	if(checkedRecords && !resultOnly) transferredInputs = true;
	anchoredResults ||= receiverExports;
	transferredInputs ||= anchoredResults;
	const wholeOwners = !checkedRecords && (anchoredResults || receiverExports || callbackResultAnchors);
	const sourceFree = checkedRecords || transferredInputs || callbackResultAnchors;
	if(evidenceRoot !== null)
	{
		const inside = relative(resolve(directory), resolve(evidenceRoot));
		const outside = relative(resolve(evidenceRoot), resolve(directory));
		assert.ok((inside === ".." || inside.startsWith("../") || isAbsolute(inside))
			&& (outside === ".." || outside.startsWith("../") || isAbsolute(outside))
		, "Retained PHP-Wasm evidence must stay outside the test-owned author and consumer root");
	}
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const runtime = await prepareOwnedPhpWasmRuntime(directory), runtimeRoot = runtime.root;
	const emsdkRoot = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const phpSource = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
	diagnostic("Installing the standalone CLI with verified PHP-Wasm compiler inputs");
	const cli = await installOwnedPhpWasmCli({ directory: join(directory, "cli"), runtimeRoot, phpSource, leanPrefix, emsdkRoot });
	let consumer = checkedRecords ? await readFile(`tests/fixtures/structured-types/owned-checked-record-${resultOnly ? "result-only-" : ""}php-wasm.php`, "utf8")
		: checkedRefinements ? await readFile("tests/fixtures/structured-types/owned-subtype-php-wasm.php", "utf8")
			: callbackResultAnchors ? await ownedPhpInstalledCallbackProbe() : receiverExports ? await ownedPhpInstalledReceiverProbe() : await readFile(anchoredResults ? "tests/fixtures/structured-types/owned-installed-php-borrows.php"
				: transferredInputs ? "tests/fixtures/structured-types/owned-installed-php-wasm-transfers.php" : "tests/fixtures/structured-types/owned-php-wasm-installed.php", "utf8");
	if(wholeOwners) consumer = consumer.replace("require __DIR__ . '/vendor/autoload.php';", "// The host has already loaded the installed Composer or embedded autoloader.")
		.replace("'ordinaryAutoload' => true", "'phpBits' => PHP_INT_SIZE * 8, 'ordinaryAutoload' => true");
	if(callbackResultAnchors) consumer = consumer.replace("$variant = $argv[1] ?? '';", `$variant = '${callbackVariant}';`);
	const observations = [];
	for(const reviewed of [false, true])
	{
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), author = join(root, "author");
		const projectRoot = join(author, "project"), buildRoot = join(author, "compiled"), componentRoot = join(buildRoot, "php-wasm/component");
		const fixture = checkedRecords ? ownedCheckedRecordFixture
			: checkedRefinements ? "tests/fixtures/onboarding/owned-subtypes"
				: transferredInputs || callbackResultAnchors ? "tests/fixtures/onboarding/owned-aggregates" : "tests/fixtures/onboarding/owned-dotnet-callables";
		const leanSource = checkedRecords ? "OwnedCheckedRecords.lean" : "Owned.lean";
		for(const path of [leanSource, "lean-toolchain", "lakefile.toml"])
			await saveLakeFile(projectRoot, path, await readFile(join(fixture, path), "utf8") + (path === "Owned.lean" ? callbackResultAnchors
				? callbackVariant === "combined" ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource
				: transferredInputs ? receiverExports ? ownedRustReceiverSource : anchoredResults ? ownedRustBorrowSource : ownedRustTransferSource : "" : ""));
		const config = checkedRecords
			? ownedCheckedRecordJavaScriptConfiguration(reviewed ? "reviewed" : "ordinary", { resultOnly })
			: checkedRefinements
				? JSON.parse(await readFile(join(fixture, "lean-bridge.exports.json"), "utf8"))
				: callbackResultAnchors
					? await (callbackVariant === "combined" ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)()
					: receiverExports ? await ownedRustReceiverConfiguration() : anchoredResults ? await ownedRustBorrowConfiguration() : transferredInputs ? await ownedRustTransferConfiguration() : JSON.parse(await readFile(join(fixture, "lean-bridge.exports.json"), "utf8"));
		const selected = reviewed ? { schemaVersion: 1, modules: config.modules } : config;
		delete selected.targets;
		const packageSuffix = checkedRecords ? `-checked-record${resultOnly ? "-result-only" : ""}` : "";
		const npmSettings = { name: `@lean-bridge-test/owned-php-wasm${packageSuffix}`, version: "1.0.0" };
		const composerSettings = { name: `lean-bridge-test/owned-php-wasm${packageSuffix}`, version: "1.0.0" };
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ ...selected
			, targets: { "php-wasm": { npm: npmSettings, composer: composerSettings
				, ...callbackVariant === "no-host" || checkedRecords && resultOnly ? { hostCallbacks: false } : {} } } }));
		if(reviewed) await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(checkedRecords
			? ownedCheckedRecordJavaScriptReviewedIr({ resultOnly })
			: checkedRefinements
				? ownedSubtypePackageReviewedIr()
				: callbackResultAnchors
					? (callbackVariant === "combined" ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)()
					: receiverExports ? ownedRustReceiverReviewedIr() : anchoredResults ? ownedRustBorrowReviewedIr() : transferredInputs ? ownedRustTransferReviewedIr() : ownedDotnetCallbacksReviewedIr()));
		const before = await lakeInputState(projectRoot);
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: installed CLI builds the PHP-Wasm ownership release`);
		const cliBuild = await cli.build(projectRoot, buildRoot);
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const { model, receipt } = await readVerifiedPhpWasmCopiedComponent(componentRoot, runtime.identity);
		assert.equal(model.pointerBits, 32); assert.equal(model.schemaVersion, checkedRecords ? resultOnly ? 6 : 8 : callbackResultAnchors ? 11 : receiverExports ? 10 : anchoredResults ? 9 : transferredInputs ? 8 : 7);
		assert.equal(model.ownedGraph.transport, "owned-zend-v1"); assert.equal(model.exports.length, checkedRecords ? resultOnly ? 3 : 9 : checkedRefinements ? 5 : callbackResultAnchors ? callbackVariant === "combined" ? 30 : 27 : receiverExports ? 27 : transferredInputs ? 26 : 51);
		if(transferredInputs) assert.equal(model.ownedGraph.inputTransfers.exports.length, checkedRecords || checkedRefinements ? 1 : callbackResultAnchors ? 2 : anchoredResults ? 4 : 20);
		if(anchoredResults) assert.equal(model.ownedGraph.resultAnchors.exports.length, callbackResultAnchors ? 1 : receiverExports ? 20 : 19);
		if(receiverExports) assert.equal(model.ownedGraph.receiverExports.exports.length, callbackResultAnchors ? 5 : 16);
		if(callbackResultAnchors)
		{
			assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
			assert.equal(Boolean(model.ownedGraph.hostCallbacks), callbackVariant !== "no-host");
			for(const capability of ["inputTransfers", "resultAnchors", "receiverExports"])
				assert.equal(Boolean(model.ownedGraph[capability]), callbackVariant === "combined", capability);
		}
		if(checkedRefinements)
		{
			const declaration = name => model.bindingIr.declarations.find(item => item.name === name)
				.source.extensions["lean-lang.org/refinements"];
			const constructor = name => declaration(name).parameters[0]
				.fields[4].refinement.fields[0].refinement.constructor;
			assert.equal(constructor("echoRecord"), "Owned.checkedCount");
			assert.equal(constructor("echoRecordAlternate"), "Owned.checkedCountAlternate");
			assert.equal(constructor("transferRecord"), "Owned.checkedCount");
		}
		if(checkedRecords)
		{
			const refinement = name => model.bindingIr.declarations.find(item => item.name === name)
				?.source.extensions["lean-lang.org/refinements"];
			if(resultOnly)
			{
				const claimFor = refinement("claimFor");
				assert.deepEqual(claimFor.parameters, [null]);
				assert.equal(claimFor.result.kind, "option");
				assert.equal(claimFor.result.arguments[0].kind, "checked-record");
				assert.equal(claimFor.result.arguments[0].constructor, null);
				assert.equal(model.bindingIr.types.some(type => type.kind === "callback"), false);
				assert.equal(model.ownedGraph.inputTransfers, undefined);
				assert.equal(model.ownedGraph.hostCallbacks, undefined);
			}
			else
			{
				assert.equal(refinement("echoBooking").parameters[0].fields[1].refinement.constructor
					, "OwnedCheckedRecords.mkWindow");
				assert.equal(refinement("echoClaim").parameters[0].constructor
					, "OwnedCheckedRecords.mkClaim");
				assert.equal(refinement("transferClaim").parameters[0].constructor
					, "OwnedCheckedRecords.mkClaim");
				assert.equal(model.bindingIr.types.filter(type => type.kind === "callback").length, 2);
				assert.equal(model.ownedGraph.hostCallbacks.signatures.length, 2);
			}
		}
		const callbackExpected = callbackResultAnchors ? expectedOwnedPhpInstalledCallback(callbackVariant, "8.4.1") : null;
		const expected = checkedRecords ? { ownedCheckedRecord: true
			, mode: resultOnly ? "result-only" : "full"
			, ...resultOnly ? {} : { heldOriginalError: true } }
			: checkedRefinements ? { ownedSubtype: true }
				: callbackResultAnchors ? { ...Object.fromEntries(["checks", "phases", "variant", "actualLean", "installedPackage", "ordinaryAutoload"].map(key => [key, callbackExpected[key]])), iniDisabled: false }
					: transferredInputs ? { functions: compileOwnedPhpZendModel(model.bindingIr, { transferredInputs, anchoredResults, receiverExports }).functions.map(fn => fn.publicName).sort(), heldOriginalError: true }
						: { scalars: 19, structured: 23 };
		const inputs = { metadata: JSON.parse(await readFile(join(componentRoot, "metadata.json"), "utf8"))
			, sourceIdentity: model.sourceIdentity, component: model.component };
		const rejected = await rejectDrift(componentRoot, runtime.identity);
		const options = { componentRoot, runtimeRoot, leanPrefix, npmSettings, composerSettings };
		const releaseRoot = join(buildRoot, "packages/php-wasm");
		const release = { output: releaseRoot, ...await readVerifiedPhpWasmCopiedPackageSet(releaseRoot) };
		const reassembled = await buildPhpWasmCopiedPackages({ ...options, outputRoot: join(author, "reassembled") });
		assert.deepEqual(reassembled.report, release.report);
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: independently rebuilding and comparing package bytes`);
		const relocatedProject = join(author, "relocated-source"), repeatedRoot = join(author, "rebuilt"), rebuiltRoot = join(repeatedRoot, "php-wasm/component");
		await cp(projectRoot, relocatedProject, { recursive: true });
		const relocatedBefore = await lakeInputState(relocatedProject);
		const repeatedCliBuild = await cli.build(relocatedProject, repeatedRoot);
		assert.deepEqual(await lakeInputState(projectRoot), before);
		assert.deepEqual(await lakeInputState(relocatedProject), relocatedBefore);
		assert.deepEqual(JSON.parse(await readFile(join(rebuiltRoot, "artifacts.json"), "utf8")), JSON.parse(await readFile(join(componentRoot, "artifacts.json"), "utf8")));
		const repeated = await readVerifiedPhpWasmCopiedPackageSet(join(repeatedRoot, "packages/php-wasm"));
		assert.deepEqual(repeated.report, release.report);
		const retainedRoot = evidenceRoot === null ? null
			: join(evidenceRoot, reviewed ? "reviewed" : "ordinary", "handoff");
		const retained = retainedRoot === null ? null : await retainPackageSetEvidence(buildRoot, retainedRoot);
		const handoff = join(root, "handoff"), packageSetReceipt = await copyPackageSetHandoff(retainedRoot ?? buildRoot, handoff);
		if(retained !== null) assert.deepEqual(packageSetReceipt, retained.receipt);
		const archiveRoot = await bindPhpWasmReceiptArchives(handoff, release.report);
		if(retainedRoot !== null) await bindPhpWasmReceiptArchives(retainedRoot, release.report);
		assert.deepEqual(JSON.parse(await readFile(join(repeatedRoot, "package-set-receipt.json"), "utf8")), packageSetReceipt);
		if(!sourceFree) diagnostic(`${reviewed ? "reviewed" : "ordinary"}: building the independent copied peer`);
		const peer = sourceFree ? null : await buildOwnedPhpWasmPeer({ author, leanPrefix, runtimeRoot, emsdkRoot, phpSource, runtimeIdentity: runtime.identity });
		const observer = await buildOwnedPhpWasmObserver({ directory: join(author, "observer"), runtimeRoot, emsdkRoot, phpSource });
		const packageHandoff = join(root, "package-handoff");
		if(sourceFree)
		{
			await cp(releaseRoot, packageHandoff, { recursive: true });
			await rm(author, { recursive: true }); await assert.rejects(() => readdir(author), { code: "ENOENT" });
		}
		const installed = await installPhpWasmGraphPackages({ root
			, release: { ...release, output: sourceFree ? packageHandoff : releaseRoot, archiveRoot }
			, host, diagnostic, companions: peer ? [peer.release] : [] });
		if(sourceFree) installed.inventory = await phpWasmInventory(installed.deployment);
		if(sourceFree) await rm(packageHandoff, { recursive: true });
		else await rm(author, { recursive: true });
		await assert.rejects(() => readdir(author), { code: "ENOENT" });
		const verification = await cli.verify(join(handoff, "package-set-receipt.json"));
		if(retainedRoot !== null) await bindPhpWasmReceiptArchives(retainedRoot, release.report);
		await rm(handoff, { recursive: true });
		await saveLakeFile(installed.deployment, "observer.so", observer.bytes);
		await bundlePhpWasmGraph(installed.deployment, npmSettings.name);
		await saveLakeFile(installed.deployment, "consumer.php", consumer);
		const phpNamespace = checkedRecords ? "LeanOwnedCheckedRecords"
			: checkedRefinements ? "LeanOwnedSubtypes" : "LeanOwnedAggregates";
		const runner = hostSource(npmSettings.name, wholeOwners, phpNamespace); await saveLakeFile(installed.deployment, "run.mjs", runner);
		const minimumChecks = checkedRecords && resultOnly ? 4 : 101;
		const executions = [];
		for(const arrangement of ["embedded", "composer"])
		for(const loading of ["startup", "lazy"])
		for(const strict of [0, 1])
		{
			diagnostic(`${reviewed ? "reviewed" : "ordinary"}: installed ${arrangement}/${loading}/strict${strict}`);
			const result = await runCopied(process.execPath, ["run.mjs", arrangement, loading, String(strict)], installed.deployment, copiedCleanEnvironment);
			assert.equal(result.stderr, ""); const execution = JSON.parse(result.stdout);
			for(const [key, value] of Object.entries(expected)) assert.deepEqual(execution.observed[key], value, key);
			assert.equal(execution.observed.phpBits, 32); assert.ok(execution.observed.checks >= minimumChecks);
			executions.push(execution);
		}
		const browser = await checkOwnedPhpWasmBrowser(installed.deployment, diagnostic, expected, {
			anchoredResults: wholeOwners
			, minimumChecks, phpNamespace
		});
		const coexistence = peer ? await checkOwnedPhpWasmCoexistence(installed.deployment, diagnostic) : null;
		const coexistenceBrowser = peer ? await checkOwnedPhpWasmCoexistenceBrowser(installed.deployment, diagnostic) : null;
		observations.push({ reviewed, inputs, model, receipt, rejected, browser
			, ...sourceFree ? { sourceFreeInstallation: true, handoffRemoved: true } : {}
			, cliBuild, repeatedCliBuild, packageSetReceipt, verification
			, deterministicReassembly: true, receiptVerifiedWithoutProducer: true
			, packageReceipt: release.report
			, reproducedArchives: repeated.report.archives
			, ...peer ? { coexistence: { ...coexistence, browser: coexistenceBrowser, peer: peer.component, sourceFiles: peer.sourceFiles } } : {}
			, observer: observer.identity
			, independentlyRebuiltExactly: true, sourceUnchanged: true
			, installed, authorRemoved: true
			, consumerSha256: sha256(consumer), runnerSha256: sha256(runner)
			, executions });
		await rm(root, { recursive: true });
	}
	assert.equal((await readVerifiedPhpWasmCopiedRuntime(runtimeRoot)).identity, runtime.identity);
	return { schemaVersion: 1
		, profile: checkedRecords ? `installed-owned-checked-record-php-wasm-${resultOnly ? "result-only" : "full"}` : checkedRefinements ? "installed-owned-subtype-php-wasm" : callbackResultAnchors ? "installed-owned-php-wasm-callback-results" : receiverExports ? "installed-owned-php-wasm-receivers" : anchoredResults ? "installed-owned-php-wasm-borrows" : transferredInputs ? "installed-owned-php-wasm-transfers" : "installed-owned-php-wasm"
		, ...checkedRecords ? { mode: resultOnly ? "result-only" : "full" } : {}
		, compiledLean: true, installedPackage: true
		, installedCli: cli.identity, cliAdmission: true
		, runtimeSupplied: runtime.supplied
		, runtimeIdentity: runtime.identity, runtimeManifest: runtime.manifest
		, observations };
};
