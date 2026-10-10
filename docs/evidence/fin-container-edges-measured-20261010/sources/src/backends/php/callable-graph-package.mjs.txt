/**
 * Receipt-bound native PHP packages with recursive callbacks and closures.
 *
 * @file
 */
import { canonicalJson, sha256 } from '../../capsule/node.mjs';
import { hashBindingIr } from '../../binding-ir/canonical.mjs';
import { generateCallablePhpGraphSources } from './callable-graph-calls.mjs';
import { copiedPhpAssets, copiedPhpLoader } from './copied-assets.mjs';

const evidenceFor = (model, evidence) => {
	if(evidence === null) return;
	const fields = ['componentId', 'componentReceiptSha256', 'copiedGraph', 'libraries', 'library', 'runtimeIdentity'];
	if(!evidence || canonicalJson(Object.keys(evidence).sort()) !== canonicalJson(fields)
		|| evidence.componentId !== model.ir.component.id || evidence.library !== 'lib' + model.prefix + '.so'
		|| !/^[a-f0-9]{64}$/.test(evidence.runtimeIdentity) || !/^[a-f0-9]{64}$/.test(evidence.componentReceiptSha256)
		|| canonicalJson(evidence.copiedGraph ?? null) !== canonicalJson({ schemaVersion: 1, layoutSha256: model.layoutSha256 })
		|| !evidence.libraries || typeof evidence.libraries !== 'object' || Array.isArray(evidence.libraries))
		throw new TypeError('PHP callable graph evidence differs from the component or layout');
	const libraries = Object.entries(evidence.libraries);
	if(libraries.length < 4 || libraries.some(([name, digest]) => !/^lib[A-Za-z0-9_.-]+\.so(?:\.\d+)*$/.test(name) || !/^[a-f0-9]{64}$/.test(digest))
		|| [evidence.library, 'libleanshared.so', 'liblean_bridge_native.so'].some(name => !Object.hasOwn(evidence.libraries, name)))
		throw new TypeError('PHP callable graphs require exact native asset identities');
};

/**
 * Assemble the audited PHP surface and authenticate its compiled native assets.
 *
 * @param ir - Compiler-checked Binding IR.
 * @param evidence - Exact native library and layout identities, or null before compilation.
 */
export const generateCallablePhpGraphPackage = (ir, evidence = null) => {
	const model = generateCallablePhpGraphSources(ir); evidenceFor(model, evidence);
	const files = { ...model.files, 'src/Internal/Runtime.php': copiedPhpLoader };
	files['src/Internal/Native.php'] = [
		'<?php'
		, 'declare(strict_types=1);'
		, 'namespace ' + model.namespace + '\\Internal;'
		, ''
		, "require_once __DIR__ . '/CallableRuntime.php';"
		, "require_once __DIR__ . '/CallableTypes.php';"
		, ''
		, 'final class Native'
		, '{'
		, "    private const DEFINITIONS = <<<'CDEFS'"
		, model.definitions
		, 'CDEFS;'
		, '    private static ?CallableRuntime $runtime = null;'
		, '    private static ?\\Closure $wrap = null;'
		, '    private static function load(): \\FFI {'
		, '        ' + copiedPhpAssets(evidence)
		, '    }'
		, '    public static function call(string $name, array $arguments): mixed {'
		, '        self::$runtime ??= new CallableRuntime(static fn(): \\FFI => self::load(), CallableTypes::CATALOG);'
		, '        try {'
		, '            $value = self::$runtime->call($name, $arguments);'
		, '            if (!$value instanceof Lease) return $value;'
		, '            self::$wrap ??= \\Closure::bind(static fn(Lease $lease) => new \\' + model.namespace + '\\LeanClosure($lease), null, \\' + model.namespace + '\\LeanClosure::class);'
		, '            return (self::$wrap)($value);'
		, '        } catch (GraphInvalidNative $error) {'
		, '            throw new \\' + model.namespace + '\\LeanBridgeError($error->getMessage(), 4, $error);'
		, '        }'
		, '    }'
		, '}'
		, ''
	].join('\n');
	files['README.md'] = '# ' + model.namespace + '\n\nInstall this package with Composer and load vendor/autoload.php. The package\nloads its bundled native libraries automatically. Native execution requires\nPHP 8.2+ NTS CLI on Linux x86-64 with FFI enabled.\n\nSynchronous callbacks accept finite copied values, including recursive records\nand variants. Returned LeanClosure objects are invokable; close them in a\nfinally block. Destruction provides cleanup for abandoned closures. Callback\nexceptions retain their Throwable identity.\n\nCopied conversion is bounded to 128 levels, 262144 visited values and separate\n16 MiB host/native budgets per call. Lean working memory is not included.\nCallback reply buffers remain alive through native copying. Malformed native\noutput retires the shared runtime. Calls must use the main PHP execution\ncontext in the originating process; start a fresh PHP process after fork.\n';
	const exports = ['Bytes', 'LeanBridgeError', 'Some', 'Ok', 'Err', 'LeanClosure', ...model.types.filter(node => node.kind === 'variant').map(node => node.publicType), ...model.records.map(record => record.name), ...model.functions.map(fn => fn.publicName)].map(name => model.namespace + '\\' + name);
	files['binding-manifest.json'] = canonicalJson({
		schemaVersion: 1
		, generator: { id: 'lean-wasm/php-callable-graph', version: 1 }
		, component: ir.component.id
		, bindingIrSha256: hashBindingIr(ir)
		, namespace: model.namespace
		, copiedGraph: { schemaVersion: 1, layoutSha256: model.layoutSha256 }
		, nativeEvidence: evidence
		, aliases: model.aliases
		, exports
		, publicFiles: model.publicFiles
		, internalFiles: Object.keys(files).filter(file => file.startsWith('src/Internal/'))
		, files: [...Object.keys(files), 'binding-manifest.json']
		, filesSha256: Object.fromEntries(Object.entries(files).map(([file, text]) => [file, sha256(text)]))
	});
	return Object.freeze(files);
};
