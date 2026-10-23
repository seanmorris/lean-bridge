/**
 * Keep owned checked-record hosted archives closed over their lanes, their
 * original package bytes and the API records that authenticate them.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	appendFile, mkdtemp, readFile, rm, symlink, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import "./helpers/owned-checked-record-javascript-evidence-tests.mjs";
import {
	packageSetReceiptName, readVerifiedPackageSetReceipt, writePackageSetReceipt
} from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import {
	ownedCheckedRecordHostedLaneNames, ownedCheckedRecordHostedLanes
	, ownedCheckedRecordHostedRoutes, ownedCheckedRecordHostedTestNames
} from "./helpers/owned-checked-record-hosted-contracts.mjs";
import {
	assertOwnedCheckedRecordHostedSteps, checkOwnedCheckedRecordHostedEvidence
	, writeOwnedCheckedRecordHostedEvidence
} from "./helpers/owned-checked-record-hosted-evidence.mjs";
import {
	verifyOwnedCheckedRecordJavaScriptEvidence
} from "./helpers/owned-checked-record-javascript-evidence.mjs";
import { ownedCheckedRecordEvidenceSources } from "./helpers/owned-checked-record-hosted-evidence-sources.mjs";
import {
	parseOwnedCheckedRecordTap, replayOwnedCheckedRecordHostedOutput
} from "./helpers/owned-checked-record-hosted-output.mjs";

const revision = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
const original = path => execFileSync("git", ["show", `${revision}:${path}`]);
const fixture = name => original(`tests/fixtures/structured-types/${name}`)
	.toString("utf8");
const digest = value => sha256(Buffer.from(value));
const extension = { c: "c", cpp: "cpp", python: "py", ruby: "rb", rust: "rs"
	, dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php" };

const consumerDigest = (lane, profile, resultOnly) => {
	const installed = resultOnly ? "result-only" : "installed";
	if(lane.kind === "native")
		return digest(fixture(`owned-checked-record-${installed}.${extension[profile]}`));
	if(lane.kind === "perl") return digest(fixture(`owned-checked-record-${installed}.pl`));
	if(profile === "wit-wasi")
		return digest(fixture(`owned-checked-record-${installed}.c`)
			.replaceAll("owned_checked_records", "owned_checked_records_wasmtime")
			.replaceAll("OWNED_CHECKED_RECORDS", "OWNED_CHECKED_RECORDS_WASMTIME")
			.replace(`owned-checked-record-${resultOnly ? "result-only-" : ""}c:`
				, `owned-checked-record-${resultOnly ? "result-only-" : ""}wit-wasi:`));
	const name = profile === "php-native" ? "php" : profile;
	return digest(fixture(`owned-checked-record-${resultOnly ? "result-only-" : ""}${name}.${extension[profile]}`));
};

const writePackageSet = async (root, lane, route) => {
	const abi = { id: lane.kind === "javascript"
		? "javascript-wasm-owned-v1" : "native-library-v1"
	, bindingIrSha256: "1".repeat(64)
	, runtimeIdentity: "2".repeat(64) };
	const packages = [];
	const add = async (target, name, role = "component", requires = []) => {
		const path = `archives/${target}/${name}-${route}.fixture`;
		const bytes = Buffer.from(`Inert ${target} ${role} archive for ${route}\n`);
		await saveLakeFile(root, path, bytes);
		const ecosystem = target === "php-native" ? "composer" : target;
		const runtimeDelivery = role === "runtime" ? "provided"
			: requires.length ? "dependency" : "embedded";
		const artifacts = [{ path, bytes: bytes.length, sha256: sha256(bytes) }];
		packages.push({ target, ecosystem, name, version: "1.0.0"
			, profile: abi.id, role, runtimeIdentity: abi.runtimeIdentity
			, runtimeDelivery, requires, artifacts });
		return { ecosystem: target, name, version: "1.0.0" };
	};
	for(const target of lane.targets)
	{
		if(target === "npm")
		{
			const runtime = await add(target, "@lean-bridge/runtime", "runtime");
			await add(target, "@example/owned-checked-records", "component"
				, [runtime]);
		}
		else if(target === "cpan")
		{
			const runtime = await add(target, "LeanBridge-Runtime", "runtime");
			await add(target, "LeanBridge-OwnedCheckedRecords", "component", [runtime]);
		}
		else await add(target, target === "php-native"
			? "leanbridge/owned-checked-records" : "owned-checked-records");
	}
	return writePackageSetReceipt({ root
		, component: { id: "ownedcheckedrecords@1.0.0", name: "ownedcheckedrecords"
			, version: "1.0.0" }
		, source: { treeSha256: "9".repeat(64) }, profiles: [abi], packages });
};

/**
 * Write one complete synthetic hosted output tree for a lane.
 *
 * @param root - Empty extracted-artifact root.
 * @param laneName - Owned checked-record hosted lane.
 */
