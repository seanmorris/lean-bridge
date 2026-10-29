/**
 * Reconstruct the extractor that preceded top-level Fin refinement support.
 * Historical package receipts stay immutable while current-source regressions
 * can prove that this isolated admission did not rewrite their implementation.
 *
 * @file
 */
// Type-surface history checks enumerate this original archive through dynamic
// file paths rather than a literal path in their executable source closure.
// core-evidence-prefix: reviewed-fin-
// core-evidence-prefix: python-refinements-
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { beforeDirectProofErasureCompleteEntrypointsSource, directProofErasureCompleteEntrypointsNormalizationPaths } from "./direct-proof-erasure-complete-entrypoints-source-history.mjs";
import { beforeDependentSignatureFocusedArchiveSource, dependentSignatureFocusedArchiveNormalizationPaths } from "./dependent-signature-focused-archive-source-history.mjs";
import { beforeFocusedAcceptanceSparseCheckoutSource, focusedAcceptanceSparseCheckoutNormalizationPaths } from "./focused-acceptance-sparse-checkout-source-history.mjs";
import { beforeCompleteAcceptanceBudgetSource, completeAcceptanceBudgetNormalizationPaths } from "./complete-acceptance-budget-source-history.mjs";
import { beforeDependentSignatureProducerSparseCheckoutSource, dependentSignatureProducerSparseCheckoutNormalizationPaths } from "./dependent-signature-producer-sparse-checkout-source-history.mjs";
import { beforeProofErasureCoreLintRepairSource, proofErasureCoreLintRepairNormalizationPaths } from "./proof-erasure-core-lint-repair-source-history.mjs";
import { beforeDependentSignatureProducerConcurrencySource, dependentSignatureProducerConcurrencyNormalizationPaths } from "./dependent-signature-producer-concurrency-source-history.mjs";
import { beforeDependentSignatureAuditSparseCheckoutSource, dependentSignatureAuditSparseCheckoutNormalizationPaths } from "./dependent-signature-audit-sparse-checkout-source-history.mjs";
import { beforeDependentSignatureShallowCheckoutSource, dependentSignatureShallowCheckoutNormalizationPaths } from "./dependent-signature-shallow-checkout-source-history.mjs";
import { beforeOptionalParameterCompletePromotionSource, optionalParameterCompletePromotionNormalizationPaths } from "./optional-parameter-complete-promotion-source-history.mjs";
import { beforeOptionalParameterReceiptSparseCheckoutSource, optionalParameterReceiptSparseCheckoutNormalizationPaths } from "./optional-parameter-receipt-sparse-checkout-source-history.mjs";
import { beforeOptionalParameterRouteBinderRepairSource, optionalParameterRouteBinderRepairNormalizationPaths } from "./optional-parameter-route-binder-repair-source-history.mjs";
import { beforeOptionalParameterPerlUnicodeDefaultRepairSource, optionalParameterPerlUnicodeDefaultRepairNormalizationPaths } from "./optional-parameter-perl-unicode-default-repair-source-history.mjs";
import { beforeOptionalParameterInstalledAcceptanceRepairSource, optionalParameterInstalledAcceptanceRepairNormalizationPaths } from "./optional-parameter-installed-acceptance-repair-source-history.mjs";
import { beforeNpmRuntimeModuleGraphClosureSource, npmRuntimeModuleGraphClosureNormalizationPaths } from "./npm-runtime-module-graph-closure-source-history.mjs";
import { beforeOptionalParameterNativeEvidenceRepairSource, optionalParameterNativeEvidenceRepairNormalizationPaths } from "./optional-parameter-native-evidence-repair-source-history.mjs";
import { beforeHostNullFocusedArchiveInputSource, hostNullFocusedArchiveInputNormalizationPaths } from "./host-null-focused-archive-input-source-history.mjs";
import { beforeHostNullFocusedCiSource, hostNullFocusedCiNormalizationPaths } from "./host-null-focused-ci-source-history.mjs";
import { beforeCoreCurrentSourcePinRepairSource, coreCurrentSourcePinRepairNormalizationPaths } from "./core-current-source-pin-repair-source-history.mjs";
import { beforeFocusedTypeSurfaceProducerRepairSource, focusedTypeSurfaceProducerRepairNormalizationPaths } from "./focused-type-surface-producer-repair-source-history.mjs";
import { beforeDependentSignatureFocusedCiSource, dependentSignatureFocusedCiNormalizationPaths } from "./dependent-signature-focused-ci-source-history.mjs";
import { beforeDirectProofErasureFocusedCiSource, directProofErasureFocusedCiNormalizationPaths } from "./direct-proof-erasure-focused-ci-source-history.mjs";
import { beforeOptionalParameterDispatchBridgeSource, optionalParameterDispatchBridgeNormalizationPaths } from "./optional-parameter-dispatch-bridge-source-history.mjs";
import { beforeOptionalParameterFocusedCiSource, optionalParameterFocusedCiNormalizationPaths } from "./optional-parameter-focused-ci-source-history.mjs";
import { beforeOptionalParameterCurrentLineIntegrationSource, optionalParameterCurrentLineIntegrationNormalizationPaths } from "./optional-parameter-current-line-integration-source-history.mjs";
import { beforeOptionalParameterSource, optionalParameterNormalizationPaths } from "./optional-parameter-source-history.mjs";
import { beforeHostNullSystemsTypeSurfaceIntegrationSource, beforeHostNullSystemsTypeSurfaceSource, hostNullSystemsTypeSurfaceNormalizationPaths } from "./host-null-systems-type-surface-lineage-source-history.mjs";
import { beforeHostNullSystemsIntegrationSource, beforeHostNullSystemsSource, hostNullSystemsNormalizationPaths } from "./host-null-systems-source-history.mjs";
import { beforeGeneratedOutputControlRepairTypeSurfaceIntegrationSource, beforeGeneratedOutputControlRepairTypeSurfaceSource, generatedOutputControlRepairTypeSurfaceNormalizationPaths } from "./generated-output-control-repair-type-surface-lineage-source-history.mjs";
import { beforeGeneratedOutputControlRepairIntegrationSource, beforeGeneratedOutputControlRepairSource, generatedOutputControlRepairNormalizationPaths } from "./generated-output-control-repair-source-history.mjs";
import { beforeHostNullScriptingTypeSurfaceIntegrationSource, beforeHostNullScriptingTypeSurfaceSource, hostNullScriptingTypeSurfaceNormalizationPaths } from "./host-null-scripting-type-surface-lineage-source-history.mjs";
import { beforeHostNullScriptingIntegrationSource, beforeHostNullScriptingSource, hostNullScriptingNormalizationPaths } from "./host-null-scripting-source-history.mjs";
import { beforeHostNullDownstreamIntegrationSource, beforeHostNullDownstreamSource, hostNullDownstreamNormalizationPaths } from "./host-null-downstream-source-history.mjs";
import { beforeHostNullManagedIntegrationSource, beforeHostNullManagedSource, hostNullManagedNormalizationPaths } from "./host-null-managed-source-history.mjs";
import { beforeHostNullPhpIntegrationSource, beforeHostNullPhpSource, hostNullPhpNormalizationPaths } from "./host-null-php-source-history.mjs";
import { beforeHostNullTypeSurfaceLineageIntegrationSource, beforeHostNullTypeSurfaceLineageSource, hostNullTypeSurfaceLineageNormalizationPaths } from "./host-null-type-surface-lineage-source-history.mjs";
import { beforeHostNullPartitionGapIntegrationSource, beforeHostNullPartitionGapSource, hostNullPartitionGapNormalizationPaths } from "./host-null-partition-gap-source-history.mjs";
import { beforeNpmRuntimeDefaultValueCopyRepairSource, npmRuntimeDefaultValueCopyRepairNormalizationPaths } from "./npm-runtime-default-value-copy-repair-source-history.mjs";
import { beforeHostNullJavaScriptSource, hostNullJavaScriptNormalizationPaths } from "./host-null-javascript-source-history.mjs";
import { beforeCorpusTrapBuildCheckoutRepairSource, corpusTrapBuildCheckoutRepairNormalizationPaths } from "./corpus-trap-build-checkout-repair-source-history.mjs";
import { beforePerformanceReproducibilityCheckoutSource, performanceReproducibilityCheckoutNormalizationPaths } from "./performance-reproducibility-checkout-source-history.mjs";
import { beforePhpWasmCorpusLaneSplitSource, phpWasmCorpusLaneSplitNormalizationPaths } from "./php-wasm-corpus-lane-split-source-history.mjs";
import { beforeDownstreamDirectProofControlRepairSource, downstreamDirectProofControlRepairNormalizationPaths } from "./downstream-direct-proof-control-repair-source-history.mjs";
import { beforeDirectProofErasureDownstreamRepairSource, directProofErasureDownstreamRepairNormalizationPaths } from "./direct-proof-erasure-downstream-repair-source-history.mjs";
import { beforeDirectProofErasureHostedFollowupSource, directProofErasureHostedFollowupNormalizationPaths } from "./direct-proof-erasure-hosted-followup-source-history.mjs";
import { beforeDirectProofErasureNativeProducerRepairSource, directProofErasureNativeProducerRepairNormalizationPaths } from "./direct-proof-erasure-native-producer-repair-source-history.mjs";
import { beforeDirectProofErasureNativeEvidenceCorrectionSource, directProofErasureNativeEvidenceCorrectionNormalizationPaths } from "./direct-proof-erasure-native-evidence-correction-source-history.mjs";
import { beforePerlDependentRefinementRejectionSource, perlDependentRefinementRejectionNormalizationPaths } from "./perl-dependent-refinement-rejection-source-history.mjs";
import { beforeWitFrozenClosureHubHookSource, witFrozenClosureHubHookNormalizationPaths } from "./wit-frozen-closure-hub-hook-source-history.mjs";
import { beforeDownstreamReporterSparseCheckoutSource, downstreamReporterSparseCheckoutNormalizationPaths } from "./downstream-reporter-sparse-checkout-source-history.mjs";
import { beforeDirectProofErasureNpmArchiveSource, directProofErasureNpmArchiveNormalizationPaths } from "./direct-proof-erasure-npm-archive-source-history.mjs";
import { beforeDirectProofErasureMatrixSource, directProofErasureMatrixNormalizationPaths } from "./direct-proof-erasure-matrix-source-history.mjs";
import { beforeDirectProofErasureTestRegistrationSource, directProofErasureTestRegistrationNormalizationPaths } from "./direct-proof-erasure-test-registration-source-history.mjs";
import { beforeProofErasureWitLintJoinSource, proofErasureWitLintJoinNormalizationPaths } from "./proof-erasure-wit-lint-join-source-history.mjs";
import { beforeProofErasureLintPinRepairSource, proofErasureLintPinRepairNormalizationPaths } from "./proof-erasure-lint-pin-repair-source-history.mjs";
import { beforeDirectProofErasureWitSource, directProofErasureWitNormalizationPaths } from "./direct-proof-erasure-wit-source-history.mjs";
import { beforeDirectProofErasureLanguageSource, directProofErasureLanguageNormalizationPaths } from "./direct-proof-erasure-language-source-history.mjs";
import { beforeDirectProofErasureManagedSource, directProofErasureManagedNormalizationPaths } from "./direct-proof-erasure-managed-source-history.mjs";
import { beforeProofCoreLocalJoinSource, proofCoreLocalJoinNormalizationPaths } from "./proof-core-local-join-source-history.mjs";
import { beforeDirectProofErasurePhpSource, directProofErasurePhpNormalizationPaths } from "./direct-proof-erasure-php-source-history.mjs";
import { beforeDirectProofErasureNativeSource, directProofErasureNativeNormalizationPaths } from "./direct-proof-erasure-native-source-history.mjs";
import { beforeDirectProofErasureNpmSource, directProofErasureNpmNormalizationPaths } from "./direct-proof-erasure-npm-source-history.mjs";
import { beforeDirectProofErasurePackageSource, directProofErasurePackageNormalizationPaths } from "./direct-proof-erasure-package-source-history.mjs";
import { beforeDirectProofErasureFixtureSource, directProofErasureFixtureNormalizationPaths } from "./direct-proof-erasure-fixture-source-history.mjs";
import { beforeDirectProofErasureSource, directProofErasureNormalizationPaths } from "./direct-proof-erasure-source-history.mjs";
import { beforeProofErasureEvidenceAuditSource, proofErasureEvidenceAuditNormalizationPaths } from "./proof-erasure-evidence-audit-source-history.mjs";
import { beforeDependentSignatureCompletionSource, dependentSignatureCompletionNormalizationPaths } from "./dependent-signature-completion-source-history.mjs";
import { beforeCoreRecordedTransitionRepairSource, coreRecordedTransitionRepairNormalizationPaths } from "./core-recorded-transition-repair-source-history.mjs";
import { beforeCoreReadSiteRepairSource, coreReadSiteRepairNormalizationPaths } from "./core-read-site-repair-source-history.mjs";
import { beforeCoreOwnedCallbackPicRepairSource, coreOwnedCallbackPicRepairNormalizationPaths } from "./core-owned-callback-pic-repair-source-history.mjs";
import { beforeCorePreBoxRecountRepairSource, corePreBoxRecountRepairNormalizationPaths } from "./core-pre-box-recount-repair-source-history.mjs";
import { beforeCoreReviewedFinBoxHarnessRepairSource, coreReviewedFinBoxHarnessRepairNormalizationPaths } from "./core-reviewed-fin-box-harness-repair-source-history.mjs";
import { beforeCoreShardFourSerialSource, coreShardFourSerialNormalizationPaths } from "./core-shard-four-serial-source-history.mjs";
import { beforeCoreLegacyFinArchiveRepairSource, coreLegacyFinArchiveRepairNormalizationPaths } from "./core-legacy-fin-archive-repair-source-history.mjs";
import { beforeCoreGeneratedDocumentRepairSource, coreGeneratedDocumentRepairNormalizationPaths } from "./core-generated-document-repair-source-history.mjs";
import { beforeCoreShardFiveEightRepairSource, coreShardFiveEightRepairNormalizationPaths } from "./core-shard-five-eight-repair-source-history.mjs";
import { beforeWitCallbackFrozenClosureIntegrationSource, witCallbackFrozenClosureIntegrationNormalizationPaths } from "./wit-callback-frozen-closure-integration-source-history.mjs";
import { beforeWitCallbackFrozenClosureSource, witCallbackFrozenClosureChangedPaths } from "./wit-callback-frozen-closure-source-history.mjs";
import { beforeCoreDeterministicBoundaryRepairIntegrationSource, coreDeterministicBoundaryRepairIntegrationNormalizationPaths } from "./core-deterministic-boundary-repair-integration-source-history.mjs";
import { beforeCoreDeterministicBoundaryRepairSource, coreDeterministicBoundaryRepairNormalizationPaths } from "./core-deterministic-boundary-repair-source-history.mjs";
import { beforeSignatureSpecializationCompletionPinRepairIntegrationSource, signatureSpecializationCompletionPinRepairIntegrationNormalizationPaths } from "./signature-specialization-completion-pin-repair-integration-source-history.mjs";
import { beforeSignatureSpecializationCompletionPinRepairSource, signatureSpecializationCompletionPinRepairNormalizationPaths } from "./signature-specialization-completion-pin-repair-source-history.mjs";
import { beforeSignatureSpecializationCompletionPromotionIntegrationSource, signatureSpecializationCompletionPromotionIntegrationNormalizationPaths } from "./signature-specialization-completion-promotion-integration-source-history.mjs";
import { beforeSignatureSpecializationCompletionPromotionSource, signatureSpecializationCompletionPromotionNormalizationPaths } from "./signature-specialization-completion-promotion-source-history.mjs";
import { beforeSignatureSpecializationHostedArchiveReplayIntegrationSource, signatureSpecializationHostedArchiveReplayIntegrationNormalizationPaths } from "./signature-specialization-hosted-archive-replay-integration-source-history.mjs";
import { beforeSignatureSpecializationHostedArchiveReplaySource, signatureSpecializationHostedArchiveReplayNormalizationPaths } from "./signature-specialization-hosted-archive-replay-source-history.mjs";
import { beforeSignatureSpecializationCompletionPreparationIntegrationSource, signatureSpecializationCompletionPreparationIntegrationNormalizationPaths } from "./signature-specialization-completion-preparation-integration-source-history.mjs";
import { beforeSignatureSpecializationCompletionPreparationSource, signatureSpecializationCompletionPreparationNormalizationPaths } from "./signature-specialization-completion-preparation-source-history.mjs";
import { beforeInheritedCheckedRecordLaneMemoryLocalJoinSource, inheritedCheckedRecordLaneMemoryLocalJoinNormalizationPaths } from "./inherited-checked-record-lane-memory-local-join-source-history.mjs";
import { beforeInheritedCheckedRecordLaneMemoryIntegrationSource, inheritedCheckedRecordLaneMemoryIntegrationNormalizationPaths } from "./inherited-checked-record-lane-memory-integration-source-history.mjs";
import { beforeInheritedCheckedRecordLaneMemorySource, inheritedCheckedRecordLaneMemoryNormalizationPaths } from "./inherited-checked-record-lane-memory-source-history.mjs";
import { beforeCallbackFinPerlLocalJoinSource, callbackFinPerlLocalJoinNormalizationPaths } from "./callback-fin-perl-local-join-source-history.mjs";
import { beforeCallbackFinPerlMilestoneReadIntegrationSource, callbackFinPerlMilestoneReadIntegrationNormalizationPaths } from "./callback-fin-perl-milestone-read-integration-source-history.mjs";
import { beforeCallbackFinPerlMilestoneReadSource, callbackFinPerlMilestoneReadNormalizationPaths } from "./callback-fin-perl-milestone-read-source-history.mjs";
import { beforeCoreRubyPredecessorStopSource, coreRubyPredecessorStopNormalizationPaths } from "./core-ruby-predecessor-stop-source-history.mjs";
import { beforeCallbackFinMilestoneReadIntegrationSource, callbackFinMilestoneReadIntegrationNormalizationPaths } from "./callback-fin-milestone-read-integration-source-history.mjs";
import { beforeCallbackFinMilestoneReadSource, callbackFinMilestoneReadNormalizationPaths } from "./callback-fin-milestone-read-source-history.mjs";
import { beforeSignatureSpecializationHostedProducerBindingIntegrationSource, signatureSpecializationHostedProducerBindingIntegrationNormalizationPaths } from "./signature-specialization-hosted-producer-binding-integration-source-history.mjs";
import { beforeSignatureSpecializationHostedProducerBindingSource, signatureSpecializationHostedProducerBindingNormalizationPaths } from "./signature-specialization-hosted-producer-binding-source-history.mjs";
import { beforeSignatureSpecializationPhpWasmConsumerRepairIntegrationSource, signatureSpecializationPhpWasmConsumerRepairIntegrationNormalizationPaths } from "./signature-specialization-php-wasm-consumer-repair-integration-source-history.mjs";
import { beforeSignatureSpecializationPhpWasmConsumerRepairSource, signatureSpecializationPhpWasmConsumerRepairNormalizationPaths } from "./signature-specialization-php-wasm-consumer-repair-source-history.mjs";
import { beforeCoreNativeEvidenceManifestIntegrationSource, coreNativeEvidenceManifestIntegrationNormalizationPaths } from "./core-native-evidence-manifest-integration-source-history.mjs";
import { beforeCoreNativeEvidenceManifestSource, coreNativeEvidenceManifestNormalizationPaths } from "./core-native-evidence-manifest-source-history.mjs";
import { beforePerlCodegenMergedIntegrationSource, perlCodegenMergedIntegrationNormalizationPaths } from "./perl-codegen-merged-integration-source-history.mjs";
import { beforePerlCodegenMergedSource, perlCodegenMergedNormalizationPaths } from "./perl-codegen-merged-source-history.mjs";
import { beforePerlCodegenProducerReplayIntegrationSource, perlCodegenProducerReplayIntegrationNormalizationPaths } from "./perl-codegen-producer-replay-integration-source-history.mjs";
import { beforePerlCodegenProducerReplaySource, perlCodegenProducerReplayNormalizationPaths } from "./perl-codegen-producer-replay-source-history.mjs";
import { beforeCoreHistoricalContractRepairIntegrationSource, coreHistoricalContractRepairIntegrationNormalizationPaths } from "./core-historical-contract-repair-integration-source-history.mjs";
import { beforeCoreHistoricalContractRepairSource, coreHistoricalContractRepairNormalizationPaths } from "./core-historical-contract-repair-source-history.mjs";
import { beforeNativeFinCallbackRoleIntegrationSource, nativeFinCallbackRoleIntegrationNormalizationPaths } from "./native-fin-callback-role-integration-source-history.mjs";
import { beforeCoreHubOrderMergedIntegrationSource, coreHubOrderMergedIntegrationNormalizationPaths } from "./core-hub-order-merged-integration-source-history.mjs";
import { beforeCoreHubOrderMergedSource, coreHubOrderMergedNormalizationPaths } from "./core-hub-order-merged-source-history.mjs";
import { beforeCoreHubOrderRepairIntegrationSource, coreHubOrderRepairIntegrationNormalizationPaths } from "./core-hub-order-repair-integration-source-history.mjs";
import { beforeCoreHubOrderRepairSource, coreHubOrderRepairNormalizationPaths } from "./core-hub-order-repair-source-history.mjs";
import { beforeSignatureSpecializationHostedSource, signatureSpecializationHostedNormalizationPaths } from "./signature-specialization-hosted-source-history.mjs";
import { beforeSignatureSpecializationCompletionIntegrationSource, signatureSpecializationCompletionIntegrationNormalizationPaths } from "./signature-specialization-completion-integration-source-history.mjs";
import { beforeSignatureSpecializationCompletionSource, signatureSpecializationCompletionNormalizationPaths } from "./signature-specialization-completion-source-history.mjs";
import { beforeFinContractTestRegistrationIntegrationSource, finContractTestRegistrationIntegrationNormalizationPaths } from "./fin-contract-test-registration-integration-source-history.mjs";
import { beforeFinContractTestRegistrationSource, finContractTestRegistrationNormalizationPaths } from "./fin-contract-test-registration-source-history.mjs";
import { beforeFinCompletionPromotionSource, finCompletionPromotionNormalizationPaths } from "./fin-completion-promotion-source-history.mjs";
import { beforeReviewedFinFocusedProducerSource, reviewedFinFocusedProducerNormalizationPaths } from "./reviewed-fin-focused-producer-source-history.mjs";
import { beforeReviewedFinJobScopeSource, reviewedFinJobScopeNormalizationPaths } from "./reviewed-fin-job-scope-source-history.mjs";
import { beforeLeanToolchainReleaseFallbackSource, leanToolchainReleaseFallbackNormalizationPaths } from "./lean-toolchain-release-fallback-source-history.mjs";
import { beforeCallbackFinSparseCheckoutSource, callbackFinSparseCheckoutNormalizationPaths } from "./callback-fin-sparse-checkout-source-history.mjs";
import { beforeCallbackFinShallowCheckoutSource, callbackFinShallowCheckoutNormalizationPaths } from "./callback-fin-shallow-checkout-source-history.mjs";
import { beforeCoreCiReliabilitySource, coreCiReliabilityNormalizationPaths } from "./core-ci-reliability-source-history.mjs";
import { beforeCoreShardFiveRepairIntegrationSource, coreShardFiveRepairIntegrationNormalizationPaths } from "./core-shard-five-repair-integration-source-history.mjs";
import { beforeCoreShardFiveRepairSource, coreShardFiveRepairNormalizationPaths } from "./core-shard-five-repair-source-history.mjs";
import { beforeCoreCallbackFinLivePinRepairSource, coreCallbackFinLivePinRepairNormalizationPaths } from "./core-callback-fin-live-pin-repair-source-history.mjs";
import { beforeCallbackFinPerlRuntimeSource, callbackFinPerlRuntimeNormalizationPaths } from "./callback-fin-perl-runtime-source-history.mjs";
import { beforeCallbackFinPerlDirectionSource, callbackFinPerlDirectionNormalizationPaths } from "./callback-fin-perl-direction-source-history.mjs";
import { beforeCallbackFinHostRepairSource, callbackFinHostRepairNormalizationPaths } from "./callback-fin-host-repair-source-history.mjs";
import { beforeReplayChainMemoryIntegrationSource, replayChainMemoryIntegrationNormalizationPaths } from "./replay-chain-memory-integration-source-history.mjs";
import { beforeReplayChainMemorySource, replayChainMemoryNormalizationPaths } from "./replay-chain-memory-source-history.mjs";
import { beforeCoreMemoryBoundIntegrationSource, coreMemoryBoundIntegrationNormalizationPaths } from "./core-memory-bound-integration-source-history.mjs";
import { beforeCoreMemoryBoundSource, coreMemoryBoundNormalizationPaths } from "./core-memory-bound-source-history.mjs";
import { beforeCoreHistoricalEvidenceReuseLivePinRepairSource, coreHistoricalEvidenceReuseLivePinRepairNormalizationPaths } from "./core-historical-evidence-reuse-live-pin-repair-source-history.mjs";
import { beforeCoreHistoricalEvidenceReuseSource, coreHistoricalEvidenceReuseNormalizationPaths } from "./core-historical-evidence-reuse-source-history.mjs";
import { beforeCoreExactHeadMatrixRepairSource, coreExactHeadMatrixRepairNormalizationPaths } from "./core-exact-head-matrix-repair-source-history.mjs";
import { beforeCoreInheritedRecordTypeSurfaceBatchSource, coreInheritedRecordTypeSurfaceBatchNormalizationPaths } from "./core-inherited-record-type-surface-batch-source-history.mjs";
import { beforeCoreExactHeadHostedReplayRepairSource, coreExactHeadHostedReplayRepairNormalizationPaths } from "./core-exact-head-hosted-replay-repair-source-history.mjs";
import { beforeCoreExactHeadHostedStaticRepairSource, coreExactHeadHostedStaticRepairNormalizationPaths } from "./core-exact-head-hosted-static-repair-source-history.mjs";
import { beforeCoreRecursiveCallableEvidencePinRepairSource, coreRecursiveCallableEvidencePinRepairNormalizationPaths } from "./core-recursive-callable-evidence-pin-repair-source-history.mjs";
import { beforeCoreRecursiveCallableReplayBoundSource, coreRecursiveCallableReplayBoundNormalizationPaths } from "./core-recursive-callable-replay-bound-source-history.mjs";
import { beforeCoreLegacyOwnedEvidenceReplayBoundSource, coreLegacyOwnedEvidenceReplayBoundNormalizationPaths } from "./core-legacy-owned-evidence-replay-bound-source-history.mjs";
import { beforeCoreCallbackEvidenceReplayBoundSource, coreCallbackEvidenceReplayBoundNormalizationPaths } from "./core-callback-evidence-replay-bound-source-history.mjs";
import { beforeCoreInheritedRecordReplayBoundSource, coreInheritedRecordReplayBoundNormalizationPaths } from "./core-inherited-record-replay-bound-source-history.mjs";
import { beforeCoreReplayIntegrationEndpointRepairSource, coreReplayIntegrationEndpointRepairNormalizationPaths } from "./core-replay-integration-endpoint-repair-source-history.mjs";
import { beforeCoreExactHeadReplayRepairSource, coreExactHeadReplayRepairNormalizationPaths } from "./core-exact-head-replay-repair-source-history.mjs";
import { beforeRecurringAcceptanceDocumentationSource, recurringAcceptanceDocumentationNormalizationPaths } from "./recurring-acceptance-documentation-source-history.mjs";
import { beforeBoundedRecurringAcceptanceSweepSource, boundedRecurringAcceptanceSweepNormalizationPaths } from "./bounded-recurring-acceptance-sweep-source-history.mjs";
import { beforeCoreExactHeadValidationRepairSource, coreExactHeadValidationRepairNormalizationPaths } from "./core-exact-head-validation-repair-source-history.mjs";
import { beforeDefaultBranchCiTriggerBudgetSource, defaultBranchCiTriggerBudgetNormalizationPaths } from "./default-branch-ci-trigger-budget-source-history.mjs";
import { beforeCoreUniqueTypeSurfaceAuthenticationSource, coreUniqueTypeSurfaceAuthenticationNormalizationPaths } from "./core-unique-type-surface-authentication-source-history.mjs";
import { beforeCoreHistoricalAdditionCheckoutRepairSource, coreHistoricalAdditionCheckoutRepairNormalizationPaths } from "./core-historical-addition-checkout-repair-source-history.mjs";
import { beforeCoreTypeSurfaceSinglePassSource, coreTypeSurfaceSinglePassNormalizationPaths } from "./core-type-surface-single-pass-source-history.mjs";
import { beforeCoreDocumentationEvidenceClosureRepairSource, coreDocumentationEvidenceClosureRepairNormalizationPaths } from "./core-documentation-evidence-closure-repair-source-history.mjs";
import { beforeCoreBrowserWorkflowEvidencePinRepairSource, coreBrowserWorkflowEvidencePinRepairNormalizationPaths } from "./core-browser-workflow-evidence-pin-repair-source-history.mjs";
import { beforeCoreTypeSurfaceEvidenceClosureRepairSource, coreTypeSurfaceEvidenceClosureRepairNormalizationPaths } from "./core-type-surface-evidence-closure-repair-source-history.mjs";
import { beforeCoreSparseConeModeRepairSource, coreSparseConeModeRepairNormalizationPaths } from "./core-sparse-cone-mode-repair-source-history.mjs";
import { beforeCoreContractEvidenceCheckoutSource, coreContractEvidenceCheckoutNormalizationPaths } from "./core-contract-evidence-checkout-source-history.mjs";
import { beforeNominalPrimitiveSubtypeSparseCheckoutSource, nominalPrimitiveSubtypeSparseCheckoutNormalizationPaths } from "./nominal-primitive-subtype-sparse-checkout-source-history.mjs";
import { beforeCoreStaticSparseCheckoutSource, coreStaticSparseCheckoutNormalizationPaths } from "./core-static-sparse-checkout-source-history.mjs";
import { beforeCoreStaticHistoryDeferralSource, coreStaticHistoryDeferralNormalizationPaths } from "./core-static-history-deferral-source-history.mjs";
import { beforeCoreOwnedReviewedExactStopRepairSource, coreOwnedReviewedExactStopRepairNormalizationPaths } from "./core-owned-reviewed-exact-stop-repair-source-history.mjs";
import { beforeCoreWitExactStopRepairSource, coreWitExactStopRepairNormalizationPaths } from "./core-wit-exact-stop-repair-source-history.mjs";
import { beforeCoreRuntimeBudgetLivePinRepairSource, coreRuntimeBudgetLivePinRepairNormalizationPaths } from "./core-runtime-budget-live-pin-repair-source-history.mjs";
import { beforeCoreContractRuntimeBudgetSource, coreContractRuntimeBudgetNormalizationPaths } from "./core-contract-runtime-budget-source-history.mjs";
import { beforeCoreReceiverCiStopBoundarySource, coreReceiverCiStopBoundaryNormalizationPaths } from "./core-receiver-ci-stop-boundary-source-history.mjs";
import { beforeCoreWitBorrowStopBoundarySource, coreWitBorrowStopBoundaryNormalizationPaths } from "./core-wit-borrow-stop-boundary-source-history.mjs";
import { beforeCoreReceiverCiProducerReplaySource, coreReceiverCiProducerReplayNormalizationPaths } from "./core-receiver-ci-producer-replay-source-history.mjs";
import { beforeCoreWitBorrowProducerReplaySource, coreWitBorrowProducerReplayNormalizationPaths } from "./core-wit-borrow-producer-replay-source-history.mjs";
import { beforeCoreExactHeadLivePinRepairSource, coreExactHeadLivePinRepairNormalizationPaths } from "./core-exact-head-live-pin-repair-source-history.mjs";
import { beforeCoreHistoricalEvidenceReplaySource, coreHistoricalEvidenceReplayNormalizationPaths } from "./core-historical-evidence-replay-source-history.mjs";
import { beforeCoreRunnerResilienceSource, coreRunnerResilienceNormalizationPaths } from "./core-runner-resilience-source-history.mjs";
import { beforeNominalSubtypeEntryLivePinRepairSource, nominalSubtypeEntryLivePinRepairNormalizationPaths } from "./nominal-subtype-entry-live-pin-repair-source-history.mjs";
import { beforeNominalSubtypeEntryPublicationSource, nominalSubtypeEntryPublicationNormalizationPaths } from "./nominal-subtype-entry-publication-source-history.mjs";
import { beforeOwnedCheckedSemanticAuditSource, ownedCheckedSemanticAuditNormalizationPaths } from "./owned-checked-record-semantic-audit-source-history.mjs";
import { beforeOwnedCheckedAlignedPublicationSource, ownedCheckedAlignedPublicationNormalizationPaths } from "./owned-checked-record-aligned-publication-source-history.mjs";
import { beforeOwnedCheckedPromotionLabelsSource, ownedCheckedPromotionLabelsNormalizationPaths } from "./owned-checked-record-promotion-labels-source-history.mjs";
import { beforeOwnedPublicationCoexistenceSource, ownedPublicationCoexistenceNormalizationPaths } from "./owned-publication-coexistence-source-history.mjs";
import { beforeOwnedCheckedArchiveRootsSource, ownedCheckedArchiveRootsNormalizationPaths } from "./owned-checked-record-archive-roots-source-history.mjs";
import { beforeOwnedSubtypeMatrixPublicationSource, ownedSubtypeMatrixPublicationNormalizationPaths } from "./owned-subtype-matrix-publication-source-history.mjs";
import { beforeOwnedSubtypePromotionTransactionSource, ownedSubtypePromotionTransactionNormalizationPaths } from "./owned-subtype-promotion-transaction-source-history.mjs";
import { beforeOwnedSubtypeHostedPromotionSource, ownedSubtypeHostedPromotionNormalizationPaths } from "./owned-subtype-hosted-promotion-source-history.mjs";
import { beforeOwnedSubtypeNpmHostedSource, ownedSubtypeNpmHostedNormalizationPaths } from "./owned-subtype-npm-hosted-source-history.mjs";
import { beforeOwnedCheckedRetainedIdentitySource, ownedCheckedRetainedIdentityNormalizationPaths } from "./owned-checked-retained-identity-source-history.mjs";
import { beforeOwnedSubtypeNpmCompleteAcceptanceSource, ownedSubtypeNpmCompleteAcceptanceNormalizationPaths } from "./owned-subtype-npm-complete-acceptance-source-history.mjs";
import { beforeOwnedCheckedCSessionBoundariesSource, ownedCheckedCSessionBoundariesNormalizationPaths } from "./owned-checked-c-session-boundaries-source-history.mjs";
import { beforeEntryFixtureRepairSource, entryFixtureRepairNormalizationPaths } from "./entry-fixture-repair-source-history.mjs";
import { beforeOwnedCProducerRepairSource, ownedCProducerRepairNormalizationPaths } from "./owned-c-producer-repair-source-history.mjs";
import { beforeOwnedDotnetProducerRepairSource, ownedDotnetProducerRepairNormalizationPaths } from "./owned-dotnet-producer-repair-source-history.mjs";
import { beforeDocumentationWorkflowRepairSource, documentationWorkflowRepairNormalizationPaths } from "./documentation-workflow-repair-source-history.mjs";
import { beforeOwnedJavaScriptProducerRepairSource, ownedJavaScriptProducerRepairNormalizationPaths } from "./owned-javascript-producer-repair-source-history.mjs";
import { beforeOwnedSubtypeDelegationRepairSource, ownedSubtypeDelegationRepairNormalizationPaths } from "./owned-subtype-delegation-repair-source-history.mjs";
import { beforeNativeForkTransferProducerRepairSource, nativeForkTransferProducerRepairNormalizationPaths } from "./native-fork-transfer-producer-repair-source-history.mjs";
import { beforeFinHistoryRollingRepairSource, finHistoryRollingRepairNormalizationPaths } from "./fin-history-rolling-repair-source-history.mjs";
import { beforePerlCallbackAdmissionRepairSource, perlCallbackAdmissionRepairNormalizationPaths } from "./perl-callback-admission-repair-source-history.mjs";
import { beforeOwnedJvmTransferProducerRepairSource, ownedJvmTransferProducerRepairNormalizationPaths } from "./owned-jvm-transfer-producer-repair-source-history.mjs";
import { beforeOwnedCReceiverProducerRepairSource, ownedCReceiverProducerRepairNormalizationPaths } from "./owned-c-receiver-producer-repair-source-history.mjs";
import { beforePhpWasmCallbackSubtypeEntrySource, phpWasmCallbackSubtypeEntryNormalizationPaths } from "./php-wasm-callback-subtype-entry-source-history.mjs";
import { beforePhpWasmCallbackFinMixedEntrySource, phpWasmCallbackFinMixedEntryNormalizationPaths } from "./php-wasm-callback-fin-mixed-entry-source-history.mjs";
import { beforeOwnedJavaScriptTransferNixProducerRepairSource, ownedJavaScriptTransferNixProducerRepairNormalizationPaths } from "./owned-javascript-transfer-nix-producer-repair-source-history.mjs";
import { beforeOwnedMilestoneProducerRepairSource, ownedMilestoneProducerRepairNormalizationPaths } from "./owned-milestone-producer-repair-source-history.mjs";
import { beforePhpWasmCallbackTilesTraceRepairSource, phpWasmCallbackTilesTraceRepairNormalizationPaths } from "./php-wasm-callback-tiles-trace-repair-source-history.mjs";
import { beforeAuthorRefinementGuidanceRepairSource, authorRefinementGuidanceRepairNormalizationPaths } from "./author-refinement-guidance-repair-source-history.mjs";
import { beforeWitTransferCopyGapSource, witTransferCopyGapNormalizationPaths } from "./wit-transfer-copy-gap-source-history.mjs";
import { beforeCoreEvidenceRepairIntegrationSource, coreEvidenceRepairIntegrationChangedPaths } from "./core-evidence-repair-integration-source-history.mjs";
import { beforeJvmNpmProducerRepairSource, jvmNpmProducerRepairNormalizationPaths } from "./jvm-npm-producer-repair-source-history.mjs";
import { beforeAdmissionArchiveProducerRepairSource, admissionArchiveProducerRepairNormalizationPaths } from "./admission-archive-producer-repair-source-history.mjs";
import { beforeBorrowReceiverProducerRepairSource, borrowReceiverProducerRepairNormalizationPaths } from "./borrow-receiver-producer-repair-source-history.mjs";
import { beforeGenericSubtypeArchiveBoundarySource, genericSubtypeArchiveBoundaryNormalizationPaths } from "./generic-subtype-archive-boundary-source-history.mjs";
import { beforeCoreProducerLivePinRepairSource, coreProducerLivePinRepairNormalizationPaths } from "./core-producer-live-pin-repair-source-history.mjs";
import { beforeRubyTransferCopyGapSource, rubyTransferCopyGapNormalizationPaths } from "./ruby-transfer-copy-gap-source-history.mjs";
import { beforeRubyTransferCopyGapIntegrationSource, rubyTransferCopyGapIntegrationNormalizationPaths } from "./ruby-transfer-copy-gap-integration-source-history.mjs";
import { beforePerlPromotionLivePinRepairSource, perlPromotionLivePinRepairNormalizationPaths } from "./perl-promotion-live-pin-repair-source-history.mjs";
import { beforePhpWasmCallbackEndpointStopSource, phpWasmCallbackEndpointStopNormalizationPaths } from "./php-wasm-callback-endpoint-stop-source-history.mjs";
import { beforeZeroPayloadDotnetArchiveGapSource, zeroPayloadDotnetArchiveGapNormalizationPaths } from "./zero-payload-dotnet-archive-gap-source-history.mjs";
import { beforeCoreHistoryEndpointIntegrationSource, coreHistoryEndpointIntegrationNormalizationPaths } from "./core-history-endpoint-integration-source-history.mjs";
import { beforeOwnedProducerReplaySource, ownedProducerReplayNormalizationPaths } from "./owned-producer-replay-source-history.mjs";
import { beforeOwnedHistoryFollowupSource, ownedHistoryFollowupNormalizationPaths } from "./owned-history-followup-source-history.mjs";
import { beforePerlCallbackContractGapSource, perlCallbackContractGapNormalizationPaths } from "./perl-callback-contract-gap-source-history.mjs";
import { beforeMilestoneControlRepairSource, milestoneControlRepairNormalizationPaths } from "./milestone-control-repair-source-history.mjs";
import { beforePhpRecursiveReplaySource, phpRecursiveReplayNormalizationPaths } from "./php-recursive-replay-source-history.mjs";
import { beforeZeroPayloadRustReplaySource, zeroPayloadRustReplayNormalizationPaths } from "./zero-payload-rust-producer-replay-source-history.mjs";
import { beforeCallbackProducerReplaySource, callbackProducerReplayNormalizationPaths } from "./callback-producer-replay-source-history.mjs";
import { beforeTransferBorrowProducerReplaySource, transferBorrowProducerReplayNormalizationPaths } from "./transfer-borrow-producer-replay-source-history.mjs";
import { beforeOwnedLifetimeReplaySource, ownedLifetimeReplayNormalizationPaths } from "./owned-lifetime-producer-replay-source-history.mjs";
import { beforeOwnedPhpWasmHostedArchiveSource, ownedPhpWasmHostedArchiveNormalizationPaths } from "./owned-php-wasm-hosted-archive-source-history.mjs";
import { beforeOwnedNpmCiEnvironmentRepairSource, ownedNpmCiEnvironmentRepairNormalizationPaths } from "./owned-npm-ci-environment-repair-source-history.mjs";
import { beforeCoreInventoryEndpointRepairSource, coreInventoryEndpointRepairNormalizationPaths } from "./core-inventory-endpoint-repair-source-history.mjs";
import { beforeCoreInventoryFollowupRepairSource, coreInventoryFollowupRepairNormalizationPaths } from "./core-inventory-followup-repair-source-history.mjs";
import { beforeCoreFinCppRepairSource, coreFinCppRepairNormalizationPaths } from "./core-fin-cpp-repair-source-history.mjs";
import { beforeDotnetCallbackProducerReplaySource, dotnetCallbackProducerReplayNormalizationPaths } from "./dotnet-callback-producer-replay-source-history.mjs";
import { beforePythonCallbackProducerReplaySource, pythonCallbackProducerReplayNormalizationPaths } from "./python-callback-producer-replay-source-history.mjs";
import { beforeJvmCallbackProducerReplaySource, jvmCallbackProducerReplayNormalizationPaths } from "./jvm-callback-producer-replay-source-history.mjs";
import { beforePhpWasmCallbackProducerReplaySource, phpWasmCallbackProducerReplayNormalizationPaths } from "./php-wasm-callback-producer-replay-source-history.mjs";
import { beforeCoreReceiverEndpointRepairSource, coreReceiverEndpointRepairNormalizationPaths } from "./core-receiver-endpoint-repair-source-history.mjs";
import { beforeCorePerlConsumerEndpointRepairSource, corePerlConsumerEndpointRepairNormalizationPaths } from "./core-perl-consumer-endpoint-repair-source-history.mjs";
import { beforeOwnedNpmScopedProducerSource, ownedNpmScopedProducerNormalizationPaths } from "./owned-npm-scoped-producer-source-history.mjs";
import { beforeCorePhpStructuredEndpointRepairSource, corePhpStructuredEndpointRepairNormalizationPaths } from "./core-php-structured-endpoint-repair-source-history.mjs";
import { beforeOwnedCheckedRecordMatrixGateSource, ownedCheckedRecordMatrixGateNormalizationPaths } from "./owned-checked-record-matrix-gate-source-history.mjs";
import { beforeCoreStructuredHistoryRepairSource, coreStructuredHistoryRepairNormalizationPaths } from "./core-structured-history-repair-source-history.mjs";
import { beforeOwnedNpmSourceIdentityRepairSource, ownedNpmSourceIdentityRepairNormalizationPaths } from "./owned-npm-source-identity-repair-source-history.mjs";
import { beforeGenericSubtypeCompactReferenceSource, genericSubtypeCompactReferenceNormalizationPaths } from "./generic-subtype-compact-reference-source-history.mjs";
import { beforeGenericSubtypePromotionTransactionSource, genericSubtypePromotionTransactionNormalizationPaths } from "./generic-subtype-promotion-transaction-source-history.mjs";
import { beforeGenericSubtypePromotionBaselineSource, genericSubtypePromotionBaselineNormalizationPaths } from "./generic-subtype-promotion-baseline-source-history.mjs";
import { beforeOwnedNpmHistoryCheckoutSource, ownedNpmHistoryCheckoutNormalizationPaths } from "./owned-npm-history-checkout-source-history.mjs";
import { beforeGenericSubtypeMatrixPublicationSource, genericSubtypeMatrixPublicationNormalizationPaths } from "./generic-subtype-matrix-publication-source-history.mjs";
import { beforeOwnedCheckedRecordPromotionPreparationSource, ownedCheckedRecordPromotionPreparationNormalizationPaths } from "./owned-checked-record-promotion-preparation-source-history.mjs";
import { beforePhpWasmEntryTagDispatchSource, phpWasmEntryTagDispatchNormalizationPaths } from "./php-wasm-entry-tag-dispatch-source-history.mjs";
import { beforeOwnedCheckedRecordMatrixPublicationSource, ownedCheckedRecordMatrixPublicationNormalizationPaths } from "./owned-checked-record-matrix-publication-source-history.mjs";
import { beforePhpWasmEntryHostedIdentitySource, phpWasmEntryHostedIdentityNormalizationPaths } from "./php-wasm-entry-hosted-identity-source-history.mjs";
import { beforePhpWasmEntryHostedReplaySource, phpWasmEntryHostedReplayNormalizationPaths } from "./php-wasm-entry-hosted-replay-source-history.mjs";
import { beforePhpWasmEntryDiagnosticRetentionSource, phpWasmEntryDiagnosticRetentionNormalizationPaths } from "./php-wasm-entry-diagnostic-retention-source-history.mjs";
import { beforePhpWasmEntryCompleteArchiveSource, phpWasmEntryCompleteArchiveNormalizationPaths } from "./php-wasm-entry-complete-archive-source-history.mjs";
import { beforePhpWasmEntryPublicationPreparationSource, phpWasmEntryPublicationPreparationNormalizationPaths } from "./php-wasm-entry-publication-preparation-source-history.mjs";
import { beforePhpWasmEntryPublisherSource, phpWasmEntryPublisherNormalizationPaths } from "./php-wasm-entry-publisher-source-history.mjs";
import { beforePhpWasmEntryPublicationPinRepairSource, phpWasmEntryPublicationPinRepairNormalizationPaths } from "./php-wasm-entry-publication-pin-repair-source-history.mjs";
import { beforePhpWasmEntryProbePublicationSource, phpWasmEntryProbePublicationNormalizationPaths } from "./php-wasm-entry-probe-publication-source-history.mjs";
import { beforeConsumerToolLookupsSource, consumerToolLookupsNormalizationPaths } from "./consumer-tool-lookups-source-history.mjs";
import { beforePhpWasmEntrySourceSupplementSource, phpWasmEntrySourceSupplementNormalizationPaths } from "./php-wasm-entry-source-supplement-source-history.mjs";
import { beforeCorePublicationRecursiveRepairSource, corePublicationRecursiveRepairNormalizationPaths } from "./core-publication-recursive-repair-source-history.mjs";
import { beforeCoreAuthorPublicationRepairSource, coreAuthorPublicationRepairNormalizationPaths } from "./core-author-publication-repair-source-history.mjs";
import { beforePhpWasmEntryBuildInputSupplementSource, phpWasmEntryBuildInputSupplementNormalizationPaths } from "./php-wasm-entry-build-input-supplement-source-history.mjs";
import { beforeCoreAggregateSparseCheckoutSource, coreAggregateSparseCheckoutNormalizationPaths } from "./core-aggregate-sparse-checkout-source-history.mjs";
import { beforeOwnedNpmCompleteAcceptanceSource, ownedNpmCompleteAcceptanceNormalizationPaths } from "./owned-npm-complete-acceptance-source-history.mjs";
import { beforePhpClosureProducerReplaySource, phpClosureProducerReplayNormalizationPaths } from "./php-closure-producer-replay-source-history.mjs";
import { beforeOwnedReceiptProducerReplaySource, ownedReceiptProducerReplayNormalizationPaths } from "./owned-receipt-producer-replay-source-history.mjs";
import { beforeOwnedMatrixIsolationSource, ownedMatrixIsolationNormalizationPaths } from "./owned-matrix-isolation-source-history.mjs";
import { beforeOwnedMatrixRefreshSource, ownedMatrixRefreshNormalizationPaths } from "./owned-matrix-refresh-source-history.mjs";
import { beforeOwnedCheckedCarrierCompilationSource, ownedCheckedCarrierCompilationNormalizationPaths } from "./owned-checked-carrier-compilation-source-history.mjs";
import { beforeOwnedCheckedNativeMixedCoverageSource, ownedCheckedNativeMixedCoverageNormalizationPaths } from "./owned-checked-native-mixed-coverage-source-history.mjs";
import { beforeOwnedNativePromotionScopeSource, ownedNativePromotionScopeNormalizationPaths } from "./owned-native-promotion-scope-source-history.mjs";
import { beforeOwnedCheckedLanguageMixedCoverageSource, ownedCheckedLanguageMixedCoverageNormalizationPaths } from "./owned-checked-language-mixed-coverage-source-history.mjs";
import { beforeDependentMatrixDocGateSource, dependentMatrixDocGateNormalizationPaths } from "./dependent-matrix-doc-gate-source-history.mjs";
import { beforeOwnedCheckedWindowRejectionSource, ownedCheckedWindowRejectionNormalizationPaths } from "./owned-checked-window-rejection-source-history.mjs";
import { beforeOwnedCheckedManagedMixedCoverageSource, ownedCheckedManagedMixedCoverageNormalizationPaths } from "./owned-checked-managed-mixed-coverage-source-history.mjs";
import { beforeOwnedCheckedPhpWasmMixedCoverageSource, ownedCheckedPhpWasmMixedCoverageNormalizationPaths } from "./owned-checked-php-wasm-mixed-coverage-source-history.mjs";
import { beforeOwnedCheckedWitBootstrapSource, ownedCheckedWitBootstrapNormalizationPaths } from "./owned-checked-wit-bootstrap-source-history.mjs";
import { beforeWasmtimeCapiRolloutSource, wasmtimeCapiRolloutNormalizationPaths } from "./wasmtime-capi-ci-rollout-source-history.mjs";
import { beforeReviewedFinWasmFieldSource, reviewedFinWasmFieldNormalizationPaths } from "./reviewed-fin-wasm-field-source-history.mjs";
import { beforeReviewedCallbackFinBrowserSource, reviewedCallbackFinBrowserNormalizationPaths } from "./reviewed-callback-fin-browser-source-history.mjs";
import { beforeCallbackFinInstalledRepairSource, callbackFinInstalledRepairNormalizationPaths } from "./callback-fin-installed-repair-source-history.mjs";
import { beforeCallbackFinDiagnosticContractSource, callbackFinDiagnosticContractNormalizationPaths } from "./callback-fin-diagnostic-contract-source-history.mjs";
import { beforeCallbackFinNativeCapabilitySource, callbackFinNativeCapabilityNormalizationPaths } from "./callback-fin-native-capability-source-history.mjs";
import { beforeCallbackFinHostedWorkflowSource, callbackFinHostedWorkflowNormalizationPaths } from "./callback-fin-hosted-workflow-source-history.mjs";
import { beforeNativeFinCallbackRoleSource, nativeFinCallbackRoleNormalizationPaths } from "./native-fin-callback-role-source-history.mjs";
import { beforeOwnedCheckedPhpWasmContextsSource, ownedCheckedPhpWasmContextsNormalizationPaths } from "./owned-checked-php-wasm-contexts-source-history.mjs";
import { beforeCoreEvidenceMemoryRepairSource, coreEvidenceMemoryRepairNormalizationPaths } from "./core-evidence-memory-repair-source-history.mjs";
import { beforeValueIndexPromotionMilestoneRepairSource, valueIndexPromotionMilestoneRepairNormalizationPaths } from "./value-index-promotion-milestone-repair-source-history.mjs";
import { beforeCoreMilestoneReplayRepairSource, coreMilestoneReplayRepairNormalizationPaths } from "./core-milestone-replay-repair-source-history.mjs";
import { beforeTypeSurfaceCurrentPinRepairSource, typeSurfaceCurrentPinRepairNormalizationPaths } from "./type-surface-current-pin-repair-source-history.mjs";
import { beforePhpWasmCallbackEntryFormRepairSource, phpWasmCallbackEntryFormRepairNormalizationPaths } from "./php-wasm-callback-entry-form-repair-source-history.mjs";
import { beforePhpWasmEntryOracleIntegrationSource, phpWasmEntryOracleIntegrationChangedPaths } from "./php-wasm-entry-oracle-integration-source-history.mjs";
import { beforePhpWasmEntryOracleRepairSource, phpWasmEntryOracleRepairNormalizationPaths } from "./php-wasm-entry-oracle-repair-source-history.mjs";
import { beforePhpWasmEntryOracleClosureSource, phpWasmEntryOracleClosureNormalizationPaths } from "./php-wasm-entry-oracle-closure-source-history.mjs";
import { beforePhpWasmEntryFlatPositionSource, phpWasmEntryFlatPositionNormalizationPaths } from "./php-wasm-entry-flat-position-source-history.mjs";
import { beforePhpWasmEntryUnreachedSourceSource, phpWasmEntryUnreachedSourceNormalizationPaths } from "./php-wasm-entry-unreached-source-source-history.mjs";
import { beforePhpWasmEntryCallPathSource, phpWasmEntryCallPathNormalizationPaths } from "./php-wasm-entry-call-path-source-history.mjs";
import { beforeNominalSubtypeEntryReportLinkSource, nominalSubtypeEntryReportLinkNormalizationPaths } from "./nominal-subtype-entry-report-link-source-history.mjs";
import { beforeNominalSubtypeEntryExportSurfaceSource, nominalSubtypeEntryExportSurfaceNormalizationPaths } from "./nominal-subtype-entry-export-surface-source-history.mjs";
import { beforePhpWasmNullaryEntryFormSource, phpWasmNullaryEntryFormNormalizationPaths } from "./php-wasm-nullary-entry-form-source-history.mjs";
import { beforeManagedResultOnlyFixtureRepairSource, managedResultOnlyFixtureRepairNormalizationPaths } from "./managed-result-only-fixture-repair-source-history.mjs";
import { beforeGenericSubtypeManagedTapEscapeRepairSource, genericSubtypeManagedTapEscapeRepairNormalizationPaths } from "./generic-subtype-managed-tap-escape-repair-source-history.mjs";
import { beforeStructuredCallableRecoveryGateRepairSource, structuredCallableRecoveryGateRepairNormalizationPaths } from "./structured-callable-recovery-gate-repair-source-history.mjs";
import { beforeOwnedSubtypeRemainingHostsTapRepairSource, ownedSubtypeRemainingHostsTapRepairNormalizationPaths } from "./owned-subtype-remaining-hosts-tap-repair-source-history.mjs";
import { beforeCoreEvidenceTrackingTestRegistrationSource, coreEvidenceTrackingTestRegistrationNormalizationPaths } from "./core-evidence-tracking-test-registration-source-history.mjs";
import { beforeCheckedRecordValueIndexBrowserControlsContractSource, checkedRecordValueIndexBrowserControlsContractNormalizationPaths } from "./checked-record-value-index-browser-controls-contract-source-history.mjs";
import { beforeOwnedTransferCopyReplayRepairSource, ownedTransferCopyReplayRepairNormalizationPaths } from "./owned-transfer-copy-replay-repair-source-history.mjs";
import { beforeOwnedSubtypeWasmTransferFixtureSource, ownedSubtypeWasmTransferFixtureNormalizationPaths } from "./owned-subtype-wasm-transfer-fixture-source-history.mjs";
import { beforeOwnedCheckedRecordJavaScriptHostedRunOutcomeSource, ownedCheckedRecordJavaScriptHostedRunOutcomeNormalizationPaths } from "./owned-checked-record-javascript-hosted-run-outcome-source-history.mjs";
import { beforeOwnedCheckedRecordJavaScriptHostedLaneSource, ownedCheckedRecordJavaScriptHostedLaneNormalizationPaths } from "./owned-checked-record-javascript-hosted-lane-source-history.mjs";
import { beforeCoreSourceBoundaryClosureSource, coreSourceBoundaryClosureNormalizationPaths } from "./core-source-boundary-closure-source-history.mjs";
import { beforeEvidenceCheckoutClosureRepairSource, evidenceCheckoutClosureRepairNormalizationPaths } from "./evidence-checkout-closure-repair-source-history.mjs";
import { beforeWitAcceptanceStopBoundarySource, witAcceptanceStopBoundaryNormalizationPaths } from "./wit-acceptance-stop-boundary-source-history.mjs";
import { beforeOwnedJvmLazyKotlinFactorySource, ownedJvmLazyKotlinFactoryNormalizationPaths } from "./owned-jvm-lazy-kotlin-factory-source-history.mjs";
import { beforeOwnedSubtypeLivePinCompletionSource, ownedSubtypeLivePinCompletionNormalizationPaths } from "./owned-subtype-live-pin-completion-source-history.mjs";
import { beforePhpWasmRecursiveEvidenceReplayRepairSource, phpWasmRecursiveEvidenceReplayRepairNormalizationPaths } from "./php-wasm-recursive-evidence-replay-repair-source-history.mjs";
import { beforeGenericSubtypeWitHelperWarningScopeSource, genericSubtypeWitHelperWarningScopeNormalizationPaths } from "./generic-subtype-wit-helper-warning-scope-source-history.mjs";
import { beforeOwnedSubtypeTestProfilePinRepairSource, ownedSubtypeTestProfilePinRepairNormalizationPaths } from "./owned-subtype-test-profile-pin-repair-source-history.mjs";
import { beforeWitRecursiveReaderTraversalRepairSource, witRecursiveReaderTraversalRepairNormalizationPaths } from "./wit-recursive-reader-traversal-repair-source-history.mjs";
import { beforeGenericSubtypeDotnetRuntimeProbeSource, genericSubtypeDotnetRuntimeProbeNormalizationPaths } from "./generic-subtype-dotnet-runtime-probe-source-history.mjs";
import { beforeGenericSubtypeEvidenceSourceClosureRepairSource, genericSubtypeEvidenceSourceClosureRepairChangedPaths } from "./generic-subtype-evidence-source-closure-repair-source-history.mjs";
import { beforeGenericSubtypeArtifactPrefixRepairSource, genericSubtypeArtifactPrefixRepairChangedPaths } from "./generic-subtype-artifact-prefix-repair-source-history.mjs";
import { beforeOwnedSubtypeWitHostNamespaceRepairSource, ownedSubtypeWitHostNamespaceRepairChangedPaths } from "./owned-subtype-wit-host-namespace-repair-source-history.mjs";
import { beforePhpWasmEntryStructuralEqualityRepairSource, phpWasmEntryStructuralEqualityRepairChangedPaths } from "./php-wasm-entry-structural-equality-repair-source-history.mjs";
import { beforeOwnedSubtypePerlSourcePathRepairSource, ownedSubtypePerlSourcePathRepairNormalizationPaths } from "./owned-subtype-perl-source-path-repair-source-history.mjs";
import { beforeGenericSubtypeDocumentationSource, genericSubtypeDocumentationNormalizationPaths } from "./generic-subtype-documentation-source-history.mjs";
import { beforeGenericSubtypePromotionSource, genericSubtypePromotionNormalizationPaths } from "./generic-subtype-promotion-source-history.mjs";
import { beforeGenericSubtypeHostedArchiveSource, genericSubtypeHostedArchiveNormalizationPaths } from "./generic-subtype-hosted-archive-source-history.mjs";
import { beforeRecursiveCheckedRecordDocumentationClosureSource, recursiveCheckedRecordDocumentationClosureNormalizationPaths } from "./recursive-checked-record-documentation-closure-source-history.mjs";
import { beforeValueIndexMatrixHistoricalInventoryRepairSource, valueIndexMatrixHistoricalInventoryRepairNormalizationPaths } from "./value-index-matrix-historical-inventory-repair-source-history.mjs";
import { beforeCheckedRefinementGateRepairSource, checkedRefinementGateRepairNormalizationPaths } from "./checked-refinement-gate-repair-source-history.mjs";
import { beforeDependentCheckedRecordPromotionSource, dependentCheckedRecordPromotionChangedPaths } from "./dependent-checked-record-promotion-source-history.mjs";
import { beforeDependentCheckedRecordDocumentationClosureSource, dependentCheckedRecordDocumentationClosureNormalizationPaths } from "./dependent-checked-record-documentation-closure-source-history.mjs";
import { beforeValueIndexBrowserPromotionClosureRepairSource, valueIndexBrowserPromotionClosureRepairNormalizationPaths } from "./value-index-browser-promotion-closure-repair-source-history.mjs";
import { beforeDependentCheckedRecordBrowserArchiveSource, dependentCheckedRecordBrowserArchiveImplementationPaths, dependentCheckedRecordBrowserArchiveIntegrationPaths } from "./dependent-checked-record-browser-archive-source-history.mjs";
import { beforeStagedPhpProducerReplayRepairSource, stagedPhpProducerReplayRepairNormalizationPaths } from "./staged-php-producer-replay-repair-source-history.mjs";
import { beforeDependentBrowserHandoffRetentionRepairSource, dependentBrowserHandoffRetentionRepairNormalizationPaths } from "./dependent-browser-handoff-retention-repair-source-history.mjs";
import { beforeWitRecursiveProducerReplayRepairSource, witRecursiveProducerReplayRepairNormalizationPaths } from "./wit-recursive-producer-replay-repair-source-history.mjs";
import { beforeJvmProducerReplayRepairSource, jvmProducerReplayRepairNormalizationPaths } from "./jvm-producer-replay-repair-source-history.mjs";
import { beforeOwnedReceiverProducerReplayRepairSource, ownedReceiverProducerReplayRepairNormalizationPaths } from "./owned-receiver-producer-replay-repair-source-history.mjs";
import { beforeOwnedTransferProducerReplayRepairSource, ownedTransferProducerReplayRepairNormalizationPaths } from "./owned-transfer-producer-replay-repair-source-history.mjs";
import { beforeOwnedPythonBorrowProducerReplayRepairSource, ownedPythonBorrowProducerReplayRepairNormalizationPaths } from "./owned-python-borrow-producer-replay-repair-source-history.mjs";
import { beforeOwnedPhpProducerReplayRepairSource, ownedPhpProducerReplayRepairNormalizationPaths } from "./owned-php-producer-replay-repair-source-history.mjs";
import { beforeOwnedJavaScriptTransferProducerReplayRepairSource, ownedJavaScriptTransferProducerReplayRepairNormalizationPaths } from "./owned-javascript-transfer-producer-replay-repair-source-history.mjs";
import { beforeOwnedPerlTransferProducerReplayRepairSource, ownedPerlTransferProducerReplayRepairNormalizationPaths } from "./owned-perl-transfer-producer-replay-repair-source-history.mjs";
import { beforePromotionDocMilestoneReplayRepairSource, promotionDocMilestoneReplayRepairNormalizationPaths } from "./promotion-doc-milestone-replay-repair-source-history.mjs";
import { beforeNestedPromotionDocMilestoneRepairSource, nestedPromotionDocMilestoneRepairNormalizationPaths } from "./nested-promotion-doc-milestone-repair-source-history.mjs";
import { beforeWorkflowMilestoneReplayRepairSource, workflowMilestoneReplayRepairNormalizationPaths } from "./workflow-milestone-replay-repair-source-history.mjs";
import { beforeCoreResidualLedgerPointerReplayRepairSource, coreResidualLedgerPointerReplayRepairNormalizationPaths } from "./core-residual-ledger-pointer-replay-repair-source-history.mjs";
import { beforeCoreRubyModelAvailabilityRepairSource, coreRubyModelAvailabilityRepairNormalizationPaths } from "./core-ruby-model-availability-repair-source-history.mjs";
import { beforeCoreResidualProducerReplayRepairSource, coreResidualProducerReplayRepairNormalizationPaths } from "./core-residual-producer-replay-repair-source-history.mjs";
import { beforeCallbackStagingLineageReplayRepairSource, callbackStagingLineageReplayRepairNormalizationPaths } from "./callback-staging-lineage-replay-repair-source-history.mjs";
import { beforeCallbackStagingProducerReplayRepairSource, callbackStagingProducerReplayRepairNormalizationPaths } from "./callback-staging-producer-replay-repair-source-history.mjs";
import { beforeCoreFirstRunPinReplayRepairSource, coreFirstRunPinReplayRepairNormalizationPaths } from "./core-first-run-pin-replay-repair-source-history.mjs";
import { beforeStructuredCallableProducerReplayRepairSource, structuredCallableProducerReplayRepairNormalizationPaths } from "./structured-callable-producer-replay-repair-source-history.mjs";
import { beforeNativeBudgetReplayRepairSource, nativeBudgetReplayRepairNormalizationPaths } from "./native-budget-replay-repair-source-history.mjs";
import { beforeInheritedDocsReplayRepairSource, inheritedDocsReplayRepairNormalizationPaths } from "./inherited-docs-replay-repair-source-history.mjs";
import { beforeValueIndexRustGeneratorReplayRepairSource, valueIndexRustGeneratorReplayRepairNormalizationPaths } from "./value-index-rust-generator-replay-repair-source-history.mjs";
import { beforeGenericSubtypeRustOraclePathRepairSource, genericSubtypeRustOraclePathRepairNormalizationPaths } from "./generic-subtype-rust-oracle-path-repair-source-history.mjs";
import { beforeDependentRecordAuthorityReplayRepairSource, dependentRecordAuthorityReplayRepairNormalizationPaths } from "./dependent-record-authority-replay-repair-source-history.mjs";
import { beforePreFinTypeSurfaceHistoryRepairSource, preFinTypeSurfaceHistoryRepairNormalizationPaths } from "./pre-fin-type-surface-history-repair-source-history.mjs";
import { beforeValueIndexPromotionMemoryRepairSource, valueIndexPromotionMemoryRepairNormalizationPaths } from "./value-index-promotion-memory-repair-source-history.mjs";
import { beforeNominalEntryTagRepairSource, nominalEntryTagRepairNormalizationPaths } from "./nominal-entry-tag-repair-source-history.mjs";
import { beforeCallbackCheckedRecordPromotionRefreshSource, callbackCheckedRecordPromotionRefreshNormalizationPaths } from "./callback-checked-record-promotion-refresh-source-history.mjs";
import { beforeCallbackCheckedRecordArchiveCommitProvenanceSource, callbackCheckedRecordArchiveCommitProvenanceNormalizationPaths } from "./callback-checked-record-archive-commit-provenance-source-history.mjs";
import { beforeCallbackCheckedRecordArchiveProvenanceRepairSource, callbackCheckedRecordArchiveProvenanceRepairNormalizationPaths } from "./callback-checked-record-archive-provenance-repair-source-history.mjs";
import { beforeCallbackCheckedRecordRetainedArchiveRolloverSource, callbackCheckedRecordRetainedArchiveRolloverNormalizationPaths } from "./callback-checked-record-retained-archive-rollover-source-history.mjs";
import { beforePhpWasmCallbackEntryTracePlanRepairSource, phpWasmCallbackEntryTracePlanRepairNormalizationPaths } from "./php-wasm-callback-entry-trace-plan-repair-source-history.mjs";
import { beforeDependentCheckedRecordBrowserReviewedRouteRepairSource, dependentCheckedRecordBrowserReviewedRouteRepairNormalizationPaths } from "./dependent-checked-record-browser-reviewed-route-repair-source-history.mjs";
import { beforeStructuredCallbackPublicFallbackRepairSource, structuredCallbackPublicFallbackRepairNormalizationPaths } from "./structured-callback-public-fallback-repair-source-history.mjs";
import { beforeCallbackCheckedRecordWitDiagnosticRepairSource, callbackCheckedRecordWitDiagnosticRepairNormalizationPaths } from "./callback-checked-record-wit-diagnostic-repair-source-history.mjs";
import { beforeValueIndexTestProfileLiveReadRepairSource, valueIndexTestProfileLiveReadRepairNormalizationPaths } from "./value-index-test-profile-live-read-repair-source-history.mjs";
import { beforePhpWasmCallbackEntrySelectionRepairSource, phpWasmCallbackEntrySelectionRepairNormalizationPaths } from "./php-wasm-callback-entry-selection-repair-source-history.mjs";
import { beforeCallbackRefinementsPhpWasmHostedArchiveSource, callbackRefinementsPhpWasmHostedArchiveNormalizationPaths } from "./callback-refinements-php-wasm-hosted-archive-source-history.mjs";
import { beforeCallbackRefinementsPhpWasmPromotionSource, callbackRefinementsPhpWasmPromotionNormalizationPaths } from "./callback-refinements-php-wasm-promotion-source-history.mjs";
import { beforeDependentCheckedRecordWitArchiveSource, dependentCheckedRecordWitArchiveImplementationPaths, dependentCheckedRecordWitArchiveIntegrationPaths } from "./dependent-checked-record-wit-archive-source-history.mjs";
import { beforeDependentCheckedRecordBrowserPathDiagnosticRepairSource, dependentCheckedRecordBrowserPathDiagnosticRepairChangedPaths, dependentCheckedRecordBrowserPathDiagnosticRepairIntegrationPaths } from "./dependent-checked-record-browser-path-diagnostic-repair-source-history.mjs";
import { beforeDependentCheckedRecordWitRetainedPkgConfigRepairSource, dependentCheckedRecordWitRetainedPkgConfigRepairChangedPaths, dependentCheckedRecordWitRetainedPkgConfigRepairIntegrationPaths } from "./dependent-checked-record-wit-retained-pkg-config-repair-source-history.mjs";
import { beforeCallbackPhpWasmStaticQualityRepairSource, callbackPhpWasmStaticQualityRepairIntegrationPaths, callbackPhpWasmStaticQualityRepairNormalizationPaths } from "./callback-php-wasm-static-quality-repair-source-history.mjs";
import { beforePhpWasmCallbackEntrySuiteSplitSource, phpWasmCallbackEntrySuiteSplitChangedPaths, phpWasmCallbackEntrySuiteSplitIntegrationPaths } from "./php-wasm-callback-entry-suite-split-source-history.mjs";
import { beforeDependentCheckedRecordPromotionContractSource, dependentCheckedRecordPromotionContractChangedPaths, dependentCheckedRecordPromotionContractIntegrationPaths } from "./dependent-checked-record-promotion-contract-source-history.mjs";
import { beforeHostedRefinementVerifierRepairSource, hostedRefinementVerifierRepairChangedPaths, hostedRefinementVerifierRepairIntegrationPaths } from "./hosted-refinement-verifier-repair-source-history.mjs";
import { beforeCallbackFinPhpWasmNominalRefusalRepairSource, callbackFinPhpWasmNominalRefusalRepairChangedPaths, callbackFinPhpWasmNominalRefusalRepairIntegrationPaths } from "./callback-fin-php-wasm-nominal-refusal-repair-source-history.mjs";
import { beforeDependentCheckedRecordPhpSpacePathRepairSource, dependentCheckedRecordPhpSpacePathRepairChangedPaths, dependentCheckedRecordPhpSpacePathRepairIntegrationPaths } from "./dependent-checked-record-php-space-path-repair-source-history.mjs";
import { beforeCallbackFinPhpWasmValidatorRepairSource, callbackFinPhpWasmValidatorRepairChangedPaths, callbackFinPhpWasmValidatorRepairIntegrationPaths } from "./callback-fin-php-wasm-validator-repair-source-history.mjs";
import { beforeOwnedCheckedRecordJavaScriptRetentionSource, ownedCheckedRecordJavaScriptRetentionChangedPaths } from "./owned-checked-record-javascript-retention-source-history.mjs";
import { beforeCallbackSubtypeRetainedPackagesSource, callbackSubtypeRetainedPackagesChangedPaths } from "./callback-subtype-retained-packages-source-history.mjs";
import { beforeCallbackCheckedRecordRetainedPackagesSource, callbackCheckedRecordRetainedPackagesChangedPaths } from "./callback-checked-record-retained-packages-source-history.mjs";
import { beforeRecursivePhpWasmEvidenceReplayRepairSource, recursivePhpWasmEvidenceReplayRepairChangedPaths } from "./recursive-php-wasm-evidence-replay-repair-source-history.mjs";
import { beforeOwnedCheckedRecordHostedArchiversSource, ownedCheckedRecordHostedArchiversChangedPaths } from "./owned-checked-record-hosted-archivers-source-history.mjs";
import { beforeZeroPayloadMatrixClosureSource, zeroPayloadMatrixClosureChangedPaths } from "./zero-payload-matrix-closure-source-history.mjs";
import { beforeOwnedCheckedRecordPhpWasmRetainedHandoffSource, ownedCheckedRecordPhpWasmRetainedHandoffChangedPaths } from "./owned-checked-record-php-wasm-retained-handoff-source-history.mjs";
import { beforeOwnedCheckedRecordEvidenceContractSource, ownedCheckedRecordEvidenceContractChangedPaths } from "./owned-checked-record-evidence-contract-source-history.mjs";
import { beforeOwnedSubtypePythonDependencyRepairSource, ownedSubtypePythonDependencyRepairChangedPaths } from "./owned-subtype-python-dependency-repair-source-history.mjs";
import { beforeOwnedSubtypeDocumentationTransactionSource, ownedSubtypeDocumentationTransactionChangedPaths } from "./owned-subtype-documentation-transaction-source-history.mjs";
import { beforeCallbackSubtypeHistoryTraversalRepairSource, callbackSubtypeHistoryTraversalRepairChangedPaths } from "./callback-subtype-history-traversal-repair-source-history.mjs";
import { beforeOwnedSubtypePerlIdentityRepairSource, ownedSubtypePerlIdentityRepairChangedPaths } from "./owned-subtype-perl-identity-repair-source-history.mjs";
import { beforeOwnedSubtypeWitResourceRepairSource, ownedSubtypeWitResourceRepairChangedPaths } from "./owned-subtype-wit-resource-repair-source-history.mjs";
import { beforeOwnedSubtypeJvmFilenameRepairSource, ownedSubtypeJvmFilenameRepairChangedPaths } from "./owned-subtype-jvm-filename-repair-source-history.mjs";
import { beforeOwnedSubtypePromotionContractSource, ownedSubtypePromotionContractChangedPaths } from "./owned-subtype-promotion-contract-source-history.mjs";
import { beforeOwnedSubtypeHostedArchiveSource, ownedSubtypeHostedArchiveChangedPaths } from "./owned-subtype-hosted-archive-source-history.mjs";
import { beforeOwnedSubtypeEvidenceTestRegistrationSource, ownedSubtypeEvidenceTestRegistrationChangedPaths } from "./owned-subtype-evidence-test-registration-source-history.mjs";
import { beforeOwnedSubtypeHostedEvidenceContractSource, ownedSubtypeHostedEvidenceContractChangedPaths } from "./owned-subtype-hosted-evidence-contract-source-history.mjs";
import { beforeCallbackSubtypeDocumentationReviewRepairSource, callbackSubtypeDocumentationReviewRepairChangedPaths } from "./callback-subtype-documentation-review-repair-source-history.mjs";
import { beforePhpWasmRefinementEntryGeneratorClosureSource, phpWasmRefinementEntryGeneratorClosureChangedPaths } from "./php-wasm-refinement-entry-generator-closure-source-history.mjs";
import { beforeCallbackSubtypeDocumentationReadinessSource, callbackSubtypeDocumentationReadinessChangedPaths } from "./callback-subtype-documentation-readiness-source-history.mjs";
import { beforeCallbackSubtypeTestRegistrationSource, callbackSubtypeTestRegistrationChangedPaths } from "./callback-subtype-test-registration-source-history.mjs";
import { beforeCallbackSubtypeReviewRepairSource, callbackSubtypeReviewRepairChangedPaths } from "./callback-subtype-review-repair-source-history.mjs";
import { beforeCallbackSubtypePromotionContractSource, callbackSubtypePromotionContractChangedPaths } from "./callback-subtype-promotion-contract-source-history.mjs";
import { beforeCallbackSubtypePromotionSource, callbackSubtypePromotionIntegrationPaths } from "./callback-subtype-promotion-source-history.mjs";
import { beforeCallbackSubtypeHostedArchiveFoundationSource, callbackSubtypeHostedArchiveFoundationChangedPaths } from "./callback-subtype-hosted-archive-foundation-source-history.mjs";
import { beforePhpWasmRefinementEntryDocumentationPrecisionSource, phpWasmRefinementEntryDocumentationPrecisionChangedPaths } from "./php-wasm-refinement-entry-documentation-precision-source-history.mjs";
import { beforePhpWasmRefinementEntryDocumentationSource, phpWasmRefinementEntryDocumentationChangedPaths } from "./php-wasm-refinement-entry-documentation-source-history.mjs";
import { beforePhpWasmRefinementEntryHostedVerifierRootSource, phpWasmRefinementEntryHostedVerifierRootChangedPaths } from "./php-wasm-refinement-entry-hosted-verifier-root-source-history.mjs";
import { beforePhpWasmRefinementEntryPromotionSource, phpWasmRefinementEntryPromotionChangedPaths } from "./php-wasm-refinement-entry-promotion-source-history.mjs";
import { beforePhpWasmRefinementEntryHostedVerifierClosureSource, phpWasmRefinementEntryHostedVerifierClosureChangedPaths } from "./php-wasm-refinement-entry-hosted-verifier-closure-source-history.mjs";
import { beforePhpWasmRefinementCiClosureRepairSource, phpWasmRefinementCiClosureRepairChangedPaths } from "./php-wasm-refinement-ci-closure-repair-source-history.mjs";
import { beforePhpWasmRefinementEntryHostedSource, phpWasmRefinementEntryHostedChangedPaths } from "./php-wasm-refinement-entry-hosted-source-history.mjs";
import { beforePhpWasmRefinementEntryMatrixSource, phpWasmRefinementEntryMatrixChangedPaths } from "./php-wasm-refinement-entry-matrix-source-history.mjs";
import { beforePhpWasmRefinementCiMatrixSource, phpWasmRefinementCiMatrixChangedPaths } from "./php-wasm-refinement-ci-matrix-source-history.mjs";
import { beforeCallbackSubtypeManagedConsumerRepairSource, callbackSubtypeManagedConsumerRepairChangedPaths } from "./callback-subtype-managed-consumer-repair-source-history.mjs";
import { beforePhpWasmIndexedRefinementEntrySource, phpWasmIndexedRefinementEntryChangedPaths } from "./php-wasm-indexed-refinement-entry-source-history.mjs";
import { beforeCallableClosureRefusalSource, callableClosureRefusalChangedPaths } from "./callable-closure-refusal-source-history.mjs";
import { beforePhpWasmCallbackEntrySource, phpWasmCallbackEntryChangedPaths } from "./php-wasm-callback-entry-source-history.mjs";
import { beforePhpWasmOwnedRefinementEntrySource, phpWasmOwnedRefinementEntryChangedPaths } from "./php-wasm-owned-refinement-entry-source-history.mjs";
import { beforePhpWasmRefinementEntryInstalledSource, phpWasmRefinementEntryInstalledChangedPaths } from "./php-wasm-refinement-entry-installed-source-history.mjs";
import { beforeCallbackSubtypePhpWasmProfileSource, callbackSubtypePhpWasmProfileChangedPaths } from "./callback-subtype-php-wasm-profile-source-history.mjs";
import { beforeWitConsumerRootRepairSource, witConsumerRootRepairChangedPaths } from "./wit-consumer-root-repair-source-history.mjs";
import { beforeNominalEntryRepairSource, nominalEntryRepairChangedPaths } from "./nominal-entry-repair-source-history.mjs";
import { beforeCallbackRefinementsPhpWasmSource, callbackRefinementsPhpWasmChangedPaths } from "./callback-refinements-php-wasm-source-history.mjs";
import { beforeCallbackSubtypePhpWasmSource, callbackSubtypePhpWasmChangedPaths } from "./callback-subtype-php-wasm-source-history.mjs";
import { beforeOwnedCheckedRecordPhpWasmSource, ownedCheckedRecordPhpWasmChangedPaths } from "./owned-checked-record-php-wasm-source-history.mjs";
import { beforeOwnedSubtypePhpWasmQualificationSource, ownedSubtypePhpWasmQualificationChangedPaths } from "./owned-subtype-php-wasm-qualification-source-history.mjs";
import { beforeOwnedSubtypePhpWasmPackageGapSource, ownedSubtypePhpWasmPackageGapChangedPaths } from "./owned-subtype-php-wasm-package-gap-source-history.mjs";
import { beforeOwnedCheckedRecordManagedSource, ownedCheckedRecordManagedChangedPaths } from "./owned-checked-record-managed-source-history.mjs";
import { beforeOwnedCheckedRecordLanguageSource, ownedCheckedRecordLanguageChangedPaths } from "./owned-checked-record-language-source-history.mjs";
import { beforeOwnedCheckedRecordNativePerlSource, ownedCheckedRecordNativePerlChangedPaths } from "./owned-checked-record-native-perl-source-history.mjs";
import { beforeOwnedCheckedRecordJavaScriptSource, ownedCheckedRecordJavaScriptChangedPaths } from "./owned-checked-record-javascript-source-history.mjs";
import { beforeOwnedCheckedRecordCallableSource, ownedCheckedRecordCallableChangedPaths } from "./owned-checked-record-callable-source-history.mjs";
import { beforeOwnedCheckedRecordFoundationSource, ownedCheckedRecordFoundationChangedPaths, ownedCheckedRecordFoundationIntegrationPaths } from "./owned-checked-record-foundation-source-history.mjs";
import { beforeDependentRecordConstructorAuthoritySource, dependentRecordConstructorAuthorityChangedPaths, dependentRecordConstructorAuthorityIntegrationPaths } from "./dependent-record-constructor-authority-source-history.mjs";
import { beforeCallbackCheckedRecordPromotionSource, callbackCheckedRecordPromotionChangedPaths, callbackCheckedRecordPromotionIntegrationPaths } from "./callback-checked-record-promotion-source-history.mjs";
import { beforeCallbackDependentIntegrationSource, callbackDependentIntegrationChangedPaths } from "./callback-dependent-integration-source-history.mjs";
import { beforeCallbackCheckedRecordNativeErrorRepairSource, callbackCheckedRecordNativeErrorRepairChangedPaths } from "./callback-checked-record-native-error-repair-source-history.mjs";
import { beforeCallbackCheckedRecordRemainingSource, callbackCheckedRecordRemainingChangedPaths } from "./callback-checked-record-remaining-source-history.mjs";
import { beforeCallbackCheckedRecordLanguageSource, callbackCheckedRecordLanguageChangedPaths } from "./callback-checked-record-language-source-history.mjs";
import { beforeCallbackCheckedRecordNativeSource, callbackCheckedRecordNativeChangedPaths, callbackCheckedRecordNativeIntegrationPaths } from "./callback-checked-record-native-source-history.mjs";
import { beforeCallbackCheckedRecordNpmBrowserSource, callbackCheckedRecordNpmBrowserChangedPaths, callbackCheckedRecordNpmBrowserIntegrationPaths } from "./callback-checked-record-npm-browser-source-history.mjs";
import { beforeCallbackCheckedRecordFoundationSource, callbackCheckedRecordFoundationChangedPaths, callbackCheckedRecordFoundationIntegrationPaths } from "./callback-checked-record-foundation-source-history.mjs";
import { beforeDependentCheckedRecordJvmArchiveSource, dependentCheckedRecordJvmArchiveImplementationPaths, dependentCheckedRecordJvmArchiveIntegrationPaths } from "./dependent-checked-record-jvm-archive-source-history.mjs";
import { beforeDependentCheckedRecordPhpArchiveSource, dependentCheckedRecordPhpArchiveImplementationPaths, dependentCheckedRecordPhpArchiveIntegrationPaths } from "./dependent-checked-record-php-archive-source-history.mjs";
import { beforeDependentCheckedRecordWitPkgConfigSpaceRepairSource, dependentCheckedRecordWitPkgConfigSpaceRepairChangedPaths, dependentCheckedRecordWitPkgConfigSpaceRepairIntegrationPaths } from "./dependent-checked-record-wit-pkg-config-space-repair-source-history.mjs";
import { beforeDependentCheckedRecordPromotionArtifactIdentityHardeningSource, dependentCheckedRecordPromotionArtifactIdentityHardeningChangedPaths, dependentCheckedRecordPromotionArtifactIdentityHardeningIntegrationPaths } from "./dependent-checked-record-promotion-artifact-identity-hardening-source-history.mjs";
import { beforeDependentCheckedRecordPhpWasmArchiveSource, dependentCheckedRecordPhpWasmArchiveImplementationPaths, dependentCheckedRecordPhpWasmArchiveIntegrationPaths } from "./dependent-checked-record-php-wasm-archive-source-history.mjs";
import { beforeDependentCheckedRecordWitExportCountRepairSource, dependentCheckedRecordWitExportCountRepairChangedPaths, dependentCheckedRecordWitExportCountRepairIntegrationPaths } from "./dependent-checked-record-wit-export-count-repair-source-history.mjs";
import { beforeDependentCheckedRecordBrowserDiagnosticRepairSource, dependentCheckedRecordBrowserDiagnosticRepairChangedPaths, dependentCheckedRecordBrowserDiagnosticRepairIntegrationPaths } from "./dependent-checked-record-browser-diagnostic-repair-source-history.mjs";
import { beforeDependentCheckedRecordDotnetArchiveSource, dependentCheckedRecordDotnetArchiveImplementationPaths, dependentCheckedRecordDotnetArchiveIntegrationPaths } from "./dependent-checked-record-dotnet-archive-source-history.mjs";
import { beforeDependentCheckedRecordNativeArchiveSource, dependentCheckedRecordNativeArchiveImplementationPaths, dependentCheckedRecordNativeArchiveIntegrationPaths } from "./dependent-checked-record-native-archive-source-history.mjs";
import { beforeDependentCheckedRecordHostedArchiversSource, dependentCheckedRecordHostedArchiversChangedPaths, dependentCheckedRecordHostedArchiversIntegrationPaths } from "./dependent-checked-record-hosted-archivers-source-history.mjs";
import { beforeNestedCheckedRecordRegressionContractSource, nestedCheckedRecordRegressionContractChangedPaths, nestedCheckedRecordRegressionContractIntegrationPaths } from "./nested-checked-record-regression-contract-source-history.mjs";
import { beforeDependentCheckedRecordPythonArchiveSource, dependentCheckedRecordPythonArchiveImplementationPaths, dependentCheckedRecordPythonArchiveIntegrationPaths } from "./dependent-checked-record-python-archive-source-history.mjs";
import { beforeDependentCheckedRecordPerlArchiveSource, dependentCheckedRecordPerlArchiveImplementationPaths, dependentCheckedRecordPerlArchiveIntegrationPaths } from "./dependent-checked-record-perl-archive-source-history.mjs";
import { beforeDependentCheckedRecordHostedFailureRepairSource, dependentCheckedRecordHostedFailureRepairChangedPaths, dependentCheckedRecordHostedFailureRepairIntegrationPaths } from "./dependent-checked-record-hosted-failure-repair-source-history.mjs";
import { beforeDependentCheckedRecordRubyArchiveSource, dependentCheckedRecordRubyArchiveImplementationPaths, dependentCheckedRecordRubyArchiveIntegrationPaths } from "./dependent-checked-record-ruby-archive-source-history.mjs";
import { beforeDependentCheckedRecordTypeSurfaceGapSource, dependentCheckedRecordTypeSurfaceGapHistoricalPaths, dependentCheckedRecordTypeSurfaceGapIntegrationPaths } from "./dependent-checked-record-type-surface-gap-source-history.mjs";
import { beforeDependentCheckedRecordPhpWasmSource, dependentCheckedRecordPhpWasmChangedPaths, dependentCheckedRecordPhpWasmIntegrationPaths } from "./dependent-checked-record-php-wasm-source-history.mjs";
import { beforeDependentCheckedRecordJvmSource, dependentCheckedRecordJvmChangedPaths, dependentCheckedRecordJvmIntegrationPaths } from "./dependent-checked-record-jvm-source-history.mjs";
import { beforeDependentCheckedRecordDotnetSource, dependentCheckedRecordDotnetChangedPaths, dependentCheckedRecordDotnetIntegrationPaths } from "./dependent-checked-record-dotnet-source-history.mjs";
import { beforeDependentCheckedRecordWitSource, dependentCheckedRecordWitChangedPaths, dependentCheckedRecordWitIntegrationPaths } from "./dependent-checked-record-wit-source-history.mjs";
import { beforeDependentCheckedRecordPhpSource, dependentCheckedRecordPhpChangedPaths, dependentCheckedRecordPhpIntegrationPaths } from "./dependent-checked-record-php-source-history.mjs";
import { beforeDependentCheckedRecordRustArchiveSource, dependentCheckedRecordRustArchiveIntegrationPaths } from "./dependent-checked-record-rust-archive-source-history.mjs";
import { beforeDependentCheckedRecordArchiveSelectionRepairSource, dependentCheckedRecordArchiveSelectionRepairChangedPaths, dependentCheckedRecordArchiveSelectionRepairIntegrationPaths } from "./dependent-checked-record-archive-selection-repair-source-history.mjs";
import { beforeZeroPayloadNativeControlContractSource, zeroPayloadNativeControlContractChangedPaths, zeroPayloadNativeControlContractIntegrationPaths } from "./zero-payload-native-control-contract-source-history.mjs";
import { beforeDependentCheckedRecordHostedArchivePreparationSource, dependentCheckedRecordHostedArchivePreparationChangedPaths, dependentCheckedRecordHostedArchivePreparationIntegrationPaths } from "./dependent-checked-record-hosted-archive-preparation-source-history.mjs";
import { beforeDependentCheckedRecordRustSource, dependentCheckedRecordRustChangedPaths, dependentCheckedRecordRustIntegrationPaths } from "./dependent-checked-record-rust-source-history.mjs";
import { beforeDependentCheckedRecordRubySource, dependentCheckedRecordRubyChangedPaths, dependentCheckedRecordRubyIntegrationPaths } from "./dependent-checked-record-ruby-source-history.mjs";
import { beforeDependentCheckedRecordPythonSource, dependentCheckedRecordPythonChangedPaths, dependentCheckedRecordPythonIntegrationPaths } from "./dependent-checked-record-python-source-history.mjs";
import { beforeDependentCheckedRecordPerlSource, dependentCheckedRecordPerlChangedPaths, dependentCheckedRecordPerlIntegrationPaths } from "./dependent-checked-record-perl-source-history.mjs";
import { beforeDependentCheckedRecordNativeSource, dependentCheckedRecordNativeChangedPaths, dependentCheckedRecordNativeIntegrationPaths } from "./dependent-checked-record-native-source-history.mjs";
import { beforeDependentCheckedRecordFoundationSource, dependentCheckedRecordFoundationChangedPaths, dependentCheckedRecordFoundationIntegrationPaths } from "./dependent-checked-record-foundation-source-history.mjs";
import { beforeDependentGenericSubtypeCiPinReconciliationSource, dependentGenericSubtypeCiPinReconciliationChangedPaths, dependentGenericSubtypeCiPinReconciliationIntegrationPaths } from "./dependent-generic-subtype-ci-pin-reconciliation-source-history.mjs";
import { beforeDependentGenericSubtypeCiSource, dependentGenericSubtypeCiChangedPaths, dependentGenericSubtypeCiIntegrationPaths } from "./dependent-generic-subtype-ci-source-history.mjs";
import { beforeDependentGenericSubtypeSource, dependentGenericSubtypeChangedPaths, dependentGenericSubtypeIntegrationPaths } from "./dependent-generic-subtype-source-history.mjs";
import { beforeGenericSubtypeTestRegistrationSource, genericSubtypeTestRegistrationChangedPaths, genericSubtypeTestRegistrationIntegrationPaths } from "./generic-subtype-test-registration-source-history.mjs";
import { beforeGenericSubtypeManagedWitSource, genericSubtypeManagedWitChangedPaths, genericSubtypeManagedWitIntegrationPaths } from "./generic-subtype-managed-wit-source-history.mjs";
import { beforeGenericSubtypeLanguageSource, genericSubtypeLanguageChangedPaths, genericSubtypeLanguageIntegrationPaths } from "./generic-subtype-language-source-history.mjs";
import { beforeGenericSubtypeNativePerlSource, genericSubtypeNativePerlChangedPaths, genericSubtypeNativePerlIntegrationPaths } from "./generic-subtype-native-perl-source-history.mjs";
import { beforeCallbackSubtypeHistoryPinReconciliationSource, callbackSubtypeHistoryPinReconciliationChangedPaths, callbackSubtypeHistoryPinReconciliationIntegrationPaths } from "./callback-subtype-history-pin-reconciliation-source-history.mjs";
import { beforeCallbackSubtypeRemainingPhpRepairSource, callbackSubtypeRemainingPhpRepairChangedPaths, callbackSubtypeRemainingPhpRepairIntegrationPaths } from "./callback-subtype-remaining-php-repair-source-history.mjs";
import { beforeZeroPayloadPhpWasmPromotionSource, zeroPayloadPhpWasmPromotionChangedPaths, zeroPayloadPhpWasmPromotionIntegrationPaths } from "./zero-payload-php-wasm-promotion-source-history.mjs";
import { beforeZeroPayloadPhpWasmArchiveSource, zeroPayloadPhpWasmArchiveChangedPaths, zeroPayloadPhpWasmArchiveIntegrationPaths } from "./zero-payload-php-wasm-archive-source-history.mjs";
import { beforeCallbackSubtypeRemainingRuntimeRepairSource, callbackSubtypeRemainingRuntimeRepairChangedPaths, callbackSubtypeRemainingRuntimeRepairIntegrationPaths } from "./callback-subtype-remaining-runtime-repair-source-history.mjs";
import { beforeOwnedSubtypeNativeTransferAcceptanceSource, ownedSubtypeNativeTransferAcceptanceChangedPaths, ownedSubtypeNativeTransferAcceptanceIntegrationPaths } from "./owned-subtype-native-transfer-acceptance-source-history.mjs";
import { beforeHostedAcceptanceHandoffRepairSource, hostedAcceptanceHandoffRepairChangedPaths, hostedAcceptanceHandoffRepairIntegrationPaths } from "./hosted-acceptance-handoff-repair-source-history.mjs";
import { beforeZeroPayloadPhpWasmPlainExportRepairSource, zeroPayloadPhpWasmPlainExportRepairChangedPaths, zeroPayloadPhpWasmPlainExportRepairIntegrationPaths } from "./zero-payload-php-wasm-plain-export-repair-source-history.mjs";
import { beforeZeroPayloadHostedPromotionSource, zeroPayloadHostedPromotionChangedPaths, zeroPayloadHostedPromotionIntegrationPaths } from "./zero-payload-hosted-promotion-source-history.mjs";
import { beforeZeroPayloadPerlWitEvidenceSource, zeroPayloadPerlWitEvidenceChangedPaths, zeroPayloadPerlWitEvidenceIntegrationPaths } from "./zero-payload-perl-wit-evidence-source-history.mjs";
import { beforeZeroPayloadLanguageEvidenceSource, zeroPayloadLanguageEvidenceChangedPaths, zeroPayloadLanguageEvidenceIntegrationPaths } from "./zero-payload-language-evidence-source-history.mjs";
import { beforeZeroPayloadHostedArchivePreparationSource, zeroPayloadHostedArchivePreparationChangedPaths, zeroPayloadHostedArchivePreparationIntegrationPaths } from "./zero-payload-hosted-archive-preparation-source-history.mjs";
import { beforeZeroPayloadBrowserEvidenceSource, zeroPayloadBrowserEvidenceChangedPaths, zeroPayloadBrowserEvidenceIntegrationPaths } from "./zero-payload-browser-evidence-source-history.mjs";
import { beforeZeroPayloadOrdinaryEvidenceExpectationSource, zeroPayloadOrdinaryEvidenceExpectationChangedPaths, zeroPayloadOrdinaryEvidenceExpectationIntegrationPaths } from "./zero-payload-ordinary-evidence-expectation-source-history.mjs";
import { beforeHistoryReaderBufferRepairSource, historyReaderBufferRepairChangedPaths, historyReaderBufferRepairIntegrationPaths } from "./history-reader-buffer-repair-source-history.mjs";
import { beforeHubTransitionGapSource, hubTransitionGapChangedPaths, hubTransitionGapHistoricalPaths } from "./hub-transition-gap-source-history.mjs";
import { beforeHistoryReaderHubRepairSource, historyReaderHubRepairChangedPaths, historyReaderHubRepairIntegrationPaths } from "./history-reader-hub-repair-source-history.mjs";
import { beforeLedgerTransitionGapSource, ledgerTransitionGapChangedPaths, ledgerTransitionGapHistoricalPaths } from "./ledger-transition-gap-source-history.mjs";
import { beforeZeroPayloadRustPromotionSource, zeroPayloadRustPromotionChangedPaths, zeroPayloadRustPromotionIntegrationPaths } from "./zero-payload-rust-promotion-source-history.mjs";
import { beforeZeroPayloadTypeSurfaceGapSource, zeroPayloadTypeSurfaceGapHistoricalPaths, zeroPayloadTypeSurfaceGapIntegrationPaths } from "./zero-payload-type-surface-gap-source-history.mjs";
import { beforeZeroPayloadDotnetPromotionSource, zeroPayloadDotnetPromotionChangedPaths, zeroPayloadDotnetPromotionIntegrationPaths } from "./zero-payload-dotnet-promotion-source-history.mjs";
import { beforeZeroPayloadJvmPromotionSource, zeroPayloadJvmPromotionChangedPaths, zeroPayloadJvmPromotionIntegrationPaths } from "./zero-payload-jvm-promotion-source-history.mjs";
import { beforeZeroPayloadRubyHistorySource, zeroPayloadRubyHistoryChangedPaths, zeroPayloadRubyHistoryIntegrationPaths } from "./zero-payload-ruby-source-history.mjs";
import { beforeZeroPayloadPythonHistorySource, zeroPayloadPythonHistoryChangedPaths, zeroPayloadPythonHistoryIntegrationPaths } from "./zero-payload-python-source-history.mjs";
import { beforeZeroPayloadJvmNullBoundarySource, zeroPayloadJvmNullBoundaryChangedPaths, zeroPayloadJvmNullBoundaryHistoricalPaths, zeroPayloadJvmNullBoundaryIntegrationPaths } from "./zero-payload-jvm-null-boundary-source-history.mjs";
import { beforeZeroPayloadNativePromotionSource, zeroPayloadNativePromotionChangedPaths, zeroPayloadNativePromotionIntegrationPaths } from "./zero-payload-native-promotion-source-history.mjs";
import { beforeZeroPayloadBrowserDiagnosticSource, zeroPayloadBrowserDiagnosticChangedPaths, zeroPayloadBrowserDiagnosticIntegrationPaths } from "./zero-payload-browser-diagnostic-source-history.mjs";
import { beforeZeroPayloadNativeEvidenceSource, zeroPayloadNativeEvidenceChangedPaths, zeroPayloadNativeEvidenceIntegrationPaths } from "./zero-payload-native-evidence-source-history.mjs";
import { beforeZeroPayloadPhpHistorySource, zeroPayloadPhpHistoryChangedPaths, zeroPayloadPhpHistoryIntegrationPaths } from "./zero-payload-php-source-history.mjs";
import { beforeZeroPayloadWitHistorySource, zeroPayloadWitHistoryChangedPaths, zeroPayloadWitHistoryIntegrationPaths } from "./zero-payload-wit-source-history.mjs";
import { beforeZeroPayloadPhpWasmHistorySource, zeroPayloadPhpWasmHistoryChangedPaths, zeroPayloadPhpWasmHistoryIntegrationPaths } from "./zero-payload-php-wasm-source-history.mjs";
import { beforeZeroPayloadPerlBooleanRepairSource, zeroPayloadPerlBooleanRepairChangedPaths } from "./zero-payload-perl-boolean-repair-source-history.mjs";
import { beforeZeroPayloadPerlArchiveSource, zeroPayloadPerlArchiveChangedPaths, zeroPayloadPerlArchiveIntegrationPaths } from "./zero-payload-perl-archive-source-history.mjs";
import { beforeZeroPayloadRustArchiveSource, zeroPayloadRustArchiveChangedPaths, zeroPayloadRustArchiveIntegrationPaths } from "./zero-payload-rust-archive-source-history.mjs";
import { beforeZeroPayloadRustCiSource, zeroPayloadRustCiChangedPaths, zeroPayloadRustCiIntegrationPaths } from "./zero-payload-rust-ci-source-history.mjs";
import { beforeZeroPayloadRustAuditRepairSource, zeroPayloadRustAuditRepairChangedPaths, zeroPayloadRustAuditRepairIntegrationPaths } from "./zero-payload-rust-audit-repair-source-history.mjs";
import { beforeZeroPayloadRustInstalledSource, zeroPayloadRustInstalledChangedPaths, zeroPayloadRustInstalledIntegrationPaths } from "./zero-payload-rust-installed-source-history.mjs";
import { beforeZeroPayloadRustSource, zeroPayloadRustChangedPaths, zeroPayloadRustIntegrationPaths } from "./zero-payload-rust-source-history.mjs";
import { beforeZeroPayloadJvmArchiveSource, zeroPayloadJvmArchiveChangedPaths, zeroPayloadJvmArchiveIntegrationPaths } from "./zero-payload-jvm-archive-source-history.mjs";
import { beforeZeroPayloadJvmSource, zeroPayloadJvmChangedPaths, zeroPayloadJvmIntegrationPaths } from "./zero-payload-jvm-source-history.mjs";
import { beforeZeroPayloadDotnetControlRepairSource, zeroPayloadDotnetControlRepairChangedPaths, zeroPayloadDotnetControlRepairIntegrationPaths } from "./zero-payload-dotnet-control-repair-source-history.mjs";
import { beforeZeroPayloadDotnetArchiveSource, zeroPayloadDotnetArchiveChangedPaths, zeroPayloadDotnetArchiveIntegrationPaths } from "./zero-payload-dotnet-archive-source-history.mjs";
import { beforeZeroPayloadVariantSource, zeroPayloadVariantChangedPaths, zeroPayloadVariantIntegrationPaths } from "./zero-payload-variant-source-history.mjs";
import { beforeZeroPayloadDotnetVerifierRepairSource, zeroPayloadDotnetVerifierRepairChangedPaths, zeroPayloadDotnetVerifierRepairIntegrationPaths } from "./zero-payload-dotnet-verifier-repair-source-history.mjs";
import { beforeZeroPayloadDotnetCiSource, zeroPayloadDotnetCiChangedPaths, zeroPayloadDotnetCiIntegrationPaths } from "./zero-payload-dotnet-ci-source-history.mjs";
import { beforeZeroPayloadDotnetSource, zeroPayloadDotnetChangedPaths, zeroPayloadDotnetIntegrationPaths } from "./zero-payload-dotnet-source-history.mjs";
import { beforeZeroPayloadNativeArchiveSource, zeroPayloadNativeArchiveChangedPaths, zeroPayloadNativeArchiveIntegrationPaths } from "./zero-payload-native-archive-source-history.mjs";
import { beforeZeroPayloadNativeSource, zeroPayloadNativeChangedPaths, zeroPayloadNativeIntegrationPaths } from "./zero-payload-native-source-history.mjs";
import { beforeZeroPayloadBrowserArchiveSource, zeroPayloadBrowserArchiveChangedPaths, zeroPayloadBrowserArchiveIntegrationPaths } from "./zero-payload-browser-archive-source-history.mjs";
import { beforeZeroPayloadBrowserCiSource, zeroPayloadBrowserCiChangedPaths, zeroPayloadBrowserCiIntegrationPaths } from "./zero-payload-browser-ci-source-history.mjs";
import { beforeZeroPayloadBrowserSource, zeroPayloadBrowserChangedPaths, zeroPayloadBrowserIntegrationPaths } from "./zero-payload-browser-source-history.mjs";
import { beforeZeroPayloadNpmInstalledSource, zeroPayloadNpmInstalledChangedPaths, zeroPayloadNpmInstalledIntegrationPaths } from "./zero-payload-npm-installed-source-history.mjs";
import { beforeZeroPayloadJavaScriptSource, zeroPayloadJavaScriptChangedPaths, zeroPayloadJavaScriptIntegrationPaths } from "./zero-payload-javascript-source-history.mjs";
import { beforeZeroPayloadNpmFoundationSource, zeroPayloadNpmFoundationChangedPaths, zeroPayloadNpmFoundationIntegrationPaths } from "./zero-payload-npm-foundation-source-history.mjs";
import { beforeZeroPayloadCheckedRecordSource, zeroPayloadCheckedRecordChangedPaths, zeroPayloadCheckedRecordIntegrationPaths } from "./zero-payload-checked-record-source-history.mjs";
import { beforeProjectedCheckedRecordMirrorSource, projectedCheckedRecordMirrorChangedPaths, projectedCheckedRecordMirrorIntegrationPaths } from "./projected-checked-record-mirror-source-history.mjs";
import { beforePerlEngineOwnedRefinementClosureSource, perlEngineOwnedRefinementClosureChangedPaths, perlEngineOwnedRefinementClosureIntegrationPaths } from "./perl-engine-owned-refinement-closure-source-history.mjs";
import { beforeStructuralSubtypePartitionValidatorSource, structuralSubtypePartitionValidatorChangedPaths, structuralSubtypePartitionValidatorIntegrationPaths } from "./structural-subtype-partition-validator-source-history.mjs";
import { beforeGenericSubtypeNpmBrowserSource, genericSubtypeNpmBrowserChangedPaths, genericSubtypeNpmBrowserIntegrationPaths } from "./generic-subtype-npm-browser-source-history.mjs";
import { beforeOwnedSubtypeCoreRegistrationSource, ownedSubtypeCoreRegistrationChangedPaths } from "./owned-subtype-core-registration-source-history.mjs";
import { beforeCoreRunnerHeadroomSource, coreRunnerHeadroomChangedPaths } from "./core-runner-headroom-source-history.mjs";
import { beforeGenericSubtypeCompositionSource, genericSubtypeCompositionChangedPaths } from "./generic-subtype-composition-source-history.mjs";
import { beforeOwnedSubtypeHostRegistrationSource, ownedSubtypeHostRegistrationChangedPaths } from "./owned-subtype-host-registration-source-history.mjs";
import { beforeOwnedSubtypeJavaScriptTransferSource, ownedSubtypeJavaScriptTransferChangedPaths } from "./owned-subtype-javascript-transfer-source-history.mjs";
import { beforeOwnedSubtypeJavaScriptHistoricalSource, beforeOwnedSubtypeJavaScriptSource, ownedSubtypeJavaScriptChangedPaths } from "./owned-subtype-javascript-source-history.mjs";
import { beforeOwnedRefinementCarriersSource, ownedRefinementCarriersChangedPaths } from "./owned-refinement-carriers-source-history.mjs";
import { beforeOwnedRefinementModelSource, ownedRefinementModelChangedPaths } from "./owned-refinement-model-source-history.mjs";
import { beforeOwnedSubtypeAnalysisSource, ownedSubtypeAnalysisChangedPaths } from "./owned-subtype-analysis-source-history.mjs";
import { beforeCallbackSubtypeRemainingSource, callbackSubtypeRemainingChangedPaths } from "./callback-subtype-remaining-source-history.mjs";
import { beforeCallbackSubtypeRemainingAcceptanceSource, callbackSubtypeRemainingAcceptanceChangedPaths } from "./callback-subtype-remaining-acceptance-source-history.mjs";
import { beforeCallbackSubtypeLanguageSource, callbackSubtypeLanguageChangedPaths } from "./callback-subtype-language-source-history.mjs";
import { beforeCallbackSubtypeNativeSource, callbackSubtypeNativeChangedPaths } from "./callback-subtype-native-source-history.mjs";
import { beforeCallbackSubtypeBrowserArtifactSource, callbackSubtypeBrowserArtifactChangedPaths } from "./callback-subtype-browser-artifact-source-history.mjs";
import { beforeCallbackSubtypeNpmAcceptanceSource, callbackSubtypeNpmAcceptanceChangedPaths } from "./callback-subtype-npm-acceptance-source-history.mjs";
import { beforeCallbackSubtypeNpmBrowserSource, callbackSubtypeNpmBrowserChangedPaths } from "./callback-subtype-npm-browser-source-history.mjs";
import { beforeCallbackSubtypeFoundationSource, callbackSubtypeFoundationChangedPaths } from "./callback-subtype-foundation-source-history.mjs";
import { beforeNominalSubtypeEntryMeasurementSource, nominalSubtypeEntryMeasurementChangedPaths } from "./nominal-subtype-entry-measurement-source-history.mjs";
import { beforeCheckedRecordValueIndexMatrixEvidencePinRepairSource, checkedRecordValueIndexMatrixEvidencePinRepairChangedPaths } from "./checked-record-value-index-matrix-evidence-pin-repair-source-history.mjs";
import { beforeCheckedRecordValueIndexMatrixPinRepairSource, checkedRecordValueIndexMatrixPinRepairChangedPaths } from "./checked-record-value-index-matrix-pin-repair-source-history.mjs";
import { beforeCheckedRecordValueIndexMatrixLintSource, checkedRecordValueIndexMatrixLintChangedPaths } from "./checked-record-value-index-matrix-lint-source-history.mjs";
import { beforeCheckedRecordValueIndexMatrixHistoryGapSource, checkedRecordValueIndexMatrixHistoryGapChangedPaths, checkedRecordValueIndexMatrixHistoryGapHistoricalPaths } from "./checked-record-value-index-matrix-history-gap-source-history.mjs";
import { beforeCheckedRecordValueIndexMatrixRegistrationSource, checkedRecordValueIndexMatrixRegistrationChangedPaths } from "./checked-record-value-index-matrix-registration-source-history.mjs";
import { beforeCheckedRecordValueIndexMatrixCheckoutSource, checkedRecordValueIndexMatrixCheckoutChangedPaths } from "./checked-record-value-index-matrix-checkout-source-history.mjs";
import { beforeCheckedRecordValueIndexMatrixPromotionSource, checkedRecordValueIndexMatrixPromotionChangedPaths } from "./checked-record-value-index-matrix-promotion-source-history.mjs";
import { beforeCheckedRecordValueIndexBrowserPromotionSource, checkedRecordValueIndexBrowserPromotionChangedPaths } from "./checked-record-value-index-browser-promotion-source-history.mjs";
import { beforeCheckedRecordValueIndexBrowserArchiveSource, checkedRecordValueIndexBrowserArchiveChangedPaths } from "./checked-record-value-index-browser-archive-source-history.mjs";
import { beforeCheckedRecordValueIndexPhpWasmSource, checkedRecordValueIndexPhpWasmChangedPaths } from "./checked-record-value-index-php-wasm-source-history.mjs";
import { beforeCheckedRecordValueIndexPhpWasmArchiveSource, checkedRecordValueIndexPhpWasmArchiveChangedPaths } from "./checked-record-value-index-php-wasm-archive-source-history.mjs";
import { beforeCheckedRecordValueIndexPhpWasmPromotionSource, checkedRecordValueIndexPhpWasmPromotionChangedPaths } from "./checked-record-value-index-php-wasm-promotion-source-history.mjs";
import { beforeCheckedRecordValueIndexRustCountRepairSource, checkedRecordValueIndexRustCountRepairChangedPaths } from "./checked-record-value-index-rust-count-repair-source-history.mjs";
import { beforeCheckedRecordValueIndexRustInventoryRepairSource, checkedRecordValueIndexRustInventoryRepairChangedPaths } from "./checked-record-value-index-rust-inventory-repair-source-history.mjs";
import { beforeCheckedRecordValueIndexRustResultOnlyRepairSource, checkedRecordValueIndexRustResultOnlyRepairChangedPaths } from "./checked-record-value-index-rust-result-only-repair-source-history.mjs";
import { beforeCheckedRecordValueIndexRustArchiveSource, checkedRecordValueIndexRustArchiveChangedPaths } from "./checked-record-value-index-rust-archive-source-history.mjs";
import { beforeCheckedRecordValueIndexRustPromotionSource, checkedRecordValueIndexRustPromotionChangedPaths } from "./checked-record-value-index-rust-promotion-source-history.mjs";
import { beforeCheckedRecordValueIndexRubyPromotionSource, checkedRecordValueIndexRubyPromotionChangedPaths } from "./checked-record-value-index-ruby-promotion-source-history.mjs";
import { beforeCheckedRecordValueIndexRubyArchiveSource, checkedRecordValueIndexRubyArchiveChangedPaths } from "./checked-record-value-index-ruby-archive-source-history.mjs";
import { beforeCheckedRecordValueIndexPythonPromotionSource, checkedRecordValueIndexPythonPromotionChangedPaths } from "./checked-record-value-index-python-promotion-source-history.mjs";
import { beforeCheckedRecordValueIndexWitVerifierRepairSource, checkedRecordValueIndexWitVerifierRepairChangedPaths } from "./checked-record-value-index-wit-verifier-repair-source-history.mjs";
import { beforeCheckedRecordValueIndexWitCallerWarningRepairSource, checkedRecordValueIndexWitCallerWarningRepairChangedPaths } from "./checked-record-value-index-wit-caller-warning-repair-source-history.mjs";
import { beforeCheckedRecordValueIndexWitArchiveSource, checkedRecordValueIndexWitArchiveChangedPaths } from "./checked-record-value-index-wit-archive-source-history.mjs";
import { beforeCheckedRecordValueIndexWitPromotionSource, checkedRecordValueIndexWitPromotionChangedPaths } from "./checked-record-value-index-wit-promotion-source-history.mjs";
import { beforeCheckedRecordValueIndexPythonArchiveHistoryGapSource, checkedRecordValueIndexPythonArchiveHistoryGapHistoricalPaths } from "./checked-record-value-index-python-archive-history-gap-source-history.mjs";
import { beforeCheckedRecordValueIndexPythonArchiveSource, checkedRecordValueIndexPythonArchiveChangedPaths } from "./checked-record-value-index-python-archive-source-history.mjs";
import { beforeCheckedRecordValueIndexPerlPromotionSource, checkedRecordValueIndexPerlPromotionChangedPaths } from "./checked-record-value-index-perl-promotion-source-history.mjs";
import { beforeCheckedRecordValueIndexPerlArchiveHistoryGapSource, checkedRecordValueIndexPerlArchiveHistoryGapHistoricalPaths } from "./checked-record-value-index-perl-archive-history-gap-source-history.mjs";
import { beforeCheckedRecordValueIndexPerlArchiveSource, checkedRecordValueIndexPerlArchiveChangedPaths } from "./checked-record-value-index-perl-archive-source-history.mjs";
import { beforeCheckedRecordValueIndexPhpPromotionSource, checkedRecordValueIndexPhpPromotionChangedPaths } from "./checked-record-value-index-php-promotion-source-history.mjs";
import { beforeCheckedRecordValueIndexPhpArchiveSource, checkedRecordValueIndexPhpArchiveChangedPaths } from "./checked-record-value-index-php-archive-source-history.mjs";
import { beforeValueIndexTestProfileGapSource, valueIndexTestProfileGapChangedPaths, valueIndexTestProfileGapHistoricalPaths } from "./value-index-test-profile-gap-source-history.mjs";
import { beforeTestProfilesRegistrationGapHistoricalSource, beforeTestProfilesRegistrationGapSource, testProfilesRegistrationGapHistoricalPaths, testProfilesRegistrationGapIntegrationPaths } from "./test-profiles-registration-gap-source-history.mjs";
import { beforeCheckedRecordValueIndexRubySource, checkedRecordValueIndexRubyChangedPaths } from "./checked-record-value-index-ruby-source-history.mjs";
import { beforeCheckedRecordValueIndexRustSource, checkedRecordValueIndexRustChangedPaths } from "./checked-record-value-index-rust-source-history.mjs";
import { beforeCheckedRecordValueIndexRustAcceptanceSource, checkedRecordValueIndexRustAcceptanceChangedPaths } from "./checked-record-value-index-rust-acceptance-source-history.mjs";
import { beforeCheckedRecordValueIndexWitAcceptanceSource, checkedRecordValueIndexWitAcceptanceChangedPaths } from "./checked-record-value-index-wit-acceptance-source-history.mjs";
import { beforeValueIndexNativeTapContractSource, valueIndexNativeTapContractChangedPaths } from "./value-index-native-tap-contract-source-history.mjs";
import { beforeCheckedRecordValueIndexWitSource, checkedRecordValueIndexWitChangedPaths } from "./checked-record-value-index-wit-source-history.mjs";
import { beforeCoreThirdRunResidualRepairSource, coreThirdRunResidualRepairChangedPaths } from "./core-third-run-residual-repair-source-history.mjs";
import { beforeValueIndexNativeBindingIrOrderingRepairSource, valueIndexNativeBindingIrOrderingRepairChangedPaths } from "./value-index-native-binding-ir-ordering-repair-source-history.mjs";
import { beforeCheckedRecordValueIndexNativeBindingIrSource, checkedRecordValueIndexNativeBindingIrChangedPaths } from "./checked-record-value-index-native-binding-ir-source-history.mjs";
import { beforeCoreSecondRunResidualRepairSource, coreSecondRunResidualRepairChangedPaths } from "./core-second-run-residual-repair-source-history.mjs";
import { beforeCheckedRecordValueIndexJvmNullBoundarySource, checkedRecordValueIndexJvmNullBoundaryChangedPaths } from "./checked-record-value-index-jvm-null-boundary-source-history.mjs";
import { beforeCheckedRecordValueIndexJvmNativeRepairSource, checkedRecordValueIndexJvmNativeRepairChangedPaths } from "./checked-record-value-index-jvm-native-repair-source-history.mjs";
import { beforeCoreFirstRunResidualRepairSource, coreFirstRunResidualRepairChangedPaths } from "./core-first-run-residual-repair-source-history.mjs";
import { beforeCoreTerminalReachabilityRepairSource, beforeCoreTerminalReachabilitySource, coreTerminalReachabilityChangedPaths, coreTerminalReachabilityTerminalPaths } from "./core-terminal-reachability-source-history.mjs";
import { beforeCoreFirstRunRepairSource, coreFirstRunRepairChangedPaths } from "./core-first-run-repair-source-history.mjs";
import { beforeCheckedRecordValueIndexPerlSource, checkedRecordValueIndexPerlChangedPaths, checkedRecordValueIndexPerlHistoricalPaths } from "./checked-record-value-index-perl-source-history.mjs";
import { beforeCheckedRecordValueIndexDotnetArchiveSource, checkedRecordValueIndexDotnetArchiveChangedPaths } from "./checked-record-value-index-dotnet-archive-source-history.mjs";
import { beforeCheckedRecordValueIndexDotnetResultOnlyCoreRepairSource, checkedRecordValueIndexDotnetResultOnlyCoreRepairChangedPaths } from "./checked-record-value-index-dotnet-result-only-core-repair-source-history.mjs";
import { beforeCheckedRecordValueIndexJvmSource, checkedRecordValueIndexJvmChangedPaths } from "./checked-record-value-index-jvm-source-history.mjs";
import { beforeCheckedRecordValueIndexNativeDotnetVerifierRepairSource, checkedRecordValueIndexNativeDotnetVerifierRepairChangedPaths } from "./checked-record-value-index-native-dotnet-verifier-repair-source-history.mjs";
import { beforeCheckedRecordValueIndexDotnetHostedRepairSource, checkedRecordValueIndexDotnetHostedRepairChangedPaths } from "./checked-record-value-index-dotnet-hosted-repair-source-history.mjs";
import { beforeCheckedRecordValueIndexDotnetCiSource, checkedRecordValueIndexDotnetCiChangedPaths } from "./checked-record-value-index-dotnet-ci-source-history.mjs";
import { beforeSourceHistoryMilestoneAssertionRepairSource, sourceHistoryMilestoneAssertionRepairChangedPaths } from "./source-history-milestone-assertion-repair.mjs";
import { beforeCheckedRecordValueIndexDotnetInstalledSource, checkedRecordValueIndexDotnetInstalledChangedPaths } from "./checked-record-value-index-dotnet-installed-source-history.mjs";
import { beforeCheckedRecordValueIndexDotnetSource, checkedRecordValueIndexDotnetChangedPaths } from "./checked-record-value-index-dotnet-source-history.mjs";
import { beforeValueIndexBrowserLintSource, valueIndexBrowserLintChangedPaths } from "./value-index-browser-lint-source-history.mjs";
import { beforeValueIndexCoreLineageRepairSource, valueIndexCoreLineageRepairChangedPaths, valueIndexCoreLineageRepairHistoricalPaths } from "./value-index-core-lineage-repair-source-history.mjs";
import { beforeCoreQualityShardingSource, coreQualityShardingChangedPaths } from "./core-quality-sharding-source-history.mjs";
import { beforeCheckedRecordValueIndexFoundationSource, checkedRecordValueIndexFoundationChangedPaths } from "./checked-record-value-index-foundation-source-history.mjs";
import { beforeRecursiveCheckedRecordPromotionSource, recursiveCheckedRecordPromotionChangedPaths } from "./recursive-checked-record-promotion-source-history.mjs";
import { beforeMutualCheckedRecordNativeArchiveSource, mutualCheckedRecordNativeArchiveChangedPaths } from "./mutual-checked-record-native-archive-source-history.mjs";
import { beforeRecursiveNativeGraphLoaderIsolationSource, recursiveNativeGraphLoaderIsolationChangedPaths } from "./recursive-native-graph-loader-isolation-source-history.mjs";
import { beforeRecursiveNativeGraphVerifierRepairSource, recursiveNativeGraphVerifierRepairChangedPaths } from "./recursive-native-graph-verifier-repair-source-history.mjs";
import { beforeRecursiveNativeSelectorRepairSource, recursiveNativeSelectorRepairChangedPaths } from "./recursive-native-selector-repair-source-history.mjs";
import { beforeCallbackFinGateRepairSource, callbackFinGateRepairChangedPaths } from "./callback-fin-gate-repair-source-history.mjs";
import { beforeDownstreamFinCiRepairHistoricalSource, beforeDownstreamFinCiRepairSource, downstreamFinCiRepairChangedPaths, downstreamFinCiRepairHistoricalPaths } from "./downstream-fin-ci-repair-source-history.mjs";
import { beforeHistoryHubReachabilityRepairSource, historyHubReachabilityRepairChangedPaths } from "./history-hub-reachability-repair-source-history.mjs";
import { beforeInheritedCheckedRecordFoundationVerifierSource, inheritedCheckedRecordFoundationVerifierChangedPaths, inheritedCheckedRecordFoundationVerifierHistoricalPaths } from "./inherited-checked-record-foundation-verifier-source-history.mjs";
import { beforePerlRecursiveConversionOutputSource, perlRecursiveConversionOutputChangedPaths } from "./perl-recursive-conversion-output-source-history.mjs";
import { beforeMutualCheckedRecordNativeReviewSource, mutualCheckedRecordNativeReviewChangedPaths } from "./mutual-checked-record-native-review-source-history.mjs";
import { beforeMutualCheckedRecordNativeHardeningSource, mutualCheckedRecordNativeHardeningChangedPaths } from "./mutual-checked-record-native-hardening-source-history.mjs";
import { beforeInheritedCheckedRecordDocsClosureSource, inheritedCheckedRecordDocsClosureChangedPaths } from "./inherited-checked-record-docs-closure-source-history.mjs";
import { beforeInheritedCheckedRecordPromotionSource, inheritedCheckedRecordPromotionChangedPaths } from "./inherited-checked-record-promotion-source-history.mjs";
import { beforeInheritedCheckedRecordPerlFinalVerifierSource, inheritedCheckedRecordPerlFinalVerifierChangedPaths } from "./inherited-checked-record-perl-final-verifier-source-history.mjs";
import { beforeInheritedCheckedRecordPerlArchiveSource, inheritedCheckedRecordPerlArchiveChangedPaths } from "./inherited-checked-record-perl-archive-source-history.mjs";
import { beforePrimitiveAuditCoreRepairSource, primitiveAuditCoreRepairChangedPaths } from "./primitive-audit-core-repair-source-history.mjs";
import { beforePrimitiveAuditIntegrationSource, primitiveAuditIntegrationChangedPaths } from "./primitive-audit-integration-source-history.mjs";
import { beforeInheritedCheckedRecordPerlVerifierSource, inheritedCheckedRecordPerlVerifierChangedPaths } from "./inherited-checked-record-perl-verifier-source-history.mjs";
import { beforeInheritedCheckedRecordPerlArgumentsSource, inheritedCheckedRecordPerlArgumentsChangedPaths } from "./inherited-checked-record-perl-arguments-source-history.mjs";
import { beforeInheritedCheckedRecordPerlStdoutSource, inheritedCheckedRecordPerlStdoutChangedPaths } from "./inherited-checked-record-perl-stdout-source-history.mjs";
import { beforeInheritedCheckedRecordPerlPinRepairSource, inheritedCheckedRecordPerlPinRepairChangedPaths } from "./inherited-checked-record-perl-pin-repair-source-history.mjs";
import { beforeInheritedCheckedRecordPerlSource, inheritedCheckedRecordPerlChangedPaths } from "./inherited-checked-record-perl-source-history.mjs";
import { beforeInheritedCheckedRecordPhpPinRepairSource, inheritedCheckedRecordPhpPinRepairChangedPaths } from "./inherited-checked-record-php-pin-repair-source-history.mjs";
import { beforeInheritedCheckedRecordPhpSource, inheritedCheckedRecordPhpChangedPaths } from "./inherited-checked-record-php-source-history.mjs";
import { beforePhpWasmWriterGuardSource, phpWasmWriterGuardChangedPaths } from "./php-wasm-writer-guard-source-history.mjs";
import { beforePhpCopiedKeywordSource, phpCopiedKeywordChangedPaths } from "./php-copied-keyword-source-history.mjs";
import { beforeInheritedCheckedRecordRubySource, inheritedCheckedRecordRubyChangedPaths } from "./inherited-checked-record-ruby-source-history.mjs";
import { beforeInheritedCheckedRecordDotnetArtifactRetentionSource, inheritedCheckedRecordDotnetArtifactRetentionChangedPaths } from "./inherited-checked-record-dotnet-artifact-retention-source-history.mjs";
import { beforeInheritedCheckedRecordHostedEvidenceSource, inheritedCheckedRecordHostedEvidenceChangedPaths } from "./inherited-checked-record-hosted-evidence-history.mjs";
import { beforeInheritedCheckedRecordPythonSource, inheritedCheckedRecordPythonChangedPaths } from "./inherited-checked-record-python-source-history.mjs";
import { beforeInheritedCheckedRecordJvmSource, inheritedCheckedRecordJvmChangedPaths } from "./inherited-checked-record-jvm-source-history.mjs";
import { beforeInheritedCheckedRecordDotnetSource, inheritedCheckedRecordDotnetChangedPaths } from "./inherited-checked-record-dotnet-source-history.mjs";
import { beforeCheckedRecordAliasAdmissionSource, checkedRecordAliasAdmissionChangedPaths } from "./checked-record-alias-admission-source-history.mjs";
import { beforeInheritedCheckedRecordTestRegistrationSource, inheritedCheckedRecordTestRegistrationChangedPaths } from "./inherited-checked-record-test-registration-history.mjs";
import { beforeInheritedCheckedRecordFoundationSource, inheritedCheckedRecordFoundationChangedPaths } from "./inherited-checked-record-foundation-history.mjs";
import { beforeCheckedJavaScriptDispositionSource, checkedJavaScriptDispositionChangedPaths } from "./checked-javascript-disposition-history.mjs";
import { beforeNestedCheckedRecordDiagnosticOracleSource, beforeNestedCheckedRecordNativeArchiveHistoricalSource, nestedCheckedRecordDiagnosticOracleChangedPaths, nestedCheckedRecordNativeArchiveHistoricalPaths } from "./nested-checked-record-diagnostic-oracle-source-history.mjs";
import { beforeRecursiveComponentRegressionRepairSource, recursiveComponentRegressionRepairChangedPaths } from "./recursive-component-regression-repair-source-history.mjs";
import { beforeRecursiveWitTestRegistrationSource, recursiveWitTestRegistrationChangedPaths } from "./recursive-wit-test-registration-history.mjs";
import { beforeLateCheckedRecordTestRegistrationSource, lateCheckedRecordTestRegistrationChangedPaths } from "./late-checked-record-test-registration-history.mjs";
import { beforeCiContractRepairSource, ciContractRepairChangedPaths } from "./ci-contract-repair-source-history.mjs";
import { beforeClosedGenericCheckedRecordSource, closedGenericCheckedRecordChangedPaths } from "./closed-generic-checked-record-source-history.mjs";
import { checkedRecordPerlPromotionChangedPaths } from "./checked-record-perl-promotion-history.mjs";
import { structuralSubtypeSelectionChangedPaths } from "./structural-subtype-selection-history.mjs";
import { structuralSubtypeRuntimeChangedPaths } from "./structural-subtype-runtime-history.mjs";
import { structuralSubtypeRegistrationChangedPaths } from "./structural-subtype-registration-history.mjs";
import { structuralSubtypeCiFoundationChangedPaths } from "./structural-subtype-ci-foundation-history.mjs";
import { structuralSubtypeCiWorkflowChangedPaths } from "./structural-subtype-ci-workflow-history.mjs";
import { structuralSubtypePromotionChangedPaths } from "./structural-subtype-promotion-history.mjs";
import { structuralSubtypeCoreCiChangedPaths } from "./structural-subtype-core-ci-history.mjs";
import { checkedRecordBrowserChangedPaths } from "./checked-record-browser-history.mjs";
import { finNixComparisonChangedPaths } from "./native-fin-nix-comparison-history.mjs";
import { perlContainerSubtypeCiChangedPaths } from "./perl-container-subtype-ci-history.mjs";
import { checkedRecordBrowserArchiveChangedPaths } from "./checked-record-browser-archive-history.mjs";
import { checkedRecordBrowserCiChangedPaths } from "./checked-record-browser-ci-history.mjs";
import { checkedRecordBrowserPromotionChangedPaths } from "./checked-record-browser-promotion-history.mjs";
import { checkedRecordPhpWasmChangedPaths } from "./checked-record-php-wasm-history.mjs";
import { checkedRecordPhpWasmArchiveChangedPaths } from "./checked-record-php-wasm-archive-history.mjs";
import { checkedRecordPhpWasmCiChangedPaths } from "./checked-record-php-wasm-ci-history.mjs";
import { checkedRecordPhpWasmPromotionChangedPaths } from "./checked-record-php-wasm-promotion-history.mjs";
import { nominalSubtypeConversionChangedPaths } from "./nominal-subtype-conversion-history.mjs";
import { perlHistoryCheckoutChangedPaths } from "./perl-history-checkout-history.mjs";
import { nominalSubtypeSelectionChangedPaths } from "./nominal-subtype-selection-history.mjs";
import { nominalSubtypeNativeChangedPaths } from "./nominal-subtype-native-history.mjs";
import { subtypeResultChangedPaths } from "./subtype-result-history.mjs";
import { nominalSubtypeAuthorChangedPaths } from "./nominal-subtype-author-history.mjs";
import { componentRefinementMirrorChangedPaths } from "./component-refinement-mirror-history.mjs";
import { jvmPendingExitChangedPaths } from "./jvm-pending-exit-history.mjs";
import { nativeHistoryCheckoutChangedPaths } from "./native-history-checkout-history.mjs";
import { componentNominalSubtypeChangedPaths } from "./component-nominal-subtype-history.mjs";
import { witHistoryCheckoutChangedPaths } from "./wit-history-checkout-history.mjs";
import { nominalSubtypeNpmPromotionChangedPaths } from "./nominal-subtype-npm-promotion-history.mjs";
import { nominalSubtypeNativePromotionChangedPaths } from "./nominal-subtype-native-promotion-history.mjs";
import { componentEngineClosureChangedPaths } from "./component-engine-closure-history.mjs";
import { nominalSubtypePerlRegistrationChangedPaths } from "./nominal-subtype-perl-registration-history.mjs";
import { cliImportRepairChangedPaths } from "./cli-import-repair-history.mjs";
import { coreContractRepairChangedPaths } from "./core-contract-repair-history.mjs";
import { nominalSubtypePerlPromotionChangedPaths } from "./nominal-subtype-perl-promotion-history.mjs";
import { nominalSubtypePythonRegistrationChangedPaths } from "./nominal-subtype-python-registration-history.mjs";
import { nominalSubtypePythonArchiveChangedPaths } from "./nominal-subtype-python-archive-history.mjs";
import { nominalSubtypePythonPromotionChangedPaths } from "./nominal-subtype-python-promotion-history.mjs";
import { nominalSubtypeRubyRegistrationChangedPaths } from "./nominal-subtype-ruby-registration-history.mjs";
import { nominalSubtypeRubyArchiveChangedPaths } from "./nominal-subtype-ruby-archive-history.mjs";
import { nominalSubtypeRubyPromotionChangedPaths } from "./nominal-subtype-ruby-promotion-history.mjs";
import { nominalSubtypeRustRegistrationChangedPaths } from "./nominal-subtype-rust-registration-history.mjs";
import { nominalSubtypeRustArchiveChangedPaths } from "./nominal-subtype-rust-archive-history.mjs";
import { nominalSubtypeRustPromotionChangedPaths } from "./nominal-subtype-rust-promotion-history.mjs";
import { nominalSubtypeDotnetRegistrationChangedPaths } from "./nominal-subtype-dotnet-registration-history.mjs";
import { witHistoryCheckoutRepairChangedPaths } from "./wit-history-checkout-repair-history.mjs";
import { nominalSubtypeDotnetCiChangedPaths } from "./nominal-subtype-dotnet-ci-history.mjs";
import { phpWasmFailureDiagnosticsChangedPaths } from "./php-wasm-failure-diagnostics-history.mjs";
import { jvmContainerEntryExitChangedPaths } from "./jvm-container-entry-exit-history.mjs";
import { nominalSubtypeDotnetPromotionChangedPaths } from "./nominal-subtype-dotnet-promotion-history.mjs";
import { nativeConsumerPartitionChangedPaths } from "./native-consumer-partition-history.mjs";
import { nominalSubtypeJvmRegistrationChangedPaths } from "./nominal-subtype-jvm-registration-history.mjs";
import { nativeOwnedGateChangedPaths } from "./native-owned-gate-history.mjs";
import { nativeFinJvmExitChangedPaths } from "./native-fin-jvm-exit-history.mjs";
import { nominalSubtypeJvmCiChangedPaths } from "./nominal-subtype-jvm-ci-history.mjs";
import { nominalSubtypeJvmPromotionChangedPaths } from "./nominal-subtype-jvm-promotion-history.mjs";
import { nominalSubtypePhpRegistrationChangedPaths } from "./nominal-subtype-php-registration-history.mjs";
import { managedNominalGateChangedPaths } from "./managed-nominal-gate-history.mjs";
import { nominalSubtypePhpCiChangedPaths } from "./nominal-subtype-php-ci-history.mjs";
import { nominalSubtypePhpPromotionChangedPaths } from "./nominal-subtype-php-promotion-history.mjs";
import { nominalSubtypeWitRegistrationChangedPaths } from "./nominal-subtype-wit-registration-history.mjs";
import { nominalSubtypeWitCiChangedPaths } from "./nominal-subtype-wit-ci-history.mjs";
import { nominalSubtypeWitPromotionChangedPaths } from "./nominal-subtype-wit-promotion-history.mjs";
import { nominalSubtypeBrowserRegistrationChangedPaths } from "./nominal-subtype-browser-registration-history.mjs";
import { nominalSubtypeBrowserPromotionChangedPaths } from "./nominal-subtype-browser-promotion-history.mjs";
import { nominalSubtypePhpWasmRegistrationChangedPaths } from "./nominal-subtype-php-wasm-registration-history.mjs";
import { nominalSubtypePhpWasmPromotionChangedPaths } from "./nominal-subtype-php-wasm-promotion-history.mjs";
import { nominalPrimitiveSubtypeRegistrationChangedPaths } from "./nominal-primitive-subtype-registration-history.mjs";
import { phpWasmCorpusPartitionChangedPaths } from "./php-wasm-corpus-partition-history.mjs";
import { nominalSubtypePhpWasmPathChangedPaths } from "./nominal-subtype-php-wasm-path-history.mjs";
import { nominalPrimitiveSubtypeNpmPromotionChangedPaths } from "./nominal-primitive-subtype-npm-promotion-history.mjs";
import { nominalPrimitiveSubtypePythonRegistrationChangedPaths } from "./nominal-primitive-subtype-python-registration-history.mjs";
import { nominalPrimitiveSubtypePythonPromotionChangedPaths } from "./nominal-primitive-subtype-python-promotion-history.mjs";
import { nominalPrimitiveSubtypeRubyRegistrationChangedPaths } from "./nominal-primitive-subtype-ruby-registration-history.mjs";
import { nominalPrimitiveSubtypeBrowserRegistrationChangedPaths } from "./nominal-primitive-subtype-browser-registration-history.mjs";
import { nominalPrimitiveSubtypeBrowserPromotionChangedPaths } from "./nominal-primitive-subtype-browser-promotion-history.mjs";
import { nominalPrimitiveSubtypeNativeRegistrationChangedPaths } from "./nominal-primitive-subtype-native-registration-history.mjs";
import { nominalPrimitiveSubtypeNativePromotionChangedPaths } from "./nominal-primitive-subtype-native-promotion-history.mjs";
import { coreQualityBudgetChangedPaths } from "./core-quality-budget-history.mjs";
import { nominalPrimitiveSubtypePerlRegistrationChangedPaths } from "./nominal-primitive-subtype-perl-registration-history.mjs";
import { nominalPrimitiveSubtypePerlIntegrationChangedPaths } from "./nominal-primitive-subtype-perl-integration-history.mjs";
import { nominalPrimitiveSubtypeRubyIntegrationChangedPaths } from "./nominal-primitive-subtype-ruby-integration-history.mjs";
import { nominalPrimitiveSubtypePerlPromotionChangedPaths } from "./nominal-primitive-subtype-perl-promotion-history.mjs";
import { beforeNominalPrimitiveSubtypeRubyPromotionSource, nominalPrimitiveSubtypeRubyPromotionChangedPaths } from "./nominal-primitive-subtype-ruby-promotion-history.mjs";
import { nominalSubtypeDotnetCeilingChangedPaths } from "./nominal-subtype-dotnet-ceiling-history.mjs";
import { primitiveSubtypeHistoryRepairChangedPaths } from "./primitive-subtype-history-repair.mjs";
import { beforeNominalPrimitiveSubtypeDotnetPromotionSource, nominalPrimitiveSubtypeDotnetPromotionChangedPaths } from "./nominal-primitive-subtype-dotnet-promotion-history.mjs";
import { beforeNominalPrimitiveSubtypePhpPromotionSource, nominalPrimitiveSubtypePhpPromotionChangedPaths } from "./nominal-primitive-subtype-php-promotion-history.mjs";
import { beforeNominalPrimitiveSubtypePhpWasmPromotionSource, nominalPrimitiveSubtypePhpWasmPromotionChangedPaths } from "./nominal-primitive-subtype-php-wasm-promotion-history.mjs";
import { beforeRecursiveSubtypePhpWasmSource, recursiveSubtypePhpWasmChangedPaths } from "./recursive-subtype-php-wasm-source-history.mjs";
import { beforeRecursiveSubtypePhpWasmPromotionSource, recursiveSubtypePhpWasmPromotionChangedPaths } from "./recursive-subtype-php-wasm-promotion-history.mjs";
import { beforeNominalPrimitiveSubtypeWitPromotionSource, nominalPrimitiveSubtypeWitPromotionChangedPaths } from "./nominal-primitive-subtype-wit-promotion-history.mjs";
import { beforeNominalPrimitiveSubtypeJvmPromotionSource, nominalPrimitiveSubtypeJvmPromotionChangedPaths } from "./nominal-primitive-subtype-jvm-promotion-history.mjs";
import { beforeNestedCheckedRecordNativeCorrectionSource, nestedCheckedRecordNativeCorrectionChangedPaths } from "./nested-checked-record-native-correction-source-history.mjs";
import { beforeNestedCheckedRecordNativePromotionSource, nestedCheckedRecordNativePromotionChangedPaths } from "./nested-checked-record-native-promotion-history.mjs";
import { beforeNestedCheckedRecordQualitySource, nestedCheckedRecordQualityChangedPaths } from "./nested-checked-record-quality-source-history.mjs";
import { beforeNestedCheckedRecordDotnetPromotionSource, nestedCheckedRecordDotnetPromotionChangedPaths } from "./nested-checked-record-dotnet-promotion-history.mjs";
import { beforeNominalPrimitiveSubtypeAuditCorrectionSource, nominalPrimitiveSubtypeAuditCorrectionChangedPaths } from "./nominal-primitive-subtype-audit-correction-history.mjs";
import { beforeNominalPrimitiveSubtypeRegistrationGapSource, beforeNominalPrimitiveSubtypeRegistrationRepairSource, nominalPrimitiveSubtypeRegistrationGapChangedPaths, nominalPrimitiveSubtypeRegistrationGapPath } from "./nominal-primitive-subtype-registration-gap-history.mjs";
import { beforeNestedCheckedRecordArchiveGapSource, beforeNestedCheckedRecordArchiveRepairSource, nestedCheckedRecordArchiveGapChangedPaths, nestedCheckedRecordArchiveGapPath } from "./nested-checked-record-archive-gap-history.mjs";
import { beforeNestedCheckedRecordJvmPromotionSource, nestedCheckedRecordJvmPromotionChangedPaths } from "./nested-checked-record-jvm-promotion-history.mjs";
import { beforeNestedCheckedRecordPerlPromotionSource, nestedCheckedRecordPerlPromotionChangedPaths } from "./nested-checked-record-perl-promotion-history.mjs";
import { beforeNestedCheckedRecordPhpPromotionSource, nestedCheckedRecordPhpPromotionChangedPaths } from "./nested-checked-record-php-promotion-history.mjs";
import { beforeNestedCheckedRecordPythonPromotionSource, nestedCheckedRecordPythonPromotionChangedPaths } from "./nested-checked-record-python-promotion-history.mjs";
import { beforeNestedCheckedRecordRubyPromotionSource, nestedCheckedRecordRubyPromotionChangedPaths } from "./nested-checked-record-ruby-promotion-history.mjs";
import { beforeNestedCheckedRecordWitPromotionSource, nestedCheckedRecordWitPromotionChangedPaths } from "./nested-checked-record-wit-promotion-history.mjs";
import { beforeNestedCheckedRecordPhpWasmPromotionSource, nestedCheckedRecordPhpWasmPromotionChangedPaths } from "./nested-checked-record-php-wasm-promotion-history.mjs";
import { beforeNestedCheckedRecordRustPromotionSource, nestedCheckedRecordRustPromotionChangedPaths } from "./nested-checked-record-rust-promotion-history.mjs";
import { beforeNestedCheckedRecordMatrixClosureSource, nestedCheckedRecordMatrixClosureChangedPaths } from "./nested-checked-record-matrix-closure-source-history.mjs";
import { beforeMutualCheckedRecordSource, mutualCheckedRecordChangedPaths } from "./mutual-checked-record-source-history.mjs";
import { beforeMutualCheckedRecordNpmSource, mutualCheckedRecordNpmChangedPaths } from "./mutual-checked-record-npm-source-history.mjs";
import { beforeMutualCheckedRecordNpmArchiveSource, mutualCheckedRecordNpmArchiveChangedPaths } from "./mutual-checked-record-npm-archive-source-history.mjs";
import { beforeMutualCheckedRecordDotnetSource, mutualCheckedRecordDotnetChangedPaths } from "./mutual-checked-record-dotnet-source-history.mjs";
import { beforeMutualCheckedRecordJvmSource, mutualCheckedRecordJvmChangedPaths } from "./mutual-checked-record-jvm-source-history.mjs";
import { beforeRecursiveCheckedRecordPerlDiagnosticSource, recursiveCheckedRecordPerlDiagnosticChangedPaths } from "./recursive-checked-record-perl-diagnostic-source-history.mjs";
import { beforeRecursiveCheckedRecordPerlPackageHistoryRepairSource, recursiveCheckedRecordPerlPackageHistoricalPaths, recursiveCheckedRecordPerlPackageHistoryRepairChangedPaths } from "./recursive-checked-record-perl-package-history-repair.mjs";
import { beforePhpGraphDiagnosticSource, phpGraphDiagnosticChangedPaths } from "./php-graph-diagnostic-source-history.mjs";
import { beforeWitGraphDiagnosticSource, witGraphDiagnosticChangedPaths } from "./wit-graph-diagnostic-source-history.mjs";
import { beforePythonGraphDiagnosticSource, pythonGraphDiagnosticChangedPaths } from "./python-graph-diagnostic-source-history.mjs";
import { beforeRubyGraphDiagnosticSource, rubyGraphDiagnosticChangedPaths } from "./ruby-graph-diagnostic-source-history.mjs";
import { beforeRubyGraphKeywordFieldSource, rubyGraphKeywordFieldChangedPaths } from "./ruby-graph-keyword-field-source-history.mjs";
import { beforeRubyMemberEscapeSource, rubyMemberEscapeChangedPaths } from "./ruby-member-escape-source-history.mjs";
import { beforeRustGraphDiagnosticSource, rustGraphDiagnosticChangedPaths } from "./rust-graph-diagnostic-source-history.mjs";
import { beforeNominalPrimitiveSubtypeRustPromotionSource, nominalPrimitiveSubtypeRustPromotionChangedPaths } from "./nominal-primitive-subtype-rust-promotion-history.mjs";
import { beforeNestedCheckedRecordSource, nestedCheckedRecordChangedPaths } from "./nested-checked-record-source-history.mjs";
import { beforeNestedCheckedRecordBrowserPromotionSource, nestedCheckedRecordBrowserPromotionChangedPaths } from "./nested-checked-record-browser-promotion-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeSubtypeRefinementSource, subtypeRefinementChangedPaths } from "./subtype-refinement-source-history.mjs";
import { subtypeHeapChangedPaths } from "./subtype-heap-source-history.mjs";
import { reviewedPerlDiagnosticChangedPaths } from "./reviewed-perl-diagnostic-history.mjs";
import { refinementFollowupChangedPaths } from "./refinement-followup-history.mjs";
import { finHistoryBufferRepairChangedPaths } from "./fin-history-buffer-repair.mjs";
import { reviewedSubtypeNativePromotionChangedPaths } from "./reviewed-subtype-native-promotion-history.mjs";
import { reviewedSubtypeHostCiReportChangedPaths } from "./reviewed-subtype-host-ci-report-history.mjs";
import { reviewedSubtypeHostCiChangedPaths } from "./reviewed-subtype-host-ci-history.mjs";
import { mavenPrerequisiteChangedPaths } from "./maven-prerequisite-history.mjs";
import { reviewedSubtypePackageRecordChangedPaths } from "./reviewed-subtype-package-record-history.mjs";
import { reviewedSubtypePackageCiChangedPaths } from "./reviewed-subtype-package-ci-history.mjs";
import { reviewedSubtypeBrowserChangedPaths } from "./reviewed-subtype-browser-history.mjs";
import { reviewedSubtypeBrowserCiChangedPaths } from "./reviewed-subtype-browser-ci-history.mjs";
import { reviewedSubtypeBrowserPromotionChangedPaths } from "./reviewed-subtype-browser-promotion-history.mjs";
import { checkedRecordNativeHostChangedPaths } from "./checked-record-native-host-history.mjs";
import { checkedRecordNativeInstalledChangedPaths } from "./checked-record-native-installed-history.mjs";
import { checkedRecordPythonArchiveChangedPaths } from "./checked-record-python-history.mjs";
import { checkedRecordRubyJvmArchiveChangedPaths } from "./checked-record-ruby-jvm-history.mjs";
import { checkedRecordRemainingHostsArchiveChangedPaths } from "./checked-record-remaining-hosts-history.mjs";
import { checkedRecordNativePromotionChangedPaths } from "./checked-record-native-promotion-history.mjs";
import { checkedRecordHostCiChangedPaths } from "./checked-record-host-ci-history.mjs";
import { refinementCoreCiChangedPaths } from "./refinement-core-ci-history.mjs";
import { checkedRecordPerlChangedPaths } from "./checked-record-perl-history.mjs";
import { checkedRecordPerlInstalledChangedPaths } from "./checked-record-perl-installed-history.mjs";
import { subtypeComponentChangedPaths } from "./subtype-component-source-history.mjs";
import { nestedFinChangedPaths, refinementClosureChangedPaths } from "./nested-fin-source-history.mjs";
import { nominalFinChangedPaths } from "./nominal-fin-source-history.mjs";
import { callbackFinChangedPaths } from "./callback-fin-source-history.mjs";
import { perlEvidenceRepairChangedPaths } from "./perl-evidence-repair-source-history.mjs";
import { nativeFinChangedPaths } from "./native-fin-source-history.mjs";
import { npmFinDiagnosticsChangedPaths } from "./npm-fin-diagnostics-source-history.mjs";
import { diagnosticFollowupChangedPaths } from "./diagnostic-followup-source-history.mjs";
import { combinedLineageChangedPaths } from "./combined-lineage-source-history.mjs";
import { testProfileRegistrationChangedPaths } from "./test-profile-registration-source-history.mjs";
import { runtimeReceiptChangedPaths } from "./runtime-receipt-source-history.mjs";
import { cpanCliControlChangedPaths } from "./cpan-cli-control-source-history.mjs";
import { pythonFinChangedPaths } from "./python-fin-source-history.mjs";
import { rustFinChangedPaths } from "./rust-fin-source-history.mjs";
import { rubyFinChangedPaths } from "./ruby-fin-source-history.mjs";
import { dotnetFinChangedPaths } from "./dotnet-fin-source-history.mjs";
import { jvmFinChangedPaths } from "./jvm-fin-source-history.mjs";
import { phpFinChangedPaths } from "./php-fin-source-history.mjs";
import { witFinChangedPaths } from "./wit-fin-source-history.mjs";
import { finDistributionChangedPaths } from "./fin-distribution-source-history.mjs";
import { perlFinChangedPaths } from "./perl-fin-source-history.mjs";
import { hostFinEvidenceChangedPaths } from "./host-fin-evidence-source-history.mjs";
import { nativeSpecializationsChangedPaths } from "./native-specializations-source-history.mjs";
import { nativeFinContainersChangedPaths } from "./native-fin-containers-source-history.mjs";
import { nativeSubtypeChangedPaths } from "./native-subtype-source-history.mjs";
import { refinementAuditChangedPaths } from "./refinement-audit-source-history.mjs";
import { browserRefinementsChangedPaths } from "./browser-refinements-source-history.mjs";
import { scalarFinRejectionChangedPaths } from "./scalar-fin-rejection-source-history.mjs";
import { scalarFinWordingChangedPaths } from "./scalar-fin-wording-source-history.mjs";
import { perlRefinementsChangedPaths } from "./perl-refinements-source-history.mjs";
import { perlIndexedErrorsChangedPaths } from "./perl-indexed-errors-source-history.mjs";
import { refinementCiRepairChangedPaths } from "./refinement-ci-repair-source-history.mjs";
import { pythonRefinementEvidenceChangedPaths } from "./python-refinement-evidence-source-history.mjs";
import { containerHostDispatchChangedPaths } from "./container-host-dispatch-source-history.mjs";
import { reviewedSemanticDecisionsChangedPaths } from "./reviewed-semantic-decisions-source-history.mjs";
import { genericRecordsChangedPaths } from "./generic-records-source-history.mjs";
import { reviewedFinChangedPaths } from "./reviewed-fin-source-history.mjs";
import { refinementHistoryCacheChangedPaths } from "./refinement-history-cache-source-history.mjs";
import { reviewedFinEvidenceChangedPaths } from "./reviewed-fin-evidence-source-history.mjs";
import { historyDigestChangedPaths } from "./history-digest-source-history.mjs";
import { genericRecordHostsChangedPaths } from "./generic-record-hosts-source-history.mjs";
import { genericRecordSpecializationChangedPaths } from "./generic-record-specialization-source-history.mjs";
import { refinementCoreFollowupChangedPaths } from "./refinement-core-followup-source-history.mjs";
import { perlFinArchiveChangedPaths } from "./perl-fin-archive-source-history.mjs";
import { reviewedScalarHostsChangedPaths } from "./reviewed-scalar-hosts-source-history.mjs";
import { refinementCiFollowupChangedPaths } from "./refinement-ci-followup-source-history.mjs";
import { perlFinXsAuditChangedPaths } from "./perl-fin-xs-audit-source-history.mjs";
import { finProductsChangedPaths } from "./fin-products-source-history.mjs";
import { genericRecordPromotionChangedPaths } from "./generic-record-promotion-source-history.mjs";
import { reviewedScalarRolloutChangedPaths } from "./reviewed-scalar-rollout-source-history.mjs";
import { finProductsCiChangedPaths } from "./fin-products-ci-source-history.mjs";
import { finProductsFloorsChangedPaths } from "./fin-products-floors-source-history.mjs";
import { genericRecordsEngineChangedPaths } from "./generic-records-engine-source-history.mjs";
import { finProductArraysChangedPaths } from "./fin-product-arrays-source-history.mjs";
import { reviewedFinAcceptanceChangedPaths } from "./reviewed-fin-acceptance-source-history.mjs";
import { nativeFinRecordsChangedPaths } from "./native-fin-records-source-history.mjs";
import { phpWasmFinChangedPaths } from "./php-wasm-fin-source-history.mjs";
import { reviewedFinPromotionChangedPaths } from "./reviewed-fin-promotion-source-history.mjs";
import { ciDependencyTimeoutChangedPaths } from "./ci-dependency-timeout-source-history.mjs";
import { finProductPhpNameChangedPaths } from "./fin-product-php-name-source-history.mjs";
import { phpReceiverDependencyChangedPaths } from "./php-receiver-dependency-source-history.mjs";
import { nativeFinPromotionChangedPaths } from "./native-fin-promotion-source-history.mjs";
import { reviewedSubtypeDecisionsChangedPaths } from "./reviewed-subtype-decisions-source-history.mjs";
import { witDependencyChangedPaths } from "./wit-dependency-source-history.mjs";
import { genericRecordBrowserChangedPaths } from "./generic-record-browser-source-history.mjs";
import { reviewedSpecializationAdmissionChangedPaths } from "./reviewed-specialization-admission-source-history.mjs";
import { phpWasmFinArchiveChangedPaths } from "./php-wasm-fin-archive-source-history.mjs";
import { genericRecordBrowserArchiveChangedPaths } from "./generic-record-browser-archive-source-history.mjs";
import { reviewedSpecializationCiHotfixChangedPaths } from "./reviewed-specialization-ci-hotfix-source-history.mjs";
import { nativeFinCallbackAdmissionChangedPaths } from "./native-fin-callback-admission-source-history.mjs";
import { reviewedSubtypeAdmissionChangedPaths } from "./reviewed-subtype-admission-source-history.mjs";
import { callbackCodeCiRepairChangedPaths } from "./callback-code-ci-repair-source-history.mjs";
import { reviewedCallbackFinAdmissionChangedPaths } from "./reviewed-callback-fin-admission-source-history.mjs";
import { nativeFinCallbackArchiveChangedPaths } from "./native-fin-callback-archive-source-history.mjs";
import { closureHistoryCiRepairChangedPaths } from "./closure-history-ci-repair-source-history.mjs";
import { reviewedNpmSnapshotChangedPaths } from "./reviewed-npm-snapshot-source-history.mjs";
import { reviewedSubtypeHarnessChangedPaths } from "./reviewed-subtype-harness-source-history.mjs";
import { reviewedCallbackHarnessChangedPaths } from "./reviewed-callback-harness-source-history.mjs";
import { reviewedSpecializationArchiveChangedPaths } from "./reviewed-specialization-archive-source-history.mjs";
import { reviewedInstantiationChangedPaths } from "./reviewed-instantiation-source-history.mjs";
import { browserCallbackArchiveChangedPaths } from "./browser-callback-archive-source-history.mjs";
import { subtypeFixtureLinkChangedPaths } from "./subtype-fixture-link-source-history.mjs";
import { inheritedRecordsChangedPaths } from "./inherited-records-source-history.mjs";
import { inheritanceSubtypeHarnessChangedPaths } from "./inheritance-subtype-harness-source-history.mjs";
import { reviewedSubtypeArchiveChangedPaths } from "./reviewed-subtype-archive-source-history.mjs";
import { reviewedApiPromotionChangedPaths } from "./reviewed-api-promotion-source-history.mjs";
import { subtypeAliasPositionChangedPaths } from "./subtype-alias-position-source-history.mjs";
import { finCallbackDiagnosticChangedPaths } from "./fin-callback-diagnostic-source-history.mjs";
import { subtypeXsArchiveChangedPaths } from "./subtype-xs-archive-source-history.mjs";
import { checkedRecordAdmissionChangedPaths } from "./checked-record-admission-source-history.mjs";
import { finPythonRubyArchiveChangedPaths } from "./fin-python-ruby-archive-source-history.mjs";
import { finRuntimeProvenanceChangedPaths } from "./fin-runtime-provenance-source-history.mjs";
import { finPythonRubyPromotionChangedPaths } from "./fin-python-ruby-promotion-source-history.mjs";
import { finPythonRubyHostNotesChangedPaths } from "./fin-python-ruby-host-notes-source-history.mjs";
import { finRecordWitFormatChangedPaths } from "./fin-record-wit-format-source-history.mjs";
import { browserInstallChangedPaths } from "./browser-install-source-history.mjs";
import { finWitArchiveChangedPaths } from "./fin-wit-archive-source-history.mjs";
import { jvmShardChangedPaths } from "./jvm-shard-source-history.mjs";
import { archiveBatchChangedPaths } from "./archive-batch-source-history.mjs";
import { finNativeBatchPromotionChangedPaths } from "./fin-native-batch-promotion-source-history.mjs";
import { phpShardChangedPaths } from "./php-shard-source-history.mjs";
import { checkedRecordPromotionChangedPaths } from "./checked-record-promotion-source-history.mjs";
import { copiedGraphRepairChangedPaths } from "./copied-graph-repair-source-history.mjs";
import { callbackFinPromotionChangedPaths } from "./callback-fin-promotion-source-history.mjs";
import { phpWasmReviewedFinChangedPaths } from "./php-wasm-reviewed-fin-source-history.mjs";
import { reviewedPhpWasmFinArchiveChangedPaths } from "./reviewed-php-wasm-fin-archive-source-history.mjs";
import { nativeConsumerCiRepairChangedPaths } from "./native-consumer-ci-repair-source-history.mjs";
import { phpWasmFinPromotionChangedPaths } from "./php-wasm-fin-promotion-source-history.mjs";
import { nativeFinReplyChangedPaths } from "./native-fin-reply-source-history.mjs";
import { callbackCoverageRepairChangedPaths } from "./callback-coverage-repair-source-history.mjs";
import { nativeFinReplyArchiveChangedPaths } from "./native-fin-reply-archive-source-history.mjs";
import { nativeFinReplyPromotionChangedPaths } from "./native-fin-reply-promotion-source-history.mjs";
import { nodeConsumerBudgetChangedPaths } from "./node-consumer-budget-source-history.mjs";
import { nativeReplySymbolFixChangedPaths } from "./native-reply-symbol-fix-source-history.mjs";
import { nativeReplyReviewChangedPaths } from "./native-reply-review-source-history.mjs";
import { scalarFinSourceEntryIntegrationChangedPaths } from "./scalar-fin-source-entry-integration-source-history.mjs";
import { scalarFinSourceEntryCiChangedPaths } from "./scalar-fin-source-entry-ci-source-history.mjs";
import { nativeReplyRefusalChangedPaths } from "./native-reply-refusal-source-history.mjs";
import { browserGenericPromotionChangedPaths } from "./browser-generic-promotion-source-history.mjs";
import { reviewedInstantiationArchiveChangedPaths } from "./reviewed-instantiation-archive-source-history.mjs";
import { phpDispatchIntegrationChangedPaths } from "./php-dispatch-integration-source-history.mjs";
import { reviewedRecordPromotionChangedPaths } from "./reviewed-record-promotion-source-history.mjs";
import { witDispatchIntegrationChangedPaths } from "./wit-dispatch-integration-source-history.mjs";
import { inheritedRecordArchiveChangedPaths, inheritedRecordArchiveProducerPins } from "./inherited-record-archive-source-history.mjs";
import { perlXsBudgetChangedPaths } from "./perl-xs-budget-source-history.mjs";
import { genericRefusalFixChangedPaths } from "./generic-refusal-fix-source-history.mjs";
import { inheritedRecordPromotionChangedPaths } from "./inherited-record-promotion-source-history.mjs";
import { rubyGdbCiChangedPaths } from "./ruby-gdb-ci-source-history.mjs";
import { genericNpmClosureChangedPaths } from "./generic-record-npm-closure-source-history.mjs";
import { perlRefinementHostedChangedPaths } from "./perl-refinement-hosted-source-history.mjs";
import { perlRelocatedConsumerChangedPaths } from "./perl-relocated-consumer-source-history.mjs";
import { rubyDispatchIntegrationChangedPaths } from "./ruby-dispatch-integration-source-history.mjs";
import { dotnetDispatchIntegrationChangedPaths } from "./dotnet-dispatch-integration-source-history.mjs";
import { authorRefinementDocsChangedPaths } from "./author-refinement-docs-source-history.mjs";
import { perlScalarRelocationChangedPaths } from "./perl-scalar-relocation-source-history.mjs";
import { jvmDispatchIntegrationChangedPaths } from "./jvm-dispatch-integration-source-history.mjs";
import { finScalarDispatchInventoryChangedPaths } from "./fin-scalar-dispatch-inventory-source-history.mjs";
import { reviewedFinRefusalChangedPaths } from "./reviewed-fin-refusal-source-history.mjs";
import { reviewedFinRefusalCiChangedPaths } from "./reviewed-fin-refusal-ci-source-history.mjs";
import { cppFinDispatchIntegrationChangedPaths } from "./cpp-fin-dispatch-integration-source-history.mjs";
import { perlRelocatedPromotionChangedPaths } from "./perl-relocated-promotion-source-history.mjs";
import { perlClosureNativeBudgetChangedPaths } from "./perl-closure-native-budget-source-history.mjs";
import { finEntryIntegrationChangedPaths } from "./fin-entry-integration-source-history.mjs";
import { finContainerEvidenceCiChangedPaths } from "./fin-container-evidence-ci-source-history.mjs";
import { hostedContainerInventoryChangedPaths } from "./hosted-container-inventory-source-history.mjs";
import { wasmEntryControlsChangedPaths } from "./wasm-entry-controls-source-history.mjs";
import { wasmEntryHarnessChangedPaths } from "./wasm-entry-harness-source-history.mjs";
import { nativeEdgeArrayHarnessChangedPaths } from "./native-edge-array-harness-source-history.mjs";
import { wasmEntryArchiveChangedPaths } from "./wasm-entry-archive-source-history.mjs";
import { wasmCiArrayChangedPaths } from "./wasm-ci-array-source-history.mjs";
import { perlScalarPromotionChangedPaths } from "./perl-scalar-promotion-source-history.mjs";
import { wasmEntrySupplementChangedPaths } from "./wasm-entry-supplement-source-history.mjs";
import { arrayRolloutChangedPaths } from "./generic-record-array-rollout-source-history.mjs";
import { finDiagnosticChangedPaths } from "./native-fin-diagnostic-source-history.mjs";
import { finDiagnosticCiChangedPaths } from "./native-fin-diagnostic-ci-history.mjs";
import { finEdgeIntegrationChangedPaths } from "./fin-container-edge-integration-history.mjs";
import { finEdgeCiChangedPaths } from "./fin-container-edge-ci-history.mjs";
import { finForeignChangedPaths } from "./fin-container-foreign-history.mjs";
import { finRecordOmissionChangedPaths } from "./fin-record-review-omission-history.mjs";
import { finHostedPromotionChangedPaths } from "./fin-native-hosted-promotion-history.mjs";
import { finZeroCiChangedPaths } from "./fin-record-zero-ci-history.mjs";
import { finNominalRefusalChangedPaths } from "./fin-nominal-refusal-history.mjs";
import { finAliasClosureChangedPaths } from "./fin-alias-closure-history.mjs";
import { phpWasmDirectFinChangedPaths } from "./php-wasm-fin-direct-history.mjs";
import { finCoreRepairChangedPaths } from "./fin-core-repair-history.mjs";
import { phpWasmDirectPromotionChangedPaths } from "./php-wasm-direct-fin-promotion-history.mjs";
import { phpWasmSubtypeChangedPaths } from "./php-wasm-subtype-history.mjs";
import { phpWasmSubtypeAcceptanceChangedPaths } from "./php-wasm-subtype-acceptance-history.mjs";
import { phpWasmSubtypePromotionChangedPaths } from "./php-wasm-subtype-promotion-history.mjs";
import { finDotnetSdkChangedPaths } from "./fin-dotnet-sdk-history.mjs";
import { finJvmDiagnosticsChangedPaths } from "./fin-jvm-diagnostics-history.mjs";
import { phpWasmSubtypeEntryChangedPaths } from "./php-wasm-subtype-entry-history.mjs";
import { phpWasmEntryHarnessChangedPaths } from "./php-wasm-entry-harness-history.mjs";
import { phpWasmEntryCiChangedPaths } from "./php-wasm-entry-ci-history.mjs";
import { reviewedSubtypeHostChangedPaths } from "./reviewed-subtype-host-history.mjs";
import { memoizeSourceHistory } from "./source-history-memo.mjs";

const extractorPath = "src/analyze/NativeExports.lean";
const previousExtractorSha256 = "9d39776bae35a6a4c0074e45dc710e17d4e4d7a74103b2b39ec9dfdd84818764";
const currentExtractorSha256 = "ca8620672a1a19eea8a665f75efbb6c500df0f095ed1fc09b7cd92d393f29221";
const typeSurfacePath = "docs/type-surface.v1.json";
const typeSurfaceEvidenceDirectory = new URL("../../docs/evidence/", import.meta.url);
const currentTypeSurfaceSha256 = "0a7ecf85d5b272a1615b3144d5ec6b6e4e1b54d0a4ce3c4da9f76dc1e4913f3b";
const previousTypeSurfaceSha256 = "6ef586e9ed2dfd5735051dc5ec7c1c9ef34f860e10a1672d20aebaa3c8d6e0d6";
const typeSurfaceHashes = new Map(Object.entries({
	"docs/consume/perl.md": ["8471ffe12646a951af6bdba20f1d7a05bbc866346ddeaaab579dc7a469780944", "b497b18adc826c368ed80a828a2ff9038cc2ae3da94a34e59c5e1764b419cbcf"]
	, "schema/compiler-adapter-plan.schema.json": ["f68868315de712ff3e9338fe7e0642477543d1ba1dfac4e63bb77658c97c3ab7", "7925c40f253ad5ca06979d94e5e0cdb381dd4afa73b1cd46e40b083de3f262e4"]
	, "schema/elaborated-export-metadata.schema.json": ["f8565778550a99196646b6a3c3cfd64afffe39f590ae47c25d731db16afd81a8", "cb13ae5f230dedb93bcba1a8b7e1b66cd1af0f8761b3ef0212299523727da985"]
	, "src/analyze/NativeExports.lean": ["ca8620672a1a19eea8a665f75efbb6c500df0f095ed1fc09b7cd92d393f29221", "9d39776bae35a6a4c0074e45dc710e17d4e4d7a74103b2b39ec9dfdd84818764"]
	, "src/analyze/elaborated-metadata.mjs": ["3fec4ae8aaf94c90a224307ceac2757fa9ee865b2a592df8d95334f21ff1c653", "1362aa142e52680b630cbc36a5a10aea5b00e424eb65714eb8d751a7ae1577fb"]
	, "src/analyze/export-configuration.mjs": ["a7bb9d18660c30bccd691b5083a4c334746bdc3a01cc025f70e6cdf3a5e55f55", "2faf5839a254844babfaac7d0c6c7b59bb157ce289e76c3714edcdf5c45ef4c5"]
	, "src/analyze/semantic-model.mjs": ["2b11358d3c854cd32b55ad91ede6e5484fd1fbb7065b59fa34a29a868340178a", "88ee704bd1352ff7e1a6a2c906ebe86473c82aed083a5a81eaeeec01d3468fb9"]
	, "src/backends/javascript/generate.mjs": ["e7f8477ff42f6725aa22ed906e30fe3a46ae44dd0c58dbb4d8c25e4b2d8c2c0b", "d1f89f3865f16857423fa5d7bd1440aa1731759e0547bba504e4ab51e5570cc5"]
	, "src/build/compiler-adapters.mjs": ["c14c7c5627cb674080c46b048e8ccdbc9607fefb22f96d528f4f9965cc6d9989", "3a6f809c6eef78031ea960967674b4f8f3357c90b41a165b29cf5897ef74f81d"]
	, "src/build/component-record-adapters.mjs": ["40c42acc03c0fe60eb7e3e840af529b2aa7524584ad956fa755039f0711e661c", "8ae4f5c236fc59381f7c4a65c1f39b98a9e5e9c67cf3e9cb7f7650a35a988cef"]
	, "src/build/component-recursive-lean.mjs": ["d3fce28702480524d3f770f110c58c40b31615cd148c314a5ff43899ab5db6d2", "7bcff37a068738a5fc029621f411ae422ae6e286b5f31b13dfb5360fb0e74c28"]
	, "src/build/component-structured-callable-lean.mjs": ["0e633f2f262f7207f5705ad9cf46aafb291ea3c06733fbf5b0e2edaa8f23057a", "8791cb354561e54f7082126608ef058fc0f98abf72146d4eb0d32eeed7c6d369"]
	, "tests/helpers/jvm-shared-regression-receipt.mjs": ["7268ad407a1c8d7a273f99a4a7c1ae6ffe821429568cbd72ab9edd7de5121fb3", "d39a929ed62cab6a8ef99ed5aa48de6e7764f1bf91d9da043ca56515f3e29f11"]
	, "tests/helpers/test-registration-history.mjs": ["bf77e64e61779f785a1cd8625ae4974cc53a87f19d5cb67849a988b9263981e6", "0f4f01a834b80b9438c23afabfa926f4201f7754f92514763dd6d125d246dc4d"]
	, "tests/helpers/wit-host-source-history.mjs": ["069b16ef657859c32b560bb3187dc0f51ce13b8f2810885bf67467a859594969", "a383a539e7e8888f93ea3312231d720625009187cf35096d00f4d7abfe4ec79c"]
	, "tests/helpers/wit-package-source-history.mjs": ["82f1d54f96e72fac12d4f80ca81dc140e680d9af68aea52c71a432b615fba27d", "89a489e28268d8c7fa530a77dc0d14a0ce38a9ab3a5d8b5dbbfb6a910e20530d"]
	, "tests/unlocked-component.test.mjs": ["b4f2fc8701dc311ca9252fa29facab79a8ee1365760f007691712ac7c634318c", "ddb9a9e934605f8b16161639b15ff92ed3334b470ac0c638cad04d09c8c3fe51"]
}));
let typeSurfaceHistoryTransitions;
let typeSurfaceHistoryBranches;
let typeSurfaceBranchTransitions;
const sourceHistorySha256Pattern = /^[0-9a-f]{64}$/u;
const typeSurfacePathPattern
	= /"path"\s*:\s*"docs\/type-surface\.v1\.json"/gu;

const exactTypeSurfaceUpdateRanges = (raw, evidenceName) => {
	const targets = [...raw.matchAll(typeSurfacePathPattern)]
		.map(match => match.index);
	if(targets.length === 0) return [];
	const kinds = [], starts = [], selected = new Set(), ranges = [];
	let escaped = false, inString = false, target = 0;
	for(let index = 0; index < raw.length; ++index)
	{
		if(!inString && target < targets.length && index === targets[target])
		{
			assert.equal(kinds.at(-1), "object"
				, `${evidenceName} type-surface object`);
			selected.add(starts.at(-1));
			++target;
		}
		const character = raw[index];
		if(inString)
		{
			if(escaped) escaped = false;
			else if(character === "\\") escaped = true;
			else if(character === '"') inString = false;
			continue;
		}
		if(character === '"') inString = true;
		else if(character === "{")
		{
			kinds.push("object");
			starts.push(index);
		}
		else if(character === "[")
		{
			kinds.push("array");
			starts.push(index);
		}
		else if(character === "}")
		{
			if(kinds.pop() !== "object")
				assert.fail(`${evidenceName} JSON object`);
			const start = starts.pop();
			if(selected.has(start)) ranges.push({ start, end: index + 1 });
		}
		else if(character === "]")
		{
			if(kinds.pop() !== "array")
				assert.fail(`${evidenceName} JSON array`);
			starts.pop();
		}
	}
	assert.equal(target, targets.length, `${evidenceName} type-surface paths`);
	assert.ok(ranges.length <= targets.length
		, `${evidenceName} type-surface update objects`);
	assert.equal(kinds.length, 0, `${evidenceName} balanced JSON objects`);
	assert.equal(starts.length, 0, `${evidenceName} balanced JSON offsets`);
	return ranges.sort((left, right) => left.start - right.start);
};

const jsonStringEnd = (source, start) => {
	assert.equal(source[start], '"');
	let escaped = false;
	for(let index = start + 1; index < source.length; ++index)
	{
		if(escaped) escaped = false;
		else if(source[index] === "\\") escaped = true;
		else if(source[index] === '"') return index + 1;
	}
	assert.fail("Unterminated JSON string");
};

const skipJsonValue = (source, start, end) => {
	if(source[start] === '"') return jsonStringEnd(source, start);
	if(source[start] !== "{" && source[start] !== "[")
	{
		let index = start;
		while(index < end && source[index] !== "," && source[index] !== "}")
			++index;
		return index;
	}
	const opening = source[start], closing = opening === "{" ? "}" : "]";
	let depth = 0, escaped = false, inString = false;
	for(let index = start; index < end; ++index)
	{
		const character = source[index];
		if(inString)
		{
			if(escaped) escaped = false;
			else if(character === "\\") escaped = true;
			else if(character === '"') inString = false;
		}
		else if(character === '"') inString = true;
		else if(character === opening) ++depth;
		else if(character === closing && --depth === 0) return index + 1;
	}
	assert.fail("Unterminated JSON value");
};

const exactTypeSurfaceTopLevelFields = (raw, range, evidenceName) => {
	const fields = new Map();
	let index = range.start + 1;
	while(index < range.end - 1)
	{
		while(/\s|,/u.test(raw[index])) ++index;
		if(index >= range.end - 1 || raw[index] === "}") break;
		assert.equal(raw[index], '"', `${evidenceName} update key`);
		const keyEnd = jsonStringEnd(raw, index);
		const key = JSON.parse(raw.slice(index, keyEnd));
		index = keyEnd;
		while(/\s/u.test(raw[index])) ++index;
		assert.equal(raw[index], ":", `${evidenceName} update separator`);
		++index;
		while(/\s/u.test(raw[index])) ++index;
		const valueStart = index;
		index = skipJsonValue(raw, index, range.end);
		fields.set(key, raw[valueStart] === '"'
			? JSON.parse(raw.slice(valueStart, index)) : undefined);
	}
	return fields;
};

const exactTypeSurfaceUpdateMetadata = (raw, range, evidenceName) => {
	const fields = exactTypeSurfaceTopLevelFields(raw, range, evidenceName);
	assert.equal(fields.get("path"), typeSurfacePath
		, `${evidenceName} type-surface path`);
	const currentSha256 = fields.get("currentSha256");
	if(currentSha256 === undefined) return { ignored: true };
	assert.ok(sourceHistorySha256Pattern.test(currentSha256)
		, `${evidenceName} current type-surface digest`);
	const previousSha256 = fields.get("previousSha256");
	if(previousSha256 === undefined)
	{
		assert.ok(fields.has("left") && fields.has("right")
			, `${evidenceName} branched type-surface sides`);
		const update = JSON.parse(raw.slice(range.start, range.end));
		const left = sourceHistorySha256Pattern.test(update.left?.previousSha256);
		const right = sourceHistorySha256Pattern.test(update.right?.previousSha256);
		assert.ok(left && right
			, `${evidenceName} branched type-surface update`);
		return {
			branched: true
			, currentSha256
			, leftPreviousSha256: update.left.previousSha256
			, rightPreviousSha256: update.right.previousSha256
		};
	}
	assert.ok(sourceHistorySha256Pattern.test(previousSha256)
		, `${evidenceName} previous type-surface digest`);
	return {
		branched: false
		, currentSha256
		, previousSha256
	};
};

const exactTypeSurfaceHistoryTransitions = () => {
	if(typeSurfaceHistoryTransitions) return typeSurfaceHistoryTransitions;
	const transitions = [], branches = [];
	for(const name of readdirSync(typeSurfaceEvidenceDirectory).sort())
	{
		if(!name.endsWith(".json")) continue;
		const raw = readFileSync(new URL(name, typeSurfaceEvidenceDirectory), "utf8");
		if(!raw.includes(`"${typeSurfacePath}"`)) continue;
		for(const range of exactTypeSurfaceUpdateRanges(raw, name))
		{
			const metadata = exactTypeSurfaceUpdateMetadata(raw, range, name);
			if(metadata.ignored) continue;
			if(metadata.branched)
			{
				branches.push({
					evidenceName: name
					, currentSha256: metadata.currentSha256
					, leftPreviousSha256: metadata.leftPreviousSha256
					, rightPreviousSha256: metadata.rightPreviousSha256
				});
				continue;
			}
			transitions.push({ evidenceName: name
				, currentSha256: metadata.currentSha256
				, previousSha256: metadata.previousSha256 });
		}
	}
	// The first Fin admission predates the JSON source-history convention, but
	// its exact endpoints and deterministic reversal are retained below. Join
	// that authenticated edge to the recorded September evidence graph.
	transitions.push({
		evidenceName: "built-in Fin type-surface transition"
		, currentSha256: currentTypeSurfaceSha256
		, previousSha256: previousTypeSurfaceSha256
		, builtInFin: true
	});
	assert.ok(transitions.length > 0, "Type-surface source history is recorded");
	typeSurfaceHistoryBranches = branches.length;
	typeSurfaceBranchTransitions = Object.freeze(branches);
	typeSurfaceHistoryTransitions = Object.freeze(transitions);
	return typeSurfaceHistoryTransitions;
};

const exactTypeSurfaceUpdate = transition => {
	assert.equal(transition.builtInFin, undefined);
	const raw = readFileSync(new URL(
		transition.evidenceName, typeSurfaceEvidenceDirectory
	), "utf8");
	const matches = [];
	for(const range of exactTypeSurfaceUpdateRanges(
		raw, transition.evidenceName
	)) {
		const metadata = exactTypeSurfaceUpdateMetadata(
			raw, range, transition.evidenceName
		);
		const linearMatch = !metadata.branched
			&& metadata.previousSha256 === transition.previousSha256;
		const branchMatch = metadata.branched && transition.branchSide
			&& metadata[`${transition.branchSide}PreviousSha256`]
				=== transition.previousSha256;
		if(!metadata.ignored
			&& metadata.currentSha256 === transition.currentSha256
			&& (linearMatch || branchMatch))
			matches.push(JSON.parse(raw.slice(range.start, range.end)));
	}
	assert.ok(matches.length > 0
		, `${transition.evidenceName} exact type-surface transition`);
	if(transition.branchSide !== undefined) return matches[0];
	const reversible = matches.filter(directlyReversibleTypeSurfaceUpdate);
	return reversible.find(update => update.edits !== undefined) ?? reversible[0];
};

/** Return the bounded reader's authenticated linear and merge transition counts. */
export const exactTypeSurfaceSourceHistoryStatistics = () => {
	const transitions = exactTypeSurfaceHistoryTransitions();
	return Object.freeze({
		linearTransitions: transitions.length
		, branchedTransitions: typeSurfaceHistoryBranches
	});
};

const exactTypeSurfaceHistoryPlan = (current, expected) => {
	const edges = new Map();
	const append = transition => {
		const outgoing = edges.get(transition.currentSha256) ?? [];
		if(!outgoing.some(item =>
			item.previousSha256 === transition.previousSha256
			&& item.branchSide === transition.branchSide)) outgoing.push(transition);
		edges.set(transition.currentSha256, outgoing);
	};
	for(const transition of exactTypeSurfaceHistoryTransitions())
		append(transition);
	for(const transition of typeSurfaceBranchTransitions)
	{
		append({ evidenceName: transition.evidenceName
			, currentSha256: transition.currentSha256
			, previousSha256: transition.leftPreviousSha256
			, branchSide: "left" });
		append({ evidenceName: transition.evidenceName
			, currentSha256: transition.currentSha256
			, previousSha256: transition.rightPreviousSha256
			, branchSide: "right" });
	}
	const find = (digest, seen) => {
		if(digest === expected) return [];
		if(seen.has(digest)) return undefined;
		const nextSeen = new Set(seen).add(digest);
		for(const transition of edges.get(digest) ?? [])
		{
			const rest = find(transition.previousSha256, nextSeen);
			if(rest) return [transition, ...rest];
		}
		return undefined;
	};
	if(expected !== undefined)
	{
		const selected = find(current, new Set());
		if(selected) return selected;
	}
	const plan = [], seen = new Set();
	while(edges.has(current))
	{
		assert.ok(!seen.has(current), `Cyclic type-surface history ${current}`);
		seen.add(current);
		const transition = edges.get(current).find(item =>
			item.branchSide !== "right"
		) ?? edges.get(current)[0];
		plan.push(transition);
		current = transition.previousSha256;
	}
	return plan;
};

const exactTypeSurfaceSpanEdit = item =>
	Object.keys(item).sort().join(",") === "current,previous,start";

const exactTypeSurfaceReplacementEdit = item => {
	const keys = Object.keys(item).sort();
	if(!keys.every(key => [
		"count", "current", "kind", "path", "previous"
	].includes(key))) return false;
	if(typeof item.current !== "string" || typeof item.previous !== "string"
		|| item.current === item.previous) return false;
	if(item.count !== undefined && (!Number.isSafeInteger(item.count)
		|| item.count < 1)) return false;
	return item.kind === undefined || item.kind === "source-hash";
};

const exactTypeSurfaceInventoryEdit = item =>
	exactTypeSurfaceReplacementEdit(item)
	|| ["evidence", "observation"].includes(item?.kind)
	&& typeof item.id === "string"
	&& sourceHistorySha256Pattern.test(item.currentSha256)
	&& Object.keys(item).sort().join(",") === "currentSha256,id,kind";

const directlyReversibleTypeSurfaceUpdate = update =>
	Array.isArray(update.replacements)
	&& update.replacements.length > 0
	&& update.replacements.every(item =>
		Object.keys(item).sort().join(",") === "count,current,previous"
	)
	|| Array.isArray(update.edits)
	&& update.edits.length > 0
	&& (update.edits.every(exactTypeSurfaceSpanEdit)
		|| update.strategy === "inventory"
		&& update.edits.every(exactTypeSurfaceInventoryEdit)
		|| update.edits.every(exactTypeSurfaceReplacementEdit));

const selectedExactTypeSurfaceUpdate = (transition, update) => {
	if(transition.branchSide === undefined) return update;
	const endpoint = update[transition.branchSide];
	assert.deepEqual(Object.keys(endpoint).sort(), ["edits", "previousSha256"]);
	assert.equal(endpoint.previousSha256, transition.previousSha256);
	return {
		path: update.path
		, currentSha256: update.currentSha256
		, previousSha256: endpoint.previousSha256
		, edits: endpoint.edits
	};
};

const appendTypeSurfacePiece = (pieces, text, start = 0, end = text.length) => {
	if(start === end) return;
	const previous = pieces.at(-1);
	if(previous?.text === text && previous.end === start) previous.end = end;
	else pieces.push({ text, start, end });
};

const typeSurfacePieceOffsets = pieces => {
	const offsets = [0];
	for(const piece of pieces)
		offsets.push(offsets.at(-1) + piece.end - piece.start);
	return offsets;
};

const typeSurfacePieceIndex = (offsets, position) => {
	let lower = 0, upper = offsets.length - 1;
	while(lower < upper)
	{
		const middle = Math.floor((lower + upper) / 2);
		if(offsets[middle + 1] <= position) lower = middle + 1;
		else upper = middle;
	}
	return lower;
};

const appendTypeSurfaceRange = (
	target, pieces, offsets, start, end
) => {
	if(start === end) return;
	assert.ok(start >= 0 && end >= start && end <= offsets.at(-1));
	let index = typeSurfacePieceIndex(offsets, start);
	let position = start;
	while(position < end)
	{
		const piece = pieces[index];
		const pieceStart = offsets[index];
		const localStart = piece.start + position - pieceStart;
		const localEnd = Math.min(piece.end
			, piece.start + end - pieceStart);
		appendTypeSurfacePiece(target, piece.text, localStart, localEnd);
		position += localEnd - localStart;
		++index;
	}
};

const typeSurfacePiecesText = pieces => pieces.map(piece =>
	piece.text.slice(piece.start, piece.end)
).join("");

const exactTypeSurfaceReplacementPositions = (pieces, current) => {
	const positions = [];
	let processed = 0, tail = "", lastEnd = 0;
	const retained = Math.max(0, current.length - 1);
	for(const piece of pieces)
	{
		const fragment = piece.text.slice(piece.start, piece.end);
		if(tail.length > 0)
		{
			const bridge = tail + fragment.slice(0, retained);
			let found = bridge.indexOf(current);
			while(found >= 0)
			{
				const position = processed - tail.length + found;
				if(found < tail.length && found + current.length > tail.length
					&& position >= lastEnd) {
					positions.push(position);
					lastEnd = position + current.length;
					}
				found = bridge.indexOf(current, found + current.length);
			}
		}
		let found = fragment.indexOf(current);
		while(found >= 0)
		{
			const position = processed + found;
			if(position >= lastEnd)
			{
				positions.push(position);
				lastEnd = position + current.length;
			}
			found = fragment.indexOf(current, found + current.length);
		}
		tail = retained === 0 ? "" : fragment.length >= retained
			? fragment.slice(-retained) : (tail + fragment).slice(-retained);
		processed += fragment.length;
	}
	return positions;
};

const reverseExactTypeSurfaceEdits = (pieces, update) => {
	const offsets = typeSurfacePieceOffsets(pieces);
	let cursor = 0;
	const previous = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= offsets.at(-1));
		assert.equal(typeof edit.current, "string");
		assert.equal(typeof edit.previous, "string");
		assert.notEqual(edit.current, edit.previous);
		appendTypeSurfaceRange(previous, pieces, offsets, cursor, edit.start);
		appendTypeSurfacePiece(previous, edit.previous);
		cursor = edit.start + edit.current.length;
	}
	appendTypeSurfaceRange(previous, pieces, offsets, cursor, offsets.at(-1));
	return previous;
};

const reverseExactTypeSurfaceReplacement = (
	pieces, replacement, transition
) => {
	assert.ok(exactTypeSurfaceReplacementEdit(replacement));
	assert.equal(typeof replacement.current, "string");
	assert.equal(typeof replacement.previous, "string");
	assert.notEqual(replacement.current, replacement.previous);
	const count = replacement.count ?? 1;
	assert.ok(Number.isSafeInteger(count) && count > 0);
	const positions = exactTypeSurfaceReplacementPositions(
		pieces, replacement.current
	);
	assert.equal(positions.length, count
		, transition.evidenceName);
	const offsets = typeSurfacePieceOffsets(pieces);
	const previous = [];
	let cursor = 0;
	for(const position of positions)
	{
		appendTypeSurfaceRange(previous, pieces, offsets, cursor, position);
		appendTypeSurfacePiece(previous, replacement.previous);
		cursor = position + replacement.current.length;
	}
	appendTypeSurfaceRange(previous, pieces, offsets, cursor, offsets.at(-1));
	return previous;
};

const reverseExactTypeSurfaceReplacements = (
	pieces, replacements, transition, reverse = true
) => {
	for(const replacement of reverse
		? [...replacements].reverse() : replacements)
		pieces = reverseExactTypeSurfaceReplacement(
			pieces, replacement, transition
		);
	return pieces;
};

const reverseExactTypeSurfaceInventory = (
	pieces, update
) => {
	const document = JSON.parse(typeSurfacePiecesText(pieces));
	for(const edit of update.edits.filter(item => item.kind !== "source-hash"))
	{
		const collection = edit.kind === "evidence"
			? document.evidence : document.observations;
		const index = collection.findIndex(item => item.id === edit.id);
		assert.notEqual(index, -1, edit.id);
		assert.equal(sha256(canonicalJson(collection[index]))
			, edit.currentSha256, edit.id);
		collection.splice(index, 1);
	}
	for(const edit of update.edits.filter(item => item.kind === "source-hash"))
	{
		let count = 0;
		for(const evidence of document.evidence)
			for(const file of evidence.files)
				if(file.path === edit.path && file.sha256 === edit.current)
				{
					file.sha256 = edit.previous;
					++count;
				}
		assert.equal(count, edit.count, edit.path);
	}
	const previous = JSON.stringify(document, null, 2) + "\n";
	return [{ text: previous
		, start: 0, end: previous.length }];
};

const reverseExactTypeSurfaceTransition = (pieces, transition, update) => {
	assert.ok(directlyReversibleTypeSurfaceUpdate(update)
		, `${transition.evidenceName} direct type-surface transition`);
	if(update.replacements !== undefined)
	{
		assert.deepEqual(Object.keys(update).sort(), [
			"currentSha256", "path", "previousSha256", "replacements"
		]);
		assert.ok(Array.isArray(update.replacements) && update.replacements.length > 0);
		pieces = reverseExactTypeSurfaceReplacements(
			pieces, update.replacements, transition, true
		);
	}
	else
	{
		const keys = Object.keys(update).sort().join(",");
		assert.ok(new Set([
			"currentSha256,edits,path,previousSha256"
			, "currentSha256,edits,path,previousCommit,previousSha256"
			, "currentCommit,currentSha256,edits,path,previousCommit,previousSha256"
			, "commit,currentSha256,edits,parent,path,previousSha256"
			, "currentSha256,edits,path,previousSha256,strategy"
			, "category,currentSha256,edits,path,previousSha256,strategy"
		]).has(keys), `${transition.evidenceName} type-surface update keys`);
		if(update.previousCommit !== undefined)
			assert.match(update.previousCommit, /^[0-9a-f]{40}$/u);
		if(update.currentCommit !== undefined)
			assert.match(update.currentCommit, /^[0-9a-f]{40}$/u);
		if(update.commit !== undefined)
		{
			assert.match(update.commit, /^[0-9a-f]{40}$/u);
			assert.match(update.parent, /^[0-9a-f]{40}$/u);
		}
		if(update.category === undefined)
		{
			if(update.strategy !== undefined)
				assert.ok(["replacements", "spans"].includes(update.strategy));
		}
		else
		{
			assert.equal(update.category, "administrative");
			assert.ok(["inventory", "replace-all", "source-hashes"]
				.includes(update.strategy));
		}
		assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
		if(update.strategy === "inventory")
			pieces = reverseExactTypeSurfaceInventory(pieces, update);
		else if(update.edits.every(exactTypeSurfaceSpanEdit))
			pieces = reverseExactTypeSurfaceEdits(pieces, update);
		else pieces = reverseExactTypeSurfaceReplacements(
			pieces, update.edits, transition
			, !["replace-all", "source-hashes"].includes(update.strategy)
		);
	}
	return pieces;
};
const verifierPath = "tests/helpers/test-registration-history.mjs";
const verifierEdits = {
	[verifierPath]: [
		['import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";\n', ""]
		, ["\tsource = beforeFinRefinementSource(path, source);\n", ""]
	]
	, "tests/helpers/jvm-shared-verifier-updates.mjs": [
		['import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";\n', ""]
		, ["\tsource = beforeFinRefinementSource(path, source);\n", ""]
	]
	, "tests/helpers/jvm-shared-regression-receipt.mjs": [
		['import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";\n', ""]
		, ['for(const [path, hash] of Object.entries(record.verifierSources)) assert.equal(sha256(beforeNativeSharedVerification(path, beforeFinRefinementSource(path, await readFile(path, "utf8")))), hash, path);'
			, 'for(const [path, hash] of Object.entries(record.verifierSources)) assert.equal(sha256(beforeNativeSharedVerification(path, await readFile(path, "utf8"))), hash, path);']
	]
	, "tests/helpers/wit-package-source-history.mjs": [
		['import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";\n', ""]
		, ["\tsource = beforeFinRefinementSource(path, source);\n", ""]
	]
	, "tests/helpers/wit-host-source-history.mjs": [
		['import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";\n', ""]
		, ["\tsource = beforeFinRefinementSource(path, source);\n", ""]
	]
};
const extractorEdits = [
	[`  if e.isAppOfArity \`\`Fin 1 then
    if depth != 0 || copied then
      reject e "Fin refinements currently require a top-level parameter or result"
    if request.profile.getD "component-scalars-v1" != "component-scalars-v1" then
      reject e "Fin refinements are not implemented by the native-library profile"
    let bound ← whnf e.appArg!
    let .lit (.natVal bound) := bound
      | reject e "Fin refinements require a closed literal bound"
    return obj [
      ("kind", str "refinement"),
      ("base", obj [("kind", str "primitive"), ("name", str "nat"),
        ("lean", str "Nat"), ("abi", ← abi (mkConst \`\`Nat))]),
      ("predicate", obj [("kind", str "fin"), ("bound", str (toString bound))]),
      ("abi", ← abi e)]
`
	, ""]
	, ['              if ["resource", "callback", "refinement"].contains ((target.getObjValAs? String "kind").toOption.getD "") then\n'
		, '              if ["resource", "callback"].contains ((target.getObjValAs? String "kind").toOption.getD "") then\n']
	, [`  if kind == "refinement" then
    return obj [("kind", str kind),
      ("base", ← componentCopiedType (← ofExcept <| value.getObjVal? "base")),
      ("predicate", ← ofExcept <| value.getObjVal? "predicate")]
`
	, ""]
	, [`    if refinement == str "reject" then
      if (type.getObjValAs? String "kind").toOption == some "refinement" then
        return some s!"{label}: the contract rejects compiler-checked refined values"
    else
`
	, `    if refinement != str "reject" then
`]
];
const transitions = {
	"docs/consume/perl.md": {
		current: "8471ffe12646a951af6bdba20f1d7a05bbc866346ddeaaab579dc7a469780944"
		, previous: "b497b18adc826c368ed80a828a2ff9038cc2ae3da94a34e59c5e1764b419cbcf"
		, edits: [
			["| `Polymorphic exports` | `Concrete named Perl subroutine for each configured specialization` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Each configured type application becomes a distinct monomorphic Perl subroutine. The unspecialized Lean declaration is absent. Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |"
				, "| `Polymorphic exports` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |"]
			, ["| `Implicit arguments {α}` | `Concrete Perl signature with no runtime type argument` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Lean elaboration supplies configured type arguments before native compilation; Perl passes no placeholder value. Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |"
				, "| `Implicit arguments {α}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |"]
			, ["| `Instance arguments [C α]` | `Concrete Perl signature with the Lean-selected instance dictionary erased` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Not audited | Lean synthesizes the selected dictionary before native compilation. Perl cannot provide or replace it. Required: Specialize or supply the selected dictionary without changing runtime behavior. |"
				, "| `Instance arguments [C α]` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specialize or supply the selected dictionary without changing runtime behavior. |"]
		]
	}
	, "docs/javascript-typescript.md": {
		current: "77c567cf9079bee4c307de75ea8e677c301bb67e10d9708005bd9dd3eb8090f2"
		, previous: "08a318f306d940eb87bc2310365a7eddde9650cb75db1e8ab59471ea613acafa"
		, edits: [
			["| `Fin n` | Node JavaScript / TypeScript: `bigint checked as 0 <= value < n before Wasm dispatch` (input); `bigint checked as 0 <= value < n after Wasm return` (result); Browser / React / Worker: No host mapping recorded | Ordinary source: Node JavaScript / TypeScript: Installed checks passed (input, result); Not audited (field, callback input, callback result); Browser / React / Worker: Not audited. Reviewed IR: Not audited | Node JavaScript / TypeScript: The public value is bigint. JavaScript validates Nat and the strict upper bound before dispatch and after return; the Lean adapter independently checks the input bound before constructing Fin. Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |"
				, "| `Fin n` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |"]
			, ["| `Polymorphic exports` | Node JavaScript / TypeScript: `Concrete named function for each configured specialization` (signature); `Named finite specializations` (signature); Browser / React / Worker: `Named finite specializations` (signature) | Ordinary source: Node JavaScript / TypeScript: Installed checks passed; Browser / React / Worker: Not audited. Reviewed IR: Generator inspected | Node JavaScript / TypeScript: Each configured type application becomes a distinct monomorphic export. The unspecialized Lean declaration is absent from the package. Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |"
				, "| `Polymorphic exports` | `Named finite specializations` (signature) | Ordinary source: Not audited. Reviewed IR: Generator inspected | Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |"]
			, ["| `Implicit arguments {α}` | Node JavaScript / TypeScript: `Concrete host signature with no runtime type argument` (signature); Browser / React / Worker: No host mapping recorded | Ordinary source: Node JavaScript / TypeScript: Installed checks passed; Browser / React / Worker: Not audited. Reviewed IR: Not audited | Node JavaScript / TypeScript: Lean elaboration supplies configured type arguments. They have no host runtime representation and are not replaced with null or any. Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |"
				, "| `Implicit arguments {α}` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |"]
			, ["| `Instance arguments [C α]` | Node JavaScript / TypeScript: `Concrete host signature with the Lean-selected instance dictionary erased` (signature); Browser / React / Worker: No host mapping recorded | Ordinary source: Node JavaScript / TypeScript: Installed checks passed; Browser / React / Worker: Not audited. Reviewed IR: Not audited | Node JavaScript / TypeScript: Lean synthesizes the selected dictionary before compilation. The host receives the resulting concrete callable and cannot substitute a dictionary. Required: Specialize or supply the selected dictionary without changing runtime behavior. |"
				, "| `Instance arguments [C α]` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specialize or supply the selected dictionary without changing runtime behavior. |"]
		]
	}
	, "src/analyze/elaborated-metadata.mjs": {
		current: "3fec4ae8aaf94c90a224307ceac2757fa9ee865b2a592df8d95334f21ff1c653"
		, previous: "1362aa142e52680b630cbc36a5a10aea5b00e424eb65714eb8d751a7ae1577fb"
		, edits: [[[
			'\t\t\t\t\tif(type?.kind === "refinement")'
			, "\t\t\t\t\t{"
			, '\t\t\t\t\t\tclosed(type, ["kind", "base", "predicate"]);'
			, "\t\t\t\t\t\tscalar(type.base);"
			, '\t\t\t\t\t\tclosed(type.predicate, ["kind", "bound"]);'
			, '\t\t\t\t\t\tif(type.base.name !== "nat" || type.predicate.kind !== "fin"'
			, '\t\t\t\t\t\t\t|| typeof type.predicate.bound !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(type.predicate.bound))'
			, '\t\t\t\t\t\t\tfail("Invalid Fin refinement");'
			, "\t\t\t\t\t\treturn;"
			, "\t\t\t\t\t}"
		].join("\n") + "\n"
		, ""]]
	}
	, "src/analyze/export-configuration.mjs": {
		current: "a7bb9d18660c30bccd691b5083a4c334746bdc3a01cc025f70e6cdf3a5e55f55"
		, previous: "2faf5839a254844babfaac7d0c6c7b59bb157ce289e76c3714edcdf5c45ef4c5"
		, edits: [['\t\tif(site.refinement === "reject" && type.kind === "refinement") return `${label}: the contract rejects compiler-checked refined values`;\n', ""]]
	}
	, "src/analyze/semantic-model.mjs": {
		current: "2b11358d3c854cd32b55ad91ede6e5484fd1fbb7065b59fa34a29a868340178a"
		, previous: "88ee704bd1352ff7e1a6a2c906ebe86473c82aed083a5a81eaeeec01d3468fb9"
		, edits: [
			['\t\tif(type.kind === "refinement") value.base = remember(type.base);\n', ""]
			, ['\t\tif(type.kind === "refinement") return reference(type.base);\n', ""]
			, ['\tconst refinement = type => type.kind === "refinement" ? structuredClone(type.predicate) : null;\n', ""]
			, [[
				'\t\tconst refinements = { parameters: projection.parameters.map(parameter => refinement(parameter.type))'
				, "\t\t\t, result: refinement(projection.result) };"
				, "\t\tconst hasRefinements = refinements.result !== null || refinements.parameters.some(value => value !== null);"
			].join("\n") + "\n"
			, ""]
			, ['\t\t\t\t\t, ...(hasRefinements ? { "lean-lang.org/refinements": refinements } : {})\n', ""]
		]
	}
	, "src/backends/javascript/generate.mjs": {
		current: "e7f8477ff42f6725aa22ed906e30fe3a46ae44dd0c58dbb4d8c25e4b2d8c2c0b"
		, previous: "d1f89f3865f16857423fa5d7bd1440aa1731759e0547bba504e4ab51e5570cc5"
		, edits: [
			[[
				"const declarationRefinements = declaration => {"
				, '\tconst value = declaration.source.extensions["lean-lang.org/refinements"];'
				, "\tif(value === undefined) return { parameters: declaration.parameters.map(() => null), result: null };"
				, '\tif(value === null || typeof value !== "object" || Array.isArray(value)'
				, '\t\t|| JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(["parameters", "result"])'
				, "\t\t|| !Array.isArray(value.parameters) || value.parameters.length !== declaration.parameters.length)"
				, '\t\tfail("invalid-refinement", `${declaration.id} has malformed refinement metadata`);'
				, "\tfor(const refinement of [...value.parameters, value.result])"
				, "\t{"
				, "\t\tif(refinement === null) continue;"
				, '\t\tif(refinement === undefined || typeof refinement !== "object" || Array.isArray(refinement)'
				, '\t\t\t|| JSON.stringify(Object.keys(refinement).sort()) !== JSON.stringify(["bound", "kind"])'
				, '\t\t\t|| refinement.kind !== "fin" || typeof refinement.bound !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(refinement.bound))'
				, '\t\t\tfail("invalid-refinement", `${declaration.id} has an unsupported refinement`);'
				, "\t}"
				, "\tvalue.parameters.forEach((refinement, index) => {"
				, '\t\tif(refinement !== null && (declaration.parameters[index].type.kind !== "primitive" || declaration.parameters[index].type.name !== "nat"))'
				, '\t\t\tfail("invalid-refinement", `${declaration.id} has a Fin parameter that does not erase to Nat`);'
				, "\t});"
				, '\tif(value.result !== null && (declaration.result.type.kind !== "primitive" || declaration.result.type.name !== "nat"))'
				, '\t\tfail("invalid-refinement", `${declaration.id} has a Fin result that does not erase to Nat`);'
				, "\treturn value;"
				, "};"
				, ""
				, "const emitFinCheck = (output, refinement, expression, path, indent) => {"
				, "\tif(refinement !== null) output.push(`${indent}validate.assertFin(${expression}, ${quote(refinement.bound)}, ${quote(path)});`);"
				, "};"
				, ""
			].join("\n") + "\n"
			, ""]
			, ["\t\t\t\tconst refinements = declarationRefinements(target);\n", ""]
			, ["\t\t\t\tfor(const [index, parameter] of target.parameters.entries())", "\t\t\t\tfor(const parameter of target.parameters)"]
			, ['\t\t\t\t\temitFinCheck(output, refinements.parameters[index], parameter.name, `${target.name}.${parameter.name}`, "      ");\n', ""]
			, [[
				"\t\t\t\toutput.push("
				, '\t\t\t\t\t`${indent}const result = runtime.call(${quote(target.id)}, [${target.parameters.map(parameter => parameter.name).join(", ")}]);`,'
				, '\t\t\t\t\t`${indent}validate.${validatorName(target.result.type, typeMap)}(result, ${quote(`${target.name}.result`)});`,'
				, "\t\t\t\t);"
				, '\t\t\t\temitFinCheck(output, refinements.result, "result", `${target.name}.result`, indent);'
				, "\t\t\t\toutput.push(`${indent}return result;`);"
			].join("\n")
			, [
				"\t\t\t\toutput.push("
				, '\t\t\t\t\t`${indent}const result = runtime.call(${quote(target.id)}, [${target.parameters.map(parameter => parameter.name).join(", ")}]);`,'
				, '\t\t\t\t\t`${indent}validate.${validatorName(target.result.type, typeMap)}(result, ${quote(`${target.name}.result`)});`,'
				, "\t\t\t\t\t`${indent}return result;`,"
				, "\t\t\t\t);"
			].join("\n")]
			, ["\t\tconst refinements = declarationRefinements(declaration);\n", ""]
			, ["\t\tdeclaration.parameters.forEach((parameter, index) => {", "\t\tdeclaration.parameters.forEach(parameter => {"]
			, ['\t\t\temitFinCheck(output, refinements.parameters[index], parameter.name, `${declaration.name}.${parameter.name}`, "  ");\n', ""]
			, ['\t\t\temitFinCheck(output, refinements.result, "result", `${declaration.name}.result`, indent);\n', ""]
			, ['\t\t, "export const assertFin = (value, bound, path) => { assertNat(value, path); if (value >= BigInt(bound)) invalid(path, `bigint below ${bound}`); return value; };"\n', ""]
		]
	}
	, "src/build/compiler-adapters.mjs": {
		current: "c14c7c5627cb674080c46b048e8ccdbc9607fefb22f96d528f4f9965cc6d9989"
		, previous: "3a6f809c6eef78031ea960967674b4f8f3357c90b41a165b29cf5897ef74f81d"
		, edits: [
			['import { componentRefinedCall, componentRefinementGuards } from "./component-refinements.mjs";\n', ""]
			, [[
				"const validateFinRefinement = (value, path) => {"
				, "\tif(value === null) return;"
				, '\texactKeys(value, ["kind", "bound"], path);'
				, '\tif(value.kind !== "fin" || typeof value.bound !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value.bound))'
				, '\t\tfail("invalid-compiler-adapter-plan", `${path} must be a canonical Fin bound`);'
				, "};"
				, ""
				, "const validateRefinements = (value, item) => {"
				, '\texactKeys(value, ["parameters", "result"], "compiler export refinements");'
				, "\tif(!Array.isArray(value.parameters) || value.parameters.length !== item.parameters.length)"
				, '\t\tfail("invalid-compiler-adapter-plan", "Compiler refinements must cover the exact runtime signature");'
				, "\tvalue.parameters.forEach((refinement, index) => {"
				, "\t\tvalidateFinRefinement(refinement, `parameter ${index} refinement`);"
				, '\t\tif(refinement !== null && item.parameters[index].leanType !== "_root_.Nat")'
				, '\t\t\tfail("invalid-compiler-adapter-plan", "Fin parameters must erase to Nat");'
				, "\t});"
				, '\tvalidateFinRefinement(value.result, "result refinement");'
				, '\tif(value.result !== null && item.leanResultType !== "_root_.Nat")'
				, '\t\tfail("invalid-compiler-adapter-plan", "Fin results must erase to Nat");'
				, "};"
				, ""
			].join("\n") + "\n"
			, ""]
			, ['\t\texactKeys(item, ["bindingId", "sourceDeclaration", "sourceModule", "wrapper", "symbol", "parameters", "leanResultType", "resultMode", "leanEffect", ...(item.sourceApplication === undefined ? [] : ["sourceApplication"]), ...(item.refinements === undefined ? [] : ["refinements"])], "compiler export");'
				, '\t\texactKeys(item, ["bindingId", "sourceDeclaration", "sourceModule", "wrapper", "symbol", "parameters", "leanResultType", "resultMode", "leanEffect", ...(item.sourceApplication === undefined ? [] : ["sourceApplication"])], "compiler export");']
			, ['\t\tif(item.refinements !== undefined) validateRefinements(item.refinements, item);\n', ""]
			, [[
				"\t\tconst refined = componentRefinedCall(item, item.parameters.map(parameter => parameter.name));"
				, '\t\tconst body = componentRefinementGuards(refined.guards, refined.call, `panic! "Lean Bridge rejected an invalid Fin value"`);'
			].join("\n")
			, '\t\tconst arguments_ = item.parameters.map(parameter => parameter.name).join(" ");']
			, ['\t\tlines.push(`  ${callback ? "⟨" : ""}${body}${callback ? "⟩" : ""}`);'
				, '\t\tlines.push(`  ${callback ? "⟨" : ""}${item.sourceApplication ? `(${item.sourceApplication})` : `_root_.${item.sourceDeclaration}`}${arguments_ === "" ? "" : ` ${arguments_}`}${callback ? "⟩" : ""}`);']
			, ['    const refinements = declaration.source.extensions["lean-lang.org/refinements"];\n', ""]
			, ['      , ...(refinements === undefined ? {} : { refinements: structuredClone(refinements) })\n', ""]
		]
	}
	, "src/build/component-record-adapters.mjs": {
		current: "40c42acc03c0fe60eb7e3e840af529b2aa7524584ad956fa755039f0711e661c"
		, previous: "8ae4f5c236fc59381f7c4a65c1f39b98a9e5e9c67cf3e9cb7f7650a35a988cef"
		, edits: [
			['import { componentRefinedCall, componentRefinementGuards } from "./component-refinements.mjs";\n', ""]
			, [[
				"\t\tconst args = signature.parameters.map((type, index) => convert(type, item.parameters[index].name, true));"
				, "\t\tconst refined = componentRefinedCall(item, args);"
				, '\t\tconst body = componentRefinementGuards(refined.guards, convert(signature.result, `(${refined.call})`, false)'
				, '\t\t\t, `panic! "Lean Bridge rejected an invalid Fin value"`);'
			].join("\n")
			, [
				'\t\tconst args = signature.parameters.map((type, index) => convert(type, item.parameters[index].name, true)).join(" ");'
				, '\t\tconst call = `${item.sourceApplication ? `(${item.sourceApplication})` : `_root_.${item.sourceDeclaration}`}${args ? ` ${args}` : ""}`;'
			].join("\n")]
			, ['\t\t\t, `  ${body.replaceAll("\\n", "\\n  ")}`, "");'
				, '\t\t\t, `  ${convert(signature.result, `(${call})`, false)}`, "");']
		]
	}
	, "src/build/component-structured-callable-lean.mjs": {
		current: "0e633f2f262f7207f5705ad9cf46aafb291ea3c06733fbf5b0e2edaa8f23057a"
		, previous: "8791cb354561e54f7082126608ef058fc0f98abf72146d4eb0d32eeed7c6d369"
		, edits: [
			['import { componentRefinedCall, componentRefinementGuards } from "./component-refinements.mjs";\n', ""]
			, [[
				"\t\tconst refined = componentRefinedCall(item, names, true);"
				, '\t\tconst body = componentRefinementGuards(refined.guards, `pure (${refined.call})`, ".none");'
			].join("\n")
			, '\t\tconst call = `${item.sourceApplication ? `(${item.sourceApplication})` : `_root_.${item.sourceDeclaration}`} ${names.join(" ")}`;']
			, ['\t\t\t, ...["carrierResult (do", ...names.map(name => `  let ${name} ← carrierValue ${name}`), ...body.split("\\n").map(line => `  ${line}`), ")"].map(line => `  ${line}`), "");'
				, '\t\t\t, ...checked(names, call).map(line => `  ${line}`), "");']
		]
	}
	, "schema/compiler-adapter-plan.schema.json": {
		current: "f68868315de712ff3e9338fe7e0642477543d1ba1dfac4e63bb77658c97c3ab7"
		, previous: "7925c40f253ad5ca06979d94e5e0cdb381dd4afa73b1cd46e40b083de3f262e4"
		, edits: [
			['        "refinements": { "$ref": "#/$defs/refinements" },\n', ""]
			, [[
				'    "finRefinement": {'
				, '      "oneOf": ['
				, '        { "type": "null" },'
				, "        {"
				, '          "type": "object", "additionalProperties": false, "required": ["kind", "bound"],'
				, '          "properties": {'
				, '            "kind": { "const": "fin" },'
				, '            "bound": { "type": "string", "pattern": "^(0|[1-9][0-9]*)$" }'
				, "          }"
				, "        }"
				, "      ]"
				, "    },"
				, '    "refinements": {'
				, '      "type": "object", "additionalProperties": false, "required": ["parameters", "result"],'
				, '      "properties": {'
				, '        "parameters": { "type": "array", "items": { "$ref": "#/$defs/finRefinement" } },'
				, '        "result": { "$ref": "#/$defs/finRefinement" }'
				, "      }"
				, "    },"
			].join("\n") + "\n"
			, ""]
		]
	}
	, "schema/elaborated-export-metadata.schema.json": {
		current: "f8565778550a99196646b6a3c3cfd64afffe39f590ae47c25d731db16afd81a8"
		, previous: "cb13ae5f230dedb93bcba1a8b7e1b66cd1af0f8761b3ef0212299523727da985"
		, edits: [
			[[
				"        {"
				, '          "type": "object", "additionalProperties": false, "required": ["kind", "base", "predicate"],'
				, '          "properties": {'
				, '            "kind": { "const": "refinement" },'
				, '            "base": { "$ref": "#/$defs/scalarType" },'
				, '            "predicate": {'
				, '              "type": "object", "additionalProperties": false, "required": ["kind", "bound"],'
				, '              "properties": {'
				, '                "kind": { "const": "fin" },'
				, '                "bound": { "type": "string", "pattern": "^(0|[1-9][0-9]*)$" }'
				, "              }"
				, "            }"
				, "          }"
				, "        },"
			].join("\n") + "\n"
			, ""]
		]
	}
	, "tests/elaborated-metadata.test.mjs": {
		current: "43f06098d430307df6c11e31d05bf125eac1da08fb81bc5537d30e201a0c4065"
		, previous: "7d7e38a1f58682131d6716722e44f0cf0d4d0c0cb2b89a486f93d0bb5a6e5a05"
		, removeRanges: [[
			'test("literal Fin bounds remain compiler-owned while the runtime signature erases only the proof"'
			, 'test("fresh metadata preserves aliases, documentation, UTF-16 ranges and actual theorem relationships after relocation"'
		]]
		, edits: []
	}
	, "tests/unlocked-component.test.mjs": {
		current: "b4f2fc8701dc311ca9252fa29facab79a8ee1365760f007691712ac7c634318c"
		, previous: "ddb9a9e934605f8b16161639b15ff92ed3334b470ac0c638cad04d09c8c3fe51"
		, edits: [
			["def bounded (value : Fin 5) : Fin 5 := value\n", ""]
			, ['\tawait saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], exports: [...specializations.map(item => item.name), "OnboardingSmall.bounded", "OnboardingSmall.plainWord"], specializations, contracts }));'
				, '\tawait saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], exports: [...specializations.map(item => item.name), "OnboardingSmall.plainWord"], specializations, contracts }));']
			, ['\t\tassert.deepEqual(ir.declarations.map(item => item.name), ["bounded", "chooseWord", "echoNat", "echoText", "echoWord", "firstWord", "plainWord"]);'
				, '\t\tassert.deepEqual(ir.declarations.map(item => item.name), ["chooseWord", "echoNat", "echoText", "echoWord", "firstWord", "plainWord"]);']
			, [[
				'\t\tassert.deepEqual(ir.declarations.find(item => item.name === "bounded").source.extensions["lean-lang.org/refinements"], {'
				, '\t\t\tparameters: [{ kind: "fin", bound: "5" }]'
				, '\t\t\t, result: { kind: "fin", bound: "5" }'
				, "\t\t});"
			].join("\n") + "\n"
			, ""]
			, ["assert.equal(api.bounded(0n), 0n);\nassert.equal(api.bounded(4n), 4n);\n", ""]
			, ["assert.throws(() => api.bounded(5n));\nassert.throws(() => api.bounded(-1n));\n", ""]
			, ['\tassert.match(declarations, /bounded\\(arg0: bigint\\): bigint/);\n', ""]
			, ["const bounded: bigint = api.bounded(4n);\n", ""]
			, ['if(word !== 4294967295 || text !== "Lean λ 🙂" || natural !== 2n ** 100n || chosen !== 37 || first !== 71 || plain !== 74 || bounded !== 4n)'
				, 'if(word !== 4294967295 || text !== "Lean λ 🙂" || natural !== 2n ** 100n || chosen !== 37 || first !== 71 || plain !== 74)']
			, [[
				'\t\t, args: [join(engineRoot, "node_modules/typescript/lib/tsc.js")'
				, '\t\t\t, "--strict"'
				, '\t\t\t, "--noEmit"'
				, '\t\t\t, "--skipLibCheck"'
				, '\t\t\t, "false"'
				, '\t\t\t, "--target"'
				, '\t\t\t, "ES2022"'
				, '\t\t\t, "--module"'
				, '\t\t\t, "NodeNext"'
				, '\t\t\t, "--moduleResolution"'
				, '\t\t\t, "NodeNext"'
				, '\t\t\t, "index.mts"]'
			].join("\n")
			, [
				'\t\t, args: [join(engineRoot, "node_modules/typescript/lib/tsc.js"), "--strict", "--noEmit", "--skipLibCheck", "false"'
				, '\t\t\t, "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"]'
			].join("\n")]
		]
	}
	, "src/build/component-recursive-lean.mjs": {
		current: "d3fce28702480524d3f770f110c58c40b31615cd148c314a5ff43899ab5db6d2"
		, previous: "7bcff37a068738a5fc029621f411ae422ae6e286b5f31b13dfb5360fb0e74c28"
		, edits: [
			['import { componentRefinedCall, componentRefinementGuards } from "./component-refinements.mjs";\n', ""]
			, [[
				"\t\tconst refined = componentRefinedCall(item, names, true);"
				, '\t\tconst body = componentRefinementGuards(refined.guards, `pure (${refined.call})`, ".none");'
			].join("\n")
			, '\t\tconst call = `${item.sourceApplication ? `(${item.sourceApplication})` : `_root_.${item.sourceDeclaration}`} ${names.join(" ")}`;']
			, ['\t\t\t, ...checked(names, body.split("\\n")).map(line => `  ${line}`), "");'
				, '\t\t\t, ...checked(names, [`pure (${call})`]).map(line => `  ${line}`), "");']
		]
	}
};

const reverse = (source, edits, label) => {
	for(const [index, [current, previous]] of edits.entries())
	{
		assert.equal(source.split(current).length, 2, `Exactly one ${label} edit ${index}`);
		source = source.replace(current, previous);
	}
	return source;
};

const beforeFinTypeSurface = source => {
	if(sha256(source) !== currentTypeSurfaceSha256) return source;
	const inventory = JSON.parse(source);
	inventory.shapes.find(shape => shape.id === "fin").ir = null;
	inventory.evidence = inventory.evidence.filter(item => ![
		"npm-fin-refinements-installed"
		, "npm-finite-specializations-installed"
		, "perl-finite-specializations-installed"
	].includes(item.id));
	inventory.observations = inventory.observations.filter(item => ![
		"npm-fin-refinements-ordinary-source"
		, "npm-finite-specializations-ordinary-source"
		, "perl-finite-specializations-ordinary-source"
	].includes(item.id));
	const restore = value => {
		if(Array.isArray(value)) value.forEach(restore);
		else if(value && typeof value === "object")
		{
			const hashes = typeSurfaceHashes.get(value.path);
			if(hashes && value.sha256 === hashes[0]) value.sha256 = hashes[1];
			Object.values(value).forEach(restore);
		}
	};
	restore(inventory);
	const previous = JSON.stringify(inventory, null, 2) + "\n";
	assert.equal(sha256(previous), previousTypeSurfaceSha256);
	return previous;
};

/**
 * Remove only the Fin extractor change or its historical-verifier integration.
 *
 * @param path - Current repository path.
 * @param source - Complete current source.
 * @param expected - Optional exact stopping SHA-256.
 */
const normalizeFinRefinementSource = memoizeSourceHistory((path, source, expected) => {
	source = beforeValueIndexNativeTapContractSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordValueIndexWitAcceptanceSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordValueIndexWitSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordValueIndexRustAcceptanceSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordValueIndexRustSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordValueIndexRubySource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeValueIndexTestProfileGapSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordValueIndexPerlSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCoreFirstRunRepairSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordValueIndexDotnetArchiveSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordValueIndexJvmSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordValueIndexDotnetResultOnlyCoreRepairSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordValueIndexNativeDotnetVerifierRepairSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordValueIndexDotnetHostedRepairSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordValueIndexDotnetCiSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeSourceHistoryMilestoneAssertionRepairSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordValueIndexDotnetInstalledSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordValueIndexDotnetSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeValueIndexBrowserLintSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeValueIndexCoreLineageRepairSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCoreQualityShardingSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordValueIndexFoundationSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeRecursiveCheckedRecordPromotionSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeMutualCheckedRecordNativeArchiveSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeRecursiveNativeGraphLoaderIsolationSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeRecursiveNativeGraphVerifierRepairSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeRecursiveNativeSelectorRepairSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCallbackFinGateRepairSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeDownstreamFinCiRepairSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeHistoryHubReachabilityRepairSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordFoundationVerifierSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforePerlRecursiveConversionOutputSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeMutualCheckedRecordNativeReviewSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeMutualCheckedRecordNativeHardeningSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordDocsClosureSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordPerlFinalVerifierSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordPerlArchiveSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordPerlVerifierSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforePrimitiveAuditCoreRepairSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeDownstreamFinCiRepairHistoricalSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforePrimitiveAuditIntegrationSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordPerlArgumentsSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordPerlStdoutSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordPerlPinRepairSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordPerlSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordPhpPinRepairSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordPhpSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforePhpWasmWriterGuardSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforePhpCopiedKeywordSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordRubySource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordDotnetArtifactRetentionSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordPythonSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordHostedEvidenceSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordJvmSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordDotnetSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCheckedRecordAliasAdmissionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordTestRegistrationSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeInheritedCheckedRecordFoundationSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCheckedJavaScriptDispositionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordDiagnosticOracleSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeRecursiveComponentRegressionRepairSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeRecursiveWitTestRegistrationSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeLateCheckedRecordTestRegistrationSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeWitGraphDiagnosticSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforePhpGraphDiagnosticSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCiContractRepairSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeClosedGenericCheckedRecordSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeRecursiveCheckedRecordPerlPackageHistoryRepairSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeRustGraphDiagnosticSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeRubyMemberEscapeSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeRubyGraphKeywordFieldSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeRubyGraphDiagnosticSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforePythonGraphDiagnosticSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeRecursiveCheckedRecordPerlDiagnosticSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeMutualCheckedRecordJvmSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeMutualCheckedRecordDotnetSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeMutualCheckedRecordNpmArchiveSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeMutualCheckedRecordNpmSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeMutualCheckedRecordSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordMatrixClosureSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordRustPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordPhpWasmPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordWitPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordRubyPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordPythonPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordPhpPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordPerlPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordJvmPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordArchiveRepairSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNominalPrimitiveSubtypeRegistrationRepairSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNominalPrimitiveSubtypeAuditCorrectionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordDotnetPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordQualitySource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordNativePromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	// The nested native archive registration predates the promotion ledger.
	source = beforeNestedCheckedRecordArchiveGapSource("archive", path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordNativeArchiveHistoricalSource(
		path, source, expected
	);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordNativeCorrectionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNominalPrimitiveSubtypeJvmPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNominalPrimitiveSubtypeWitPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordBrowserPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNestedCheckedRecordSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeRecursiveSubtypePhpWasmPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeRecursiveSubtypePhpWasmSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNominalPrimitiveSubtypePhpWasmPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNominalPrimitiveSubtypePhpPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCheckedJavaScriptDispositionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	// These native PHP registrations predate the native PHP promotion ledger.
	source = beforeNominalPrimitiveSubtypeRegistrationGapSource("php", path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCheckedJavaScriptDispositionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNominalPrimitiveSubtypeDotnetPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCheckedJavaScriptDispositionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	// These .NET registrations predate the .NET promotion ledger.
	source = beforeNominalPrimitiveSubtypeRegistrationGapSource("dotnet", path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeCheckedJavaScriptDispositionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNominalPrimitiveSubtypeRustPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeNominalPrimitiveSubtypeRubyPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	source = beforeSubtypeRefinementSource(path, source, expected);
	if(sha256(source) === expected) return source;
	if(path === typeSurfacePath) return beforeFinTypeSurface(source);
	const verification = verifierEdits[path];
	if(verification && verification.some(([current]) => source.includes(current)))
		return reverse(source, verification, "Fin verifier integration");
	if(path === extractorPath && sha256(source) === currentExtractorSha256)
	{
		const previous = reverse(source, extractorEdits, "Fin extractor");
		assert.equal(sha256(previous), previousExtractorSha256);
		return previous;
	}
	const transition = transitions[path];
	if(!transition || sha256(source) !== transition.current) return source;
	for(const [start, end] of transition.removeRanges ?? [])
	{
		const first = source.indexOf(start), last = source.indexOf(end);
		assert.ok(first >= 0 && last > first, `Exact Fin ${path} removal range`);
		source = source.slice(0, first) + source.slice(last);
	}
	const previous = reverse(source, transition.edits, `Fin ${path}`);
	assert.equal(sha256(previous), transition.previous);
	return previous;
});

const normalizeExactTypeSurfaceHistory = (source, expected) => {
	const initial = sha256(source);
	const plan = exactTypeSurfaceHistoryPlan(initial, expected);
	let digest = initial;
	let pieces = [{ text: source, start: 0, end: source.length }];
	for(const transition of plan)
	{
		assert.equal(transition.currentSha256, digest
			, transition.evidenceName);
		if(transition.builtInFin)
		{
			const current = typeSurfacePiecesText(pieces);
			assert.equal(sha256(current), transition.currentSha256);
			const previous = beforeFinTypeSurface(current);
			assert.equal(sha256(previous), transition.previousSha256);
			pieces = [{ text: previous
				, start: 0, end: previous.length }];
			digest = transition.previousSha256;
			continue;
		}
		const candidate = exactTypeSurfaceUpdate(transition);
		if(candidate === undefined)
		{
			const partial = typeSurfacePiecesText(pieces);
			assert.equal(sha256(partial), digest);
			return partial;
		}
		const update = selectedExactTypeSurfaceUpdate(transition, candidate);
		if(!directlyReversibleTypeSurfaceUpdate(update))
		{
			const partial = typeSurfacePiecesText(pieces);
			assert.equal(sha256(partial), digest);
			return partial;
		}
		pieces = reverseExactTypeSurfaceTransition(
			pieces, transition, update
		);
		digest = transition.previousSha256;
	}
	source = typeSurfacePiecesText(pieces);
	assert.equal(sha256(source), digest);
	return source;
};

export const finRefinementNormalizationPaths = Object.freeze([...new Set([
	...directProofErasureCompleteEntrypointsNormalizationPaths
	, ...dependentSignatureFocusedArchiveNormalizationPaths
	, ...focusedAcceptanceSparseCheckoutNormalizationPaths
	, ...completeAcceptanceBudgetNormalizationPaths
	, ...dependentSignatureProducerSparseCheckoutNormalizationPaths
	, ...proofErasureCoreLintRepairNormalizationPaths
	, ...dependentSignatureProducerConcurrencyNormalizationPaths
	, ...dependentSignatureAuditSparseCheckoutNormalizationPaths
	, ...dependentSignatureShallowCheckoutNormalizationPaths
	, ...optionalParameterCompletePromotionNormalizationPaths
	, ...optionalParameterReceiptSparseCheckoutNormalizationPaths
	, ...optionalParameterRouteBinderRepairNormalizationPaths
	, ...optionalParameterPerlUnicodeDefaultRepairNormalizationPaths
	, ...optionalParameterInstalledAcceptanceRepairNormalizationPaths
	, ...npmRuntimeModuleGraphClosureNormalizationPaths
	, ...optionalParameterNativeEvidenceRepairNormalizationPaths
	, ...hostNullFocusedArchiveInputNormalizationPaths
	, ...hostNullFocusedCiNormalizationPaths
	, ...coreCurrentSourcePinRepairNormalizationPaths
	, ...focusedTypeSurfaceProducerRepairNormalizationPaths
	, ...dependentSignatureFocusedCiNormalizationPaths
	, ...directProofErasureFocusedCiNormalizationPaths
	, ...optionalParameterDispatchBridgeNormalizationPaths
	, ...optionalParameterFocusedCiNormalizationPaths
	, ...optionalParameterCurrentLineIntegrationNormalizationPaths
	, ...optionalParameterNormalizationPaths
	, ...hostNullSystemsTypeSurfaceNormalizationPaths
	, ...hostNullSystemsNormalizationPaths
	, ...generatedOutputControlRepairTypeSurfaceNormalizationPaths
	, ...generatedOutputControlRepairNormalizationPaths
	, ...hostNullScriptingTypeSurfaceNormalizationPaths
	, ...hostNullScriptingNormalizationPaths
	, ...hostNullDownstreamNormalizationPaths
	, ...hostNullManagedNormalizationPaths
	, ...hostNullPhpNormalizationPaths
	, ...hostNullTypeSurfaceLineageNormalizationPaths
	, ...hostNullPartitionGapNormalizationPaths
	, ...npmRuntimeDefaultValueCopyRepairNormalizationPaths
	, ...hostNullJavaScriptNormalizationPaths
	, ...corpusTrapBuildCheckoutRepairNormalizationPaths
	, ...performanceReproducibilityCheckoutNormalizationPaths
	, ...phpWasmCorpusLaneSplitNormalizationPaths
	, ...downstreamDirectProofControlRepairNormalizationPaths
	, ...directProofErasureDownstreamRepairNormalizationPaths
	, ...directProofErasureHostedFollowupNormalizationPaths
	, ...directProofErasureNativeProducerRepairNormalizationPaths
	, ...directProofErasureNativeEvidenceCorrectionNormalizationPaths
	, ...perlDependentRefinementRejectionNormalizationPaths
	, ...witFrozenClosureHubHookNormalizationPaths
	, ...downstreamReporterSparseCheckoutNormalizationPaths
	, ...directProofErasureNpmArchiveNormalizationPaths
	, ...directProofErasureMatrixNormalizationPaths
	, ...directProofErasureTestRegistrationNormalizationPaths
	, ...proofErasureWitLintJoinNormalizationPaths
	, ...proofErasureLintPinRepairNormalizationPaths
	, ...directProofErasureWitNormalizationPaths
	, ...directProofErasureLanguageNormalizationPaths
	, ...directProofErasureManagedNormalizationPaths
	, ...proofCoreLocalJoinNormalizationPaths
	, ...directProofErasurePhpNormalizationPaths
	, ...directProofErasureNativeNormalizationPaths
	, ...directProofErasureNpmNormalizationPaths
	, ...directProofErasurePackageNormalizationPaths
	, ...directProofErasureFixtureNormalizationPaths
	, ...directProofErasureNormalizationPaths
	, ...proofErasureEvidenceAuditNormalizationPaths
	, ...dependentSignatureCompletionNormalizationPaths
	, ...coreRecordedTransitionRepairNormalizationPaths
	, ...coreReadSiteRepairNormalizationPaths
	, ...coreOwnedCallbackPicRepairNormalizationPaths
	, ...corePreBoxRecountRepairNormalizationPaths
	, ...coreReviewedFinBoxHarnessRepairNormalizationPaths
	, ...coreShardFourSerialNormalizationPaths
	, ...coreLegacyFinArchiveRepairNormalizationPaths
	, ...coreGeneratedDocumentRepairNormalizationPaths
	, ...coreShardFiveEightRepairNormalizationPaths
	, ...witCallbackFrozenClosureIntegrationNormalizationPaths
	, ...witCallbackFrozenClosureChangedPaths
	, ...coreDeterministicBoundaryRepairIntegrationNormalizationPaths
	, ...coreDeterministicBoundaryRepairNormalizationPaths
	, ...signatureSpecializationCompletionPinRepairIntegrationNormalizationPaths
	, ...signatureSpecializationCompletionPinRepairNormalizationPaths
	, ...signatureSpecializationCompletionPromotionIntegrationNormalizationPaths
	, ...signatureSpecializationCompletionPromotionNormalizationPaths
	, ...signatureSpecializationHostedArchiveReplayIntegrationNormalizationPaths
	, ...signatureSpecializationHostedArchiveReplayNormalizationPaths
	, ...signatureSpecializationCompletionPreparationIntegrationNormalizationPaths
	, ...signatureSpecializationCompletionPreparationNormalizationPaths
	, ...inheritedCheckedRecordLaneMemoryLocalJoinNormalizationPaths
	, ...inheritedCheckedRecordLaneMemoryIntegrationNormalizationPaths
	, ...inheritedCheckedRecordLaneMemoryNormalizationPaths
	, ...callbackFinPerlLocalJoinNormalizationPaths
	, ...callbackFinPerlMilestoneReadIntegrationNormalizationPaths
	, ...callbackFinPerlMilestoneReadNormalizationPaths
	, ...coreRubyPredecessorStopNormalizationPaths
	, ...callbackFinMilestoneReadIntegrationNormalizationPaths
	, ...callbackFinMilestoneReadNormalizationPaths
	, ...signatureSpecializationHostedProducerBindingIntegrationNormalizationPaths
	, ...signatureSpecializationHostedProducerBindingNormalizationPaths
	, ...signatureSpecializationPhpWasmConsumerRepairIntegrationNormalizationPaths
	, ...signatureSpecializationPhpWasmConsumerRepairNormalizationPaths
	, ...coreNativeEvidenceManifestIntegrationNormalizationPaths
	, ...coreNativeEvidenceManifestNormalizationPaths
	, ...perlCodegenMergedIntegrationNormalizationPaths
	, ...perlCodegenMergedNormalizationPaths
	, ...perlCodegenProducerReplayIntegrationNormalizationPaths
	, ...perlCodegenProducerReplayNormalizationPaths
	, ...coreHistoricalContractRepairIntegrationNormalizationPaths
	, ...coreHistoricalContractRepairNormalizationPaths
	, ...nativeFinCallbackRoleIntegrationNormalizationPaths
	, ...coreHubOrderMergedIntegrationNormalizationPaths
	, ...coreHubOrderMergedNormalizationPaths
	, ...coreHubOrderRepairIntegrationNormalizationPaths
	, ...coreHubOrderRepairNormalizationPaths
	, ...signatureSpecializationHostedNormalizationPaths
	, ...signatureSpecializationCompletionIntegrationNormalizationPaths
	, ...signatureSpecializationCompletionNormalizationPaths
	, ...finContractTestRegistrationIntegrationNormalizationPaths
	, ...finContractTestRegistrationNormalizationPaths
	, ...finCompletionPromotionNormalizationPaths
	, ...reviewedFinFocusedProducerNormalizationPaths
	, ...reviewedFinJobScopeNormalizationPaths
	, ...leanToolchainReleaseFallbackNormalizationPaths
	, ...callbackFinSparseCheckoutNormalizationPaths
	, ...callbackFinShallowCheckoutNormalizationPaths
	, ...coreCiReliabilityNormalizationPaths
	, ...coreShardFiveRepairIntegrationNormalizationPaths
	, ...coreShardFiveRepairNormalizationPaths
	, ...coreCallbackFinLivePinRepairNormalizationPaths
	, ...callbackFinPerlRuntimeNormalizationPaths
	, ...callbackFinPerlDirectionNormalizationPaths
	, ...callbackFinHostRepairNormalizationPaths
	, ...replayChainMemoryIntegrationNormalizationPaths
	, ...replayChainMemoryNormalizationPaths
	, ...callbackFinDiagnosticContractNormalizationPaths
	, ...coreMemoryBoundIntegrationNormalizationPaths
	, ...coreMemoryBoundNormalizationPaths
	, ...callbackFinInstalledRepairNormalizationPaths
	, ...reviewedCallbackFinBrowserNormalizationPaths
	, ...reviewedFinWasmFieldNormalizationPaths
	, ...callbackFinNativeCapabilityNormalizationPaths
	, ...callbackFinHostedWorkflowNormalizationPaths
	, ...nativeFinCallbackRoleNormalizationPaths
	, ...coreHistoricalEvidenceReuseLivePinRepairNormalizationPaths()
	, ...coreHistoricalEvidenceReuseNormalizationPaths
	, ...coreExactHeadMatrixRepairNormalizationPaths
	, ...coreExactHeadHostedStaticRepairNormalizationPaths()
	, ...coreExactHeadHostedReplayRepairNormalizationPaths()
	, ...coreInheritedRecordTypeSurfaceBatchNormalizationPaths()
	, ...coreRecursiveCallableEvidencePinRepairNormalizationPaths()
	, ...coreRecursiveCallableReplayBoundNormalizationPaths()
	, ...coreLegacyOwnedEvidenceReplayBoundNormalizationPaths()
	, ...coreCallbackEvidenceReplayBoundNormalizationPaths()
	, ...coreInheritedRecordReplayBoundNormalizationPaths()
	, ...coreReplayIntegrationEndpointRepairNormalizationPaths()
	, ...coreExactHeadReplayRepairNormalizationPaths()
	, ...recurringAcceptanceDocumentationNormalizationPaths()
	, ...boundedRecurringAcceptanceSweepNormalizationPaths()
	, ...coreExactHeadValidationRepairNormalizationPaths()
	, ...defaultBranchCiTriggerBudgetNormalizationPaths()
	, ...coreUniqueTypeSurfaceAuthenticationNormalizationPaths
	, ...coreHistoricalAdditionCheckoutRepairNormalizationPaths
	, ...coreTypeSurfaceSinglePassNormalizationPaths
	, ...coreDocumentationEvidenceClosureRepairNormalizationPaths
	, ...coreBrowserWorkflowEvidencePinRepairNormalizationPaths
	, ...coreTypeSurfaceEvidenceClosureRepairNormalizationPaths
	, ...coreSparseConeModeRepairNormalizationPaths
	, ...coreContractEvidenceCheckoutNormalizationPaths
	, ...nominalPrimitiveSubtypeSparseCheckoutNormalizationPaths
	, ...coreStaticSparseCheckoutNormalizationPaths
	, ...coreStaticHistoryDeferralNormalizationPaths
	, ...coreOwnedReviewedExactStopRepairNormalizationPaths
	, ...coreWitExactStopRepairNormalizationPaths
	, ...coreRuntimeBudgetLivePinRepairNormalizationPaths
	, ...coreContractRuntimeBudgetNormalizationPaths
	, ...coreReceiverCiStopBoundaryNormalizationPaths
	, ...coreWitBorrowStopBoundaryNormalizationPaths
	, ...coreReceiverCiProducerReplayNormalizationPaths
	, ...coreWitBorrowProducerReplayNormalizationPaths
	, ...coreExactHeadLivePinRepairNormalizationPaths
	, ...coreHistoricalEvidenceReplayNormalizationPaths
	, ...coreRunnerResilienceNormalizationPaths
	, ...nominalSubtypeEntryLivePinRepairNormalizationPaths
	, ...nominalSubtypeEntryPublicationNormalizationPaths
	, ...ownedCheckedSemanticAuditNormalizationPaths
	, ...ownedCheckedAlignedPublicationNormalizationPaths
	, ...ownedCheckedPromotionLabelsNormalizationPaths
	, ...ownedPublicationCoexistenceNormalizationPaths
	, ...ownedCheckedArchiveRootsNormalizationPaths
	, ...ownedSubtypeMatrixPublicationNormalizationPaths
	, ...ownedSubtypePromotionTransactionNormalizationPaths
	, ...ownedSubtypeHostedPromotionNormalizationPaths
	, ...ownedSubtypeNpmHostedNormalizationPaths
	, ...ownedCheckedRetainedIdentityNormalizationPaths
	, ...ownedSubtypeNpmCompleteAcceptanceNormalizationPaths
	, ...ownedCheckedCSessionBoundariesNormalizationPaths
	, ...ownedCheckedPhpWasmContextsNormalizationPaths
	, ...wasmtimeCapiRolloutNormalizationPaths
	, ...ownedCheckedWitBootstrapNormalizationPaths
	, ...ownedCheckedPhpWasmMixedCoverageNormalizationPaths
	, ...ownedCheckedManagedMixedCoverageNormalizationPaths
	, ...ownedCheckedWindowRejectionNormalizationPaths
	, ...ownedCheckedCarrierCompilationNormalizationPaths
	, ...ownedNativePromotionScopeNormalizationPaths
	, ...ownedCheckedLanguageMixedCoverageNormalizationPaths
	, ...dependentMatrixDocGateNormalizationPaths
	, ...ownedCheckedNativeMixedCoverageNormalizationPaths
	, ...ownedMatrixRefreshNormalizationPaths
	, ...ownedMatrixIsolationNormalizationPaths
	, ...ownedReceiptProducerReplayNormalizationPaths
	, ...phpClosureProducerReplayNormalizationPaths
	, ...ownedNpmCompleteAcceptanceNormalizationPaths
	, ...coreAggregateSparseCheckoutNormalizationPaths
	, ...phpWasmEntryBuildInputSupplementNormalizationPaths
	, ...coreAuthorPublicationRepairNormalizationPaths
	, ...corePublicationRecursiveRepairNormalizationPaths
	, ...phpWasmEntrySourceSupplementNormalizationPaths
	, ...consumerToolLookupsNormalizationPaths
	, ...phpWasmEntryProbePublicationNormalizationPaths
	, ...phpWasmEntryPublicationPinRepairNormalizationPaths
	, ...phpWasmEntryPublisherNormalizationPaths
	, ...phpWasmEntryPublicationPreparationNormalizationPaths
	, ...phpWasmEntryCompleteArchiveNormalizationPaths
	, ...phpWasmEntryDiagnosticRetentionNormalizationPaths
	, ...phpWasmEntryHostedReplayNormalizationPaths
	, ...phpWasmEntryHostedIdentityNormalizationPaths
	, ...ownedCheckedRecordMatrixPublicationNormalizationPaths
	, ...phpWasmEntryTagDispatchNormalizationPaths
	, ...ownedCheckedRecordPromotionPreparationNormalizationPaths
	, ...genericSubtypeMatrixPublicationNormalizationPaths
	, ...ownedNpmHistoryCheckoutNormalizationPaths
	, ...genericSubtypePromotionBaselineNormalizationPaths
	, ...genericSubtypePromotionTransactionNormalizationPaths
	, ...genericSubtypeCompactReferenceNormalizationPaths
	, ...ownedNpmSourceIdentityRepairNormalizationPaths
	, ...coreStructuredHistoryRepairNormalizationPaths
	, ...ownedCheckedRecordMatrixGateNormalizationPaths
	, ...corePhpStructuredEndpointRepairNormalizationPaths
	, ...ownedNpmScopedProducerNormalizationPaths
	, ...corePerlConsumerEndpointRepairNormalizationPaths
	, ...coreReceiverEndpointRepairNormalizationPaths
	, ...phpWasmCallbackProducerReplayNormalizationPaths
	, ...jvmCallbackProducerReplayNormalizationPaths
	, ...pythonCallbackProducerReplayNormalizationPaths
	, ...dotnetCallbackProducerReplayNormalizationPaths
	, ...coreFinCppRepairNormalizationPaths
	, ...coreInventoryFollowupRepairNormalizationPaths
	, ...coreInventoryEndpointRepairNormalizationPaths
	, ...ownedNpmCiEnvironmentRepairNormalizationPaths
	, ...ownedPhpWasmHostedArchiveNormalizationPaths
	, ...ownedLifetimeReplayNormalizationPaths
	, ...transferBorrowProducerReplayNormalizationPaths
	, ...callbackProducerReplayNormalizationPaths
	, ...zeroPayloadRustReplayNormalizationPaths
	, ...phpRecursiveReplayNormalizationPaths
	, ...milestoneControlRepairNormalizationPaths
	, ...perlCallbackContractGapNormalizationPaths
	, ...ownedHistoryFollowupNormalizationPaths
	, ...ownedProducerReplayNormalizationPaths
	, ...coreHistoryEndpointIntegrationNormalizationPaths
	, ...zeroPayloadDotnetArchiveGapNormalizationPaths
	, ...phpWasmCallbackEndpointStopNormalizationPaths
	, ...perlPromotionLivePinRepairNormalizationPaths
	, ...rubyTransferCopyGapIntegrationNormalizationPaths
	, ...rubyTransferCopyGapNormalizationPaths
	, ...coreProducerLivePinRepairNormalizationPaths
	, ...genericSubtypeArchiveBoundaryNormalizationPaths
	, ...borrowReceiverProducerRepairNormalizationPaths
	, ...admissionArchiveProducerRepairNormalizationPaths
	, ...jvmNpmProducerRepairNormalizationPaths
	, ...coreEvidenceRepairIntegrationChangedPaths
	, ...authorRefinementGuidanceRepairNormalizationPaths
	, ...witTransferCopyGapNormalizationPaths
	, ...phpWasmCallbackTilesTraceRepairNormalizationPaths
	, ...ownedMilestoneProducerRepairNormalizationPaths
	, ...ownedJavaScriptTransferNixProducerRepairNormalizationPaths
	, ...phpWasmCallbackFinMixedEntryNormalizationPaths
	, ...phpWasmCallbackSubtypeEntryNormalizationPaths
	, ...ownedCReceiverProducerRepairNormalizationPaths
	, ...ownedJvmTransferProducerRepairNormalizationPaths
	, ...perlCallbackAdmissionRepairNormalizationPaths
	, ...finHistoryRollingRepairNormalizationPaths
	, ...nativeForkTransferProducerRepairNormalizationPaths
	, ...ownedSubtypeDelegationRepairNormalizationPaths
	, ...ownedJavaScriptProducerRepairNormalizationPaths
	, ...documentationWorkflowRepairNormalizationPaths
	, ...ownedDotnetProducerRepairNormalizationPaths
	, ...ownedCProducerRepairNormalizationPaths
	, ...entryFixtureRepairNormalizationPaths
	, ...coreEvidenceMemoryRepairNormalizationPaths
	, ...valueIndexPromotionMilestoneRepairNormalizationPaths
	, ...coreMilestoneReplayRepairNormalizationPaths
	, ...typeSurfaceCurrentPinRepairNormalizationPaths
	, ...phpWasmCallbackEntryFormRepairNormalizationPaths
	, ...phpWasmEntryOracleIntegrationChangedPaths
	, ...phpWasmEntryOracleRepairNormalizationPaths
	, ...phpWasmEntryOracleClosureNormalizationPaths
	, ...phpWasmEntryFlatPositionNormalizationPaths
	, ...phpWasmEntryUnreachedSourceNormalizationPaths
	, ...phpWasmEntryCallPathNormalizationPaths
	, ...nominalSubtypeEntryReportLinkNormalizationPaths
	, ...nominalSubtypeEntryExportSurfaceNormalizationPaths
	, ...phpWasmNullaryEntryFormNormalizationPaths
	, ...managedResultOnlyFixtureRepairNormalizationPaths
	, ...genericSubtypeManagedTapEscapeRepairNormalizationPaths
	, ...structuredCallableRecoveryGateRepairNormalizationPaths
	, ...ownedSubtypeRemainingHostsTapRepairNormalizationPaths
	, ...coreEvidenceTrackingTestRegistrationNormalizationPaths
	, ...checkedRecordValueIndexBrowserControlsContractNormalizationPaths
	, ...ownedTransferCopyReplayRepairNormalizationPaths
	, ...ownedSubtypeWasmTransferFixtureNormalizationPaths
	, ...ownedCheckedRecordJavaScriptHostedRunOutcomeNormalizationPaths
	, ...ownedCheckedRecordJavaScriptHostedLaneNormalizationPaths
	, ...coreSourceBoundaryClosureNormalizationPaths
	, ...evidenceCheckoutClosureRepairNormalizationPaths
	, ...witAcceptanceStopBoundaryNormalizationPaths
	, ...ownedJvmLazyKotlinFactoryNormalizationPaths
	, ...ownedSubtypeLivePinCompletionNormalizationPaths
	, ...phpWasmRecursiveEvidenceReplayRepairNormalizationPaths
	, ...genericSubtypeWitHelperWarningScopeNormalizationPaths
	, ...ownedSubtypeTestProfilePinRepairNormalizationPaths
	, ...witRecursiveReaderTraversalRepairNormalizationPaths
	, ...genericSubtypeDotnetRuntimeProbeNormalizationPaths
	, ...genericSubtypeEvidenceSourceClosureRepairChangedPaths
	, ...genericSubtypeArtifactPrefixRepairChangedPaths
	, ...ownedSubtypeWitHostNamespaceRepairChangedPaths
	, ...phpWasmEntryStructuralEqualityRepairChangedPaths
	, ...ownedSubtypePerlSourcePathRepairNormalizationPaths
	, ...genericSubtypeDocumentationNormalizationPaths
	, ...genericSubtypePromotionNormalizationPaths
	, ...genericSubtypeHostedArchiveNormalizationPaths
	, ...recursiveCheckedRecordDocumentationClosureNormalizationPaths
	, ...valueIndexMatrixHistoricalInventoryRepairNormalizationPaths
	, ...dependentCheckedRecordDocumentationClosureNormalizationPaths
	, ...dependentCheckedRecordPromotionChangedPaths
	, ...checkedRefinementGateRepairNormalizationPaths
	, ...dependentCheckedRecordBrowserArchiveImplementationPaths
	, ...dependentCheckedRecordBrowserArchiveIntegrationPaths
	, ...valueIndexBrowserPromotionClosureRepairNormalizationPaths
	, ...stagedPhpProducerReplayRepairNormalizationPaths
	, ...dependentBrowserHandoffRetentionRepairNormalizationPaths
	, ...witRecursiveProducerReplayRepairNormalizationPaths
	, ...jvmProducerReplayRepairNormalizationPaths
	, ...ownedReceiverProducerReplayRepairNormalizationPaths
	, ...ownedTransferProducerReplayRepairNormalizationPaths
	, ...ownedPythonBorrowProducerReplayRepairNormalizationPaths
	, ...ownedPhpProducerReplayRepairNormalizationPaths
	, ...ownedJavaScriptTransferProducerReplayRepairNormalizationPaths
	, ...ownedPerlTransferProducerReplayRepairNormalizationPaths
	, ...promotionDocMilestoneReplayRepairNormalizationPaths
	, ...nestedPromotionDocMilestoneRepairNormalizationPaths
	, ...workflowMilestoneReplayRepairNormalizationPaths
	, ...coreResidualLedgerPointerReplayRepairNormalizationPaths
	, ...coreRubyModelAvailabilityRepairNormalizationPaths
	, ...coreResidualProducerReplayRepairNormalizationPaths
	, ...callbackStagingLineageReplayRepairNormalizationPaths
	, ...callbackStagingProducerReplayRepairNormalizationPaths
	, ...coreFirstRunPinReplayRepairNormalizationPaths
	, ...structuredCallableProducerReplayRepairNormalizationPaths
	, ...nativeBudgetReplayRepairNormalizationPaths
	, ...inheritedDocsReplayRepairNormalizationPaths
	, ...valueIndexRustGeneratorReplayRepairNormalizationPaths
	, ...genericSubtypeRustOraclePathRepairNormalizationPaths
	, ...dependentRecordAuthorityReplayRepairNormalizationPaths
	, ...preFinTypeSurfaceHistoryRepairNormalizationPaths
	, ...valueIndexPromotionMemoryRepairNormalizationPaths
	, ...nominalEntryTagRepairNormalizationPaths
	, ...callbackCheckedRecordPromotionRefreshNormalizationPaths
	, ...callbackCheckedRecordArchiveCommitProvenanceNormalizationPaths
	, ...callbackCheckedRecordArchiveProvenanceRepairNormalizationPaths
	, ...callbackCheckedRecordRetainedArchiveRolloverNormalizationPaths
	, ...phpWasmCallbackEntryTracePlanRepairNormalizationPaths
	, ...dependentCheckedRecordBrowserReviewedRouteRepairNormalizationPaths
	, ...structuredCallbackPublicFallbackRepairNormalizationPaths
	, ...callbackCheckedRecordWitDiagnosticRepairNormalizationPaths
	, ...valueIndexTestProfileLiveReadRepairNormalizationPaths
	, ...phpWasmCallbackEntrySelectionRepairNormalizationPaths
	, ...callbackRefinementsPhpWasmPromotionNormalizationPaths
	, ...testProfilesRegistrationGapIntegrationPaths
	, ...testProfilesRegistrationGapHistoricalPaths
	, ...callbackRefinementsPhpWasmHostedArchiveNormalizationPaths
	, ...dependentCheckedRecordWitArchiveImplementationPaths
	, ...dependentCheckedRecordWitArchiveIntegrationPaths
	, ...dependentCheckedRecordBrowserPathDiagnosticRepairChangedPaths
	, ...dependentCheckedRecordBrowserPathDiagnosticRepairIntegrationPaths
	, ...dependentCheckedRecordWitRetainedPkgConfigRepairChangedPaths
	, ...dependentCheckedRecordWitRetainedPkgConfigRepairIntegrationPaths
	, ...callbackPhpWasmStaticQualityRepairNormalizationPaths
	, ...callbackPhpWasmStaticQualityRepairIntegrationPaths
	, ...phpWasmCallbackEntrySuiteSplitChangedPaths
	, ...phpWasmCallbackEntrySuiteSplitIntegrationPaths
	, ...dependentCheckedRecordPhpArchiveImplementationPaths
	, ...dependentCheckedRecordPhpArchiveIntegrationPaths
	, ...dependentCheckedRecordWitPkgConfigSpaceRepairChangedPaths
	, ...dependentCheckedRecordWitPkgConfigSpaceRepairIntegrationPaths
	, ...dependentCheckedRecordPromotionArtifactIdentityHardeningChangedPaths
	, ...dependentCheckedRecordPromotionArtifactIdentityHardeningIntegrationPaths
	, ...dependentCheckedRecordPhpWasmArchiveImplementationPaths
	, ...dependentCheckedRecordPhpWasmArchiveIntegrationPaths
	, ...dependentCheckedRecordWitExportCountRepairChangedPaths
	, ...dependentCheckedRecordWitExportCountRepairIntegrationPaths
	, ...dependentCheckedRecordBrowserDiagnosticRepairChangedPaths
	, ...dependentCheckedRecordBrowserDiagnosticRepairIntegrationPaths
	, ...dependentCheckedRecordDotnetArchiveImplementationPaths
	, ...dependentCheckedRecordDotnetArchiveIntegrationPaths
	, ...dependentCheckedRecordNativeArchiveImplementationPaths
	, ...dependentCheckedRecordNativeArchiveIntegrationPaths
	, ...dependentCheckedRecordPromotionContractChangedPaths
	, ...dependentCheckedRecordPromotionContractIntegrationPaths
	, ...hostedRefinementVerifierRepairChangedPaths
	, ...hostedRefinementVerifierRepairIntegrationPaths
	, ...callbackFinPhpWasmNominalRefusalRepairChangedPaths
	, ...callbackFinPhpWasmNominalRefusalRepairIntegrationPaths
	, ...dependentCheckedRecordPhpSpacePathRepairChangedPaths
	, ...dependentCheckedRecordPhpSpacePathRepairIntegrationPaths
	, ...callbackFinPhpWasmValidatorRepairChangedPaths
	, ...callbackFinPhpWasmValidatorRepairIntegrationPaths
	, ...callbackCheckedRecordRetainedPackagesChangedPaths
	, ...ownedCheckedRecordJavaScriptRetentionChangedPaths
	, ...callbackSubtypeRetainedPackagesChangedPaths
	, ...recursivePhpWasmEvidenceReplayRepairChangedPaths
	, ...ownedCheckedRecordHostedArchiversChangedPaths
	, ...zeroPayloadMatrixClosureChangedPaths
	, ...ownedCheckedRecordPhpWasmRetainedHandoffChangedPaths
	, ...ownedCheckedRecordEvidenceContractChangedPaths
	, ...ownedSubtypePythonDependencyRepairChangedPaths
	, ...ownedSubtypeDocumentationTransactionChangedPaths
	, ...callbackSubtypeHistoryTraversalRepairChangedPaths
	, ...ownedSubtypePerlIdentityRepairChangedPaths
	, ...ownedSubtypeWitResourceRepairChangedPaths
	, ...ownedSubtypeJvmFilenameRepairChangedPaths
	, ...ownedSubtypePromotionContractChangedPaths
	, ...ownedSubtypeHostedArchiveChangedPaths
	, ...ownedSubtypeEvidenceTestRegistrationChangedPaths
	, ...ownedSubtypeHostedEvidenceContractChangedPaths
	, ...callbackSubtypeDocumentationReviewRepairChangedPaths
	, ...phpWasmRefinementEntryGeneratorClosureChangedPaths
	, ...callbackSubtypeDocumentationReadinessChangedPaths
	, ...callbackSubtypeTestRegistrationChangedPaths
	, ...callbackSubtypeReviewRepairChangedPaths
	, ...callbackSubtypePromotionContractChangedPaths
	, ...callbackSubtypePromotionIntegrationPaths
	, ...callbackSubtypeHostedArchiveFoundationChangedPaths
	, ...phpWasmRefinementEntryDocumentationPrecisionChangedPaths
	, ...phpWasmRefinementEntryDocumentationChangedPaths
	, ...phpWasmRefinementEntryHostedVerifierRootChangedPaths
	, ...phpWasmRefinementEntryPromotionChangedPaths
	, ...phpWasmRefinementEntryHostedVerifierClosureChangedPaths
	, ...phpWasmRefinementCiClosureRepairChangedPaths
	, ...phpWasmRefinementEntryHostedChangedPaths
	, ...phpWasmRefinementEntryMatrixChangedPaths
	, ...phpWasmRefinementCiMatrixChangedPaths
	, ...callbackSubtypeManagedConsumerRepairChangedPaths
	, ...phpWasmIndexedRefinementEntryChangedPaths
	, ...callableClosureRefusalChangedPaths
	, ...phpWasmCallbackEntryChangedPaths
	, ...phpWasmOwnedRefinementEntryChangedPaths
	, ...phpWasmRefinementEntryInstalledChangedPaths
	, ...callbackSubtypePhpWasmProfileChangedPaths
	, ...witConsumerRootRepairChangedPaths
	, ...nominalEntryRepairChangedPaths
	, ...callbackRefinementsPhpWasmChangedPaths
	, ...callbackSubtypePhpWasmChangedPaths
	, ...ownedCheckedRecordPhpWasmChangedPaths
	, ...ownedSubtypePhpWasmQualificationChangedPaths
	, ...ownedSubtypePhpWasmPackageGapChangedPaths
	, ...ownedCheckedRecordManagedChangedPaths
	, ...ownedCheckedRecordLanguageChangedPaths
	, ...ownedCheckedRecordNativePerlChangedPaths
	, ...ownedCheckedRecordJavaScriptChangedPaths
	, ...ownedCheckedRecordCallableChangedPaths
	, ...ownedCheckedRecordFoundationChangedPaths
	, ...ownedCheckedRecordFoundationIntegrationPaths
	, ...dependentRecordConstructorAuthorityChangedPaths
	, ...dependentRecordConstructorAuthorityIntegrationPaths
	, ...callbackCheckedRecordPromotionChangedPaths
	, ...callbackCheckedRecordPromotionIntegrationPaths
	, ...callbackDependentIntegrationChangedPaths
	, ...callbackCheckedRecordNativeErrorRepairChangedPaths
	, ...callbackCheckedRecordRemainingChangedPaths
	, ...callbackCheckedRecordNativeChangedPaths
	, ...callbackCheckedRecordNativeIntegrationPaths
	, ...callbackCheckedRecordNpmBrowserChangedPaths
	, ...callbackCheckedRecordNpmBrowserIntegrationPaths
	, ...callbackCheckedRecordFoundationChangedPaths
	, ...callbackCheckedRecordFoundationIntegrationPaths
	, ...dependentCheckedRecordJvmArchiveImplementationPaths
	, ...dependentCheckedRecordJvmArchiveIntegrationPaths
	, ...dependentCheckedRecordHostedArchiversChangedPaths
	, ...dependentCheckedRecordHostedArchiversIntegrationPaths
	, ...nestedCheckedRecordRegressionContractChangedPaths
	, ...nestedCheckedRecordRegressionContractIntegrationPaths
	, ...dependentCheckedRecordPythonArchiveImplementationPaths
	, ...dependentCheckedRecordPythonArchiveIntegrationPaths
	, ...dependentCheckedRecordPerlArchiveImplementationPaths
	, ...dependentCheckedRecordPerlArchiveIntegrationPaths
	, ...dependentCheckedRecordHostedFailureRepairChangedPaths
	, ...dependentCheckedRecordHostedFailureRepairIntegrationPaths
	, ...dependentCheckedRecordRubyArchiveImplementationPaths
	, ...dependentCheckedRecordRubyArchiveIntegrationPaths
	, ...dependentCheckedRecordTypeSurfaceGapHistoricalPaths
	, ...dependentCheckedRecordTypeSurfaceGapIntegrationPaths
	, ...dependentCheckedRecordPhpWasmChangedPaths
	, ...dependentCheckedRecordPhpWasmIntegrationPaths
	, ...dependentCheckedRecordJvmChangedPaths
	, ...dependentCheckedRecordJvmIntegrationPaths
	, ...dependentCheckedRecordDotnetChangedPaths
	, ...dependentCheckedRecordDotnetIntegrationPaths
	, ...dependentCheckedRecordWitChangedPaths
	, ...dependentCheckedRecordWitIntegrationPaths
	, ...dependentCheckedRecordPhpChangedPaths
	, ...dependentCheckedRecordPhpIntegrationPaths
	, ...dependentCheckedRecordRustArchiveIntegrationPaths
	, ...dependentCheckedRecordArchiveSelectionRepairChangedPaths
	, ...dependentCheckedRecordArchiveSelectionRepairIntegrationPaths
	, ...zeroPayloadNativeControlContractChangedPaths
	, ...zeroPayloadNativeControlContractIntegrationPaths
	, ...dependentCheckedRecordHostedArchivePreparationChangedPaths
	, ...dependentCheckedRecordHostedArchivePreparationIntegrationPaths
	, ...dependentCheckedRecordRustChangedPaths
	, ...dependentCheckedRecordRustIntegrationPaths
	, ...dependentCheckedRecordRubyChangedPaths
	, ...dependentCheckedRecordRubyIntegrationPaths
	, ...dependentCheckedRecordPythonChangedPaths
	, ...dependentCheckedRecordPythonIntegrationPaths
	, ...dependentCheckedRecordPerlChangedPaths
	, ...dependentCheckedRecordPerlIntegrationPaths
	, ...dependentCheckedRecordNativeChangedPaths
	, ...dependentCheckedRecordNativeIntegrationPaths
	, ...dependentCheckedRecordFoundationChangedPaths
	, ...dependentCheckedRecordFoundationIntegrationPaths
	, ...dependentGenericSubtypeCiPinReconciliationChangedPaths
	, ...dependentGenericSubtypeCiPinReconciliationIntegrationPaths
	, ...dependentGenericSubtypeCiChangedPaths
	, ...dependentGenericSubtypeCiIntegrationPaths
	, ...dependentGenericSubtypeChangedPaths
	, ...dependentGenericSubtypeIntegrationPaths
	, ...genericSubtypeTestRegistrationChangedPaths
	, ...genericSubtypeTestRegistrationIntegrationPaths
	, ...genericSubtypeManagedWitChangedPaths
	, ...genericSubtypeManagedWitIntegrationPaths
	, ...genericSubtypeLanguageChangedPaths
	, ...genericSubtypeLanguageIntegrationPaths
	, ...genericSubtypeNativePerlChangedPaths
	, ...genericSubtypeNativePerlIntegrationPaths
	, ...callbackSubtypeHistoryPinReconciliationChangedPaths
	, ...callbackSubtypeHistoryPinReconciliationIntegrationPaths
	, ...callbackSubtypeRemainingPhpRepairChangedPaths
	, ...callbackSubtypeRemainingPhpRepairIntegrationPaths
	, ...zeroPayloadPhpWasmPromotionChangedPaths
	, ...zeroPayloadPhpWasmPromotionIntegrationPaths
	, ...zeroPayloadPhpWasmArchiveChangedPaths
	, ...zeroPayloadPhpWasmArchiveIntegrationPaths
	, ...callbackSubtypeRemainingRuntimeRepairChangedPaths
	, ...callbackSubtypeRemainingRuntimeRepairIntegrationPaths
	, ...ownedSubtypeNativeTransferAcceptanceChangedPaths
	, ...ownedSubtypeNativeTransferAcceptanceIntegrationPaths
	, ...hostedAcceptanceHandoffRepairChangedPaths
	, ...hostedAcceptanceHandoffRepairIntegrationPaths
	, ...zeroPayloadPhpWasmPlainExportRepairChangedPaths
	, ...zeroPayloadPhpWasmPlainExportRepairIntegrationPaths
	, ...zeroPayloadHostedPromotionChangedPaths
	, ...zeroPayloadHostedPromotionIntegrationPaths
	, ...zeroPayloadPerlWitEvidenceChangedPaths
	, ...zeroPayloadPerlWitEvidenceIntegrationPaths
	, ...zeroPayloadLanguageEvidenceChangedPaths
	, ...zeroPayloadLanguageEvidenceIntegrationPaths
	, ...zeroPayloadHostedArchivePreparationChangedPaths
	, ...zeroPayloadHostedArchivePreparationIntegrationPaths
	, ...zeroPayloadBrowserEvidenceChangedPaths
	, ...zeroPayloadBrowserEvidenceIntegrationPaths
	, ...zeroPayloadOrdinaryEvidenceExpectationChangedPaths
	, ...zeroPayloadOrdinaryEvidenceExpectationIntegrationPaths
	, ...historyReaderBufferRepairChangedPaths
	, ...historyReaderBufferRepairIntegrationPaths
	, ...hubTransitionGapChangedPaths
	, ...hubTransitionGapHistoricalPaths
	, ...ownedSubtypeHostRegistrationChangedPaths
	, ...callbackSubtypeBrowserArtifactChangedPaths
	, ...historyReaderHubRepairChangedPaths
	, ...historyReaderHubRepairIntegrationPaths
	, ...ledgerTransitionGapChangedPaths
	, ...ledgerTransitionGapHistoricalPaths
	, ...zeroPayloadRustPromotionChangedPaths
	, ...zeroPayloadRustPromotionIntegrationPaths
	, ...zeroPayloadTypeSurfaceGapHistoricalPaths
	, ...zeroPayloadTypeSurfaceGapIntegrationPaths
	, ...zeroPayloadDotnetPromotionChangedPaths
	, ...zeroPayloadDotnetPromotionIntegrationPaths
	, ...zeroPayloadJvmPromotionChangedPaths
	, ...zeroPayloadJvmPromotionIntegrationPaths
	, ...zeroPayloadRubyHistoryChangedPaths
	, ...zeroPayloadRubyHistoryIntegrationPaths
	, ...zeroPayloadPythonHistoryChangedPaths
	, ...zeroPayloadPythonHistoryIntegrationPaths
	, ...zeroPayloadJvmNullBoundaryChangedPaths
	, ...zeroPayloadJvmNullBoundaryHistoricalPaths
	, ...zeroPayloadJvmNullBoundaryIntegrationPaths
	, ...zeroPayloadNativePromotionChangedPaths
	, ...zeroPayloadNativePromotionIntegrationPaths
	, ...zeroPayloadBrowserDiagnosticChangedPaths
	, ...zeroPayloadBrowserDiagnosticIntegrationPaths
	, ...zeroPayloadNativeEvidenceChangedPaths
	, ...zeroPayloadNativeEvidenceIntegrationPaths
	, ...zeroPayloadPhpWasmHistoryChangedPaths
	, ...zeroPayloadPhpWasmHistoryIntegrationPaths
	, ...zeroPayloadPerlBooleanRepairChangedPaths
	, ...zeroPayloadWitHistoryChangedPaths
	, ...zeroPayloadWitHistoryIntegrationPaths
	, ...zeroPayloadPhpHistoryChangedPaths
	, ...zeroPayloadPhpHistoryIntegrationPaths
	, ...zeroPayloadPerlArchiveChangedPaths
	, ...zeroPayloadPerlArchiveIntegrationPaths
	, ...zeroPayloadRustArchiveChangedPaths
	, ...zeroPayloadRustArchiveIntegrationPaths
	, ...zeroPayloadRustCiChangedPaths
	, ...zeroPayloadRustCiIntegrationPaths
	, ...zeroPayloadRustAuditRepairChangedPaths
	, ...zeroPayloadRustAuditRepairIntegrationPaths
	, ...zeroPayloadRustInstalledChangedPaths
	, ...zeroPayloadRustInstalledIntegrationPaths
	, ...zeroPayloadRustChangedPaths
	, ...zeroPayloadRustIntegrationPaths
	, ...zeroPayloadJvmArchiveChangedPaths
	, ...zeroPayloadJvmArchiveIntegrationPaths
	, ...zeroPayloadJvmChangedPaths
	, ...zeroPayloadJvmIntegrationPaths
	, ...zeroPayloadDotnetControlRepairChangedPaths
	, ...zeroPayloadDotnetControlRepairIntegrationPaths
	, ...zeroPayloadDotnetArchiveChangedPaths
	, ...zeroPayloadDotnetArchiveIntegrationPaths
	, ...zeroPayloadVariantChangedPaths
	, ...zeroPayloadVariantIntegrationPaths
	, ...zeroPayloadDotnetVerifierRepairChangedPaths
	, ...zeroPayloadDotnetVerifierRepairIntegrationPaths
	, ...zeroPayloadDotnetCiChangedPaths
	, ...zeroPayloadDotnetCiIntegrationPaths
	, ...zeroPayloadDotnetChangedPaths
	, ...zeroPayloadDotnetIntegrationPaths
	, ...zeroPayloadNativeArchiveChangedPaths
	, ...zeroPayloadNativeArchiveIntegrationPaths
	, ...zeroPayloadNativeChangedPaths
	, ...zeroPayloadNativeIntegrationPaths
	, ...zeroPayloadBrowserArchiveChangedPaths
	, ...zeroPayloadBrowserArchiveIntegrationPaths
	, ...zeroPayloadBrowserCiChangedPaths
	, ...zeroPayloadBrowserCiIntegrationPaths
	, ...zeroPayloadBrowserChangedPaths
	, ...zeroPayloadBrowserIntegrationPaths
	, ...zeroPayloadNpmInstalledChangedPaths
	, ...zeroPayloadNpmInstalledIntegrationPaths
	, ...zeroPayloadJavaScriptChangedPaths
	, ...zeroPayloadJavaScriptIntegrationPaths
	, ...zeroPayloadNpmFoundationChangedPaths
	, ...zeroPayloadNpmFoundationIntegrationPaths
	, ...zeroPayloadCheckedRecordChangedPaths
	, ...zeroPayloadCheckedRecordIntegrationPaths
	, ...projectedCheckedRecordMirrorChangedPaths
	, ...projectedCheckedRecordMirrorIntegrationPaths
	, ...perlEngineOwnedRefinementClosureChangedPaths
	, ...perlEngineOwnedRefinementClosureIntegrationPaths
	, ...structuralSubtypePartitionValidatorChangedPaths
	, ...structuralSubtypePartitionValidatorIntegrationPaths
	, ...genericSubtypeNpmBrowserChangedPaths
	, ...genericSubtypeNpmBrowserIntegrationPaths
	, ...ownedSubtypeCoreRegistrationChangedPaths
	, ...coreRunnerHeadroomChangedPaths
	, ...genericSubtypeCompositionChangedPaths
	, ...ownedSubtypeJavaScriptTransferChangedPaths
	, ...ownedSubtypeJavaScriptChangedPaths
	, ...ownedRefinementCarriersChangedPaths
	, ...ownedRefinementModelChangedPaths
	, ...ownedSubtypeAnalysisChangedPaths
	, ...callbackSubtypeRemainingAcceptanceChangedPaths
	, ...callbackSubtypeRemainingChangedPaths
	, ...callbackSubtypeLanguageChangedPaths
	, ...callbackCheckedRecordLanguageChangedPaths
	, ...callbackSubtypeNativeChangedPaths
	, ...callbackSubtypeNpmAcceptanceChangedPaths
	, ...callbackSubtypeNpmBrowserChangedPaths
	, ...callbackSubtypeFoundationChangedPaths
	, ...nominalSubtypeEntryMeasurementChangedPaths
	, ...checkedRecordValueIndexMatrixEvidencePinRepairChangedPaths
	, ...checkedRecordValueIndexMatrixPinRepairChangedPaths
	, ...checkedRecordValueIndexMatrixLintChangedPaths
	, ...checkedRecordValueIndexMatrixHistoryGapChangedPaths
	, ...checkedRecordValueIndexMatrixHistoryGapHistoricalPaths
	, ...checkedRecordValueIndexMatrixRegistrationChangedPaths
	, ...checkedRecordValueIndexMatrixCheckoutChangedPaths
	, ...checkedRecordValueIndexMatrixPromotionChangedPaths
	, ...checkedRecordValueIndexBrowserPromotionChangedPaths
	, ...checkedRecordValueIndexRustPromotionChangedPaths
	, ...checkedRecordValueIndexRustArchiveChangedPaths
	, ...checkedRecordValueIndexRustResultOnlyRepairChangedPaths
	, ...checkedRecordValueIndexWitPromotionChangedPaths
	, ...checkedRecordValueIndexWitArchiveChangedPaths
	, ...checkedRecordValueIndexPhpWasmPromotionChangedPaths
	, ...checkedRecordValueIndexPhpWasmArchiveChangedPaths
	, ...checkedRecordValueIndexRustInventoryRepairChangedPaths
	, ...checkedRecordValueIndexWitCallerWarningRepairChangedPaths
	, ...checkedRecordValueIndexPhpWasmChangedPaths
	, ...checkedRecordValueIndexRustCountRepairChangedPaths
	, ...checkedRecordValueIndexRubyPromotionChangedPaths
	, ...checkedRecordValueIndexRubyArchiveChangedPaths
	, ...checkedRecordValueIndexPythonPromotionChangedPaths
	, ...checkedRecordValueIndexWitVerifierRepairChangedPaths
	, ...checkedRecordValueIndexPythonArchiveHistoryGapHistoricalPaths
	, ...checkedRecordValueIndexPythonArchiveChangedPaths
	, ...checkedRecordValueIndexPerlPromotionChangedPaths
	, ...checkedRecordValueIndexPerlArchiveHistoryGapHistoricalPaths
	, ...checkedRecordValueIndexPerlArchiveChangedPaths
	, ...valueIndexNativeTapContractChangedPaths
	, ...checkedRecordValueIndexWitAcceptanceChangedPaths
	, ...checkedRecordValueIndexWitChangedPaths
	, ...checkedRecordValueIndexRustAcceptanceChangedPaths
	, ...checkedRecordValueIndexRustChangedPaths
	, ...checkedRecordValueIndexRubyChangedPaths
	, ...checkedRecordValueIndexPhpPromotionChangedPaths
	, ...checkedRecordValueIndexPhpArchiveChangedPaths
	, ...valueIndexNativeBindingIrOrderingRepairChangedPaths
	, ...checkedRecordValueIndexPerlChangedPaths
	, ...checkedRecordValueIndexPerlHistoricalPaths
	, ...coreThirdRunResidualRepairChangedPaths
	, ...checkedRecordValueIndexNativeBindingIrChangedPaths
	, ...coreSecondRunResidualRepairChangedPaths
	, ...checkedRecordValueIndexJvmNullBoundaryChangedPaths
	, ...checkedRecordValueIndexJvmNativeRepairChangedPaths
	, ...checkedRecordValueIndexBrowserArchiveChangedPaths
	, ...coreFirstRunResidualRepairChangedPaths
	, ...coreTerminalReachabilityChangedPaths
	, ...coreTerminalReachabilityTerminalPaths
	, ...coreFirstRunRepairChangedPaths
	, ...checkedRecordValueIndexDotnetArchiveChangedPaths
	, ...checkedRecordValueIndexJvmChangedPaths
	, ...checkedRecordValueIndexDotnetResultOnlyCoreRepairChangedPaths
	, ...checkedRecordValueIndexNativeDotnetVerifierRepairChangedPaths
	, ...checkedRecordValueIndexDotnetHostedRepairChangedPaths
	, ...checkedRecordValueIndexDotnetCiChangedPaths
	, ...sourceHistoryMilestoneAssertionRepairChangedPaths
	, ...checkedRecordValueIndexDotnetInstalledChangedPaths
	, ...checkedRecordValueIndexDotnetChangedPaths
	, ...valueIndexBrowserLintChangedPaths
	, ...valueIndexCoreLineageRepairChangedPaths
	, ...valueIndexCoreLineageRepairHistoricalPaths
	, ...coreQualityShardingChangedPaths
	, ...checkedRecordValueIndexFoundationChangedPaths
	, ...recursiveCheckedRecordPromotionChangedPaths
	, ...mutualCheckedRecordNativeArchiveChangedPaths
	, ...recursiveNativeGraphLoaderIsolationChangedPaths
	, ...recursiveNativeGraphVerifierRepairChangedPaths
	, ...recursiveNativeSelectorRepairChangedPaths
	, ...callbackFinGateRepairChangedPaths
	, ...downstreamFinCiRepairChangedPaths
	, ...downstreamFinCiRepairHistoricalPaths
	, ...historyHubReachabilityRepairChangedPaths
	, ...inheritedCheckedRecordFoundationVerifierChangedPaths
	, ...inheritedCheckedRecordFoundationVerifierHistoricalPaths
	, ...perlRecursiveConversionOutputChangedPaths
	, ...mutualCheckedRecordNativeReviewChangedPaths
	, ...mutualCheckedRecordNativeHardeningChangedPaths
	, ...inheritedCheckedRecordDocsClosureChangedPaths
	, ...inheritedCheckedRecordPromotionChangedPaths
	, ...inheritedCheckedRecordPerlFinalVerifierChangedPaths
	, ...inheritedCheckedRecordPerlArchiveChangedPaths
	, ...inheritedCheckedRecordPerlVerifierChangedPaths
	, ...primitiveAuditCoreRepairChangedPaths
	, ...primitiveAuditIntegrationChangedPaths
	, ...inheritedCheckedRecordPerlArgumentsChangedPaths
	, ...inheritedCheckedRecordPerlStdoutChangedPaths
	, ...inheritedCheckedRecordPerlPinRepairChangedPaths
	, ...inheritedCheckedRecordPerlChangedPaths
	, ...inheritedCheckedRecordPhpPinRepairChangedPaths
	, ...inheritedCheckedRecordPhpChangedPaths
	, ...phpWasmWriterGuardChangedPaths
	, ...phpCopiedKeywordChangedPaths
	, ...inheritedCheckedRecordRubyChangedPaths
	, ...inheritedCheckedRecordDotnetArtifactRetentionChangedPaths
	, ...inheritedCheckedRecordPythonChangedPaths
	, ...inheritedCheckedRecordHostedEvidenceChangedPaths
	, ...inheritedCheckedRecordJvmChangedPaths
	, ...inheritedCheckedRecordDotnetChangedPaths
	, ...checkedRecordAliasAdmissionChangedPaths
	, ...inheritedCheckedRecordTestRegistrationChangedPaths
	, ...inheritedCheckedRecordFoundationChangedPaths
	, ...checkedJavaScriptDispositionChangedPaths
	, ...nestedCheckedRecordDiagnosticOracleChangedPaths
	, ...nestedCheckedRecordNativeArchiveHistoricalPaths
	, ...recursiveComponentRegressionRepairChangedPaths
	, ...recursiveWitTestRegistrationChangedPaths
	, ...lateCheckedRecordTestRegistrationChangedPaths
	, ...ciContractRepairChangedPaths
	, ...closedGenericCheckedRecordChangedPaths
	, extractorPath, typeSurfacePath, ...Object.keys(transitions)
	, ...Object.keys(verifierEdits), ...subtypeRefinementChangedPaths
	, ...subtypeHeapChangedPaths, ...subtypeComponentChangedPaths
	, ...nestedFinChangedPaths, ...refinementClosureChangedPaths
	, ...nominalFinChangedPaths, ...callbackFinChangedPaths
	, ...perlEvidenceRepairChangedPaths, ...nativeFinChangedPaths
	, ...npmFinDiagnosticsChangedPaths, ...diagnosticFollowupChangedPaths
	, ...combinedLineageChangedPaths, ...testProfileRegistrationChangedPaths
	, ...runtimeReceiptChangedPaths, ...cpanCliControlChangedPaths
	, ...pythonFinChangedPaths
	, ...rustFinChangedPaths
	, ...rubyFinChangedPaths
	, ...dotnetFinChangedPaths
	, ...jvmFinChangedPaths
	, ...phpFinChangedPaths
	, ...witFinChangedPaths
	, ...finDistributionChangedPaths
	, ...perlFinChangedPaths
	, ...hostFinEvidenceChangedPaths
	, ...nativeSpecializationsChangedPaths
	, ...nativeFinContainersChangedPaths
	, ...nativeSubtypeChangedPaths
	, ...refinementAuditChangedPaths
	, ...browserRefinementsChangedPaths
	, ...scalarFinRejectionChangedPaths
	, ...scalarFinWordingChangedPaths
	, ...perlRefinementsChangedPaths
	, ...perlIndexedErrorsChangedPaths
	, ...refinementCiRepairChangedPaths
	, ...pythonRefinementEvidenceChangedPaths
	, ...containerHostDispatchChangedPaths
	, ...reviewedSemanticDecisionsChangedPaths
	, ...genericRecordsChangedPaths
	, ...reviewedFinChangedPaths
	, ...refinementHistoryCacheChangedPaths
	, ...reviewedFinEvidenceChangedPaths
	, ...historyDigestChangedPaths
	, ...genericRecordHostsChangedPaths
	, ...genericRecordSpecializationChangedPaths
	, ...refinementCoreFollowupChangedPaths
	, ...perlFinArchiveChangedPaths
	, ...reviewedScalarHostsChangedPaths
	, ...refinementCiFollowupChangedPaths
	, ...perlFinXsAuditChangedPaths
	, ...finProductsChangedPaths
	, ...genericRecordPromotionChangedPaths
	, ...reviewedScalarRolloutChangedPaths
	, ...finProductsCiChangedPaths
	, ...finProductsFloorsChangedPaths
	, ...genericRecordsEngineChangedPaths
	, ...finProductArraysChangedPaths
	, ...reviewedFinAcceptanceChangedPaths
	, ...nativeFinRecordsChangedPaths
	, ...phpWasmFinChangedPaths
	, ...reviewedFinPromotionChangedPaths
	, ...ciDependencyTimeoutChangedPaths
	, ...finProductPhpNameChangedPaths
	, ...phpReceiverDependencyChangedPaths
	, ...nativeFinPromotionChangedPaths
	, ...reviewedSubtypeDecisionsChangedPaths
	, ...witDependencyChangedPaths
	, ...genericRecordBrowserChangedPaths
	, ...reviewedSpecializationAdmissionChangedPaths
	, ...phpWasmFinArchiveChangedPaths
	, ...genericRecordBrowserArchiveChangedPaths
	, ...reviewedSpecializationCiHotfixChangedPaths
	, ...nativeFinCallbackAdmissionChangedPaths
	, ...reviewedSubtypeAdmissionChangedPaths
	, ...callbackCodeCiRepairChangedPaths
	, ...reviewedCallbackFinAdmissionChangedPaths
	, ...nativeFinCallbackArchiveChangedPaths
	, ...closureHistoryCiRepairChangedPaths
	, ...reviewedNpmSnapshotChangedPaths
	, ...reviewedSubtypeHarnessChangedPaths
	, ...reviewedCallbackHarnessChangedPaths
	, ...reviewedSpecializationArchiveChangedPaths
	, ...reviewedInstantiationChangedPaths
	, ...browserCallbackArchiveChangedPaths
	, ...subtypeFixtureLinkChangedPaths
	, ...inheritedRecordsChangedPaths
	, ...inheritanceSubtypeHarnessChangedPaths
	, ...reviewedSubtypeArchiveChangedPaths
	, ...reviewedApiPromotionChangedPaths
	, ...subtypeAliasPositionChangedPaths
	, ...finCallbackDiagnosticChangedPaths
	, ...subtypeXsArchiveChangedPaths
	, ...checkedRecordAdmissionChangedPaths
	, ...finPythonRubyArchiveChangedPaths
	, ...finRuntimeProvenanceChangedPaths
	, ...finPythonRubyPromotionChangedPaths
	, ...finPythonRubyHostNotesChangedPaths
	, ...finRecordWitFormatChangedPaths
	, ...browserInstallChangedPaths
	, ...finWitArchiveChangedPaths
	, ...jvmShardChangedPaths
	, ...archiveBatchChangedPaths
	, ...finNativeBatchPromotionChangedPaths
	, ...phpShardChangedPaths
	, ...checkedRecordPromotionChangedPaths
	, ...copiedGraphRepairChangedPaths
	, ...callbackFinPromotionChangedPaths
	, ...phpWasmReviewedFinChangedPaths
	, ...reviewedPhpWasmFinArchiveChangedPaths
	, ...nativeConsumerCiRepairChangedPaths
	, ...phpWasmFinPromotionChangedPaths
	, ...nativeFinReplyChangedPaths
	, ...callbackCoverageRepairChangedPaths
	, ...nativeFinReplyArchiveChangedPaths
	, ...nativeFinReplyPromotionChangedPaths
	, ...nodeConsumerBudgetChangedPaths
	, ...nativeReplySymbolFixChangedPaths
	, ...nativeReplyReviewChangedPaths
	, ...scalarFinSourceEntryIntegrationChangedPaths
	, ...scalarFinSourceEntryCiChangedPaths
	, ...nativeReplyRefusalChangedPaths
	, ...browserGenericPromotionChangedPaths
	, ...reviewedInstantiationArchiveChangedPaths
	, ...phpDispatchIntegrationChangedPaths
	, ...reviewedRecordPromotionChangedPaths
	, ...witDispatchIntegrationChangedPaths
	, ...inheritedRecordArchiveChangedPaths
	, ...Object.keys(inheritedRecordArchiveProducerPins)
	, ...perlXsBudgetChangedPaths
	, ...genericRefusalFixChangedPaths
	, ...inheritedRecordPromotionChangedPaths
	, ...rubyGdbCiChangedPaths
	, ...genericNpmClosureChangedPaths
	, ...perlRefinementHostedChangedPaths
	, ...perlRelocatedConsumerChangedPaths
	, ...rubyDispatchIntegrationChangedPaths
	, ...dotnetDispatchIntegrationChangedPaths
	, ...authorRefinementDocsChangedPaths
	, ...perlScalarRelocationChangedPaths
	, ...jvmDispatchIntegrationChangedPaths
	, ...finScalarDispatchInventoryChangedPaths
	, ...reviewedFinRefusalChangedPaths
	, ...reviewedFinRefusalCiChangedPaths
	, ...cppFinDispatchIntegrationChangedPaths
	, ...perlRelocatedPromotionChangedPaths
	, ...perlClosureNativeBudgetChangedPaths
	, ...finEntryIntegrationChangedPaths
	, ...finContainerEvidenceCiChangedPaths
	, ...hostedContainerInventoryChangedPaths
	, ...wasmEntryControlsChangedPaths
	, ...wasmEntryHarnessChangedPaths
	, ...nativeEdgeArrayHarnessChangedPaths
	, ...wasmEntryArchiveChangedPaths
	, ...wasmCiArrayChangedPaths
	, ...perlScalarPromotionChangedPaths
	, ...wasmEntrySupplementChangedPaths
	, ...arrayRolloutChangedPaths
	, ...finDiagnosticChangedPaths
	, ...finDiagnosticCiChangedPaths
	, ...finEdgeIntegrationChangedPaths
	, ...finEdgeCiChangedPaths
	, ...finForeignChangedPaths
	, ...finRecordOmissionChangedPaths
	, ...finHostedPromotionChangedPaths
	, ...finZeroCiChangedPaths
	, ...finNominalRefusalChangedPaths
	, ...finAliasClosureChangedPaths
	, ...phpWasmDirectFinChangedPaths
	, ...finCoreRepairChangedPaths
	, ...phpWasmDirectPromotionChangedPaths
	, ...phpWasmSubtypeChangedPaths
	, ...phpWasmSubtypeAcceptanceChangedPaths
	, ...phpWasmSubtypePromotionChangedPaths
	, ...finDotnetSdkChangedPaths
	, ...finJvmDiagnosticsChangedPaths
	, ...phpWasmSubtypeEntryChangedPaths
	, ...phpWasmEntryHarnessChangedPaths
	, ...phpWasmEntryCiChangedPaths
	, ...reviewedSubtypeHostChangedPaths
	, ...reviewedPerlDiagnosticChangedPaths
	, ...refinementFollowupChangedPaths
	, ...finHistoryBufferRepairChangedPaths
	, ...reviewedSubtypeNativePromotionChangedPaths
	, ...reviewedSubtypeHostCiReportChangedPaths
	, ...reviewedSubtypeHostCiChangedPaths
	, ...mavenPrerequisiteChangedPaths
	, ...reviewedSubtypePackageRecordChangedPaths
	, ...reviewedSubtypePackageCiChangedPaths
	, ...reviewedSubtypeBrowserChangedPaths
	, ...reviewedSubtypeBrowserCiChangedPaths
	, ...reviewedSubtypeBrowserPromotionChangedPaths
	, ...checkedRecordNativeHostChangedPaths
	, ...checkedRecordNativeInstalledChangedPaths
	, ...checkedRecordPythonArchiveChangedPaths
	, ...checkedRecordRubyJvmArchiveChangedPaths
	, ...checkedRecordRemainingHostsArchiveChangedPaths
	, ...checkedRecordNativePromotionChangedPaths
	, ...checkedRecordHostCiChangedPaths
	, ...refinementCoreCiChangedPaths
	, ...checkedRecordPerlChangedPaths
	, ...checkedRecordPerlInstalledChangedPaths
	, ...checkedRecordPerlPromotionChangedPaths
	, ...structuralSubtypeSelectionChangedPaths
	, ...structuralSubtypeRuntimeChangedPaths
	, ...structuralSubtypeRegistrationChangedPaths
	, ...structuralSubtypeCiFoundationChangedPaths
	, ...structuralSubtypeCiWorkflowChangedPaths
	, ...structuralSubtypePromotionChangedPaths
	, ...structuralSubtypeCoreCiChangedPaths
	, ...checkedRecordBrowserChangedPaths
	, ...finNixComparisonChangedPaths
	, ...perlContainerSubtypeCiChangedPaths
	, ...checkedRecordBrowserArchiveChangedPaths
	, ...checkedRecordBrowserCiChangedPaths
	, ...checkedRecordBrowserPromotionChangedPaths
	, ...checkedRecordPhpWasmChangedPaths
	, ...checkedRecordPhpWasmArchiveChangedPaths
	, ...checkedRecordPhpWasmCiChangedPaths
	, ...checkedRecordPhpWasmPromotionChangedPaths
	, ...nominalSubtypeConversionChangedPaths
	, ...perlHistoryCheckoutChangedPaths
	, ...nominalSubtypeSelectionChangedPaths
	, ...nominalSubtypeNativeChangedPaths
	, ...subtypeResultChangedPaths
	, ...nominalSubtypeAuthorChangedPaths
	, ...componentRefinementMirrorChangedPaths
	, ...jvmPendingExitChangedPaths
	, ...nativeHistoryCheckoutChangedPaths
	, ...componentNominalSubtypeChangedPaths
	, ...witHistoryCheckoutChangedPaths
	, ...nominalSubtypeNpmPromotionChangedPaths
	, ...nominalSubtypeNativePromotionChangedPaths
	, ...componentEngineClosureChangedPaths
	, ...nominalSubtypePerlRegistrationChangedPaths
	, ...cliImportRepairChangedPaths
	, ...coreContractRepairChangedPaths
	, ...nominalSubtypePerlPromotionChangedPaths
	, ...nominalSubtypePythonRegistrationChangedPaths
	, ...nominalSubtypePythonArchiveChangedPaths
	, ...nominalSubtypePythonPromotionChangedPaths
	, ...nominalSubtypeRubyRegistrationChangedPaths
	, ...nominalSubtypeRubyArchiveChangedPaths
	, ...nominalSubtypeRubyPromotionChangedPaths
	, ...nominalSubtypeRustRegistrationChangedPaths
	, ...nominalSubtypeRustArchiveChangedPaths
	, ...nominalSubtypeRustPromotionChangedPaths
	, ...nominalSubtypeDotnetRegistrationChangedPaths
	, ...witHistoryCheckoutRepairChangedPaths
	, ...nominalSubtypeDotnetCiChangedPaths
	, ...phpWasmFailureDiagnosticsChangedPaths
	, ...jvmContainerEntryExitChangedPaths
	, ...nominalSubtypeDotnetPromotionChangedPaths
	, ...nativeConsumerPartitionChangedPaths
	, ...nominalSubtypeJvmRegistrationChangedPaths
	, ...nativeOwnedGateChangedPaths
	, ...nativeFinJvmExitChangedPaths
	, ...nominalSubtypeJvmCiChangedPaths
	, ...nominalSubtypeJvmPromotionChangedPaths
	, ...nominalSubtypePhpRegistrationChangedPaths
	, ...managedNominalGateChangedPaths
	, ...nominalSubtypePhpCiChangedPaths
	, ...nominalSubtypePhpPromotionChangedPaths
	, ...nominalSubtypeWitRegistrationChangedPaths
	, ...nominalSubtypeWitCiChangedPaths
	, ...nominalSubtypeWitPromotionChangedPaths
	, ...nominalSubtypeBrowserRegistrationChangedPaths
	, ...nominalSubtypeBrowserPromotionChangedPaths
	, ...nominalSubtypePhpWasmRegistrationChangedPaths
	, ...nominalSubtypePhpWasmPromotionChangedPaths
	, ...nominalPrimitiveSubtypeRegistrationChangedPaths
	, ...phpWasmCorpusPartitionChangedPaths
	, ...nominalSubtypePhpWasmPathChangedPaths
	, ...nominalPrimitiveSubtypeNpmPromotionChangedPaths
	, ...nominalPrimitiveSubtypePythonRegistrationChangedPaths
	, ...nominalPrimitiveSubtypePythonPromotionChangedPaths
	, ...nominalPrimitiveSubtypeRubyRegistrationChangedPaths
	, ...nominalPrimitiveSubtypeBrowserRegistrationChangedPaths
	, ...nominalPrimitiveSubtypeBrowserPromotionChangedPaths
	, ...nominalPrimitiveSubtypeNativeRegistrationChangedPaths
	, ...nominalPrimitiveSubtypeNativePromotionChangedPaths
	, ...coreQualityBudgetChangedPaths
	, ...nominalPrimitiveSubtypePerlRegistrationChangedPaths
	, ...nominalPrimitiveSubtypePerlIntegrationChangedPaths
	, ...nominalPrimitiveSubtypeRubyIntegrationChangedPaths
	, ...nominalPrimitiveSubtypePerlPromotionChangedPaths
	, ...nominalPrimitiveSubtypeRubyPromotionChangedPaths
	, ...nominalSubtypeDotnetCeilingChangedPaths
	, ...primitiveSubtypeHistoryRepairChangedPaths
	, ...nominalPrimitiveSubtypeRustPromotionChangedPaths
	, ...valueIndexTestProfileGapChangedPaths
	, ...valueIndexTestProfileGapHistoricalPaths
	, ...nominalPrimitiveSubtypeDotnetPromotionChangedPaths
	, ...nominalPrimitiveSubtypePhpPromotionChangedPaths
	, ...nominalPrimitiveSubtypePhpWasmPromotionChangedPaths
	, ...recursiveSubtypePhpWasmChangedPaths
	, ...recursiveSubtypePhpWasmPromotionChangedPaths
	, ...nestedCheckedRecordChangedPaths
	, ...nestedCheckedRecordBrowserPromotionChangedPaths
	, ...nominalPrimitiveSubtypeWitPromotionChangedPaths
	, ...nominalPrimitiveSubtypeJvmPromotionChangedPaths
	, ...nestedCheckedRecordNativeCorrectionChangedPaths
	, ...nestedCheckedRecordNativePromotionChangedPaths
	, ...nestedCheckedRecordQualityChangedPaths
	, ...nestedCheckedRecordDotnetPromotionChangedPaths
	, ...nominalPrimitiveSubtypeAuditCorrectionChangedPaths
	, nominalPrimitiveSubtypeRegistrationGapPath
	, ...nominalPrimitiveSubtypeRegistrationGapChangedPaths
	, nestedCheckedRecordArchiveGapPath
	, ...nestedCheckedRecordArchiveGapChangedPaths
	, ...nestedCheckedRecordJvmPromotionChangedPaths
	, ...nestedCheckedRecordPerlPromotionChangedPaths
	, ...nestedCheckedRecordPhpPromotionChangedPaths
	, ...nestedCheckedRecordPythonPromotionChangedPaths
	, ...nestedCheckedRecordRubyPromotionChangedPaths
	, ...nestedCheckedRecordWitPromotionChangedPaths
	, ...nestedCheckedRecordPhpWasmPromotionChangedPaths
	, ...nestedCheckedRecordRustPromotionChangedPaths
	, ...nestedCheckedRecordMatrixClosureChangedPaths
	, ...mutualCheckedRecordChangedPaths
	, ...mutualCheckedRecordNpmChangedPaths
	, ...mutualCheckedRecordNpmArchiveChangedPaths
	, ...mutualCheckedRecordDotnetChangedPaths
	, ...mutualCheckedRecordJvmChangedPaths
	, ...recursiveCheckedRecordPerlDiagnosticChangedPaths
	, ...recursiveCheckedRecordPerlPackageHistoricalPaths
	, ...recursiveCheckedRecordPerlPackageHistoryRepairChangedPaths
	, ...phpGraphDiagnosticChangedPaths
	, ...witGraphDiagnosticChangedPaths
	, ...pythonGraphDiagnosticChangedPaths
	, ...rubyGraphDiagnosticChangedPaths
	, ...rubyGraphKeywordFieldChangedPaths
	, ...rubyMemberEscapeChangedPaths
	, ...rustGraphDiagnosticChangedPaths
])].sort());

/**
 * Preserve the original buffer when no authenticated transition changes its bytes.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text or bytes.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeFinRefinementSource = (path, source, expected) => {
	if(!finRefinementNormalizationPaths.includes(path)) return source;
	let text = source.toString();
	const input = text;
	if(expected !== undefined && sha256(text) === expected) return source;
	let stage = beforeDirectProofErasureCompleteEntrypointsSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDependentSignatureFocusedArchiveSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeFocusedAcceptanceSparseCheckoutSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCompleteAcceptanceBudgetSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDependentSignatureProducerSparseCheckoutSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeProofErasureCoreLintRepairSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDependentSignatureProducerConcurrencySource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDependentSignatureAuditSparseCheckoutSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDependentSignatureShallowCheckoutSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOptionalParameterCompletePromotionSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOptionalParameterReceiptSparseCheckoutSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOptionalParameterRouteBinderRepairSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOptionalParameterPerlUnicodeDefaultRepairSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOptionalParameterInstalledAcceptanceRepairSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeNpmRuntimeModuleGraphClosureSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOptionalParameterNativeEvidenceRepairSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullFocusedArchiveInputSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullFocusedCiSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreCurrentSourcePinRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeFocusedTypeSurfaceProducerRepairSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDependentSignatureFocusedCiSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasureFocusedCiSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOptionalParameterDispatchBridgeSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOptionalParameterFocusedCiSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOptionalParameterCurrentLineIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullSystemsTypeSurfaceIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullSystemsIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullSystemsTypeSurfaceSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullSystemsSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeGeneratedOutputControlRepairTypeSurfaceIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeGeneratedOutputControlRepairIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeGeneratedOutputControlRepairTypeSurfaceSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeGeneratedOutputControlRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullScriptingTypeSurfaceIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullScriptingIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullDownstreamIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullManagedIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullPhpIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullTypeSurfaceLineageIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullPartitionGapIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullScriptingTypeSurfaceSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullScriptingSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullDownstreamSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeNpmRuntimeDefaultValueCopyRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	// The recovered combined-lineage type-surface pins follow the managed and npm repair commits.
	stage = beforeHostNullTypeSurfaceLineageSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullManagedSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullPhpSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	// The recovered HostNull PHP and promotion partition transitions precede the npm repair.
	stage = beforeHostNullPartitionGapSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeHostNullJavaScriptSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCorpusTrapBuildCheckoutRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePerformanceReproducibilityCheckoutSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpWasmCorpusLaneSplitSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDownstreamDirectProofControlRepairSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasureDownstreamRepairSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasureHostedFollowupSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasureNativeProducerRepairSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasureNativeEvidenceCorrectionSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOptionalParameterSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePerlDependentRefinementRejectionSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeWitFrozenClosureHubHookSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDownstreamReporterSparseCheckoutSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasureNpmArchiveSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasureMatrixSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasureTestRegistrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeProofErasureWitLintJoinSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeProofErasureLintPinRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasureWitSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasureLanguageSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasureManagedSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeProofCoreLocalJoinSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasurePhpSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasureNativeSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasureNpmSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasurePackageSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasureFixtureSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDirectProofErasureSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeProofErasureEvidenceAuditSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDependentSignatureCompletionSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreRecordedTransitionRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreReadSiteRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreOwnedCallbackPicRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCorePreBoxRecountRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreReviewedFinBoxHarnessRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreShardFourSerialSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreLegacyFinArchiveRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreGeneratedDocumentRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreShardFiveEightRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeWitCallbackFrozenClosureIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeWitCallbackFrozenClosureSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreDeterministicBoundaryRepairIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreDeterministicBoundaryRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeSignatureSpecializationCompletionPinRepairIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeSignatureSpecializationCompletionPinRepairSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeSignatureSpecializationCompletionPromotionIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeSignatureSpecializationCompletionPromotionSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeSignatureSpecializationHostedArchiveReplayIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeSignatureSpecializationHostedArchiveReplaySource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeSignatureSpecializationCompletionPreparationIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeSignatureSpecializationCompletionPreparationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeInheritedCheckedRecordLaneMemoryLocalJoinSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeInheritedCheckedRecordLaneMemoryIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeInheritedCheckedRecordLaneMemorySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackFinPerlLocalJoinSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackFinPerlMilestoneReadIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackFinPerlMilestoneReadSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreRubyPredecessorStopSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackFinMilestoneReadIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackFinMilestoneReadSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreHubOrderMergedIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeSignatureSpecializationHostedProducerBindingIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeSignatureSpecializationHostedProducerBindingSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeSignatureSpecializationPhpWasmConsumerRepairIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeSignatureSpecializationPhpWasmConsumerRepairSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreNativeEvidenceManifestIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreNativeEvidenceManifestSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePerlCodegenMergedIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePerlCodegenMergedSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePerlCodegenProducerReplayIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePerlCodegenProducerReplaySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreHistoricalContractRepairIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreHistoricalContractRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeNativeFinCallbackRoleIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreHubOrderMergedSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreHubOrderRepairIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreHubOrderRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeSignatureSpecializationHostedSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeSignatureSpecializationCompletionIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeSignatureSpecializationCompletionSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeFinContractTestRegistrationIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeFinContractTestRegistrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeFinCompletionPromotionSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeReviewedFinFocusedProducerSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeReviewedFinJobScopeSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeLeanToolchainReleaseFallbackSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackFinSparseCheckoutSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackFinShallowCheckoutSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreCiReliabilitySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreShardFiveRepairIntegrationSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreShardFiveRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreCallbackFinLivePinRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackFinPerlRuntimeSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackFinPerlDirectionSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackFinHostRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeReplayChainMemoryIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeReplayChainMemorySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackFinDiagnosticContractSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreMemoryBoundIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreMemoryBoundSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackFinInstalledRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeReviewedCallbackFinBrowserSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeReviewedFinWasmFieldSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackFinNativeCapabilitySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackFinHostedWorkflowSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeNativeFinCallbackRoleSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreHistoricalEvidenceReuseLivePinRepairSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreHistoricalEvidenceReuseSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreExactHeadMatrixRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreExactHeadHostedStaticRepairSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreExactHeadHostedReplayRepairSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreInheritedRecordTypeSurfaceBatchSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreRecursiveCallableEvidencePinRepairSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreRecursiveCallableReplayBoundSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreLegacyOwnedEvidenceReplayBoundSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreCallbackEvidenceReplayBoundSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreInheritedRecordReplayBoundSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreReplayIntegrationEndpointRepairSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreExactHeadReplayRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeRecurringAcceptanceDocumentationSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeBoundedRecurringAcceptanceSweepSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreExactHeadValidationRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDefaultBranchCiTriggerBudgetSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreUniqueTypeSurfaceAuthenticationSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreHistoricalAdditionCheckoutRepairSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreTypeSurfaceSinglePassSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreDocumentationEvidenceClosureRepairSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreBrowserWorkflowEvidencePinRepairSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreTypeSurfaceEvidenceClosureRepairSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreSparseConeModeRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreContractEvidenceCheckoutSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeNominalPrimitiveSubtypeSparseCheckoutSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreStaticSparseCheckoutSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreStaticHistoryDeferralSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreOwnedReviewedExactStopRepairSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreWitExactStopRepairSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreRuntimeBudgetLivePinRepairSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreContractRuntimeBudgetSource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreReceiverCiStopBoundarySource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreWitBorrowStopBoundarySource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreReceiverCiProducerReplaySource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreWitBorrowProducerReplaySource(
		path, text, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreExactHeadLivePinRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreHistoricalEvidenceReplaySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreRunnerResilienceSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeNominalSubtypeEntryLivePinRepairSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeNominalSubtypeEntryPublicationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedSemanticAuditSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedAlignedPublicationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedPromotionLabelsSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedPublicationCoexistenceSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedArchiveRootsSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedSubtypeMatrixPublicationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedSubtypePromotionTransactionSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedSubtypeHostedPromotionSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedSubtypeNpmHostedSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedRetainedIdentitySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedSubtypeNpmCompleteAcceptanceSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedCSessionBoundariesSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedPhpWasmContextsSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeWasmtimeCapiRolloutSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedWitBootstrapSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedPhpWasmMixedCoverageSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedManagedMixedCoverageSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedWindowRejectionSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDependentMatrixDocGateSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedLanguageMixedCoverageSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedNativePromotionScopeSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedNativeMixedCoverageSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedCarrierCompilationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedMatrixRefreshSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedMatrixIsolationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedReceiptProducerReplaySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpClosureProducerReplaySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedNpmCompleteAcceptanceSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreAggregateSparseCheckoutSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpWasmEntryBuildInputSupplementSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreAuthorPublicationRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCorePublicationRecursiveRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpWasmEntrySourceSupplementSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeConsumerToolLookupsSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpWasmEntryProbePublicationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpWasmEntryPublicationPinRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpWasmEntryPublisherSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpWasmEntryPublicationPreparationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpWasmEntryCompleteArchiveSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpWasmEntryDiagnosticRetentionSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpWasmEntryHostedReplaySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpWasmEntryHostedIdentitySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedRecordMatrixPublicationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpWasmEntryTagDispatchSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedRecordPromotionPreparationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeGenericSubtypeMatrixPublicationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedNpmHistoryCheckoutSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeGenericSubtypePromotionBaselineSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeGenericSubtypePromotionTransactionSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeGenericSubtypeCompactReferenceSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedNpmSourceIdentityRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreStructuredHistoryRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedCheckedRecordMatrixGateSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCorePhpStructuredEndpointRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedNpmScopedProducerSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCorePerlConsumerEndpointRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreReceiverEndpointRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpWasmCallbackProducerReplaySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeJvmCallbackProducerReplaySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePythonCallbackProducerReplaySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeDotnetCallbackProducerReplaySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreFinCppRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreInventoryFollowupRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCoreInventoryEndpointRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedNpmCiEnvironmentRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedPhpWasmHostedArchiveSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedLifetimeReplaySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeTransferBorrowProducerReplaySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackProducerReplaySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeZeroPayloadRustReplaySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpRecursiveReplaySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeMilestoneControlRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePerlCallbackContractGapSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedHistoryFollowupSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedProducerReplaySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeCoreHistoryEndpointIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeZeroPayloadDotnetArchiveGapSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforePhpWasmCallbackEndpointStopSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforePerlPromotionLivePinRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeRubyTransferCopyGapIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeRubyTransferCopyGapSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeCoreProducerLivePinRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeGenericSubtypeArchiveBoundarySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeBorrowReceiverProducerRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeAdmissionArchiveProducerRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeJvmNpmProducerRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeCoreEvidenceRepairIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeAuthorRefinementGuidanceRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeWitTransferCopyGapSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforePhpWasmCallbackTilesTraceRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedMilestoneProducerRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedJavaScriptTransferNixProducerRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforePhpWasmCallbackFinMixedEntrySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforePhpWasmCallbackSubtypeEntrySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedCReceiverProducerRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedJvmTransferProducerRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforePerlCallbackAdmissionRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeFinHistoryRollingRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeNativeForkTransferProducerRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedSubtypeDelegationRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedJavaScriptProducerRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeDocumentationWorkflowRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedDotnetProducerRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedCProducerRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeEntryFixtureRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeCoreEvidenceMemoryRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeValueIndexPromotionMilestoneRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeCoreMilestoneReplayRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeTypeSurfaceCurrentPinRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforePhpWasmCallbackEntryFormRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforePhpWasmEntryOracleIntegrationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforePhpWasmEntryOracleRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforePhpWasmEntryOracleClosureSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforePhpWasmEntryFlatPositionSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforePhpWasmEntryUnreachedSourceSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforePhpWasmEntryCallPathSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeNominalSubtypeEntryReportLinkSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeNominalSubtypeEntryExportSurfaceSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforePhpWasmNullaryEntryFormSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeManagedResultOnlyFixtureRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeGenericSubtypeManagedTapEscapeRepairSource(
			path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeStructuredCallableRecoveryGateRepairSource(
			path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedSubtypeRemainingHostsTapRepairSource(
			path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeCoreEvidenceTrackingTestRegistrationSource(
			path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeCheckedRecordValueIndexBrowserControlsContractSource(
			path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = text;
	while(true)
	{
		const previous = beforeOwnedTransferCopyReplayRepairSource(
			path, stage, expected);
		if(sha256(previous) === expected) return previous;
		if(previous === stage) break;
		stage = previous;
	}
	text = stage;
	stage
		= beforeOwnedSubtypeWasmTransferFixtureSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedCheckedRecordJavaScriptHostedRunOutcomeSource(
			path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedCheckedRecordJavaScriptHostedLaneSource(
			path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeCoreSourceBoundaryClosureSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeEvidenceCheckoutClosureRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeWitAcceptanceStopBoundarySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedJvmLazyKotlinFactorySource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedSubtypeLivePinCompletionSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforePhpWasmRecursiveEvidenceReplayRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeGenericSubtypeWitHelperWarningScopeSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedSubtypeTestProfilePinRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeWitRecursiveReaderTraversalRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeGenericSubtypeDotnetRuntimeProbeSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = text;
	while(true)
	{
		const previous = beforeGenericSubtypeEvidenceSourceClosureRepairSource(
			path, stage, expected);
		if(sha256(previous) === expected) return previous;
		if(previous === stage) break;
		stage = previous;
	}
	text = stage;
	stage = text;
	while(true)
	{
		const previous = beforeGenericSubtypeArtifactPrefixRepairSource(
			path, stage, expected);
		if(sha256(previous) === expected) return previous;
		if(previous === stage) break;
		stage = previous;
	}
	text = stage;
	stage = text;
	while(true)
	{
		const previous = beforeOwnedSubtypeWitHostNamespaceRepairSource(
			path, stage, expected);
		if(sha256(previous) === expected) return previous;
		if(previous === stage) break;
		stage = previous;
	}
	text = stage;
	stage = text;
	while(true)
	{
		const previous = beforePhpWasmEntryStructuralEqualityRepairSource(
			path, stage, expected);
		if(sha256(previous) === expected) return previous;
		if(previous === stage) break;
		stage = previous;
	}
	text = stage;
	stage = text;
	while(true)
	{
		const previous = beforeOwnedSubtypePerlSourcePathRepairSource(
			path, stage, expected);
		if(sha256(previous) === expected) return previous;
		if(previous === stage) break;
		stage = previous;
	}
	text = stage;
	stage
		= beforeGenericSubtypeDocumentationSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = text;
	while(true)
	{
		const previous = beforeGenericSubtypePromotionSource(
			path, stage, expected);
		if(sha256(previous) === expected) return previous;
		if(previous === stage) break;
		stage = previous;
	}
	text = stage;
	stage
		= beforeGenericSubtypeHostedArchiveSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeRecursiveCheckedRecordDocumentationClosureSource(
			path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedSubtypePythonDependencyRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedSubtypeDocumentationTransactionSource(
			path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeCallbackSubtypeHistoryTraversalRepairSource(
			path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedSubtypePerlIdentityRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedSubtypeWitResourceRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedSubtypeJvmFilenameRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedSubtypePromotionContractSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeOwnedSubtypeHostedArchiveSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedSubtypeEvidenceTestRegistrationSource(
			path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeOwnedSubtypeHostedEvidenceContractSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage = beforeCallbackSubtypePromotionSource(
		path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeValueIndexMatrixHistoricalInventoryRepairSource(
			path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeDependentCheckedRecordDocumentationClosureSource(
			path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeDependentCheckedRecordPromotionSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeCheckedRefinementGateRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeDependentCheckedRecordBrowserArchiveSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	stage
		= beforeValueIndexBrowserPromotionClosureRepairSource(
			path, text, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	text = stage;
	if(path === typeSurfacePath)
	{
		const exact = normalizeExactTypeSurfaceHistory(text, expected);
		if(exact !== text)
		{
			if(expected === undefined || sha256(exact) === expected) return exact;
			text = exact;
		}
	}
	stage
		= beforeStagedPhpProducerReplayRepairSource(path, text, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentBrowserHandoffRetentionRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeWitRecursiveProducerReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeJvmProducerReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedReceiverProducerReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedTransferProducerReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedPythonBorrowProducerReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedPhpProducerReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedJavaScriptTransferProducerReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedPerlTransferProducerReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePromotionDocMilestoneReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeNestedPromotionDocMilestoneRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeWorkflowMilestoneReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCoreResidualLedgerPointerReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCoreRubyModelAvailabilityRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCoreResidualProducerReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackStagingLineageReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackStagingProducerReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCoreFirstRunPinReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeStructuredCallableProducerReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeNativeBudgetReplayRepairSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeInheritedDocsReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeValueIndexRustGeneratorReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeGenericSubtypeRustOraclePathRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentRecordAuthorityReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePreFinTypeSurfaceHistoryRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeValueIndexPromotionMemoryRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeNominalEntryTagRepairSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage
		= beforeCallbackCheckedRecordPromotionRefreshSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackCheckedRecordArchiveCommitProvenanceSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackCheckedRecordArchiveProvenanceRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackCheckedRecordRetainedArchiveRolloverSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmCallbackEntryTracePlanRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordBrowserReviewedRouteRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeStructuredCallbackPublicFallbackRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackCheckedRecordWitDiagnosticRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackCheckedRecordWitDiagnosticRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeValueIndexTestProfileLiveReadRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmCallbackEntrySelectionRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackRefinementsPhpWasmPromotionSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeTestProfilesRegistrationGapSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackRefinementsPhpWasmHostedArchiveSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordWitArchiveSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordBrowserPathDiagnosticRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordWitRetainedPkgConfigRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackPhpWasmStaticQualityRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmCallbackEntrySuiteSplitSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordPhpArchiveSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordWitPkgConfigSpaceRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordPromotionArtifactIdentityHardeningSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordPhpWasmArchiveSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordWitExportCountRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordBrowserDiagnosticRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordDotnetArchiveSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordNativeArchiveSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordPromotionContractSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeHostedRefinementVerifierRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackFinPhpWasmNominalRefusalRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordPhpSpacePathRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackFinPhpWasmValidatorRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackCheckedRecordRetainedPackagesSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedCheckedRecordJavaScriptRetentionSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackSubtypeRetainedPackagesSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeRecursivePhpWasmEvidenceReplayRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedCheckedRecordHostedArchiversSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeZeroPayloadMatrixClosureSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedCheckedRecordPhpWasmRetainedHandoffSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedCheckedRecordEvidenceContractSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackSubtypeDocumentationReviewRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmRefinementEntryGeneratorClosureSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackSubtypeDocumentationReadinessSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackSubtypeTestRegistrationSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackSubtypeReviewRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackSubtypePromotionContractSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackSubtypeHostedArchiveFoundationSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmRefinementEntryDocumentationPrecisionSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmRefinementEntryDocumentationSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmRefinementEntryHostedVerifierRootSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmRefinementEntryPromotionSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmRefinementEntryHostedVerifierClosureSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmRefinementCiClosureRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmRefinementEntryHostedSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmRefinementEntryMatrixSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmRefinementCiMatrixSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackSubtypeManagedConsumerRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmIndexedRefinementEntrySource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallableClosureRefusalSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmCallbackEntrySource(path, stage, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmOwnedRefinementEntrySource(path, stage, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforePhpWasmRefinementEntryInstalledSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackSubtypePhpWasmProfileSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeWitConsumerRootRepairSource(path, stage, expected);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeNominalEntryRepairSource(path, stage, expected);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage
		= beforeCallbackRefinementsPhpWasmSource(path, stage, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackSubtypePhpWasmSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedCheckedRecordPhpWasmSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedSubtypePhpWasmQualificationSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedSubtypePhpWasmPackageGapSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedCheckedRecordManagedSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedCheckedRecordLanguageSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedCheckedRecordNativePerlSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedCheckedRecordJavaScriptSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedCheckedRecordCallableSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeOwnedCheckedRecordFoundationSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentRecordConstructorAuthoritySource(path, stage, expected);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackCheckedRecordPromotionSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackDependentIntegrationSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackCheckedRecordNativeErrorRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeCallbackCheckedRecordRemainingSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeCallbackCheckedRecordLanguageSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeCallbackCheckedRecordNativeSource(path, stage, expected);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeCallbackCheckedRecordNpmBrowserSource(path, stage, expected);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeCallbackCheckedRecordFoundationSource(path, stage, expected);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage
		= beforeDependentCheckedRecordJvmArchiveSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordHostedArchiversSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeNestedCheckedRecordRegressionContractSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordPythonArchiveSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordPerlArchiveSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordHostedFailureRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordRubyArchiveSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordTypeSurfaceGapSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordPhpWasmSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordJvmSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordDotnetSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordWitSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordPhpSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordRustArchiveSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordArchiveSelectionRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeZeroPayloadNativeControlContractSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordHostedArchivePreparationSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordRustSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordRubySource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordPythonSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordPerlSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentCheckedRecordNativeSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeDependentCheckedRecordFoundationSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeDependentGenericSubtypeCiPinReconciliationSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeDependentGenericSubtypeCiSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeDependentGenericSubtypeSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeGenericSubtypeTestRegistrationSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeGenericSubtypeManagedWitSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeGenericSubtypeLanguageSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeGenericSubtypeNativePerlSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeCallbackSubtypeHistoryPinReconciliationSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeCallbackSubtypeRemainingPhpRepairSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadPhpWasmPromotionSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadPhpWasmArchiveSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeCallbackSubtypeRemainingRuntimeRepairSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeOwnedSubtypeNativeTransferAcceptanceSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeHostedAcceptanceHandoffRepairSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadPhpWasmPlainExportRepairSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadHostedPromotionSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadPerlWitEvidenceSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadLanguageEvidenceSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadHostedArchivePreparationSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadBrowserEvidenceSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadOrdinaryEvidenceExpectationSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeHistoryReaderBufferRepairSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeHubTransitionGapSource(path, stage, expected);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeHistoryReaderHubRepairSource(path, stage, expected);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeLedgerTransitionGapSource(path, stage, expected);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadRustPromotionSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeZeroPayloadTypeSurfaceGapSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadDotnetPromotionSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadJvmPromotionSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadRubyHistorySource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadTypeSurfaceGapSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadPythonHistorySource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadJvmNullBoundarySource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadNativePromotionSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadBrowserDiagnosticSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadNativeEvidenceSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadPhpWasmHistorySource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage
		= beforeZeroPayloadPerlBooleanRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadWitHistorySource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadPhpHistorySource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadPerlArchiveSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadRustArchiveSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadRustCiSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadRustAuditRepairSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadRustInstalledSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadRustSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadJvmArchiveSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadJvmSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage
		= beforeZeroPayloadDotnetControlRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadDotnetArchiveSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadVariantSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage
		= beforeZeroPayloadDotnetVerifierRepairSource(
			path, stage, expected
		);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadDotnetCiSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadDotnetSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadNativeArchiveSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadNativeSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadBrowserArchiveSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeZeroPayloadBrowserCiSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadBrowserSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadNpmInstalledSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadJavaScriptSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadNpmFoundationSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeZeroPayloadCheckedRecordSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeProjectedCheckedRecordMirrorSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforePerlEngineOwnedRefinementClosureSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeStructuralSubtypePartitionValidatorSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeGenericSubtypeNpmBrowserSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeOwnedSubtypeCoreRegistrationSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeCoreRunnerHeadroomSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeGenericSubtypeCompositionSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeOwnedSubtypeHostRegistrationSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeOwnedSubtypeJavaScriptTransferSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected)
		return stage;
	stage = beforeOwnedSubtypeJavaScriptSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeOwnedRefinementCarriersSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeOwnedRefinementModelSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeOwnedSubtypeAnalysisSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeOwnedSubtypeJavaScriptHistoricalSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeCallbackSubtypeRemainingAcceptanceSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeCallbackSubtypeRemainingSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeCallbackSubtypeLanguageSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeCallbackSubtypeNativeSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeCallbackSubtypeBrowserArtifactSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeCallbackSubtypeNpmAcceptanceSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeCallbackSubtypeNpmBrowserSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	stage = beforeCallbackSubtypeFoundationSource(
		path, stage, expected
	);
	if(expected !== undefined && sha256(stage) === expected) return stage;
	let previous = beforeNominalSubtypeEntryMeasurementSource(
		path, stage, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexMatrixEvidencePinRepairSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexMatrixPinRepairSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexMatrixLintSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexMatrixRegistrationSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexMatrixCheckoutSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexMatrixPromotionSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexMatrixHistoryGapSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexBrowserPromotionSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexRustPromotionSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexMatrixHistoryGapSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexRustArchiveSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexRustResultOnlyRepairSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexWitPromotionSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexMatrixHistoryGapSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexWitArchiveSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexRustInventoryRepairSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexWitCallerWarningRepairSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexPhpWasmPromotionSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexMatrixHistoryGapSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexRustInventoryRepairSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexWitCallerWarningRepairSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexPhpWasmArchiveSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexPhpWasmSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexRustCountRepairSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexRubyPromotionSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexRubyArchiveSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexPhpWasmSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexPythonPromotionSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexWitVerifierRepairSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexPythonArchiveHistoryGapSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexPythonArchiveSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexPerlPromotionSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexPerlArchiveHistoryGapSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexPerlArchiveSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeValueIndexNativeTapContractSource(path, previous, expected);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexWitAcceptanceSource(path, previous, expected);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexWitSource(path, previous, expected);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexRustAcceptanceSource(path, previous, expected);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexRustSource(path, previous, expected);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexRubySource(path, previous, expected);
	if(sha256(previous) === expected) return previous;
	previous = beforeValueIndexTestProfileGapSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	// The two omitted 10-19 test-profile states sit beside the value-index gap,
	// after the 10-20 matrix registration has produced the 656a415 source.
	previous = beforeTestProfilesRegistrationGapHistoricalSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexPhpWasmSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexPhpPromotionSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeValueIndexTestProfileGapSource(path, previous, expected);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexPhpArchiveSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexPhpWasmSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeValueIndexNativeBindingIrOrderingRepairSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexPerlSource(path, previous, expected);
	if(sha256(previous) === expected) return previous;
	previous = beforeCoreThirdRunResidualRepairSource(path, previous, expected);
	if(sha256(previous) === expected) return previous;
	previous = beforeCoreSecondRunResidualRepairSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexNativeBindingIrSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexJvmNullBoundarySource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexJvmNativeRepairSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCheckedRecordValueIndexBrowserArchiveSource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = beforeCoreFirstRunResidualRepairSource(
		path, previous, expected
	);
	previous = beforeCoreTerminalReachabilityRepairSource(
		path, previous, expected
	);
	previous = beforeZeroPayloadJvmNullBoundarySource(
		path, previous, expected
	);
	if(sha256(previous) === expected) return previous;
	previous = path === typeSurfacePath
		? normalizeExactTypeSurfaceHistory(previous, expected)
		: normalizeFinRefinementSource(path, previous, expected);
	previous = beforeCoreTerminalReachabilitySource(
		path, previous, expected
	);
	if(previous === text) return text === input ? source : text;
	return expected !== undefined && sha256(previous) !== expected
		? beforeFinRefinementSource(path, previous, expected)
		: previous;
};
