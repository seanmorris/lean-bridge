/**
 * Exercise exact historic inventory endpoints without decoding today's inventory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { bytesAtProducer } from "./producer-source.mjs";
import { sha256 } from "./source-history-digest.mjs";

const cases = [
	{
		label: "C++ receiver"
		, file: "tests/owned-cpp-receiver-evidence.test.mjs"
		, history: "./owned-cpp-receiver-history.mjs"
		, reader: "beforeOwnedCppReceiver"
		, receipt: "docs/evidence/owned-cpp-receivers-20261001.json"
		, producer: "86f54487bfa6c6a2a75b9a78afbe0aae5c883f67"
	}
	, {
		label: "C# receiver"
		, file: "tests/owned-dotnet-receiver-evidence.test.mjs"
		, history: "./owned-dotnet-receiver-history.mjs"
		, reader: "beforeOwnedDotnetReceiver"
		, receipt: "docs/evidence/owned-dotnet-receivers-20261001.json"
		, producer: "58750ab55e52114fa1d48715216fc5c049f4d683"
	}
	, {
		label: "Perl receiver"
		, file: "tests/owned-perl-receiver-evidence.test.mjs"
		, history: "./owned-perl-receiver-history.mjs"
		, reader: "beforeOwnedPerlReceiver"
		, receipt: "docs/evidence/owned-perl-receivers-20261001.json"
		, producer: "ffc4b5d9c881be809a17649c545be8bbb24a0110"
	}
	, {
		label: "native PHP receiver"
		, file: "tests/owned-php-receiver-evidence.test.mjs"
		, history: "./owned-php-receiver-history.mjs"
		, reader: "beforeOwnedPhpReceiver"
		, receipt: "docs/evidence/owned-php-receivers-20261001.json"
		, producer: "16fadc8add3769e83852c51d6ad89e6dedfb6c06"
	}
	, {
		label: "PHP-Wasm receiver"
		, file: "tests/owned-php-wasm-receiver-evidence.test.mjs"
		, history: "./owned-php-wasm-receiver-history.mjs"
		, reader: "beforeOwnedPhpWasmReceiver"
		, receipt: "docs/evidence/owned-php-wasm-receivers-20261001.json"
		, producer: "a56a39a7e959067643b545800b7d5e95082beafd"
	}
	, {
		label: "PHP-Wasm transfer"
		, file: "tests/owned-php-wasm-transfer-evidence.test.mjs"
		, history: "./owned-php-wasm-transfer-history.mjs"
		, reader: "beforeOwnedPhpWasmTransfer"
		, receipt: "docs/evidence/owned-php-wasm-transfers-20260930.json"
		, producer: "10463a29b72d47b01e11cc799d97589f2ca594fe"
	}
	, {
		label: "Ruby borrow"
		, file: "tests/owned-ruby-borrow-evidence.test.mjs"
		, history: "./owned-ruby-borrow-history.mjs"
		, reader: "beforeOwnedRubyBorrow"
		, receipt: "docs/evidence/owned-ruby-borrows-20260930.json"
		, producer: "fbdcc20287f8491dbe6435be003a08733fa717c4"
	}
	, {
		label: "Ruby transfer"
		, file: "tests/owned-ruby-transfer-evidence.test.mjs"
		, history: "./owned-ruby-transfer-history.mjs"
		, reader: "beforeOwnedRubyTransfer"
		, receipt: "docs/evidence/owned-ruby-transfers-20260929.json"
		, producer: "ea7759886937d82bc6c8c2c90f867b99e8ea10e0"
	}
	, {
		label: "WIT build repair"
		, file: "tests/wit-owned-build-repair-evidence.test.mjs"
		, history: "./wit-owned-build-repair-history.mjs"
		, reader: "beforeOwnedWitBuildRepair"
		, receipt: "docs/evidence/wit-owned-build-repair-20260929.json"
		, producer: "5ffbcd067e83927ac45f97b550330c07bd0c0e1f"
	}
	, {
		label: "JVM thread exit"
		, file: "tests/jvm-thread-exit-repair-evidence.test.mjs"
		, history: "./jvm-thread-exit-repair-history.mjs"
		, reader: "beforeJvmThreadExitRepair"
		, receipt: "docs/evidence/jvm-thread-exit-repair-20260928.json"
		, producer: "ff05f25488e70838b8bfa0088b10517a60f79035"
	}
	, {
		label: "npm engine"
		, file: "tests/owned-javascript-engine-evidence.test.mjs"
		, history: "./owned-javascript-engine-history.mjs"
		, reader: "beforeOwnedJavaScriptEngine"
		, receipt: "docs/evidence/owned-javascript-engine-integration-20260928.json"
		, producer: "471a4dc971303143025d60aa988397313d549bdb"
	}
	, {
		label: "JVM borrow"
		, file: "tests/owned-jvm-borrow-evidence.test.mjs"
		, history: "./owned-jvm-borrow-history.mjs"
		, reader: "beforeOwnedJvmBorrow"
		, receipt: "docs/evidence/owned-jvm-borrows-20260930.json"
		, producer: "f5cde9256639f3989464822f8cf711015d518b31"
	}
	, {
		label: "JVM receiver"
		, file: "tests/owned-jvm-receiver-evidence.test.mjs"
		, history: "./owned-jvm-receiver-history.mjs"
		, reader: "beforeOwnedJvmReceiver"
		, receipt: "docs/evidence/owned-jvm-receivers-20261001.json"
		, producer: "2e9e748fc0354bfa309c2283de66ff8a917df349"
	}
	, {
		label: "Python receiver"
		, file: "tests/owned-python-receiver-evidence.test.mjs"
		, history: "./owned-python-receiver-history.mjs"
		, reader: "beforeOwnedPythonReceiver"
		, receipt: "docs/evidence/owned-python-receivers-20261001.json"
		, producer: "5271f6b8c74d3e4295e6607cd13bd1271204a63e"
	}
	, {
		label: "managed CI"
		, file: "tests/managed-ci-isolation-evidence.test.mjs"
		, history: "./managed-ci-isolation-history.mjs"
		, reader: "beforeManagedCiIsolation"
		, receipt: "docs/evidence/managed-ci-isolation-20260927.json"
		, producer: "4ae2450fd9dfd164486970993d0923e667c18bbf"
	}
	, {
		label: "C++ ownership"
		, file: "tests/owned-cpp-evidence.test.mjs"
		, history: "./owned-cpp-source-history.mjs"
		, reader: "beforeOwnedCpp"
		, receipt: "docs/evidence/owned-cpp-integration-20260927.json"
		, producer: "511f43f1b02a6bddb5517f47a497e8eda766a065"
	}
	, {
		label: "C++ inventory order"
		, file: "tests/owned-cpp-evidence.test.mjs"
		, history: "./owned-cpp-order-history.mjs"
		, reader: "beforeOwnedCppOrder"
		, receipt: "docs/evidence/owned-cpp-inventory-order-20260927.json"
		, producer: "16e4ef6994b2594bf87e0b2805a85b437c53f091"
	}
	, {
		label: "PHP-Wasm structured"
		, file: "tests/helpers/php-wasm-structured-callable-evidence.mjs"
		, history: "./php-wasm-structured-callable-source-history.mjs"
		, reader: "beforePhpWasmStructuredCallables"
		, receipt: "docs/evidence/php-wasm-structured-callable-integration-20260925.json"
		, producer: "7294b0cc57153e53e118789ed83a300d43236f18"
	}
];

test("Core history callers request explicit endpoints for recorded sources", async () => {
	const files = [...new Set([...cases.map(item => item.file)
		, "tests/helpers/owned-cpp-evidence.mjs"
		, "tests/helpers/owned-cpp-order-history.mjs"])];
	const violations = [];
	let calls = 0;
	for(const path of files)
	{
		const source = await readFile(path, "utf8");
		const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest
			, true, ts.ScriptKind.JS);
		const visit = node => {
			if(ts.isCallExpression(node) && ts.isIdentifier(node.expression))
			{
				const name = node.expression.text;
				if(/^before[A-Z]|HistoricalBytes$/u.test(name) || name === "priorSource")
				{
					const argument = node.arguments[1];
					const unknown = argument && (ts.isStringLiteral(argument)
						|| ["unknown", "binary"].includes(argument.getText(tree)));
					if(!unknown)
					{
						calls++;
						const required = name === "priorSource" ? 2 : 3;
						if(node.arguments.length !== required)
							violations.push(path + ": " + node.getText(tree));
					}
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(tree);
	}
	assert.ok(calls > 100, "Inspect the complete selected caller set");
	assert.deepEqual(violations, []);
});

for(const item of cases)
	test("Core inventory endpoint: " + item.label, async () => {
		const bytes = await readFile(item.receipt);
		assert.deepEqual(bytesAtProducer(item.producer, item.receipt), bytes
			, "The original receipt must remain unchanged");
		const record = JSON.parse(bytes);
		const path = "docs/type-surface.v1.json";
		const update = record.updates.find(entry => entry.path === path);
		assert.ok(update);
		const current = bytesAtProducer(item.producer, path
			, update.currentSha256).toString("utf8");
		const reader = (await import(item.history))[item.reader];
		assert.equal(typeof reader, "function");
		assert.equal(reader(path, current, update.currentSha256), current);
		const previous = reader(path, current, update.previousSha256);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(reader(path, previous, update.previousSha256), previous);
		assert.equal(reader(path, "unrecorded bytes", update.previousSha256)
			, "unrecorded bytes");
	});
