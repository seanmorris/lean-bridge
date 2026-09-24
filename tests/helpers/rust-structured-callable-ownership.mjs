/**
 * Direct ownership checks at the Rust callback return, before reading ABI borrows.
 *
 * @file
 */

/**
 * Generate private tests against actual trampoline names, with independent values.
 *
 * @param model - Admitted Rust structured model.
 */
export const rustStructuredOwnershipTests = model => {
	const specimens = {
		array: 'vec![None, Some("a\\0λ🌿".into()), Some(String::new())]'
		, list: 'vec![Ok((u32::MAX,"a\\0λ🌿".into())),Err(String::new())]'
		, option: "Some(Some(()))"
		, result: 'Err(vec!["a\\0λ🌿".into(), String::new()])'
		, tuple: '("a\\0λ🌿".into(),(vec![0,255,128], BigUint::from(1u8)<<4097usize))'
		, record: 'crate::Payload {text:"a\\0λ🌿".into(),rows:vec![Some("nested".into())],count:BigUint::from(1u8)<<257usize,nested:Some(Err("inner".into()))}'
		, variant: 'crate::Packet::Payload {label:"a\\0λ🌿".into(),rows:vec![Some("nested".into())]}'
	};
	specimens.alias = specimens.record;
	const tests = Object.entries(specimens).map(([shape, value]) => {
		const fn = model.surface.functions.find(fn => fn.field === `call_${shape}`);
		const callback = model.surface.callbacks.get(fn.declaration.parameters[1].type.id);
		const result = callback.result;
		return `#[test] fn ${shape}_result_owner_survives_trampoline_return() {
    let expected: ${result.publicType} = ${value};
    let mut host = |_: ${result.publicType}| -> Result<${result.publicType}, Error> { Ok(expected.clone()) };
    let state = CallbackState::new();
    let context = Context${callback.index} { function: std::cell::RefCell::new(&mut host), state: &state };
    let mut inputs = Scope::new(); let input = to${result.index}(&expected, &mut inputs).unwrap();
    let mut output = ${result.ctype}::default(); let mut error = NativeError::default();
    assert_eq!(unsafe { callback${callback.index}((&context as *const Context${callback.index}<'_>).cast_mut().cast(), &input, &mut output, &mut error) }, 0);
    state.finish().unwrap();
    // Check the complete owner before reading borrowed bytes, even if freed memory would appear intact.
    assert_eq!(state.scope.borrow().owners.iter().any(|owner| owner.is::<Owner<${result.publicType}>>()), ${shape !== "option"});
    assert_eq!(from${result.index}(&output, &mut Scope::new()).unwrap(), expected);
    drop(inputs); drop(state); assert_eq!(LIVE.get(), 0);
}`;
	}).join("\n");
	return `\n#[cfg(test)] mod structured_ownership { use super::*;\n${tests}\n}\n`;
};
