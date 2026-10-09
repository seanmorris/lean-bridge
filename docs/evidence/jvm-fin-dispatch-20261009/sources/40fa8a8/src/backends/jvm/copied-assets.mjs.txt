/**
 * Render process-wide, verified native library loading for ordinary JARs.
 *
 * @file
 */
import { verifiedJvmAssets } from "./verified-assets.mjs";

/**
 * Use the same pinned dependencies and loading policy as owned-value packages.
 *
 * @param model - Closed Java model.
 * @param evidence - Compiled library identities.
 */
export const copiedJvmAssets = (model, evidence) => `package ${model.namespace};

final class NativeAssets {
    private NativeAssets() { }
    static void ensureProcess() { _Assets.ensureProcess(); }
    static java.lang.foreign.SymbolLookup lookup() { return _Assets.lookup(); }
    private static final class _Assets {
${verifiedJvmAssets(evidence ?? null, "_Assets")}
    }
}
`;
