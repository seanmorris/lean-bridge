/** @file Lower a retained callable to a nominal, single-reply WIT request. */
import { witVariantMember } from "./copied-variants.mjs";

/**
 * A worker cannot enter the Wasmtime store. Poll yields one owned request to
 * its owner; reading borrows it, replying or failing consumes it. A late reply
 * cannot be confused with the next invocation of the same callable.
 *
 * @param opts - Reconciled source parameter, type constructors and fresh nominal index.
 */
export const witTaskCallbackRequest = opts => {
	const {slot,parameter,type,label,index,scope,scalar,handle,field,sig,fail}=opts;
	const cb=type?.callable;
	if(type?.kind!=="callback" || type.source.extensions?.["lean-bridge.dev/callback-scheduler"]!=="wasmtime-store-owner"
		|| parameter.ownership!=="lease" || parameter.lifetime?.scope!=="explicit" || parameter.lifetime.anchor!==null
		|| cb?.invocation!=="many" || cb.reentry!=="same-agent" || cb.selfDisposal!=="defer" || cb.resultMode!=="value"
		|| cb.parameters.length!==1 || cb.parameters[0].ownership!=="copy" || cb.result.ownership!=="copy"
		|| cb.failure.mode!=="declared" || cb.failure.unexpected!=="poison-runtime"
		|| cb.failure.errors.length!==1 || cb.failure.errors[0]!=="error:WitCallbackError")
		fail("Invalid retained Wasmtime callback contract");
	const param=witVariantMember(parameter.name,scope,fail),witName="callback-"+label+"-p"+(slot+1);
	const resource={index,witName}, argument=scalar(cb.parameters[0].type),reply=scalar(cb.result.type);
	const own=handle(resource,false),borrow=handle(resource,true);
	const fns=[
		sig("read-"+witName,[field("request",borrow)],argument)
		, sig("reply-"+witName,[field("request",own),field("value",reply)],opts.bool)
		, sig("fail-"+witName,[field("request",own),field("message",opts.text)],opts.bool)
	];
	const state={witName: "call-"+param,fields: [{type: own}],payload: own};
	const descriptor={slot,parameter: param,resource: witName,state: state.witName
		, arg: argument.scalarName,reply: reply.scalarName
		, read: fns[0].witName,resolve: fns[1].witName,reject: fns[2].witName};
	return {resource,functions: fns,state,descriptor};
};
