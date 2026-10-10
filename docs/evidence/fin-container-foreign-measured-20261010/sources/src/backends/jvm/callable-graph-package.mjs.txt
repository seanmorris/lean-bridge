/**
 * Package typed JVM callbacks with authenticated lazy native loading.
 *
 * @file
 */
import { hashBindingIr } from '../../binding-ir/canonical.mjs';
import { generateCallableJvmGraphSources } from './callable-graph-calls.mjs';
import { jvmGraphAssets } from './copied-graph-assets.mjs';

/**
 * Package typed JVM callbacks with authenticated lazy native loading.
 *
 * @param ir - Validated component binding graph.
 * @param evidence - Compiled native asset identities or null before packaging.
 */
export const generateCallableJvmGraphPackage = (ir, evidence = null) => {
	const model = generateCallableJvmGraphSources(ir), files = { ...model.files };
	files['src/main/java/' + model.namespace.replaceAll('.', '/') + '/_CallableGraphNative.java'] = jvmGraphAssets(model, evidence, true);
	files['README.md'] = `# ${model.namespace}

Install the prepared Maven release and call ${model.namespace}.Api from Java or
${model.namespace}.kotlin.Api from Kotlin. The JAR verifies and loads its bundled
Lean component and shared runtime automatically. Consumers need Java 22 or newer
with --enable-native-access=ALL-UNNAMED on Linux x86-64 with the declared glibc
floor. Maven resolves Kotlin's standard library. Lean and native compiler tools
are not required by the consumer.

Copied values have separate Java and Kotlin classes. Kotlin signatures preserve
their non-null types, nested arrays and metadata. Arrays and Lists use typed
arrays; records and named constructors have immutable fields. Contained arrays
remain mutable. Results own independent copied storage. Option distinguishes
None, Some(Unit) and Some(None); Result preserves the active success/error arm.
Nat and Int use BigInteger, UInt32 uses checked long/Long, and Char is an integer
Unicode scalar rather than a UTF-16 character. Unit results use Java void and
Kotlin Unit; Unit arguments use Unit.INSTANCE.

Callbacks are synchronous, call-scoped SAM interfaces. Returned LeanClosure
values implement their corresponding interface and AutoCloseable. Use
try-with-resources in Java or use in Kotlin to release them. Invocation requires
their original creating platform thread and process. Closing during a call
defers release until that call returns. Cleaner reclamation is a fallback, not
a substitute for explicit close. Host exceptions keep their original identity
after native cleanup. Borrowed callbacks expire when the exporting call ends.

Conversion permits 128 value levels, 262144 visited values, a 16 MiB native-copy
budget and a separate 16 MiB accounted host-storage budget. These do not measure
Lean working memory or every JVM allocation. Reentry allows 64 active calls;
owned closures share 4096 identity slots. Cycles, null copied values, negative
Nat, invalid Unicode and malformed branches reject. Invalid cold calls do not
load Lean assets. Conversion limits and allocation failures permit recovery;
malformed native output retires the shared runtime.

Resource or callable identities inside copied aggregates, retained host
callbacks, asynchronous delivery and post-fork reuse are unsupported. Use a
fresh process after fork. Native libraries stay loaded until process exit.
`;
	files['binding-manifest.json'] = JSON.stringify({
		schemaVersion: 1
		, generator: 'jvm-callable-graph-v1'
		, target: 'jvm'
		, component: ir.component.id
		, bindingIrSha256: hashBindingIr(ir)
		, namespace: model.namespace
		, files: Object.keys(files).filter(path => path !== 'binding-manifest.json')
		, publicFiles: model.publicFiles
		, internalFiles: model.internalFiles
		, packageFiles: []
		, aliases: model.aliases
		, copiedGraph: { schemaVersion: 1, layoutSha256: model.layoutSha256 }
		, kotlin: {
			namespace: model.namespace + '.kotlin'
			, metadataVersion: '2.2.0'
			, publicFiles: model.publicFiles.filter(path => path.endsWith('.kt') || /\/KotlinFn/.test(path))
			, internalFiles: model.internalFiles.filter(path => path.includes('Kotlin'))
		}
		, supportedFeatures: ['direct-functions', 'copied-values', 'recursive-values', 'typed-callbacks', 'owned-closures', 'deterministic-close']
		, capabilityGaps: [{ feature: 'identity-and-effects', reason: 'Copied callback payloads exclude nested callable identities, resources and asynchronous values.' }
			, { feature: 'additional-platforms', reason: 'Compiled releases target Java 22 on Linux x86-64 with glibc.' }]
	}, null, 2) + '\n';
	return Object.freeze(files);
};
