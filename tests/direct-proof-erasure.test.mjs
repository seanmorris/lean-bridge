/**
 * Shared contract controls for the seventeen-profile direct proof-erasure matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import {
	reconcileReviewedSource, reviewedSourceSelection, validateReviewedSource
} from "../src/analyze/reviewed-source.mjs";
import {
	assertDirectProofErasureIr
	, directProofErasureFixture
	, directProofErasureKey
	, directProofErasureModule
	, directProofErasureProfiles
	, directProofErasureReview
	, directProofErasureTargets
} from "./helpers/direct-proof-erasure-fixture.mjs";
import {
	directProofErasureTargetConfiguration, prepareDirectProofErasureProject
} from "./helpers/direct-proof-erasure-packages.mjs";

const capture = document => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document) };
};
const identity = review => {
	const configuration = { schemaVersion: 1, modules: [directProofErasureModule] };
	const source = canonicalJson(configuration);
	return { exportConfigurationSource: source
		, exportConfigurationSha256: sha256(source)
		, reviewedBindingIr: review
		, request: { modules: [directProofErasureModule]
			, exportModules: [directProofErasureModule], resources: []
			, ...reviewedSourceSelection(review) } };
};

test("the shared Lean fixture names both closed proofs and explicit refusals", async () => {
	assert.deepEqual((await readdir(directProofErasureFixture)).sort(), [
		"DirectProofErasure.lean", "LICENSE", "lakefile.toml"
		, "lean-toolchain", "package.json"
	]);
	const source = await readFile(
		`${directProofErasureFixture}/DirectProofErasure.lean`, "utf8"
	);
	assert.match(source
		, /def keep \(_before : True\) \(value : UInt32\) \(_after : True\)/u);
	assert.match(source, /theorem keep_eq/u);
	assert.match(source, /def conditional \(value : UInt32\) \(_proof : value = 0\)/u);
	assert.match(source, /def proofValue : True := True\.intro/u);
});

test("the independent review exposes one runtime word and two exact erased proofs", () => {
	const document = directProofErasureReview();
	const review = capture(document);
	validateReviewedSource(review);
	assertDirectProofErasureIr(document);
	assert.deepEqual(reviewedSourceSelection(review), {
		exports: [`${directProofErasureModule}.keep`], arities: []
	});
	assert.equal(directProofErasureProfiles.length, 17);
	assert.equal(new Set(directProofErasureProfiles).size, 17);
	assert.deepEqual(Object.keys(directProofErasureTargets).sort()
		, directProofErasureProfiles);
});

test("seventeen consumer profiles collapse to twelve exact package targets", () => {
	const targets = directProofErasureTargetConfiguration(directProofErasureProfiles);
	assert.deepEqual(Object.keys(targets).sort(), [
		"c", "cargo", "cpan", "cpp", "maven", "npm", "nuget", "php-native"
		, "php-wasm", "pypi", "rubygems", "wit-wasi"
	]);
	assert.deepEqual(targets.npm
		, { name: "direct-proof-erasure", version: "1.0.0" });
	assert.deepEqual(targets.maven
		, { name: "org.leanbridge:directprooferasure", version: "1.0.0" });
	assert.deepEqual(targets["php-wasm"], {
		npm: { name: "@example/directprooferasure-php-wasm", version: "1.0.0" }
		, composer: { name: "example/directprooferasure-php-wasm", version: "1.0.0" }
	});
	assert.throws(() => directProofErasureTargetConfiguration([]), TypeError);
	assert.throws(() => directProofErasureTargetConfiguration(["unknown"]), TypeError);
	assert.throws(() => directProofErasureTargetConfiguration(["c", "c"]), TypeError);
});

for(const route of ["ordinary", "reviewed"]) test(
	`${route} package preparation keeps one shared source and exact route inputs`, async t => {
		const prepared = await prepareDirectProofErasureProject(t, {
			route, profiles: directProofErasureProfiles
		});
		assert.deepEqual(JSON.parse(await readFile(
			`${prepared.projectRoot}/lean-bridge.exports.json`, "utf8"
		)), prepared.configuration);
		assert.deepEqual(prepared.configuration.modules, [directProofErasureModule]);
		assert.deepEqual(prepared.configuration.exports
			, route === "ordinary" ? [`${directProofErasureModule}.keep`] : undefined);
		assert.equal(await readFile(
			`${prepared.projectRoot}/DirectProofErasure.lean`, "utf8"
		), await readFile(`${directProofErasureFixture}/DirectProofErasure.lean`, "utf8"));
		if(route === "reviewed")
		{
			assert.deepEqual(JSON.parse(await readFile(
				`${prepared.projectRoot}/api.binding-ir.json`, "utf8"
			)), directProofErasureReview());
		}
		else await assert.rejects(access(
			`${prepared.projectRoot}/api.binding-ir.json`
		), { code: "ENOENT" });
	}
);

test("review reconciliation refuses changed proof, source and theorem claims", () => {
	const reviewed = directProofErasureReview();
	const review = capture(reviewed);
	const compiled = structuredClone(reviewed);
	compiled.producers[0].extensions = { "example.org/compiler": "fresh" };
	compiled.declarations[0].source.extensions["lean-lang.org/source-position"]
		= { path: "DirectProofErasure.lean", startLine: 4 };
	compiled.declarations[0].source.extensions["lean-lang.org/theorem-references"]
		= ["DirectProofErasure.keep_eq"];
	assert.deepEqual(reconcileReviewedSource(review, compiled, identity(review)), compiled);
	for(const mutate of [
		proof => { proof.sourceIndex = 1; }
		, proof => { proof.name = "_changed"; }
		, proof => { proof.proposition = "False"; }
	]) {
		const changed = structuredClone(reviewed);
		mutate(changed.declarations[0].source.extensions[directProofErasureKey]
			.parameters[0]);
		const changedReview = capture(changed);
		assert.throws(() => reconcileReviewedSource(
			changedReview, compiled, identity(changedReview)
		), { code: "reviewed-ir-source-mismatch" });
	}
	const source = structuredClone(compiled);
	source.declarations[0].source.declaration = "DirectProofErasure.other";
	assert.throws(() => reconcileReviewedSource(review, source, identity(review))
		, { code: "reviewed-ir-source-mismatch" });
	const theorem = structuredClone(reviewed);
	theorem.declarations[0].source.extensions["lean-lang.org/theorem-references"]
		= ["DirectProofErasure.fabricated"];
	assert.throws(() => validateReviewedSource(capture(theorem))
		, { code: "reviewed-ir-build-unsupported" });
});

test("review validation rejects fabricated witnesses and leaked proof positions", () => {
	for(const mutate of [
		proofs => { proofs[0].witness = "False.elim"; }
		, proofs => { proofs[1].sourceIndex = proofs[0].sourceIndex; }
		, proofs => { proofs[1].sourceIndex = 3; }
	]) {
		const document = directProofErasureReview();
		mutate(document.declarations[0].source.extensions[directProofErasureKey]
			.parameters);
		assert.throws(() => validateReviewedSource(capture(document))
			, { code: "reviewed-ir-build-unsupported" });
	}
});
