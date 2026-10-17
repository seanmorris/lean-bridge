#![allow(dead_code, unused_imports)]
use crate::*;
const _: () = assert!(std::mem::size_of::<usize>() == 8);
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum GraphError { InvalidInput, Limit, Allocation, InvalidNative, Unavailable }
#[cfg(test)]
thread_local! {
    static GRAPH_FAULT: std::cell::Cell<(usize, usize, bool)> = const { std::cell::Cell::new((0, 0, false)) };
    static GRAPH_LIVE: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
}
fn graph_checkpoint() -> Result<(), GraphError> {
    #[cfg(test)]
    GRAPH_FAULT.with(|state| {
        let (target, current, panic) = state.get(); state.set((target, current + 1, panic));
        if target != 0 && target == current + 1 {
            assert!(!panic, "injected graph conversion panic"); return Err(GraphError::Allocation);
        }
        Ok(())
    })?;
    Ok(())
}
struct GraphBudget { nodes: usize, native: usize, storage: usize }
impl GraphBudget {
    fn new() -> Self { Self { nodes: 262144, native: 16 * 1024 * 1024, storage: 16 * 1024 * 1024 } }
    fn enter(&mut self, depth: usize) -> Result<(), GraphError> {
        if depth > 128 || self.nodes == 0 { return Err(GraphError::Limit); }
        self.nodes -= 1; Ok(())
    }
    fn charge(remaining: &mut usize, count: usize, width: usize) -> Result<(), GraphError> {
        let bytes = count.checked_mul(width.max(1)).ok_or(GraphError::Limit)?;
        *remaining = remaining.checked_sub(bytes).ok_or(GraphError::Limit)?; Ok(())
    }
    fn native(&mut self, count: usize, width: usize) -> Result<(), GraphError> { Self::charge(&mut self.native, count, width) }
    fn storage(&mut self, count: usize, width: usize) -> Result<(), GraphError> { Self::charge(&mut self.storage, count, width) }
}
struct GraphOwner<T: 'static>(Vec<T>);
impl<T> Drop for GraphOwner<T> {
    fn drop(&mut self) { #[cfg(test)] GRAPH_LIVE.with(|live| live.set(live.get() - 1)); }
}
struct GraphScope { budget: GraphBudget, owners: Vec<Box<dyn std::any::Any>> }
impl GraphScope {
    fn new(budget: GraphBudget) -> Self { Self { budget, owners: Vec::new() } }
    fn vector<T>(&mut self, count: usize) -> Result<Vec<T>, GraphError> {
        self.budget.storage(count, std::mem::size_of::<T>())?;
        graph_checkpoint()?;
        let mut values = Vec::new(); values.try_reserve_exact(count).map_err(|_| GraphError::Allocation)?;
        if std::mem::size_of::<T>() != 0 && values.capacity() > count {
            self.budget.storage(values.capacity() - count, std::mem::size_of::<T>())?;
        }
        Ok(values)
    }
    fn keep<T: 'static>(&mut self, values: Vec<T>) -> Result<*const T, GraphError> {
        graph_checkpoint()?;
        self.budget.storage(1, std::mem::size_of::<GraphOwner<T>>())?;
        let previous = self.owners.capacity();
        self.owners.try_reserve_exact(1).map_err(|_| GraphError::Allocation)?;
        self.budget.storage(self.owners.capacity() - previous, std::mem::size_of::<Box<dyn std::any::Any>>())?;
        let pointer = values.as_ptr();
        let owner = Box::new(GraphOwner(values));
        #[cfg(test)] GRAPH_LIVE.with(|live| live.set(live.get() + 1));
        self.owners.push(owner); Ok(pointer)
    }
    fn one<T: 'static>(&mut self, value: T) -> Result<*const T, GraphError> {
        let mut values = self.vector(1)?; values.push(value); self.keep(values)
    }
    fn boxed<T>(&mut self, value: T) -> Result<Box<T>, GraphError> { graph_checkpoint()?; Ok(Box::new(value)) }
}
struct GraphOutput<T> { value: T, clear: unsafe fn(*mut T) }
impl<T> Drop for GraphOutput<T> { fn drop(&mut self) { unsafe { (self.clear)(&mut self.value) }; } }
unsafe fn graph_slice<'a, T>(pointer: *const T, count: usize) -> Result<&'a [T], GraphError> {
    if count == 0 { return Ok(&[]); }
    let address = pointer as usize;
    let bytes = count.checked_mul(std::mem::size_of::<T>()).ok_or(GraphError::InvalidNative)?;
    if pointer.is_null() || address % std::mem::align_of::<T>() != 0 || bytes > isize::MAX as usize || address.checked_add(bytes).is_none() {
        return Err(GraphError::InvalidNative);
    }
    // The authenticated native adapter supplies readable storage for its spans.
    // Rust checks shape, alignment and bounds, not arbitrary process addresses.
    Ok(unsafe { std::slice::from_raw_parts(pointer, count) })
}
unsafe fn graph_read<'a, T>(pointer: *const T) -> Result<&'a T, GraphError> { Ok(&unsafe { graph_slice(pointer, 1)? }[0]) }
fn graph_status(status: u32) -> Result<(), GraphError> {
    match status { 0 => Ok(()), 1 => Err(GraphError::InvalidInput), 2 => Err(GraphError::Limit), 3 => Err(GraphError::Allocation),
        5 => Err(GraphError::Unavailable), _ => Err(GraphError::InvalidNative) }
}
struct GraphLifecycle {
    initialize: unsafe extern "C" fn() -> u32,
    ready: unsafe extern "C" fn() -> i32,
    retire: unsafe extern "C" fn(),
}
fn graph_finish<T>(result: Result<T, GraphError>, lifecycle: Option<&GraphLifecycle>) -> Result<T, GraphError> {
    if let Some(runtime) = lifecycle {
        if matches!(&result, Err(GraphError::InvalidNative)) { unsafe { (runtime.retire)() }; }
        if result.is_ok() && unsafe { (runtime.ready)() } == 0 { return Err(GraphError::Unavailable); }
    }
    result
}

