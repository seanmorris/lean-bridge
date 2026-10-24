/**
 * Authenticate the exact producers of retained transfer and borrow receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import { moduleAtProducer, moduleAtProducerWithSourceReads } from "./producer-module.mjs";
import { bytesAtProducer } from "./producer-source.mjs";

export const ownedTransferBorrowProducers = Object.freeze({
	cpp: Object.freeze({
		revision: "5384a754d1bf356c6b6f3e587d80bb88767dbeb4"
		, entries: Object.freeze([
			"src/backends/c/owned-package.mjs"
			, "src/backends/cpp/owned-package.mjs"
			, "src/build/native-graph-model.mjs"
			, "src/release/package-set-receipt.mjs"
		])
		// The original source list omitted this imported payload. Bind it
		// explicitly to the producer's Git blob without rewriting that receipt.
		, supplementalSources: Object.freeze({
			"src/backends/cpp/boost.source.json": "2e5ded51d6fa32f4d06d22eaf0bb10f54bdbfcf17731bea4f1554923a09ce10c"
		})
	})
	, dotnet: Object.freeze({
		revision: "7dd8a21aa6a245693fbd27fbadb3895b10b8d174"
		, entries: Object.freeze([
			"src/backends/c/owned-package.mjs"
			, "src/backends/dotnet/owned-calls.mjs"
			, "src/backends/dotnet/owned-package.mjs"
			, "src/build/native-graph-model.mjs"
			, "src/build/owned-dotnet-artifacts.mjs"
			, "src/release/package-set-receipt.mjs"
		])
	})
	, wit: Object.freeze({
		revision: "1e6f7f5f5f916461dae4a567916db3dc6d4cfa6d"
		, entries: Object.freeze([
			"src/backends/wit/owned-package.mjs"
			, "src/backends/wit/owned-host-evidence.mjs"
			, "tests/helpers/wit-owned-borrow-probe.mjs"
		])
		, sourceReadEntry: "tests/helpers/wit-owned-borrow-probe.mjs"
		, dataPaths: Object.freeze([
			"tests/fixtures/structured-types/owned-wit-borrow-moves.c"
			, "tests/fixtures/structured-types/owned-wit-borrow-only.c"
			, "tests/fixtures/structured-types/owned-public-borrows.c"
		])
	})
});

/**
 * Bind the full relative import closure and deferred probe inputs to a receipt,
 * with one explicit producer-bound payload missing from the original C++ list.
 *
 * @param name - Retained receipt family: cpp, dotnet or wit.
 * @param sources - Original receipt source identities by repository-relative path.
 */
export const ownedTransferBorrowProducerClosure = (name, sources) => {
	assert.ok(Object.hasOwn(ownedTransferBorrowProducers, name), name);
	assert.ok(sources && typeof sources === "object" && !Array.isArray(sources));
	const producer = ownedTransferBorrowProducers[name];
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		paths.add(path);
		const expected = sources[path] ?? producer.supplementalSources?.[path];
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
 * Load receipt-bound generators without changing current generators or fixtures.
 *
 * @param name - Retained receipt family: cpp, dotnet or wit.
 * @param sources - Original receipt source identities by repository-relative path.
 */
export const ownedTransferBorrowReplay = async (name, sources) => {
	ownedTransferBorrowProducerClosure(name, sources);
	const producer = ownedTransferBorrowProducers[name];
	const modules = await Promise.all(producer.entries.map(path => (
		path === producer.sourceReadEntry ? moduleAtProducerWithSourceReads : moduleAtProducer
	)(producer.revision, path)));
	return Object.assign({}, ...modules);
};
