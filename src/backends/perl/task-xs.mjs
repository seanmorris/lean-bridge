/**
 * Generate private XS operations and idiomatic public Perl futures and pull cursors.
 *
 * @file
 */
import { readFile } from "node:fs/promises";

/** Load the checked scheduler and opaque native handle templates for a task package. */
export const perlTaskAssets = async () => ({
	header: await readFile(new URL("./task-wire.h",import.meta.url))
	, driver: await readFile(new URL("./task-driver.pm",import.meta.url),"utf8")
});

/**
 * Declare the exact compiler-selected component symbols, never a public dispatch table.
 *
 * @param wire - Certified task wire and readiness operations.
 */
export const taskDeclarations = wire => {
	const methods=wire.methods.filter(m=>m.delivery);
	return `extern int ${wire.wait.open}(int,int,int *);
extern void ${wire.wait.close}(int *);
#define LBS_WAIT_OPEN ${wire.wait.open}
#define LBS_WAIT_CLOSE ${wire.wait.close}
#include "task-wire.h"
${methods.map(({names: n})=>`extern int ${n.start}(const uint64_t *,uint64_t *,uint64_t *,uint8_t *);
extern int ${n.poll}(uint64_t *,int *);
extern int ${n.take}(uint64_t *,uint64_t *,uint8_t *);
extern int ${n.close}(uint64_t *);${n.pull ? "\nextern int "+n.pull+"(uint64_t *);" : ""}`).join("\n")}`;
};
/**
 * Emit one private task/cursor implementation, retaining its native owner through conversion.
 *
 * @param m - Authenticated native declaration and error stages.
 * @param ns - Component namespace.
 * @param i - Local method identity used to authenticate an owner.
 * @param input - Generate one checked Perl input conversion.
 * @param value - Generate one Perl output conversion.
 */
export const taskXs = (m,ns,i,input,value) => {
	const args=m.args.map((_,i)=>"v"+i), stem="_lb_"+m.name, decl=JSON.stringify(m.declaration);
	const owner=`lbs_owner_for(aTHX_ token,${i})`;
	const startFailure = m.error ? `if (status==${m.effect==="EIO"?3:4}) croak_sv(lbs_failure(aTHX_ "${ns}::${m.effect==="EIO"?"Error::"+m.name:"IOError"}",${decl},${value(m.error,ns)}));` : "";
	const terminalFailure = m.terminal ? `if (status==${m.stepDeclaration?3:4}) croak_sv(lbs_failure(aTHX_ "${ns}::${m.stepDeclaration?"StepError::"+m.name:"TaskIOError"}",${JSON.stringify(m.stepDeclaration??m.declaration)},${value(m.terminal,ns)}));` : "";
	const reset="FREETMPS; LEAVE; SPAGAIN; SP=PL_stack_base+ax-1;";
	const buf=`uint8_t tags[${m.tagBytes}]={0}; uint64_t *out; Newxz(out,4,uint64_t); SAVEDESTRUCTOR_X(lbs_clear,out);`;
	return `void
${stem}_start(${args.join(", ")})
${args.map(a=>"    SV *"+a+"\n").join("")}  PPCODE:
    lbp_check_interpreter(aTHX); ENTER; SAVETMPS;
    uint64_t a[${Math.max(1,m.args.length*3)}]={0}; ${buf}
    ${m.args.map((t,k)=>`if (SvGMAGICAL(v${k})) v${k}=sv_mortalcopy(v${k});\n    ${input(t,k)}`).join("\n    ")}
    lbs_owner *o; SV *rv=lbs_new_owner(aTHX_ "${ns}::_Owner",${i},${m.names.close},&o);
    int status=${m.names.start}(a,o->handle,out,tags);
    ${startFailure}
    if (status || !o->handle[0]) croak("Lean bridge failure in %s (start status %d)",${decl},status);
    SV *ret=newSVsv(rv); ${reset} XPUSHs(sv_2mortal(ret));

void
${stem}_ready(token)
    SV *token
  PPCODE:
    lbs_owner *o=${owner}; XPUSHs(lbs_ready(aTHX_ o,${m.names.poll},${decl}));

void
${stem}_close(token)
    SV *token
  PPCODE:
    lbs_drop(${owner}); XSRETURN_EMPTY;
${m.names.pull?`
void
${stem}_pull(token)
    SV *token
  PPCODE:
    lbs_owner *o=${owner}; int status=${m.names.pull}(o->handle);
    if (status) croak("Lean bridge failure in %s (pull status %d)",${decl},status);
    XSRETURN_EMPTY;
`:""}
void
${stem}_take(token)
    SV *token
  PPCODE:
    lbs_owner *o=${owner}; ENTER; SAVETMPS; ${buf}
    LBS_WAIT_CLOSE(o->gate);
    int status=${m.names.take}(o->handle,out,tags);
    ${m.names.pull?`if (status==2) { ${reset} XSRETURN_EMPTY; }`:""}
    ${terminalFailure}
    if (status) croak("Lean bridge failure in %s (delivery status %d)",${decl},status);
    SV *ret=newSVsv(${value(m.result,ns)}); ${reset} XPUSHs(sv_2mortal(ret));
`;
};
/**
 * Bind each public function directly to its generated private methods on the application loop.
 *
 * @param ns - Component namespace.
 * @param methods - Certified declarations.
 * @param driver - Checked Perl event-loop source.
 */
export const taskModules = (ns,methods,driver) => {
	const functions=methods.filter(m=>m.delivery).map(m=>{
		const cursor=Boolean(m.names.pull), steps=["start",...cursor?["pull"]:[],"ready","take","close"];
		return `sub ${m.name} { return ${ns}::_Async::${cursor?"cursor":"task"}(${steps.map(s=>"\\&_lb_"+m.name+"_"+s).join(",")},\\@_) }`;
	});
	const errors=methods.filter(m=>m.stepDeclaration&&m.terminal).map(m=>`package ${ns}::StepError::${m.name}; our @ISA=('${ns}::EIOError');`);
	return `${driver.replaceAll("__LBNS__",ns)}
package ${ns}::TaskIOError; our @ISA=('${ns}::IOError');
${errors.join("\n")}
package ${ns};
${functions.join("\n")}
`;
};
