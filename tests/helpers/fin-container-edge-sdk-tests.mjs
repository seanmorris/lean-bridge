/**
 * Reproduce hosted multi-SDK selection and retain exact SDK and package guards.
 * Synthetic listings test selection, not installed Fin acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, chmod, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { installFinContainerEdgeDotnet, selectFinContainerEdgeDotnetSdk } from "./fin-container-edge-dotnet-closure.mjs";
import { finContainerEdgeDotnetFixture } from "./fin-container-edge-dotnet-closure-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import "./fin-dotnet-sdk-history-tests.mjs";

test("native edge .NET selection accepts multiple SDKs and pins the newest stable 8.0 version", () => {
	const directory = "/trusted dotnet/sdk";
	const versions = ["8.0.100", "8.0.204", "8.0.303", "8.0.416", "8.0.424"];
	const listing = values => values.map(version => `${version} [${directory}]`).join("\n") + "\n";
	// The old installer fails here with 5 !== 1, before any edge consumer executes.
	assert.equal([...listing(versions).matchAll(/^(8\.0\.[0-9]+) \[([^\r\n]+)\]$/gmu)].length, 5);
	for(const order of [versions, versions.toReversed(), [...versions.slice(2), ...versions.slice(0, 2)]])
		for(const newline of ["\n", "\r\n"])
		{
			const output = listing([...order, "9.0.300", "8.0.500-preview.1", "10.0.100"]).replaceAll("\n", newline);
			assert.deepEqual(selectFinContainerEdgeDotnetSdk(output, directory), { version: "8.0.424", directory });
		}
	assert.equal(selectFinContainerEdgeDotnetSdk(listing(["8.0.424"]), directory).version, "8.0.424");
	assert.equal(selectFinContainerEdgeDotnetSdk(listing(["8.0.99", "8.0.100"]), directory).version, "8.0.100");
	assert.throws(() => { selectFinContainerEdgeDotnetSdk(listing(versions), directory).version = "8.0.100"; });
});

test("native edge .NET selection refuses missing, ambiguous and foreign SDKs", () => {
	const directory = "/trusted/sdk";
	for(const output of ["", "9.0.100 [/trusted/sdk]\n", "8.0.500-preview.1 [/trusted/sdk]\n", "8.0.0424 [/trusted/sdk]\n"])
		assert.throws(() => selectFinContainerEdgeDotnetSdk(output, directory), /stable .NET 8 SDK is required/u);
	assert.throws(() => selectFinContainerEdgeDotnetSdk("8.0.424 [/trusted/sdk]\n8.0.424 [/trusted/sdk]\n", directory), /ambiguous/u);
	for(const output of ["8.0.424 [/foreign/sdk]\n", "8.0.100 [/foreign/sdk]\n8.0.424 [/trusted/sdk]\n"])
		assert.throws(() => selectFinContainerEdgeDotnetSdk(output, directory), /selected host/u);
	assert.throws(() => selectFinContainerEdgeDotnetSdk("8.0.99999999999999999 [/trusted/sdk]\n", directory), /invalid .NET 8 SDK version/u);
});

test("native edge .NET installer refuses a host ignoring global.json before restore", { skip: process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST !== "1" }, async t => {
	const fixture = await finContainerEdgeDotnetFixture(t), root = join(fixture.root, "consumer");
	const host = join(fixture.root, "fake-host/dotnet"), sdk = join(fixture.root, "fake-host/sdk");
	const marker = join(fixture.root, "restore-started");
	await mkdir(sdk, { recursive: true });
	await saveLakeFile(root, "consumer.cs", "System.Console.WriteLine(1);\n");
	await saveLakeFile(fixture.root, "fake-host/dotnet", `#!/usr/bin/node\nconst fs = require("node:fs");
if(process.argv[2] === "--list-sdks") process.stdout.write(${JSON.stringify(`8.0.100 [${sdk}]\n8.0.424 [${sdk}]\n`)});
else if(process.argv[2] === "--version") process.stdout.write("8.0.100\\n");
else { fs.writeFileSync(${JSON.stringify(marker)}, "unexpected command"); process.exit(1); }\n`);
	await chmod(host, 0o755);
	const { handoff, packages } = await fixture.pack("sdk-mismatch"), archive = packages[0].artifacts[0];
	await assert.rejects(installFinContainerEdgeDotnet({ root, archive: join(handoff, archive.path), archiveSha256: archive.sha256, command: host }), /host must use the pinned SDK/u);
	assert.deepEqual(JSON.parse(await readFile(join(root, "global.json"))), { sdk: { version: "8.0.424", rollForward: "disable", allowPrerelease: false } });
	await assert.rejects(access(marker), { code: "ENOENT" });
	await assert.rejects(access(join(root, "obj")), { code: "ENOENT" });
});
