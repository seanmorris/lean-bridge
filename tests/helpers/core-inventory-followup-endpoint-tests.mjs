/**
 * Cover remaining historical inventory callers without reading today's inventory.
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
		label: "JVM recursive"
		, file: "tests/jvm-recursive-callable-evidence.test.mjs"
		, history: "./jvm-recursive-callable-source-history.mjs"
		, reader: "beforeJvmRecursiveCallables"
		, receipt: "docs/evidence/jvm-recursive-callable-integration-20260926.json"
		, producer: "e17c1fe6e137d1a3bbdb65d9a9ec1e49dbc751be"
	}
	, {
		label: "managed close"
		, file: "tests/managed-close-evidence.test.mjs"
		, history: "./managed-close-history.mjs"
		, reader: "beforeManagedClose"
		, receipt: "docs/evidence/managed-whole-close-repair-20260930.json"
		, producer: "85e684e746df8458e48f18ce2962b4a54ea3c989"
	}
	, {
		label: "public C"
		, file: "tests/owned-c-evidence.test.mjs"
		, history: "./owned-c-source-history.mjs"
		, reader: "beforeOwnedC"
		, receipt: "docs/evidence/owned-c-integration-20260926.json"
		, producer: "ca016c0a04d9329a861d6a40cd34d95926cbcce4"
	}
	, {
		label: "C++ borrow"
		, file: "tests/owned-cpp-borrow-evidence.test.mjs"
		, history: "./owned-cpp-borrow-history.mjs"
		, reader: "beforeOwnedCppBorrow"
		, receipt: "docs/evidence/owned-cpp-borrows-20260930.json"
		, producer: "dec8d558423d1b1c2ec4b95999ea8779adb60091"
	}
	, {
		label: "C++ borrow CI"
		, file: "tests/helpers/owned-cpp-borrow-ci-evidence.mjs"
		, history: "./owned-cpp-borrow-ci-history.mjs"
		, reader: "beforeOwnedCppBorrowCi"
		, receipt: "docs/evidence/owned-cpp-borrow-ci-repair-20260930.json"
		, producer: "741a2af5e68a77996f2b478b4110d97bfc6e4c58"
	}
	, {
		label: "C++ transfer"
		, file: "tests/owned-cpp-transfer-evidence.test.mjs"
		, history: "./owned-cpp-transfer-history.mjs"
		, reader: "beforeOwnedCppTransfer"
		, receipt: "docs/evidence/owned-cpp-transfers-20260929.json"
		, producer: "5384a754d1bf356c6b6f3e587d80bb88767dbeb4"
	}
	, {
		label: "C# transfer"
		, file: "tests/owned-dotnet-transfer-evidence.test.mjs"
		, history: "./owned-dotnet-transfer-history.mjs"
		, reader: "beforeOwnedDotnetTransfer"
		, receipt: "docs/evidence/owned-dotnet-transfers-20260929.json"
		, producer: "7dd8a21aa6a245693fbd27fbadb3895b10b8d174"
	}
	, {
		label: "JVM probe"
		, file: "tests/owned-jvm-package-evidence.test.mjs"
		, history: "./jvm-probe-repair-history.mjs"
		, reader: "beforeJvmProbeRepair"
		, receipt: "docs/evidence/jvm-recursive-probe-repair-20260927.json"
		, producer: "84d157c351f20ae3a41f3926db17cc14e69a3989"
	}
	, {
		label: "JVM package"
		, file: "tests/helpers/owned-jvm-package-evidence.mjs"
		, history: "./owned-jvm-source-history.mjs"
		, reader: "beforeOwnedJvmPackages"
		, receipt: "docs/evidence/owned-jvm-integration-20260927.json"
		, producer: "578f04d09320e6998959390a3a0218ac6fd66d02"
	}
	, {
		label: "JVM receiver GC"
		, file: "tests/owned-jvm-receiver-gc-evidence.test.mjs"
		, history: "./owned-jvm-receiver-gc-history.mjs"
		, reader: "beforeOwnedJvmReceiverGc"
		, receipt: "docs/evidence/owned-jvm-receiver-gc-20261001.json"
		, producer: "a53368d1bb94f7651cdd571365e8e7a5e6212cd2"
	}
	, {
		label: "JVM callback"
		, file: "tests/owned-jvm-callback-result-history.test.mjs"
		, history: "./owned-jvm-callback-result-history.mjs"
		, reader: "beforeOwnedJvmCallbackResults"
		, receipt: "docs/evidence/owned-jvm-callback-result-source-history-20261002.json"
		, producer: "e8186d22d605f1f37c8b4190c01bbd4f610a8d41"
	}
	, {
		label: "Perl transfer"
		, file: "tests/owned-perl-transfer-evidence.test.mjs"
		, history: "./owned-perl-transfer-history.mjs"
		, reader: "beforeOwnedPerlTransfer"
		, receipt: "docs/evidence/owned-perl-transfers-20260929.json"
		, producer: "cb7ac24d2134c813561fd8369414935c962d0b43"
	}
	, {
		label: "Perl profile"
		, file: "tests/owned-perl-transfer-evidence.test.mjs"
		, history: "./owned-perl-profile-history.mjs"
		, reader: "beforeOwnedPerlProfile"
		, receipt: "docs/evidence/owned-perl-profile-repair-20260930.json"
		, producer: "29b8e25a1609031a6e8af1113a31ceb1458fe493"
	}
	, {
		label: "Perl CI"
		, file: "tests/owned-perl-transfer-evidence.test.mjs"
		, history: "./owned-perl-ci-history.mjs"
		, reader: "beforeOwnedPerlCi"
		, receipt: "docs/evidence/owned-perl-ci-repair-20260930.json"
		, producer: "7ef53b13a552c28d9ccc52b54d197d916836a26c"
	}
	, {
		label: "native PHP borrow"
		, file: "tests/owned-php-borrow-evidence.test.mjs"
		, history: "./owned-php-borrow-history.mjs"
		, reader: "beforeOwnedPhpBorrow"
		, receipt: "docs/evidence/owned-php-borrows-20261001.json"
		, producer: "3da93d67603c56529d9b4dce76f53ae60a8fdf51"
	}
	, {
		label: "native PHP package"
		, file: "tests/owned-php-package-evidence.test.mjs"
		, history: "./owned-php-source-history.mjs"
		, reader: "beforeOwnedPhpPackages"
		, receipt: "docs/evidence/owned-php-integration-20260928.json"
		, producer: "76856dbb3954bdc7592493cf8bd1269576e3770e"
	}
	, {
		label: "Python borrow"
		, file: "tests/owned-python-borrow-evidence.test.mjs"
		, history: "./owned-python-borrow-history.mjs"
		, reader: "beforeOwnedPythonBorrow"
		, receipt: "docs/evidence/owned-python-borrows-20260930.json"
		, producer: "62cadd853a10cdd366f0fe79044739f64e5c17da"
	}
	, {
		label: "Python callback"
		, file: "tests/owned-python-callback-result-history.test.mjs"
		, history: "./owned-python-callback-result-history.mjs"
		, reader: "beforeOwnedPythonCallbackResults"
		, receipt: "docs/evidence/owned-python-callback-result-source-history-20261002.json"
		, producer: "0fc33e4fd17f3347d845847f284709208ada1c9e"
	}
];

test("Core follow-up history callers name their exact recorded endpoints", async () => {
	const files = [...new Set([...cases.map(item => item.file)
		, "tests/helpers/jvm-recursive-callable-evidence.mjs"])];
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
				const wrapper = ["priorSource", "historical"
					, "beforeOwnedTransferBatchInitialization"].includes(name);
				const reader = /^before[A-Z]|HistoricalBytes$/u.test(name)
					|| name === "jvmProbeRepairBytes";
				if(reader || wrapper)
				{
					const argument = node.arguments[1];
					const target = node.arguments[0];
					const unknownPath = target && ts.isStringLiteral(target)
						&& ["unknown.mjs", "unknown.bin", "unrelated.bin"
							, "unrecorded.bin"].includes(target.text);
					const unknown = !wrapper && argument
						&& (ts.isStringLiteral(argument)
							|| ["unknown", "binary", "drift", "unrelated"]
								.includes(argument.getText(tree)));
					if(!unknownPath && !unknown)
					{
						calls++;
						if(node.arguments.length !== (wrapper ? 2 : 3))
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
	test("Core follow-up inventory endpoint: " + item.label, async () => {
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
		if(["JVM callback", "Python callback"].includes(item.label))
		{
			const expected = JSON.parse(previous);
			const updates = new Map(record.updates.map(entry => [entry.path, entry]));
			for(const evidence of expected.evidence) for(const file of evidence.files)
			{
				const change = updates.get(file.path);
				if(change)
				{
					assert.equal(file.sha256, change.previousSha256);
					file.sha256 = change.currentSha256;
				}
			}
			assert.deepEqual(JSON.parse(current), expected
				, "Staging changes only the named source pins, not support cells");
		}
	});
