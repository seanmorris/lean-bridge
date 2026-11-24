/** @file Value layouts shared by the canonical WIT world, future writer and native hooks. */
const primitives={bool: ["bool","i32",1,"BOOL","boolean"]
	, char: ["char","i32",4,"CHAR","character"]
	, float32: ["f32","f32",4,"F32","f32"]
	, float64: ["f64","f64",8,"F64","f64"]};
for(const [lean,wit] of [["uint","u"],["int","s"]]) for(const bits of [8,16,32,64])
{
	const name=wit+bits;
	primitives[lean+bits]=[name,bits===64?"i64":"i32",bits/8,name.toUpperCase(),name];
}
export const canonicalString={wit: "string",wat: "string",flat: ["i32","i32"],size: 8,align: 4,dynamic: true,tag: "STRING"};
const alignTo=(n,a)=>Math.ceil(n/a)*a;
/**
 * Lay out the discriminant followed by the aligned active payload.
 *
 * @param ok - Success branch layout.
 * @param err - Failure branch layout.
 */
export const canonicalResult=(ok,err)=>{
	const align=Math.max(ok.align,err.align);
	return {wit: "result<"+ok.wit+", "+err.wit+">"
		, wat: "(result "+ok.wat+" (error "+err.wat+"))"
		, align
		, size: alignTo(align+Math.max(ok.size,err.size),align)
		, ok
		, err
		, dynamic: ok.dynamic||err.dynamic};
};
/**
 * Resolve a copied Binding IR type without narrowing its value.
 *
 * @param t - Compiler-authenticated type.
 */
export const canonicalValue=t=>{
	if(t?.kind==="apply" && t.constructor==="result" && t.arguments?.length===2) return canonicalResult(...t.arguments.map(canonicalValue));
	if(t?.kind==="primitive" && t.name==="string") return canonicalString;
	if(t?.kind!=="primitive" || !Object.hasOwn(primitives,t.name)) throw new TypeError("Unsupported copied canonical value");
	const [wat,core,size,tag,member]=primitives[t.name];return {wit: wat,wat,flat: [core],size,align: size,tag,member};
};
/**
 * Emit the C conversion into a Wasmtime value. Enclosing results own their children.
 *
 * @param shape - Canonical value layout.
 * @param source - Generated native C lvalue.
 * @param dest - Expression pointing at the SDK output.
 * @param depth - Nesting depth for disjoint local identifiers.
 */
export const canonicalEncode=(shape,source,dest,depth=0)=>{
	const child="branch"+depth;
	if(shape.ok) return `{ wasmtime_component_val_t *${child}=lb_child(${dest},${source}.ok);
        if (${source}.ok) { ${canonicalEncode(shape.ok,source+".as.value",child,depth+1)} }
        else { ${canonicalEncode(shape.err,source+".as.error",child,depth+1)} } }`;
	if(shape===canonicalString) return `(${dest})->kind=WASMTIME_COMPONENT_STRING;
        wasm_name_new(&(${dest})->of.string,${source}.len,${source}.len?(const char*)${source}.data:"");`;
	return `(${dest})->kind=WASMTIME_COMPONENT_${shape.tag}; (${dest})->of.${shape.member}=${source};`;
};
