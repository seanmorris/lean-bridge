#!/usr/bin/env node
/**
 * Rehearses an installed CLI publication against a disposable loopback Verdaccio.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";

const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const name = process.argv[index];
	const value = process.argv[index + 1];
	assert.ok(["--candidate", "--output", "--verdaccio", "--backend", "--browsers"].includes(name) && !options.has(name) && value && !value.startsWith("--"), "Unknown, duplicate, or incomplete rehearsal option");
	options.set(name, value);
}
assert.ok(options.has("--candidate") && options.has("--output"), "Supply --candidate and a new --output directory");
const verdaccio = resolve(options.get("--verdaccio") ?? "build/release-hardening-tools/node_modules/.bin/verdaccio");
const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-registry-"));
const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const port = reservation.address().port;
await new Promise(resolveClose => reservation.close(resolveClose));
const registry = `http://127.0.0.1:${port}/`;
const config = join(scratch, "config.yaml");
await mkdir(join(scratch, "storage"));
await writeFile(config, `storage: ${join(scratch, "storage")}\nauth:\n  htpasswd:\n    file: ${join(scratch, "htpasswd")}\n    max_users: 10\nuplinks: {}\npackages:\n  '**':\n    access: $all\n    publish: $authenticated\n    unpublish: $authenticated\nlog: { type: stdout, format: json, level: fatal }\n`);
const server = spawn(verdaccio, ["--config", config, "--listen", `127.0.0.1:${port}`], { stdio: ["ignore", "pipe", "pipe"] });
let serverError;
server.on("error", error => { serverError = error; });
let logs = "";
server.stdout.on("data", data => { logs += data; });
server.stderr.on("data", data => { logs += data; });
try
{
	let ready = false;
	for(let attempt = 0; attempt < 100; attempt += 1)
	{
		try
		{ ready = (await fetch(`${registry}-/ping`)).ok; } catch { /* Wait for the local listener. */ }
		if(ready) break;
		if(serverError) throw new Error("The configured Verdaccio executable could not start");
		if(server.exitCode !== null) throw new Error(`Local registry exited: ${logs}`);
		await setTimeout(100);
	}
	assert.ok(ready, "Local registry did not start");
	const response = await fetch(`${registry}-/user/org.couchdb.user:rehearsal`, {
		method: "PUT", headers: { "content-type": "application/json" }
		, body: JSON.stringify({ name: "rehearsal", password: "local-disposable-registry-only", email: "rehearsal@example.invalid", type: "user", roles: [] })
	});
	assert.ok(response.ok, "Local registry account creation failed");
	const { token } = await response.json();
	const child = spawn(process.execPath, [resolve("scripts/check-cli-package.mjs"), "--candidate", resolve(options.get("--candidate")), "--output", resolve(options.get("--output")), "--registry", registry, "--backend", options.get("--backend") ?? "docker"], {
		stdio: "inherit", env: { ...process.env, LEAN_BRIDGE_REHEARSAL_TOKEN: token }
	});
	const [code] = await once(child, "exit");
	assert.equal(code, 0, "Installed CLI registry rehearsal failed");
	const browser = spawn(process.execPath, [resolve("scripts/check-component-browser-consumer.mjs")
		, "--release"
		, join(resolve(options.get("--output")), "gate/release/packages/npm")
		, "--output", join(resolve(options.get("--output")), "browser")
		, "--registry", registry
		, "--browsers"
		, options.get("--browsers") ?? process.env.LEAN_BRIDGE_DOCUMENTATION_BROWSERS ?? "chromium"
	], { stdio: "inherit" });
	const [browserCode] = await once(browser, "exit");
	assert.equal(browserCode, 0, "Registry-installed browser consumer failed");
} finally
{
	if(server.exitCode === null && !serverError)
	{ server.kill("SIGTERM"); await once(server, "exit"); }
	await rm(scratch, { recursive: true, force: true });
}
