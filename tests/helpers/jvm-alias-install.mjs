/**
 * Inspect named alias contracts in the exact prepared JAR installed downstream.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeAliasReviewedIr } from "./native-alias-fixture.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

const targets = {
	AUnit: ["Unit", "Unit"], ABool: ["boolean", "Boolean"]
	, AU8: ["int", "Int"], AU16: ["int", "Int"]
	, AU32: ["long", "Long"]
	, AU64: ["java.math.BigInteger", "java.math.BigInteger"]
	, AI8: ["byte", "Byte"], AI16: ["short", "Short"], AI32: ["int", "Int"]
	, AI64: ["long", "Long"]
	, ANat: ["java.math.BigInteger", "java.math.BigInteger"]
	, AInt: ["java.math.BigInteger", "java.math.BigInteger"]
	, AF32: ["float", "Float"], AF64: ["double", "Double"]
	, AText: ["String", "String"], ABytes: ["byte[]", "ByteArray"]
	, AChar: ["int", "Int"]
	, AWord: ["java.math.BigInteger", "java.math.BigInteger"]
	, ASignedWord: ["long", "Long"]
	, ScalarsView: ["Scalars", "Scalars"]
	, Count: ["long", "Long"], OtherCount: ["long", "Long"]
	, Rows: ["long[][]", "Array<LongArray>"]
	, Maybe: ["Option<Option<Unit>>", "Option<Option<Unit>>"]
	, Outcome: ["Result<Pair<Long, byte[]>, String>", "Result<Pair<Long, ByteArray>, String>"]
	, PacketView: ["Packet", "Packet"], Packets: ["Packet[]", "Array<Packet>"]
};

/**
 * Verify every alias target and packaged source documentation against an independent catalog.
 *
 * @param options - Exact prepared package.
 * @param options.jar - Absolute archive path.
 * @param options.consumer - Private working directory.
 */
export const checkJvmAliasPackage = async ({ jar, consumer }) => {
	const contents = async path => (await runCopied("/usr/bin/unzip", ["-p", jar, path], consumer)).stdout;
	const receipt = JSON.parse(await contents("META-INF/lean-bridge/package-receipt.json")), prefix = "META-INF/lean-bridge/jvm/";
	const paths = ["binding-manifest.json", "README.md", ...["Api", "Scalars", "Packet"].map(name => `src/main/java/org/leanbridge/aliases/${name}.java`)];
	const files = Object.fromEntries(await Promise.all(paths.map(async path => {
		const archivePath = path === "README.md" ? path : `${prefix}${path}`;
		const content = await contents(archivePath); assert.equal(sha256(content), receipt.files[archivePath].sha256);
		return [path, content];
	})));
	const aliases = JSON.parse(files["binding-manifest.json"]).aliases;
	const sort = list => [...list].sort((a, b) => a.id.localeCompare(b.id));
	assert.deepEqual(sort(aliases), sort(nativeAliasReviewedIr().types.filter(type => type.kind === "alias").map(({ id, name, target }) => ({
		id, name, target, javaType: targets[name][0], kotlinType: targets[name][1]
	}))));
	for(const alias of aliases)
	{
		assert.ok(files["src/main/java/org/leanbridge/aliases/Api.java"].includes(`<code>${alias.name}</code>`));
		assert.ok(files["README.md"].includes(`| \`${alias.name}\` |`));
	}
	for(const [name, pattern] of [["Api", /@param arg0 Contract type: <code>Count<\/code>/], ["Scalars", /@param vNat Contract type: <code>ANat<\/code>/], ["Packet", /@param rows Contract type: <code>Rows<\/code>/]])
		assert.match(files[`src/main/java/org/leanbridge/aliases/${name}.java`], pattern);
	return { aliases: sort(aliases)
		, files: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]))
		, transparentTargetTypes: true, installedSourceDocumentation: true
		, originalAliasChains: true };
};
