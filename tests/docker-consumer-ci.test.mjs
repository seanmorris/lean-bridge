/**
 * Tests the targeted Docker consumer retry boundary.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execute = promisify(execFile);
const workflowPath = ".github/workflows/consumer-matrix.yml";
const runnerPath = "scripts/test-docker-consumer-ci.sh";
const sourceClosurePath = "scripts/check-consumer-source-closure.sh";

const fakeNpm = `#!/usr/bin/env bash
set -euo pipefail
count=0
if [[ -f "$LEAN_BRIDGE_RETRY_COUNT" ]]; then count=$(<"$LEAN_BRIDGE_RETRY_COUNT"); fi
count=$((count + 1))
printf '%s\n' "$count" > "$LEAN_BRIDGE_RETRY_COUNT"
if [[ "$LEAN_BRIDGE_RETRY_MODE" == "transient" && "$count" -eq 1 ]]; then
  echo 'error: Init/Data/List/MinMaxIdx.lean:297:12: \`simp\` made no progress' >&2
  exit 2
fi
if [[ "$LEAN_BRIDGE_RETRY_MODE" == "permanent" ]]; then
  echo 'ordinary consumer failure' >&2
  exit 7
fi
echo 'consumer passed'
`;

const runFixture = async mode => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-docker-retry-"));
	try
	{
		const npm = join(scratch, "npm");
		const count = join(scratch, "count");
		await writeFile(npm, fakeNpm);
		await chmod(npm, 0o755);
		try
		{
			const result = await execute("bash", ["scripts/test-docker-consumer-ci.sh"], {
				cwd: process.cwd()
				, env: {
					...process.env
					, PATH: `${scratch}:${process.env.PATH}`
					, LEAN_BRIDGE_RETRY_COUNT: count
					, LEAN_BRIDGE_RETRY_MODE: mode
				}
			});
			return { code: 0, stdout: result.stdout, stderr: result.stderr, attempts: Number(await readFile(count, "utf8")) };
		} catch(error)
		{
			return {
				code: error.code
				, stdout: error.stdout
				, stderr: error.stderr
				, attempts: Number(await readFile(count, "utf8"))
			};
		}
	} finally
	{
		await rm(scratch, { recursive: true, force: true });
	}
};

test("Docker consumer CI retries the exact transient Lean bootstrap failure", async () => {
	const result = await runFixture("transient");
	assert.equal(result.code, 0);
	assert.equal(result.attempts, 2);
	assert.match(result.stderr, /Retrying the exact pinned derivation once/);
});

test("Docker consumer CI does not retry an unrelated failure", async () => {
	const result = await runFixture("permanent");
	assert.equal(result.code, 7);
	assert.equal(result.attempts, 1);
	assert.doesNotMatch(result.stderr, /Retrying/);
});

const dockerJob = source => source.split("  docker-engine:\n")[1]
	?.split("\n  perl-consumer:\n")[0];

const assertBoundedCheckout = source => {
	const job = dockerJob(source);
	assert.ok(job);
	assert.match(job, /^ {10}fetch-depth: 1$/mu);
	assert.match(job, /^ {10}sparse-checkout: \|$/mu);
	assert.match(job, /^ {12}\/\*$/mu);
	assert.match(job, /^ {12}!\/\*\/$/mu);
	assert.match(job, /^ {12}\/docs\/$/mu);
	assert.match(job, /^ {12}!\/docs\/evidence\/$/mu);
	for(const directory of [
		".github", "acceptance", "config", "containers", "demos", "nix"
		, "notices", "patches", "poc", "schema", "scripts", "site", "src"
		, "tests"
	]) assert.match(job, new RegExp(`^ {12}/${directory.replace(".", "\\.")}/$`, "mu"));
	assert.match(job, /^ {10}sparse-checkout-cone-mode: false$/mu);
	assert.match(job, /git rev-list --objects --missing=print HEAD/u);
	assert.match(job, /test "\$missing_blobs" -gt 1000/u);
	assert.match(job, /test "\$git_bytes" -lt 2097152/u);
	assert.match(job, /test "\$source_bytes" -lt 2097152/u);
	assert.match(job, /^ {10}LEAN_BRIDGE_CONSUMER_SOURCE_MODE: sparse-path$/mu);
};

test("Docker consumer checkout omits the retained evidence corpus and fails closed", async () => {
	const source = await readFile(workflowPath, "utf8");
	assertBoundedCheckout(source);
	const job = dockerJob(source);
	assert.ok(job);
	const alter = (from, to = "") => {
		const changed = job.replace(from, to);
		assert.notEqual(changed, job);
		return source.replace(job, changed);
	};
	for(const [label, altered] of [
		["evidence exclusion", alter("            !/docs/evidence/\n")]
		, ["non-cone mode", alter("          sparse-checkout-cone-mode: false\n")]
		, ["missing-blob floor", alter("          test \"$missing_blobs\" -gt 1000\n")]
		, ["Git size ceiling", alter("          test \"$git_bytes\" -lt 2097152\n")]
		, ["path source mode", alter("          LEAN_BRIDGE_CONSUMER_SOURCE_MODE: sparse-path\n")]
	]) {
		assert.throws(() => assertBoundedCheckout(altered), label);
	}
});

const workflowJobs = source => {
	const starts = [...source.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gmu)];
	return new Map(starts.map((match, index) => [
		match[1]
		, source.slice(match.index
			, starts[index + 1]?.index ?? source.length)
	]));
};

const metadataSparsePatterns = [
	"/*", "!/*/", "/.github/", "/acceptance/", "/config/"
	, "/containers/", "/demos/", "/nix/", "/notices/", "/patches/"
	, "/poc/", "/schema/", "/scripts/", "/site/", "/src/", "/tests/"
	, "/docs/", "!/docs/evidence/*", "/docs/evidence/*.json"
	, "/docs/evidence/*.md", "/docs/evidence/*.xml"
	, "/docs/evidence/*/index.json"
];