const synthesizeOutput = async (root, laneName) => {
	const lane = ownedCheckedRecordHostedLanes[laneName];
	const diagnostics = [], reports = [];
	for(const route of ownedCheckedRecordHostedRoutes)
	{
		const resultOnly = route.endsWith("result-only");
		const full = !resultOnly;
		const evidence = `${lane.evidence}/${route}/handoff`;
		const handoff = join(root, lane.packaging, evidence);
		const receipt = await writePackageSet(handoff, lane, route);
		const { result } = await readVerifiedPackageSetReceipt({
			receiptPath: join(handoff, packageSetReceiptName) });
		const artifacts = receipt.packages.flatMap(pkg => pkg.artifacts);
		const retainedPackageSet = { path: evidence
			, receiptSha256: result.receiptSha256, archives: result.archives
			, archiveBytes: artifacts.reduce((sum, item) => sum + item.bytes, 0)
			, files: [packageSetReceiptName, `${packageSetReceiptName}.sha256`
				, ...artifacts.map(item => item.path)].toSorted() };
		const entry = { route, authorRoute: route.split("-")[0]
			, mode: resultOnly ? "result-only" : "full", retainedPackageSet };
		for(const key of lane.always) entry[key] = true;
		for(const key of lane.fullOnly) entry[key] = full;
		if(lane.kind === "native")
		{
			const checks = { c: resultOnly ? 14 : 120, cpp: resultOnly ? 3 : 90 };
			Object.assign(entry, { lifecycle: { c: "manual-owner-release"
				, cpp: resultOnly ? "raii" : "raii-plus-sanitizers" }
			, bindingIrSha256: "3".repeat(64), componentReceipt: { synthetic: true }
			, packageSetReceipt: receipt
			, observed: Object.fromEntries(["c", "cpp"].map(profile => [profile
				, { checks: checks[profile]
					, consumerSha256: consumerDigest(lane, profile, resultOnly) }]))
			, relocated: Object.fromEntries(["c", "cpp"].map(profile => [profile
				, { checks: checks[profile]
					, sourceSha256: consumerDigest(lane, profile, resultOnly)
					, sanitizer: profile === "cpp" && full ? { stdout: "ok\n" } : null }])) });
			diagnostics.push(JSON.stringify({ route, c: checks.c, cpp: checks.cpp
				, sanitizer: full }));
		}
		else if(lane.kind === "perl")
		{
			const observations = [];
			for(const perl of ["5.36.3-threaded", "5.36.3-unthreaded"
				, "5.38.2-threaded", "5.38.2-unthreaded"])
				for(const mode of ["prebuilt-only", "build-xs"])
				{
					observations.push({ perl, mode, runtimeOnlyRuns: 2
						, observed: { checks: resultOnly ? 6 : 40 }, assets: {} });
					diagnostics.push(JSON.stringify({ route, perl, mode
						, checks: resultOnly ? 6 : 40 }));
				}
			Object.assign(entry, { lifecycle: "perl-destruction-plus-explicit-close"
				, bindingIrSha256: "3".repeat(64), packageSetReceipt: receipt
				, consumerSha256: consumerDigest(lane, "perl", resultOnly)
				, componentReceipt: { synthetic: true }, observations });
		}
		else if(lane.kind === "javascript")
		{
			const executions = [];
			for(const engine of ["chromium", "firefox", "webkit"])
				for(const profile of ["page", "react", "worker"])
					executions.push({ engine, profile, version: `${engine}-1`
						, reruns: 2, checks: resultOnly ? 7 : 30
						, assets: [sha256(`${route}/${engine}/${profile}/a`)
							, sha256(`${route}/${engine}/${profile}/b`)] });
			Object.assign(entry, {
				bindingIrSha256: "3".repeat(64)
				, componentIdentity: "4".repeat(64)
				, sourceIdentity: "5".repeat(64)
				, packageSetReceipt: receipt
				, archives: Object.fromEntries(receipt.packages.map(pkg =>
					[pkg.role, pkg.artifacts[0].sha256]))
				, observed: resultOnly ? {
					checks: 7, produced: true, fullApiOmitted: true
					, retained: true, disposed: true
				} : {
					checks: 30, claimRejected: true, bookingRejected: true
					, lateRejected: true, retainedRejected: true
					, transferRejected: true, callbackRejected: true
					, callbackThrown: true, closureRejected: true
					, transferred: true, callbackCalls: 1
				}
				, browser: { externalNetworkBlocked: true
					, installedSourcesRemoved: true, executions }
				, wasm: { bytes: 4096, sha256: "6".repeat(64) }
			});
		}
		else
		{
			const checks = Object.fromEntries(lane.profiles.map(profile => [profile
				, resultOnly ? lane.kind === "language"
					? lane.resultOnlyChecks[profile] : 4 : 30]));
			const observations = Object.fromEntries(lane.profiles.map(profile =>
				[profile, { checks: checks[profile]
					, consumerSha256: consumerDigest(lane, profile, resultOnly)
					, ...lane.kind === "language"
						? { relocatedChecks: checks[profile] } : {} }]));
			Object.assign(entry, { profiles: [...lane.profiles], observations
				, reassembled: { synthetic: true } });
			if(lane.kind === "language")
				Object.assign(entry, { lifecycle: lane.lifecycle
					, bindingIrSha256: "3".repeat(64)
					, versions: { [lane.profile]: "synthetic 1.0" }
					, ...lane.profile === "rust" ? { dependencies: { synthetic: true } } : {}
					, packageSetReceipt: receipt
					, componentReceipts: { [lane.profile]: { synthetic: true } } });
			else
				Object.assign(entry, { group: lane.group, repeated: { synthetic: true }
					, packageSetReceiptSha256: sha256(canonicalJson(receipt)) });
			const label = lane.kind === "managed" ? `${lane.group}/${route}` : route;
			diagnostics.push(`${label}: ${lane.profiles.map(profile =>
				`${profile}=${checks[profile]}`).join(", ")}`);
		}
		reports.push(entry);
	}
	const report = { schemaVersion: 1, profile: lane.reportProfile, reports
		, ...lane.kind === "language" ? { selectedProfiles: lane.profiles } : {}
		, ...lane.kind === "managed" ? { group: lane.group } : {} };
	await saveLakeFile(root, `${lane.packaging}/${lane.report}`, canonicalJson(report));
	const names = ownedCheckedRecordHostedTestNames(lane);
	const tap = ["", `> lean-bridge@0.1.0 test:${laneName}`, "> node --test", ""
		, "TAP version 13"
		, ...names.flatMap((name, index) => [`# Subtest: ${name}`
			, `ok ${index + 1} - ${name}`, "  ---", "  duration_ms: 1.5", "  ..."])
		, ...diagnostics.map(line => `# ${line}`)
		, `1..${names.length}`, `# tests ${names.length}`, "# suites 0"
		, `# pass ${names.length}`, "# fail 0", "# cancelled 0", "# skipped 0"
		, "# todo 0", "# duration_ms 12.5", ""].join("\n");
	if(lane.kind === "javascript")
	{
		await saveLakeFile(root, lane.acceptance, tap);
		const verified = await verifyOwnedCheckedRecordJavaScriptEvidence(
			join(root, lane.packaging, lane.report));
		await saveLakeFile(root, lane.verification, canonicalJson(verified));
	}
	else
	{
		await saveLakeFile(root, `${lane.ci}/acceptance.log`, tap);
		await saveLakeFile(root, `${lane.ci}/toolchain.log`, "pinned toolchains\n");
	}
	return { lane, report };
};

