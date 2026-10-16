/**
 * Rust input transactions over the checked C ownership handoff.
 *
 * @file
 */

/** Keep the C-written owner slot stable and observable during callback reentry. */
export const ownedRustTransferRuntime = `
    pub(crate) struct InputMoveSignal {
        owner: Cell<*mut c_void>, state: Rc<State>, armed: Cell<bool>,
    }
    impl InputMoveSignal {
        pub(crate) fn new(state: Rc<State>) -> Self {
            Self { owner: Cell::new(std::ptr::null_mut()), state, armed: Cell::new(false) }
        }
        pub(crate) fn slot(&self) -> *mut *mut c_void { self.owner.as_ptr() }
        pub(crate) fn ready(&self) -> Result<(), Error> {
            self.state.require()?;
            if self.owner.get().is_null() { Err(Error::InvalidArgument) } else { Ok(()) }
        }
        pub(crate) fn arm(&self) { self.armed.set(true); }
        fn consumed(&self) -> bool { self.armed.get() && self.owner.get().is_null() }
    }
    impl Drop for InputMoveSignal {
        fn drop(&mut self) {
            if self.state.affinity().is_ok() {
                let mut owner = self.owner.replace(std::ptr::null_mut());
                if !owner.is_null() { let _ = unsafe { result_release(&mut owner) }; }
            }
        }
    }
    impl Lease {
        pub(crate) fn transfer_ready(&self) -> Result<(), Error> {
            self.require()?;
            if !matches!(self.kind, LeaseKind::Owned(_)) { return Err(Error::InvalidArgument); }
            if self.input_move.borrow().is_some() { return Err(Error::CallOrder); }
            Ok(())
        }
        pub(crate) fn begin_transfer(&self, signal: &Rc<InputMoveSignal>) {
            *self.input_move.borrow_mut() = Some(Rc::clone(signal));
        }
        pub(crate) fn finish_transfer(&self, signal: &Rc<InputMoveSignal>) {
            // Clear the marker before native release can run any finalizers.
            let matching = self.input_move.borrow().as_ref().is_some_and(|value| Rc::ptr_eq(value, signal));
            if !matching { return; }
            self.input_move.borrow_mut().take();
            if signal.consumed() && self.state.affinity().is_ok() {
                if let LeaseKind::Owned(slot) = &self.kind {
                    let mut owner = slot.owner.replace(std::ptr::null_mut());
                    if !owner.is_null() { let _ = unsafe { result_release(&mut owner) }; }
                }
            }
        }
    }
`;

const support = `
struct OwnedInputTransfers {
    state: Rc<State>, budget: OwnedBudget,
    groups: Vec<Rc<owned_runtime::InputMoveSignal>>,
    leases: std::collections::HashMap<*const Lease, (Rc<Lease>, usize)>,
    finished: bool,
}
impl OwnedInputTransfers {
    fn new(state: Rc<State>, count: usize) -> Result<Self, Error> {
        let mut budget = OwnedBudget::new();
        budget.storage(count, std::mem::size_of::<owned_runtime::InputMoveSignal>() + std::mem::size_of::<Rc<owned_runtime::InputMoveSignal>>())?;
        owned_checkpoint()?;
        let mut groups = Vec::new(); groups.try_reserve_exact(count).map_err(|_| Error::Allocation)?;
        for _ in 0..count {
            owned_checkpoint()?;
            groups.push(Rc::new(owned_runtime::InputMoveSignal::new(Rc::clone(&state))));
        }
        Ok(Self { state, budget, groups, leases: std::collections::HashMap::new(), finished: false })
    }
    fn add(&mut self, lease: Rc<Lease>, group: usize) -> Result<(), Error> {
        lease.transfer_ready()?;
        if !Rc::ptr_eq(&lease.state, &self.state) || group >= self.groups.len() { return Err(Error::InvalidArgument); }
        let identity = Rc::as_ptr(&lease);
        if let Some((_, previous)) = self.leases.get(&identity) {
            return if *previous == group { Ok(()) } else { Err(Error::InvalidArgument) };
        }
        self.budget.storage(1, std::mem::size_of::<(Rc<Lease>, usize)>() + 4 * std::mem::size_of::<usize>())?;
        owned_checkpoint()?;
        self.leases.try_reserve(1).map_err(|_| Error::Allocation)?;
        self.leases.insert(identity, (lease, group)); Ok(())
    }
    fn owner(&self, group: usize) -> *mut *mut c_void { self.groups[group].slot() }
    fn arm(&self) -> Result<(), Error> {
        for group in &self.groups { group.ready()?; }
        for (lease, _) in self.leases.values() { lease.transfer_ready()?; }
        for (lease, group) in self.leases.values() { lease.begin_transfer(&self.groups[*group]); }
        for group in &self.groups { group.arm(); }
        Ok(())
    }
    fn finish(&mut self) {
        if self.finished { return; }
        self.finished = true;
        for (lease, group) in self.leases.values() { lease.finish_transfer(&self.groups[*group]); }
    }
}
impl Drop for OwnedInputTransfers { fn drop(&mut self) { self.finish(); } }
`;

