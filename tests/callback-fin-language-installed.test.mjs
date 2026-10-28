/**
 * Installed Python, Ruby and Rust acceptance for checked Fin callbacks and
 * returned Lean closures, through ordinary and independently reviewed input.
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
	callbackFinConfiguration, callbackFinFixture, callbackFinReviewedIr
} from "./helpers/callback-fin-fixture.mjs";
import {
	clearCallbackFinRetainedPackages, retainCallbackFinRoute
	, writeCallbackFinRetainedPackages
} from "./helpers/callback-fin-retained-packages.mjs";
import {
	installCopiedConsumer, nativeFixtureEnvironment
} from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";

const profiles = process.env.LEAN_BRIDGE_CALLBACK_FIN_LANGUAGE_PROFILES
	?.split(",").sort() ?? [];
assert.ok(profiles.length === new Set(profiles).size
	&& profiles.every(profile => ["python", "ruby", "rust"].includes(profile)));
const targets = {
	python: ["pypi", { name: "reviewedcallbacks", version: "1.0.0" }]
	, ruby: ["rubygems", { name: "reviewedcallbacks", version: "1.0.0" }]
	, rust: ["cargo", { name: "reviewedcallbacks", version: "1.0.0" }]
};
const expectedChecks = { python: 20, ruby: 20, rust: 15 };

test("ordinary and reviewed Python, Ruby and Rust callback Fin packages install offline", {
	skip: !profiles.length, timeout: 3_600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-callback-fin-languages-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true, force: true });
		else t.diagnostic(`Retained failed callback Fin language inputs: ${root}`);
	});
	const output = resolve(process.env.LEAN_BRIDGE_CALLBACK_FIN_LANGUAGE_OUTPUT
		?? "build/callback-fin/languages/report.json");
	await clearCallbackFinRetainedPackages(output);
	const retainedEntries = [], reports = [];
	const environment = nativeFixtureEnvironment(profiles);
	const review = callbackFinReviewedIr();
	for(const route of ["ordinary", "reviewed"])
	{
		const routeRoot = join(root, route), author = join(routeRoot, "author");
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const handoff = join(routeRoot, "handoff");
		await cp(callbackFinFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
			...callbackFinConfiguration(route)
			, targets: Object.fromEntries(profiles.map(profile => targets[profile]))
		}));
		if(route === "reviewed")
			await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
		const before = await lakeInputState(projectRoot);
		t.diagnostic(`${route}: building callback Fin for ${profiles.join(", ")}`);
		const targetNames = profiles.map(profile => targets[profile][0]);
		const built = await buildCanonicalProject({
			projectRoot, outputRoot, targets: targetNames, environment
		}).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`;
			throw error;
		});
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const model = JSON.parse(await readFile(
			join(outputRoot, "native/component/model.json"), "utf8"));
		assert.equal(reviewedContractDifference(review, model.bindingIr), null);
		const { receipt, entry } = await retainCallbackFinRoute({
			output, route, source: outputRoot, handoff
		});
		retainedEntries.push(entry);
		await verifyPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		let dependencies;
		if(profiles.includes("rust")) dependencies = await prepareRustCorpusDependencies({
			rustRoot: join(outputRoot, "native/rust"), directory: author
			, handoff: join(routeRoot, "rust-consumer/dependencies"), environment
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
					source: () => readFile(`tests/fixtures/callback-fin-consumers/${profile}.${{
						python: "py", ruby: "rb", rust: "rs"
					}[profile]}`, "utf8")
					, success: "callback-fin-language-ok"
					, expectedChecks: expectedChecks[profile]
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
	await saveLakeFile(dirname(output), basename(output)
		, canonicalJson({ schemaVersion: 1, reports }));
	await writeCallbackFinRetainedPackages(output, retainedEntries);
	complete = true;
});
