/**
 * Generate ordinary Perl XS functions over the authenticated synchronous IO wire.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { reconcileHostExports } from "../../analyze/host-export-model.mjs";
import { generateSyncWire } from "../c/sync-wire.mjs";
import { perlStringLiteral as q, projectPerlNames } from "./naming.mjs";
import { perlTaskAssets, taskDeclarations, taskModules, taskXs } from "./task-xs.mjs";
import { retainedArguments } from "./retained-xs.mjs";
import { heapResourceIdentities } from "../../analyze/heap-resource-identity.mjs";
import { perlLeaseModules, perlLeaseXs, perlResourceKinds } from "./io-resources.mjs";

const digest = s => /^[a-f0-9]{64}$/u.test(s);
const libraryFor = name => "liblbc_perl_" + sha256(name) + ".so";
const types = new Set("unit bool uint8 uint16 uint32 uint64 usize int8 int16 int32 int64 isize char string bytes float32 float64 nat int".split(" "));
const shape = t => {
	if(t?.kind === "primitive" && types.has(t.name)) return t.name;
	if(t?.kind === "apply" && t.constructor === "result" && t.arguments.length === 2) return t.arguments.map(shape);
	throw new TypeError("Unsupported synchronous Perl IO type");
};
const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const certified = (name, api, evidence) => {
	const tasks=!evidence.selection?.synchronousIO && Boolean(evidence.selection?.taskExports?.length || evidence.selection?.asyncIterators?.length);
	if((!evidence.selection?.synchronousIO && !tasks) || !digest(evidence.compilerSha256) || !digest(evidence.extractorSha256)
		|| !digest(evidence.sourceTreeSha256) || !digest(evidence.configurationSha256) || !evidence.interfaces?.length
		|| evidence.hostImportsSourceSha256 !== null) throw new TypeError("Missing standalone Perl IO elaboration");
	const resources=evidence.metadata.leanResources??[];
	const owned=resources.length?heapResourceIdentities({...evidence,resources}):[];
	const reviewed = reconcileHostExports({ ...evidence, owned, component: api.component, ir: null, review: { source: canonicalJson(api) } });
	if(!same(reviewed.api,api)) throw new TypeError("Perl IO API differs from source evidence");
	return generateSyncWire("lbc_perl_" + sha256(name),reviewed.entries,{ tasks, resources: api.types.filter(t=>t.kind==="resource") });
};
const hook = (source, needle, replacement) => {
	if(source.split(needle).length !== 2) throw new TypeError("Missing or ambiguous CPAN installer hook");
	return source.replace(needle, () => replacement);
};

/**
 * Validate CPAN coordinates before compiling anything.
 *
 * @param settings - Public Perl namespace and decimal distribution version.
 * @param settings.name - Namespace loaded by the downstream Perl application.
 * @param settings.version - Decimal version used by the distribution and its module.
 */
export const validatePerlIOSettings = ({ name, version }) => {
	projectPerlNames(name, []);
	if(!/^\d+\.\d{3}(?:_\d{2})?$/u.test(version)) throw new TypeError("CPAN version must use Perl decimal version syntax");
};

/**
 * Specialize only the component installer; the shared runtime archive stays unchanged.
 *
 * @param base - Standard installer.
 * @param name - Validated Perl namespace.
 * @param library - Exact component SONAME.
 * @param tasks - Install the Perl event-loop dependency only for task/cursor packages.
 * @param ledger - Optional source-addressed resource library linked by the XS.
 * @param hosts - Select the synchronous host-import manifest field.
 */
