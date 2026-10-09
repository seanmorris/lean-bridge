/**
 * CI dependency installation must fail promptly instead of consuming a whole test job.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import "./browser-install-source-history-tests.mjs";

const action = "./.github/actions/bounded-apt";
const network = /\bapt-get\s+(?:update|install)\b|\bplaywright\s+install[^\n]*--with-deps|\binstall-playwright-browsers\.sh\b/u;

/**
 * Check every apt or Playwright dependency step in our two-space-indented workflows.
 *
 * @param source - Complete checked-in workflow text.
 */
export const assertBoundedAptWorkflow = source => {
	assert.match(source, /^jobs:\s*$/mu);
	const jobs = source.slice(source.indexOf("\njobs:") + 1).split(/(?=^ {2}[\w-]+:\s*$)/mu).slice(1);
	let checked = 0;
	for(const job of jobs)
	{
		const name = job.split("\n")[0].trim();
		const steps = job.split(/(?=^ {6}- )/mu).slice(1);
		const configured = steps.findIndex(step => step.includes(`uses: ${action}`));
		for(const [index, step] of steps.entries())
		{
			if(!network.test(step)) continue;
			assert.ok(configured >= 0 && configured < index, `${name} must configure apt before network use`);
			const setup = steps[configured];
			assert.doesNotMatch(setup, /^ {8}(?:if|continue-on-error):/mu, `${name} must not skip apt configuration`);
			assert.ok(steps.slice(0, configured).some(value => /uses: actions\/checkout@/u.test(value)), `${name} needs the local action checkout`);
			const timeout = Number(step.match(/^ {8}timeout-minutes: (\d+)\s*$/mu)?.[1]);
			assert.ok(timeout > 0 && timeout <= 20, `${name} dependency step must finish within 20 minutes`);
			assert.doesNotMatch(step, /^ {8}continue-on-error: true\s*$/mu, `${name} must not ignore dependency failure`);
			checked++;
		}
	}
	assert.ok(checked > 0, "workflow must contain checked apt-dependent steps");
	return checked;
};

test("apt limits cover HTTP, HTTPS, retries and partial update failures", async () => {
	const config = await readFile(".github/actions/bounded-apt/apt-network.conf", "utf8");
	assert.equal(config, 'Acquire::http::Timeout "30";\nAcquire::https::Timeout "30";\nAcquire::Retries "2";\nAPT::Update::Error-Mode "any";\n');
	const source = await readFile(".github/actions/bounded-apt/action.yml", "utf8");
	assert.match(source, /using: composite/u);
	assert.match(source, /sudo install -m 0644 "\$\{\{ github\.action_path \}\}\/apt-network\.conf" \/etc\/apt\/apt\.conf\.d\/99lean-bridge-network/u);
	assert.doesNotMatch(source, /continue-on-error|\|\| true/u);
});

test("apt guard rejects missing configuration, unbounded steps and indirect Playwright apt", () => {
	const source = `name: fixture
jobs:
  native:
    steps:
      - uses: actions/checkout@v6
      - uses: ${action}
      - name: Install tools
        timeout-minutes: 15
        run: sudo apt-get update && sudo apt-get install -y curl
      - name: Install browsers
        timeout-minutes: 20
        run: npx playwright install --with-deps chromium
      - name: Install browsers with a mirror fallback
        timeout-minutes: 20
        run: bash scripts/install-playwright-browsers.sh chromium firefox webkit
`;
	assert.equal(assertBoundedAptWorkflow(source), 3);
	for(const [before, after] of [
		[`      - uses: ${action}\n`, ""]
		, ["      - uses: actions/checkout@v6\n", ""]
		, [`      - uses: ${action}\n`, `      - uses: ${action}\n        if: false\n`]
		, ["        timeout-minutes: 15\n", ""]
		, ["        timeout-minutes: 20\n", ""]
		, ["timeout-minutes: 20", "timeout-minutes: 120"]
		, ["timeout-minutes: 15", "timeout-minutes: 0"]
		, ["        timeout-minutes: 20\n        run: bash", "        run: bash"]
		, ["        timeout-minutes: 20\n", "        timeout-minutes: 20\n        continue-on-error: true\n"]
	]) assert.throws(() => assertBoundedAptWorkflow(source.replace(before, after)));
});