#[repr(C)]
#[derive(Clone, Copy)]
struct GraphRaw0 {
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
    data: *const GraphRaw1,
    length: usize,
}
impl Default for GraphRaw0 { fn default() -> Self {
    let value: Self = unsafe { std::mem::zeroed() }; value
} }
unsafe fn graph_clear0(value: *mut GraphRaw0) {
    let value = unsafe { &mut *value };
    let owner = value.owner; let release = value.release;
    *value = Default::default();
    if !owner.is_null() { if let Some(release) = release { unsafe { release(owner) }; } }
}
#[repr(C)]
#[derive(Clone, Copy)]
struct GraphRaw1 {
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
    has_value: u8,
    field0: GraphRaw3,
}
impl Default for GraphRaw1 { fn default() -> Self {
    let value: Self = unsafe { std::mem::zeroed() }; value
} }
unsafe fn graph_clear1(value: *mut GraphRaw1) {
    let value = unsafe { &mut *value };
    let owner = value.owner; let release = value.release;
    *value = Default::default();
    if !owner.is_null() { if let Some(release) = release { unsafe { release(owner) }; } }
}
#[repr(C)]
#[derive(Clone, Copy)]
struct GraphRaw2 {
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
    has_value: u8,
    field0: *const GraphRaw4,
}
impl Default for GraphRaw2 { fn default() -> Self {
    let value: Self = unsafe { std::mem::zeroed() }; value
} }
unsafe fn graph_clear2(value: *mut GraphRaw2) {
    let value = unsafe { &mut *value };
    let owner = value.owner; let release = value.release;
    *value = Default::default();
    if !owner.is_null() { if let Some(release) = release { unsafe { release(owner) }; } }
}
#[repr(C)]
#[derive(Clone, Copy)]
struct GraphRaw3 {
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
    field0: GraphRaw5,
    field1: GraphRaw5,
    field2: *const GraphRaw2,
}
impl Default for GraphRaw3 { fn default() -> Self {
    let value: Self = unsafe { std::mem::zeroed() }; value
} }
unsafe fn graph_clear3(value: *mut GraphRaw3) {
    let value = unsafe { &mut *value };
    let owner = value.owner; let release = value.release;
    *value = Default::default();
    if !owner.is_null() { if let Some(release) = release { unsafe { release(owner) }; } }
}
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct GraphCase4_0 {
    empty: u8,
}
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct GraphCase4_1 {
    field0: *const GraphRaw3,
}
#[repr(C)]
#[derive(Clone, Copy)]
union GraphUnion4 {
    case0: GraphCase4_0,
    case1: GraphCase4_1,
}
impl Default for GraphUnion4 { fn default() -> Self { unsafe { std::mem::zeroed() } } }
#[repr(C)]
#[derive(Clone, Copy)]
struct GraphRaw4 {
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
    kind: u32,
    cases: GraphUnion4,
}
impl Default for GraphRaw4 { fn default() -> Self {
    let value: Self = unsafe { std::mem::zeroed() }; Self { kind: u32::MAX, ..value }
} }
unsafe fn graph_clear4(value: *mut GraphRaw4) {
    let value = unsafe { &mut *value };
    let owner = value.owner; let release = value.release;
    *value = Default::default();
    if !owner.is_null() { if let Some(release) = release { unsafe { release(owner) }; } }
}
#[repr(C)]
#[derive(Clone, Copy)]
struct GraphRaw5 {
    owner: *mut std::ffi::c_void,
    release: Option<unsafe extern "C" fn(*mut std::ffi::c_void)>,
    data: *const u32,
    length: usize,
}
impl Default for GraphRaw5 { fn default() -> Self {
    let value: Self = unsafe { std::mem::zeroed() }; value
} }
unsafe fn graph_clear5(value: *mut GraphRaw5) {
    let value = unsafe { &mut *value };
    let owner = value.owner; let release = value.release;
    *value = Default::default();
    if !owner.is_null() { if let Some(release) = release { unsafe { release(owner) }; } }
}
fn graph_check0(value: &[Graphc8c78faf2eecb4e21389], depth: usize, native_storage: bool, budget: &mut GraphBudget) -> Result<(), GraphError> {
    let _ = value;
    budget.enter(depth)?;
    if native_storage { budget.native(1, std::mem::size_of::<GraphRaw0>())?; }
    if value.len() > budget.nodes { return Err(GraphError::Limit); }
    budget.native(value.len(), std::mem::size_of::<GraphRaw1>())?;
    for item in value { graph_check1(item, depth + 1, false, budget)?; }
    Ok(())
}
fn graph_to0(value: &[Graphc8c78faf2eecb4e21389], scope: &mut GraphScope) -> Result<GraphRaw0, GraphError> {
    let _ = (&value, &scope);
    let mut items = scope.vector::<GraphRaw1>(value.len())?;
    for item in value { items.push(graph_to1(item, scope)?); }
    Ok(GraphRaw0 { data: scope.keep(items)?, length: value.len(), ..Default::default() })
}
unsafe fn graph_from0(value: &GraphRaw0, depth: usize, native_storage: bool, host_storage: bool, scope: &mut GraphScope) -> Result<Graph6586a61fcab9df3e21b7, GraphError> {
    let _ = value;
    scope.budget.enter(depth)?;
    if native_storage { scope.budget.native(1, std::mem::size_of::<GraphRaw0>())?; }
    if host_storage { scope.budget.storage(1, std::mem::size_of::<Graph6586a61fcab9df3e21b7>())?; }
    if value.length > scope.budget.nodes { return Err(GraphError::Limit); }
    scope.budget.native(value.length, std::mem::size_of::<GraphRaw1>())?;
    let input = graph_slice(value.data, value.length)?;
    let mut result = scope.vector::<Graphc8c78faf2eecb4e21389>(input.len())?;
    for item in input { result.push(graph_from1(item, depth + 1, false, false, scope)?); }
    Ok(result)
}
fn graph_check1(value: &Graphc8c78faf2eecb4e21389, depth: usize, native_storage: bool, budget: &mut GraphBudget) -> Result<(), GraphError> {
    let _ = value;
    budget.enter(depth)?;
    if native_storage { budget.native(1, std::mem::size_of::<GraphRaw1>())?; }
    match value {
        None => {},
        Some(inner) => { graph_check3(inner, depth + 1, false, budget)?; },
    }
    Ok(())
}
fn graph_to1(value: &Graphc8c78faf2eecb4e21389, scope: &mut GraphScope) -> Result<GraphRaw1, GraphError> {
    let _ = (&value, &scope);
    match value {
        None => Ok(GraphRaw1::default()),
        Some(inner) => Ok(GraphRaw1 { has_value: 1, field0: graph_to3(inner, scope)?, ..Default::default() }),
    }
}
unsafe fn graph_from1(value: &GraphRaw1, depth: usize, native_storage: bool, host_storage: bool, scope: &mut GraphScope) -> Result<Graphc8c78faf2eecb4e21389, GraphError> {
    let _ = value;
    scope.budget.enter(depth)?;
    if native_storage { scope.budget.native(1, std::mem::size_of::<GraphRaw1>())?; }
    if host_storage { scope.budget.storage(1, std::mem::size_of::<Graphc8c78faf2eecb4e21389>())?; }
    match value.has_value {
        0 => Ok(None),
        1 => Ok(Some(graph_from3(&value.field0, depth + 1, false, false, scope)?)),
        _ => Err(GraphError::InvalidNative)
    }
}
fn graph_check2(value: &Graphd2fe45ba488df4ece96d, depth: usize, native_storage: bool, budget: &mut GraphBudget) -> Result<(), GraphError> {
    let _ = value;
    budget.enter(depth)?;
    if native_storage { budget.native(1, std::mem::size_of::<GraphRaw2>())?; }
    match value {
        None => {},
        Some(inner) => { graph_check4(inner.as_ref(), depth + 1, true, budget)?; },
    }
    Ok(())
}
fn graph_to2(value: &Graphd2fe45ba488df4ece96d, scope: &mut GraphScope) -> Result<GraphRaw2, GraphError> {
    let _ = (&value, &scope);
    match value {
        None => Ok(GraphRaw2::default()),
        Some(inner) => Ok(GraphRaw2 { has_value: 1, field0: { let child = graph_to4(inner.as_ref(), scope)?; scope.one(child)? }, ..Default::default() }),
    }
}
unsafe fn graph_from2(value: &GraphRaw2, depth: usize, native_storage: bool, host_storage: bool, scope: &mut GraphScope) -> Result<Graphd2fe45ba488df4ece96d, GraphError> {
    let _ = value;
    scope.budget.enter(depth)?;
    if native_storage { scope.budget.native(1, std::mem::size_of::<GraphRaw2>())?; }
    if host_storage { scope.budget.storage(1, std::mem::size_of::<Graphd2fe45ba488df4ece96d>())?; }
    match value.has_value {
        0 => Ok(None),
        1 => Ok(Some({ let child = graph_from4(graph_read(value.field0)?, depth + 1, true, true, scope)?; scope.boxed(child)? })),
        _ => Err(GraphError::InvalidNative)
    }
}
fn graph_check3(value: &Envelope, depth: usize, native_storage: bool, budget: &mut GraphBudget) -> Result<(), GraphError> {
    let _ = value;
    budget.enter(depth)?;
    if native_storage { budget.native(1, std::mem::size_of::<GraphRaw3>())?; }
    graph_check5(&value.value, depth + 1, false, budget)?;
    graph_check5(&value.mode, depth + 1, false, budget)?;
    graph_check2(&value.next, depth + 1, true, budget)?;
    Ok(())
}
fn graph_to3(value: &Envelope, scope: &mut GraphScope) -> Result<GraphRaw3, GraphError> {
    let _ = (&value, &scope);
    Ok(GraphRaw3 { field0: graph_to5(&value.value, scope)?, field1: graph_to5(&value.mode, scope)?, field2: { let child = graph_to2(&value.next, scope)?; scope.one(child)? }, ..Default::default() })
}
unsafe fn graph_from3(value: &GraphRaw3, depth: usize, native_storage: bool, host_storage: bool, scope: &mut GraphScope) -> Result<Envelope, GraphError> {
    let _ = value;
    scope.budget.enter(depth)?;
    if native_storage { scope.budget.native(1, std::mem::size_of::<GraphRaw3>())?; }
    if host_storage { scope.budget.storage(1, std::mem::size_of::<Envelope>())?; }
    Ok(Envelope { value: graph_from5(&value.field0, depth + 1, false, false, scope)?, mode: graph_from5(&value.field1, depth + 1, false, false, scope)?, next: graph_from2(graph_read(value.field2)?, depth + 1, true, false, scope)? })
}
fn graph_check4(value: &Step, depth: usize, native_storage: bool, budget: &mut GraphBudget) -> Result<(), GraphError> {
    let _ = value;
    budget.enter(depth)?;
    if native_storage { budget.native(1, std::mem::size_of::<GraphRaw4>())?; }
    match value {
        Step::Stop => {  },
        Step::More { packet: field0 } => { graph_check3(field0.as_ref(), depth + 1, true, budget)?; },
    }
    Ok(())
}
fn graph_to4(value: &Step, scope: &mut GraphScope) -> Result<GraphRaw4, GraphError> {
    let _ = (&value, &scope);
    match value {
        Step::Stop => Ok(GraphRaw4 { kind: 0, cases: GraphUnion4 { case0: GraphCase4_0 { empty: 0 } }, ..Default::default() }),
        Step::More { packet: field0 } => Ok(GraphRaw4 { kind: 1, cases: GraphUnion4 { case1: GraphCase4_1 { field0: { let child = graph_to3(field0.as_ref(), scope)?; scope.one(child)? } } }, ..Default::default() }),
    }
}
unsafe fn graph_from4(value: &GraphRaw4, depth: usize, native_storage: bool, host_storage: bool, scope: &mut GraphScope) -> Result<Step, GraphError> {
    let _ = value;
    scope.budget.enter(depth)?;
    if native_storage { scope.budget.native(1, std::mem::size_of::<GraphRaw4>())?; }
    if host_storage { scope.budget.storage(1, std::mem::size_of::<Step>())?; }
    match value.kind {
        0 => Ok(Step::Stop),
        1 => Ok(Step::More { packet: { let child = graph_from3(graph_read(value.cases.case1.field0)?, depth + 1, true, true, scope)?; scope.boxed(child)? } }),
        _ => Err(GraphError::InvalidNative)
    }
}
fn graph_check5(value: &BigUint, depth: usize, native_storage: bool, budget: &mut GraphBudget) -> Result<(), GraphError> {
    let _ = value;
    budget.enter(depth)?;
    if native_storage { budget.native(1, std::mem::size_of::<GraphRaw5>())?; }
    let limbs = usize::try_from(value.bits().div_ceil(32)).map_err(|_| GraphError::Limit)?;
    budget.native(limbs, 4)?;
    Ok(())
}
fn graph_to5(value: &BigUint, scope: &mut GraphScope) -> Result<GraphRaw5, GraphError> {
    let _ = (&value, &scope);
    let limbs = usize::try_from(value.bits().div_ceil(32)).map_err(|_| GraphError::Limit)?;
    let mut digits = scope.vector::<u32>(limbs)?; digits.extend(value.iter_u32_digits());
    Ok(GraphRaw5 { data: scope.keep(digits)?, length: limbs, ..Default::default() })
}
unsafe fn graph_from5(value: &GraphRaw5, depth: usize, native_storage: bool, host_storage: bool, scope: &mut GraphScope) -> Result<BigUint, GraphError> {
    let _ = value;
    scope.budget.enter(depth)?;
    if native_storage { scope.budget.native(1, std::mem::size_of::<GraphRaw5>())?; }
    if host_storage { scope.budget.storage(1, std::mem::size_of::<BigUint>())?; }
    scope.budget.native(value.length, 4)?; scope.budget.storage(value.length, 4)?;
    let digits = graph_slice(value.data, value.length)?; graph_checkpoint()?;
    Ok(BigUint::from_slice(digits))
}
unsafe fn graph_call_echo(invoke: unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw3) -> u32, arg0: &Envelope) -> Result<Envelope, GraphError> {
    unsafe { graph_call_echo_guarded(None, invoke, arg0) }
}
unsafe fn graph_call_echo_guarded(lifecycle: Option<&GraphLifecycle>, invoke: unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw3) -> u32, arg0: &Envelope) -> Result<Envelope, GraphError> {
    let mut budget = GraphBudget::new();
    graph_check3(arg0, 0, true, &mut budget)?;
    if let Some(runtime) = lifecycle { graph_finish(graph_status(unsafe { (runtime.initialize)() }), lifecycle)?; }
    let mut scope = GraphScope::new(budget);
    let input0 = graph_to3(arg0, &mut scope)?;
    let mut output = GraphOutput { value: GraphRaw3::default(), clear: graph_clear3 };
    let result = (|| {
        graph_status(unsafe { invoke(&input0, &mut output.value) })?;
        unsafe { graph_from3(&output.value, 0, true, true, &mut scope) }
    })();
    graph_finish(result, lifecycle)
}
unsafe fn graph_call_echo_groups(invoke: unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw0) -> u32, arg0: &[Graphc8c78faf2eecb4e21389]) -> Result<Graph6586a61fcab9df3e21b7, GraphError> {
    unsafe { graph_call_echo_groups_guarded(None, invoke, arg0) }
}
unsafe fn graph_call_echo_groups_guarded(lifecycle: Option<&GraphLifecycle>, invoke: unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw0) -> u32, arg0: &[Graphc8c78faf2eecb4e21389]) -> Result<Graph6586a61fcab9df3e21b7, GraphError> {
    let mut budget = GraphBudget::new();
    graph_check0(arg0, 0, true, &mut budget)?;
    if let Some(runtime) = lifecycle { graph_finish(graph_status(unsafe { (runtime.initialize)() }), lifecycle)?; }
    let mut scope = GraphScope::new(budget);
    let input0 = graph_to0(arg0, &mut scope)?;
    let mut output = GraphOutput { value: GraphRaw0::default(), clear: graph_clear0 };
    let result = (|| {
        graph_status(unsafe { invoke(&input0, &mut output.value) })?;
        unsafe { graph_from0(&output.value, 0, true, true, &mut scope) }
    })();
    graph_finish(result, lifecycle)
}
unsafe fn graph_call_first(invoke: unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw5) -> u32, arg0: &Envelope) -> Result<BigUint, GraphError> {
    unsafe { graph_call_first_guarded(None, invoke, arg0) }
}
unsafe fn graph_call_first_guarded(lifecycle: Option<&GraphLifecycle>, invoke: unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw5) -> u32, arg0: &Envelope) -> Result<BigUint, GraphError> {
    let mut budget = GraphBudget::new();
    graph_check3(arg0, 0, true, &mut budget)?;
    if let Some(runtime) = lifecycle { graph_finish(graph_status(unsafe { (runtime.initialize)() }), lifecycle)?; }
    let mut scope = GraphScope::new(budget);
    let input0 = graph_to3(arg0, &mut scope)?;
    let mut output = GraphOutput { value: GraphRaw5::default(), clear: graph_clear5 };
    let result = (|| {
        graph_status(unsafe { invoke(&input0, &mut output.value) })?;
        unsafe { graph_from5(&output.value, 0, true, true, &mut scope) }
    })();
    graph_finish(result, lifecycle)
}
unsafe fn graph_call_groups(invoke: unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw5) -> u32, arg0: &[Graphc8c78faf2eecb4e21389]) -> Result<BigUint, GraphError> {
    unsafe { graph_call_groups_guarded(None, invoke, arg0) }
}
unsafe fn graph_call_groups_guarded(lifecycle: Option<&GraphLifecycle>, invoke: unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw5) -> u32, arg0: &[Graphc8c78faf2eecb4e21389]) -> Result<BigUint, GraphError> {
    let mut budget = GraphBudget::new();
    graph_check0(arg0, 0, true, &mut budget)?;
    if let Some(runtime) = lifecycle { graph_finish(graph_status(unsafe { (runtime.initialize)() }), lifecycle)?; }
    let mut scope = GraphScope::new(budget);
    let input0 = graph_to0(arg0, &mut scope)?;
    let mut output = GraphOutput { value: GraphRaw5::default(), clear: graph_clear5 };
    let result = (|| {
        graph_status(unsafe { invoke(&input0, &mut output.value) })?;
        unsafe { graph_from5(&output.value, 0, true, true, &mut scope) }
    })();
    graph_finish(result, lifecycle)
}
unsafe fn graph_call_produce(invoke: unsafe extern "C" fn(*const GraphRaw5, *mut GraphRaw3) -> u32, arg0: &BigUint) -> Result<Envelope, GraphError> {
    unsafe { graph_call_produce_guarded(None, invoke, arg0) }
}
unsafe fn graph_call_produce_guarded(lifecycle: Option<&GraphLifecycle>, invoke: unsafe extern "C" fn(*const GraphRaw5, *mut GraphRaw3) -> u32, arg0: &BigUint) -> Result<Envelope, GraphError> {
    let mut budget = GraphBudget::new();
    graph_check5(arg0, 0, true, &mut budget)?;
    if let Some(runtime) = lifecycle { graph_finish(graph_status(unsafe { (runtime.initialize)() }), lifecycle)?; }
    let mut scope = GraphScope::new(budget);
    let input0 = graph_to5(arg0, &mut scope)?;
    let mut output = GraphOutput { value: GraphRaw3::default(), clear: graph_clear3 };
    let result = (|| {
        graph_status(unsafe { invoke(&input0, &mut output.value) })?;
        unsafe { graph_from3(&output.value, 0, true, true, &mut scope) }
    })();
    graph_finish(result, lifecycle)
}
unsafe fn graph_call_second(invoke: unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw5) -> u32, arg0: &Envelope) -> Result<BigUint, GraphError> {
    unsafe { graph_call_second_guarded(None, invoke, arg0) }
}
unsafe fn graph_call_second_guarded(lifecycle: Option<&GraphLifecycle>, invoke: unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw5) -> u32, arg0: &Envelope) -> Result<BigUint, GraphError> {
    let mut budget = GraphBudget::new();
    graph_check3(arg0, 0, true, &mut budget)?;
    if let Some(runtime) = lifecycle { graph_finish(graph_status(unsafe { (runtime.initialize)() }), lifecycle)?; }
    let mut scope = GraphScope::new(budget);
    let input0 = graph_to3(arg0, &mut scope)?;
    let mut output = GraphOutput { value: GraphRaw5::default(), clear: graph_clear5 };
    let result = (|| {
        graph_status(unsafe { invoke(&input0, &mut output.value) })?;
        unsafe { graph_from5(&output.value, 0, true, true, &mut scope) }
    })();
    graph_finish(result, lifecycle)
}