export const renderPerlIOBuild = (base, name, library, tasks = false, ledger = null, hosts = false) => {
	projectPerlNames(name, []); if(library !== libraryFor(name)) throw new TypeError("Invalid CPAN IO library");
	const dir = name.replaceAll("::", "/"), tag = "my @link_flags = ('-Wl,--build-id=none');";
	if(ledger && (!digest(ledger.id) || ledger.library !== "liblb_task_resources_"+ledger.id+".so" || !digest(ledger.sha256)))
		throw new TypeError("Invalid CPAN resource ledger library");
	let s = hook(base, tag, tag + `\n  push @link_flags, '-L', 'lib/${dir}/native', '-l:${library}'${ledger && !hosts?", '-l:"+ledger.library+"'":""};`);
	if(hosts && (tasks!==Boolean(ledger))) throw new TypeError("Ambiguous Perl host installer");
	const field = hosts ? "hostImports" : tasks ? "taskDelivery" : "syncIO";
	s = hook(s, "if owned_values($manifest);", "if $manifest->{"+field+"};");
	s = hook(s, "return unless owned_values($manifest);", "return unless $manifest->{"+field+"};");
	return tasks ? hook(s,"PREREQ_PM => { 'Math::BigInt'","PREREQ_PM => { 'IO::Async::Loop' => '0.805', 'Future' => '0.54', 'Math::BigInt'") : s;
};
const input = (type, i) => {
	const v = "v" + i, a = "a+" + 3*i, x = "a[" + 3*i + "]", args = "aTHX_ " + v;
	if(type === "unit") return `lbp_plain(${args}); if (SvOK(${v})) croak("Unit requires undef");`;
	if(type === "bool") return `lbp_plain(${args}); if (!SvIsBOOL(${v})) croak("Bool requires a native boolean"); ${x} = SvTRUE(${v}) ? 1 : 0;`;
	if(["char", "string", "bytes"].includes(type)) return `lbs_text(${args},${a},${+(type !== "bytes")},${+(type === "char")});`;
	if(type === "float32" || type === "float64") return `lbs_float(${args},${a},${+(type === "float32")});`;
	if(type === "int" || type === "nat") return `lbs_integer(${args},${a},${+(type === "nat")});`;
	const b = type.endsWith("size") ? "64" : type.match(/\d+/u)[0];
	return type.startsWith("u") ? `${x} = lbp_unsigned(${args},UINT${b}_MAX);` : `${x} = (uint64_t)lbp_signed(${args},INT${b}_MIN,INT${b}_MAX);`;
};
const value = (t, ns, i = 0) => {
	if(Array.isArray(t)) return `(tags[${i}] == 1 ? lbp_branch(aTHX_ "${ns}::Ok",${value(t[0],ns,i+1)}) : tags[${i}] == 0 ? lbp_branch(aTHX_ "${ns}::Err",${value(t[1],ns,i+1)}) : (croak("Invalid native Except tag"),&PL_sv_undef))`;
	if(t === "unit") return "&PL_sv_undef";
	if(t === "bool") return "boolSV(out[0] != 0)";
	if(t === "char") return "lbs_char(aTHX_ out[0])";
	if(t === "float32" || t === "float64") return `lbs_nv(aTHX_ out,${+(t === "float32")})`;
	if(t === "int" || t === "nat") return `lbs_wide(aTHX_ out,${+(t === "nat")})`;
	if(t === "string" || t === "bytes") return `lbs_bytes(aTHX_ out,${+(t === "string")})`;
	const b = t.endsWith("size") ? "64" : t.match(/\d+/u)[0];
	return t.startsWith("u") ? "sv_2mortal(newSVuv(out[0]))" : `sv_2mortal(newSViv((int${b}_t)out[0]))`;
};
/** Use the same copied scalar conversions for standalone and class-bearing workers. */
export const perlWorkerScalarCodecs = () => ({input,value});
const verify = (api, wire, ns, kinds) => {
	const methods = projectPerlNames(ns, wire.methods);
	const stem = "lbwire_lbc_perl_" + sha256(ns) + "_v1";
	if(wire.clear !== stem + "_clear" || !methods.length || api.declarations.length !== methods.length) throw new TypeError("Invalid CPAN IO wire");
	const byId=new Map([...kinds.values()].map(r=>[r.id,r.wire]));
	const type=t=>byId.get(t?.id)??shape(t);
	const site=(p,raw,argument)=>{
		const expected=byId.get(p?.type?.id);
		if(!expected) return !kinds.has(raw);
		return raw===expected && p.ownership===(argument?"borrow":"lease") && p.lifetime?.scope===(argument?"call":"explicit") && p.lifetime.anchor===null;
	};
	for(const [i,m] of methods.entries())
	{
		const d = api.declarations.find(d => d.name === m.name), e = m.effect;
		const ids = e === "IO" ? ["error:IO.Error"] : e === "EIO" ? ["error:EIO." + m.declaration] : [];
		const a = api.errors.find(x => x.id === ids[0]);
		const mode = m.delivery === "task" ? "promise" : m.delivery === "async-iterator" ? "async-iterator" : "value";
		const step = m.stepDeclaration ? api.errors.find(x => x.id === "error:AsyncStep."+m.declaration) : null;
		const taskIO = d?.source.extensions["lean-bridge.dev/task-failure"] === "IO.Error";
		const retained = Boolean(m.callbacks?.length), hostError = "error:PerlHostException";
		if(retained && e === "IO") ids.push(hostError);
		if(taskIO) ids.push("error:TaskIO.Error");
		if(retained && taskIO && !ids.includes(hostError)) ids.push(hostError);
		if(step) ids.push(step.id);
		const depth = t => Array.isArray(t) ? 1 + Math.max(...t.map(depth)) : 0;
		if(!d || d.source.declaration !== m.declaration || !/^[a-z][a-z0-9_]*$/u.test(m.name) || m.name !== m.publicName
			|| ["import", "unimport", "isa", "can", "version", "does"].includes(m.name) || m.symbol !== stem + "_" + i
			|| !["pure", "IO", "BaseIO", "EIO"].includes(e) || d.source.extensions["lean-lang.org/effect"] !== e || d.resultMode !== mode
			|| !same(d.failure.errors, ids) || !same(retained ? retainedArguments(api,d,m,type) : d.parameters.map(p => type(p.type)), m.args) || m.args.some(Array.isArray)
			|| !m.args.every((raw,j)=>site(d.parameters[j],raw,true)) || !site(d.result,m.result,false)
			|| !same(type(d.result.type), m.result) || !same(e === "EIO" ? type(a?.payload) : e === "IO" && !retained ? "string" : null, m.error)
			|| m.tagBytes !== Math.max(1,depth(m.result),depth(m.error),depth(m.terminal))
			|| (m.delivery && !wire.wait)
			|| (retained ? m.delivery !== "task" || m.stepDeclaration !== undefined || m.terminal !== undefined
				: m.delivery && (!same(m.terminal,step ? type(step.payload) : taskIO ? "string" : null)
					|| m.stepDeclaration !== d.source.extensions["lean-bridge.dev/pull-protocol"]?.next)))
			throw new TypeError("CPAN IO wire differs from elaborated declaration: " + m.name);
	}
	return methods;
};
const xs = (m, ns, input, value) => {
	const args = m.args.map((_,i) => "v" + i);
	const errorClass = m.effect === "EIO" ? "Error::" + m.name : "IOError";
	const failure = m.error ? `\n    if (status == ${m.effect === "EIO" ? 3 : 4}) croak_sv(lbs_failure(aTHX_ "${ns}::${errorClass}",${JSON.stringify(m.declaration)},${value(m.error,ns)}));` : "";
	return `void
${m.name}(${args.join(", ")})
${args.map(a => "    SV *" + a + "\n").join("")}  PPCODE:
    lbp_check_interpreter(aTHX);
    ENTER; SAVETMPS;
    uint64_t a[${Math.max(1,m.args.length*3)}]={0}, *out;
    uint8_t tags[${m.tagBytes}]={0};
    Newxz(out,4,uint64_t); SAVEDESTRUCTOR_X(lbs_clear,out);
    ${m.args.map((t,i) => `if (SvGMAGICAL(v${i})) v${i} = sv_mortalcopy(v${i});\n    ${input(t,i)}`).join("\n    ")}
    int status=${m.symbol}(a,out,tags);${failure}
    if (status != 0) croak("Lean bridge failure in %s (status %d)",${JSON.stringify(m.declaration)},status);
    SV *ret=newSVsv(${value(m.result,ns)});
    FREETMPS; LEAVE; SPAGAIN; SP=PL_stack_base+ax-1;
    XPUSHs(sv_2mortal(ret));
`;
};
/**
 * Generate the common Perl exceptions and returned Except value classes.
 *
 * @param ns - Validated public Perl package name.
 * @param methods - Selected functions and their declared effects.
 */
