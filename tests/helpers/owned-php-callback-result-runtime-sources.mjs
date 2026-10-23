/**
 * Reconstruct PHP callback sources with the exact producer implementation.
 *
 * @file
 */
import { postPerlCallbackProducer } from "./post-perl-callback-staging-history.mjs";
import { moduleAtProducerWithSourceReads } from "./producer-module.mjs";

const producer = moduleAtProducerWithSourceReads(
	postPerlCallbackProducer
	, "tests/helpers/owned-php-callback-result-runtime-sources.mjs"
);

/**
 * Bind observed compiler identities to the authored inputs and adapters at the
 * immutable staging producer. Historical reports must not be reconstructed
 * with today's generators or fixture bytes.
 *
 * @param mode - Required ordinary or reviewed source route.
 * @param variant - Required no-host, host or combined capability shape.
 * @param item - Untrusted direct report.
 * @param baseline - Independently hash-authenticated original observation.
 */
export const assertOwnedPhpCallbackRuntimeSources = async (mode, variant, item, baseline) =>
	(await producer).assertOwnedPhpCallbackRuntimeSources(mode, variant, item, baseline);
