/**
 * Private Rust probes for callback result ownership and malformed native output.
 *
 * @file
 */

/**
 * Inspect retained owners before dereferencing callback result borrows.
 *
 * @param model - Rust projection compiled from the installed package's IR.
 */
export const rustRecursiveOwnershipTests = model => {
	const specimens = {
		array: 'vec![None, Some("a\\0λ🌿".into()), Some(String::new())]'
		, list: 'vec![Ok((u32::MAX,"a\\0λ🌿".into())),Err(String::new())]'
		, option: "Some(Some(()))"
		, result: 'Err(vec!["a\\0λ🌿".into(), String::new()])'
		, tuple: '("a\\0λ🌿".into(),(vec![0,255,128], BigUint::from(1u8)<<4097usize))'
		, record: 'crate::Payload {text:"a\\0λ🌿".into(),rows:vec![Some("nested".into())],count:BigUint::from(1u8)<<257usize,nested:Some(Err("inner".into()))}'
		, variant: 'crate::Packet::Payload {label:"a\\0λ🌿".into(),rows:vec![Some("nested".into())]}'
		, recursive: 'crate::Tree::Branch {children:vec![crate::Tree::Leaf {value:BigUint::from(1u8)<<257usize},crate::Tree::Branch {children:vec![]}]}'
	};
	specimens.alias = specimens.record;
	return "\n#[cfg(test)] mod recursive_ownership { use super::*;\n" + Object.entries(specimens).map(([shape, value]) => {
		const fn = model.functions.find(fn => fn.name === `call_${shape}`);
		const callback = fn.parameters[1].value, node = callback.result;
		return `#[test] fn ${shape}_retains_result_before_returning_to_c() {
    let expected: ${node.publicType} = ${value};
    let runtime = graph_runtime().unwrap(); callable_status(unsafe { (runtime.lifecycle.initialize)() }, runtime).unwrap();
    let mut host = |_: ${node.publicType}| -> Result<${node.publicType}, Error> { Ok(expected.clone()) };
    let state = CallbackState {scope: std::cell::RefCell::new(GraphScope::new(GraphBudget::new())), failure: std::cell::RefCell::new(None), runtime};
    let context = Context${callback.index} {function: std::cell::RefCell::new(&mut host), state:&state};
    let mut inputs = GraphScope::new(GraphBudget::new());
    let input = graph_to${node.index}(&expected, &mut inputs).unwrap();
    let mut output = ${node.raw}::default();
    assert_eq!(unsafe {callback${callback.index}((&context as *const Context${callback.index}<'_>).cast_mut().cast(), &input, &mut output)}, 0);
    state.finish().unwrap();
    // Inspect the retained Rust owner before dereferencing a potentially dangling C span.
    assert!(state.scope.borrow().owners.iter().any(|owner| owner.is::<GraphOwner<${node.publicType}>>()));
    assert_eq!(unsafe {graph_from${node.index}(&output, 0, true, true, &mut GraphScope::new(GraphBudget::new()))}.unwrap(), expected);
    drop(inputs); drop(state); assert_eq!(GRAPH_LIVE.get(),0);
}`;
	}).join("\n") + "\n}\n";
};

/**
 * Verify output cleanup and permanent retirement using an owned real closure.
 *
 * @param model - Rust projection compiled from the installed package's IR.
 */
export const rustRecursivePoisonTests = model => {
	const callback = model.functions.find(fn => fn.name === "make_recursive").result;
	const result = callback.result;
	return `\n#[cfg(test)] mod recursive_poison { use super::*;
static CLEARS: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
unsafe extern "C" fn clear(owner: *mut std::ffi::c_void) {
    drop(unsafe {Box::from_raw(owner.cast::<u8>())});
    CLEARS.fetch_add(1,std::sync::atomic::Ordering::SeqCst);
}
unsafe extern "C" fn invalid(_: u64, ${callback.parameters.map(node => `_: *const ${node.raw}`).join(", ")}, out: *mut ${result.raw}) -> u32 {
    unsafe {out.write(${result.raw} {owner: Box::into_raw(Box::new(42u8)).cast(), release:Some(clear), ..Default::default()})};
    0
}
#[test] fn malformed_output_retires_and_still_releases_its_owner() {
    let value = crate::Tree::Leaf {value:BigUint::from(7u8)};
    let mut closure=crate::make_recursive(&value).unwrap();
    closure.inner.invoke=invalid as *const ();
    assert_eq!(closure.call(true,&value),Err(Error::InvalidNative));
    assert_eq!(CLEARS.load(std::sync::atomic::Ordering::SeqCst),1);
    assert!(matches!(crate::call_recursive(&value,Ok),Err(Error::Native {code:5,..})));
    assert_eq!(GRAPH_LIVE.get(),0);
    closure.close().unwrap();
}
}\n`;
};
