#!/usr/bin/env node
/**
 * Creates a public signer policy from an Ed25519 public key, without loading a private key.
 *
 * @file
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { createPublicationSignerPolicy, publicationSignerPolicySha256 } from "../src/release/publication-attestation.mjs";

const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const name = process.argv[index];
	const value = process.argv[index + 1];
	if(!["--identity", "--public-key", "--output"].includes(name) || options.has(name) || !value || value.startsWith("--"))
		throw new Error("Usage: lean-bridge-signing-policy --identity AUTHOR --public-key PUBLIC_PEM --output NEW_POLICY_JSON");
	options.set(name, value);
}
if(options.size !== 3) throw new Error("Supply --identity, --public-key, and --output");
const publicKeyPem = await readFile(resolve(options.get("--public-key")), "utf8");
if(!publicKeyPem.trimStart().startsWith("-----BEGIN PUBLIC KEY-----")) throw new Error("Supply an SPKI public key, not a private key");
const policy = createPublicationSignerPolicy({ identity: options.get("--identity"), publicKeyPem });
const output = resolve(options.get("--output"));
await writeFile(output, canonicalJson(policy), { flag: "wx" });
process.stdout.write(`${JSON.stringify({ output, policySha256: publicationSignerPolicySha256(policy), keyId: policy.signers[0].keyId })}\n`);