export const perlEffectClasses = (ns, methods) => {
	const common = `package ${ns}::Failure;
sub declaration { $_[0]->{declaration} }
sub payload { $_[0]->{payload} }
use overload '""' => sub { $_[0]->{declaration} . ': ' . ref($_[0]) }, fallback => 1;
package ${ns}::IOError;
our @ISA = ('${ns}::Failure');
sub message { $_[0]->payload }
package ${ns}::EIOError;
our @ISA = ('${ns}::Failure');
`;
	return common + methods.filter(m => m.effect === "EIO").map(m => `package ${ns}::Error::${m.name}; our @ISA = ('${ns}::EIOError');`).join("\n")
		+ "\n" + ["Ok", "Err"].map(k => `package ${ns}::${k};
sub new { die "Expected one payload\\n" unless @_ == 2; bless {value => $_[1]}, $_[0] }
sub value { $_[0]->{value} }`).join("\n");
};

const loader = (name, version, runtimeVersion, runtime, lib, libHash, api, evidence, methods, assets, kinds, ledger, hosts="") => {
	const relative = name.replaceAll("::","/"), stem = name.split("::").at(-1);
	const sources = evidence.interfaces.map(i => {
		if(!digest(i.sourceSha256)) throw new TypeError("Unverified Perl component source");
		return q(i.module) + " => " + q(i.sourceSha256);
	}).join(", ");
	const args = `${q(runtime)}, { ${sources} }, ${q(api.component.id)}, ${q(libHash)}`;
	return `${hosts}${perlEffectClasses(name,methods)}${perlLeaseModules(kinds,name)}${assets ? "\n"+taskModules(name,methods,assets) : ""}
package ${name};
use strict;
use warnings;
use LeanBridge::Runtime;
die "Incompatible shared Lean runtime package version\\n" unless $LeanBridge::Runtime::VERSION eq '${runtimeVersion}';
use LeanBridge::Runtime::OwnedAssets;
use DynaLoader ();
use Cwd ();
use Config ();
use JSON::PP ();
our $VERSION = '${version}';
my $root = Cwd::abs_path(__FILE__); $root =~ s/\\.pm\\z//;
LeanBridge::Runtime::_check_component(${args});
LeanBridge::Runtime::Platform::installed_abi(JSON::PP->new->decode(LeanBridge::Runtime::_read("$root/install-receipt.json")));
my $base = Cwd::abs_path(__FILE__); $base =~ s{\\Q${relative}.pm\\E\\z}{};
my $xs;
for my $dir ($base,@INC) {
  next if ref($dir);
  my $candidate = "$dir/auto/${relative}/${stem}.$Config::Config{dlext}";
  if (-f $candidate) { $xs = Cwd::abs_path($candidate); last; }
}
die "Cannot locate installed Perl IO XS\\n" unless defined $xs;
my $paths = LeanBridge::Runtime::OwnedAssets::load([${ledger?`\n  { path => "$root/native/${ledger.library}", soname => '${ledger.library}', sha256 => '${ledger.sha256}' },`:""}
  { path => "$root/native/${lib}", soname => '${lib}', sha256 => '${libHash}' },
  { path => $xs, sha256 => '__LEAN_BRIDGE_OWNED_XS_SHA256__' }
]);
my $image = DynaLoader::dl_load_file($paths->[-1],0) or die DynaLoader::dl_error();
my $boot = DynaLoader::dl_find_symbol($image,'boot_${name.replaceAll("::","__")}') or die DynaLoader::dl_error();
my $call = DynaLoader::dl_install_xsub('${name}::_bootstrap',$boot,$paths->[-1]);
$call->(__PACKAGE__,$VERSION);
LeanBridge::Runtime::_record_component(${args});
sub true () { !!1 }
sub false () { !!0 }
sub CLONE_SKIP { 1 }
1;

__END__
=head1 NAME

${name} - ${assets || methods.some(m=>m.delivery) ? "Compiled Lean futures and demand-driven cursors" : "Compiled synchronous Lean functions"}

=head1 CALLS${hosts?"\n\nRegister the declared host classes with C<with_hosts(\\%classes, sub { ... })>. Call the exported functions inside that block. The binding closes on return or exception.":""}

${methods.map(m => `=head2 ${m.name}\n\nCalls C<${m.declaration}> (${m.effect}).${m.delivery==="task"?" Returns a Future.":m.delivery==="async-iterator"?" Returns a cursor; next yields a Future with one item or an empty list at end.":""}`).join("\n\n")}

An EIO failure dies with the declaration-specific exception; use C<payload>
to read the typed value. IO failures provide C<message>. A returned Except
is an Ok or Err object with a C<value> method, not an exception.

=cut
`;
};

