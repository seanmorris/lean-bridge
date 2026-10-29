/**
 * Reconstruct the exact source closures behind hosted PHP HostNull evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { extname, posix } from "node:path";
import {
	checkedRecordValueIndexHostedOriginal as original
} from "./checked-record-value-index-hosted-evidence-sources.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";

export const hostNullPhpHostedOriginal = original;

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = original(revision, path);
		paths.add(path);
		if(!/\.[cm]?js$/u.test(path)) return;
		for(const specifier of moduleSpecifiers(bytes.toString(), path))
		{
			const joined = posix.normalize(posix.join(
				posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...paths];
};
const fixture = [
	"HostNullDemo.lean", "lakefile.toml", "lean-toolchain", "package.json"
].map(path => `tests/fixtures/onboarding/host-null/${path}`);
const freeze = roles => Object.freeze(roles.flatMap(
	({ role, revision, paths }) => [...new Set(paths)].sort().map(path =>
		Object.freeze({ role, revision, path })))
);

/**
 * Select all producer, consumer, checker and archiver sources for one profile.
 *
 * @param profile - Native PHP or PHP-Wasm evidence profile.
 * @param revisions - Exact producer, consumer, checker and archiver commits.
 */
export const hostNullPhpHostedEvidenceSources = (
	profile, revisions
) => {
	assert.ok(["php-native", "php-wasm"].includes(profile));
	assert.deepEqual(Object.keys(revisions).sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	const test = profile === "php-native"
		? "tests/php-host-null.test.mjs"
		: "tests/php-wasm-host-null.test.mjs";
	return freeze([
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [test])
				, ...fixture, "lean-bridge.exports.json"
				, ".github/workflows/consumer-matrix.yml"
			]
		}
		, {
			role: "consumer", revision: revisions.consumer
			, paths: ["tests/fixtures/host-null-consumers/php.php"]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: closure(revisions.checker, [
				"tests/helpers/host-null-php-evidence.mjs"
				, "tests/helpers/host-null-php-report.mjs"
				, "tests/helpers/host-null-php-promotion.mjs"
			])
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver, [
				"scripts/archive-host-null-php-evidence.mjs"
			])
		}
	]);
};