const temporary = async (t, prefix) => {
	const root = await mkdtemp(join(tmpdir(), prefix));
	t.after(() => rm(root, { recursive: true, force: true }));
	return root;
};

const synthesize = async (t, laneName) => {
	const root = await temporary(t, `lean-owned-hosted-${laneName}-`);
	return { root, ...await synthesizeOutput(root, laneName) };
};

const replay = (laneName, root) =>
	replayOwnedCheckedRecordHostedOutput(laneName, root, revision, original);

test("owned checked-record hosted contracts name every non-PHP-Wasm lane exactly", async () => {
	assert.deepEqual(ownedCheckedRecordHostedLaneNames, ["native", "perl"
		, "python", "ruby", "rust", "dotnet", "jvm", "php", "wit"
		, "javascript"]);
	const targets = ownedCheckedRecordHostedLaneNames.flatMap(name =>
		ownedCheckedRecordHostedLanes[name].targets).toSorted();
	assert.deepEqual(targets, ["c", "cargo", "cpan", "cpp", "maven", "npm"
		, "nuget", "php-native", "pypi", "rubygems", "wit-wasi"]);
	for(const name of ownedCheckedRecordHostedLaneNames)
	{
		const lane = ownedCheckedRecordHostedLanes[name];
		const workflow = await readFile(lane.workflow, "utf8");
		const source = await readFile(lane.test, "utf8");
		const matrix = value => value.replace(lane.profile ?? lane.group ?? "\0"
			, lane.kind === "language" ? "${{ matrix.profile }}" : "${{ matrix.group }}");
		for(const required of [`name: ${matrix(lane.job)}`
			, `name: ${matrix(lane.prefix)}-\${{ github.sha }}`
			, `- name: ${lane.acceptanceStep}`
			, `- name: ${lane.enforceStep ?? lane.archiveStep}`
			, `build/${lane.packaging}/\n`
			, ...lane.ci ? [`build/${lane.ci}/\n`] : []])
			assert.ok(workflow.includes(required), `${name}: ${required}`);
		for(const title of lane.staticTests)
			assert.ok(source.includes(`test("${title}"`), `${name}: ${title}`);
		const routeTitle = lane.routeTest.replace("{route}", "${route}")
			.replace(lane.group ?? "\0", "${group}");
		assert.ok(source.includes(`test(\`${routeTitle}\``), `${name}: route test`);
		assert.equal(ownedCheckedRecordHostedTestNames(lane).length
			, lane.kind === "javascript" ? 5 : 6);
	}
});

