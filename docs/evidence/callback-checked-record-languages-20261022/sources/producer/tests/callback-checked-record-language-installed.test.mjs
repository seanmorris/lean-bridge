/**
 * Installed Python, Ruby and Rust acceptance for directional callback checked
 * records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { reviewedContractDifference } from "../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import {
	callbackCheckedRecordConfiguration
	, callbackCheckedRecordFixture
	, callbackCheckedRecordReviewedIr
} from "./helpers/callback-checked-record-fixture.mjs";
import {
	installCopiedConsumer, nativeFixtureEnvironment
} from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";

const profiles = process.env
	.LEAN_BRIDGE_CALLBACK_CHECKED_RECORD_LANGUAGE_PROFILES?.split(",").sort() ?? [];
assert.ok(profiles.every(profile => ["python", "ruby", "rust"].includes(profile)));
const targets = {
	python: ["pypi", { name: "callback-checked-records", version: "1.0.0" }]
	, ruby: ["rubygems", { name: "callback-checked-records", version: "1.0.0" }]
	, rust: ["cargo", { name: "callback-checked-records", version: "1.0.0" }]
};

test("ordinary and reviewed Python, Ruby and Rust callback checked records install offline", {
	skip: !profiles.length, timeout: 3_600_000
}, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-callback-checked-record-languages-"
	));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true, force: true });
		else t.diagnostic(
			`Retained failed callback checked-record language inputs: ${root}`);
	});
	const environment = nativeFixtureEnvironment(profiles), reports = [];
	let review;
	for(const route of ["ordinary", "reviewed"])
	{
		const routeRoot = join(root, route), author = join(routeRoot, "author");
		const projectRoot = join(author, "project");
		const outputRoot = join(author, "release");
		const handoff = join(routeRoot, "handoff");
		await cp(callbackCheckedRecordFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
			...callbackCheckedRecordConfiguration(route)
			, targets: Object.fromEntries(
				profiles.map(profile => targets[profile]))
		}));
		if(route === "reviewed")
			await saveLakeFile(projectRoot, "api.binding-ir.json"
				, canonicalJson(review));
		const before = await lakeInputState(projectRoot);
		const targetNames = profiles.map(profile => targets[profile][0]);
		t.diagnostic(`${route}: building callback checked records for ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({
			projectRoot, outputRoot, targets: targetNames, environment
		}).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`;
			throw error;
		});
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const model = JSON.parse(await readFile(
			join(outputRoot, "native/component/model.json"), "utf8"));
		if(route === "ordinary")
			review = callbackCheckedRecordReviewedIr(model.bindingIr);
		else assert.equal(reviewedContractDifference(review, model.bindingIr), null);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		let dependencies;
		if(profiles.includes("rust"))
			dependencies = await prepareRustCorpusDependencies({
				rustRoot: join(outputRoot, "native/rust"), directory: author
				, handoff: join(routeRoot, "rust-consumer/dependencies")
				, environment
			});
		await rm(author, { recursive: true, force: true });
		for(const profile of profiles)
		{
			const consumer = join(routeRoot, `${profile}-consumer`);
			const target = targets[profile][0];
			const observation = await installCopiedConsumer({
				profile, consumer, handoff, dependencies
				, packages: receipt.packages.filter(pkg => pkg.target === target)
				, environment
				, fixture: {
					source: () => readFile(
						`tests/fixtures/callback-checked-record-consumers/${profile}.${{
							python: "py", ruby: "rb", rust: "rs"
						}[profile]}`, "utf8")
					, success: "callback-checked-record-language-ok"
					, expectedChecks: profile === "rust" ? 28 : 26
				}
			});
			delete observation.command;
			reports.push({
				route
				, profile
				, ...observation
				, bindingIrSha256: built.bindingIrSha256
				, receiptSha256: sha256(await readFile(
					join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true
			});
			await rm(consumer, { recursive: true, force: true });
		}
	}
	const output = resolve(process.env
		.LEAN_BRIDGE_CALLBACK_CHECKED_RECORD_LANGUAGE_OUTPUT
		?? "build/callback-checked-records/languages.json");
	await saveLakeFile(dirname(output), basename(output)
		, canonicalJson({ schemaVersion: 1, reports }));
	complete = true;
});
