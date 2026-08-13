import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { diagnostic, prompt } from "./contract.mjs";
import { analyzeLeanProject } from "../analyze/lean-project.mjs";
import { AnalysisOutputError, writeAnalysisOutput } from "../analyze/output.mjs";
import { evaluateAnalysisPolicy } from "../analyze/policy.mjs";
import { buildCanonicalProject, CanonicalBuildError } from "../build/canonical-build.mjs";
import {
	ReproducibilityGateError,
	runReproducibilityGate,
} from "../release/reproducibility-gate.mjs";
import { runComponentReproducibilityGate } from "../release/component-reproducibility-gate.mjs";
import {
	PublishManifestError,
	verifyPublishManifest,
	writePublishManifest,
} from "../release/publish-manifest.mjs";
import {
	CredentialBoundaryError,
	createEnvironmentCredentialProvider,
	createPublishCredentialBoundary,
} from "../release/credentials.mjs";
import {
	PublicationAttestationError,
	authorizePublication,
} from "../release/publication-attestation.mjs";
import {
	createRegistryTransactionPublisher,
	RegistryTransactionError,
} from "../release/registry-transaction.mjs";
import {
	ReleaseReceiptError,
	writeReleaseReceipt,
} from "../release/release-receipt.mjs";

const deferred = (command, node) => ({
	status: "blocked"
	, result: null
	, diagnostics: [diagnostic({
		code: `${command}-implementation-pending`
		, message: `${command} has a stable CLI contract, but its implementation is not complete`
		, hint: `Complete plan node ${node} before using this command.`
	})]
	, nextActions: []
});

const installedEngineRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const runSelectedReproducibilityGate = options =>
	resolve(options.projectRoot) === installedEngineRoot
		? runReproducibilityGate(options)
		: runComponentReproducibilityGate({ ...options, engineRoot: installedEngineRoot });

const portablePolicyPath = (project, path) => path === null
	? null
	: relative(project, path).replaceAll("\\", "/") || ".";

const policyDiagnostics = report => {
	if(report === null) return [];
	const source = report.policy.source === "builtin"
		? "built-in policy"
		: `policy ${report.policy.path}`;
	const summary = diagnostic({
		code: report.passed ? "analysis-policy-passed" : "analysis-policy-failed"
		, severity: report.passed ? "info" : "error"
		, message: `${source} ${report.policy.sha256} ${report.passed ? "passed" : "failed"}`
		, path: report.policy.path
		, hint: report.passed ? null : "Resolve the listed policy violations or select a reviewed policy."
	});
	return [
		summary
		, ...report.violations.map(item => diagnostic({
			code: item.code
			, severity: "error"
			, message: `${item.message}; expected ${item.expected}, actual ${item.actual}`
			, path: report.policy.path
			, hint: null
		}))
	];
};

const blockedBuildCodes = new Set([
	"build-tools-unavailable", "docker-unavailable", "nix-unavailable"
	, "cache-directory-unsupported"
	, "unknown-package-target"
	, "package-target-ineligible"
	, "component-binding-ir-required", "component-adapter-hints-required"
]);

const internalBuildCodes = new Set([
	"build-command-failed", "build-timeout", "build-output-limit"
	, "builder-image-drift"
	, "builder-definition-drift"
	, "builder-base-drift"
	, "builder-output-drift"
	, "component-engine-store-path-invalid"
	, "component-engine-cache-incomplete"
	, "component-engine-output-invalid"
	, "unpinned-builder-image", "unsupported-docker-mount-path"
]);

const publicBuildDiagnostic = error => internalBuildCodes.has(error.code)
	? diagnostic({
		code: error.code === "build-timeout" ? "package-build-timeout" : "package-build-failed"
		, message: error.code === "build-timeout"
			? "The package build exceeded its execution deadline"
			: "Lean Bridge could not build and validate the requested package"
		, hint: "Run lean-bridge analyze, resolve any reported source issues, and retry the same build command."
	})
	: diagnostic({ code: error.code, message: error.message, hint: error.hint });

