/**
 * Implements the npm registry adapter used by the durable release transaction.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const productionRegistry = "https://registry.npmjs.org/";
const sandboxRegistry = "http://127.0.0.1:4873/";
const digest = value => createHash("sha256").update(value).digest("hex");

/** Reports fail-closed npm adapter errors with stable transaction-safe codes. */
export class NpmRegistryAdapterError extends Error
{
	/**
	 * Initializes an npm registry adapter failure.
	 *
	 * @param code - Stable machine-readable error code.
	 * @param message - Human-readable failure explanation.
	 * @param details - Non-secret diagnostic context.
	 */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "NpmRegistryAdapterError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details = {}) => {
	throw new NpmRegistryAdapterError(code, message, details);
};

const normalizedRegistry = value => {
	let url;
	try
	{
		url = new URL(value);
	} catch
	{
		fail("invalid-npm-registry", "The npm registry must be an absolute HTTP or HTTPS URL");
	}
	if(!new Set(["http:", "https:"]).has(url.protocol) || url.username !== "" || url.password !== "")
	{
		fail("invalid-npm-registry", "The npm registry URL cannot contain credentials or use a non-HTTP protocol");
	}
	url.hash = "";
	url.search = "";
	if(!url.pathname.endsWith("/")) url.pathname += "/";
	return url.toString();
};

const npmrcKey = registry => {
	const url = new URL(registry);
	return `//${url.host}${url.pathname}:_authToken`;
};

