/**
 * Public publication configuration and an execution-only Ed25519 signer.
 *
 * @file
 */
import { createPrivateKey, createPublicKey, sign } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { PublicationAttestationError, validatePublicationSignerPolicy } from "./publication-attestation.mjs";

const fail = message => { throw new PublicationAttestationError("invalid-publish-configuration", message); };
const keys = (value, expected) => {
	if(!value || typeof value !== "object" || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) fail("Publication configuration fields must be closed");
};

/**
 * Validates public settings without reading credentials or key files.
 *
 * @param config - Closed public npm and signing configuration.
 */
export const validatePublishConfiguration = config => {
	keys(config, ["npm", "signing"]);
	keys(config.npm, ["registry", "tag", "access", "authMode"]);
	keys(config.signing, ["policyFile", "keyFileEnvironment"]);
	let url;
	try
	{ url = new URL(config.npm.registry); } catch
	{ fail("npm registry must be an absolute URL"); }
	if(!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) fail("npm registry must not contain credentials, a query, or a fragment");
	if(url.protocol === "http:" && !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) fail("HTTP npm registries are restricted to local rehearsals");
	if(typeof config.npm.tag !== "string" || !/^[A-Za-z][A-Za-z0-9._-]*$/.test(config.npm.tag) || !["public", "restricted"].includes(config.npm.access) || !["token", "oidc"].includes(config.npm.authMode)) fail("Invalid npm tag, access, or authentication mode");
	if(config.npm.authMode === "oidc" && url.href !== "https://registry.npmjs.org/") fail("OIDC publishing requires the public npm registry");
	if(typeof config.signing.policyFile !== "string" || !config.signing.policyFile || !/^[A-Z][A-Z0-9_]*$/.test(config.signing.keyFileEnvironment)) fail("Signing requires a public policy file and a key-file environment reference");
	return true;
};

/**
 * Reads the public signer policy; safe to call during a credential-free dry run.
 *
 * @param config - Closed public npm and signing configuration.
 * @param directory - Directory against which the public policy path is resolved.
 */
export const readPublishConfiguration = async (config, directory) => {
	if(config === null || config === undefined) return null;
	validatePublishConfiguration(config);
	let policy;
	try
	{
		policy = JSON.parse(await readFile(resolve(directory, config.signing.policyFile), "utf8"));
	} catch
	{
		fail("The configured public signer policy could not be read as JSON");
	}
	validatePublicationSignerPolicy(policy);
	return Object.freeze({
		options: Object.freeze({ ...config.npm, registry: new URL(config.npm.registry).href, signerPolicySha256: sha256(canonicalJson(policy)) })
		, policy, keyFileEnvironment: config.signing.keyFileEnvironment
	});
};

/**
 * Reads a caller-selected key only after manifest and publication checks succeed.
 *
 * @param root0 - Signer policy and execution-only key-file lookup inputs.
 * @param root0.policy - Public policy identifying accepted Ed25519 signing keys.
 * @param root0.keyFileEnvironment - Name of the environment variable containing the private key path.
 * @param root0.environment - Execution environment used only when opening the signing key.
 */
export const createKeyFileSigner = async ({ policy, keyFileEnvironment, environment = process.env }) => {
	validatePublicationSignerPolicy(policy);
	const path = environment[keyFileEnvironment];
	if(typeof path !== "string" || !path) throw new PublicationAttestationError("publication-signer-required", `Set ${keyFileEnvironment} to the signing key file`);
	let handle;
	let bytes;
	let key;
	try
	{
		handle = await open(resolve(path), constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
		const metadata = await handle.stat();
		if(!metadata.isFile() || metadata.size > 16_384 || (process.platform !== "win32" && (metadata.mode & 0o077))) fail("Signing keys must be small regular files accessible only to their owner");
		bytes = await handle.readFile();
		key = createPrivateKey(bytes);
		if(key.asymmetricKeyType !== "ed25519") fail("Publication requires an Ed25519 private key");
	} catch(error)
	{
		if(error instanceof PublicationAttestationError) throw error;
		throw new PublicationAttestationError("publication-signer-required", "The configured signing key could not be loaded");
	} finally
	{
		bytes?.fill(0);
		await handle?.close();
	}
	const keyId = sha256(createPublicKey(key).export({ type: "spki", format: "der" }));
	if(!policy.signers.some(item => item.keyId === keyId)) throw new PublicationAttestationError("publication-signer-not-authorized", "Signing key is outside the public signer policy");
	return Object.freeze({ kind: "ed25519-key-file", keyId, sign: payload => sign(null, payload, key) });
};
