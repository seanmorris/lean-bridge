/**
 * Prepared Perl modules over private, compiler-authenticated native graphs.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { nativeGraphCarrierAbi } from "../../build/native-graph-model.mjs";
import { generateNativeCopiedGraphAdapters } from "../c/native-graph-adapters.mjs";
import { generateCopiedPerlGraphValues } from "./copied-graph-values.mjs";
import { generateCopiedPerlGraphXs } from "./copied-graph-xs.mjs";
import { perlStringLiteral } from "./naming.mjs";

/**
 * Check the explicit Perl namespace without inventing a public C projection.
 *
 * @param ir - Compiler-checked finite copied graph contract.
 * @param moduleName - Explicit CPAN module namespace.
 */
export const compileCopiedPerlGraphPackageModel = (ir, moduleName) => {
	const values = generateCopiedPerlGraphValues(ir, moduleName);
	if(ir.component.id.length >= 160) throw new TypeError("Perl graph component identity exceeds its name limit");
	return { ...values, ir, layoutSha256: sha256(canonicalJson(values.layout)) };
};

/**
 * Generate one XS translation unit and its public Perl classes. Only XS entry
 * points have dynamic visibility; native graph functions belong to this module.
 *
 * @param model - Reconstructed native graph model, including its Perl namespace.
 * @param receipt - Verified native library and shared Perl runtime identities.
 */
export const generateCopiedPerlGraphPackage = (model, receipt) => {
	const ir = model.bindingIr, moduleName = model.moduleName;
	const publicModel = compileCopiedPerlGraphPackageModel(ir, moduleName);
	const generated = generateCopiedPerlGraphXs(ir, moduleName);
	const native = generateNativeCopiedGraphAdapters(ir, nativeGraphCarrierAbi(model), { initializer: receipt.initializer });
	const prefix = native.layout.prefix, publicModule = `lib/${moduleName.replaceAll("::", "/")}.pm`;
	if(canonicalJson(generated.layout) !== canonicalJson(native.layout)) throw new TypeError("Perl and native graph layouts differ");
	// Annotate only defined graph roots, never the external Lean helper symbols.
	let header = native.header;
	for(const root of native.layout.roots)
	{
		const declaration = `uint32_t ${root.name}_graph(`;
		if(header.split(declaration).length !== 2) throw new TypeError("Native graph root declaration is missing or ambiguous");
		header = header.replace(declaration, `__attribute__((visibility("hidden"))) ${declaration}`);
	}
	const lifecycle = `static void lpg_check_context(pTHX) { lbp_check_interpreter(aTHX); }
static uint32_t lpg_initialize(void) { return lean_bridge_native_component_initialize(${JSON.stringify(model.component.id)}, ng_initialize) ? 0 : 5; }
static int lpg_ready(void) { return ng_ready(); }
static void lpg_retire(void) { lean_bridge_native_runtime_retire(); }
`;
	const sources = model.sourceIdentity.modules.map(item => `${perlStringLiteral(item.module)} => ${perlStringLiteral(item.source.sha256)}`).join(", ");
	const pm = `${generated.valuesSource}
package ${moduleName};
use LeanBridge::Runtime;
use XSLoader;
our $VERSION = '0.001';
LeanBridge::Runtime::_load_component(__FILE__, ${perlStringLiteral(receipt.library)}, ${perlStringLiteral(receipt.nativeLibrary.sha256)}, ${perlStringLiteral(receipt.runtimeIdentity)}, { ${sources} }, ${perlStringLiteral(model.component.id)});
XSLoader::load(__PACKAGE__, $VERSION);
sub CLONE_SKIP { 1 }
1;

__END__
=head1 NAME

${moduleName} - Generated recursive copied values from ${model.component.name}

=head1 API

${publicModel.functions.map(item => `=head2 ${item.publicName}\n\nCalls C<${item.source.declaration}> in the compiled Lean component.\n`).join("\n")}
=head1 COPIED VALUES

Records use mutable named-field classes. Variants use named constructor classes.
Array and List use plain dense array references; Prod uses nested pairs. Unit and
None use undef. Some->new(undef) and nested Some wrappers preserve optional Unit
and nested options. Ok and Err retain distinct result branches. Concrete aliases
preserve their names in the binding manifest without introducing wrapper classes.
Calls check exact classes and field sets and reject tied or sparse containers.
Returned values own independent storage, including branches shared by an input.
Reference equality is not deep value equality.

Nat and Int use Math::BigInt. Fixed-width integers retain their exact ranges;
native words are 64-bit. String preserves Unicode and NUL, ByteArray uses octets,
and Char requires one Unicode scalar. Float32 rounds to binary32. Float values
preserve NaN classification, infinities and signed zero.

=head1 LIMITS AND LIFETIME

Input and output conversion share a maximum depth of 128, 262,144 nodes and a
16 MiB native-copy allowance, with a separate 16 MiB conversion-storage allowance.
These limits do not bound Lean working memory or every Perl allocator overhead.
Cycles and types with no finite inhabitants reject. Calls validate inputs before
initializing Lean. Exceptions, allocation failures and delivered Perl signals
release temporary storage and owned native results. Malformed native results
retire the shared runtime; recoverable input and limit errors leave it usable.

Components load the exact shared runtime automatically. Calls and fresh imports
require the initiating process and Perl interpreter thread. Start a new process
after fork. Libraries remain loaded until process exit. Structured callbacks,
closures, asynchronous values and resource-containing copied values are not part
of this recursive copied profile.

=cut
`;
	return {
		"Component.xs": `#include "runtime.h"\n#include "component.h"\n${native.source}\n${generated.source}\n${lifecycle}\n${generated.xs}\nBOOT:\n  lbp_check_interpreter(aTHX);\n`
		, [`${prefix}-graph-types.h`]: native.typesHeader
		, [`${prefix}-graph.h`]: header
		, [publicModule]: pm
		, "binding-manifest.json": `${JSON.stringify({ schemaVersion: 1
			, backend: "perl", profile: "native-library-v1"
			, bindingIrSha256: hashBindingIr(ir), publicModule
			, runtimeIdentity: receipt.runtimeIdentity, aliases: publicModel.aliases
			, copiedGraph: { schemaVersion: 1, layoutSha256: publicModel.layoutSha256 }
		}, null, 2)}\n`
	};
};