test("owned checked-record TAP parsing accepts only complete npm-prefixed streams", () => {
	const names = ["first", "second"];
	const stream = (points = names.map((name, index) =>
		`ok ${index + 1} - ${name}`), preamble = ["", "> lean-bridge@0.1.0 test"]
	, summary = ["# tests 2", "# suites 0", "# pass 2", "# fail 0"
		, "# cancelled 0", "# skipped 0", "# todo 0"]) =>
		[...preamble, "TAP version 13", ...points, "# route: python=5", "1..2"
			, ...summary, "# duration_ms 1"].join("\n");
	assert.deepEqual(parseOwnedCheckedRecordTap(stream()), {
		tests: names, diagnostics: ["route: python=5"] });
	assert.throws(() => parseOwnedCheckedRecordTap(stream(undefined
		, ["npm warn unexpected"])), /Unexpected acceptance preamble/u);
	assert.throws(() => parseOwnedCheckedRecordTap(stream(["ok 1 - first"
		, "ok 2 - second # SKIP"])));
	assert.throws(() => parseOwnedCheckedRecordTap(stream(["ok 1 - first"
		, "not ok 2 - second"])));
	assert.throws(() => parseOwnedCheckedRecordTap(stream(["ok 1 - first"
		, "Bail out! runner stopped", "ok 2 - second"])));
	assert.throws(() => parseOwnedCheckedRecordTap(stream(["ok 1 - first"
		, "ok 3 - second"])));
	assert.throws(() => parseOwnedCheckedRecordTap(stream(undefined, undefined
		, ["# tests 2", "# suites 0", "# pass 1", "# fail 0", "# cancelled 0"
			, "# skipped 1", "# todo 0"])));
	assert.throws(() => parseOwnedCheckedRecordTap(stream(undefined, undefined
		, ["# tests 2", "# pass 2"])));
	assert.throws(() => parseOwnedCheckedRecordTap(`${stream()}\nTAP version 13`));
	assert.throws(() => parseOwnedCheckedRecordTap(`${stream()}\ngarbage`)
		, /Unexpected TAP line after the plan/u);
});