test("downstream and Perl workflows bound direct and indirect apt installation", async () => {
	for(const path of [".github/workflows/consumer-matrix.yml", ".github/workflows/perl-consumer.yml"])
		assertBoundedAptWorkflow(await readFile(path, "utf8"));
});

const engines = ["chromium", "firefox", "webkit"];
const installer = "bash scripts/install-playwright-browsers.sh chromium firefox webkit";
// Every workflow step that installs all three engines, by file, job and step name.
export const browserInstallSites = Object.freeze([
	[".github/workflows/consumer-matrix.yml", "owned-javascript-wasm", "Install owned npm browser engines"]
	, [".github/workflows/consumer-matrix.yml", "owned-javascript-receivers", "Install all JavaScript browser engines"]
	, [".github/workflows/consumer-matrix.yml", "owned-dotnet-callback-results", "Install all callback browser engines"]
	, [".github/workflows/consumer-matrix.yml", "owned-perl-callback-results", "Install all callback browser engines"]
	, [".github/workflows/consumer-matrix.yml", "owned-jvm-callback-results", "Install all callback browser engines"]
	, [".github/workflows/consumer-matrix.yml", "owned-ruby-callback-results", "Install all callback browser engines"]
	, [".github/workflows/consumer-matrix.yml", "owned-python-callback-results", "Install all callback browser engines"]
	, [".github/workflows/consumer-matrix.yml", "owned-rust-callback-results", "Install all callback browser engines"]
	, [".github/workflows/consumer-matrix.yml", "owned-cpp-callback-results", "Install all callback browser engines"]
	, [".github/workflows/consumer-matrix.yml", "owned-callback-results", "Install all callback browser engines"]
	, [".github/workflows/consumer-matrix.yml", "node-consumers", "Install documentation browser engines"]
	, [".github/workflows/consumer-matrix.yml", "reviewed-fin-wasm-entry", "Install browser engines"]
	, [".github/workflows/demos-pages.yml", "build", "Install browser audit engines"]]);

/**
 * Return one job's text from a two-space-indented workflow.
 *
 * @param source - Workflow text.
 * @param job - Job key.
 */
const workflowJob = (source, job) => source.split(`\n  ${job}:\n`)[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];

test("every three-engine browser step uses the bounded installer within 20 minutes", async () => {
	const sources = new Map();
	for(const [path] of browserInstallSites) if(!sources.has(path)) sources.set(path, await readFile(path, "utf8"));
	for(const [path, job, name] of browserInstallSites)
	{
		const text = workflowJob(sources.get(path), job);
		assert.ok(text, `${path} ${job}`);
		const step = text.split(`      - name: ${name}\n`)[1]?.split("      - name: ")[0];
		assert.equal(step, `        timeout-minutes: 20\n        run: ${installer}\n`, `${path} ${job}`);
	}
	for(const [path, source] of sources)
	{
		// No three-engine step escapes the list or keeps an unbounded Playwright dependency install.
		assert.equal(source.split(installer).length - 1, browserInstallSites.filter(site => site[0] === path).length, path);
		assert.doesNotMatch(source, /playwright install --with-deps chromium firefox webkit/u, path);
		assert.doesNotMatch(source, /LEAN_BRIDGE_PLAYWRIGHT_LIMITS|LEAN_BRIDGE_APT_MIRRORS/u, path);
	}
	assertBoundedAptWorkflow(sources.get(".github/workflows/demos-pages.yml"));
	const source = await readFile("scripts/install-playwright-browsers.sh", "utf8");
	const limits = source.match(/LEAN_BRIDGE_PLAYWRIGHT_LIMITS:-(\d+) (\d+) (\d+) (\d+) (\d+) (\d+)\}/u).slice(1).map(Number);
	const [first, second, grace, recover, browsers, verify] = limits;
	assert.deepEqual(limits, [300, 360 - 30, 30, 120, 180, 60]);
	// A supervised phase lasts at most its limit, its grace and five seconds of SIGKILL drain. Recovery
	// uses a 10-second grace; the mirror read and write are 10 seconds plus 2 each.
	const supervised = (limit, wait) => limit + wait + 5;
	const total = supervised(first, grace) + supervised(recover, 10) + 12 + 12 + supervised(second, grace) + supervised(browsers, grace) + verify + 5;
	assert.equal(total, 1139);
	assert.ok(total < 20 * 60);
	assert.doesNotMatch(source, /\bpkill\b|\bkillall\b|\|\| true|continue-on-error|--dry-run|--foreground/u);
	// Every privileged command is non-interactive, so recovery cannot wait for a password.
	const commands = source.split("\n").filter(line => !line.trimStart().startsWith("#")).join("\n");
	assert.deepEqual(commands.match(/\bsudo\b(?! -n )[^\n]*/gu), null);
});

