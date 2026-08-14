/**
 * Tests exact signed archive subjects for every supported downstream consumer.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	releaseArchiveSubjectsFor,
	validateReleaseArchiveSubjects,
} from "../src/release/archive-subjects.mjs";

const hash = character => character.repeat(64);

const consumerEcosystems = Object.freeze({
	"node-javascript": ["npm"]
	, "node-typescript": ["npm"]
	, "browser-javascript": ["npm"]
	, "php-native": ["php-native"]
	, "php-wasm": ["php-wasm-lazy", "php-wasm-startup"]
	, dotnet: ["nuget"]
	, jvm: ["maven"]
	, ruby: ["rubygems"]
	, python: ["pypi"]
	, rust: ["cargo"]
	, c: ["c"]
	, cpp: ["cpp"]
	, "wit-wasi": ["wit-wasi"]
});

const operations = new Map([
	["npm", "publish"]
	, ["cargo", "publish"]
	, ["pypi", "publish"]
	, ["nuget", "publish"]
	, ["maven", "publish"]
	, ["rubygems", "publish"]
]);

test("every supported consumer maps to an exact authenticated archive subject", async () => {
	const support = JSON.parse(await readFile("docs/consumer-support.v1.json", "utf8"));
	const supported = support.consumers.filter(consumer => consumer.state === "supported").map(consumer => consumer.id).sort();
	assert.deepEqual(Object.keys(consumerEcosystems).sort(), supported);
	const ecosystems = [...new Set(Object.values(consumerEcosystems).flat())].sort();
	const targets = ecosystems.map((ecosystem, index) => ({
		ecosystem
		, coordinate: `${ecosystem}-alpha@1.2.3`
		, operation: operations.get(ecosystem) ?? "retain"
		, archives: [{
			kind: ecosystem.includes("php") ? "php-package" : "package"
			, path: `release/packages/${ecosystem}/alpha-${ecosystem}.archive`
			, bytes: 100 + index
			, sha256: hash((index % 10).toString())
		}]
	}));
	const subjects = releaseArchiveSubjectsFor(targets);
	assert.equal(subjects.length, ecosystems.length);
	assert.equal(validateReleaseArchiveSubjects(subjects, targets), true);
	for(const subject of subjects)
	{
		assert.equal(subject.filename, `alpha-${subject.ecosystem}.archive`);
		assert.equal(subject.coordinate, `${subject.ecosystem}-alpha@1.2.3`);
		assert.match(subject.sha256, /^[0-9a-f]{64}$/);
	}
});

test("archive subjects reject duplicate paths and target drift", () => {
	const target = ecosystem => ({
		ecosystem
		, coordinate: `${ecosystem}-alpha@1.2.3`
		, operation: "retain"
		, archives: [{ kind: "package", path: "release/packages/shared.archive", bytes: 10, sha256: hash("a") }]
	});
	assert.throws(() => releaseArchiveSubjectsFor([target("c"), target("cpp")]), /duplicated/);
	const subjects = releaseArchiveSubjectsFor([target("c")]);
	const changed = structuredClone(subjects);
	changed[0].bytes += 1;
	assert.throws(() => validateReleaseArchiveSubjects(changed, [target("c")]), /differ/);
});