test("every owned checked-record lane replays a synthetic retained hosted output", async t => {
	for(const name of ownedCheckedRecordHostedLaneNames)
	{
		const { root } = await synthesize(t, name);
		const accepted = await replay(name, root);
		assert.equal(accepted.lane, name);
		assert.equal(accepted.producerCommit, revision);
		assert.equal(accepted.tests, name === "javascript" ? 5 : 6);
		assert.deepEqual(accepted.routes.map(route => route.route)
			, ownedCheckedRecordHostedRoutes);
		for(const route of accepted.routes)
			assert.ok(route.archives > 0 && route.archiveBytes > 0, `${name}/${route.route}`);
	}
});

const tampered = async (t, laneName, change, pattern) => {
	const { root, lane, report } = await synthesize(t, laneName);
	await change({ root, lane, report
		, rewrite: async mutate => {
			const copy = structuredClone(report);
			mutate(copy);
			await writeFile(join(root, lane.packaging, lane.report), canonicalJson(copy));
		}
		, handoff: route => join(root, lane.packaging
			, `${lane.evidence}/${route}/handoff`) });
	await assert.rejects(replay(laneName, root), pattern);
};

test("owned checked-record hosted output replay rejects every tampered retention", async t => {
	await tampered(t, "native", ({ handoff }) => appendFile(join(
		handoff("ordinary-full"), "archives/c/owned-checked-records-ordinary-full.fixture")
	, "x"), /Archive differs|archive-mismatch/u);
	await tampered(t, "native", ({ handoff }) => writeFile(join(
		handoff("reviewed-full"), "OwnedCheckedRecords.lean"), "-- source\n")
	, /exactly the receipt-named set/u);
	await tampered(t, "perl", async ({ handoff }) => {
		const path = join(handoff("ordinary-full"), "archives/cpan/LeanBridge-Runtime-ordinary-full.fixture");
		const bytes = await readFile(path);
		await rm(path);
		const copy = `${path}.original`;
		await writeFile(copy, bytes);
		await symlink(copy, path);
	}, /exactly the receipt-named set|regular|symlinks/u);
	await tampered(t, "python", ({ root, lane }) => writeFile(join(root
		, lane.packaging, "partial-0123456789ab.json"), "{}\n")
	, /exactly the logs, report and retained package sets/u);
	await tampered(t, "dotnet", ({ rewrite }) => rewrite(report => {
		report.reports[1].retainedPackageSet.archiveBytes += 1;
	}), /retained package metadata/u);
	await tampered(t, "jvm", ({ rewrite }) => rewrite(report => {
		report.reports[0].packageSetReceiptSha256 = "0".repeat(64);
	}), /ordinary-full/u);
	await tampered(t, "rust", ({ rewrite }) => rewrite(report => {
		report.reports[1].earlyAndLateRejection = true;
	}), /earlyAndLateRejection/u);
	await tampered(t, "ruby", ({ rewrite }) => rewrite(report => {
		report.reports[0].observations.ruby.consumerSha256 = "0".repeat(64);
	}), /ordinary-full\/ruby/u);
	await tampered(t, "native", ({ rewrite }) => rewrite(report => {
		report.reports[0].observed.c.checks += 1;
	}), /ordinary-full\/c/u);
	await tampered(t, "php", ({ rewrite }) => rewrite(report => {
		report.reports = report.reports.slice(1);
	}), /deep-equal/u);
	await tampered(t, "wit", ({ rewrite }) => rewrite(report => {
		report.reports[2].unexpected = true;
	}), /exact report fields/u);
	await tampered(t, "javascript", ({ rewrite }) => rewrite(report => {
		report.reports[0].browser.executions.pop();
	}), /8 !== 9|Expected values to be strictly equal/u);
	await tampered(t, "native", ({ root, lane, report }) => writeFile(join(root
		, lane.packaging, lane.report), JSON.stringify(report))
	, /must be canonical/u);
	await tampered(t, "python", async ({ root, lane }) => {
		const path = join(root, lane.ci, "acceptance.log");
		const text = await readFile(path, "utf8");
		await writeFile(path, text.replace("# ordinary-full: python=30\n", ""));
	}, /one summary diagnostic/u);
	await tampered(t, "perl", async ({ root, lane }) => {
		const path = join(root, lane.ci, "acceptance.log");
		const text = await readFile(path, "utf8");
		await writeFile(path, text.replace(/"checks":40\}/u, "\"checks\":41}"));
	}, /Perl diagnostics must match/u);
	await tampered(t, "rust", async ({ root, lane }) => {
		const path = join(root, lane.ci, "acceptance.log");
		const text = await readFile(path, "utf8");
		await writeFile(path, text.replace(/(ok 3 - [^\n]*)/u, "$1 # SKIP"));
	}, /SKIP/u);
	await tampered(t, "dotnet", async ({ root, lane, handoff }) => {
		const receipt = join(handoff("ordinary-full"), packageSetReceiptName);
		const document = JSON.parse(await readFile(receipt, "utf8"));
		document.packages[0].target = "maven";
		document.packages[0].ecosystem = "maven";
		await writeFile(receipt, canonicalJson(document));
		await writeFile(`${receipt}.sha256`, `${sha256(Buffer.from(canonicalJson(document)))}  ${packageSetReceiptName}\n`);
		void root; void lane;
	}, /package targets/u);
});