#[path = "assets.rs"] mod assets;
unsafe extern "C" { #[link_name = "dlsym"] fn graph_symbol(library: *mut std::ffi::c_void, name: *const std::ffi::c_char) -> *mut std::ffi::c_void; }
struct GraphNative {
    lifecycle: GraphLifecycle,
    diagnostic: unsafe extern "C" fn() -> *const std::ffi::c_char,
    call0: unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw3) -> u32,
    call1: unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw0) -> u32,
    call2: unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw5) -> u32,
    call3: unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw5) -> u32,
    call4: unsafe extern "C" fn(*const GraphRaw5, *mut GraphRaw3) -> u32,
    call5: unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw5) -> u32,
}
static GRAPH_NATIVE: std::sync::OnceLock<Result<GraphNative, Error>> = std::sync::OnceLock::new();
static GRAPH_PID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
fn graph_runtime() -> Result<&'static GraphNative, Error> {
    let pid = std::process::id();
    let owner = GRAPH_PID.compare_exchange(0, pid, std::sync::atomic::Ordering::Relaxed, std::sync::atomic::Ordering::Relaxed).unwrap_or_else(|owner| owner);
    if owner != 0 && owner != pid { return Err(Error::Load("Start a fresh process after fork to use Lean".into())); }
    GRAPH_NATIVE.get_or_init(|| {
        let library = assets::load()? as *mut std::ffi::c_void;
        macro_rules! symbol { ($name:literal, $type:ty) => {{
            let name = concat!($name, "\0");
            let value = unsafe { graph_symbol(library, name.as_ptr().cast()) };
            if value.is_null() { return Err(Error::Load(format!("Missing native symbol {}", $name))); }
            unsafe { std::mem::transmute::<*mut std::ffi::c_void, $type>(value) }
        }}; }
        Ok(GraphNative {
            lifecycle: GraphLifecycle {
                initialize: symbol!("mutualcheckedrecords_graph_initialize", unsafe extern "C" fn() -> u32),
                ready: symbol!("mutualcheckedrecords_graph_ready", unsafe extern "C" fn() -> i32),
                retire: symbol!("mutualcheckedrecords_graph_retire", unsafe extern "C" fn()),
            },
            diagnostic: symbol!("mutualcheckedrecords_graph_error", unsafe extern "C" fn() -> *const std::ffi::c_char),
            call0: symbol!("mutualcheckedrecords_echo_graph", unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw3) -> u32),
            call1: symbol!("mutualcheckedrecords_echo_groups_graph", unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw0) -> u32),
            call2: symbol!("mutualcheckedrecords_first_graph", unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw5) -> u32),
            call3: symbol!("mutualcheckedrecords_groups_graph", unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw5) -> u32),
            call4: symbol!("mutualcheckedrecords_produce_graph", unsafe extern "C" fn(*const GraphRaw5, *mut GraphRaw3) -> u32),
            call5: symbol!("mutualcheckedrecords_second_graph", unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw5) -> u32),
        })
    }).as_ref().map_err(Clone::clone)
}
fn graph_error(error: GraphError) -> Error {
    match error {
        GraphError::Limit => Error::Limit,
        GraphError::Allocation => Error::Allocation,
        GraphError::InvalidNative => Error::InvalidNative,
        GraphError::InvalidInput => Error::Native { code: 1, message: "Invalid copied value".into() },
        GraphError::Unavailable => Error::Native { code: 5, message: "Lean runtime initialization failed or runtime retired".into() },
    }
}
fn graph_checked_error(error: GraphError, diagnostic: unsafe extern "C" fn() -> *const std::ffi::c_char) -> Error {
    if !matches!(error, GraphError::InvalidInput) { return graph_error(error); }
    let pointer = unsafe { diagnostic() };
    if pointer.is_null() { return graph_error(error); }
    match unsafe { std::ffi::CStr::from_ptr(pointer) }.to_str() {
        Ok(message) => Error::Native { code: 1, message: message.into() },
        Err(_) => Error::InvalidNative,
    }
}