/**
 * Load the pinned shared runtime, component and installed XS before exposing host calls.
 *
 * @param o - Compiler-derived entries, sources and package coordinates.
 * @param pins - Exact CPAN runtime version and binding identity.
 */
export const renderPerlHostLoader = (o,pins) => loader(o.name,o.version,pins.runtimeVersion,pins.runtimeIdentity,o.library,o.librarySha256,
	o.api,o.evidence,o.entries,null,new Map(),o.resourceLedger??null,o.generated.implementation);

const xsSource = (wire, methods, name, kinds) => {
	const encode=(t,i)=>kinds.has(t)?`lbs_in_${kinds.get(t).index}(aTHX_ v${i},a+${i*3});`:input(t,i);
	const decode=(t,ns)=>kinds.has(t)?`lbs_out_${kinds.get(t).index}(aTHX_ out)`:value(t,ns);
	return `#include "sync-wire.h"
extern void ${wire.clear}(uint64_t *);
static void lbs_clear(pTHX_ void *frame) { ${wire.clear}((uint64_t *)frame); Safefree(frame); }${kinds.size?"\n"+perlLeaseXs(kinds,name):""}
${methods.filter(m=>!m.delivery).map(m => `extern int ${m.symbol}(const uint64_t *, uint64_t *, uint8_t *);`).join("\n")}${wire.wait?"\n"+taskDeclarations(wire):""}

MODULE = ${name}    PACKAGE = ${name}
PROTOTYPES: DISABLE

${methods.map((m,i) => m.delivery ? taskXs(m,name,i,encode,decode) : xs(m,name,encode,decode)).join("\n")}`;
};