const expectedNixJobs = [
	"browser-consumer", "docker-engine", "host-null-systems"
	, "managed-consumers", "native-c-family-values", "native-consumers"
	, "nix-cache", "node-consumers", "owned-jvm-values", "owned-wit-receivers"
	, "php-consumers", "php-multi-profile", "php-wasm-callback-results"
	, "php-wasm-consumers", "php-wasm-corpus", "php-wasm-receivers"
	, "reviewed-fin-wasm-entry", "wasi-consumer"
];

const assertNixSourceClosures = source => {
	const jobs = workflowJobs(source);
	const sparseValue = ["  LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT: |"
		, ...metadataSparsePatterns.map(pattern => `    ${pattern}`)].join("\n");
	assert.ok(source.includes(sparseValue));
	const actual = [...jobs].filter(([, job]) => job.includes(
		"uses: cachix/install-nix-action@v31")).map(([name]) => name).sort();
	assert.deepEqual(actual, expectedNixJobs);
	const dedicated = jobs.get("nix-cache");
	assert.match(dedicated, /^ {10}sparse-checkout: \|$/mu);
	assert.doesNotMatch(dedicated, /docs\/evidence/u);
	const producer = jobs.get("type-surface-authentication");
	assert.match(producer
		, /node scripts\/create-core-type-surface-evidence-receipt[.]mjs/u);
	assert.match(producer
		, /name: consumer-type-surface-\$\{\{ github[.]sha \}\}/u);
	const reviewed = jobs.get("reviewed-ir-admission");
	assert.match(reviewed, /^ {4}needs: type-surface-authentication$/mu);
	assert.match(reviewed, /^ {8}uses: actions\/download-artifact@v8$/mu);
	assert.match(reviewed
		, /LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT=\$GITHUB_WORKSPACE\/build\/consumer-type-surface\/receipt[.]json/u);
	for(const name of expectedNixJobs.filter(item =>
		!["docker-engine", "nix-cache"].includes(item))) {
		const job = jobs.get(name);
		assert.ok(job, name);
		assert.match(job, /^ {4}needs: type-surface-authentication$/mu, name);
		assert.match(job
			, /^ {10}sparse-checkout: \$\{\{ env\.LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT \}\}$/mu
			, name);
		assert.match(job, /^ {10}sparse-checkout-cone-mode: false$/mu, name);
		assert.match(job
			, /^ {8}run: bash scripts\/check-consumer-source-closure\.sh$/mu
			, name);
		assert.match(job, /^ {8}uses: actions\/download-artifact@v8$/mu
			, name);
		assert.match(job
			, /^ {10}name: consumer-type-surface-\$\{\{ github[.]sha \}\}$/mu
			, name);
		assert.match(job
			, /LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT=\$GITHUB_WORKSPACE\/build\/consumer-type-surface\/receipt[.]json/u
			, name);
		}
};