/**
 * Report whether a process is executing; a zombie or a vanished pid is not.
 *
 * @param pid - Process id.
 */
const executing = async pid => {
	const stat = await readFile(`/proc/${pid}/stat`, "utf8").catch(() => null);
	return stat !== null && stat.slice(stat.lastIndexOf(") ") + 2, stat.lastIndexOf(") ") + 3) !== "Z";
};

/**
 * Poll a stopped process for up to three seconds before deciding it still executes.
 *
 * @param pid - Process id.
 */
const stillExecuting = async pid => {
	for(let attempt = 0; attempt < 30; attempt++)
	{
		if(!await executing(pid)) return false;
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	return true;
};

/**
 * Run the installer from a temporary copy whose Playwright package is a recording stub.
 *
 * @param t - Test context.
 * @param options - Stub behaviour.
 * @param options.plan - One action per Playwright CLI call: an exit status, "hang" or "stubborn".
 * @param options.mirrors - Initial mirror list text, or null for a missing list.
 * @param options.installed - Engines whose browser file exists afterwards.
 * @param options.executable - Engines whose browser file is executable.
 * @param options.engines - Requested engines.
 * @param options.limits - Phase limits passed to the installer.
 */
const runBrowserInstaller = async (t, { plan, mirrors = "http://azure.archive.ubuntu.com/ubuntu/\tpriority:1\nhttps://archive.ubuntu.com/ubuntu/\tpriority:2\nhttps://security.ubuntu.com/ubuntu/\tpriority:3\n", installed = engines, executable = installed, engines: requested = engines, limits = "2 3 1 5 5 5" }) => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-browser-installer-"));
	const unrelated = spawn("sleep", ["300"], { stdio: "ignore" });
	t.after(async () => {
		unrelated.kill("SIGKILL");
		for(const name of ["grandchild"])
		{
			const pid = Number(await readFile(join(root, name), "utf8").catch(() => "0"));
			if(pid && await executing(pid)) process.kill(pid, "SIGKILL");
		}
		await rm(root, { recursive: true, force: true });
	});
	const bin = join(root, "bin"), playwright = join(root, "node_modules/playwright"), log = join(root, "calls");
	for(const directory of [bin, playwright, join(root, "scripts"), join(root, "browsers")]) await mkdir(directory, { recursive: true });
	await cp("scripts/install-playwright-browsers.sh", join(root, "scripts/install-playwright-browsers.sh"));
	await cp("scripts/verify-playwright-browsers.mjs", join(root, "scripts/verify-playwright-browsers.mjs"));
	await writeFile(join(playwright, "package.json"), '{"name":"playwright","type":"module","exports":"./index.js"}');
	await writeFile(join(playwright, "index.js"), engines.map(name => `export const ${name} = { executablePath: () => ${JSON.stringify(join(root, "browsers", name))} };`).join("\n"));
	// Each CLI call takes the next planned action. "hang" leaves an ordinary grandchild in the attempt's
	// group; "stubborn" leaves one that ignores SIGTERM while the CLI itself still dies on SIGTERM.
	const modes = Object.fromEntries(installed.map(name => [name, executable.includes(name) ? 0o755 : 0o644]));
	await writeFile(join(playwright, "cli.js"), `import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
const count = ${JSON.stringify(join(root, "count"))}, plan = ${JSON.stringify(plan)};
const index = Number(readFileSync(count, "utf8")); writeFileSync(count, String(index + 1));
appendFileSync(${JSON.stringify(log)}, "playwright " + process.argv.slice(2).join(" ") + "\\n");
const action = plan[index];
if(action === "hang" || action === "stubborn")
{
	const command = action === "hang" ? ["sleep", ["300"]] : ["bash", ["-c", "trap '' TERM; exec sleep 300"]];
	const child = spawn(...command, { stdio: "ignore" });
	writeFileSync(${JSON.stringify(join(root, "grandchild"))}, String(child.pid));
	setInterval(() => {}, 1000);
}
else
{
	if(action === 0) for(const [name, mode] of Object.entries(${JSON.stringify(modes)})) writeFileSync(${JSON.stringify(join(root, "browsers"))} + "/" + name, "", { mode });
	process.exit(action);
}
`);
	await writeFile(join(root, "count"), "0");
	for(const [name, body] of [["sudo", `echo "sudo $*" >> "${log}"\n[ "$1" = -n ] || exit 97\nshift\nexec "$@"`], ["dpkg", `echo "dpkg $*" >> "${log}"`]])
	{
		await writeFile(join(bin, name), `#!/bin/bash\n${body}\n`);
		await chmod(join(bin, name), 0o755);
	}
	const list = join(root, "apt-mirrors.txt");
	if(mirrors !== null) await writeFile(list, mirrors);
	const env = { PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, LEAN_BRIDGE_APT_MIRRORS: list, LEAN_BRIDGE_PLAYWRIGHT_LIMITS: limits };
	const script = join(root, "scripts/install-playwright-browsers.sh");
	const result = await promisify(execFile)("/bin/bash", [script, ...requested], { env })
		.then(value => ({ code: 0, ...value }), error => ({ code: error.code, stdout: error.stdout, stderr: error.stderr }));
	const read = path => readFile(path, "utf8").catch(() => null);
	const grandchild = Number(await read(join(root, "grandchild")));
	const calls = ((await read(log)) ?? "").trim().split("\n").filter(Boolean);
	const grandchildExecuting = grandchild ? await stillExecuting(grandchild) : null;
	const unrelatedExecuting = await executing(unrelated.pid);
	return { ...result, calls, script, mirrors: await read(list), grandchildExecuting, unrelatedExecuting };
};
const supervisedDeps = (run, limit) => `sudo -n /bin/bash ${run.script} --supervise ${limit} 1 ${process.execPath} ${dirname(dirname(run.script))}/node_modules/playwright/cli.js install-deps chromium firefox webkit`;

