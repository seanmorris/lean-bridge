/**
 * Executes the documented signing and consumer recipes against private Nix stores.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const repository = resolve(import.meta.dirname, "..");
const enabled = process.env.LEAN_BRIDGE_NIX_CACHE_TEST === "1";
const paths = {
	runtime: "/nix/store/00000000000000000000000000000001-cedar-runtime-1"
	, packages: "/nix/store/00000000000000000000000000000002-cedar-packages-2"
};

const recipe = async (file, command) => {
	const document = await readFile(join(repository, file), "utf8");
	const blocks = [...document.matchAll(/```sh\n([\s\S]*?)\n```/g)]
		.map(match => match[1]).filter(block => block.includes(command));
	assert.equal(blocks.length, 1, `${file}: expected one recipe containing ${command}`);
	return blocks[0];
};

const recipes = async () => ({
	keygen: await recipe("docs/publish/nix.md", "nix-store --generate-binary-cache-key")
	, sign: await recipe("docs/publish/nix.md", "store sign --recursive")
	, verify: await recipe("docs/publish/nix.md", "curl --fail --show-error")
	, fetch: await recipe("docs/consume/receive-package.md", "LEAN_BRIDGE_FETCH_ROOT=$(mktemp")
});

test("the signed Nix acceptance executes the publisher and consumer documentation blocks", async () => {
	const commands = await recipes();
	assert.match(commands.sign, /--key-file/);
	assert.match(commands.fetch, /require-sigs=true/);
	assert.match(commands.fetch, /^set -euo pipefail\n/);
	for(const command of [commands.sign, commands.verify, commands.fetch])
	{
		assert.match(command, /--sigs-needed 1/);
		assert.match(command, /--option secret-key-files ''/);
		assert.doesNotMatch(command, /--no-check-sigs|require-sigs=false|trusted=true/);
	}
	const workflow = await readFile(join(repository, ".github/workflows/consumer-matrix.yml"), "utf8");
	assert.match(workflow, /nix-cache:[\s\S]*?install_url: https:\/\/releases\.nixos\.org\/nix\/nix-2\.24\.11\/install[\s\S]*?run: npm run test:nix-cache/);
	assert.match(workflow, /needs:[\s\S]*?- nix-cache/);
});

test("signed Nix recipes authenticate and fetch a complete input-addressed closure", {
	skip: !enabled, timeout: 120_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nix-publication-"));
	t.after(async () => {
		// Nix makes imported directories read-only. Restore owner access only in
		// this run's scratch tree so unprivileged test users can remove it too.
		const writable = async directory => {
			await chmod(directory, 0o700);
			for(const entry of await readdir(directory, { withFileTypes: true }))
				if(entry.isDirectory()) await writable(join(directory, entry.name));
		};
		await writable(root);
		await rm(root, { recursive: true, force: true });
	});
	const work = join(root, "publisher with spaces # & %");
	const producer = join(root, "producer");
	const records = join(work, "records");
	const signing = join(root, "private-keys");
	for(const directory of [join(work, "build"), records, signing, join(root, "config"), join(root, "tmp # & %")])
		await mkdir(directory, { recursive: true, mode: 0o700 });
	const environment = {
		...process.env
		, BASH_ENV: "/dev/null"
		, ENV: "/dev/null"
		, NIX_CONF_DIR: join(root, "config")
		, NIX_USER_CONF_FILES: ""
		, NIX_REMOTE: `local?root=${producer}`
		, XDG_CACHE_HOME: join(root, "cache")
		, XDG_STATE_HOME: join(root, "state")
		, TMPDIR: join(root, "tmp # & %")
		, NIX_CONFIG: "experimental-features = nix-command\nbuild-users-group =\nsubstituters =\ntrusted-public-keys =\nsecret-key-files =\nbuilders =\nmax-jobs = 0\n"
		, LEAN_BRIDGE_BUNDLE_STORE: paths.runtime
		, LEAN_BRIDGE_PACKAGES_STORE: paths.packages
		, LEAN_BRIDGE_NIX_RECORDS: records
		, LEAN_BRIDGE_SIGNING_DIR: join(signing, "cache-test-1")
	};
	const run = (command, args, options = {}) => new Promise(resolveResult => {
		const child = execFile(command, args, {
			cwd: work, env: { ...environment, ...options.env }, timeout: 30_000
			, maxBuffer: 1024 * 1024, encoding: options.binary ? "buffer" : "utf8"
		}, (error, stdout, stderr) => resolveResult({ code: error ? error.code ?? error.signal ?? "execution-failed" : 0, stdout, stderr }));
		child.stdin.on("error", () => {});
		child.stdin.end(options.input ?? "");
	});
	const success = async (command, args, options) => {
		const result = await run(command, args, options);
		assert.equal(result.code, 0, `${command} failed: ${result.stderr}`);
		return result.stdout;
	};
	const shell = (command, env = {}) => run("bash", ["-euo", "pipefail", "-c", command], { env });
	const version = await success("nix", ["--version"]);
	assert.match(version, /\b2\.(?:2[4-9]|[3-9]\d|\d{3,})\./, "Nix 2.24 or newer is required");
	t.diagnostic(version.trim());

	// Register input-addressed fixtures. `nix store add` would make content-addressed
	// paths, which Nix trusts without a signature and cannot test signer rejection.
	// Neither registration nor the documented recipes can address the active store.
	let registration = "";
	for(const [name, path] of Object.entries(paths))
	{
		const physical = join(producer, path);
		await mkdir(physical, { recursive: true });
		await writeFile(join(physical, "payload.txt"), name === "runtime" ? "Cedar runtime fixture\n" : `requires ${paths.runtime}\n`);
		const nar = await success("nix-store", ["--dump", physical], { binary: true });
		const hash = createHash("sha256").update(nar).digest("hex");
		const references = name === "runtime" ? [] : [paths.runtime];
		registration += `${path}\nsha256:${hash}\n${nar.length}\n\n${references.length}\n${references.length ? `${references.join("\n")}\n` : ""}`;
	}
	await success("nix-store", ["--load-db"], { input: registration });
	const inventory = JSON.parse(await success("nix", ["path-info", "--json", "--recursive", paths.packages]));
	assert.deepEqual(Object.keys(inventory).sort(), Object.values(paths).sort());
	for(const info of Object.values(inventory))
	{
		assert.ok(!info.ca, "fixture must not be content-addressed");
		assert.equal(info.ultimate, false);
		assert.equal(info.signatures?.length ?? 0, 0);
	}

	const commands = await recipes();
	const publicKeys = [];
	for(const name of ["cache-test-1", "cache-test-2", "wrong-signer"])
	{
		const generated = await shell(commands.keygen, { LEAN_BRIDGE_SIGNING_DIR: join(signing, name), LEAN_BRIDGE_CACHE_KEY_NAME: name });
		assert.equal(generated.code, 0, generated.stderr);
		assert.equal((await stat(join(signing, name, "cache.secret"))).mode & 0o777, 0o600);
		assert.equal((await stat(join(signing, name))).mode & 0o777, 0o700);
		publicKeys.push((await readFile(join(signing, name, "cache.public"), "utf8")).trim());
	}
	environment.LEAN_BRIDGE_CACHE_PUBLIC_KEY = publicKeys[0];
	const copyTo = destination => success("nix", ["copy", "--to", pathToFileURL(destination).href, paths.packages]);
	const verify = (cache, key) => run("nix", [
		"store", "verify", "--store", pathToFileURL(cache).href
		, "--recursive", "--sigs-needed", "1"
		, "--option", "trusted-public-keys", key
		, "--option", "secret-key-files", "", paths.packages
	]);
	const fetch = async (cache, key) => {
		// Start without error handling so this tests the consumer block's own guard.
		const result = await run("bash", ["-c", `set +eu; set +o pipefail\n${commands.fetch}`], {
			env: { LEAN_BRIDGE_CACHE_URL: pathToFileURL(cache).href, LEAN_BRIDGE_CACHE_PUBLIC_KEY: key }
		});
		if(result.code !== 0) assert.doesNotMatch(result.stdout, /Verified fetched closure/);
		return result;
	};
	const rejected = (result, reason) => {
		assert.notEqual(result.code, 0, "unsafe cache unexpectedly accepted");
		assert.match(result.stderr, reason);
	};
	const unsigned = join(root, "unsigned-cache");
	await t.test("key generation refuses to replace an existing signing directory", async () => {
		const original = await readFile(join(signing, "cache-test-1", "cache.secret"));
		rejected(await shell(commands.keygen, { LEAN_BRIDGE_CACHE_KEY_NAME: "replacement" }), /File exists/);
		assert.deepEqual(await readFile(join(signing, "cache-test-1", "cache.secret")), original);
	});
	await copyTo(unsigned);
	await t.test("unsigned closure is rejected by verification and fresh-store import", async () => {
		rejected(await verify(unsigned, publicKeys[0]), /untrusted/);
		rejected(await fetch(unsigned, publicKeys[0]), /signature/);
	});

	let signed;
	await t.test("the documented recursive signing and copy recipe preserves both signatures", async () => {
		const result = await shell(`${commands.sign}\nprintf '\\nCACHE=%s\\n' "$LEAN_BRIDGE_CACHE_DIR"`);
		assert.equal(result.code, 0, result.stderr);
		signed = result.stdout.match(/\nCACHE=(.+)\n/)[1];
		assert.ok(signed.startsWith(`${work}/build/nix-binary-cache.`));
		const signedInventory = JSON.parse(await readFile(join(records, "closure-signed.json"), "utf8"));
		for(const path of Object.values(paths))
			assert.ok(signedInventory[path].signatures.some(signature => signature.startsWith("cache-test-1:")));
	});
	assert.ok(signed, "the signing recipe must produce a cache before consumer checks");
	await t.test("consumer recipe downloads the full closure into its isolated store", async () => {
		const result = await fetch(signed, publicKeys[0]);
		assert.equal(result.code, 0, result.stderr);
		const fetched = result.stdout.match(/Verified fetched closure in (.+)\n/)[1];
		assert.ok(fetched.startsWith(`${environment.TMPDIR}/lean-bridge-nix-fetch.`));
		for(const path of Object.values(paths))
			assert.deepEqual(await readFile(join(fetched, path, "payload.txt")), await readFile(join(producer, path, "payload.txt")));
	});
	await t.test("an unrelated public key cannot verify or import the signed closure", async () => {
		rejected(await verify(signed, publicKeys[2]), /untrusted/);
		rejected(await fetch(signed, publicKeys[2]), /signature/);
	});
	await t.test("an unsigned dependency fails even when the package itself is signed", async () => {
		const partial = join(root, "unsigned-dependency");
		await cp(signed, partial, { recursive: true });
		const metadata = `${basename(paths.runtime).slice(0, 32)}.narinfo`;
		await cp(join(unsigned, metadata), join(partial, metadata));
		rejected(await verify(partial, publicKeys[0]), /untrusted/);
		rejected(await fetch(partial, publicKeys[0]), /signature/);
	});

	const corruptCache = async (name, mutate) => {
		const directory = join(root, name);
		await cp(signed, directory, { recursive: true });
		await mutate(directory);
		return directory;
	};
	const narinfo = path => `${basename(path).slice(0, 32)}.narinfo`;
	await t.test("changed signed references cannot be imported", async () => {
		const cache = await corruptCache("changed-references", async directory => {
			const file = join(directory, narinfo(paths.packages));
			const original = await readFile(file, "utf8");
			assert.match(original, /References: .+/);
			await writeFile(file, original.replace(/^References: .+$/m, "References: "));
		});
		rejected(await verify(cache, publicKeys[0]), /untrusted/);
		rejected(await fetch(cache, publicKeys[0]), /signature/);
	});
	await t.test("damaged NAR downloads fail verification and import", async () => {
		const cache = await corruptCache("damaged-nar", async directory => {
			const info = await readFile(join(directory, narinfo(paths.packages)), "utf8");
			const url = info.match(/^URL: (.+)$/m)[1];
			assert.match(url, /^nar\/[\w.-]+$/);
			await writeFile(join(directory, url), "corrupted archive");
		});
		rejected(await verify(cache, publicKeys[0]), /error|corrupt|decompress/i);
		rejected(await fetch(cache, publicKeys[0]), /error|corrupt|decompress/i);
	});
	await t.test("a valid archive with different contents fails its signed NAR hash", async () => {
		const cache = await corruptCache("wrong-nar-content", async directory => {
			const component = await readFile(join(directory, narinfo(paths.packages)), "utf8");
			const runtime = await readFile(join(directory, narinfo(paths.runtime)), "utf8");
			const componentUrl = component.match(/^URL: (.+)$/m)[1];
			const runtimeUrl = runtime.match(/^URL: (.+)$/m)[1];
			assert.match(componentUrl, /^nar\/[\w.-]+$/);
			assert.match(runtimeUrl, /^nar\/[\w.-]+$/);
			await cp(join(directory, runtimeUrl), join(directory, componentUrl));
		});
		rejected(await verify(cache, publicKeys[0]), /hash|modified|corrupt/i);
		rejected(await fetch(cache, publicKeys[0]), /hash|modified|corrupt/i);
	});
	await t.test("a missing runtime archive fails the whole closure", async () => {
		const cache = await corruptCache("missing-runtime", async directory => {
			const info = await readFile(join(directory, narinfo(paths.runtime)), "utf8");
			const url = info.match(/^URL: (.+)$/m)[1];
			assert.match(url, /^nar\/[\w.-]+$/);
			await rm(join(directory, url));
		});
		rejected(await verify(cache, publicKeys[0]), /error|does not exist|No such file/i);
		rejected(await fetch(cache, publicKeys[0]), /error|does not exist|No such file/i);
	});
	await t.test("key rotation requires fresh cache metadata; retained signatures support overlap", async () => {
		await success("nix", ["store", "sign", "--recursive", "--key-file", join(signing, "cache-test-2", "cache.secret"), paths.packages]);
		await copyTo(signed);
		rejected(await verify(signed, publicKeys[1]), /untrusted/);
		const rotated = join(root, "rotated-cache");
		await copyTo(rotated);
		for(const key of publicKeys.slice(0, 2))
		{
			const verified = await verify(rotated, key);
			assert.equal(verified.code, 0, verified.stderr);
			const fetched = await fetch(rotated, key);
			assert.equal(fetched.code, 0, fetched.stderr);
		}
		rejected(await verify(rotated, publicKeys[2]), /untrusted/);
		const old = await verify(signed, publicKeys[0]);
		assert.equal(old.code, 0, old.stderr);
	});
	await t.test("the endpoint audit and clean fetch recipes also work over loopback HTTP", async httpTest => {
		const requests = [];
		const server = createServer(async (request, response) => {
			try
			{
				const name = new URL(request.url, "http://localhost").pathname.slice(1);
				if(!/^(?:nix-cache-info|[0-9a-z]{32}\.narinfo|nar\/[\w.-]+)$/.test(name))
					throw new Error("Unsupported cache request");
				requests.push(name);
				response.end(await readFile(join(signed, name)));
			}
			catch
			{
				response.writeHead(404).end();
			}
		});
		httpTest.after(() => new Promise(done => {
			server.closeAllConnections();
			server.close(done);
		}));
		await new Promise((ready, reject) => {
			server.once("error", reject);
			server.listen(0, "127.0.0.1", ready);
		});
		const env = { LEAN_BRIDGE_CACHE_URL: `http://127.0.0.1:${server.address().port}` };
		const verified = await shell(commands.verify, env);
		assert.equal(verified.code, 0, verified.stderr);
		const fetched = await shell(commands.fetch, env);
		assert.equal(fetched.code, 0, fetched.stderr);
		assert.ok(requests.includes("nix-cache-info"));
		for(const path of Object.values(paths)) assert.ok(requests.includes(narinfo(path)));
		assert.equal(new Set(requests.filter(name => name.startsWith("nar/"))).size, 2);
		rejected(await shell(commands.fetch, { ...env, LEAN_BRIDGE_CACHE_PUBLIC_KEY: publicKeys[2] }), /signature/);
	});
	await t.test("public cache metadata and release records contain no private keys", async () => {
		const secrets = await Promise.all(["cache-test-1", "cache-test-2", "wrong-signer"].map(async name =>
			(await readFile(join(signing, name, "cache.secret"), "utf8")).trim().split(":")[1]));
		for(const directory of [signed, records, join(root, "rotated-cache")])
		{
			for(const name of await readdir(directory, { recursive: true }))
			{
				const file = join(directory, name);
				if(!(await stat(file)).isFile()) continue;
				assert.doesNotMatch(name, /\.secret$/);
				const bytes = await readFile(file);
				assert.ok(secrets.every(secret => !bytes.includes(secret)), "private signing bytes in public output");
			}
		}
	});
});
