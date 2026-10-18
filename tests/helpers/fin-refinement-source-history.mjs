/**
 * Reconstruct the extractor that preceded top-level Fin refinement support.
 * Historical package receipts stay immutable while current-source regressions
 * can prove that this isolated admission did not rewrite their implementation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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
import { exactSourceHistoryCheckpoints, memoizeSourceHistory } from "./source-history-memo.mjs";

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

const exactTypeSurfaceHistoryTransitions = () => {
	if(typeSurfaceHistoryTransitions) return typeSurfaceHistoryTransitions;
	const transitions = [];
	for(const name of readdirSync(typeSurfaceEvidenceDirectory).sort())
	{
		if(!name.endsWith(".json") || !name.includes("history")) continue;
		const raw = readFileSync(new URL(name, typeSurfaceEvidenceDirectory), "utf8");
		if(!raw.includes(`"${typeSurfacePath}"`) || !raw.includes('"updates"'))
			continue;
		const evidence = JSON.parse(raw);
		const historical = evidence.historicalTransitions ?? [];
		assert.ok(Array.isArray(historical), `${name} historical transitions`);
		const updateGroups = [evidence.updates
			, ...historical.map(item => item?.updates)];
		for(const updates of updateGroups)
		{
			if(updates === undefined) continue;
			assert.ok(Array.isArray(updates), `${name} source updates`);
			for(const update of updates)
				if(update?.path === typeSurfacePath)
					transitions.push({
						evidenceName: name
						, currentSha256: update.currentSha256
						, previousSha256: update.previousSha256
					});
		}
	}
	assert.ok(transitions.length > 0, "Type-surface source history is recorded");
	typeSurfaceHistoryTransitions = Object.freeze(transitions);
	return typeSurfaceHistoryTransitions;
};

const exactTypeSurfaceUpdate = transition => {
	const evidence = JSON.parse(readFileSync(new URL(
		transition.evidenceName, typeSurfaceEvidenceDirectory
	), "utf8"));
	const groups = [evidence.updates
		, ...(evidence.historicalTransitions ?? []).map(item => item?.updates)];
	const matches = groups.flatMap(updates => updates ?? []).filter(update =>
		update?.path === typeSurfacePath
		&& update.currentSha256 === transition.currentSha256
		&& update.previousSha256 === transition.previousSha256
	);
	assert.equal(matches.length, 1
		, `${transition.evidenceName} exact type-surface transition`);
	return matches[0];
};

const directlyReversibleTypeSurfaceUpdate = update =>
	Array.isArray(update.replacements)
	&& update.replacements.length > 0
	&& update.replacements.every(item =>
		Object.keys(item).sort().join(",") === "count,current,previous"
	)
	|| Array.isArray(update.edits)
	&& update.edits.length > 0
	&& update.edits.every(item =>
		Object.keys(item).sort().join(",") === "current,previous,start"
	);

const reverseExactTypeSurfaceTransition = (source, transition, update) => {
	assert.equal(sha256(source), transition.currentSha256
		, transition.evidenceName);
	assert.ok(directlyReversibleTypeSurfaceUpdate(update)
		, `${transition.evidenceName} direct type-surface transition`);
	const optionalPreviousCommit = update.previousCommit === undefined
		? [] : ["previousCommit"];
	if(update.replacements !== undefined)
	{
		assert.deepEqual(Object.keys(update).sort(), [
			"currentSha256", "path", "previousSha256", "replacements"
		]);
		assert.ok(Array.isArray(update.replacements)
			&& update.replacements.length > 0);
		for(const replacement of [...update.replacements].reverse())
		{
			assert.deepEqual(Object.keys(replacement).sort()
				, ["count", "current", "previous"]);
			assert.equal(typeof replacement.current, "string");
			assert.equal(typeof replacement.previous, "string");
			assert.notEqual(replacement.current, replacement.previous);
			assert.ok(Number.isSafeInteger(replacement.count)
				&& replacement.count > 0);
			assert.equal(source.split(replacement.current).length - 1
				, replacement.count, transition.evidenceName);
			source = source.split(replacement.current).join(
				replacement.previous
			);
		}
	}
	else
	{
		const keys = Object.keys(update).sort().join(",");
		assert.ok(new Set([
			"currentSha256,edits,path,previousSha256"
			, "currentSha256,edits,path,previousCommit,previousSha256"
			, "currentSha256,edits,path,previousSha256,strategy"
			, "category,currentSha256,edits,path,previousSha256,strategy"
		]).has(keys), `${transition.evidenceName} type-surface update keys`);
		if(optionalPreviousCommit.length > 0)
			assert.match(update.previousCommit, /^[0-9a-f]{40}$/u);
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
		let cursor = 0;
		const parts = [];
		for(const edit of update.edits)
		{
			assert.deepEqual(Object.keys(edit).sort()
				, ["current", "previous", "start"]);
			assert.ok(Number.isSafeInteger(edit.start)
				&& edit.start >= cursor && edit.start <= source.length);
			assert.equal(typeof edit.current, "string");
			assert.equal(typeof edit.previous, "string");
			assert.notEqual(edit.current, edit.previous);
			assert.equal(source.slice(edit.start
				, edit.start + edit.current.length), edit.current
			, transition.evidenceName);
			parts.push(source.slice(cursor, edit.start), edit.previous);
			cursor = edit.start + edit.current.length;
		}
		parts.push(source.slice(cursor));
		source = parts.join("");
	}
	assert.equal(sha256(source), transition.previousSha256
		, transition.evidenceName);
	return source;
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
	const historyTransitions = exactTypeSurfaceHistoryTransitions();
	const plan = exactSourceHistoryCheckpoints(
		historyTransitions, sha256(source), expected, 1
	);
	const transitions = new Map();
	for(const transition of historyTransitions)
	{
		const previous = transitions.get(transition.currentSha256);
		if(previous !== undefined)
			assert.equal(previous.previousSha256, transition.previousSha256
				, `Type-surface history branch ${transition.currentSha256}`);
		else transitions.set(transition.currentSha256, transition);
	}
	for(const checkpoint of plan.checkpoints)
	{
		const current = sha256(source);
		const transition = transitions.get(current);
		assert.ok(transition, `Type-surface transition ${current}`);
		assert.equal(transition.previousSha256, checkpoint
			, `Type-surface checkpoint ${checkpoint}`);
		const update = exactTypeSurfaceUpdate(transition);
		if(!directlyReversibleTypeSurfaceUpdate(update))
			return normalizeFinRefinementSource(
				typeSurfacePath, source, expected
			);
		source = reverseExactTypeSurfaceTransition(source, transition, update);
		const flattened = Buffer.from(source, "utf8").toString("utf8");
		assert.equal(flattened, source
			, `Type-surface transition bytes ${checkpoint}`);
		source = flattened;
	}
	if(expected !== undefined && sha256(source) === expected) return source;
	return normalizeFinRefinementSource(typeSurfacePath, source, expected);
};

export const finRefinementNormalizationPaths = Object.freeze([...new Set([
	...sourceHistoryMilestoneAssertionRepairChangedPaths
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
	const text = source.toString(), previous = path === typeSurfacePath
		? normalizeExactTypeSurfaceHistory(text, expected)
		: normalizeFinRefinementSource(path, text, expected);
	return previous === text ? source : previous;
};