/**
 * Composes analyze, build, publish, credential, attestation, and receipt dependencies into immutable command handlers.
 *
 * @param root0 - Named inputs and dependency overrides used to create CLI handlers.
 * @param root0.analyze - Injected analyzer used to inspect a project without coupling the caller to its implementation.
 * @param root0.build - Injected build implementation used to produce an isolated candidate from prepared sources.
 * @param root0.gate - Injected reproducibility gate used to compare independently produced artifacts.
 * @param root0.createPublishPlan - Factory used to create publish plan without hard-coding host dependencies.
 * @param root0.verifyPublishPlan - Injected verifier that authenticates and closes the publication plan before use.
 * @param root0.registryAdapters - Registry-specific publish and rollback adapters exposed to the CLI transaction layer.
 * @param root0.publisher - Injected registry transaction publisher used by the publish command handler.
 * @param root0.credentialProvider - Opaque provider that checks and reads authorized registry credentials inside the publication boundary.
 * @param root0.createCredentialBoundary - Factory used to create credential boundary without hard-coding host dependencies.
 * @param root0.attestationPolicy - Signer policy that constrains accepted identities, keys, and signature algorithms.
 * @param root0.attestationSigner - Opaque signer provider used to authorize a publication statement.
 * @param root0.authorizePublish - Injected authorization function that signs and verifies the publication statement.
 * @param root0.createReceipt - Factory used to create receipt without hard-coding host dependencies.
 */
