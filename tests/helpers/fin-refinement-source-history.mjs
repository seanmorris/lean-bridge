/**
 * Reconstruct the extractor that preceded top-level Fin refinement support.
 * Historical package receipts stay immutable while current-source regressions
 * can prove that this isolated admission did not rewrite their implementation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { canonicalJson } from "../../src/capsule/node.mjs";
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
import { beforeCallbackSubtypeDocumentationReviewRepairSource, callbackSubtypeDocumentationReviewRepairChangedPaths } from "./callback-subtype-documentation-review-repair-source-history.mjs";
import { beforePhpWasmRefinementEntryGeneratorClosureSource, phpWasmRefinementEntryGeneratorClosureChangedPaths } from "./php-wasm-refinement-entry-generator-closure-source-history.mjs";
import { beforeCallbackSubtypeDocumentationReadinessSource, callbackSubtypeDocumentationReadinessChangedPaths } from "./callback-subtype-documentation-readiness-source-history.mjs";
import { beforeCallbackSubtypeTestRegistrationSource, callbackSubtypeTestRegistrationChangedPaths } from "./callback-subtype-test-registration-source-history.mjs";
import { beforeCallbackSubtypeReviewRepairSource, callbackSubtypeReviewRepairChangedPaths } from "./callback-subtype-review-repair-source-history.mjs";
import { beforeCallbackSubtypePromotionContractSource, callbackSubtypePromotionContractChangedPaths } from "./callback-subtype-promotion-contract-source-history.mjs";
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
	...dependentRecordAuthorityReplayRepairNormalizationPaths
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
	, ...callbackSubtypeDocumentationReviewRepairChangedPaths
	, ...phpWasmRefinementEntryGeneratorClosureChangedPaths
	, ...callbackSubtypeDocumentationReadinessChangedPaths
	, ...callbackSubtypeTestRegistrationChangedPaths
	, ...callbackSubtypeReviewRepairChangedPaths
	, ...callbackSubtypePromotionContractChangedPaths
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
	if(expected !== undefined && sha256(text) === expected) return source;
	if(path === typeSurfacePath)
	{
		const exact = normalizeExactTypeSurfaceHistory(text, expected);
		if(exact !== text)
		{
			if(expected === undefined || sha256(exact) === expected) return exact;
			text = exact;
		}
	}
	const dependentRecordAuthorityReplayRepair
		= beforeDependentRecordAuthorityReplayRepairSource(path, text, expected);
	if(sha256(dependentRecordAuthorityReplayRepair) === expected)
		return dependentRecordAuthorityReplayRepair;
	const preFinTypeSurfaceHistoryRepair
		= beforePreFinTypeSurfaceHistoryRepairSource(
			path, dependentRecordAuthorityReplayRepair, expected
		);
	if(sha256(preFinTypeSurfaceHistoryRepair) === expected)
		return preFinTypeSurfaceHistoryRepair;
	const valueIndexPromotionMemoryRepair
		= beforeValueIndexPromotionMemoryRepairSource(
			path, preFinTypeSurfaceHistoryRepair, expected
		);
	if(sha256(valueIndexPromotionMemoryRepair) === expected)
		return valueIndexPromotionMemoryRepair;
	const nominalEntryTagRepair = beforeNominalEntryTagRepairSource(
		path, valueIndexPromotionMemoryRepair, expected
	);
	if(sha256(nominalEntryTagRepair) === expected) return nominalEntryTagRepair;
	const callbackCheckedRecordPromotionRefresh
		= beforeCallbackCheckedRecordPromotionRefreshSource(
			path, nominalEntryTagRepair, expected
		);
	if(sha256(callbackCheckedRecordPromotionRefresh) === expected)
		return callbackCheckedRecordPromotionRefresh;
	const callbackCheckedRecordArchiveCommitProvenance
		= beforeCallbackCheckedRecordArchiveCommitProvenanceSource(
			path, callbackCheckedRecordPromotionRefresh, expected
		);
	if(sha256(callbackCheckedRecordArchiveCommitProvenance) === expected)
		return callbackCheckedRecordArchiveCommitProvenance;
	const callbackCheckedRecordArchiveProvenanceRepair
		= beforeCallbackCheckedRecordArchiveProvenanceRepairSource(
			path, callbackCheckedRecordArchiveCommitProvenance, expected
		);
	if(sha256(callbackCheckedRecordArchiveProvenanceRepair) === expected)
		return callbackCheckedRecordArchiveProvenanceRepair;
	const callbackCheckedRecordRetainedArchiveRollover
		= beforeCallbackCheckedRecordRetainedArchiveRolloverSource(
			path, callbackCheckedRecordArchiveProvenanceRepair, expected
		);
	if(sha256(callbackCheckedRecordRetainedArchiveRollover) === expected)
		return callbackCheckedRecordRetainedArchiveRollover;
	const callbackEntryTracePlanRepair
		= beforePhpWasmCallbackEntryTracePlanRepairSource(
			path, callbackCheckedRecordRetainedArchiveRollover, expected
		);
	if(sha256(callbackEntryTracePlanRepair) === expected)
		return callbackEntryTracePlanRepair;
	const dependentBrowserReviewedRouteRepair
		= beforeDependentCheckedRecordBrowserReviewedRouteRepairSource(
			path, callbackEntryTracePlanRepair, expected
		);
	if(sha256(dependentBrowserReviewedRouteRepair) === expected)
		return dependentBrowserReviewedRouteRepair;
	const structuredCallbackFallbackRepair
		= beforeStructuredCallbackPublicFallbackRepairSource(
			path, dependentBrowserReviewedRouteRepair, expected
		);
	if(sha256(structuredCallbackFallbackRepair) === expected)
		return structuredCallbackFallbackRepair;
	const callbackWitDiagnosticRepairIntegration
		= beforeCallbackCheckedRecordWitDiagnosticRepairSource(
			path, structuredCallbackFallbackRepair, expected
		);
	if(sha256(callbackWitDiagnosticRepairIntegration) === expected)
		return callbackWitDiagnosticRepairIntegration;
	const callbackWitDiagnosticRepairImplementation
		= beforeCallbackCheckedRecordWitDiagnosticRepairSource(
			path, callbackWitDiagnosticRepairIntegration, expected
		);
	if(sha256(callbackWitDiagnosticRepairImplementation) === expected)
		return callbackWitDiagnosticRepairImplementation;
	const valueIndexProfileReadRepair
		= beforeValueIndexTestProfileLiveReadRepairSource(
			path, callbackWitDiagnosticRepairImplementation, expected
		);
	if(sha256(valueIndexProfileReadRepair) === expected)
		return valueIndexProfileReadRepair;
	const callbackEntrySelectionRepair
		= beforePhpWasmCallbackEntrySelectionRepairSource(
			path, valueIndexProfileReadRepair, expected
		);
	if(sha256(callbackEntrySelectionRepair) === expected)
		return callbackEntrySelectionRepair;
	const callbackRefinementsPhpWasmPromotion
		= beforeCallbackRefinementsPhpWasmPromotionSource(
			path, callbackEntrySelectionRepair, expected
		);
	if(sha256(callbackRefinementsPhpWasmPromotion) === expected)
		return callbackRefinementsPhpWasmPromotion;
	const testProfilesRegistrationGap
		= beforeTestProfilesRegistrationGapSource(
			path, callbackRefinementsPhpWasmPromotion, expected
		);
	if(sha256(testProfilesRegistrationGap) === expected)
		return testProfilesRegistrationGap;
	const callbackRefinementsPhpWasmHostedArchive
		= beforeCallbackRefinementsPhpWasmHostedArchiveSource(
			path, testProfilesRegistrationGap, expected
		);
	if(sha256(callbackRefinementsPhpWasmHostedArchive) === expected)
		return callbackRefinementsPhpWasmHostedArchive;
	const dependentCheckedRecordWitArchive
		= beforeDependentCheckedRecordWitArchiveSource(
			path, callbackRefinementsPhpWasmHostedArchive, expected
		);
	if(sha256(dependentCheckedRecordWitArchive) === expected)
		return dependentCheckedRecordWitArchive;
	const dependentCheckedRecordBrowserPathDiagnosticRepair
		= beforeDependentCheckedRecordBrowserPathDiagnosticRepairSource(
			path, dependentCheckedRecordWitArchive, expected
		);
	if(sha256(dependentCheckedRecordBrowserPathDiagnosticRepair) === expected)
		return dependentCheckedRecordBrowserPathDiagnosticRepair;
	const dependentCheckedRecordWitRetainedPkgConfigRepair
		= beforeDependentCheckedRecordWitRetainedPkgConfigRepairSource(
			path, dependentCheckedRecordBrowserPathDiagnosticRepair, expected
		);
	if(sha256(dependentCheckedRecordWitRetainedPkgConfigRepair) === expected)
		return dependentCheckedRecordWitRetainedPkgConfigRepair;
	const callbackPhpWasmStaticQualityRepair
		= beforeCallbackPhpWasmStaticQualityRepairSource(
			path, dependentCheckedRecordWitRetainedPkgConfigRepair, expected
		);
	if(sha256(callbackPhpWasmStaticQualityRepair) === expected)
		return callbackPhpWasmStaticQualityRepair;
	const phpWasmCallbackEntrySuiteSplit
		= beforePhpWasmCallbackEntrySuiteSplitSource(
			path, callbackPhpWasmStaticQualityRepair, expected
		);
	if(sha256(phpWasmCallbackEntrySuiteSplit) === expected)
		return phpWasmCallbackEntrySuiteSplit;
	const dependentCheckedRecordPhpArchive
		= beforeDependentCheckedRecordPhpArchiveSource(
			path, phpWasmCallbackEntrySuiteSplit, expected
		);
	if(sha256(dependentCheckedRecordPhpArchive) === expected)
		return dependentCheckedRecordPhpArchive;
	const dependentCheckedRecordWitPkgConfigSpaceRepair
		= beforeDependentCheckedRecordWitPkgConfigSpaceRepairSource(
			path, dependentCheckedRecordPhpArchive, expected
		);
	if(sha256(dependentCheckedRecordWitPkgConfigSpaceRepair) === expected)
		return dependentCheckedRecordWitPkgConfigSpaceRepair;
	const dependentCheckedRecordPromotionArtifactIdentityHardening
		= beforeDependentCheckedRecordPromotionArtifactIdentityHardeningSource(
			path, dependentCheckedRecordWitPkgConfigSpaceRepair, expected
		);
	if(sha256(dependentCheckedRecordPromotionArtifactIdentityHardening) === expected)
		return dependentCheckedRecordPromotionArtifactIdentityHardening;
	const dependentCheckedRecordPhpWasmArchive
		= beforeDependentCheckedRecordPhpWasmArchiveSource(
			path, dependentCheckedRecordPromotionArtifactIdentityHardening, expected
		);
	if(sha256(dependentCheckedRecordPhpWasmArchive) === expected)
		return dependentCheckedRecordPhpWasmArchive;
	const dependentCheckedRecordWitExportCountRepair
		= beforeDependentCheckedRecordWitExportCountRepairSource(
			path, dependentCheckedRecordPhpWasmArchive, expected
		);
	if(sha256(dependentCheckedRecordWitExportCountRepair) === expected)
		return dependentCheckedRecordWitExportCountRepair;
	const dependentCheckedRecordBrowserDiagnosticRepair
		= beforeDependentCheckedRecordBrowserDiagnosticRepairSource(
			path, dependentCheckedRecordWitExportCountRepair, expected
		);
	if(sha256(dependentCheckedRecordBrowserDiagnosticRepair) === expected)
		return dependentCheckedRecordBrowserDiagnosticRepair;
	const dependentCheckedRecordDotnetArchive
		= beforeDependentCheckedRecordDotnetArchiveSource(
			path, dependentCheckedRecordBrowserDiagnosticRepair, expected
		);
	if(sha256(dependentCheckedRecordDotnetArchive) === expected)
		return dependentCheckedRecordDotnetArchive;
	const dependentCheckedRecordNativeArchive
		= beforeDependentCheckedRecordNativeArchiveSource(
			path, dependentCheckedRecordDotnetArchive, expected
		);
	if(sha256(dependentCheckedRecordNativeArchive) === expected)
		return dependentCheckedRecordNativeArchive;
	const dependentCheckedRecordPromotionContract
		= beforeDependentCheckedRecordPromotionContractSource(
			path, dependentCheckedRecordNativeArchive, expected
		);
	if(sha256(dependentCheckedRecordPromotionContract) === expected)
		return dependentCheckedRecordPromotionContract;
	const hostedRefinementVerifierRepair
		= beforeHostedRefinementVerifierRepairSource(
			path, dependentCheckedRecordPromotionContract, expected
		);
	if(sha256(hostedRefinementVerifierRepair) === expected)
		return hostedRefinementVerifierRepair;
	const callbackFinPhpWasmNominalRefusalRepair
		= beforeCallbackFinPhpWasmNominalRefusalRepairSource(
			path, hostedRefinementVerifierRepair, expected
		);
	if(sha256(callbackFinPhpWasmNominalRefusalRepair) === expected)
		return callbackFinPhpWasmNominalRefusalRepair;
	const dependentCheckedRecordPhpSpacePathRepair
		= beforeDependentCheckedRecordPhpSpacePathRepairSource(
			path, callbackFinPhpWasmNominalRefusalRepair, expected
		);
	if(sha256(dependentCheckedRecordPhpSpacePathRepair) === expected)
		return dependentCheckedRecordPhpSpacePathRepair;
	const callbackFinPhpWasmValidatorRepair
		= beforeCallbackFinPhpWasmValidatorRepairSource(
			path, dependentCheckedRecordPhpSpacePathRepair, expected
		);
	if(sha256(callbackFinPhpWasmValidatorRepair) === expected)
		return callbackFinPhpWasmValidatorRepair;
	const callbackCheckedRecordRetainedPackages
		= beforeCallbackCheckedRecordRetainedPackagesSource(
			path, callbackFinPhpWasmValidatorRepair, expected
		);
	if(sha256(callbackCheckedRecordRetainedPackages) === expected)
		return callbackCheckedRecordRetainedPackages;
	const ownedCheckedRecordJavaScriptRetention
		= beforeOwnedCheckedRecordJavaScriptRetentionSource(
			path, callbackCheckedRecordRetainedPackages, expected
		);
	if(sha256(ownedCheckedRecordJavaScriptRetention) === expected)
		return ownedCheckedRecordJavaScriptRetention;
	const callbackSubtypeRetainedPackages
		= beforeCallbackSubtypeRetainedPackagesSource(
			path, ownedCheckedRecordJavaScriptRetention, expected
		);
	if(sha256(callbackSubtypeRetainedPackages) === expected)
		return callbackSubtypeRetainedPackages;
	const recursivePhpWasmEvidenceReplayRepair
		= beforeRecursivePhpWasmEvidenceReplayRepairSource(
			path, callbackSubtypeRetainedPackages, expected
		);
	if(sha256(recursivePhpWasmEvidenceReplayRepair) === expected)
		return recursivePhpWasmEvidenceReplayRepair;
	const ownedCheckedRecordHostedArchivers
		= beforeOwnedCheckedRecordHostedArchiversSource(
			path, recursivePhpWasmEvidenceReplayRepair, expected
		);
	if(sha256(ownedCheckedRecordHostedArchivers) === expected)
		return ownedCheckedRecordHostedArchivers;
	const zeroPayloadMatrixClosure
		= beforeZeroPayloadMatrixClosureSource(
			path, ownedCheckedRecordHostedArchivers, expected
		);
	if(sha256(zeroPayloadMatrixClosure) === expected)
		return zeroPayloadMatrixClosure;
	const ownedCheckedRecordPhpWasmRetainedHandoff
		= beforeOwnedCheckedRecordPhpWasmRetainedHandoffSource(
			path, zeroPayloadMatrixClosure, expected
		);
	if(sha256(ownedCheckedRecordPhpWasmRetainedHandoff) === expected)
		return ownedCheckedRecordPhpWasmRetainedHandoff;
	const ownedCheckedRecordEvidenceContract
		= beforeOwnedCheckedRecordEvidenceContractSource(
			path, ownedCheckedRecordPhpWasmRetainedHandoff, expected
		);
	if(sha256(ownedCheckedRecordEvidenceContract) === expected)
		return ownedCheckedRecordEvidenceContract;
	const callbackSubtypeDocumentationReviewRepair
		= beforeCallbackSubtypeDocumentationReviewRepairSource(
			path, ownedCheckedRecordEvidenceContract, expected
		);
	if(sha256(callbackSubtypeDocumentationReviewRepair) === expected)
		return callbackSubtypeDocumentationReviewRepair;
	const phpWasmRefinementEntryGeneratorClosure
		= beforePhpWasmRefinementEntryGeneratorClosureSource(
			path, callbackSubtypeDocumentationReviewRepair, expected
		);
	if(sha256(phpWasmRefinementEntryGeneratorClosure) === expected)
		return phpWasmRefinementEntryGeneratorClosure;
	const callbackSubtypeDocumentationReadiness
		= beforeCallbackSubtypeDocumentationReadinessSource(
			path, phpWasmRefinementEntryGeneratorClosure, expected
		);
	if(sha256(callbackSubtypeDocumentationReadiness) === expected)
		return callbackSubtypeDocumentationReadiness;
	const callbackSubtypeTestRegistration
		= beforeCallbackSubtypeTestRegistrationSource(
			path, callbackSubtypeDocumentationReadiness, expected
		);
	if(sha256(callbackSubtypeTestRegistration) === expected)
		return callbackSubtypeTestRegistration;
	const callbackSubtypeReviewRepair
		= beforeCallbackSubtypeReviewRepairSource(
			path, callbackSubtypeTestRegistration, expected
		);
	if(sha256(callbackSubtypeReviewRepair) === expected)
		return callbackSubtypeReviewRepair;
	const callbackSubtypePromotionContract
		= beforeCallbackSubtypePromotionContractSource(
			path, callbackSubtypeReviewRepair, expected
		);
	if(sha256(callbackSubtypePromotionContract) === expected)
		return callbackSubtypePromotionContract;
	const callbackSubtypeHostedArchiveFoundation
		= beforeCallbackSubtypeHostedArchiveFoundationSource(
			path, callbackSubtypePromotionContract, expected
		);
	if(sha256(callbackSubtypeHostedArchiveFoundation) === expected)
		return callbackSubtypeHostedArchiveFoundation;
	const phpWasmRefinementEntryDocumentationPrecision
		= beforePhpWasmRefinementEntryDocumentationPrecisionSource(
			path, callbackSubtypeHostedArchiveFoundation, expected
		);
	if(sha256(phpWasmRefinementEntryDocumentationPrecision) === expected)
		return phpWasmRefinementEntryDocumentationPrecision;
	const phpWasmRefinementEntryDocumentation
		= beforePhpWasmRefinementEntryDocumentationSource(
			path, phpWasmRefinementEntryDocumentationPrecision, expected
		);
	if(sha256(phpWasmRefinementEntryDocumentation) === expected)
		return phpWasmRefinementEntryDocumentation;
	const phpWasmRefinementEntryHostedVerifierRoot
		= beforePhpWasmRefinementEntryHostedVerifierRootSource(
			path, phpWasmRefinementEntryDocumentation, expected
		);
	if(sha256(phpWasmRefinementEntryHostedVerifierRoot) === expected)
		return phpWasmRefinementEntryHostedVerifierRoot;
	const phpWasmRefinementEntryPromotion
		= beforePhpWasmRefinementEntryPromotionSource(
			path, phpWasmRefinementEntryHostedVerifierRoot, expected
		);
	if(sha256(phpWasmRefinementEntryPromotion) === expected)
		return phpWasmRefinementEntryPromotion;
	const phpWasmRefinementEntryHostedVerifierClosure
		= beforePhpWasmRefinementEntryHostedVerifierClosureSource(
			path, phpWasmRefinementEntryPromotion, expected
		);
	if(sha256(phpWasmRefinementEntryHostedVerifierClosure) === expected)
		return phpWasmRefinementEntryHostedVerifierClosure;
	const phpWasmRefinementCiClosureRepair
		= beforePhpWasmRefinementCiClosureRepairSource(
			path, phpWasmRefinementEntryHostedVerifierClosure, expected
		);
	if(sha256(phpWasmRefinementCiClosureRepair) === expected)
		return phpWasmRefinementCiClosureRepair;
	const phpWasmRefinementEntryHosted
		= beforePhpWasmRefinementEntryHostedSource(
			path, phpWasmRefinementCiClosureRepair, expected
		);
	if(sha256(phpWasmRefinementEntryHosted) === expected)
		return phpWasmRefinementEntryHosted;
	const phpWasmRefinementEntryMatrix
		= beforePhpWasmRefinementEntryMatrixSource(
			path, phpWasmRefinementEntryHosted, expected
		);
	if(sha256(phpWasmRefinementEntryMatrix) === expected)
		return phpWasmRefinementEntryMatrix;
	const phpWasmRefinementCiMatrix
		= beforePhpWasmRefinementCiMatrixSource(
			path, phpWasmRefinementEntryMatrix, expected
		);
	if(sha256(phpWasmRefinementCiMatrix) === expected)
		return phpWasmRefinementCiMatrix;
	const callbackSubtypeManagedConsumerRepair
		= beforeCallbackSubtypeManagedConsumerRepairSource(
			path, phpWasmRefinementCiMatrix, expected
		);
	if(sha256(callbackSubtypeManagedConsumerRepair) === expected)
		return callbackSubtypeManagedConsumerRepair;
	const phpWasmIndexedRefinementEntry
		= beforePhpWasmIndexedRefinementEntrySource(
			path, callbackSubtypeManagedConsumerRepair, expected
		);
	if(sha256(phpWasmIndexedRefinementEntry) === expected)
		return phpWasmIndexedRefinementEntry;
	const callableClosureRefusal
		= beforeCallableClosureRefusalSource(
			path, phpWasmIndexedRefinementEntry, expected
		);
	if(sha256(callableClosureRefusal) === expected)
		return callableClosureRefusal;
	const phpWasmCallbackEntry
		= beforePhpWasmCallbackEntrySource(path, callableClosureRefusal, expected);
	if(sha256(phpWasmCallbackEntry) === expected)
		return phpWasmCallbackEntry;
	const phpWasmOwnedRefinementEntry
		= beforePhpWasmOwnedRefinementEntrySource(path, phpWasmCallbackEntry, expected);
	if(sha256(phpWasmOwnedRefinementEntry) === expected)
		return phpWasmOwnedRefinementEntry;
	const phpWasmRefinementEntryInstalled
		= beforePhpWasmRefinementEntryInstalledSource(
			path, phpWasmOwnedRefinementEntry, expected
		);
	if(sha256(phpWasmRefinementEntryInstalled) === expected)
		return phpWasmRefinementEntryInstalled;
	const callbackSubtypePhpWasmProfile
		= beforeCallbackSubtypePhpWasmProfileSource(
			path, phpWasmRefinementEntryInstalled, expected
		);
	if(sha256(callbackSubtypePhpWasmProfile) === expected)
		return callbackSubtypePhpWasmProfile;
	const witConsumerRootRepair
		= beforeWitConsumerRootRepairSource(path, callbackSubtypePhpWasmProfile, expected);
	if(sha256(witConsumerRootRepair) === expected) return witConsumerRootRepair;
	const nominalEntryRepair = beforeNominalEntryRepairSource(path, witConsumerRootRepair, expected);
	if(sha256(nominalEntryRepair) === expected) return nominalEntryRepair;
	const callbackRefinementsPhpWasm
		= beforeCallbackRefinementsPhpWasmSource(path, nominalEntryRepair, expected);
	if(sha256(callbackRefinementsPhpWasm) === expected)
		return callbackRefinementsPhpWasm;
	const callbackSubtypePhpWasm
		= beforeCallbackSubtypePhpWasmSource(
			path, callbackRefinementsPhpWasm, expected
		);
	if(sha256(callbackSubtypePhpWasm) === expected)
		return callbackSubtypePhpWasm;
	const ownedCheckedRecordPhpWasm
		= beforeOwnedCheckedRecordPhpWasmSource(
			path, callbackSubtypePhpWasm, expected
		);
	if(sha256(ownedCheckedRecordPhpWasm) === expected)
		return ownedCheckedRecordPhpWasm;
	const ownedSubtypePhpWasmQualification
		= beforeOwnedSubtypePhpWasmQualificationSource(
			path, ownedCheckedRecordPhpWasm, expected
		);
	if(sha256(ownedSubtypePhpWasmQualification) === expected)
		return ownedSubtypePhpWasmQualification;
	const ownedSubtypePhpWasmPackageGap
		= beforeOwnedSubtypePhpWasmPackageGapSource(
			path, ownedSubtypePhpWasmQualification, expected
		);
	if(sha256(ownedSubtypePhpWasmPackageGap) === expected)
		return ownedSubtypePhpWasmPackageGap;
	const ownedCheckedRecordManaged
		= beforeOwnedCheckedRecordManagedSource(
			path, ownedSubtypePhpWasmPackageGap, expected
		);
	if(sha256(ownedCheckedRecordManaged) === expected)
		return ownedCheckedRecordManaged;
	const ownedCheckedRecordLanguage
		= beforeOwnedCheckedRecordLanguageSource(
			path, ownedCheckedRecordManaged, expected
		);
	if(sha256(ownedCheckedRecordLanguage) === expected)
		return ownedCheckedRecordLanguage;
	const ownedCheckedRecordNativePerl
		= beforeOwnedCheckedRecordNativePerlSource(
			path, ownedCheckedRecordLanguage, expected
		);
	if(sha256(ownedCheckedRecordNativePerl) === expected)
		return ownedCheckedRecordNativePerl;
	const ownedCheckedRecordJavaScript
		= beforeOwnedCheckedRecordJavaScriptSource(
			path, ownedCheckedRecordNativePerl, expected
		);
	if(sha256(ownedCheckedRecordJavaScript) === expected)
		return ownedCheckedRecordJavaScript;
	const ownedCheckedRecordCallable
		= beforeOwnedCheckedRecordCallableSource(
			path, ownedCheckedRecordJavaScript, expected
		);
	if(sha256(ownedCheckedRecordCallable) === expected)
		return ownedCheckedRecordCallable;
	const ownedCheckedRecordFoundation
		= beforeOwnedCheckedRecordFoundationSource(
			path, ownedCheckedRecordCallable, expected
		);
	if(sha256(ownedCheckedRecordFoundation) === expected)
		return ownedCheckedRecordFoundation;
	const dependentRecordConstructorAuthority
		= beforeDependentRecordConstructorAuthoritySource(path, ownedCheckedRecordFoundation, expected);
	if(sha256(dependentRecordConstructorAuthority) === expected)
		return dependentRecordConstructorAuthority;
	const callbackCheckedRecordPromotion
		= beforeCallbackCheckedRecordPromotionSource(
			path, dependentRecordConstructorAuthority, expected
		);
	if(sha256(callbackCheckedRecordPromotion) === expected)
		return callbackCheckedRecordPromotion;
	const callbackDependentIntegration
		= beforeCallbackDependentIntegrationSource(
			path, callbackCheckedRecordPromotion, expected
		);
	if(sha256(callbackDependentIntegration) === expected)
		return callbackDependentIntegration;
	const callbackCheckedRecordNativeErrorRepair
		= beforeCallbackCheckedRecordNativeErrorRepairSource(
			path, callbackDependentIntegration, expected
		);
	if(sha256(callbackCheckedRecordNativeErrorRepair) === expected)
		return callbackCheckedRecordNativeErrorRepair;
	const callbackCheckedRecordRemaining
		= beforeCallbackCheckedRecordRemainingSource(
			path, callbackCheckedRecordNativeErrorRepair, expected
		);
	if(sha256(callbackCheckedRecordRemaining) === expected)
		return callbackCheckedRecordRemaining;
	const callbackCheckedRecordLanguage = beforeCallbackCheckedRecordLanguageSource(
		path, callbackCheckedRecordRemaining, expected
	);
	if(sha256(callbackCheckedRecordLanguage) === expected) return callbackCheckedRecordLanguage;
	const callbackCheckedRecordNative = beforeCallbackCheckedRecordNativeSource(path, callbackCheckedRecordLanguage, expected);
	if(sha256(callbackCheckedRecordNative) === expected) return callbackCheckedRecordNative;
	const callbackCheckedRecordNpmBrowser = beforeCallbackCheckedRecordNpmBrowserSource(path, callbackCheckedRecordNative, expected);
	if(sha256(callbackCheckedRecordNpmBrowser) === expected) return callbackCheckedRecordNpmBrowser;
	const callbackCheckedRecordFoundation = beforeCallbackCheckedRecordFoundationSource(path, callbackCheckedRecordNpmBrowser, expected);
	if(sha256(callbackCheckedRecordFoundation) === expected) return callbackCheckedRecordFoundation;
	const dependentCheckedRecordJvmArchive
		= beforeDependentCheckedRecordJvmArchiveSource(
			path, callbackCheckedRecordFoundation, expected
		);
	if(sha256(dependentCheckedRecordJvmArchive) === expected)
		return dependentCheckedRecordJvmArchive;
	const dependentCheckedRecordHostedArchivers
		= beforeDependentCheckedRecordHostedArchiversSource(
			path, dependentCheckedRecordJvmArchive, expected
		);
	if(sha256(dependentCheckedRecordHostedArchivers) === expected)
		return dependentCheckedRecordHostedArchivers;
	const nestedCheckedRecordRegressionContract
		= beforeNestedCheckedRecordRegressionContractSource(
			path, dependentCheckedRecordHostedArchivers, expected
		);
	if(sha256(nestedCheckedRecordRegressionContract) === expected)
		return nestedCheckedRecordRegressionContract;
	const dependentCheckedRecordPythonArchive
		= beforeDependentCheckedRecordPythonArchiveSource(
			path, nestedCheckedRecordRegressionContract, expected
		);
	if(sha256(dependentCheckedRecordPythonArchive) === expected)
		return dependentCheckedRecordPythonArchive;
	const dependentCheckedRecordPerlArchive
		= beforeDependentCheckedRecordPerlArchiveSource(
			path, dependentCheckedRecordPythonArchive, expected
		);
	if(sha256(dependentCheckedRecordPerlArchive) === expected)
		return dependentCheckedRecordPerlArchive;
	const dependentCheckedRecordHostedFailureRepair
		= beforeDependentCheckedRecordHostedFailureRepairSource(
			path, dependentCheckedRecordPerlArchive, expected
		);
	if(sha256(dependentCheckedRecordHostedFailureRepair) === expected)
		return dependentCheckedRecordHostedFailureRepair;
	const dependentCheckedRecordRubyArchive
		= beforeDependentCheckedRecordRubyArchiveSource(
			path, dependentCheckedRecordHostedFailureRepair, expected
		);
	if(sha256(dependentCheckedRecordRubyArchive) === expected)
		return dependentCheckedRecordRubyArchive;
	const dependentCheckedRecordTypeSurfaceGap
		= beforeDependentCheckedRecordTypeSurfaceGapSource(
			path, dependentCheckedRecordRubyArchive, expected
		);
	if(sha256(dependentCheckedRecordTypeSurfaceGap) === expected)
		return dependentCheckedRecordTypeSurfaceGap;
	const dependentCheckedRecordPhpWasm
		= beforeDependentCheckedRecordPhpWasmSource(
			path, dependentCheckedRecordTypeSurfaceGap, expected
		);
	if(sha256(dependentCheckedRecordPhpWasm) === expected)
		return dependentCheckedRecordPhpWasm;
	const dependentCheckedRecordJvm
		= beforeDependentCheckedRecordJvmSource(
			path, dependentCheckedRecordPhpWasm, expected
		);
	if(sha256(dependentCheckedRecordJvm) === expected)
		return dependentCheckedRecordJvm;
	const dependentCheckedRecordDotnet
		= beforeDependentCheckedRecordDotnetSource(
			path, dependentCheckedRecordJvm, expected
		);
	if(sha256(dependentCheckedRecordDotnet) === expected)
		return dependentCheckedRecordDotnet;
	const dependentCheckedRecordWit
		= beforeDependentCheckedRecordWitSource(
			path, dependentCheckedRecordDotnet, expected
		);
	if(sha256(dependentCheckedRecordWit) === expected)
		return dependentCheckedRecordWit;
	const dependentCheckedRecordPhp
		= beforeDependentCheckedRecordPhpSource(
			path, dependentCheckedRecordWit, expected
		);
	if(sha256(dependentCheckedRecordPhp) === expected)
		return dependentCheckedRecordPhp;
	const dependentCheckedRecordRustArchive
		= beforeDependentCheckedRecordRustArchiveSource(
			path, dependentCheckedRecordPhp, expected
		);
	if(sha256(dependentCheckedRecordRustArchive) === expected)
		return dependentCheckedRecordRustArchive;
	const dependentCheckedRecordArchiveSelectionRepair
		= beforeDependentCheckedRecordArchiveSelectionRepairSource(
			path, dependentCheckedRecordRustArchive, expected
		);
	if(sha256(dependentCheckedRecordArchiveSelectionRepair) === expected)
		return dependentCheckedRecordArchiveSelectionRepair;
	const zeroPayloadNativeControlContract
		= beforeZeroPayloadNativeControlContractSource(
			path, dependentCheckedRecordArchiveSelectionRepair, expected
		);
	if(sha256(zeroPayloadNativeControlContract) === expected)
		return zeroPayloadNativeControlContract;
	const dependentCheckedRecordHostedArchivePreparation
		= beforeDependentCheckedRecordHostedArchivePreparationSource(
			path, zeroPayloadNativeControlContract, expected
		);
	if(sha256(dependentCheckedRecordHostedArchivePreparation) === expected)
		return dependentCheckedRecordHostedArchivePreparation;
	const dependentCheckedRecordRust
		= beforeDependentCheckedRecordRustSource(
			path, dependentCheckedRecordHostedArchivePreparation, expected
		);
	if(sha256(dependentCheckedRecordRust) === expected)
		return dependentCheckedRecordRust;
	const dependentCheckedRecordRuby
		= beforeDependentCheckedRecordRubySource(
			path, dependentCheckedRecordRust, expected
		);
	if(sha256(dependentCheckedRecordRuby) === expected)
		return dependentCheckedRecordRuby;
	const dependentCheckedRecordPython
		= beforeDependentCheckedRecordPythonSource(
			path, dependentCheckedRecordRuby, expected
		);
	if(sha256(dependentCheckedRecordPython) === expected)
		return dependentCheckedRecordPython;
	const dependentCheckedRecordPerl
		= beforeDependentCheckedRecordPerlSource(
			path, dependentCheckedRecordPython, expected
		);
	if(sha256(dependentCheckedRecordPerl) === expected)
		return dependentCheckedRecordPerl;
	const dependentCheckedRecordNative
		= beforeDependentCheckedRecordNativeSource(
			path, dependentCheckedRecordPerl, expected
		);
	if(sha256(dependentCheckedRecordNative) === expected)
		return dependentCheckedRecordNative;
	const dependentCheckedRecord = beforeDependentCheckedRecordFoundationSource(
		path, dependentCheckedRecordNative, expected
	);
	if(sha256(dependentCheckedRecord) === expected)
		return dependentCheckedRecord;
	const dependentGenericSubtypeCiPinReconciliation
		= beforeDependentGenericSubtypeCiPinReconciliationSource(
			path, dependentCheckedRecord, expected
		);
	if(sha256(dependentGenericSubtypeCiPinReconciliation) === expected)
		return dependentGenericSubtypeCiPinReconciliation;
	const dependentGenericSubtypeCi = beforeDependentGenericSubtypeCiSource(
		path, dependentGenericSubtypeCiPinReconciliation, expected
	);
	if(sha256(dependentGenericSubtypeCi) === expected)
		return dependentGenericSubtypeCi;
	const dependentGenericSubtype = beforeDependentGenericSubtypeSource(
		path, dependentGenericSubtypeCi, expected
	);
	if(sha256(dependentGenericSubtype) === expected)
		return dependentGenericSubtype;
	const genericTestRegistration = beforeGenericSubtypeTestRegistrationSource(
		path, dependentGenericSubtype, expected
	);
	if(sha256(genericTestRegistration) === expected) return genericTestRegistration;
	const genericManagedWit = beforeGenericSubtypeManagedWitSource(
		path, genericTestRegistration, expected
	);
	if(sha256(genericManagedWit) === expected) return genericManagedWit;
	const genericLanguages = beforeGenericSubtypeLanguageSource(
		path, genericManagedWit, expected
	);
	if(sha256(genericLanguages) === expected) return genericLanguages;
	const genericNativePerl = beforeGenericSubtypeNativePerlSource(
		path, genericLanguages, expected
	);
	if(sha256(genericNativePerl) === expected) return genericNativePerl;
	const pinReconciliation = beforeCallbackSubtypeHistoryPinReconciliationSource(
		path, genericNativePerl, expected
	);
	if(sha256(pinReconciliation) === expected) return pinReconciliation;
	const phpCallbackRepair = beforeCallbackSubtypeRemainingPhpRepairSource(
		path, pinReconciliation, expected
	);
	if(sha256(phpCallbackRepair) === expected) return phpCallbackRepair;
	const phpWasmPromotion = beforeZeroPayloadPhpWasmPromotionSource(
		path, phpCallbackRepair, expected
	);
	if(sha256(phpWasmPromotion) === expected) return phpWasmPromotion;
	const phpWasmArchive = beforeZeroPayloadPhpWasmArchiveSource(
		path, phpWasmPromotion, expected
	);
	if(sha256(phpWasmArchive) === expected) return phpWasmArchive;
	const callbackRuntimeRepair = beforeCallbackSubtypeRemainingRuntimeRepairSource(
		path, phpWasmArchive, expected
	);
	if(sha256(callbackRuntimeRepair) === expected) return callbackRuntimeRepair;
	const nativeTransferAcceptance = beforeOwnedSubtypeNativeTransferAcceptanceSource(
		path, callbackRuntimeRepair, expected
	);
	if(sha256(nativeTransferAcceptance) === expected) return nativeTransferAcceptance;
	const handoffRepair = beforeHostedAcceptanceHandoffRepairSource(
		path, nativeTransferAcceptance, expected
	);
	if(sha256(handoffRepair) === expected) return handoffRepair;
	const plainExportRepair = beforeZeroPayloadPhpWasmPlainExportRepairSource(
		path, handoffRepair, expected
	);
	if(sha256(plainExportRepair) === expected) return plainExportRepair;
	const hostedPromotion = beforeZeroPayloadHostedPromotionSource(
		path, plainExportRepair, expected
	);
	if(sha256(hostedPromotion) === expected) return hostedPromotion;
	const perlWitEvidence = beforeZeroPayloadPerlWitEvidenceSource(
		path, hostedPromotion, expected
	);
	if(sha256(perlWitEvidence) === expected) return perlWitEvidence;
	const languageEvidence = beforeZeroPayloadLanguageEvidenceSource(
		path, perlWitEvidence, expected
	);
	if(sha256(languageEvidence) === expected) return languageEvidence;
	const archivePreparation = beforeZeroPayloadHostedArchivePreparationSource(
		path, languageEvidence, expected
	);
	if(sha256(archivePreparation) === expected) return archivePreparation;
	const browserEvidence = beforeZeroPayloadBrowserEvidenceSource(
		path, archivePreparation, expected
	);
	if(sha256(browserEvidence) === expected) return browserEvidence;
	const evidenceExpectation = beforeZeroPayloadOrdinaryEvidenceExpectationSource(
		path, browserEvidence, expected
	);
	if(sha256(evidenceExpectation) === expected) return evidenceExpectation;
	const bufferRepair = beforeHistoryReaderBufferRepairSource(
		path, evidenceExpectation, expected
	);
	if(sha256(bufferRepair) === expected) return bufferRepair;
	const hubGap = beforeHubTransitionGapSource(path, bufferRepair, expected);
	if(sha256(hubGap) === expected) return hubGap;
	const readerRepair = beforeHistoryReaderHubRepairSource(path, hubGap, expected);
	if(sha256(readerRepair) === expected) return readerRepair;
	const ledgerGap = beforeLedgerTransitionGapSource(path, readerRepair, expected);
	if(sha256(ledgerGap) === expected) return ledgerGap;
	const zeroPayloadRustPromotion = beforeZeroPayloadRustPromotionSource(
		path, ledgerGap, expected
	);
	if(sha256(zeroPayloadRustPromotion) === expected)
		return zeroPayloadRustPromotion;
	const zeroPayloadTypeSurfaceGapPrelude
		= beforeZeroPayloadTypeSurfaceGapSource(
			path, zeroPayloadRustPromotion, expected
		);
	if(sha256(zeroPayloadTypeSurfaceGapPrelude) === expected)
		return zeroPayloadTypeSurfaceGapPrelude;
	const zeroPayloadDotnetPromotion = beforeZeroPayloadDotnetPromotionSource(
		path, zeroPayloadTypeSurfaceGapPrelude, expected
	);
	if(sha256(zeroPayloadDotnetPromotion) === expected)
		return zeroPayloadDotnetPromotion;
	const zeroPayloadJvmPromotion = beforeZeroPayloadJvmPromotionSource(
		path, zeroPayloadDotnetPromotion, expected
	);
	if(sha256(zeroPayloadJvmPromotion) === expected)
		return zeroPayloadJvmPromotion;
	const zeroPayloadRuby = beforeZeroPayloadRubyHistorySource(
		path, zeroPayloadJvmPromotion, expected
	);
	if(sha256(zeroPayloadRuby) === expected) return zeroPayloadRuby;
	const zeroPayloadTypeSurfaceGap = beforeZeroPayloadTypeSurfaceGapSource(
		path, zeroPayloadRuby, expected
	);
	if(sha256(zeroPayloadTypeSurfaceGap) === expected)
		return zeroPayloadTypeSurfaceGap;
	const zeroPayloadPython = beforeZeroPayloadPythonHistorySource(
		path, zeroPayloadTypeSurfaceGap, expected
	);
	if(sha256(zeroPayloadPython) === expected) return zeroPayloadPython;
	const zeroPayloadJvmNullBoundary = beforeZeroPayloadJvmNullBoundarySource(
		path, zeroPayloadPython, expected
	);
	if(sha256(zeroPayloadJvmNullBoundary) === expected)
		return zeroPayloadJvmNullBoundary;
	const zeroPayloadNativePromotion = beforeZeroPayloadNativePromotionSource(
		path, zeroPayloadJvmNullBoundary, expected
	);
	if(sha256(zeroPayloadNativePromotion) === expected)
		return zeroPayloadNativePromotion;
	const zeroPayloadBrowserDiagnostic = beforeZeroPayloadBrowserDiagnosticSource(
		path, zeroPayloadNativePromotion, expected
	);
	if(sha256(zeroPayloadBrowserDiagnostic) === expected)
		return zeroPayloadBrowserDiagnostic;
	const zeroPayloadNativeEvidence = beforeZeroPayloadNativeEvidenceSource(
		path, zeroPayloadBrowserDiagnostic, expected
	);
	if(sha256(zeroPayloadNativeEvidence) === expected)
		return zeroPayloadNativeEvidence;
	const zeroPayloadPhpWasm = beforeZeroPayloadPhpWasmHistorySource(
		path, zeroPayloadNativeEvidence, expected
	);
	if(sha256(zeroPayloadPhpWasm) === expected)
		return zeroPayloadPhpWasm;
	const zeroPayloadPerlBooleanRepair
		= beforeZeroPayloadPerlBooleanRepairSource(
			path, zeroPayloadPhpWasm, expected
		);
	if(sha256(zeroPayloadPerlBooleanRepair) === expected)
		return zeroPayloadPerlBooleanRepair;
	const zeroPayloadWit = beforeZeroPayloadWitHistorySource(
		path, zeroPayloadPerlBooleanRepair, expected
	);
	if(sha256(zeroPayloadWit) === expected) return zeroPayloadWit;
	const zeroPayloadPhp = beforeZeroPayloadPhpHistorySource(
		path, zeroPayloadWit, expected
	);
	if(sha256(zeroPayloadPhp) === expected) return zeroPayloadPhp;
	const zeroPayloadPerlArchive = beforeZeroPayloadPerlArchiveSource(
		path, zeroPayloadPhp, expected
	);
	if(sha256(zeroPayloadPerlArchive) === expected)
		return zeroPayloadPerlArchive;
	const zeroPayloadRustArchive = beforeZeroPayloadRustArchiveSource(
		path, zeroPayloadPerlArchive, expected
	);
	if(sha256(zeroPayloadRustArchive) === expected)
		return zeroPayloadRustArchive;
	const zeroPayloadRustCi = beforeZeroPayloadRustCiSource(
		path, zeroPayloadRustArchive, expected
	);
	if(sha256(zeroPayloadRustCi) === expected) return zeroPayloadRustCi;
	const zeroPayloadRustAuditRepair = beforeZeroPayloadRustAuditRepairSource(
		path, zeroPayloadRustCi, expected
	);
	if(sha256(zeroPayloadRustAuditRepair) === expected)
		return zeroPayloadRustAuditRepair;
	const zeroPayloadRustInstalled = beforeZeroPayloadRustInstalledSource(
		path, zeroPayloadRustAuditRepair, expected
	);
	if(sha256(zeroPayloadRustInstalled) === expected)
		return zeroPayloadRustInstalled;
	const zeroPayloadRust = beforeZeroPayloadRustSource(
		path, zeroPayloadRustInstalled, expected
	);
	if(sha256(zeroPayloadRust) === expected) return zeroPayloadRust;
	const zeroPayloadJvmArchive = beforeZeroPayloadJvmArchiveSource(
		path, zeroPayloadRust, expected
	);
	if(sha256(zeroPayloadJvmArchive) === expected)
		return zeroPayloadJvmArchive;
	const zeroPayloadJvm = beforeZeroPayloadJvmSource(
		path, zeroPayloadJvmArchive, expected
	);
	if(sha256(zeroPayloadJvm) === expected) return zeroPayloadJvm;
	const zeroPayloadDotnetControlRepair
		= beforeZeroPayloadDotnetControlRepairSource(
			path, zeroPayloadJvm, expected
		);
	if(sha256(zeroPayloadDotnetControlRepair) === expected)
		return zeroPayloadDotnetControlRepair;
	const zeroPayloadDotnetArchive = beforeZeroPayloadDotnetArchiveSource(
		path, zeroPayloadDotnetControlRepair, expected
	);
	if(sha256(zeroPayloadDotnetArchive) === expected)
		return zeroPayloadDotnetArchive;
	const zeroPayloadVariant = beforeZeroPayloadVariantSource(
		path, zeroPayloadDotnetArchive, expected
	);
	if(sha256(zeroPayloadVariant) === expected) return zeroPayloadVariant;
	const zeroPayloadDotnetVerifierRepair
		= beforeZeroPayloadDotnetVerifierRepairSource(
			path, zeroPayloadVariant, expected
		);
	if(sha256(zeroPayloadDotnetVerifierRepair) === expected)
		return zeroPayloadDotnetVerifierRepair;
	const zeroPayloadDotnetCi = beforeZeroPayloadDotnetCiSource(
		path, zeroPayloadDotnetVerifierRepair, expected
	);
	if(sha256(zeroPayloadDotnetCi) === expected) return zeroPayloadDotnetCi;
	const zeroPayloadDotnet = beforeZeroPayloadDotnetSource(
		path, zeroPayloadDotnetCi, expected
	);
	if(sha256(zeroPayloadDotnet) === expected) return zeroPayloadDotnet;
	const zeroPayloadNativeArchive = beforeZeroPayloadNativeArchiveSource(
		path, zeroPayloadDotnet, expected
	);
	if(sha256(zeroPayloadNativeArchive) === expected)
		return zeroPayloadNativeArchive;
	const zeroPayloadNative = beforeZeroPayloadNativeSource(
		path, zeroPayloadNativeArchive, expected
	);
	if(sha256(zeroPayloadNative) === expected) return zeroPayloadNative;
	const zeroPayloadBrowserArchive = beforeZeroPayloadBrowserArchiveSource(
		path, zeroPayloadNative, expected
	);
	if(sha256(zeroPayloadBrowserArchive) === expected)
		return zeroPayloadBrowserArchive;
	const zeroPayloadBrowserCi = beforeZeroPayloadBrowserCiSource(
		path, zeroPayloadBrowserArchive, expected
	);
	if(sha256(zeroPayloadBrowserCi) === expected) return zeroPayloadBrowserCi;
	const zeroPayloadBrowser = beforeZeroPayloadBrowserSource(
		path, zeroPayloadBrowserCi, expected
	);
	if(sha256(zeroPayloadBrowser) === expected) return zeroPayloadBrowser;
	const zeroPayloadNpmInstalled = beforeZeroPayloadNpmInstalledSource(
		path, zeroPayloadBrowser, expected
	);
	if(sha256(zeroPayloadNpmInstalled) === expected) return zeroPayloadNpmInstalled;
	const zeroPayloadJavaScript = beforeZeroPayloadJavaScriptSource(
		path, zeroPayloadNpmInstalled, expected
	);
	if(sha256(zeroPayloadJavaScript) === expected) return zeroPayloadJavaScript;
	const zeroPayloadNpm = beforeZeroPayloadNpmFoundationSource(
		path, zeroPayloadJavaScript, expected
	);
	if(sha256(zeroPayloadNpm) === expected) return zeroPayloadNpm;
	const zeroPayload = beforeZeroPayloadCheckedRecordSource(
		path, zeroPayloadNpm, expected
	);
	if(sha256(zeroPayload) === expected) return zeroPayload;
	const projectedMirror = beforeProjectedCheckedRecordMirrorSource(
		path, zeroPayload, expected
	);
	if(sha256(projectedMirror) === expected) return projectedMirror;
	const perlEngineClosure = beforePerlEngineOwnedRefinementClosureSource(
		path, projectedMirror, expected
	);
	if(sha256(perlEngineClosure) === expected) return perlEngineClosure;
	const partitionValidator = beforeStructuralSubtypePartitionValidatorSource(
		path, perlEngineClosure, expected
	);
	if(sha256(partitionValidator) === expected) return partitionValidator;
	const genericSubtypeNpm = beforeGenericSubtypeNpmBrowserSource(
		path, partitionValidator, expected
	);
	if(sha256(genericSubtypeNpm) === expected) return genericSubtypeNpm;
	const ownedSubtypeRegistration = beforeOwnedSubtypeCoreRegistrationSource(
		path, genericSubtypeNpm, expected
	);
	if(sha256(ownedSubtypeRegistration) === expected)
		return ownedSubtypeRegistration;
	const runnerHeadroom = beforeCoreRunnerHeadroomSource(
		path, ownedSubtypeRegistration, expected
	);
	if(sha256(runnerHeadroom) === expected) return runnerHeadroom;
	const genericSubtype = beforeGenericSubtypeCompositionSource(
		path, runnerHeadroom, expected
	);
	if(sha256(genericSubtype) === expected) return genericSubtype;
	const hostRegistration = beforeOwnedSubtypeHostRegistrationSource(
		path, genericSubtype, expected
	);
	if(sha256(hostRegistration) === expected) return hostRegistration;
	const ownedJavaScriptTransfer = beforeOwnedSubtypeJavaScriptTransferSource(
		path, hostRegistration, expected
	);
	if(sha256(ownedJavaScriptTransfer) === expected)
		return ownedJavaScriptTransfer;
	const ownedJavaScript = beforeOwnedSubtypeJavaScriptSource(
		path, ownedJavaScriptTransfer, expected
	);
	if(sha256(ownedJavaScript) === expected) return ownedJavaScript;
	const ownedCarriers = beforeOwnedRefinementCarriersSource(
		path, ownedJavaScript, expected
	);
	if(sha256(ownedCarriers) === expected) return ownedCarriers;
	const ownedRefinement = beforeOwnedRefinementModelSource(
		path, ownedCarriers, expected
	);
	if(sha256(ownedRefinement) === expected) return ownedRefinement;
	const ownedSubtype = beforeOwnedSubtypeAnalysisSource(
		path, ownedRefinement, expected
	);
	if(sha256(ownedSubtype) === expected) return ownedSubtype;
	const ownedHistory = beforeOwnedSubtypeJavaScriptHistoricalSource(
		path, ownedSubtype, expected
	);
	if(sha256(ownedHistory) === expected) return ownedHistory;
	const remainingAcceptance = beforeCallbackSubtypeRemainingAcceptanceSource(
		path, ownedHistory, expected
	);
	if(sha256(remainingAcceptance) === expected) return remainingAcceptance;
	const remainingCallbacks = beforeCallbackSubtypeRemainingSource(
		path, remainingAcceptance, expected
	);
	if(sha256(remainingCallbacks) === expected) return remainingCallbacks;
	const languages = beforeCallbackSubtypeLanguageSource(
		path, remainingCallbacks, expected
	);
	if(sha256(languages) === expected) return languages;
	const nativeCallbacks = beforeCallbackSubtypeNativeSource(
		path, languages, expected
	);
	if(sha256(nativeCallbacks) === expected) return nativeCallbacks;
	const browserArtifact = beforeCallbackSubtypeBrowserArtifactSource(
		path, nativeCallbacks, expected
	);
	if(sha256(browserArtifact) === expected) return browserArtifact;
	const npmAcceptance = beforeCallbackSubtypeNpmAcceptanceSource(
		path, browserArtifact, expected
	);
	if(sha256(npmAcceptance) === expected) return npmAcceptance;
	const npmBrowser = beforeCallbackSubtypeNpmBrowserSource(
		path, npmAcceptance, expected
	);
	if(sha256(npmBrowser) === expected) return npmBrowser;
	const foundation = beforeCallbackSubtypeFoundationSource(
		path, npmBrowser, expected
	);
	if(sha256(foundation) === expected) return foundation;
	let previous = beforeNominalSubtypeEntryMeasurementSource(
		path, foundation, expected
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
	if(previous === text) return source;
	return expected !== undefined && sha256(previous) !== expected
		? beforeFinRefinementSource(path, previous, expected)
		: previous;
};
