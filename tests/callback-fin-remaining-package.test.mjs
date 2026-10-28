/**
 * Source-only rehearsal of callback Fin managed-host and WIT packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { generateCopiedJvmKotlinPackage } from "../src/backends/jvm/copied-kotlin.mjs";
import { generateCopiedPhpPackage } from "../src/backends/php/copied-values.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { renderWitHostHeader } from "../src/backends/wit/copied-host.mjs";
import { callbackFinReviewedIr } from "./helpers/callback-fin-fixture.mjs";

test("callback Fin remaining consumers name generated public package surfaces", async () => {
	const ir = callbackFinReviewedIr();
	const dotnet = generateCopiedDotnetPackage(ir);
	const jvm = generateCopiedJvmKotlinPackage(ir);
	const php = generateCopiedPhpPackage(ir);
	const wit = compileCopiedWitModel(ir, {
		name: "reviewed-callbacks", version: "1.0.0"
	}, { callables: true });
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
		if(["dotnet", "java", "kotlin"].includes(profile))
			for(const diagnostic of ["arg0 is not below its Fin 10 bound"
				, "arg0[0] is not below its Fin 3 bound"
				, "arg0[0].digit is not below its Fin 5 bound"])
				assert.ok(source.includes(diagnostic), `${profile}: ${diagnostic}`);
	}
	const witSource = await readFile(
		"tests/fixtures/callback-fin-consumers/wit-wasi.c", "utf8");
	const header = renderWitHostHeader(wit);
	const calls = new Set([...witSource.matchAll(
		/\b(reviewedcallbacks_[a-z0-9_]+)\s*\(/gu)].map(match => match[1]));
	assert.ok(calls.size >= 5);
	for(const name of calls)
		assert.ok(header.includes(`${name}(`), name);
	assert.equal(wit.resources.length, 7);
	assert.equal(new Set(wit.resources.map(resource => resource.witName)).size, 7);
	for(const resource of wit.resources)
	{
		assert.match(resource.witName, /^function-/u);
		assert.match(wit.wit, new RegExp(`resource ${resource.witName};`, "u"));
	}
	for(const id of ["bridge:Callback1469b3ae2047ff62e64f"
		, "bridge:Callbacka1b5e4d2cfa3d3e80004"
		, "bridge:Callback0b35b98375ec45f097a4"
		, "bridge:Callbackf2af9db3bda87ab235db"])
		assert.match(witSource, new RegExp(
			wit.resources.find(resource => resource.type.id === id).witName, "u"));
	assert.doesNotMatch(witSource, /WithRecovery|with_recovery/u);
});
