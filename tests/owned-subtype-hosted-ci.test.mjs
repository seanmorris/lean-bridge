/**
 * Refusal controls for independently checked hosted owned Subtype evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertOwnedSubtypeHostedTap, ownedSubtypeHostedLanes
	, ownedSubtypeHostedVerification, parseOwnedSubtypeHostedCiArgs
} from "./helpers/owned-subtype-hosted-ci.mjs";
import {
	ownedSubtypeHostedContracts, ownedSubtypeHostedLaneNames
} from "./helpers/owned-subtype-hosted-contracts.mjs";
import {
	assertOwnedSubtypeHostedSteps, checkOwnedSubtypeHostedEvidence
} from "./helpers/owned-subtype-hosted-evidence.mjs";
import {
	ownedSubtypeEvidenceSources
} from "./helpers/owned-subtype-hosted-evidence-sources.mjs";

const producer = "a".repeat(40), digest = value => value.repeat(64);
const specifications = Object.freeze({
	native: { count: 4
		, names: [
			"installed ordinary owned Subtypes execute through C and C++ archives"
			, "installed reviewed owned Subtypes execute through C and C++ archives"
		]
	}
	, perl: { count: 4
		, names: [
			"installed ordinary owned Subtypes execute through CPAN archives"
			, "installed reviewed owned Subtypes execute through CPAN archives"
		]
	}
	, languages: { count: 4
		, names: [
			"installed ordinary owned Subtypes execute through wheel, gem and crate archives"
			, "installed reviewed owned Subtypes execute through wheel, gem and crate archives"
		]
	}
	, dotnet: { count: 5
		, names: [
			"installed ordinary checked owned Subtypes execute in dotnet"
			, "installed reviewed checked owned Subtypes execute in dotnet"
		]
	}
	, jvm: { count: 5
		, names: [
			"installed ordinary checked owned Subtypes execute in jvm"
			, "installed reviewed checked owned Subtypes execute in jvm"
		]
	}
	, "php-native": { count: 5
		, names: [
			"installed ordinary checked owned Subtypes execute in php-native"
			, "installed reviewed checked owned Subtypes execute in php-native"
		]
	}
	, "wit-wasi": { count: 5
		, names: [
			"installed ordinary checked owned Subtypes execute in wit-wasi"
			, "installed reviewed checked owned Subtypes execute in wit-wasi"
		]
	}
});
const tapFor = lane => {
	const { count, names } = specifications[lane];
	const selected = [...names
		, ...Array.from({ length: count - names.length }
			, (_, index) => `${lane} prerequisite ${index + 1}`)];
	return `> lean-bridge@test\n> node --test\n\nTAP version 13\n${selected
		.map((name, index) => `# Subtest: ${name}\nok ${index + 1} - ${name}`)
		.join("\n")}\n1..${count}\n# tests ${count}\n# suites 0\n# pass ${count}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 12.5\n`;
};
const receipt = targets => ({ packages: targets.map(target => ({ target })) });
const reportFor = lane => {
	const routes = ["ordinary", "reviewed"];
	if(lane === "native") return {
		schemaVersion: 1, profile: "installed-owned-subtype-native"
		, reports: routes.map((route, index) => ({ reviewed: index === 1
			, sourceUnchanged: true, sourceFreeInstallation: true
			, relocatedInstallation: true, deterministicReassembly: true
			, transferredInputCheckedBeforeHandoff: true
			, callbackCoexistence: true
			, lifecycle: { c: "manual-owner-release"
				, cpp: "raii-plus-sanitizers" }
			, packageSetReceipt: receipt(["c", "cpp"])
			, observed: { c: { checks: 149 }, cpp: { checks: 79 } }
			, relocated: { c: { sanitizer: null }
				, cpp: { sanitizer: { stdout: `${route}\n` } } }
		}))
	};
	if(lane === "perl") return {
		schemaVersion: 1, profile: "installed-owned-subtype-perl"
		, reports: routes.map((route, routeIndex) => ({ route
			, sourceUnchanged: true, sourceFreeInstallation: true
			, relocatedInstallation: true, deterministicReassembly: true
			, compilerSelectedConstructors: true
			, transferredInputCheckedBeforeHandoff: true
			, callbackCoexistence: true
			, lifecycle: { fallback: "perl-destruction"
				, observation: "native-identity-baseline-restored" }
			, packageSetReceipt: receipt(["cpan", "cpan"])
			, consumerSha256: digest(String(routeIndex + 1))
			, observations: ["5.36.3-threaded", "5.36.3-unthreaded"
				, "5.38.2-threaded", "5.38.2-unthreaded"]
				.flatMap(perl => ["prebuilt-only", "build-xs"].map(mode => ({
					perl, mode, runtimeOnlyRuns: 2
					, observed: { checks: 72, live_identities: 0 }
				})))
		}))
	};
	if(lane === "languages") return {
		schemaVersion: 1, profile: "installed-owned-subtype-languages"
		, reports: routes.map((route, routeIndex) => ({ route
			, sourceUnchanged: true, sourceFreeInstallation: true
			, relocatedInstallation: true
			, handoffRemovedBeforeRelocatedExecution: true
			, deterministicReassembly: true
			, compilerSelectedConstructors: true
			, transferredInputCheckedBeforeHandoff: true
			, packageSetReceipt: receipt(["pypi", "rubygems", "cargo"])
			, observations: Object.fromEntries(["python", "ruby", "rust"]
				.map((profile, index) => [profile, { checks: 100 + index
					, relocatedChecks: 100 + index
					, consumerSha256: digest(String(routeIndex + index + 1)) }]))
			, lifecycle: {
				python: { observation: "owning-slot-baseline-restored" }
				, ruby: { observation: "queued-owner-drained" }
				, rust: { fallback: "drop" }
			}
		}))
	};
	const profiles = { dotnet: ["dotnet"], jvm: ["java", "kotlin"]
		, "php-native": ["php-native"], "wit-wasi": ["wit-wasi"] }[lane];
	return { schemaVersion: 1, profile: "installed-owned-subtype-remaining"
		, lane
		, reports: routes.map((route, routeIndex) => ({ route
			, sourceUnchanged: true, sourceFreeInstallation: true
			, relocatedInstallation: true
			, handoffRemovedBeforeRelocatedExecution: true
			, deterministicReassembly: true
			, compilerSelectedConstructors: true
			, transferredInputCheckedBeforeHandoff: true
			, immutableInstalledInputs: true
			, packageSetReceiptSha256: digest(String(routeIndex + 1))
			, observations: Object.fromEntries(profiles.map((profile, index) => [profile
				, { checks: 100 + index
					, consumerSha256: digest(String(routeIndex + index + 1)) }]))
			, repeated: Object.fromEntries(profiles.map((profile, index) => [profile
				, { checks: 100 + index }]))
			, lifecycle: Object.fromEntries(profiles.map(profile => [profile
				, { fallback: "fixture" }]))
		}))
	};
};

test("owned Subtype hosted checker covers every package lane", () => {
	for(const lane of ownedSubtypeHostedLanes)
	{
		const result = ownedSubtypeHostedVerification(
			lane, producer, tapFor(lane), reportFor(lane));
		assert.equal(result.kind, `owned-subtype-${lane}`);
		assert.equal(result.producerCommit, producer);
		assert.deepEqual(result.routes, ["ordinary", "reviewed"]);
		assert.match(result.reportSha256, /^[a-f0-9]{64}$/u);
	}
});

test("owned Subtype hosted checker rejects incomplete or skipped TAP", () => {
	const source = tapFor("native");
	assert.throws(() => assertOwnedSubtypeHostedTap(
		source.replace("# pass 4", "# pass 3"), "native"));
	assert.throws(() => assertOwnedSubtypeHostedTap(
		source.replace("ok 1 -", "ok 1 - # SKIP "), "native"), /SKIP/u);
	assert.throws(() => assertOwnedSubtypeHostedTap(
		source.replace("ok 2 -", "not ok 2 -"), "native"), /not ok/u);
	assert.throws(() => assertOwnedSubtypeHostedTap(
		source.replace(specifications.native.names[1], "different route"), "native"));
});

test("owned Subtype hosted checker rejects semantic report mutations", () => {
	const changedChecks = reportFor("native");
	changedChecks.reports[0].observed.c.checks = 148;
	assert.throws(() => ownedSubtypeHostedVerification(
		"native", producer, tapFor("native"), changedChecks));
	const missingRoute = reportFor("perl"); missingRoute.reports.pop();
	assert.throws(() => ownedSubtypeHostedVerification(
		"perl", producer, tapFor("perl"), missingRoute));
	const forgedReceipt = reportFor("languages");
	forgedReceipt.reports[0].packageSetReceipt.packages[0].target = "npm";
	assert.throws(() => ownedSubtypeHostedVerification(
		"languages", producer, tapFor("languages"), forgedReceipt));
	const incompleteLifecycle = reportFor("jvm");
	delete incompleteLifecycle.reports[0].lifecycle.kotlin;
	assert.throws(() => ownedSubtypeHostedVerification(
		"jvm", producer, tapFor("jvm"), incompleteLifecycle));
});

test("owned Subtype hosted checker accepts only closed invocations", () => {
	assert.deepEqual(parseOwnedSubtypeHostedCiArgs([
		"--lane", "native", "--producer", producer
		, "--tap", "run.tap", "--report", "report.json"
	]), { lane: "native", producer, tap: "run.tap", report: "report.json" });
	for(const args of [
		["--lane", "unknown", "--producer", producer, "--tap", "x", "--report", "y"]
		, ["--lane", "native", "--producer", "HEAD", "--tap", "x", "--report", "y"]
		, ["--lane", "native", "--producer", producer, "--tap", "x", "--tap", "y"]
	]) assert.throws(() => parseOwnedSubtypeHostedCiArgs(args), /Usage:/u);
});

test("owned Subtype archive contracts close all seven hosted lanes", async () => {
	assert.deepEqual(ownedSubtypeHostedLaneNames, ["native", "perl"
		, "languages", "dotnet", "jvm", "php-native", "wit-wasi"]);
	assert.deepEqual(ownedSubtypeHostedLaneNames
		, [...ownedSubtypeHostedLanes]);
	const profiles = ownedSubtypeHostedLaneNames.flatMap(lane =>
		ownedSubtypeHostedContracts[lane].profiles).toSorted();
	assert.deepEqual(profiles, ["c", "cpp", "dotnet", "java", "kotlin"
		, "perl", "php-native", "python", "ruby", "rust", "wit-wasi"]);
	for(const lane of ownedSubtypeHostedLaneNames)
	{
		const contract = ownedSubtypeHostedContracts[lane];
		const workflow = await readFile(contract.workflow, "utf8");
		const matrix = value => contract.ci === null
			? value.replaceAll(lane, "${{ matrix.lane }}") : value;
		for(const value of [matrix(contract.job), matrix(contract.prefix)
			, contract.acceptanceStep
			, contract.enforceStep, matrix(contract.tap), matrix(contract.toolchain)
			, `${contract.packaging}/`])
			assert.ok(workflow.includes(value), `${lane}: ${value}`);
		const steps = [{ number: 1, name: contract.acceptanceStep
			, status: "completed", conclusion: "success" }
		, { number: 2, name: contract.enforceStep
			, status: "completed", conclusion: "skipped" }];
		assertOwnedSubtypeHostedSteps(contract, Buffer.from(JSON.stringify({ steps })));
		assert.throws(() => assertOwnedSubtypeHostedSteps(contract
			, Buffer.from(JSON.stringify({ steps: steps.map(step => ({ ...step
				, conclusion: "success" })) }))));
	}
});

test("owned Subtype archives retain exact four-role source closures", () => {
	const revision = execFileSync("git", ["rev-parse", "HEAD"]
		, { encoding: "utf8" }).trim();
	for(const lane of ownedSubtypeHostedLaneNames)
	{
		const sources = ownedSubtypeEvidenceSources(lane, {
			producer: revision, consumer: revision
			, checker: revision, archiver: revision
		});
		assert.deepEqual([...new Set(sources.map(source => source.role))]
			, ["producer", "consumer", "checker", "archiver"]);
		assert.equal(new Set(sources.map(source =>
			`${source.role}/${source.path}`)).size, sources.length);
		const contract = ownedSubtypeHostedContracts[lane];
		assert.ok(sources.some(source => source.role === "producer"
			&& source.path === contract.workflow));
		assert.ok(sources.some(source => source.role === "producer"
			&& source.path === contract.test));
		assert.ok(sources.some(source => source.role === "checker"
			&& source.path === "tests/helpers/owned-subtype-hosted-output.mjs"));
		assert.ok(sources.some(source => source.role === "archiver"
			&& source.path === "scripts/archive-owned-subtype-evidence.mjs"));
	}
});

const evidenceDirectories = readdirSync("docs/evidence", {
	withFileTypes: true
}).filter(entry => entry.isDirectory()).map(entry => entry.name);

for(const lane of ownedSubtypeHostedLaneNames)
{
	const roots = evidenceDirectories.filter(name => new RegExp(
		`^owned-subtype-${lane}-hosted-\\d{8}$`, "u").test(name));
	test(`retained ${lane} owned Subtype hosted evidence replays`, {
		skip: roots.length === 0, timeout: 600_000
	}, async () => {
		for(const root of roots)
			await checkOwnedSubtypeHostedEvidence(lane, `docs/evidence/${root}`);
	});
}