const archiveInputs = async (t, laneName, {
	enforce = "skipped", runConclusion = "success"
} = {}) => {
	const { root, lane } = await synthesize(t, laneName);
	const inputs = await temporary(t, `lean-owned-hosted-inputs-${laneName}-`);
	const zip = join(inputs, "artifact.zip");
	const roots = lane.ci ? [lane.ci, lane.packaging] : [lane.packaging];
	execFileSync("/usr/bin/zip", ["-X", "-r", "-q", zip, ...roots]
		, { cwd: root });
	const bytes = await readFile(zip);
	const run = { id: 4242, status: "completed", conclusion: runConclusion
		, head_sha: revision, path: lane.workflow
		, repository: { full_name: "seanmorris/lean-bridge" }
		, head_repository: { full_name: "seanmorris/lean-bridge" }
		, run_attempt: 1, event: "push"
		, html_url: "https://github.com/seanmorris/lean-bridge/actions/runs/4242"
		, created_at: "2026-10-23T01:02:03Z", updated_at: "2026-10-23T02:03:04Z" };
	const accepted = { name: lane.acceptanceStep, status: "completed"
		, conclusion: "success", number: 7 };
	const terminal = lane.enforceStep
		? { name: lane.enforceStep, status: "completed", conclusion: enforce
			, number: 9 }
		: { name: lane.archiveStep, status: "completed", conclusion: "success"
			, number: 9 };
	const job = { id: 4343, run_id: run.id, head_sha: revision
		, status: "completed", conclusion: "success", name: lane.job
		, labels: ["ubuntu-24.04"], runner_name: "GitHub Actions 1"
		, runner_group_name: "GitHub Actions"
		, started_at: "2026-10-23T01:05:00Z", completed_at: "2026-10-23T02:00:00Z"
		, steps: [{ name: "Check out the exact revision", status: "completed"
			, conclusion: "success", number: 1 }
		, accepted, terminal] };
	const artifact = { id: 4444, name: `${lane.prefix}-${revision}`
		, expired: false, workflow_run: { id: run.id, head_sha: revision }
		, size_in_bytes: bytes.length, digest: `sha256:${sha256(bytes)}`
		, created_at: "2026-10-23T02:00:01Z", expires_at: "2026-11-22T02:00:01Z" };
	const selected = { "artifact-zip": zip };
	for(const [name, value] of Object.entries({ run, job, artifact }))
	{
		selected[`${name}-json`] = join(inputs, `${name}.json`);
		await writeFile(selected[`${name}-json`], `${JSON.stringify(value, null, 2)}\n`);
	}
	return { selected, inputs };
};