test("every downstream Nix job has one bounded metadata-only source closure"
	, async () => {
		const source = await readFile(workflowPath, "utf8");
		assertNixSourceClosures(source);
		const jobs = workflowJobs(source);
		for(const name of ["browser-consumer", "node-consumers"
			, "native-consumers"]) {
			const job = jobs.get(name);
			for(const required of [
				"    needs: type-surface-authentication\n"
				, "          sparse-checkout-cone-mode: false\n"
				, "        uses: actions/download-artifact@v8\n"
				, "        run: echo \"LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT=$GITHUB_WORKSPACE/build/consumer-type-surface/receipt.json\" >> \"$GITHUB_ENV\"\n"
			]) {
				const changed = job.replace(required, "");
				assert.notEqual(changed, job, `${name}: ${required.trim()}`);
				assert.throws(() => assertNixSourceClosures(
					source.replace(job, () => changed))
					, { name: "AssertionError" }, name);
			}
			}
	}
);

test("consumer source closure rejects retained payloads and reports its bounds"
	, async () => {
		const source = await readFile(sourceClosurePath, "utf8");
		for(const expression of [
			/find docs\/evidence -mindepth 2 -type f/u
			, /! -name index\.json/u, /git rev-list --objects --missing=print/u
			, /test "\$missing_blobs" -gt 1000/u
			, /test "\$git_kib" -lt 2097152/u
			, /test "\$source_kib" -lt 2097152/u
			, /test "\$evidence_kib" -lt 1572864/u
		]) assert.match(source, expression);
	}
);

const fakeClosureGit = `#!/usr/bin/env bash
set -euo pipefail
test "$1" = rev-list
for index in $(seq 1 1001); do printf '?blob-%s\\n' "$index"; done
`;
const fakeClosureDu = `#!/usr/bin/env bash
set -euo pipefail
case "\${!#}" in
  .git) printf '1024\\t.git\\n';;
  docs/evidence) printf '2048\\tdocs/evidence\\n';;
  .) printf '4096\\t.\\n';;
  *) exit 64;;
esac
`;
const fakeClosureDf = `#!/usr/bin/env bash
set -euo pipefail
printf 'bounded disk\\n'
`;

const runSourceClosureFixture = async retainedPayload => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-source-closure-"));
	try
	{
		const bin = join(scratch, "bin");
		const evidence = join(scratch, "docs", "evidence");
		await mkdir(join(evidence, "archive"), { recursive: true });
		await mkdir(join(scratch, ".git"));
		await writeFile(join(evidence, "vo1220-exact-type-surface-v1.json"), "{}\n");
		await writeFile(join(evidence, "archive", "index.json"), "{}\n");
		if(retainedPayload)
			await writeFile(join(evidence, "archive", "run.tap"), "payload\n");
		await mkdir(bin);
		for(const [name, source] of [
			["git", fakeClosureGit], ["du", fakeClosureDu]
			, ["df", fakeClosureDf]
		]) {
			const path = join(bin, name);
			await writeFile(path, source);
			await chmod(path, 0o755);
		}
		try
		{
			const result = await execute("bash", [join(process.cwd()
				, sourceClosurePath)], {
				cwd: scratch
				, env: {
					...process.env, PATH: `${bin}:${process.env.PATH}`
					, GITHUB_WORKSPACE: scratch
				}}
			);
			return { code: 0, stdout: result.stdout, stderr: result.stderr };
		}
		catch(error)
		{ return { code: error.code, stdout: error.stdout, stderr: error.stderr }; }
	}
	finally
	{ await rm(scratch, { recursive: true, force: true }); }
};

