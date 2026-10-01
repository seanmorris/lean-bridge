/**
 * Whole-value Rust owners for results anchored to another original owner.
 *
 * @file
 */

/**
 * Emit checked whole-result owners and only the required native input access.
 *
 * @param options - Actual call capabilities, not requested projection flags.
 * @param options.inputOwners - An anchor or transfer needs the original owner.
 */
export const ownedRustAnchoredValues = ({ inputOwners = true } = {}) => `
struct OwnedValueStorage<T> { lease: std::rc::Rc<owned_runtime::Lease>, value: T }
pub struct Value<T> { storage: Option<std::rc::Rc<OwnedValueStorage<T>>> }
impl<T> Value<T> {
    pub(crate) fn from_owned(lease: std::rc::Rc<owned_runtime::Lease>, value: T) -> Result<Self, Error> {
        lease.require()?;
        Ok(Self { storage: Some(std::rc::Rc::new(OwnedValueStorage { lease, value })) })
    }
${inputOwners ? `    pub(crate) fn lease(&self, state: &std::rc::Rc<owned_runtime::State>) -> Result<std::rc::Rc<owned_runtime::Lease>, Error> {
        let storage = self.storage.as_ref().ok_or(Error::Closed)?;
        storage.lease.require()?;
        if !std::rc::Rc::ptr_eq(&storage.lease.state, state) { return Err(Error::InvalidArgument); }
        Ok(std::rc::Rc::clone(&storage.lease))
    }
` : ""}    pub fn get(&self) -> Result<&T, Error> {
        let storage = self.storage.as_ref().ok_or(Error::Closed)?;
        storage.lease.require()?; Ok(&storage.value)
    }
    pub fn close(&mut self) { self.storage = None; }
    pub fn is_closed(&self) -> bool { self.get().is_err() }
}
impl<T> Default for Value<T> { fn default() -> Self { Self { storage: None } } }
impl<T> Clone for Value<T> { fn clone(&self) -> Self { Self { storage: self.storage.clone() } } }
impl<T> std::fmt::Debug for Value<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Value").field("closed", &self.is_closed()).finish_non_exhaustive()
    }
}
impl<T: PartialEq> Value<T> {
    pub fn try_equal(&self, other: &Self) -> Result<bool, Error> { Ok(self.get()? == other.get()?) }
}
impl<T: PartialEq> PartialEq for Value<T> {
    fn eq(&self, other: &Self) -> bool { self.try_equal(other).unwrap_or(false) }
}
pub trait ValueType: Sized {
    fn copy_value(&self) -> Result<Value<Self>, Error>;
}
pub fn copy_value<T: ValueType>(value: &T) -> Result<Value<T>, Error> { value.copy_value() }
impl<T: ValueType> Value<T> {
    pub fn retain(&self) -> Result<Self, Error> { self.get()?.copy_value() }
}
`;

export const ownedRustAnchoredTransferRuntime = `
    pub(crate) struct InputMoveSignal { owner: Cell<*mut c_void>, armed: Cell<bool> }
    impl InputMoveSignal {
        pub(crate) fn new() -> Self { Self { owner: Cell::new(std::ptr::null_mut()), armed: Cell::new(false) } }
        pub(crate) fn slot(&self) -> *mut *mut c_void { self.owner.as_ptr() }
        pub(crate) fn arm(&self) { self.armed.set(true); }
        fn consumed(&self) -> bool { self.armed.get() && self.owner.get().is_null() }
    }
    impl Lease {
        pub(crate) fn transfer_ready(&self) -> Result<(), Error> {
            self.require()?;
            if self.borrowed_result || !matches!(self.kind, LeaseKind::Owned(_)) { return Err(Error::InvalidArgument); }
            if self.input_move.borrow().is_some() { return Err(Error::CallOrder); }
            Ok(())
        }
        pub(crate) fn begin_transfer(&self, signal: &Rc<InputMoveSignal>) {
            if let LeaseKind::Owned(slot) = &self.kind { signal.owner.set(slot.owner.replace(std::ptr::null_mut())); }
            *self.input_move.borrow_mut() = Some(Rc::clone(signal));
        }
        pub(crate) fn finish_transfer(&self, signal: &Rc<InputMoveSignal>) {
            let matching = self.input_move.borrow().as_ref().is_some_and(|value| Rc::ptr_eq(value, signal));
            if !matching { return; }
            if let LeaseKind::Owned(slot) = &self.kind {
                slot.owner.set(signal.owner.replace(std::ptr::null_mut()));
            }
            self.input_move.borrow_mut().take();
        }
    }
`;

