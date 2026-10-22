/**
 * Installed npm/browser acceptance for proof-erased checked records that own
 * resources and cross host callbacks and returned Lean closures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalizeJsonValue } from "../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { validateExportConfiguration } from "../src/analyze/export-configuration.mjs";
import {
	reviewedOwnedSourceSelection, validateReviewedOwnedSource
} from "../src/analyze/reviewed-owned-source.mjs";
import { buildOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-component.mjs";
import { readVerifiedOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-artifacts.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { buildOwnedJavaScriptNpmPackages } from "../src/release/owned-javascript-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { checkOwnedJavaScriptBrowsers } from "./helpers/owned-javascript-npm-browser.mjs";
import { ownedCheckedRecordFixture } from "./helpers/owned-checked-record-fixture.mjs";
import {
	ownedCheckedRecordJavaScriptPackage
	, ownedCheckedRecordJavaScriptRoutes
	, ownedCheckedRecordJavaScriptSelection
} from "./helpers/owned-checked-record-javascript-fixture.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import {
	copyPackageSetHandoff, retainPackageSetEvidence
} from "./helpers/package-set.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_CHECKED_RECORD_JS_TEST === "1";
const browserEnabled
	= process.env.LEAN_BRIDGE_OWNED_CHECKED_RECORD_BROWSER_TEST === "1";
const routeVariable = "LEAN_BRIDGE_OWNED_CHECKED_RECORD_JS_ROUTES";
const routes = process.env[routeVariable]?.split(",")
	?? [...ownedCheckedRecordJavaScriptRoutes];
assert.ok(routes.length && routes.every(route =>
	ownedCheckedRecordJavaScriptRoutes.includes(route)
));
const target = resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME
	?? "/app/build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser");
const prepared = resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT
	?? "/app/build/lean-link-spike", "lazy");
const packagingRoot = resolve("build/owned-checked-record-javascript-packaging");
const reports = [];

test.before(async () => {
	if(enabled) await rm(packagingRoot, { recursive: true, force: true });
});

test("ordinary and reviewed JavaScript authors select the same full and result-only boundaries", () => {
	for(const mode of ["full", "result-only"])
	{
		const ordinary = ownedCheckedRecordJavaScriptSelection(`ordinary-${mode}`);
		const reviewed = ownedCheckedRecordJavaScriptSelection(`reviewed-${mode}`);
		const configuration = ordinary.configuration;
		assert.equal(validateExportConfiguration(configuration), configuration);
		assert.equal(configuration.targets.npm.name, mode === "full"
			? ownedCheckedRecordJavaScriptPackage
			: `${ownedCheckedRecordJavaScriptPackage}-result-only`);
		const document = reviewed.reviewedIr, source = canonicalJson(document);
		const review = { schemaVersion: 1, path: "reviewed.binding-ir.json"
			, source, sourceSha256: sha256(source)
			, semanticSha256: sha256(canonicalizeJsonValue(document)) };
		assert.deepEqual(validateReviewedOwnedSource(review), document);
		const selection = reviewedOwnedSourceSelection(review);
		assert.deepEqual(selection.exports, [...configuration.exports].sort());
		assert.deepEqual(selection.resources, configuration.resources);
		assert.deepEqual(selection.arities, mode === "full"
			? [["OwnedCheckedRecords.claimClosure", 0]] : []);
		assert.deepEqual(selection.ownedAggregates, configuration.ownedAggregates);
		if(mode === "result-only") assert.equal(selection.contracts, undefined);
		else
		{
			assert.deepEqual(selection.contracts["OwnedCheckedRecords.withClaimCallback"]
				.parameters[1].callable.result.refinement
				, configuration.contracts["OwnedCheckedRecords.withClaimCallback"]
				.parameters[1].callable.result.refinement);
			assert.deepEqual(selection.contracts["OwnedCheckedRecords.claimClosure"]
				.result.callable.parameters[0].refinement
				, configuration.contracts["OwnedCheckedRecords.claimClosure"]
				.result.callable.parameters[0].refinement);
		}
	}
});

test.after(async () => {
	if(enabled && reports.length === routes.length)
	{
		const complete = routes.length === ownedCheckedRecordJavaScriptRoutes.length
			&& ownedCheckedRecordJavaScriptRoutes.every(route => routes.includes(route));
		const reportName = complete ? "report.json"
			: `partial-${sha256(canonicalJson(routes.toSorted())).slice(0, 12)}.json`;
		await saveLakeFile(packagingRoot, reportName, canonicalJson(
				{
					schemaVersion: 1
					, profile: "installed-owned-checked-record-javascript"
					, reports: reports.toSorted((left, right) =>
						left.route.localeCompare(right.route)
					)
				}
		)
		);
	}
});

const fullProbe = name => `import api from ${JSON.stringify(name)};
export const close = () => api.close();
export function run() {
  let checks = 0;
  const check = value => { checks++; if(!value) throw new Error("Owned checked-record check " + checks); };
  const release = (value, seen = new Set()) => {
    if(value === null || value === undefined || seen.has(value)) return;
    if(typeof value === "object" || typeof value === "function") seen.add(value);
    if(value && typeof value.dispose === "function") { value.dispose(); return; }
    if(value && typeof value === "object") for(const child of Object.values(value)) release(child, seen);
  };
  const ticket = api.newTicket(20n, "checked");
  const retained = ticket.retain();
  const claim = {holder: ticket, quota: 7n};
  const echoed = api.echoClaim(claim);
  check(echoed.quota === 7n); check(api.serial(echoed.holder) === 20n);
  let claimRejected = false;
  try { api.echoClaim({...claim, quota: 21n}); } catch { claimRejected = true; }
  check(claimRejected); check(api.serial(ticket) === 20n);
  const booking = {holder: ticket, window: {lo: 3n, hi: 8n}};
  const echoedBooking = api.echoBooking(booking);
  check(echoedBooking.window.hi === 8n);
  let bookingRejected = false;
  try { api.echoBooking({...booking, window: {lo: 9n, hi: 2n}}); } catch { bookingRejected = true; }
  check(bookingRejected);
  let lateRejected = false;
  try { api.pairClaim(booking, {...claim, quota: 30n}); } catch { lateRejected = true; }
  check(lateRejected); check(api.serial(ticket) === 20n);
  const retainedEcho = api.echoClaim({holder: retained, quota: 8n});
  check(retainedEcho.quota === 8n);
  let retainedRejected = false;
  try { api.echoClaim({holder: retained, quota: 40n}); } catch { retainedRejected = true; }
  check(retainedRejected); check(api.serial(retained) === 20n);
  const moving = api.newTicket(30n, "moving"), kept = moving.retain();
  let transferRejected = false;
  try { api.transferClaim({holder: moving, quota: 31n}); } catch { transferRejected = true; }
  check(transferRejected); check(!moving.disposed); check(api.serial(moving) === 30n);
  const moved = api.transferClaim({holder: moving, quota: 9n});
  check(moving.disposed); check(moved.quota === 9n); check(api.serial(kept) === 30n);
  let callbackCalls = 0;
  const callbackResult = api.withClaimCallback(claim, value => {
    callbackCalls++; check(value.quota === 7n);
    return {holder: value.holder, quota: 10n};
  });
  check(callbackCalls === 1); check(callbackResult.quota === 10n);
  check(api.serial(callbackResult.holder) === 20n);
  let callbackRejected = false;
  try { api.withClaimCallback(claim, value => ({holder: value.holder, quota: 99n})); }
  catch { callbackRejected = true; }
  check(callbackRejected); check(api.serial(ticket) === 20n);
  const sentinel = new Error("checked callback"); let callbackThrown = false;
  try { api.withClaimCallback(claim, () => { throw sentinel; }); }
  catch(error) { callbackThrown = error === sentinel; }
  check(callbackThrown); check(api.serial(ticket) === 20n);
  const closure = api.claimClosure();
  const fromClosure = closure({holder: retained, quota: 6n});
  check(fromClosure.quota === 6n);
  let closureRejected = false;
  try { closure({holder: retained, quota: 50n}); } catch { closureRejected = true; }
  const reused = closure({holder: retained, quota: 5n});
  check(closureRejected); check(reused.quota === 5n);
  const produced = api.claimFor(retained);
  check(produced.tag === "some" && produced.value.quota === 0n);
  release(echoed); release(echoedBooking); release(retainedEcho); release(moved);
  release(callbackResult); release(fromClosure); release(reused); release(produced); closure.dispose();
  kept.dispose(); retained.dispose(); ticket.dispose();
  check(kept.disposed && retained.disposed && ticket.disposed);
  return {checks, claimRejected, bookingRejected, lateRejected
    , retainedRejected, transferRejected, callbackRejected, callbackThrown
    , closureRejected, transferred: true, callbackCalls};
}
`;

const resultOnlyProbe = name => `import api from ${JSON.stringify(name)};
export const close = () => api.close();
export function run() {
  let checks = 0;
  const check = value => { checks++; if(!value) throw new Error("Owned checked-record result-only check " + checks); };
  const ticket = api.newTicket(20n, "result-only"), retained = ticket.retain();
  const produced = api.claimFor(retained);
  check(produced.tag === "some"); check(produced.value.quota === 0n);
  check(api.serial(produced.value.holder) === 20n);
  check(!Object.hasOwn(api, "echoClaim"));
  check(!Object.hasOwn(api, "withClaimCallback"));
  check(api.serial(retained) === 20n);
  produced.value.holder.dispose(); retained.dispose(); ticket.dispose();
  check(produced.value.holder.disposed && retained.disposed && ticket.disposed);
  return {checks, produced:true, fullApiOmitted:true, retained:true, disposed:true};
}
`;

const expected = resultOnly => resultOnly ? {
	checks: 7, produced: true, fullApiOmitted: true, retained: true, disposed: true
} : {
	checks: 30, claimRejected: true, bookingRejected: true
	, lateRejected: true, retainedRejected: true
	, transferRejected: true, callbackRejected: true
	, callbackThrown: true, closureRejected: true
	, transferred: true, callbackCalls: 1
};

for(const route of routes)
	test(`installed ${route} owned checked records execute from source-free npm archives`, {
		skip: !enabled, timeout: 900000
	}, async t => {
		const selection = ownedCheckedRecordJavaScriptSelection(route);
		const { authorRoute, resultOnly } = selection;
		const scratch = await mkdtemp(join(
			tmpdir(), "lean-owned-checked-record-javascript-"
		));
		t.after(() => rm(scratch, { recursive: true, force: true }));
		const project = join(scratch, "author");
		const componentRoot = join(scratch, "component");
		await cp(resolve(ownedCheckedRecordFixture), project, { recursive: true });
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(
			selection.configuration
		));
		if(authorRoute === "reviewed") await saveLakeFile(project
			, "reviewed.binding-ir.json"
			, canonicalJson(selection.reviewedIr));
		const before = await lakeInputState(project);
		const built = await buildOwnedJavaScriptWasmComponent({
			projectRoot: project, outputRoot: componentRoot
			, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX
				?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
			, leanRuntimeRoot: target
			, emsdkRoot: resolve(process.env.LEAN_WASM_EMSDK ?? ".toolchains/emsdk")
		}).catch(error => {
			t.diagnostic(JSON.stringify(error.details ?? error.message));
			throw error;
		});
		assert.deepEqual(await lakeInputState(project), before
			, "builds must not modify authored inputs");
		const verified = await readVerifiedOwnedJavaScriptWasmComponent(
			componentRoot
		);
		assert.deepEqual(verified.model, built.model);
		const declarations = new Map(verified.model.bindingIr.declarations.map(
			item => [item.name, item]
		));
		if(resultOnly)
			assert.deepEqual([...declarations.keys()], ["claimFor", "newTicket", "serial"]);
		else
		{
			assert.equal(declarations.get("transferClaim").parameters[0].ownership
				, "transfer");
			assert.equal(declarations.get("withClaimCallback").parameters[0]
				.ownership, "borrow");
		}
		const callbacks = verified.model.bindingIr.types.filter(
			type => type.kind === "callback"
		);
		assert.equal(callbacks.length, resultOnly ? 0 : 2);
		assert.ok(callbacks.every(type =>
			type.source.extensions["lean-lang.org/refinements"]
		));
		const first = await buildOwnedJavaScriptNpmPackages({
			componentRoot, runtimeRoot: prepared
			, outputRoot: join(scratch, "packages")
		});
		const repeated = await buildOwnedJavaScriptNpmPackages({
			componentRoot, runtimeRoot: prepared
			, outputRoot: join(scratch, "packages-repeated")
		});
		assert.deepEqual(await readFile(first.runtimeArchive)
			, await readFile(repeated.runtimeArchive));
		assert.deepEqual(await readFile(first.componentArchive)
			, await readFile(repeated.componentArchive));
		const receipt = await readVerifiedPackageSetReceipt({
			receiptPath: join(first.output, "package-set-receipt.json")
		});
		assert.deepEqual(receipt.result.profiles, ["javascript-wasm-owned-v1"]);
		const archives = {
			runtime: sha256(await readFile(first.runtimeArchive))
			, component: sha256(await readFile(first.componentArchive))
		};
		const retainedPath = `evidence/${route}/handoff`;
		const retained = await retainPackageSetEvidence(first.output
			, join(packagingRoot, retainedPath));
		let consumer = join(scratch, "consumer");
		const handoff = join(consumer, "handoff");
		await saveLakeFile(consumer, "package.json", canonicalJson({
			name: "owned-checked-record-consumer", version: "1.0.0"
			, private: true, type: "module"
		}));
		const handoffReceipt = await copyPackageSetHandoff(
			join(packagingRoot, retainedPath), handoff);
		assert.deepEqual(handoffReceipt, retained.receipt);
		await rm(project, { recursive: true });
		await rm(componentRoot, { recursive: true });
		await rm(first.output, { recursive: true });
		await rm(repeated.output, { recursive: true });
		const run = (command, args) => processBuildRunner.capture({
			command, args, cwd: consumer, timeoutMs: 180000
		}).catch(error => {
			t.diagnostic(JSON.stringify(error.details ?? error.message));
			throw error;
		});
		await run("npm", ["install", "--offline", "--ignore-scripts"
			, "--no-audit", "--no-fund"
			, ...handoffReceipt.packages.flatMap(pkg => pkg.artifacts.map(
				artifact => join(handoff, artifact.path))) ]);
		await rm(handoff, { recursive: true });
		const probeSource = (resultOnly ? resultOnlyProbe : fullProbe)(
			first.coordinate.name
		);
		await saveLakeFile(consumer, "probe.mjs", probeSource);
		await saveLakeFile(consumer, "call.mjs"
			, `import {run,close} from "./probe.mjs";\nconsole.log(JSON.stringify(run()));\nif(!close() || close()) throw new Error("Component close failed");\n`);
		const relocated = join(scratch, "relocated-consumer");
		await rename(consumer, relocated); consumer = relocated;
		const observed = JSON.parse((await run(process.execPath
			, ["call.mjs"])).stdout);
		assert.deepEqual(observed, expected(resultOnly));
		await saveLakeFile(consumer, "consumer.mts"
			, resultOnly ? `import api, {type Claim} from ${JSON.stringify(first.coordinate.name)};
const ticket = api.newTicket(20n, "typed");
const produced = api.claimFor(ticket);
if(produced.tag === "some") { const claim: Claim = produced.value; claim.holder.dispose(); }
// @ts-expect-error Result-only packages omit host-consumed Claim exports.
api.echoClaim({holder: ticket, quota: 7n});
ticket.dispose(); api.close();
` : `import api, {type Booking, type Claim} from ${JSON.stringify(first.coordinate.name)};
const ticket = api.newTicket(20n, "typed");
const claim: Claim = {holder: ticket, quota: 7n};
const booking: Booking = {holder: ticket, window: {lo: 1n, hi: 2n}};
const echoed: Claim = api.echoClaim(claim);
api.echoBooking(booking); api.pairClaim(booking, claim);
api.withClaimCallback(claim, value => ({holder: value.holder, quota: 8n}));
const closure = api.claimClosure(); const closed: Claim = closure(claim);
// @ts-expect-error Proof-erased Nat fields remain bigint, never number.
api.echoClaim({...claim, quota: 7});
closure.dispose(); echoed.holder.dispose(); closed.holder.dispose();
ticket.dispose(); api.close();
`);
		await run(process.execPath, [resolve("node_modules/typescript/bin/tsc")
			, "--strict", "--noEmit", "--target", "ES2022"
			, "--module", "NodeNext", "--moduleResolution", "NodeNext"
			, "--skipLibCheck", "false", "consumer.mts"]);
		const browser = browserEnabled ? await checkOwnedJavaScriptBrowsers({
			root: consumer, name: first.coordinate.name, run
			, probeSource, expected: observed
		}) : null;
		reports.push({ route, authorRoute, mode: selection.mode
			, componentIdentity: verified.identity
			, bindingIrSha256: verified.model.bindingIrSha256
			, sourceIdentity: verified.receipt.sourceIdentity
			, packageSetReceipt: receipt.receipt, archives, observed
			, retainedPackageSet: { path: retainedPath
				, receiptSha256: retained.receiptSha256
				, archives: retained.archives
				, archiveBytes: retained.archiveBytes, files: retained.files }
			, installedNode: true, installedTypeScript: true
			, sourceRemovedBeforeInstall: true, relocatedInstallation: true
			, archiveReproduction: true, browser
			, wasm: { bytes: verified.receipt.wasmLibrary.bytes
				, sha256: verified.receipt.wasmLibrary.sha256 } });
		t.diagnostic(JSON.stringify({ route, observed, browser
			, wasmBytes: verified.receipt.wasmLibrary.bytes }));
	});