test("owned checked-record hosted archives authenticate, retain and replay originals", async t => {
	for(const name of ["native", "jvm", "javascript"])
	{
		const { selected, inputs } = await archiveInputs(t, name);
		const destination = join(inputs, "evidence");
		const index = await writeOwnedCheckedRecordHostedEvidence({ lane: name
			, selected, destination, archiveCommit: revision });
		assert.deepEqual(index.selectedSources, ownedCheckedRecordEvidenceSources(
			name, { producer: revision, consumer: revision, checker: revision
				, archiver: revision }));
		assert.deepEqual(await checkOwnedCheckedRecordHostedEvidence(
			name, destination), index);
		await assert.rejects(writeOwnedCheckedRecordHostedEvidence({ lane: name
			, selected, destination, archiveCommit: revision }), /must be new/u);
		const indexPath = join(destination, "index.json");
		const changed = structuredClone(index);
		changed.accepted.routes[0].archiveBytes += 1;
		await writeFile(indexPath, canonicalJson(changed));
		await assert.rejects(checkOwnedCheckedRecordHostedEvidence(name, destination));
		await writeFile(indexPath, canonicalJson(index));
		const retained = index.files.find(file => file.path.includes("/handoff/archives/"));
		await appendFile(join(destination, retained.path), "x");
		await assert.rejects(checkOwnedCheckedRecordHostedEvidence(name, destination));
	}
	const enforced = await archiveInputs(t, "perl", { enforce: "success" });
	await assert.rejects(writeOwnedCheckedRecordHostedEvidence({ lane: "perl"
		, selected: enforced.selected, destination: join(enforced.inputs, "evidence")
		, archiveCommit: revision }), /skipped/u);
	const forged = await archiveInputs(t, "rust");
	const artifact = JSON.parse(await readFile(forged.selected["artifact-json"], "utf8"));
	artifact.digest = `sha256:${"0".repeat(64)}`;
	await writeFile(forged.selected["artifact-json"], `${JSON.stringify(artifact)}\n`);
	await assert.rejects(writeOwnedCheckedRecordHostedEvidence({ lane: "rust"
		, selected: forged.selected, destination: join(forged.inputs, "evidence")
		, archiveCommit: revision }));
	const failedMatrix = await archiveInputs(t, "javascript"
		, { runConclusion: "failure" });
	const failedMatrixIndex = await writeOwnedCheckedRecordHostedEvidence({
		lane: "javascript", selected: failedMatrix.selected
		, destination: join(failedMatrix.inputs, "evidence")
		, archiveCommit: revision
	});
	assert.deepEqual(failedMatrixIndex.hostedRun.conclusions
		, { run: "failure", job: "success" });
	const cancelledMatrix = await archiveInputs(t, "javascript"
		, { runConclusion: "cancelled" });
	await assert.rejects(writeOwnedCheckedRecordHostedEvidence({
		lane: "javascript", selected: cancelledMatrix.selected
		, destination: join(cancelledMatrix.inputs, "evidence")
		, archiveCommit: revision
	}), /Ineligible hosted run conclusion/u);
});