export const ownedRustAnchoredTransfers = `
struct OwnedInputTransfers {
    state: Rc<State>, groups: Vec<Option<(Rc<Lease>, Rc<owned_runtime::InputMoveSignal>)>>,
    armed: bool, finished: bool,
}
impl OwnedInputTransfers {
    fn new(state: Rc<State>, count: usize) -> Result<Self, Error> {
        owned_checkpoint()?;
        let mut groups = Vec::new(); groups.try_reserve_exact(count).map_err(|_| Error::Allocation)?;
        for _ in 0..count { groups.push(None); }
        Ok(Self { state, groups, armed: false, finished: false })
    }
    fn add(&mut self, lease: Rc<Lease>, group: usize) -> Result<(), Error> {
        lease.transfer_ready()?;
        if !Rc::ptr_eq(&lease.state, &self.state) || group >= self.groups.len() || self.groups[group].is_some() {
            return Err(Error::InvalidArgument);
        }
        if self.groups.iter().flatten().any(|(previous, _)| Rc::ptr_eq(previous, &lease)) { return Err(Error::InvalidArgument); }
        owned_checkpoint()?;
        self.groups[group] = Some((lease, Rc::new(owned_runtime::InputMoveSignal::new()))); Ok(())
    }
    fn owner(&self, group: usize) -> *mut *mut c_void { self.groups[group].as_ref().expect("validated input group").1.slot() }
    fn arm(&mut self) -> Result<(), Error> {
        for entry in &self.groups { entry.as_ref().ok_or(Error::InvalidArgument)?.0.transfer_ready()?; }
        for (lease, signal) in self.groups.iter().flatten() { lease.begin_transfer(signal); signal.arm(); }
        self.armed = true; Ok(())
    }
    fn finish(&mut self) {
        if self.finished || !self.armed { return; }
        self.finished = true;
        for (lease, signal) in self.groups.iter().flatten() { lease.finish_transfer(signal); }
    }
}
impl Drop for OwnedInputTransfers { fn drop(&mut self) { self.finish(); } }
`;

/**
 * Deep-copy into an independent original owner, including empty constructors.
 *
 * @param conversions - Checked Rust/C types.
 * @param all - Ordered native call table.
 */
export const ownedRustValueCopies = (conversions, all) => {
	const publicCalls = [], helpers = [], seen = new Set();
	for(const node of conversions.types) if(node.representation !== "copied" && !seen.has(node.canonicalHostName))
	{
		seen.add(node.canonicalHostName);
		const index = all.findIndex(item => (item.copy || item.retain) && item.id === node.id);
		if(index < 0) throw new TypeError(`Missing Rust whole-value copy for ${node.id}`);
		publicCalls.push(`impl ValueType for ${node.hostName} {`
			, `    fn copy_value(&self) -> Result<Value<Self>, Error> { owned_values::owned_copy_value${node.index}(self) }`, "}");
		helpers.push(`pub(crate) fn owned_copy_value${node.index}(source: &${node.hostName}) -> Result<Value<${node.hostName}>, Error> {`
			, "    let state = current_state()?; let mut budget = OwnedBudget::new();"
			, `    owned_check${node.index}(source, 0, &mut budget, &state)?;`
			, "    let mut scope = OwnedScope::new(budget);"
			, `    let view = owned_to${node.index}(source, &mut scope, &state)?;`
			, `    let mut raw: ${node.raw} = Default::default(); let mut output = OwnedOutput::new(Rc::clone(&state));`
			, `    checked(unsafe { owned_native${index}(state.require()?, ${node.leaf ? "" : "&"}view, &mut raw, &mut output.owner.value) })?;`
			, `    let value = unsafe { owned_from${node.index}(&raw, 0, &mut scope, &mut output)? };`
			, "    owned_checkpoint()?; Value::from_owned(output.hold()?, value)", "}");
	}
	return { publicCalls, helpers };
};