test("browser phase deadlines include slow polling rather than counting sleeps", { timeout: 15000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-browser-deadline-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	// Slow only the supervisor's polling. The supervised command uses an absolute executable.
	const sleeper = join(root, "sleep");
	await writeFile(sleeper, '#!/bin/bash\nexec /bin/sleep 0.5\n', { mode: 0o755 });
	const start = performance.now();
	const result = await promisify(execFile)("/bin/bash", ["scripts/install-playwright-browsers.sh", "--supervise", "1", "1", "/bin/sleep", "10"], {
		env: { PATH: `${root}:/usr/bin:/bin` }
	}).then(() => ({ code: 0 }), error => ({ code: error.code }));
	assert.equal(result.code, 124);
	assert.ok(performance.now() - start < 4000, "a one-second phase must not wait for ten slow polls");
});

test("the browser installer succeeds once without touching recovery or the mirror list", async t => {
	const run = await runBrowserInstaller(t, { plan: [0, 0] });
	assert.equal(run.code, 0, run.stderr);
	assert.deepEqual(run.calls, [supervisedDeps(run, 2), "playwright install-deps chromium firefox webkit", "playwright install chromium firefox webkit"]);
	assert.match(run.mirrors, /^http:\/\/azure\.archive\.ubuntu\.com\/ubuntu\/\tpriority:1\n/u);
	assert.match(run.stdout, /chromium: .*\nfirefox: .*\nwebkit: /u);
});

