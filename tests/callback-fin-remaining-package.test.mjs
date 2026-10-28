/**
 * Source-only rehearsal of callback Fin managed-host and WIT packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateCallableDotnetGraphPackage } from "../src/backends/dotnet/callable-graph-package.mjs";
import { generateCallableJvmGraphPackage } from "../src/backends/jvm/callable-graph-package.mjs";
import { generateCallablePhpGraphPackage } from "../src/backends/php/callable-graph-package.mjs";
import { compileCallableWitGraphPackageModel } from "../src/backends/wit/callable-graph-package.mjs";
import { callbackFinReviewedIr } from "./helpers/callback-fin-fixture.mjs";

test("callback Fin remaining consumers name generated public package surfaces", async () => {
	const ir = callbackFinReviewedIr();
	const dotnet = generateCallableDotnetGraphPackage(ir);
	const jvm = generateCallableJvmGraphPackage(ir);
	const php = generateCallablePhpGraphPackage(ir);
	const wit = compileCallableWitGraphPackageModel(ir, {
		name: "reviewed-callbacks", version: "1.0.0"
	});
	const apiNames = ["scaler", "counter", "visit", "digits", "tiles"
		, "tileMaker", "apply"];
	const dotnetApi = dotnet["src/LeanBridge.Reviewedcallbacks/Api.cs"];
	const javaApi = jvm["src/main/java/org/leanbridge/reviewedcallbacks/Api.java"];
	const kotlinApi = jvm[
		"src/main/kotlin/org/leanbridge/reviewedcallbacks/kotlin/Api.kt"];
	const phpApi = php["src/Api.php"];
	for(const name of apiNames)
	{
		const pascal = name[0].toUpperCase() + name.slice(1);
		assert.match(dotnetApi, new RegExp(`\\b${pascal}\\(`, "u"));
		assert.match(javaApi, new RegExp(`\\b${name}\\(`, "u"));
		assert.match(kotlinApi, new RegExp(`\`${name}\`\\(`, "u"));
		assert.match(phpApi, new RegExp(`function ${name.replace("tileMaker", "tile_maker")}\\(`, "u"));
	}
	for(const profile of ["dotnet", "java", "kotlin", "php-native"])
	{
		const extension = { dotnet: "cs", java: "java", kotlin: "kt"
			, "php-native": "php" }[profile];
		const source = await readFile(
			`tests/fixtures/callback-fin-consumers/${profile}.${extension}`, "utf8");
		assert.match(source, /callback-fin-remaining-ok/u);
	}
	const witSource = await readFile(
		"tests/fixtures/callback-fin-consumers/wit-wasi.c", "utf8");
	const calls = new Set([...witSource.matchAll(
		/\b(reviewedcallbacks_[a-z0-9_]+)\s*\(/gu)].map(match => match[1]));
	assert.ok(calls.size >= 12);
	for(const name of calls)
		if(!name.endsWith("_clear"))
			assert.ok(wit.hostHeader.includes(`${name}(`), name);
});