pub(super) fn call0(arg0: &Envelope) -> Result<Envelope, Error> {
    // Validate before loading assets. The guarded call also checks its inputs
    // and shares one conversion budget between arguments and the result.
    let mut budget = GraphBudget::new();
    graph_check3(arg0, 0, true, &mut budget).map_err(graph_error)?;
    let _ = budget;
    let runtime = graph_runtime()?;
    unsafe { graph_call_echo_guarded(Some(&runtime.lifecycle), runtime.call0, arg0) }.map_err(|error| graph_checked_error(error, runtime.diagnostic))
}

pub(super) fn call1(arg0: &[Graphc8c78faf2eecb4e21389]) -> Result<Graph6586a61fcab9df3e21b7, Error> {
    // Validate before loading assets. The guarded call also checks its inputs
    // and shares one conversion budget between arguments and the result.
    let mut budget = GraphBudget::new();
    graph_check0(arg0, 0, true, &mut budget).map_err(graph_error)?;
    let _ = budget;
    let runtime = graph_runtime()?;
    unsafe { graph_call_echo_groups_guarded(Some(&runtime.lifecycle), runtime.call1, arg0) }.map_err(|error| graph_checked_error(error, runtime.diagnostic))
}

pub(super) fn call2(arg0: &Envelope) -> Result<BigUint, Error> {
    // Validate before loading assets. The guarded call also checks its inputs
    // and shares one conversion budget between arguments and the result.
    let mut budget = GraphBudget::new();
    graph_check3(arg0, 0, true, &mut budget).map_err(graph_error)?;
    let _ = budget;
    let runtime = graph_runtime()?;
    unsafe { graph_call_first_guarded(Some(&runtime.lifecycle), runtime.call2, arg0) }.map_err(|error| graph_checked_error(error, runtime.diagnostic))
}