/**
 * Produce Perl source and a build receipt from an already checked native component.
 *
 * @param o - Compiled source, binding IR, C wire and shared runtime.
 * @param pins - Prepared CPAN runtime coordinate and binding identity.
 */
export const preparePerlIOFiles = async (o, pins) => {
	const { api, wire, name, evidence } = o, { version, runtimeVersion, runtimeIdentity } = pins;
	validatePerlIOSettings({ name, version });
	const library = libraryFor(name), native = o.files.get("lib/" + library), relative = name.replaceAll("::","/");
	if(!native || "lib" + o.prefix + ".so" !== library || !digest(o.componentIdentity) || !digest(runtimeIdentity)
		|| hashBindingIr(api) !== o.bindingIrSha256 || !evidence.interfaces.length) throw new TypeError("Unverified compiled Perl IO component");
	if(!same(certified(name,api,evidence),wire)) throw new TypeError("Perl IO wire differs from the compiled signatures");
	const resourceLib=wire.leases?.length && digest(o.ledgerId) ? "liblb_task_resources_"+o.ledgerId+".so" : null;
	const resourceBytes=resourceLib && o.files.get("lib/"+resourceLib);
	if(Boolean(wire.leases?.length)!==Boolean(resourceBytes)) throw new TypeError("Missing Perl resource ledger");
	const ledger=resourceBytes?{id: o.ledgerId, library: resourceLib, sha256: sha256(resourceBytes)}:null;
	const kinds=perlResourceKinds(api,wire,evidence,ledger), methods = verify(api,wire,name,kinds), librarySha256 = sha256(native);
	const assets = wire.wait ? await perlTaskAssets() : null;
	const contract = { schemaVersion: 1
		, profile: wire.wait ? "native-perl-task-v1" : "native-perl-io-v1"
		, component: api.component, componentIdentity: o.componentIdentity
		, bindingIrSha256: o.bindingIrSha256
		, elaborationSha256: sha256(canonicalJson(evidence))
		, library, librarySha256, ...ledger?{resourceLedger: ledger}:{} };
	const files = new Map([["Component.xs", xsSource(wire,methods,name,kinds)]
		, ["sync-wire.h", await readFile(new URL("./sync-wire.h", import.meta.url))]
		, ["lib/" + relative + ".pm", loader(name, version, runtimeVersion, runtimeIdentity, library, librarySha256, api, evidence, methods, assets,kinds,ledger)]
		, ["lib/" + relative + "/native/" + library, native]
		, ["binding-ir.json", canonicalJson(api)]
		, ["elaboration.json", canonicalJson(evidence)]
		, ["binding-manifest.json", canonicalJson(contract)]]);
	if(assets) files.set("task-wire.h",assets.header);
	if(ledger) files.set("lib/"+relative+"/native/"+ledger.library,resourceBytes);
	return { files, contract };
};