const withNpmCredential = async ({ registry, token, operation }) => {
	if(token !== undefined && token !== null && (typeof token !== "string" || /[\r\n]|\$\{/.test(token))) fail("invalid-npm-token", "npm token contains configuration syntax");
	const root = await mkdtemp(`${tmpdir()}${sep}lean-bridge-npm-`);
	const userconfig = resolve(root, "npmrc");
	const globalconfig = resolve(root, "global-npmrc");
	try
	{
		await writeFile(userconfig, token ? `${npmrcKey(registry)}=${token}\n` : "", { mode: 0o600, flag: "wx" });
		await writeFile(globalconfig, "", { mode: 0o600, flag: "wx" });
		return await operation({ root, userconfig, globalconfig });
	} finally
	{
		await rm(root, { recursive: true, force: true });
	}
};

const npmCommand = async ({ arguments_: commandArguments, registry, token, signal, coordinate = "", authMode = "token", oidcEnvironment = {} }) => withNpmCredential({
	registry
	, token
	, operation: ({ root, userconfig, globalconfig }) => run("npm", [
		...commandArguments
		, "--registry", registry
		, ...(coordinate.startsWith("@") ? [`--${coordinate.split("/")[0]}:registry=${registry}`] : [])
		, "--userconfig", userconfig
		, "--globalconfig", globalconfig
		, "--cache", resolve(root, "cache")
		, "--loglevel", "error"
	], {
		cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024, signal
		, env: { ...Object.fromEntries(Object.entries(process.env).filter(([name]) =>
			new Set(["PATH", "SystemRoot", "WINDIR", "ComSpec", "PATHEXT", "TEMP", "TMP", "LANG", "LC_ALL", "TZ", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE"]).has(name)
			|| (authMode === "oidc" && /^GITHUB_[A-Z_]+$/.test(name)),
		)), ...(authMode === "oidc" ? oidcEnvironment : {}) }
	})
});

const notFound = error => error?.code === 1 && /(?:E404|404 Not Found)/u.test(`${error.stderr ?? ""}\n${error.stdout ?? ""}`);

const versionAtLeast = (actual, minimum) => {
	if(!/^\d+\.\d+\.\d+$/.test(actual)) return false;
	const values = actual.split(".").map(Number);
	for(let index = 0; index < minimum.length; index += 1)
	{
		if(values[index] !== minimum[index]) return values[index] > minimum[index];
	}
	return true;
};

/**
 * Creates the real npm CLI and registry HTTP client used by the adapter.
 *
 * @param root0 - Dependency overrides for npm execution and tarball retrieval.
 * @param root0.fetch_ - Fetch implementation used to retrieve immutable registry tarballs.
 */
export const createNpmCliRegistryClient = ({ fetch_ = globalThis.fetch } = {}) => Object.freeze({
	trustedPublisher: async ({ registry, signal }) => {
		if(registry !== productionRegistry || !versionAtLeast(process.versions.node, [22, 14, 0])) fail("npm-oidc-version-required", "Trusted publishing requires Node 22.14.0 or newer and npm 11.5.1 or newer");
		const { stdout } = await npmCommand({ arguments_: ["--version"], registry, signal });
		if(!versionAtLeast(stdout.trim(), [11, 5, 1])) fail("npm-oidc-version-required", "Trusted publishing requires npm 11.5.1 or newer");
		return "deferred-to-publish";
	}
	, inspect:
		/**
		 * Resolves a coordinate and hashes the registry's exact tarball bytes.
		 *
		 * @param root0 - Registry inspection request.
		 * @param root0.coordinate - Exact package coordinate.
		 * @param root0.registry - Registry endpoint.
		 * @param root0.token - Transient npm credential.
		 * @param root0.signal - Abort signal.
		 */
		async function({ coordinate, registry, token, signal }) {
			let stdout;
			try
			{
				({ stdout } = await npmCommand({
					arguments_: ["view", coordinate, "dist.tarball", "--json"]
					, coordinate
					, registry
					, token
					, signal
				}));
			} catch(error)
			{
				if(notFound(error)) return Object.freeze({ status: "available" });
				fail("npm-registry-inspection-failed", `npm could not inspect ${coordinate}`);
			}
			let tarball;
			try
			{
				tarball = JSON.parse(stdout);
			} catch
			{
				fail("npm-registry-response-invalid", `npm returned invalid metadata for ${coordinate}`);
			}
			if(typeof tarball !== "string" || tarball === "")
			{
				fail("npm-registry-response-invalid", `npm did not return a tarball URL for ${coordinate}`);
			}
			const tarballUrl = new URL(tarball);
			const registryUrl = new URL(registry);
			if(tarballUrl.username || tarballUrl.password || !["http:", "https:"].includes(tarballUrl.protocol)
				|| (registryUrl.protocol === "https:" && tarballUrl.protocol !== "https:")) fail("npm-registry-response-invalid", "Registry returned an unsafe tarball URL");
			const headers = token && tarballUrl.origin === registryUrl.origin && tarballUrl.pathname.startsWith(registryUrl.pathname)
				? { authorization: `Bearer ${token}` }
				: {};
			const response = await fetch_(tarball, { headers, signal });
			if(!response.ok) fail("npm-tarball-fetch-failed", `npm tarball retrieval failed for ${coordinate}`, { status: response.status });
			const bytes = Buffer.from(await response.arrayBuffer());
			return Object.freeze({
				status: "published"
				, registryReference: tarball
				, archiveSha256: digest(bytes)
			});
		}
	, permission:
		/**
		 * Verifies that npm accepts the credential before the transaction can write.
		 *
		 * @param root0 - Permission inspection request.
		 * @param root0.registry - Registry endpoint.
		 * @param root0.token - Transient npm credential.
		 * @param root0.signal - Abort signal.
		 */
		async function({ registry, token, signal }) {
			try
			{
				const { stdout } = await npmCommand({ arguments_: ["whoami"], registry, token, signal });
				return stdout.trim() === "" ? "denied" : "granted";
			} catch
			{
				return "denied";
			}
		}
	, publish:
		/**
		 * Publishes one already-hashed tarball with lifecycle scripts disabled.
		 *
		 * @param root0 - Npm publication request.
		 * @param root0.archivePath - Absolute tarball path.
		 * @param root0.registry - Registry endpoint.
		 * @param root0.token - Transient npm credential.
		 * @param root0.signal - Abort signal.
		 * @param root0.coordinate - Exact package coordinate authorized by the publication manifest.
		 * @param root0.tag - Distribution tag explicitly selected in the dry run.
		 * @param root0.access - Public or restricted package access selected in the dry run.
		 * @param root0.authMode - Explicit token or GitHub OIDC authentication mode.
		 * @param root0.oidcEnvironment - OIDC request URL and token obtained through the credential boundary.
		 */
		async function({ archivePath, registry, token, signal, coordinate, tag = "next", access = "public", authMode = "token", oidcEnvironment }) {
			try
			{
				await npmCommand({
					arguments_: ["publish", archivePath, "--ignore-scripts", "--tag", tag, "--access", access]
					, coordinate, authMode, oidcEnvironment
					, registry
					, token
					, signal
				});
			} catch
			{
				fail("npm-publication-failed", "npm publish failed before a matching registry result was confirmed");
			}
		}
});

const archivePathFor = (candidateRoot, archive) => {
	if(typeof archive.path !== "string" || archive.path === "" || archive.path.startsWith("/") || archive.path.includes("\\"))
	{
		fail("invalid-npm-archive-path", "The npm publish archive must have a portable relative path");
	}
	const root = resolve(candidateRoot);
	const path = archive.path.startsWith("release/")
		? resolve(dirname(root), archive.path)
		: resolve(root, archive.path);
	const child = relative(root, path);
	if(child === "" || child === ".." || child.startsWith(`..${sep}`) || resolve(root, child) !== path)
	{
		fail("invalid-npm-archive-path", "The npm publish archive must remain inside the verified candidate root");
	}
	return path;
};

const expectedArchive = target => {
	if(!Array.isArray(target.archives) || target.archives.length !== 1)
	{
		fail("invalid-npm-archive-set", "npm publication requires exactly one authorized tarball");
	}
	return target.archives[0];
};

const resultArtifacts = target => target.archives.map(archive => ({ sha256: archive.sha256 }));

/**
 * Creates the npm adapter consumed by the durable multi-registry transaction coordinator.
 *
 * @param root0 - Npm registry adapter policy and dependency overrides.
 * @param root0.mode - Sandbox or production publication policy.
 * @param root0.registry - Npm registry endpoint.
 * @param root0.productionOptIn - Exact phrase required to authorize production writes.
 * @param root0.client - Npm registry client implementation.
 */
export const createNpmRegistryAdapter = ({
	mode = "sandbox"
	, registry = mode === "sandbox" ? sandboxRegistry : productionRegistry
	, productionOptIn = null
	, client = createNpmCliRegistryClient()
} = {}) => {
	if(!new Set(["sandbox", "production"]).has(mode)) fail("invalid-npm-registry-mode", "npm adapter mode must be sandbox or production");
	const endpoint = normalizedRegistry(registry);
	if(mode === "sandbox" && endpoint === productionRegistry)
	{
		fail("npm-sandbox-registry-required", "Sandbox mode cannot target the production npm registry");
	}
	if(client === null || typeof client.inspect !== "function" || typeof client.permission !== "function" || typeof client.publish !== "function")
	{
		fail("invalid-npm-registry-client", "The npm registry client must implement inspect, permission, and publish");
	}

	const authentication = (target, credentials) => {
		if(target.destination && normalizedRegistry(target.destination.endpoint) !== endpoint) fail("npm-destination-drift", "npm adapter differs from the authorized registry");
		const authMode = target.destination?.authMode ?? "token";
		if(authMode === "token") return { token: credentials.get("NPM_TOKEN"), authMode };
		if(authMode !== "oidc" || endpoint !== productionRegistry) fail("invalid-npm-authentication", "Unsupported npm authentication mode or registry");
		return { authMode, oidcEnvironment: Object.fromEntries(["ACTIONS_ID_TOKEN_REQUEST_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_URL"].map(name => [name, credentials.get(name)])) };
	};
	const inspect = async ({ target, credentials, signal }) => {
		const archive = expectedArchive(target);
		const { token, authMode } = authentication(target, credentials);
		if(authMode === "oidc" && typeof client.trustedPublisher !== "function") fail("npm-oidc-unavailable", "npm client cannot validate trusted-publisher prerequisites");
		const [permission, remote, dependencies] = await Promise.all([
			authMode === "oidc" ? client.trustedPublisher({ registry: endpoint, signal }) : client.permission({ registry: endpoint, token, signal })
			, client.inspect({ coordinate: target.coordinate, registry: endpoint, token, signal })
			, Promise.all((target.dependencies ?? []).map(async dependency => {
				const result = await client.inspect({ coordinate: dependency.coordinate, registry: endpoint, token, signal });
				return { coordinate: dependency.coordinate, status: result?.status === "published" && result.archiveSha256 === dependency.sha256 ? "available" : "unavailable" };
			}))
		]);
		if(!(authMode === "oidc" ? ["deferred-to-publish"] : ["granted", "denied"]).includes(permission)) fail("invalid-npm-permission-result", "npm permission result is invalid");
		if(remote?.status === "available")
		{
			return {
				permission
				, coordinateState: "available"
				, immutable: true
				, registryReference: null
				, artifacts: []
				, dependencies
			};
		}
		if(remote?.status !== "published" || typeof remote.registryReference !== "string" || !/^[0-9a-f]{64}$/.test(remote.archiveSha256))
		{
			fail("invalid-npm-inspection-result", "npm registry inspection returned an invalid result");
		}
		const matching = remote.archiveSha256 === archive.sha256;
		return {
			permission
			, coordinateState: matching ? "matching" : "collision"
			, immutable: true
			, registryReference: remote.registryReference
			, artifacts: matching ? resultArtifacts(target) : []
			, dependencies
		};
	};

	return Object.freeze({
		ecosystem: "npm"
		, kind: `npm-cli-v1-${mode}`
		, registry: endpoint
		, preflight: inspect
		, publish:
			/**
			 * Verifies local bytes, performs the explicitly authorized write, and confirms remote bytes.
			 *
			 * @param root0 - Registry transaction publication request.
			 * @param root0.target - Authorized npm target.
			 * @param root0.candidateRoot - Verified release candidate root.
			 * @param root0.credentials - Bounded credential view.
			 * @param root0.signal - Abort signal.
			 */
			async function({ target, candidateRoot, credentials, signal }) {
				if(mode === "production" && productionOptIn !== "publish-to-production")
				{
					fail("npm-production-opt-in-required", "Production npm publication requires the exact publish-to-production opt-in");
				}
				const archive = expectedArchive(target);
				const archivePath = archivePathFor(candidateRoot, archive);
				let bytes;
				try
				{
					bytes = await readFile(archivePath);
				} catch
				{
					fail("npm-archive-unavailable", "The authorized npm tarball is unavailable inside the candidate root", { path: archive.path });
				}
				if(digest(bytes) !== archive.sha256)
				{
					fail("npm-archive-hash-drift", "The npm tarball bytes differ from the authorized SHA-256", { path: archive.path });
				}
				const auth = authentication(target, credentials);
				const { token } = auth;
				await client.publish({ archivePath, registry: endpoint, ...auth, signal, coordinate: target.coordinate, tag: target.destination?.tag ?? "latest", access: target.destination?.access ?? "public" });
				const remote = await client.inspect({ coordinate: target.coordinate, registry: endpoint, token, signal });
				if(remote?.status !== "published" || remote.archiveSha256 !== archive.sha256)
				{
					fail("npm-publication-unconfirmed", "npm publication did not produce the authorized registry tarball hash");
				}
				return {
					status: "published"
					, registryReference: remote.registryReference
					, artifacts: resultArtifacts(target)
					, externalWrite: true
					, failure: null
				};
			}
	});
};
