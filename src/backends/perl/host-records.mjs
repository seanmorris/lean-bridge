/** @file Project compiler-checked record fields into private XS and public Perl methods. */
import {perlHostCarrier} from "./host-native-members.mjs";

const publicName = s => s.replace(/([A-Z]+)([A-Z][a-z])/gu, "$1_$2").replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
const reserved = new Set(["close", "new", "destroy", "autoload", "clone", "clone_skip", "import", "unimport", "isa", "can", "does", "version"]);

/**
 * Emit one class token for each distinct structure, not for every use site.
 * No generated record constructor accepts a native pointer or a field array.
 *
 * @param entries - Reconciled Lean declarations, including their actual field projections.
 * @param types - Admitted application-hosted nominal classes.
 * @param name - Namespace of the installed CPAN component.
 */
export const perlHostRecords = (entries, types, name) => {
	const schemas = new Map(), names = new Set(["Failure", "IOError", "EIOError", "Error", "Returned", "Ok", "Err", "Runtime", "_HostMembers"]);
	const declarations = [], methods = [];
	for(const e of entries) for(const t of [e.result, ...e.parameters.map(p => p.type)])
	{
		if(t.kind !== "host-record") continue;
		const existing = schemas.get(t.declaration);
		if(existing)
		{
			if(JSON.stringify(existing.fields) !== JSON.stringify(t.fields) || existing.constructor !== t.constructor)
				throw new TypeError("Inconsistent Perl host record fields");
			continue;
		}
		const leaf = t.declaration.split(".").at(-1), cls = name + "::" + leaf;
		if(!/^[A-Z][A-Za-z0-9_]*$/u.test(leaf) || names.has(leaf)) throw new TypeError("Colliding Perl host record class: " + leaf);
		names.add(leaf);
		const index = schemas.size, symbol = "phr_t" + index, fieldNames = new Set(reserved);
		if(!t.fields.length || t.fields.length > 64) throw new TypeError("Invalid Perl host record arity");
		const fields = t.fields.map(f => {
			const label = publicName(f.name);
			if(!/^[a-z][a-z0-9_]*$/u.test(label) || fieldNames.has(label)) throw new TypeError("Colliding Perl host record field: " + label);
			fieldNames.add(label);
			return {label, tag: perlHostCarrier(types, f.type).tag};
		});
		schemas.set(t.declaration, {symbol, fields: t.fields, constructor: t.constructor});
		declarations.push("static const int " + symbol + "_tags[]={" + fields.map(f => f.tag).join(",") + "};"
			, "static phr_type " + symbol + "={" + JSON.stringify(cls) + "," + fields.length + "," + symbol + "_tags,{0}};");
		methods.push("MODULE = " + name + "    PACKAGE = " + cls + "\n\nvoid\nnew(class, ...)\n    SV *class\n  PPCODE:"
			+ "\n    if (items!=" + (fields.length+1) + ") croak(\"wrong Perl host record arity\");"
			+ "\n    SV *out=sv_2mortal(newSV(0)); ENTER; SAVETMPS;"
			+ "\n    SV *a[" + fields.length + "]; for (unsigned i=0;i<" + fields.length + ";i++) a[i]=sv_2mortal(SvREFCNT_inc(ST(i+1)));"
			+ "\n    sv_setsv(out,phr_construct(aTHX_ &" + symbol + ",class,a)); FREETMPS; LEAVE; SPAGAIN; SP=PL_stack_base+ax-1; XPUSHs(out);\n\n"
			+ "void\nclose(self)\n    SV *self\n  PPCODE:\n    phr_close(aTHX_ &" + symbol + ",self); XSRETURN_EMPTY;\n"
			+ fields.map((f,i) => "\nvoid\n" + f.label + "(self)\n    SV *self\n  PPCODE:\n    SV *out=sv_2mortal(newSV(0)); ENTER; SAVETMPS; sv_setsv(out,phr_get(aTHX_ &" + symbol + ",self," + i + ")); FREETMPS; LEAVE; SPAGAIN; SP=PL_stack_base+ax-1; XPUSHs(out);\n").join(""));
	}
	return {schemas, header: schemas.size ? '#include "host-records.h"\n' + declarations.join("\n") + "\n" : "", xs: methods.join("\n")};
};