/**
 * Check the original package, including the component-specific installer, before archiving.
 *
 * @param manifest - CPAN distribution inventory.
 * @param files - Hash-verified package bytes.
 * @param base - Original shared build template.
 * @param header - Original checked Perl scalar conversion header.
 * @param assets - Original task-specific sources, absent for synchronous packages.
 */
export const verifyPerlIOFiles = (manifest, files, base, header, assets = null) => {
	const s = manifest.taskDelivery ?? manifest.syncIO, ns = manifest.module;
	const bytes = p => { const b = files.get(p); if(!b) throw new TypeError("Missing Perl IO payload: " + p); return b; };
	const api = JSON.parse(bytes("binding-ir.json")), elaboration = bytes("elaboration.json");
	if(manifest.ownedValues || Boolean(manifest.taskDelivery) !== Boolean(assets) || s.schemaVersion !== 1 || s.profile !== (assets ? "native-perl-task-v1" : "native-perl-io-v1") || !same(s,JSON.parse(bytes("binding-manifest.json")))
		|| !same(s.component,api.component) || !digest(s.componentIdentity) || s.bindingIrSha256 !== hashBindingIr(api)
		|| s.elaborationSha256 !== sha256(elaboration) || s.library !== libraryFor(ns)
		|| s.librarySha256 !== sha256(bytes("lib/" + ns.replaceAll("::","/") + "/native/" + s.library))
		|| !bytes("sync-wire.h").equals(header) || (assets && !bytes("task-wire.h").equals(assets.header))
		|| bytes("LeanBridgeBuild.pm").toString() !== renderPerlIOBuild(base,ns,s.library,Boolean(assets),s.resourceLedger))
		throw new TypeError("Standalone Perl IO payload differs from its compiled interface or installer");
	const evidence = JSON.parse(elaboration), wire = certified(ns,api,evidence), ledger=s.resourceLedger;
	const kinds=perlResourceKinds(api,wire,evidence,ledger), methods = verify(api,wire,ns,kinds);
	if(Boolean(kinds.size)!==Boolean(ledger) || (ledger && sha256(bytes("lib/"+ns.replaceAll("::","/")+"/native/"+ledger.library))!==ledger.sha256)
		|| Boolean(wire.wait)!==Boolean(assets) || bytes("Component.xs").toString() !== xsSource(wire,methods,ns,kinds)
		|| bytes("lib/" + ns.replaceAll("::","/") + ".pm").toString() !== loader(ns,manifest.version,manifest.runtimeVersion,manifest.runtimeIdentity,s.library,s.librarySha256,api,evidence,methods,assets,kinds,ledger))
		throw new TypeError("Generated CPAN IO source differs from the compiled declarations");
};