pub(super) fn call3(arg0: &[Graphc8c78faf2eecb4e21389]) -> Result<BigUint, Error> {
    // Validate before loading assets. The guarded call also checks its inputs
    // and shares one conversion budget between arguments and the result.
    let mut budget = GraphBudget::new();
    graph_check0(arg0, 0, true, &mut budget).map_err(graph_error)?;
    let _ = budget;
    let runtime = graph_runtime()?;
    unsafe { graph_call_groups_guarded(Some(&runtime.lifecycle), runtime.call3, arg0) }.map_err(|error| graph_checked_error(error, runtime.diagnostic))
}

pub(super) fn call4(arg0: &BigUint) -> Result<Envelope, Error> {
    // Validate before loading assets. The guarded call also checks its inputs
    // and shares one conversion budget between arguments and the result.
    let mut budget = GraphBudget::new();
    graph_check5(arg0, 0, true, &mut budget).map_err(graph_error)?;
    let _ = budget;
    let runtime = graph_runtime()?;
    unsafe { graph_call_produce_guarded(Some(&runtime.lifecycle), runtime.call4, arg0) }.map_err(|error| graph_checked_error(error, runtime.diagnostic))
}

pub(super) fn call5(arg0: &Envelope) -> Result<BigUint, Error> {
    // Validate before loading assets. The guarded call also checks its inputs
    // and shares one conversion budget between arguments and the result.
    let mut budget = GraphBudget::new();
    graph_check3(arg0, 0, true, &mut budget).map_err(graph_error)?;
    let _ = budget;
    let runtime = graph_runtime()?;
    unsafe { graph_call_second_guarded(Some(&runtime.lifecycle), runtime.call5, arg0) }.map_err(|error| graph_checked_error(error, runtime.diagnostic))
}
