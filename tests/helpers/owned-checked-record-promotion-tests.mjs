/**
 * Exercise the current promotion against authenticated historical inputs.
 * Synthetic references test projection, never hosted package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { typeSurfaceCells, validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";
import { gitSourceBytes } from "./source-history-stream.mjs";
import {
	ownedCheckedRecordHostedLaneNames, ownedCheckedRecordHostedRoutes
} from "./owned-checked-record-hosted-contracts.mjs";
import {
	ownedCheckedRecordPromotionArchiveReferences, ownedCheckedRecordPromotionLimit
	, ownedCheckedRecordPromotionProfiles, ownedCheckedRecordPromotionReferences
	, ownedCheckedRecordPromotionSelectionPath, promoteOwnedCheckedRecords
	, refreshOwnedCheckedRecords, renderOwnedCheckedRecordPromotion
} from "./owned-checked-record-promotion.mjs";
import { ownedCheckedRecordJavaScriptSelection } from "./owned-checked-record-javascript-fixture.mjs";
import { ownedCheckedRecordNativeSelection } from "./owned-checked-record-native-fixture.mjs";
import { ownedCheckedRecordLanguageSelection } from "./owned-checked-record-language-fixture.mjs";
import { ownedCheckedRecordManagedSelection } from "./owned-checked-record-managed-fixture.mjs";
import {
	ownedCheckedRecordDocumentationPaths, refreshOwnedCheckedRecordDocumentation
	, renderOwnedCheckedRecordDocumentation
} from "./owned-checked-record-documentation.mjs";
import { ownedCheckedRecordMatrixReference } from "../../scripts/generate-type-docs.mjs";

const baseline = "bcb81a101e8d971370e8cfa5dd4c0d5896ee0dd9";
const originalJson = path => JSON.parse(execFileSync("git", ["show", `${baseline}:${path}`]
	, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }));
const contracts = { irSchema: originalJson("schema/binding-ir.schema.json")
	, consumers: originalJson("docs/consumer-support.v1.json") };
let inventory;
const originalInventory = async () => {
	if(!inventory)
	{
		const read = await readPromotionInventory(gitSourceBytes(baseline, "docs/type-surface.v1.json"), contracts);
		assert.deepEqual(read.source, { bytes: 101896921
			, sha256: "504880b9a31eccb1132de1303f24669c9b4d34da032f5ed4f96534e54e922cd5" });
		inventory = read.document;
	}
	return inventory;
};

const rootFor = lane => `docs/evidence/owned-checked-record-${lane}-hosted-20990101`;
const syntheticIndex = lane => {
	const artifact = Buffer.from(`Inert ${lane} fixture, not a package`);
	const files = ["artifact", "job", "run"].map(name => ({
		path: `hosted/api/${name}.json`, bytes: 3, sha256: sha256("{}\n")
	}));
	const part = { path: "hosted/artifact.zip.parts/0000.part", offset: 0
		, bytes: artifact.length, sha256: sha256(artifact) };
	files.push({ path: part.path, bytes: part.bytes, sha256: part.sha256 });
	return { lane, files
		, hostedRun: {
			apiRecords: Object.fromEntries(["artifact", "job", "run"].map(name => [name
				, { bytes: 3, sha256: sha256("{}\n") }]))
			, artifact: { bytes: artifact.length, parts: [part] }
		}
	};
};
const references = ownedCheckedRecordHostedLaneNames.map(lane => {
	const index = syntheticIndex(lane);
	return { lane, profiles: [...ownedCheckedRecordPromotionProfiles[lane]]
		, routes: [...ownedCheckedRecordHostedRoutes]
		, id: `owned-checked-record-${lane}-hosted-installed`, kind: "installed"
		, revision: (lane === "javascript" ? "b" : lane === "php-wasm" ? "c" : "a").repeat(40)
		, command: `node scripts/check-owned-checked-record-matrix.mjs --selection ${ownedCheckedRecordPromotionSelectionPath}`
		, scope: "Synthetic projection test only; not hosted acceptance."
		, ...ownedCheckedRecordPromotionArchiveReferences(index, rootFor(lane), Buffer.from(canonicalJson(index))) };
});

test("owned checked-record promotion changes exactly 170 cells and preserves every other observation", async () => {
	const original = await originalInventory();
	const snapshot = structuredClone(original);
	const promoted = promoteOwnedCheckedRecords(original, references);
	assert.deepEqual(original, snapshot);
	assert.equal(validateTypeSurface(promoted, contracts), true);
	assert.deepEqual(promoted.evidence.slice(0, original.evidence.length), original.evidence);
	assert.deepEqual(promoted.evidence.slice(-11).map(reference => reference.id), references.map(reference => reference.id));
	assert.deepEqual({ ...promoted, evidence: original.evidence, observations: original.observations }, original);
	let observations = 0;
	for(const [number, previous] of original.observations.entries())
	{
		const next = promoted.observations[number];
		if(!previous.shapes.includes("checked-record"))
		{
			assert.deepEqual(next, previous, previous.id);
			continue;
		}
		observations++;
		for(const key of ["id", "profiles", "shapes", "positions", "path"])
			assert.deepEqual(next[key], previous[key]);
		assert.deepEqual(next.limitations.slice(0, -1), previous.limitations);
		assert.equal(next.limitations.at(-1), ownedCheckedRecordPromotionLimit);
		const ids = references.filter(reference => reference.profiles.some(profile =>
			previous.profiles.includes(profile))).map(reference => reference.id);
		for(const [name, stage] of Object.entries(next.stages))
		{
			assert.equal(stage.state, previous.stages[name].state);
			assert.deepEqual(stage.evidence, [...previous.stages[name].evidence, ...ids]);
		}
	}
	assert.equal(observations, 114);
	const selected = cell => cell.id.includes("/checked-record/");
	const before = new Map(typeSurfaceCells(original, contracts, selected).map(cell => [cell.id, cell]));
	let changed = 0;
	for(const cell of typeSurfaceCells(promoted, contracts, selected))
	{
		const previous = before.get(cell.id);
		if(!cell.limitations.includes(ownedCheckedRecordPromotionLimit))
		{
			assert.deepEqual(cell, previous);
			continue;
		}
		assert.notDeepEqual(cell, previous);
		assert.match(cell.conversionNote, /mkWindow or mkClaim before ownership transfer/u);
		assert.match(cell.conversionNote, /result-only packages expose Claim results/u);
		changed++;
	}
	assert.equal(changed, 170);
});

test("owned checked-record promotion refuses partial, duplicate, forged or widened references", async () => {
	const original = await originalInventory();
	for(const mutate of [
		values => { values.pop(); }
		, values => { values.push(values[0]); }
		, values => { values[1] = values[0]; }
		, values => { values.reverse(); }
		, values => { values[0].profiles.push("php-wasm"); }
		, values => { values[0].profiles = ["cpp", "c"]; }
		, values => { values[0].routes.pop(); }
		, values => { values[0].routes.push("async-full"); }
		, values => { values[0].kind = "test"; }
		, values => { values[0].id = "owned-checked-record-php-wasm-hosted-installed"; }
		, values => { values[0].revision = "HEAD"; }
		, values => { values[0].revision = "d".repeat(40); }
		, values => { values[0].command = "trust me"; }
		, values => { values[0].optional = true; }
		, values => { values[0].files = []; }
		, values => { values[0].artifacts = []; }
		, values => { values[0].files[0].path = "docs/evidence/qualification.json"; }
		, values => { values[0].files[0].sha256 = "bad"; }
		, values => { values[0].files.push(values[0].files[0]); }
		, values => { values[0].artifacts[0] = { ...values[0].artifacts[0], sha256: "0".repeat(64) }; }
		, values => { values[0].files[1].path = "../outside"; }
	]) {
		const changed = structuredClone(references); mutate(changed);
		assert.throws(() => promoteOwnedCheckedRecords(original, changed), assert.AssertionError, String(mutate));
	}
	assert.throws(() => promoteOwnedCheckedRecords(promoteOwnedCheckedRecords(original, references), references)
		, /Already promoted/u);
});

test("owned checked-record promotion refuses changed observation topology and unpassed stages", async () => {
	const original = await originalInventory();
	const id = "checked-record-c-ordinary-source-parameter";
	for(const mutate of [
		value => { value.profiles.push("php-wasm"); }
		, value => { value.shapes.push("subtype"); }
		, value => { value.positions.push("signature"); }
		, value => { value.path = "reviewed-ir"; }
		, value => { value.stages.installedExecution.state = "blocked"; }
		, value => { delete value.stages.packaging; }
		, value => { value.stages.installedExecution.evidence.push(references[0].id); }
		, value => { value.limitations.push(ownedCheckedRecordPromotionLimit); }
	]) {
		const changed = structuredClone(original); mutate(changed.observations.find(item => item.id === id));
		assert.throws(() => promoteOwnedCheckedRecords(changed, references), assert.AssertionError);
	}
	const missing = { ...original, observations: original.observations.filter(item => item.id !== id) };
	assert.throws(() => promoteOwnedCheckedRecords(missing, references), /Missing owned promotion cell/u);
	const duplicate = { ...original, observations: [...original.observations, original.observations[0]] };
	assert.throws(() => promoteOwnedCheckedRecords(duplicate, references), /Duplicate observation/u);
});

test("owned checked-record promotion compact references bind all API and original ZIP bytes", () => {
	const index = syntheticIndex("native"), root = rootFor("native");
	const bytes = Buffer.from(canonicalJson(index));
	const compact = ownedCheckedRecordPromotionArchiveReferences(index, root, bytes);
	assert.equal(compact.files.length, 5);
	assert.equal(compact.artifacts.length, 1);
	assert.equal(compact.files[0].sha256, sha256(bytes));
	assert.deepEqual(compact.artifacts, compact.files.slice(4));
	assert.throws(() => ownedCheckedRecordPromotionArchiveReferences(index, rootFor("php-wasm"), bytes));
	assert.throws(() => ownedCheckedRecordPromotionArchiveReferences(index, root, Buffer.concat([bytes, Buffer.from(" ")])));
	for(const mutate of [
		value => { value.files.pop(); }
		, value => { value.files.push(value.files[0]); }
		, value => { value.files[0].path = "../outside"; }
		, value => { value.files[0].bytes++; }
		, value => { value.files[0].sha256 = "0".repeat(64); }
		, value => { value.files.push({ path: "index.json", bytes: 0, sha256: "0".repeat(64) }); }
		, value => { delete value.hostedRun.apiRecords.job; }
		, value => { value.hostedRun.artifact.parts = []; }
		, value => { value.hostedRun.artifact.parts.push(value.hostedRun.artifact.parts[0]); }
		, value => { value.hostedRun.artifact.parts[0].offset = 1; }
		, value => { value.hostedRun.artifact.parts[0].bytes = 0; }
		, value => { value.hostedRun.artifact.parts[0].sha256 = "0".repeat(64); }
		, value => { value.hostedRun.artifact.bytes++; }
	]) {
		const changed = structuredClone(index); mutate(changed);
		assert.throws(() => ownedCheckedRecordPromotionArchiveReferences(changed, root, Buffer.from(canonicalJson(changed))));
	}
});

test("owned checked-record promotion cannot bypass complete committed archive verification", async () => {
	const selection = {
		schemaVersion: 1, kind: "owned-checked-record-matrix-selection"
		, archives: references.map(reference => ({ lane: reference.lane, index: reference.files[0] })) };
	let observed = 0;
	await assert.rejects(ownedCheckedRecordPromotionReferences(selection, () => { observed++; }), { code: "ENOENT" });
	assert.equal(observed, 0);
	const missing = structuredClone(selection); missing.archives.pop();
	await assert.rejects(ownedCheckedRecordPromotionReferences(missing), assert.AssertionError);
});

test("owned checked-record promotion projects retained index manifests without inferring acceptance", async () => {
	let archives = 0;
	for(const lane of ownedCheckedRecordHostedLaneNames.filter(name => name !== "javascript"))
	{
		const root = `docs/evidence/owned-checked-record-${lane}-hosted-20261024`;
		const bytes = await readFile(`${root}/index.json`), index = JSON.parse(bytes);
		assert.equal(index.lane, lane);
		const compact = ownedCheckedRecordPromotionArchiveReferences(index, root, bytes);
		assert.equal(compact.files.length, 4 + index.hostedRun.artifact.parts.length);
		assert.equal(compact.artifacts.length, index.hostedRun.artifact.parts.length);
		assert.equal(compact.files[0].sha256, sha256(bytes));
		archives++;
	}
	// This exercises actual index layouts, not original ZIP reconstruction or
	// the missing npm lane. Only the complete matrix verifier proves acceptance.
	assert.equal(archives, 10);
});

test("owned checked-record promotion keeps the installed fixture and result-only boundaries explicit", async () => {
	const names = ["Ticket", "Window", "Booking", "Claim"];
	for(const route of ownedCheckedRecordHostedRoutes)
	{
		const javascript = ownedCheckedRecordJavaScriptSelection(route);
		const selections = [
			javascript
			, ...["dotnet", "jvm", "php", "wit"].map(group => ownedCheckedRecordManagedSelection(route, group))];
		for(const selected of selections)
		{
			assert.deepEqual(selected.reviewedIr, javascript.reviewedIr);
			assert.deepEqual(selected.configuration.exports, javascript.configuration.exports);
		}
		const native = ownedCheckedRecordNativeSelection(route, ["c", "cpp", "cpan"]);
		const languages = ownedCheckedRecordLanguageSelection(route, ["python", "ruby", "rust"]);
		assert.deepEqual(languages.reviewedIr, native.reviewedIr);
		assert.deepEqual(languages.configuration.exports, native.configuration.exports);
		assert.deepEqual(languages.configuration.contracts, native.configuration.contracts);
		if(javascript.resultOnly)
		{
			assert.deepEqual(native.reviewedIr, javascript.reviewedIr);
			assert.deepEqual(native.configuration.exports, javascript.configuration.exports);
		}
		else
		{
			// Expanded native/language coverage awaits independent hosted acceptance.
			// Keep the admitted shared boundary exact without promoting new cases.
			const types = new Set(javascript.reviewedIr.types.map(type => type.id));
			const declarations = new Set(javascript.reviewedIr.declarations.map(item => item.id));
			assert.deepEqual({ ...native.reviewedIr
				, types: native.reviewedIr.types.filter(type => types.has(type.id))
				, declarations: native.reviewedIr.declarations.filter(item => declarations.has(item.id))
			}, javascript.reviewedIr);
			assert.deepEqual(native.reviewedIr.types.filter(type => !types.has(type.id))
				.map(type => type.name), ["Grant"]);
			const additional = ["bookingSpan", "claimQuota", "echoGrant", "echoClaims"
				, "transferWithClaimCallback", "transferPairClaim"];
			assert.deepEqual(native.reviewedIr.declarations.filter(item => !declarations.has(item.id))
				.map(item => item.name), additional);
			assert.deepEqual(native.configuration.exports, javascript.configuration.exports?.concat(
				additional.map(name => `OwnedCheckedRecords.${name}`)));
		}
		const definitions = javascript.reviewedIr.types.filter(type => !type.name.startsWith("Callback"));
		if(javascript.resultOnly)
		{
			assert.deepEqual(definitions.map(type => type.name), ["Ticket", "Claim"]);
			assert.deepEqual(javascript.reviewedIr.declarations.map(item => item.name), ["newTicket", "serial", "claimFor"]);
			assert.equal(javascript.reviewedIr.types.filter(type => type.kind === "callback").length, 0);
		}
		else
		{
			assert.deepEqual(definitions.map(type => type.name), names);
			assert.equal(definitions.find(type => type.name === "Window").representation, "copied");
			assert.equal(definitions.find(type => type.name === "Booking").representation, "owned");
			assert.equal(definitions.find(type => type.name === "Claim").representation, "owned");
			for(const name of ["echoBooking", "echoClaim", "transferClaim", "pairClaim", "withClaimCallback", "claimClosure"])
				assert.ok(javascript.reviewedIr.declarations.some(item => item.name === name));
		}
		assert.ok(!definitions.some(type => type.name === "Grant"));
	}
	const php = await readFile("tests/helpers/owned-php-wasm-packages.mjs", "utf8");
	assert.ok(php.includes('ownedCheckedRecordJavaScriptConfiguration(reviewed ? "reviewed" : "ordinary", { resultOnly })'));
	assert.ok(php.includes("ownedCheckedRecordJavaScriptReviewedIr({ resultOnly })"));
	const rendered = renderOwnedCheckedRecordPromotion(references);
	for(const expected of [
		"Eleven immutable hosted archives", "seventeen consumer profiles"
		, "exactly 170 existing", "Native PHP and PHP-Wasm have independent archives"
		, "does not establish Grant", "Standalone result-only packages"])
		assert.ok(rendered.includes(expected), expected);
});

test("owned checked-record promotion reference refuses incomplete or widened published cells", async () => {
	const original = await originalInventory();
	assert.equal(ownedCheckedRecordMatrixReference(original), "");
	const promoted = promoteOwnedCheckedRecords(original, references);
	assert.match(ownedCheckedRecordMatrixReference(promoted), /eleven immutable archives to exactly 170 cells/u);
	for(const reference of references)
		assert.equal(ownedCheckedRecordMatrixReference({ ...promoted
			, evidence: promoted.evidence.filter(item => item.id !== reference.id) }), "");
	const id = "checked-record-c-ordinary-source-parameter";
	for(const mutate of [
		value => { value.profiles.push({ id: "unknown" }); }
		, value => { value.evidence.find(item => item.id === references[0].id).kind = "test"; }
		, value => { value.evidence.push(value.evidence.find(item => item.id === references[0].id)); }
		, value => { value.observations.push(value.observations.find(item => item.id === id)); }
		, value => { value.observations.find(item => item.id === id).stages.packaging.state = "blocked"; }
		, value => {
			const stage = value.observations.find(item => item.id === id).stages.installedExecution;
			stage.evidence = stage.evidence.filter(evidence => evidence !== references[0].id);
		}
	]) {
		const changed = structuredClone(promoted); mutate(changed);
		assert.equal(ownedCheckedRecordMatrixReference(changed), "");
	}
});

const baselineDocumentation = () => Object.fromEntries(Object.entries(ownedCheckedRecordDocumentationPaths)
	.map(([name, path]) => [
		name
		, execFileSync("git", ["show", `${baseline}:${path}`]
			, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 })]));

test("owned checked-record promotion prepares all fourteen guides without changing unrelated sections", () => {
	const sources = baselineDocumentation(), rendered = renderOwnedCheckedRecordDocumentation(sources);
	assert.equal(Object.keys(rendered).length, 14);
	for(const [name, source] of Object.entries(sources))
	{
		const output = rendered[name];
		assert.equal(output.split("## Owned checked records\n").length, 2);
		assert.ok(output.includes("owned-checked-record-promotion-20261025.md"));
		assert.ok(output.includes("without checked-input, transfer or callback metadata"));
		assert.ok(output.includes("does not cover `Grant` and its nested Subtype"));
		const start = output.indexOf("## Owned checked records\n");
		const end = output.indexOf("\n## ", start) + 1;
		assert.ok(end > start);
		const restored = output.slice(0, start) + output.slice(end);
		const old = name === "existingPackage" ? source.replace("owned and unarchived combinations remain separate |"
			, "the separately archived owned Booking/Window and Ticket/Claim forms are documented below; unarchived combinations remain separate |") : source;
		assert.equal(sha256(restored), sha256(old), name);
	}
	assert.match(rendered.php, /native PHP and PHP-Wasm, each backed by an independent hosted archive/u);
	assert.throws(() => renderOwnedCheckedRecordDocumentation(rendered), /already published/u);
	const missing = { ...sources }; delete missing.php;
	assert.throws(() => renderOwnedCheckedRecordDocumentation(missing));
	for(const name of Object.keys(sources))
	{
		const marker = name === "existingPackage" ? "## Choose downstream languages\n"
			: name === "exportDecisions" ? "## Check each consumer representation\n"
				: "## Start from a raw Lean package\n";
		assert.throws(() => renderOwnedCheckedRecordDocumentation({ ...sources
			, [name]: sources[name].replace(marker, "") }), /Expected one/u);
		assert.throws(() => renderOwnedCheckedRecordDocumentation({ ...sources
			, [name]: sources[name] + marker }), /Expected one/u);
	}
});

test("owned checked-record refresh replaces only eleven evidence references", async () => {
	const original = promoteOwnedCheckedRecords(await originalInventory(), references);
	const snapshot = structuredClone(original);
	const next = references.map(reference => ({ ...reference
		, scope: "New independently verified capture, represented synthetically in this projection test." }));
	const refreshed = refreshOwnedCheckedRecords(original, next);
	assert.deepEqual(original, snapshot);
	assert.equal(validateTypeSurface(refreshed, contracts), true);
	assert.deepEqual({ ...refreshed, evidence: original.evidence }, original);
	assert.equal(refreshed.evidence.length, original.evidence.length);
	const ids = new Set(references.map(reference => reference.id));
	for(const [number, entry] of original.evidence.entries())
		if(!ids.has(entry.id)) assert.deepEqual(refreshed.evidence[number], entry);
	assert.deepEqual(refreshed.observations, original.observations);
	for(const selected of [next.slice(1), [...next, next[0]], next.toReversed()])
		assert.throws(() => refreshOwnedCheckedRecords(original, selected));
	for(const mutate of [
		value => { value.evidence = value.evidence.filter(entry => entry.id !== references[0].id); }
		, value => { value.evidence.push(value.evidence.find(entry => entry.id === references[0].id)); }
		, value => { value.evidence.find(entry => entry.id === references[0].id).kind = "test"; }
	]) {
		const changed = structuredClone(original); mutate(changed);
		assert.throws(() => refreshOwnedCheckedRecords(changed, next));
	}
});

test("owned checked-record refresh replaces only each guide's existing owned section", () => {
	const rendered = renderOwnedCheckedRecordDocumentation(baselineDocumentation());
	const old = Object.fromEntries(Object.entries(rendered).map(([name, source]) =>
		[name, source.replaceAll("owned-checked-record-promotion-20261025.md", "owned-checked-record-promotion-20261024.md")]));
	assert.deepEqual(refreshOwnedCheckedRecordDocumentation(old), rendered);
	assert.deepEqual(refreshOwnedCheckedRecordDocumentation(rendered), rendered);
	assert.throws(() => refreshOwnedCheckedRecordDocumentation(baselineDocumentation()));
	assert.throws(() => refreshOwnedCheckedRecordDocumentation({ ...old, php: old.php + "\n## Owned checked records\n" }));
	const marker = "## Start from a raw Lean package\n";
	assert.throws(() => refreshOwnedCheckedRecordDocumentation({ ...old, php: old.php.replace(marker, "") }));
	const unrelated = "\nKeep this unrelated text and link: owned-checked-record-promotion-20261024.md\n";
	assert.equal(refreshOwnedCheckedRecordDocumentation({ ...old, php: old.php + unrelated }).php, rendered.php + unrelated);
});

test("owned checked-record publication commands refuse dirty or missing capture selections before writing", async t => {
	const repository = await mkdtemp(join(tmpdir(), "lean-owned-promotion-cli-"));
	t.after(() => rm(repository, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", ["-C", repository, ...arguments_]
		, { encoding: "utf8", env: environment, stdio: ["ignore", "pipe", "pipe"] });
	git(["init", "--quiet"]);
	git([
		"-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "fixture"]);
	const invoke = (name, arguments_) => execFileSync(process.execPath
		, ["--max-old-space-size=512", resolve(`scripts/${name}-owned-checked-record-evidence.mjs`), ...arguments_]
		, { cwd: repository, env: environment, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10000 });
	for(const name of ["promote", "refresh"])
		assert.throws(() => invoke(name, ["--check"]), error => error.status !== 0
			&& error.stderr.includes("ENOENT") && error.stderr.includes(ownedCheckedRecordPromotionSelectionPath));
	assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), "");
	await writeFile(join(repository, "user-edit"), "preserve me");
	for(const name of ["promote", "refresh"])
	{
		assert.throws(() => invoke(name, []), error => error.status !== 0 && error.stderr.includes("clean committed checkout"));
		assert.throws(() => invoke(name, ["--trust-receipt"]), error => error.status !== 0 && error.stderr.includes("Use no arguments"));
	}
	assert.equal(await readFile(join(repository, "user-edit"), "utf8"), "preserve me");
});
