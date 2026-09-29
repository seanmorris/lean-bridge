/**
 * Package the checked C ownership implementation inside each private Perl XS image.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { generateOwnedCPackage } from "../c/owned-package.mjs";
import { generateOwnedPerlXs } from "./owned-xs.mjs";
import { perlStringLiteral } from "./naming.mjs";

export const ownedPerlXsSeal = "__LEAN_BRIDGE_OWNED_XS_SHA256__";

/**
 * Generate source and immutable native identities from authenticated compiler input.
 *
 * @param options - Verified native model, receipt, metadata and private GMP hash.
 * @param options.model - Compiler-authenticated ownership model.
 * @param options.receipt - Native component and shared runtime identities.
 * @param options.metadata - Original checked compiler metadata.
 * @param options.moduleName - Validated public Perl namespace.
 * @param options.gmpSha256 - Verified private GMP library digest.
 */
export const generateOwnedPerlPackage = ({ model, receipt, metadata, moduleName, gmpSha256 }) => {
	if(!model.ownedGraph?.hostCallbacks || !/^[0-9a-f]{64}$/u.test(gmpSha256))
		throw new TypeError("Owned Perl requires authenticated callbacks and private GMP");
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const c = generateOwnedCPackage({ metadata
		, sourceIdentity: model.sourceIdentity, component: model.component
		, hostCallbacks: true, transferredInputs });
	if(canonicalJson(c.layout.model.bindingIr) !== canonicalJson(model.bindingIr))
		throw new TypeError("Perl ownership types differ from the compiled component");
	const generated = generateOwnedPerlXs(model.bindingIr, moduleName, { transferredInputs });
	if(generated.c.prefix !== c.values.prefix) throw new TypeError("Perl and C ownership prefixes differ");
	const prefix = c.values.prefix, relative = moduleName.replaceAll("::", "/"), stem = moduleName.split("::").at(-1);
	const gmpLibrary = "libgmp-lean-bridge.so.10", q = perlStringLiteral;
	const declarations = new Map(model.bindingIr.declarations.map(declaration => [declaration.id, declaration.source.declaration]));
	const parameters = new Map(model.bindingIr.declarations.map(declaration => [declaration.id, declaration.parameters.map(site => site.name)]));
	const sources = model.sourceIdentity.modules.map(item => `${q(item.module)} => ${q(item.source.sha256)}`).join(", ");
	const identityArgs = `${q(receipt.runtimeIdentity)}, { ${sources} }, ${q(model.component.id)}, ${q(receipt.nativeLibrary.sha256)}`;
	const pm = `${generated.valuesSource}
package ${moduleName};
use LeanBridge::Runtime;
use LeanBridge::Runtime::OwnedAssets;
use DynaLoader ();
use Cwd ();
use Config ();
use JSON::PP ();
our $VERSION = '0.001';
my $root = Cwd::abs_path(__FILE__); $root =~ s/\\.pm\\z//;
my $xs_sha256 = '${ownedPerlXsSeal}';
die "Install this owned Perl package before loading its XS\\n" unless $xs_sha256 =~ /\\A[0-9a-f]{64}\\z/;
LeanBridge::Runtime::_check_component(${identityArgs});
LeanBridge::Runtime::Platform::installed_abi(JSON::PP->new->decode(LeanBridge::Runtime::_read("$root/install-receipt.json")));
my $base = Cwd::abs_path(__FILE__); $base =~ s{\\Q${relative}.pm\\E\\z}{};
my $xs_path;
for my $directory ($base, @INC) {
  next if ref($directory);
  my $candidate = "$directory/auto/${relative}/${stem}.$Config::Config{dlext}";
  if (-f $candidate) { $xs_path = Cwd::abs_path($candidate); last; }
}
die "Cannot find the installed owned XS image\\n" unless defined $xs_path;
my $paths = LeanBridge::Runtime::OwnedAssets::load([
  { path => "$root/native/${gmpLibrary}", soname => '${gmpLibrary}', sha256 => ${q(gmpSha256)} },
  { path => "$root/native/${receipt.library}", soname => ${q(receipt.library)}, sha256 => ${q(receipt.nativeLibrary.sha256)} },
  { path => $xs_path, sha256 => $xs_sha256 }
]);
LeanBridge::Runtime::_record_component(${identityArgs});
my $library = DynaLoader::dl_load_file($paths->[-1], 0) or die DynaLoader::dl_error();
my $symbol = DynaLoader::dl_find_symbol($library, 'boot_${moduleName.replaceAll("::", "__")}') or die DynaLoader::dl_error();
my $bootstrap = DynaLoader::dl_install_xsub('${moduleName}::Runtime::_bootstrap', $symbol, $paths->[-1]);
$bootstrap->(__PACKAGE__, $VERSION);
sub CLONE_SKIP { 1 }
1;

__END__
=head1 NAME

${moduleName} - Generated owned Lean values and synchronous callbacks

=head1 API

${generated.functions.map(fn => `=head2 ${fn.publicName}\n\nCalls C<${declarations.get(fn.id)}> in the compiled Lean component.\n${fn.transfers?.length ? `\nConsumes resource leases in ${fn.transfers.map(index => `C<${parameters.get(fn.id)[index]}>`).join(", ")} at the Lean call boundary.\n` : ""}`).join("\n")}
=head1 VALUES AND OWNERSHIP

Records and variants use generated named-field classes. Arrays, Lists and
products use array references. None and Unit use undef; Some->new(undef) keeps
optional Unit distinct from None. Ok and Err preserve their result branches.
Nat and Int use Math::BigInt. Text retains Unicode and NUL; ByteArray uses octets.

Resources and Lean closures provide close, closed and retain. Retained results
own independent native references. Close is idempotent; finalization releases
unclosed owners. Closing an input during a call does not invalidate its active
borrow. Callback arguments expire on return unless explicitly retained.

${transferredInputs ? `Consuming arguments use ordinary Perl values. Validation and native snapshot
preparation happen before handoff. At the Lean call boundary, shared aliases and
sibling resources using the same result owner close together. Independent
retains survive. Retain callback borrows before transferring them. Two consuming
arguments cannot share a resource lease. Pre-handoff errors preserve ownership;
callback and result-conversion failures after handoff leave inputs consumed.

` : ""}Pass CODE references for synchronous callbacks. Signatures that require a typed
recovery value accept Runtime::Callback->new(code => ..., recovery => ...).
Perl exceptions retain their identity after native cleanup. Host callbacks
cannot escape their initiating call. Owners cannot be serialized or used by a
different process or interpreter thread.

=head1 INSTALLATION

The runtime dependency is installed with this package. A compatible prebuilt XS
image needs no compiler. Otherwise installation compiles the supplied XS and C
adapter with local Perl headers. Lean, Lake and Node are not required.

=cut
`;
	const owned = { schemaVersion: transferredInputs ? 2 : 1, prefix, gmpLibrary
		, ...transferredInputs ? { inputTransfers: { ...model.ownedGraph.inputTransfers
			, arguments: "ordinary-values", aliases: "shared-lease"
			, borrowedInputs: "reject"
			, independentRetains: "preserved" } } : {}
		, componentLibrary: receipt.library
		, bindingIrSha256: model.bindingIrSha256
		, publicHeaderSha256: sha256(c.publicHeader)
		, publicSourceSha256: sha256(c.source) };
	const files = { ...Object.fromEntries(Object.entries(c.files).map(([path, source]) => [`owned/${path}`, source]))
		, "Component.xs": `#include "owned/src/${prefix}.c"\n#include "runtime.h"\n${generated.declarations}\n${generated.xs}`
		, [`lib/${relative}.pm`]: pm
		, "binding-manifest.json": canonicalJson({
			schemaVersion: transferredInputs ? 2 : 1, backend: "perl"
			, profile: "native-library-v1", owned
			, runtimeIdentity: receipt.runtimeIdentity
			, publicModule: `lib/${relative}.pm` }) };
	return { generated, owned, files };
};