for(const action of ["hang", "stubborn"])
{
	test(`a ${action} dependency attempt leaves no running descendant, spares other processes, recovers dpkg and prefers the archive`, async t => {
		const run = await runBrowserInstaller(t, { plan: [action, 0, 0] });
		assert.equal(run.code, 0, run.stderr);
		assert.equal(run.grandchildExecuting, false, "every member of the timed-out attempt stopped");
		assert.equal(run.unrelatedExecuting, true, "an unrelated process survives");
		const dependencies = "playwright install-deps chromium firefox webkit";
		const recovery = `sudo -n /bin/bash ${run.script} --supervise 5 10 dpkg --configure -a`;
		const mirror = `sudo -n timeout --kill-after=2 10 tee ${dirname(dirname(run.script))}/apt-mirrors.txt`;
		const browsers = "playwright install chromium firefox webkit";
		const expected = [supervisedDeps(run, 2), dependencies, recovery, "dpkg --configure -a", mirror, supervisedDeps(run, 3), dependencies, browsers];
		assert.deepEqual(run.calls, expected);
		assert.equal(run.mirrors, "https://archive.ubuntu.com/ubuntu/\tpriority:1\nhttp://azure.archive.ubuntu.com/ubuntu/\tpriority:2\nhttps://security.ubuntu.com/ubuntu/\tpriority:3\n");
		assert.match(run.stdout, /::warning::Playwright dependency installation attempt 1 exited with 124/u);
	});
}

test("the browser installer fails after two dependency failures and never installs browsers", async t => {
	const run = await runBrowserInstaller(t, { plan: [1, 100] });
	assert.equal(run.code, 1);
	assert.match(run.stdout, /::error::Playwright dependency installation failed: attempt 1 exited with 1, attempt 2 with 100/u);
	assert.ok(!run.calls.includes("playwright install chromium firefox webkit"));
});

test("missing or unexpected mirror lists are reported and left unchanged", async t => {
	const missing = await runBrowserInstaller(t, { plan: [1, 0, 0], mirrors: null });
	assert.equal(missing.code, 0, missing.stderr);
	assert.equal(missing.mirrors, null);
	assert.match(missing.stdout, /::warning::.*apt-mirrors\.txt is missing; the second attempt keeps the configured apt sources/u);
	const unexpected = [["deb http://azure.archive.ubuntu.com/ubuntu noble main\n", "has an unexpected entry"]
		, ["http://azure.archive.ubuntu.com/ubuntu/\tpriority:1\tarch:amd64\n", "has an unexpected entry"]
		, ["http://azure.archive.ubuntu.com/ubuntu/\tpriority:1\n", "names no archive.ubuntu.com mirror"]];
	for(const [mirrors, message] of unexpected)
	{
		const run = await runBrowserInstaller(t, { plan: [1, 0, 0], mirrors });
		assert.equal(run.code, 0, run.stderr);
		assert.equal(run.mirrors, mirrors);
		assert.ok(run.stdout.includes(message), message);
		assert.ok(!run.calls.some(call => call.includes(" tee ")));
	}
});

test("the browser installer refuses missing or non-executable browsers, unknown engines and invalid limits", async t => {
	const missing = await runBrowserInstaller(t, { plan: [0, 0], installed: ["chromium", "firefox"] });
	assert.notEqual(missing.code, 0);
	assert.match(missing.stderr, /webkit has no executable browser at /u);
	const plain = await runBrowserInstaller(t, { plan: [0, 0], executable: ["chromium", "firefox"] });
	assert.notEqual(plain.code, 0);
	assert.match(plain.stderr, /webkit has no executable browser at /u);
	const unknown = await runBrowserInstaller(t, { plan: [0, 0], engines: ["chromium", "opera"] });
	assert.equal(unknown.code, 2);
	assert.deepEqual(unknown.calls, []);
	for(const limits of ["0 3 1 5 5 5", "-2 3 1 5 5 5", "2 x 1 5 5 5", "2 3 1 5 5", "2 3 1 5 5 5 7", "02 3 1 5 5 5"])
	{
		const run = await runBrowserInstaller(t, { plan: [0, 0], limits });
		assert.equal(run.code, 2, limits);
		assert.match(run.stderr, /Playwright phase limit/u, limits);
		assert.deepEqual(run.calls, [], limits);
	}
});
