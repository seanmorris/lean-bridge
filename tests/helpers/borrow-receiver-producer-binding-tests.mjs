/**
 * Check source identities and exact Ruby profile endpoints without regeneration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { beforeOwnedDotnetBorrow } from "./owned-dotnet-borrow-history.mjs";
import {
	ownedRubyBorrowCiPath, reverseOwnedRubyBorrowCiUpdate
} from "./owned-ruby-borrow-ci-history.mjs";
import { bytesAtProducer, sourceAtProducer } from "./producer-source.mjs";
import { sha256 } from "./source-history-digest.mjs";

const rubyProfileProducer = "1211baf52e92dd4012d075948ca6bf95bda81282";
const exportedNames = source => {
	const file = ts.createSourceFile("producer.mjs", source
		, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
	const names = new Set();
	for(const statement of file.statements)
	{
		if(ts.isExportDeclaration(statement) && statement.exportClause
			&& ts.isNamedExports(statement.exportClause))
			for(const item of statement.exportClause.elements) names.add(item.name.text);
		if(!ts.canHaveModifiers(statement)
			|| !ts.getModifiers(statement)?.some(item => item.kind === ts.SyntaxKind.ExportKeyword)) continue;
		if(ts.isVariableStatement(statement))
			for(const item of statement.declarationList.declarations)
				if(ts.isIdentifier(item.name)) names.add(item.name.text);
		if(ts.isFunctionDeclaration(statement) && statement.name) names.add(statement.name.text);
	}
	return names;
};
const phpBorrowModules = {
	"src/backends/native/owned-value-adapters.mjs": ["generateOwnedNativeValueAdapters"]
	, "src/backends/native/owned-aggregate-transfers.mjs": ["ownedAggregateTransferRuntime"]
	, "src/backends/native/owned-aggregate-leases.mjs": ["ownedAggregateLeaseRuntime"]
	, "src/backends/php/owned-zend-extension.mjs": ["generateOwnedPhpZendExtension"]
	, "src/backends/php/owned-zend-php.mjs": ["generateOwnedPhpZendPhp"]
	, "src/backends/php/owned-zend-model.mjs": ["compileOwnedPhpZendModel"]
	, "src/backends/php/brick-math.mjs": ["bundledBrickMath"]
	, "src/build/native-allocation-guard.mjs": ["nativeAllocationGuardHeader"]
	, "src/build/php-wasm-graph-model.mjs": ["createCompiledPhpWasmModel", "generateCompiledPhpWasmLeanAdapters"]
	, "src/build/php-wasm-owned-component.mjs": ["generateCompiledPhpWasmOwned"]
	, "src/build/php-wasm-copied-artifacts.mjs": ["phpWasmCopiedPins"]
	, "src/release/package-set-receipt.mjs": ["validatePackageSetReceipt"]
	, "tests/helpers/owned-php-wasm-transfer-probe.mjs": ["ownedPhpWasmTransferProbe"]
};
const rubyBorrowModules = {
	"src/backends/c/owned-package.mjs": ["generateOwnedCPackage"]
	, "src/backends/ruby/owned-conversions.mjs": ["generateOwnedRubyConversions"]
	, "src/backends/ruby/owned-package.mjs": ["generateOwnedRubyPackage"]
	, "src/backends/ruby/owned-runtime.mjs": ["ownedRubyRuntime"]
	, "src/build/native-graph-model.mjs": ["createCompiledNativeModel", "generateCompiledNativeLeanAdapters"]
	, "src/build/owned-ruby-artifacts.mjs": ["ownedRubyAdapterSources"]
	, "src/release/package-set-receipt.mjs": ["validatePackageSetReceipt"]
	, "tests/helpers/owned-rust-borrow-fixture.mjs": ["ownedRustBorrowNativeSource"]
};
const producers = [
	{
		name: "PHP-Wasm borrow", producer: "49555c6612107ef8e6a3f8f7576312a5c32da894"
		, receipt: "owned-php-wasm-borrows-20261001", modules: phpBorrowModules
		, helper: "owned-php-wasm-borrow-evidence"
		, constant: "ownedPhpWasmBorrowProducer"
	}
	, {
		name: "PHP-Wasm receiver"
		, producer: "a56a39a7e959067643b545800b7d5e95082beafd"
		, receipt: "owned-php-wasm-receivers-20261001"
		, modules: { ...phpBorrowModules
			, "tests/helpers/owned-php-receiver-fixture.mjs": [
				"ownedPhpInstalledReceiverProbe", "ownedPhpPlainInstalledReceiverProbe"
				, "ownedPhpUnanchoredReceiverProbe"
			]
			, "tests/helpers/owned-php-wasm-packages.mjs": ["ownedPhpWasmInstalledHost"]
		}
		, helper: "owned-php-wasm-receiver-evidence"
		, constant: "ownedPhpWasmReceiverProducer"
	}
	, {
		name: "Ruby borrow", producer: "fbdcc20287f8491dbe6435be003a08733fa717c4"
		, receipt: "owned-ruby-borrows-20260930", modules: rubyBorrowModules
		, helper: "owned-ruby-borrow-evidence", constant: "ownedRubyBorrowProducer"
	}
	, {
		name: "Ruby managed close"
		, producer: "85e684e746df8458e48f18ce2962b4a54ea3c989"
		, receipt: "managed-whole-close-repair-20260930", modules: rubyBorrowModules
		, helper: "owned-ruby-borrow-evidence", constant: "ownedRubyCloseProducer"
	}
];

for(const { name, producer, receipt, modules, helper, constant } of producers)
	test(`${name} source bindings preserve its own producer and frozen receipt`, async () => {
		execFileSync("git", ["merge-base", "--is-ancestor", producer, "HEAD"]);
		const path = `docs/evidence/${receipt}.json`;
		const bytes = await readFile(path);
		assert.equal(sha256(bytes), sha256(bytesAtProducer(producer, path)), path);
		const record = JSON.parse(bytes);
		const source = await readFile(`tests/helpers/${helper}.mjs`, "utf8");
		assert.ok(source.includes(`export const ${constant} = "${producer}";`));
		for(const [entry, exports] of Object.entries(modules))
		{
			assert.match(record.sources[entry], /^[a-f0-9]{64}$/u, entry);
			const original = sourceAtProducer(producer, entry, record.sources[entry]);
			const names = exportedNames(original);
			for(const name of exports)
				assert.ok(names.has(name), `${entry}:${name}`);
		}
	});

test("shared PHP-Wasm and Ruby receipt delegates retain explicit producer selection", async () => {
	const receiver = await readFile("tests/helpers/owned-php-wasm-receiver-evidence.mjs", "utf8");
	for(const call of [
		"await assertOwnedPhpWasmBorrowRuntime(item, true, ownedPhpWasmReceiverProducer);"
		, "await assertOwnedPhpWasmBorrowFibers(record.nativeFibers, true, ownedPhpWasmReceiverProducer);"
		, "await assertOwnedPhpWasmBorrowPackages(record.packages, lean + ownedRustReceiverSource, true, ownedPhpWasmReceiverProducer);"
		, "await assertOwnedPhpWasmReceiverResource(item, lean, record.resourcePackages.includes(item));"
	]) assert.ok(receiver.includes(call), call);
	const managed = await readFile("tests/helpers/managed-close-evidence.mjs", "utf8");
	assert.ok(managed.includes("await assertOwnedRubyBorrowExecution(record.ruby, ownedRubyCloseProducer);"));
	const ruby = await readFile("tests/helpers/owned-ruby-borrow-evidence.mjs", "utf8");
	assert.ok(ruby.includes("assert.equal(producer, repaired ? ownedRubyCloseProducer : ownedRubyBorrowProducer);"));
	const borrow = await readFile("tests/helpers/owned-php-wasm-borrow-evidence.mjs", "utf8");
	assert.equal([...borrow.matchAll(/producer = ownedPhpWasmBorrowProducer/gu)].length, 3);
	assert.ok(borrow.includes("const receiver = receiverExports ? Object.assign({}, ...await Promise.all(["));
	assert.ok(borrow.includes("receiver.ownedPhpInstalledReceiverProbe()"));
	assert.ok(borrow.includes("receiver.ownedPhpWasmInstalledHost("));
});

test("Ruby borrow profile reversals name their authenticated current endpoints", async () => {
	const bytes = await readFile(ownedRubyBorrowCiPath);
	assert.equal(sha256(bytes), sha256(bytesAtProducer(
		rubyProfileProducer, ownedRubyBorrowCiPath
	)));
	const record = JSON.parse(bytes);
	assert.equal(record.updates.length, 5);
	for(const update of record.updates)
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
	const source = await readFile("tests/owned-ruby-borrow-evidence.test.mjs", "utf8");
	const calls = [...source.matchAll(/beforeOwnedDotnetBorrow\([^\n;]+/gu)]
		.map(match => match[0]);
	assert.equal(calls.length, 4);
	for(const call of calls)
		assert.match(call, /, (?:update\.currentSha256|record\.sources\[(?:path|indexPath)\])\)/u);
});

test("Ruby borrow exact stops retain the small original sources and reject altered spans", async () => {
	const record = JSON.parse(await readFile(ownedRubyBorrowCiPath, "utf8"));
	const updates = record.updates.filter(update => update.path !== "docs/type-surface.v1.json");
	assert.equal(updates.length, 4);
	for(const update of updates)
	{
		const source = sourceAtProducer(rubyProfileProducer, update.path, update.currentSha256);
		// An already authenticated endpoint must not traverse the later history.
		assert.equal(beforeOwnedDotnetBorrow(update.path, source, update.currentSha256), source);
		assert.equal(reverseOwnedRubyBorrowCiUpdate(source, update)
			, sourceAtProducer(record.baselineRevision, update.path, update.previousSha256));
		assert.throws(() => reverseOwnedRubyBorrowCiUpdate(source + "\nunknown", update));
		assert.throws(() => reverseOwnedRubyBorrowCiUpdate(source
			, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedRubyBorrowCiUpdate(source
			, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});
