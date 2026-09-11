/**
 * Prepare a stricter deployment floor from already-built CPAN payloads.
 * This acceptance helper does not invoke compilers or alter the input release.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { archiveCpanPackage } from "../src/release/cpan-package.mjs";

const flags = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const flag = process.argv[index], value = process.argv[index + 1];
	assert.ok(["--release", "--output", "--glibc-minimum"].includes(flag) && value && !flags.has(flag), "Use --release DIRECTORY --output NEW_DIRECTORY --glibc-minimum VERSION");
	flags.set(flag, value);
}
assert.equal(flags.size, 3, "All three arguments are required");
const release = resolve(flags.get("--release")), output = resolve(flags.get("--output"));
const floor = flags.get("--glibc-minimum");
assert.match(floor, /^2\.\d+$/);
assert.ok(output !== release && !output.startsWith(`${release}/`) && !release.startsWith(`${output}/`));
const receipt = JSON.parse(await readFile(join(release, "native-release.json"), "utf8"));
assert.equal(receipt.ecosystem, "cpan");
assert.ok(Number(floor.split(".")[1]) >= Number(receipt.glibcMinimumVersion.split(".")[1]), "Do not lower a compiled package's platform floor");
await mkdir(output);
const packages = [];
for(const name of ["runtime", "component"])
{
	const source = join(release, "packages", name), destination = join(output, "packages", name);
	const manifest = JSON.parse(await readFile(join(source, "lean-bridge-package.json"), "utf8"));
	assert.equal(manifest.glibcMinimumVersion, receipt.glibcMinimumVersion);
	await cp(source, destination, { recursive: true });
	manifest.glibcMinimumVersion = floor;
	if(name === "runtime")
	{
		const targetPath = "lib/LeanBridge/Runtime/target.json";
		assert.equal(sha256(await readFile(join(destination, targetPath))), manifest.files[targetPath]);
		const target = canonicalJson({ glibcMinimumVersion: floor });
		await writeFile(join(destination, targetPath), target);
		manifest.files[targetPath] = sha256(target);
	}
	// Preserve every other recorded file hash. Archive assembly rejects any drift.
	await writeFile(join(destination, "lean-bridge-package.json"), canonicalJson(manifest));
	const archive = await archiveCpanPackage({ packageRoot: destination, outputRoot: join(output, "archives") });
	packages.push(archive.receipt);
}
const result = { ...receipt, glibcMinimumVersion: floor, packages };
await writeFile(join(output, "native-release.json"), canonicalJson(result));
process.stdout.write(canonicalJson(result));