test("consumer source closure accepts metadata and refuses one retained payload"
	, async () => {
		const accepted = await runSourceClosureFixture(false);
		assert.equal(accepted.code, 0);
		assert.match(accepted.stdout, /missing blobs: 1001/u);
		assert.match(accepted.stdout, /evidence metadata KiB: 2048/u);
		const refused = await runSourceClosureFixture(true);
		assert.equal(refused.code, 1);
		assert.match(refused.stderr
			, /Retained evidence payload escaped.*archive\/run\.tap/u);
	}
);

const fakeNix = `#!/usr/bin/env bash
set -euo pipefail
flake=
for argument in "$@"; do
  case "$argument" in path:*#*) flake="$argument";; esac
done
test -n "$flake"
source_path=$(printf '%s' "$flake" | sed -e 's/^path://' -e 's/#.*$//')
test -f "$source_path/flake.nix"
test -f "$source_path/package.json"
test -f "$source_path/tests/consumer-node.test.mjs"
test ! -e "$source_path/docs/evidence"
printf '%s\n' "$flake" >> "$LEAN_BRIDGE_SPARSE_TRACE"
`;

const fakeNode = `#!/usr/bin/env bash
set -euo pipefail
test "$1" = --test
test "$2" = tests/consumer-node.test.mjs
printf 'node:%s\n' "$*" >> "$LEAN_BRIDGE_SPARSE_TRACE"
echo 'consumer passed'
`;

test("Docker consumer builds from one evidence-free path snapshot", async () => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-docker-sparse-"));
	try
	{
		const bin = join(scratch, "bin");
		const trace = join(scratch, "trace");
		await mkdir(bin);
		for(const [name, source] of [["nix", fakeNix], ["node", fakeNode]])
		{
			const path = join(bin, name);
			await writeFile(path, source);
			await chmod(path, 0o755);
		}
		const result = await execute("bash", [runnerPath], {
			cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024
			, env: {
				...process.env, PATH: `${bin}:${process.env.PATH}`
				, RUNNER_TEMP: scratch
				, LEAN_BRIDGE_CONSUMER_SOURCE_MODE: "sparse-path"
				, LEAN_BRIDGE_SPARSE_TRACE: trace
			}
		});
		assert.match(result.stdout, /consumer passed/u);
		const records = (await readFile(trace, "utf8")).trim().split("\n");
		assert.equal(records.length, 3);
		assert.match(records[0], /^path:.+#universal-core-artifacts$/u);
		assert.match(records[1], /^path:.+#npm-package$/u);
		assert.equal(records[2], "node:--test tests/consumer-node.test.mjs");
		const sourceRoot = records[0]
			.slice("path:".length, -"#universal-core-artifacts".length);
		await assert.rejects(access(sourceRoot));
	}
	finally
	{ await rm(scratch, { recursive: true, force: true }); }
});

test("Docker consumer rejects unknown source modes before execution", async () => {
	await assert.rejects(execute("bash", [runnerPath], {
		cwd: process.cwd()
		, env: {
			...process.env, LEAN_BRIDGE_CONSUMER_SOURCE_MODE: "unknown"
		}
	}), error => {
		assert.equal(error.code, 2);
		assert.match(error.stderr, /Unknown consumer source mode: unknown/u);
		return true;
	});
});
