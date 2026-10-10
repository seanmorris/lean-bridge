/**
 * Package recursive Perl values, callbacks and owned closures in private XS.
 *
 * @file
 */
import { canonicalJson } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { generateNativeCallableGraphCalls } from "../c/native-callable-graph-calls.mjs";
import { perlStringLiteral } from "./naming.mjs";
import { generateCallablePerlGraphXs } from "./callable-graph-xs.mjs";

/**
 * Generate a loadable Perl package over the authenticated shared native runtime.
 *
 * @param model - Checked compiled component model.
 * @param receipt - Authenticated native component receipt.
 */
export const generateCallablePerlGraphPackage = (model, receipt) => {
	const ir = model.bindingIr, moduleName = model.moduleName;
	const generated = generateCallablePerlGraphXs(ir, moduleName);
	const native = generateNativeCallableGraphCalls(ir, model.copiedGraph, { initializer: receipt.initializer });
	if(canonicalJson(generated.layout) !== canonicalJson(native.layout)) throw new TypeError("Perl and native callable layouts differ");
	const prefix = native.layout.prefix, publicModule = `lib/${moduleName.replaceAll("::", "/")}.pm`;
	const header = native.header.replace(/^(uint32_t|void) ([a-zA-Z_][a-zA-Z0-9_]*\()/gm, '__attribute__((visibility("hidden"))) $1 $2');
	const sources = model.sourceIdentity.modules.map(item => `${perlStringLiteral(item.module)} => ${perlStringLiteral(item.source.sha256)}`).join(", ");
	const lifecycle = `static int lpg_ready(void) { return ng_ready(); }
static void lpg_retire(void) { lean_bridge_native_runtime_retire(); }
`;
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

${moduleName} - Generated recursive values and synchronous Lean callbacks

=head1 API

${generated.functions.map(fn => `=head2 ${fn.publicName}\n\nCalls C<${fn.declaration.source.declaration}> in the compiled Lean component.\n`).join("\n")}
=head1 VALUES

Records and variants use generated named-field classes. Arrays, Lists and
products use plain array references. None and Unit use undef; Some->new(undef)
keeps optional Unit distinct from None. Ok and Err retain result branches.
Nat and Int use Math::BigInt. Strings retain Unicode and NUL; ByteArray uses
octets. Aliases keep their copied target representation.

Calls check exact classes, fields and scalar representations, and reject
cycles, sparse arrays and tied containers. Callback arguments and results,
returned captures and ordinary results own independent copied storage.

=head1 CALLBACKS AND OWNERSHIP

Pass a CODE reference or a matching generated Lean closure as a synchronous
callback. Returned Lean closures provide call, close and closed. Close each
closure when finished. Close is idempotent and an active call retains its
borrow until native cleanup finishes. Automatic finalization also releases
the native lease. Closures cannot be serialized or used by another interpreter
or process. Host callbacks must not escape their initiating native call.

Perl callback exceptions retain their identity and are rethrown after native
cleanup. Reply buffers remain allocated until Lean copies them. Malformed
native results retire the shared runtime; input, callback and limit failures
leave it usable. Libraries remain loaded until process exit.

=head1 LIMITS

Conversions share a depth limit of 128, 262,144 nodes, a 16 MiB native-copy
budget and a separate 16 MiB conversion-storage budget. Reentry is limited to
64 native calls and the component supports up to 4,096 live closure leases.
These limits do not bound Lean working memory or all Perl allocator overhead.
Resource-containing copied values and asynchronous callbacks remain unsupported.

=cut
`;
	return {
		"Component.xs": `#include "runtime.h"\n#include "component.h"\n${native.source}\n${generated.source}\n${lifecycle}\n${generated.xs}\nBOOT:\n  lbp_check_interpreter(aTHX);\n`
		, [`${prefix}-graph-types.h`]: native.typesHeader
		, [`${prefix}-graph.h`]: header
		, [`${prefix}-callable-borrows.h`]: native.borrowsHeader
		, [publicModule]: pm
		, "binding-manifest.json": JSON.stringify({ schemaVersion: 1
			, backend: "perl", profile: "native-library-v1"
			, bindingIrSha256: hashBindingIr(ir), publicModule
			, runtimeIdentity: receipt.runtimeIdentity
			, aliases: generated.aliases
			, copiedGraph: { schemaVersion: 1, layoutSha256: generated.layoutSha256 } }, null, 2) + "\n"
	};
};