test("owned checked-record hosted steps require acceptance and skipped enforcement", () => {
	const lane = ownedCheckedRecordHostedLanes.native;
	const job = steps => Buffer.from(JSON.stringify({ steps }));
	const accepted = { name: lane.acceptanceStep, status: "completed"
		, conclusion: "success", number: 7 };
	const skipped = { name: lane.enforceStep, status: "completed"
		, conclusion: "skipped", number: 9 };
	assert.doesNotThrow(() => assertOwnedCheckedRecordHostedSteps(lane
		, job([accepted, skipped])));
	assert.throws(() => assertOwnedCheckedRecordHostedSteps(lane, job([accepted])));
	assert.throws(() => assertOwnedCheckedRecordHostedSteps(lane
		, job([{ ...accepted, conclusion: "failure" }, skipped])));
	assert.throws(() => assertOwnedCheckedRecordHostedSteps(lane
		, job([accepted, { ...skipped, number: 3 }])));
	assert.throws(() => assertOwnedCheckedRecordHostedSteps(lane
		, job([accepted, skipped, { name: "Other", conclusion: "cancelled", number: 10 }])));
	const javascript = ownedCheckedRecordHostedLanes.javascript;
	const javascriptAccepted = { name: javascript.acceptanceStep
		, status: "completed", conclusion: "success", number: 7 };
	const archive = { name: javascript.archiveStep, status: "completed"
		, conclusion: "success", number: 9 };
	assert.doesNotThrow(() => assertOwnedCheckedRecordHostedSteps(
		javascript, job([javascriptAccepted, archive])));
	assert.throws(() => assertOwnedCheckedRecordHostedSteps(javascript
		, job([javascriptAccepted, { ...archive, conclusion: "skipped" }])));
});

test("owned checked-record source roles retain workflow inputs and unreachable assets", () => {
	const revisions = { producer: revision, consumer: revision
		, checker: revision, archiver: revision };
	const has = (sources, role, path) => sources.some(item =>
		item.role === role && item.path === path);
	for(const name of ownedCheckedRecordHostedLaneNames)
	{
		const lane = ownedCheckedRecordHostedLanes[name];
		const sources = ownedCheckedRecordEvidenceSources(name, revisions);
		for(const path of [lane.test, lane.workflow, "scripts/env.sh"
			, ".github/actions/bounded-apt/action.yml", "scripts/bootstrap-toolchains.sh"
			, "src/backends/c/gmp.source.tar.xz", "src/build/ResolveLakeWorkspace.lean"
			, "tests/fixtures/onboarding/owned-checked-records/OwnedCheckedRecords.lean"])
			assert.ok(has(sources, "producer", path), `${name}: ${path}`);
		assert.ok(has(sources, "checker"
			, "tests/helpers/owned-checked-record-hosted-output.mjs"), name);
		assert.ok(has(sources, "archiver"
			, "scripts/archive-owned-checked-record-evidence.mjs"), name);
		assert.ok(sources.filter(item => item.role === "consumer").length >= 2, name);
	}
	const perl = ownedCheckedRecordEvidenceSources("perl", revisions);
	for(const path of ["src/backends/perl/OwnedAssets.pm"
		, "src/backends/perl/Platform.pm", "scripts/build-perl-toolchains.mjs"])
		assert.ok(has(perl, "producer", path), path);
	assert.ok(has(ownedCheckedRecordEvidenceSources("rust", revisions), "producer"
		, "src/backends/rust/dependencies.lock"));
	assert.ok(has(ownedCheckedRecordEvidenceSources("wit", revisions), "producer"
		, "flake.lock"));
	assert.throws(() => ownedCheckedRecordEvidenceSources("php-wasm", revisions));
});
