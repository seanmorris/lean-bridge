/**
 * Executes publication shell snippets with recording clients, never registry clients.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execute = promisify(execFile);
const repository = resolve(import.meta.dirname, "..");
const recipe = async (page, command) => {
	const source = await readFile(join(repository, "docs/publish", `${page}.md`), "utf8");
	const matches = [...source.matchAll(/```sh\n([\s\S]*?)\n```/g)]
		.map(match => match[1]).filter(block => block.includes(command));
	assert.equal(matches.length, 1, `${page}: expected one block containing ${command}`);
	return matches[0];
};

// This recorder has no network code. PATH contains only recorders and explicitly
// allowed filesystem tools; an added registry command cannot reach a real client.
const recorder = `#!${process.execPath}
import { appendFileSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
const command = basename(process.argv[1]);
const args = process.argv.slice(2);
appendFileSync(process.env.RECIPE_LOG, JSON.stringify({ command, args }) + "\\n");
if(process.env.RECIPE_FAIL) process.exit(19);
if(command === "cargo" && args[0] === "generate-lockfile") writeFileSync("Cargo.lock", "generated fixture lock\\n");
if(command === "cargo" && (args[0] === "package" || args.includes("--dry-run"))) {
  mkdirSync("target/package", { recursive: true });
  writeFileSync("target/package/" + process.env.LEAN_BRIDGE_CARGO_NAME + "-" + process.env.LEAN_BRIDGE_CARGO_VERSION + ".crate", "reviewed Cargo repack fixture\\n");
}
if(command === "gh" && args[0] === "release" && args[1] === "download") {
  const destination = args[args.indexOf("--dir") + 1];
  const files = JSON.parse(process.env.RECIPE_ARCHIVES);
  for(const file of files) {
    if(!args.includes(basename(file))) throw Error("Download must request the prepared filename");
    copyFileSync(file, join(destination, basename(file)));
    if(process.env.RECIPE_CORRUPT && file === files[0]) writeFileSync(join(destination, basename(file)), "changed bytes");
  }
}
`;

const sandbox = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-recipe-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const cwd = join(root, "release workspace # &");
	const bin = join(root, "bin");
	await mkdir(cwd);
	await mkdir(join(cwd, "tmp"));
	await mkdir(bin);
	const log = join(root, "calls.jsonl");
	await writeFile(log, "");
	for(const name of ["npm", "cargo", "dotnet", "mvn", "gem", "gh"])
		await writeFile(join(bin, name), recorder, { mode: 0o755 });
	await mkdir(join(cwd, ".publish-venv/bin"), { recursive: true });
	await writeFile(join(cwd, ".publish-venv/bin/python"), recorder, { mode: 0o755 });
	for(const name of ["mkdir", "tar", "gzip", "mv", "cp", "sha256sum", "basename", "mktemp", "cmp"])
		await symlink(`/usr/bin/${name}`, join(bin, name));
	const env = { PATH: bin, RECIPE_LOG: log, TMPDIR: join(cwd, "tmp"), BASH_ENV: "/dev/null", ENV: "/dev/null" };
	const run = (script, variables = {}) => execute("/bin/bash", ["-euo", "pipefail", "-c", script], {
		cwd, env: { ...env, ...variables }, timeout: 10_000
	});
	const calls = async () => (await readFile(log, "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
	return { root, cwd, run, calls };
};

const uploads = [
	{
		page: "npm"
		, select: 'npm publish "$LEAN_BRIDGE_NPM_ARCHIVE" --ignore-scripts \\\n  --registry "$LEAN_BRIDGE_NPM_REGISTRY" --tag sandbox'
		, command: "npm"
		, variables: { LEAN_BRIDGE_NPM_REGISTRY: "https://registry.example.invalid/team/" }
		, files: { LEAN_BRIDGE_NPM_ARCHIVE: ".tgz" }
		, args: v => ["publish", v.LEAN_BRIDGE_NPM_ARCHIVE, "--ignore-scripts", "--registry", v.LEAN_BRIDGE_NPM_REGISTRY, "--tag", "sandbox"]
	}
	, {
		page: "pypi"
		, select: "--repository-url https://test.pypi.org/legacy/ --non-interactive"
		, command: "python", variables: {}, files: { LEAN_BRIDGE_PYPI_WHEEL: ".whl" }
		, args: v => ["-m", "twine", "upload", "--repository-url", "https://test.pypi.org/legacy/", "--non-interactive", v.LEAN_BRIDGE_PYPI_WHEEL]
	}
	, {
		page: "nuget", select: 'dotnet nuget push "$LEAN_BRIDGE_NUGET_ARCHIVE"'
		, command: "dotnet"
		, variables: {
			LEAN_BRIDGE_NUGET_SOURCE: "https://feed.example.invalid/v3/index.json"
			, NUGET_API_KEY: "fixture key with spaces"
		}
		, files: { LEAN_BRIDGE_NUGET_ARCHIVE: ".nupkg" }
		, args: v => ["nuget", "push", v.LEAN_BRIDGE_NUGET_ARCHIVE, "--source", v.LEAN_BRIDGE_NUGET_SOURCE, "--api-key", v.NUGET_API_KEY, "--no-symbols"]
		, credential: "NUGET_API_KEY"
	}
	, {
		page: "maven"
		, select: "org.apache.maven.plugins:maven-deploy-plugin:3.1.4:deploy-file"
		, command: "mvn"
		, variables: { LEAN_BRIDGE_MAVEN_REPOSITORY: "https://maven.example.invalid/releases/" }
		, files: { LEAN_BRIDGE_MAVEN_JAR: ".jar", LEAN_BRIDGE_MAVEN_POM: ".pom", LEAN_BRIDGE_MAVEN_SETTINGS: ".xml" }
		, args: v => [
			"--batch-mode", "--settings", v.LEAN_BRIDGE_MAVEN_SETTINGS
			, "org.apache.maven.plugins:maven-deploy-plugin:3.1.4:deploy-file"
			, "-DrepositoryId=lean-bridge-release"
			, `-Durl=${v.LEAN_BRIDGE_MAVEN_REPOSITORY}`
			, `-Dfile=${v.LEAN_BRIDGE_MAVEN_JAR}`, `-DpomFile=${v.LEAN_BRIDGE_MAVEN_POM}`
			, "-DretryFailedDeploymentCount=1"
		]
	}
	, {
		page: "rubygems", select: 'gem push "$LEAN_BRIDGE_GEM_ARCHIVE"'
		, command: "gem"
		, variables: {
			LEAN_BRIDGE_GEM_HOST: "https://gems.example.invalid/"
			, GEM_HOST_API_KEY: "fixture gem key"
		}
		, files: { LEAN_BRIDGE_GEM_ARCHIVE: ".gem" }
		, args: v => ["push", v.LEAN_BRIDGE_GEM_ARCHIVE, "--host", v.LEAN_BRIDGE_GEM_HOST]
		, credential: "GEM_HOST_API_KEY"
	}
	, {
		page: "archives", select: 'gh release upload "$LEAN_BRIDGE_RELEASE_TAG"'
		, command: "gh"
		, variables: {
			LEAN_BRIDGE_RELEASE_TAG: "v2.3.0"
			, LEAN_BRIDGE_RELEASE_REPO: "fixture/publisher"
		}
		, files: { LEAN_BRIDGE_C_ARCHIVE: "-c.tar.gz", LEAN_BRIDGE_CPP_ARCHIVE: "-cpp.tar.gz", LEAN_BRIDGE_WASI_ARCHIVE: "-wasi.tar.gz" }
		, args: v => ["release", "upload", v.LEAN_BRIDGE_RELEASE_TAG, v.LEAN_BRIDGE_C_ARCHIVE, v.LEAN_BRIDGE_CPP_ARCHIVE, v.LEAN_BRIDGE_WASI_ARCHIVE, "--repo", v.LEAN_BRIDGE_RELEASE_REPO]
	}
];

for(const profile of uploads)
{
	test(`${profile.page} upload recipe passes exact prepared paths and preserves client failures`, async t => {
		const fixture = await sandbox(t);
		const script = await recipe(profile.page, profile.select);
		for(const name of ["cedar-api-2.3.0", "hazel-math-1.4.0"])
		{
			const variables = { ...profile.variables };
			for(const [variable, extension] of Object.entries(profile.files))
			{
				variables[variable] = join(fixture.cwd, `${name}${extension}`);
				await writeFile(variables[variable], `prepared ${name}${extension}\n`);
			}
			const result = await fixture.run(script, variables);
			assert.deepEqual((await fixture.calls()).at(-1), { command: profile.command, args: profile.args(variables) });
			for(const [variable, extension] of Object.entries(profile.files))
				assert.equal(await readFile(variables[variable], "utf8"), `prepared ${name}${extension}\n`);
			if(profile.credential)
			{
				assert.ok(!(result.stdout + result.stderr).includes(variables[profile.credential]));
				const before = await fixture.calls();
				await assert.rejects(fixture.run(script, { ...variables, [profile.credential]: "" }));
				assert.deepEqual(await fixture.calls(), before, "missing credentials must fail before calling the client");
			}
			await assert.rejects(fixture.run(script, { ...variables, RECIPE_FAIL: "1" }), { code: 19 });
		}
	});
}

for(const ordinary of [true, false])
{
	test(`Cargo review recipe ${ordinary ? "preserves ordinary locks" : "handles Alpha metadata and a missing lock"}`, async t => {
		const fixture = await sandbox(t);
		const name = ordinary ? "cedar-math" : "lean_bridge_alpha";
		const version = ordinary ? "2.3.0" : "0.0.0";
		const source = join(fixture.root, `${name}-${version}`);
		await mkdir(source);
		await writeFile(join(source, "Cargo.toml"), `[package]\nname = "${name}"\nversion = "${version}"\n`);
		await writeFile(join(source, ordinary ? "Cargo.lock" : ".cargo_vcs_info.json"), ordinary ? "approved lock fixture\n" : "{}\n");
		const archive = join(fixture.cwd, `${name}-${version}.crate`);
		await execute("/usr/bin/tar", ["-czf", archive, "-C", fixture.root, `${name}-${version}`]);
		const original = await readFile(archive);
		const review = join(fixture.cwd, "build/review");
		const prepare = await recipe("cargo", 'tar -xzf "$LEAN_BRIDGE_CARGO_ARCHIVE"');
		const approve = await recipe("cargo", "cargo generate-lockfile --offline");
		await fixture.run(`${prepare}\n${approve}`, {
			LEAN_BRIDGE_CARGO_ARCHIVE: archive, LEAN_BRIDGE_CARGO_NAME: name
			, LEAN_BRIDGE_CARGO_VERSION: version, LEAN_BRIDGE_CARGO_REVIEW: review
			, LEAN_BRIDGE_CARGO_REGISTRY: "owned_sandbox"
		});
		const calls = await fixture.calls();
		assert.deepEqual(calls.map(call => call.args), [
			...ordinary ? [] : [["generate-lockfile", "--offline"]]
			, ["package", "--locked", "--offline", "--registry", "owned_sandbox"]
			, ["publish", "--dry-run", "--locked", "--registry", "owned_sandbox"]
		]);
		assert.deepEqual(await readFile(archive), original);
		assert.equal(await readFile(join(review, `${name}-${version}/Cargo.lock`), "utf8"), ordinary ? "approved lock fixture\n" : "generated fixture lock\n");
		assert.equal(await readFile(join(review, "reviewed-cargo-archive.crate"), "utf8"), "reviewed Cargo repack fixture\n");
		if(!ordinary) assert.equal(await readFile(join(review, "original-cargo-vcs-info.json"), "utf8"), "{}\n");
	});
}

test("GitHub archive download recipe follows arbitrary prepared filenames and rejects changed bytes", async t => {
	const fixture = await sandbox(t);
	const script = await recipe("archives", 'gh release download "$LEAN_BRIDGE_RELEASE_TAG"');
	assert.match(script, /^set -euo pipefail\n/);
	for(const name of ["cedar-api-2.3.0", "hazel-math-1.4.0"])
	{
		const files = ["c", "cpp", "wit-wasi"].map(target => join(fixture.cwd, `${name}-${target}.tar.gz`));
		for(const file of files) await writeFile(file, `prepared ${file}\n`);
		const variables = {
			LEAN_BRIDGE_C_ARCHIVE: files[0], LEAN_BRIDGE_CPP_ARCHIVE: files[1]
			, LEAN_BRIDGE_WASI_ARCHIVE: files[2], LEAN_BRIDGE_RELEASE_TAG: "v2.3.0"
			, LEAN_BRIDGE_RELEASE_REPO: "fixture/publisher"
			, RECIPE_ARCHIVES: JSON.stringify(files)
		};
		await fixture.run(script, variables);
		const download = (await fixture.calls()).at(-1);
		assert.equal(download.command, "gh");
		assert.deepEqual(download.args.slice(0, -2), [
			"release", "download", "v2.3.0", "--repo", "fixture/publisher"
			, "--pattern", `${name}-c.tar.gz`, "--pattern", `${name}-cpp.tar.gz`
			, "--pattern", `${name}-wit-wasi.tar.gz`
		]);
		assert.equal(download.args.at(-2), "--dir");
		assert.ok(download.args.at(-1).startsWith(`${fixture.cwd}/tmp/lean-bridge-release-check.`));
		await assert.rejects(fixture.run(`set +eu; set +o pipefail\n${script}`, { ...variables, RECIPE_CORRUPT: "1" }), { code: 1 });
	}
});
