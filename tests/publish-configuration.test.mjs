/**
 * Tests credential-free configuration and execution-only Ed25519 key loading.
 *
 * @file
 */
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createPublicationSignerPolicy } from "../src/release/publication-attestation.mjs";
import { createKeyFileSigner, readPublishConfiguration, validatePublishConfiguration } from "../src/release/publish-configuration.mjs";
import { parseCliArguments } from "../src/cli/contract.mjs";

test("dry-run configuration binds public policy without opening the private key", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-signing-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { publicKey, privateKey } = generateKeyPairSync("ed25519");
	const policy = createPublicationSignerPolicy({ identity: "test-author", publicKeyPem: publicKey.export({ format: "pem", type: "spki" }).toString() });
	await writeFile(join(root, "policy.json"), JSON.stringify(policy));
	const config = {
		npm: { registry: "https://registry.npmjs.org/", tag: "next", access: "public", authMode: "token" }
		, signing: { policyFile: "policy.json", keyFileEnvironment: "AUTHOR_PRIVATE_KEY_FILE" }
	};
	const prepared = await readPublishConfiguration(config, root);
	assert.throws(() => validatePublishConfiguration({ ...config, npm: { ...config.npm, tag: true } }), { code: "invalid-publish-configuration" });
	await assert.rejects(readPublishConfiguration({ ...config, signing: { ...config.signing, policyFile: "missing.json" } }, root), { code: "invalid-publish-configuration" });
	assert.deepEqual(prepared.policy, policy);
	assert.doesNotMatch(JSON.stringify(prepared), /PRIVATE KEY/);
	await assert.rejects(createKeyFileSigner({ ...prepared, environment: {} }), { code: "publication-signer-required" });
	const path = join(root, "private.pem");
	await writeFile(path, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
	const signer = await createKeyFileSigner({ ...prepared, environment: { AUTHOR_PRIVATE_KEY_FILE: path } });
	const payload = Buffer.from("publication statement");
	assert.ok(verify(null, payload, publicKey, await signer.sign(payload)));
	await chmod(path, 0o644);
	await assert.rejects(createKeyFileSigner({ ...prepared, environment: { AUTHOR_PRIVATE_KEY_FILE: path } }), /only to their owner/);
	await chmod(path, 0o600);
	const alias = join(root, "alias.pem");
	await symlink(path, alias);
	await assert.rejects(createKeyFileSigner({ ...prepared, environment: { AUTHOR_PRIVATE_KEY_FILE: alias } }), { code: "publication-signer-required" });
	await writeFile(join(root, "lean-bridge.cli.json"), JSON.stringify({ schemaVersion: 2, publish: config }));
	assert.deepEqual(parseCliArguments(["publish", "--dry-run", "--output", "gate"], { cwd: root, environment: {} }).publication.config, config);
	for(const registry of ["https://name:SECRET@registry.npmjs.org/", "http://example.invalid/", "https://example.invalid/?token=SECRET"])
		assert.throws(() => validatePublishConfiguration({ ...config, npm: { ...config.npm, registry } }));
});
