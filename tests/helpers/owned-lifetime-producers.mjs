/**
 * Exact producer replay for retained borrow, receiver and machine-width evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import { moduleAtProducer, moduleAtProducerWithSourceReads } from "./producer-module.mjs";
import { bytesAtProducer } from "./producer-source.mjs";

export const ownedLifetimeProducers = Object.freeze({
	cppBorrow: Object.freeze({
		revision: "dec8d558423d1b1c2ec4b95999ea8779adb60091"
		, entries: Object.freeze([
			"src/backends/c/owned-package.mjs"
			, "src/backends/cpp/owned-package.mjs"
			, "src/build/native-graph-model.mjs"
			, "src/release/package-set-receipt.mjs"
		])
		// This imported payload was omitted from the original source list.
		, supplementalSources: Object.freeze({
			"src/backends/cpp/boost.source.json": "2e5ded51d6fa32f4d06d22eaf0bb10f54bdbfcf17731bea4f1554923a09ce10c"
		})
	})
	, rustReceiver: Object.freeze({
		revision: "18324f5a302fb99238b8a503114b3f5a5294d3cd"
		, entries: Object.freeze([
			"src/analyze/package-metadata.mjs"
			, "src/build/native-graph-model.mjs"
			, "src/backends/c/owned-package.mjs"
			, "src/backends/rust/owned-callables.mjs"
			, "src/backends/rust/owned-package.mjs"
			, "tests/helpers/owned-rust-borrow-fixture.mjs"
			, "tests/helpers/owned-rust-receiver-fixture.mjs"
			, "tests/helpers/owned-receiver-fixture.mjs"
		])
		, sourceReadEntries: Object.freeze(["tests/helpers/owned-rust-receiver-fixture.mjs"])
		, dataPaths: Object.freeze([
			"tests/fixtures/structured-types/owned-rust-borrows.rs"
			, "tests/fixtures/structured-types/owned-rust-receivers.rs"
		])
	})
	, jvmGc: Object.freeze({
		revision: "a53368d1bb94f7651cdd571365e8e7a5e6212cd2"
		, entries: Object.freeze([
			"src/build/native-graph-model.mjs"
			, "src/backends/jvm/owned-package.mjs"
			, "tests/helpers/owned-jvm-call-fixture.mjs"
			, "tests/helpers/owned-rust-receiver-fixture.mjs"
		])
		, dataPaths: Object.freeze([
			"tests/fixtures/onboarding/owned-aggregates/Owned.lean"
			, "tests/fixtures/structured-types/owned-jvm-receiver-gc.java"
			, "tests/fixtures/structured-types/owned-kotlin-receiver-gc.kt"
		])
		// Imported tool options were absent from this receipt's source list.
		, supplementalSources: Object.freeze({
			"tests/helpers/type-corpus-jvm-tools.mjs": "5f21567ed7dfd107bad21bfe3e57a448d1a525890133b684cf6a7758e4a334a7"
		})
	})
	, witReceiver: Object.freeze({
		revision: "2ce50a51702a6510821197c0476eb95b08a0e359"
		, entries: Object.freeze([
			"src/build/native-graph-model.mjs"
			, "src/backends/wit/owned-package.mjs"
			, "src/backends/wit/owned-host-evidence.mjs"
			, "tests/helpers/owned-rust-receiver-fixture.mjs"
			, "tests/helpers/owned-jvm-receiver-fixture.mjs"
			, "tests/helpers/owned-receiver-mutants.mjs"
			, "tests/helpers/wit-owned-borrow-probe.mjs"
			, "tests/helpers/wit-owned-borrow-mutants.mjs"
			, "tests/helpers/wit-owned-receiver-probe.mjs"
			, "tests/helpers/wit-owned-receiver-resource-probe.mjs"
		])
		, sourceReadEntries: Object.freeze([
			"tests/helpers/wit-owned-receiver-probe.mjs"
			, "tests/helpers/wit-owned-receiver-resource-probe.mjs"
		])
		, dataPaths: Object.freeze([
			"tests/fixtures/structured-types/owned-wit-borrow-moves.c"
			, "tests/fixtures/structured-types/owned-wit-borrow-only.c"
			, "tests/fixtures/structured-types/owned-public-borrows.c"
			, "tests/fixtures/structured-types/owned-receiver-parameter.c"
			, "tests/fixtures/structured-types/owned-wit-resource-receivers.c"
		])
	})
	, wasm32: Object.freeze({
		revision: "4815b87d04ba4c217a17ca33e1bdff39f2e499ee"
		, entries: Object.freeze(["src/backends/native/owned-value-adapters.mjs"])
		// The imported license data was not inventoried by the original writer.
		, supplementalSources: Object.freeze({
			"src/analyze/spdx-data.json": "20dda7478849c88845a6e15ee9998b1ccdba84687e86473353a13142c07634d5"
		})
	})
});

/**
 * Authenticate every imported module and declared deferred fixture read, with
 * explicit Git-bound supplements for files omitted from original source lists.
 *
 * @param name - Exact retained evidence family.
 * @param sources - Immutable receipt's source identities.
 */
export const ownedLifetimeProducerClosure = (name, sources) => {
	assert.ok(Object.hasOwn(ownedLifetimeProducers, name), name);
	assert.ok(sources && typeof sources === "object" && !Array.isArray(sources));
	const producer = ownedLifetimeProducers[name], paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		paths.add(path);
		const expected = Object.hasOwn(sources, path)
			? sources[path] : producer.supplementalSources?.[path];
		assert.match(expected ?? "", /^[a-f0-9]{64}$/u, path);
		const bytes = bytesAtProducer(producer.revision, path, expected);
		if(!path.endsWith(".mjs")) return;
		for(const specifier of moduleSpecifiers(bytes.toString("utf8"), path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(posix.extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const path of [...producer.entries, ...producer.dataPaths ?? []]) visit(path);
	return [...paths].sort();
};

/**
 * Replay archived producers; direct source reads require recorded hashes too.
 *
 * @param name - Exact retained evidence family.
 * @param sources - Immutable receipt's source identities.
 */
export const ownedLifetimeReplay = async (name, sources) => {
	ownedLifetimeProducerClosure(name, sources);
	const producer = ownedLifetimeProducers[name];
	const modules = await Promise.all(producer.entries.map(path => (
		producer.sourceReadEntries?.includes(path)
			? moduleAtProducerWithSourceReads : moduleAtProducer
	)(producer.revision, path)));
	return { ...Object.assign({}, ...modules), readSource: async path => {
		assert.ok(Object.hasOwn(sources, path), path);
		assert.match(sources[path] ?? "", /^[a-f0-9]{64}$/u, path);
		return bytesAtProducer(producer.revision, path, sources[path]).toString("utf8");
	} };
};