export const createCliHandlers = ({
	analyze = analyzeLeanProject
	, build = buildCanonicalProject
	, gate = runSelectedReproducibilityGate
	, createPublishPlan = writePublishManifest
	, verifyPublishPlan = verifyPublishManifest
	, registryAdapters = null
	, publisher = registryAdapters === null ? null : createRegistryTransactionPublisher({ adapters: registryAdapters })
	, credentialProvider = createEnvironmentCredentialProvider()
	, createCredentialBoundary = createPublishCredentialBoundary
	, attestationPolicy = null
	, attestationSigner = null
	, authorizePublish = authorizePublication
	, createReceipt = writeReleaseReceipt
} = {}) => Object.freeze({
	analyze: async (request, { signal, emitProgress } = {}) => {
		emitProgress?.({ phase: "analyze", state: "started", message: "Inspecting Lean declarations and binding evidence" });
		signal?.throwIfAborted();
		const report = await analyze(request.project, { signal, targets: request.selection.targets });
		signal?.throwIfAborted();
		const requiredHints = report.adapterHints.filter(item => item.required);
		let policyReport = null;
		if(request.analysis.check)
		{
			emitProgress?.({ phase: "policy", state: "started", message: "Evaluating the analysis policy" });
			policyReport = evaluateAnalysisPolicy({
				analysis: report
				, policyRecord: request.analysis.policy
				, policyPath: portablePolicyPath(request.project, request.analysis.policy.path)
			});
			emitProgress?.({
				phase: "policy"
				, state: policyReport.passed ? "completed" : "failed"
				, message: policyReport.passed ? "Analysis policy passed" : "Analysis policy failed"
				, current: policyReport.violations.length
				, total: policyReport.violations.length
			});
		}
		let status = requiredHints.length > 0
			? "needs-input"
			: report.bindingIr === null
				? "blocked"
				: "ok";
		if(status === "ok" && policyReport !== null && !policyReport.passed) status = "failed";
		const diagnostics = [
			...report.diagnostics.map(item => diagnostic(item))
			, ...policyDiagnostics(policyReport)
		];
		if(request.output !== null)
		{
			emitProgress?.({ phase: "output", state: "started", message: "Writing the requested analysis output" });
			try
			{
				const output = await writeAnalysisOutput({
					outputRoot: request.output
					, analysis: report
					, policyReport
					, signal
				});
				diagnostics.push(diagnostic({
					code: "analysis-output-written"
					, severity: "info"
					, message: `Wrote ${output.files.join(", ")}`
					, path: output.directory
				}));
				emitProgress?.({
					phase: "output"
					, state: "completed"
					, message: "Analysis output written atomically"
					, current: output.files.length
					, total: output.files.length
				});
			} catch(error)
			{
				if(!(error instanceof AnalysisOutputError)) throw error;
				diagnostics.push(diagnostic({
					code: error.code
					, message: error.message
					, path: error.details.output ?? request.output
					, hint: "Choose a path that does not exist."
				}));
				emitProgress?.({ phase: "output", state: "blocked", message: "Analysis output was not written" });
				status = error.code === "analysis-output-exists" ? "blocked" : "failed";
			}
		}
		const analyzeState = status === "ok" ? "completed" : status === "failed" ? "failed" : "blocked";
		const analyzeMessage = status === "ok"
			? "Analysis produced a binding contract"
			: status === "failed"
				? "Analysis did not satisfy the selected policy"
				: "Analysis requires an explicit decision";
		emitProgress?.({
			phase: "analyze"
			, state: analyzeState
			, message: analyzeMessage
			, current: report.exportCandidates.length
			, total: report.exportCandidates.length
		});
		return {
			status
			, result: report
			, diagnostics
			, prompts: requiredHints.map(item => prompt({
				id: item.id
				, message: item.question
				, choices: item.choices
				, required: item.required
				, declaration: item.declaration
			}))
			, nextActions: requiredHints.map(item =>
				`${item.declaration === null ? "Project" : item.declaration}: ${item.question}`
			)
		};
	}
	, build: async (request, { signal, emitProgress } = {}) => {
		try
		{
			emitProgress?.({ phase: "build", state: "started", message: "Building the canonical artifact and package closure" });
			signal?.throwIfAborted();
			const result = await build({
				projectRoot: request.project
				, outputRoot: request.output
				, targets: request.selection.targets
				, cache: request.cache
				, signal
				, onProgress: emitProgress
			});
			signal?.throwIfAborted();
			emitProgress?.({ phase: "build", state: "completed", message: "Canonical build completed" });
			return { status: "ok", result, diagnostics: [], prompts: [], nextActions: [] };
		} catch(error)
		{
			if(!(error instanceof CanonicalBuildError)) throw error;
			return {
				status: blockedBuildCodes.has(error.code) ? "blocked" : "failed"
				, result: null
				, diagnostics: [publicBuildDiagnostic(error)]
				, prompts: []
				, nextActions: []
			};
		}
	}
	, publish: async (request, { signal, emitProgress } = {}) => {
		if(request.mode !== "dry-run")
		{
			if(request.manifest === null)
			{
				return {
					status: "blocked"
					, result: null
					, diagnostics: [diagnostic({
						code: "publish-manifest-required"
						, message: "publish requires the manifest produced by an authorized dry run"
						, hint: "Run publish --dry-run --output <gate>, then pass --manifest <gate>/publish-manifest.json."
					})]
					, prompts: []
					, nextActions: []
				};
			}
			if(request.output !== null || request.bundle !== null || request.authorization !== null)
			{
				return {
					status: "blocked"
					, result: null
					, diagnostics: [diagnostic({
						code: "publish-input-conflict"
						, message: "publish consumes one manifest and does not accept separate candidate or authorization paths"
						, hint: "Pass only --manifest and optional matching --target values."
					})]
					, prompts: []
					, nextActions: []
				};
			}
			let credentials = null;
			let publicationAttestation = null;
			let publisherInvoked = false;
			let publishedResult = null;
			try
			{
				emitProgress?.({ phase: "authorize", state: "started", message: "Verifying the publish manifest and exact release candidate" });
				signal?.throwIfAborted();
				const verified = await verifyPublishPlan({
					manifestPath: request.manifest
					, requestedTargets: request.selection.targets
					, signal
				});
				signal?.throwIfAborted();
				emitProgress?.({ phase: "authorize", state: "completed", message: "Publish manifest and release authorization verified" });
				if(publisher === null)
				{
					const pending = deferred("publish", 879);
					return {
						...pending,
						diagnostics: [diagnostic({
							code: "registry-publisher-unavailable"
							, message: "The authorized publication plan is valid, but no registry publisher is installed"
							, hint: "Complete plan node 879 to enable credential access and external registry writes."
						})]
						, result: {
							publishManifest: { path: verified.manifestPath, sha256: verified.manifestSha256 }
							, authorization: verified.authorization
							, targets: verified.manifest.targets.map(item => ({
								order: item.order
								, ecosystem: item.ecosystem
								, coordinate: item.coordinate
								, idempotencyKey: item.idempotencyKey
								, status: "pending"
							}))
							, externalRegistryWrites: false
						}
					};
				}
				credentials = createCredentialBoundary({ plan: verified.manifest, provider: credentialProvider });
				emitProgress?.({ phase: "credentials", state: "started", message: "Checking required registry credential names" });
				const credentialPreflight = await credentials.preflight();
				signal?.throwIfAborted();
				emitProgress?.({ phase: "credentials", state: "completed", message: "Registry credential requirements are available" });
				emitProgress?.({ phase: "attestation", state: "started", message: "Authorizing the exact publication closure" });
				publicationAttestation = await authorizePublish({
					verified
					, policy: attestationPolicy
					, signer: attestationSigner
				});
				signal?.throwIfAborted();
				emitProgress?.({ phase: "attestation", state: "completed", message: "Publication closure signature verified" });
				emitProgress?.({ phase: "publish", state: "started", message: "Executing the verified idempotent publication plan" });
				let result;
				try
				{
					const safePublisherProgress = event => {
						credentials.assertSafe(event);
						return emitProgress?.(event);
					};
					publisherInvoked = true;
					result = await publisher({
						plan: verified.manifest
						, manifestPath: verified.manifestPath
						, manifestSha256: verified.manifestSha256
						, authorization: verified.authorization
						, candidateRoot: verified.candidateRoot
						, credentials
						, credentialPreflight
						, attestation: publicationAttestation
						, signal
						, onProgress: safePublisherProgress
					});
				} catch(error)
				{
					credentials.assertSafe(error);
					if(error instanceof RegistryTransactionError) throw error;
					throw credentials.sanitize(error);
				}
				signal?.throwIfAborted();
				if(result === null || typeof result !== "object" || Array.isArray(result))
				{
					throw new CredentialBoundaryError("invalid-publisher-result", "Registry publisher must return one result object");
				}
				credentials.assertSafe(result);
				publishedResult = result;
				const credentialAudit = credentials.complete();
				let releaseReceipt = null;
				if(result.transaction?.status === "complete")
				{
					emitProgress?.({ phase: "receipt", state: "started", message: "Signing the completed registry result and consumer coordinates" });
					releaseReceipt = await createReceipt({
						verified
						, transactionResult: result
						, publicationAttestation
						, policy: attestationPolicy
						, signer: attestationSigner
						, signal
					});
					signal?.throwIfAborted();
					emitProgress?.({ phase: "receipt", state: "completed", message: "Content-addressed release receipt verified" });
				}
				const safeResult = {
					...result,
					...(releaseReceipt === null ? {} : { releaseReceipt }),
					credentialAudit
					, attestationAudit: publicationAttestation.audit
				};
				credentials.assertSafe(safeResult);
				emitProgress?.({ phase: "publish", state: "completed", message: "Publication plan completed" });
				return { status: "ok", result: safeResult, diagnostics: [], prompts: [], nextActions: [] };
			} catch(error)
			{
				if(
					!(error instanceof PublishManifestError)
          && !(error instanceof ReproducibilityGateError)
          && !(error instanceof CredentialBoundaryError)
          && !(error instanceof PublicationAttestationError)
          && !(error instanceof RegistryTransactionError)
          && !(error instanceof ReleaseReceiptError)
				) throw error;
				const blocked = new Set([
					"credential-provider-required"
					, "invalid-credential-provider"
					, "credential-provider-failed"
					, "invalid-credential-provider-value"
					, "publish-credentials-missing"
					, "publish-credentials-changed"
					, "verified-publication-required"
					, "publication-signer-required"
					, "publication-signer-policy-required"
					, "invalid-publication-signer"
					, "publication-signer-not-authorized"
					, "publication-signer-failed"
					, "publication-signature-invalid"
					, "publication-signature-threshold"
					, "invalid-publication-signer-key"
					, "unsupported-publication-signer"
					, "noncanonical-publication-signer-key"
					, "publication-signer-key-drift"
					, "invalid-publication-attestation"
					, "registry-adapter-unavailable"
					, "invalid-registry-adapters"
					, "registry-transaction-locked"
					, "registry-preflight-call-failed"
					, "registry-permission-denied"
					, "registry-immutability-unverified"
					, "registry-coordinate-collision"
					, "registry-dependency-unavailable"
					, "registry-dependency-order-invalid"
				]).has(error.code);
				if(credentials !== null && !blocked && !(error instanceof ReleaseReceiptError)) credentials.markFailed();
				const transactionResult = error instanceof RegistryTransactionError
					? error.details.result ?? null
					: publishedResult;
				return {
					status: blocked ? "blocked" : "failed"
					, result: credentials === null
						? transactionResult
						: {
							...(transactionResult ?? {}),
							credentialAudit: credentials.snapshot()
							, attestationAudit: publicationAttestation?.audit ?? null
							, externalRegistryWrites: transactionResult?.externalRegistryWrites ?? (publisherInvoked ? "unknown" : false)
						}
					, diagnostics: [diagnostic({ code: error.code, message: error.message })]
					, prompts: []
					, nextActions: []
				};
			} finally
			{
				credentials?.close();
			}
		}
		if(request.output === null || request.bundle !== null || request.authorization !== null || request.manifest !== null)
		{
			return {
				status: "blocked"
				, result: null
				, diagnostics: [diagnostic({
					code: "dry-run-input-required"
					, message: "publish --dry-run requires --output and builds its own release candidate"
					, hint: "Pass one empty --output path. Do not pass --manifest, --bundle, or --authorization."
				})]
				, prompts: []
				, nextActions: []
			};
		}
		try
		{
			emitProgress?.({ phase: "reproducibility", state: "started", message: "Building and comparing two isolated release candidates" });
			signal?.throwIfAborted();
			const result = await gate({
				projectRoot: request.project
				, outputRoot: request.output
				, targets: request.selection.targets
				, cache: request.cache
				, signal
				, onProgress: emitProgress
			});
			signal?.throwIfAborted();
			emitProgress?.({ phase: "reproducibility", state: "completed", message: "Release candidate is reproducible and authorized" });
			if(result.kind === "lean-bridge-component-reproducibility-gate")
			{
				return {
					status: "ok"
					, result
					, diagnostics: []
					, prompts: []
					, nextActions: []
				};
			}
			emitProgress?.({ phase: "plan", state: "started", message: "Deriving the immutable publication plan" });
			const plan = await createPublishPlan({
				gateRoot: request.output
				, requestedTargets: request.selection.targets
				, signal
			});
			signal?.throwIfAborted();
			emitProgress?.({ phase: "plan", state: "completed", message: "Publish manifest is ready for execute mode" });
			return {
				status: "ok"
				, result: {
					...result,
					publishManifest: plan.path
					, publishManifestSha256: plan.manifestSha256
					, plannedTargets: plan.manifest.targets.map(item => ({
						order: item.order
						, ecosystem: item.ecosystem
						, coordinate: item.coordinate
						, operation: item.operation
						, idempotencyKey: item.idempotencyKey
					}))
					, externalRegistryWrites: false
				}
				, diagnostics: []
				, prompts: []
				, nextActions: []
			};
		} catch(error)
		{
			if(!(error instanceof ReproducibilityGateError) && !(error instanceof PublishManifestError)) throw error;
			const blocked = new Set([
				"source-not-git"
				, "source-tree-dirty"
				, "build-tools-unavailable"
				, "docker-unavailable"
				, "nix-unavailable"
				, "reproducibility-cache-directory-unsupported"
				, "cache-directory-unsupported"
				, "unknown-package-target", "package-target-ineligible"
				, "component-binding-ir-required", "component-adapter-hints-required"
				, "no-publishable-targets"
				, "unsupported-publication-target"
				, "unknown-publication-target"
			]).has(error.code);
			return {
				status: blocked ? "blocked" : "failed"
				, result: error.details?.report ? {
					gateOutput: error.details.output
					, report: error.details.report
					, externalRegistryWrites: false
				} : null
				, diagnostics: [publicBuildDiagnostic(error)]
				, prompts: []
				, nextActions: []
			};
		}
	}
});

export const cliHandlers = createCliHandlers();
