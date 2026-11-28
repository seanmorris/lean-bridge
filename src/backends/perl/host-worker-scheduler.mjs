/** @file Extend the native owner only in components with interpreter-scoped workers. */
import { readFile } from "node:fs/promises";
import { perlTaskAssets } from "./task-xs.mjs";

const replace=(s,from,to)=>{
	if(s.split(from).length!==2) throw new TypeError("Unexpected Perl worker template: "+from);
	return s.replace(from,()=>to);
};
/** Load the original task scheduler and add revocation to this component's XS owners. */
export const perlHostWorkerAssets=async ()=>{
	const assets=await perlTaskAssets();
	let h=assets.header.toString();
	h=replace(h,"typedef struct {","typedef struct lbs_owner {\n    struct lbs_owner *next, **link;");
	h=replace(h,"static void lbs_drop(lbs_owner *o) {",`static lbs_owner *phw_pending;
static int phw_accepting;
static void phw_track(pTHX_ lbs_owner *o) {
    if (!phw_accepting || o->link) croak("No active Perl worker binding");
    o->next=phw_pending; o->link=&phw_pending;
    if (o->next) o->next->link=&o->next;
    phw_pending=o;
}
static void lbs_drop(lbs_owner *o) {
    if (o->link) {
        *o->link=o->next; if (o->next) o->next->link=o->link;
        o->next=NULL; o->link=NULL;
    }`);
	h+="\nstatic void phw_retire_all(void) { phw_accepting=0; while (phw_pending) lbs_drop(phw_pending); }\n";
	return {...assets,header: Buffer.from(h),scopeModule: await readFile(new URL("./host-worker-scope.pm",import.meta.url),"utf8")};
};
