/**
 * Independent public calls with observations of the actual shared Wasm heap.
 *
 * @file
 */

/**
 * Keep both import orders and simultaneous loading in the same consumer source.
 * Instrument instantiation before importing either package; never replace bytes.
 *
 * @param ownedName - Installed ownership-aware package name.
 * @param copiedName - Installed copied-value package name.
 */
export const coexistingNpmProbe = (ownedName, copiedName) => `const heaps = new Map();
const observe = result => {
  const instance = result.instance ?? result;
  if(instance.exports?.memory instanceof WebAssembly.Memory)
    heaps.set(instance.exports.memory, instance.exports);
  return result;
};
for(const name of ["instantiate", "instantiateStreaming"]) {
  const original = WebAssembly[name];
  if(original) WebAssembly[name] = async (...args) => observe(await original.apply(WebAssembly, args));
}
const check = (condition, message) => { if(!condition) throw new Error(message); };
const readStats = () => {
  check(heaps.size === 1, "Consumers must share exactly one instantiated memory");
  const exports = [...heaps.values()][0];
  return {heaps: heaps.size, initializations: exports.bridge_lean_runtime_init_runs(),
    libraries: exports.bridge_lean_library_init_runs(), components: exports.bridge_owned_runtime_components(),
    identities: exports.bridge_owned_runtime_identities(), state: exports.bridge_lean_runtime_status()};
};
let opening, selected;
export const open = order => {
  if(opening) {check(order === selected, "Cannot change order in a live realm");return opening;}
  selected=order;
  return opening=(async()=>{
    let owned,copied;
    const loadOwned=async()=>owned=await import(${JSON.stringify(ownedName)});
    const loadCopied=async()=>copied=await import(${JSON.stringify(copiedName)});
    if(order === "owned-first") {await loadOwned();await loadCopied();}
    else if(order === "copied-first") {await loadCopied();await loadOwned();}
    else {check(order === "concurrent", "Unknown order");await Promise.all([loadOwned(),loadCopied()]);}
    check(await import(${JSON.stringify(ownedName)}) === owned,"Owned import must deduplicate");
    check(await import(${JSON.stringify(copiedName)}) === copied,"Copied import must deduplicate");
    const expectStats = components => {
      const stats=readStats();
      check(stats.initializations===1 && stats.libraries===2 && stats.components===components
        && stats.identities===0 && stats.state===2,"Invalid shared lifecycle: "+JSON.stringify(stats));
      return stats;
    };
    expectStats(1);
    const none={tag:"none"}, some=value=>({tag:"some",value});
    const run = () => {
      let checks=0;
      const verify=(condition,message)=>{checks++;check(condition,message);};
      const rejects=call=>{let failed=false;try{call();}catch{failed=true;}verify(failed,"Invalid input was accepted");};
      for(const [index,value] of [none,some(none),some(some(undefined))].entries()) {
        verify(copied.classify(value)===index,"Nested Option constructor changed");
        verify(copied.classify(copied.next(value))===(index+1)%3,"Copied computation failed");
      }
      const ticket=owned.newTicket(1n<<120n,"coexist\\0🙂");
      verify(owned.serial(ticket)===1n<<120n,"Owned Nat changed");
      verify(owned.label(ticket)==="coexist\\0🙂","Owned string changed");
      const bundle={primary:ticket,spare:some(ticket),peers:[ticket],history:[ticket],
        payload:{count:-(1n<<180n),bytes:new Uint8Array([0,255])}};
      verify(owned.echoRecord(bundle).primary===ticket,"Resource identity changed");
      const packet={choice:some({ok:[1n<<180n,undefined]}),products:[[42,"copied\\0🙂"],[true,"🌱"]],
        rows:[some({error:[new Uint8Array([0,255]),-(1n<<160n)]})],nested:{error:some(1n<<140n)}};
      const transformed=copied.transform(packet);
      verify(transformed.choice.value.ok[0]===(1n<<180n)+1n && transformed.products[0][0]===43
        && transformed.products[0][1]==="copied\\0🙂!" && !transformed.products[1][0],"Copied record computation failed");
      transformed.rows[0].value.error[0][0]=99;
      verify(packet.rows[0].value.error[0][0]===0,"Copied storage aliases caller input");
      let borrowed,retained;
      const callbackResult=owned.callbackRecord(bundle,value=>{
        borrowed=value.primary;retained=borrowed.retain();
        verify(copied.classify(copied.next(none))===1,"Cross-package callback call failed");
        verify(owned.serial(borrowed)===1n<<120n,"Nested owned reentry failed");return value;
      });
      verify(callbackResult.primary===ticket && borrowed.disposed && owned.serial(retained)===1n<<120n,"Callback borrow lifetime changed");
      retained.dispose();
      const closure=owned.dispatch(bundle);
      verify(closure(value=>{
        verify(copied.transform(packet).products[0][0]===43,"Copied call inside returned closure failed");return value;
      }).primary===ticket,"Returned closure lost its resource");
      closure.dispose();
      const expected=new Error("cross-package callback");let failure;
      try{owned.callbackRecord(bundle,()=>{copied.transform(packet);throw expected;});}catch(error){failure=error;}
      verify(failure===expected,"Original callback exception changed");
      rejects(()=>owned.serial({...ticket}));rejects(()=>copied.classify({tag:"some"}));
      verify(owned.serial(ticket)===1n<<120n && copied.classify(none)===0,"Input failures poisoned valid calls");
      const bytes=new Uint8Array([0,255]);const duplicated=copied.duplicate(some(bytes));
      duplicated.ok.value[0][0]=7;
      verify(duplicated.ok.value[1][0]===0 && bytes[0]===0,"Copied result storage aliases");
      ticket.dispose();verify(ticket.disposed && closure.disposed,"Explicit disposal failed");
      return {order,checks,stats:expectStats(1)};
    };
    const close=()=>{
      check(owned.close()===true && owned.close()===false,"Component close was not idempotent");
      check(copied.classify(copied.next(none))===1,"Closing owned API retired copied API");
      return expectStats(0);
    };
    const retire=()=>{
      const ticket=owned.newTicket(7n,"retirement");
      [...heaps.values()][0].lean_bridge_native_runtime_retire();
      for(const call of [()=>owned.serial(ticket),()=>copied.classify(none)]) {
        let error;try{call();}catch(value){error=value;}
        check(error instanceof Error && /retired|poisoned/.test(error.message),"Retired heap accepted a public call");
      }
      const stats=readStats();check(stats.state===3,"Heap did not retire");return stats;
    };
    return {run,close,retire};
  })();
};
`;