/**
 * Collect resource leases in validated, bounded graphs, including host-created
 * containers. Repeated leaves in one argument share a move; separate arguments
 * cannot both consume the same lease.
 *
 * @param conversions - Validated Rust types and C transfer contracts.
 */
export const ownedRustInputTransfers = conversions => {
	const { types } = conversions, nodes = new Map(types.map(node => [node.id, node]));
	const owned = new Set(types.filter(node => node.identity).map(node => node.id));
	let changed = true;
	while(changed)
	{
		changed = false;
		for(const node of types)
		{
			const contains = owned.has(node.element) || [...node.fields, ...node.cases.flatMap(branch => branch.fields)].some(field => owned.has(field.type));
			if(!owned.has(node.id) && contains)
			{
				owned.add(node.id); changed = true;
			}
		}
	}
	const functions = [];
	for(const node of types)
	{
		const body = ["let _ = (&value, &depth, &moves, &group);"];
		const field = (item, value) => owned.has(item.type)
			? [`owned_move_leases${nodes.get(item.type).index}(${item.boxed ? `${value}.as_ref()` : value}, depth + 1, moves, group)?;`] : [];
		if(owned.has(node.id))
		{
			body.push("moves.budget.enter(depth)?;");
			if(node.identity) body.push("moves.add(value.transfer_lease(&moves.state)?, group)?;");
			else if(node.element) body.push(`for item in value { owned_move_leases${nodes.get(node.element).index}(item, depth + 1, moves, group)?; }`);
			else if(node.kind === "option") body.push("if let Some(inner) = value {", ...field(node.fields[0], "inner"), "}");
			else if(node.kind === "result") body.push("match value {", "Ok(inner) => { let _ = &inner;", ...field(node.fields[0], "inner"), "}, Err(inner) => { let _ = &inner;", ...field(node.fields[1], "inner"), "}, }");
			else if(node.kind === "variant")
			{
				body.push("match value {");
				for(const branch of node.cases)
				{
					const fields = branch.fields.filter(item => owned.has(item.type));
					const pattern = branch.fields.length ? ` { ${fields.map(item => item.publicName).join(", ")}${fields.length ? ", " : ""}.. }` : "";
					body.push(`${node.hostName}::${branch.publicName}${pattern} => {`, ...fields.flatMap(item => field(item, item.publicName)), "},");
				}
				body.push("}");
			}
			else body.push(...node.fields.flatMap((item, index) => field(item, `${item.boxed ? "" : "&"}value.${node.kind === "tuple" ? index : item.publicName}`)));
		}
		functions.push(`fn owned_move_leases${node.index}(value: &${node.input}, depth: usize, moves: &mut OwnedInputTransfers, group: usize) -> Result<(), Error> {\n${body.map(line => `    ${line}`).join("\n")}\n    Ok(())\n}`);
	}
	return [support, ...functions].join("\n");
};
