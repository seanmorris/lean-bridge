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
    field0: *const GraphRaw2,
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
    field0: GraphRaw3,
    field1: GraphRaw3,
    field2: *const GraphRaw1,
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
    data: *const u32,
    length: usize,
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
fn graph_check0(value: &[Graph2c3080f9e24fa7c11cff], depth: usize, native_storage: bool, budget: &mut GraphBudget) -> Result<(), GraphError> {
    let _ = value;
    budget.enter(depth)?;
    if native_storage { budget.native(1, std::mem::size_of::<GraphRaw0>())?; }
    if value.len() > budget.nodes { return Err(GraphError::Limit); }
    budget.native(value.len(), std::mem::size_of::<GraphRaw1>())?;
    for item in value { graph_check1(item, depth + 1, false, budget)?; }
    Ok(())
}
fn graph_to0(value: &[Graph2c3080f9e24fa7c11cff], scope: &mut GraphScope) -> Result<GraphRaw0, GraphError> {
    let _ = (&value, &scope);
    let mut items = scope.vector::<GraphRaw1>(value.len())?;
    for item in value { items.push(graph_to1(item, scope)?); }
    Ok(GraphRaw0 { data: scope.keep(items)?, length: value.len(), ..Default::default() })
}
unsafe fn graph_from0(value: &GraphRaw0, depth: usize, native_storage: bool, host_storage: bool, scope: &mut GraphScope) -> Result<Graphbf065e9a21862d87767f, GraphError> {
    let _ = value;
    scope.budget.enter(depth)?;
    if native_storage { scope.budget.native(1, std::mem::size_of::<GraphRaw0>())?; }
    if host_storage { scope.budget.storage(1, std::mem::size_of::<Graphbf065e9a21862d87767f>())?; }
    if value.length > scope.budget.nodes { return Err(GraphError::Limit); }
    scope.budget.native(value.length, std::mem::size_of::<GraphRaw1>())?;
    let input = graph_slice(value.data, value.length)?;
    let mut result = scope.vector::<Graph2c3080f9e24fa7c11cff>(input.len())?;
    for item in input { result.push(graph_from1(item, depth + 1, false, false, scope)?); }
    Ok(result)
}
fn graph_check1(value: &Graph2c3080f9e24fa7c11cff, depth: usize, native_storage: bool, budget: &mut GraphBudget) -> Result<(), GraphError> {
    let _ = value;
    budget.enter(depth)?;
    if native_storage { budget.native(1, std::mem::size_of::<GraphRaw1>())?; }
    match value {
        None => {},
        Some(inner) => { graph_check2(inner.as_ref(), depth + 1, true, budget)?; },
    }
    Ok(())
}
fn graph_to1(value: &Graph2c3080f9e24fa7c11cff, scope: &mut GraphScope) -> Result<GraphRaw1, GraphError> {
    let _ = (&value, &scope);
    match value {
        None => Ok(GraphRaw1::default()),
        Some(inner) => Ok(GraphRaw1 { has_value: 1, field0: { let child = graph_to2(inner.as_ref(), scope)?; scope.one(child)? }, ..Default::default() }),
    }
}
unsafe fn graph_from1(value: &GraphRaw1, depth: usize, native_storage: bool, host_storage: bool, scope: &mut GraphScope) -> Result<Graph2c3080f9e24fa7c11cff, GraphError> {
    let _ = value;
    scope.budget.enter(depth)?;
    if native_storage { scope.budget.native(1, std::mem::size_of::<GraphRaw1>())?; }
    if host_storage { scope.budget.storage(1, std::mem::size_of::<Graph2c3080f9e24fa7c11cff>())?; }
    match value.has_value {
        0 => Ok(None),
        1 => Ok(Some({ let child = graph_from2(graph_read(value.field0)?, depth + 1, true, true, scope)?; scope.boxed(child)? })),
        _ => Err(GraphError::InvalidNative)
    }
}
fn graph_check2(value: &Packet, depth: usize, native_storage: bool, budget: &mut GraphBudget) -> Result<(), GraphError> {
    let _ = value;
    budget.enter(depth)?;
    if native_storage { budget.native(1, std::mem::size_of::<GraphRaw2>())?; }
    graph_check3(&value.value, depth + 1, false, budget)?;
    graph_check3(&value.digit, depth + 1, false, budget)?;
    graph_check1(&value.tail, depth + 1, true, budget)?;
    Ok(())
}
fn graph_to2(value: &Packet, scope: &mut GraphScope) -> Result<GraphRaw2, GraphError> {
    let _ = (&value, &scope);
    Ok(GraphRaw2 { field0: graph_to3(&value.value, scope)?, field1: graph_to3(&value.digit, scope)?, field2: { let child = graph_to1(&value.tail, scope)?; scope.one(child)? }, ..Default::default() })
}
unsafe fn graph_from2(value: &GraphRaw2, depth: usize, native_storage: bool, host_storage: bool, scope: &mut GraphScope) -> Result<Packet, GraphError> {
    let _ = value;
    scope.budget.enter(depth)?;
    if native_storage { scope.budget.native(1, std::mem::size_of::<GraphRaw2>())?; }
    if host_storage { scope.budget.storage(1, std::mem::size_of::<Packet>())?; }
    Ok(Packet { value: graph_from3(&value.field0, depth + 1, false, false, scope)?, digit: graph_from3(&value.field1, depth + 1, false, false, scope)?, tail: graph_from1(graph_read(value.field2)?, depth + 1, true, false, scope)? })
}
fn graph_check3(value: &BigUint, depth: usize, native_storage: bool, budget: &mut GraphBudget) -> Result<(), GraphError> {
    let _ = value;
    budget.enter(depth)?;
    if native_storage { budget.native(1, std::mem::size_of::<GraphRaw3>())?; }
    let limbs = usize::try_from(value.bits().div_ceil(32)).map_err(|_| GraphError::Limit)?;
    budget.native(limbs, 4)?;
    Ok(())
}
fn graph_to3(value: &BigUint, scope: &mut GraphScope) -> Result<GraphRaw3, GraphError> {
    let _ = (&value, &scope);
    let limbs = usize::try_from(value.bits().div_ceil(32)).map_err(|_| GraphError::Limit)?;
    let mut digits = scope.vector::<u32>(limbs)?; digits.extend(value.iter_u32_digits());
    Ok(GraphRaw3 { data: scope.keep(digits)?, length: limbs, ..Default::default() })
}
unsafe fn graph_from3(value: &GraphRaw3, depth: usize, native_storage: bool, host_storage: bool, scope: &mut GraphScope) -> Result<BigUint, GraphError> {
    let _ = value;
    scope.budget.enter(depth)?;
    if native_storage { scope.budget.native(1, std::mem::size_of::<GraphRaw3>())?; }
    if host_storage { scope.budget.storage(1, std::mem::size_of::<BigUint>())?; }
    scope.budget.native(value.length, 4)?; scope.budget.storage(value.length, 4)?;
    let digits = graph_slice(value.data, value.length)?; graph_checkpoint()?;
    Ok(BigUint::from_slice(digits))
}
unsafe fn graph_call_echo(invoke: unsafe extern "C" fn(*const GraphRaw2, *mut GraphRaw2) -> u32, arg0: &Packet) -> Result<Packet, GraphError> {
    unsafe { graph_call_echo_guarded(None, invoke, arg0) }
}
unsafe fn graph_call_echo_guarded(lifecycle: Option<&GraphLifecycle>, invoke: unsafe extern "C" fn(*const GraphRaw2, *mut GraphRaw2) -> u32, arg0: &Packet) -> Result<Packet, GraphError> {
    let mut budget = GraphBudget::new();
    graph_check2(arg0, 0, true, &mut budget)?;
    if let Some(runtime) = lifecycle { graph_finish(graph_status(unsafe { (runtime.initialize)() }), lifecycle)?; }
    let mut scope = GraphScope::new(budget);
    let input0 = graph_to2(arg0, &mut scope)?;
    let mut output = GraphOutput { value: GraphRaw2::default(), clear: graph_clear2 };
    let result = (|| {
        graph_status(unsafe { invoke(&input0, &mut output.value) })?;
        unsafe { graph_from2(&output.value, 0, true, true, &mut scope) }
    })();
    graph_finish(result, lifecycle)
}
unsafe fn graph_call_echo_groups(invoke: unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw0) -> u32, arg0: &[Graph2c3080f9e24fa7c11cff]) -> Result<Graphbf065e9a21862d87767f, GraphError> {
    unsafe { graph_call_echo_groups_guarded(None, invoke, arg0) }
}
unsafe fn graph_call_echo_groups_guarded(lifecycle: Option<&GraphLifecycle>, invoke: unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw0) -> u32, arg0: &[Graph2c3080f9e24fa7c11cff]) -> Result<Graphbf065e9a21862d87767f, GraphError> {
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
unsafe fn graph_call_first(invoke: unsafe extern "C" fn(*const GraphRaw2, *mut GraphRaw3) -> u32, arg0: &Packet) -> Result<BigUint, GraphError> {
    unsafe { graph_call_first_guarded(None, invoke, arg0) }
}
unsafe fn graph_call_first_guarded(lifecycle: Option<&GraphLifecycle>, invoke: unsafe extern "C" fn(*const GraphRaw2, *mut GraphRaw3) -> u32, arg0: &Packet) -> Result<BigUint, GraphError> {
    let mut budget = GraphBudget::new();
    graph_check2(arg0, 0, true, &mut budget)?;
    if let Some(runtime) = lifecycle { graph_finish(graph_status(unsafe { (runtime.initialize)() }), lifecycle)?; }
    let mut scope = GraphScope::new(budget);
    let input0 = graph_to2(arg0, &mut scope)?;
    let mut output = GraphOutput { value: GraphRaw3::default(), clear: graph_clear3 };
    let result = (|| {
        graph_status(unsafe { invoke(&input0, &mut output.value) })?;
        unsafe { graph_from3(&output.value, 0, true, true, &mut scope) }
    })();
    graph_finish(result, lifecycle)
}
unsafe fn graph_call_groups(invoke: unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw3) -> u32, arg0: &[Graph2c3080f9e24fa7c11cff]) -> Result<BigUint, GraphError> {
    unsafe { graph_call_groups_guarded(None, invoke, arg0) }
}
unsafe fn graph_call_groups_guarded(lifecycle: Option<&GraphLifecycle>, invoke: unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw3) -> u32, arg0: &[Graph2c3080f9e24fa7c11cff]) -> Result<BigUint, GraphError> {
    let mut budget = GraphBudget::new();
    graph_check0(arg0, 0, true, &mut budget)?;
    if let Some(runtime) = lifecycle { graph_finish(graph_status(unsafe { (runtime.initialize)() }), lifecycle)?; }
    let mut scope = GraphScope::new(budget);
    let input0 = graph_to0(arg0, &mut scope)?;
    let mut output = GraphOutput { value: GraphRaw3::default(), clear: graph_clear3 };
    let result = (|| {
        graph_status(unsafe { invoke(&input0, &mut output.value) })?;
        unsafe { graph_from3(&output.value, 0, true, true, &mut scope) }
    })();
    graph_finish(result, lifecycle)
}
unsafe fn graph_call_produce(invoke: unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw2) -> u32, arg0: &BigUint) -> Result<Packet, GraphError> {
    unsafe { graph_call_produce_guarded(None, invoke, arg0) }
}
unsafe fn graph_call_produce_guarded(lifecycle: Option<&GraphLifecycle>, invoke: unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw2) -> u32, arg0: &BigUint) -> Result<Packet, GraphError> {
    let mut budget = GraphBudget::new();
    graph_check3(arg0, 0, true, &mut budget)?;
    if let Some(runtime) = lifecycle { graph_finish(graph_status(unsafe { (runtime.initialize)() }), lifecycle)?; }
    let mut scope = GraphScope::new(budget);
    let input0 = graph_to3(arg0, &mut scope)?;
    let mut output = GraphOutput { value: GraphRaw2::default(), clear: graph_clear2 };
    let result = (|| {
        graph_status(unsafe { invoke(&input0, &mut output.value) })?;
        unsafe { graph_from2(&output.value, 0, true, true, &mut scope) }
    })();
    graph_finish(result, lifecycle)
}
unsafe fn graph_call_second(invoke: unsafe extern "C" fn(*const GraphRaw2, *mut GraphRaw3) -> u32, arg0: &Packet) -> Result<BigUint, GraphError> {
    unsafe { graph_call_second_guarded(None, invoke, arg0) }
}
unsafe fn graph_call_second_guarded(lifecycle: Option<&GraphLifecycle>, invoke: unsafe extern "C" fn(*const GraphRaw2, *mut GraphRaw3) -> u32, arg0: &Packet) -> Result<BigUint, GraphError> {
    let mut budget = GraphBudget::new();
    graph_check2(arg0, 0, true, &mut budget)?;
    if let Some(runtime) = lifecycle { graph_finish(graph_status(unsafe { (runtime.initialize)() }), lifecycle)?; }
    let mut scope = GraphScope::new(budget);
    let input0 = graph_to2(arg0, &mut scope)?;
    let mut output = GraphOutput { value: GraphRaw3::default(), clear: graph_clear3 };
    let result = (|| {
        graph_status(unsafe { invoke(&input0, &mut output.value) })?;
        unsafe { graph_from3(&output.value, 0, true, true, &mut scope) }
    })();
    graph_finish(result, lifecycle)
}

#[path = "assets.rs"] mod assets;
unsafe extern "C" { #[link_name = "dlsym"] fn graph_symbol(library: *mut std::ffi::c_void, name: *const std::ffi::c_char) -> *mut std::ffi::c_void; }
struct GraphNative {
    lifecycle: GraphLifecycle,
    diagnostic: unsafe extern "C" fn() -> *const std::ffi::c_char,
    call0: unsafe extern "C" fn(*const GraphRaw2, *mut GraphRaw2) -> u32,
    call1: unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw0) -> u32,
    call2: unsafe extern "C" fn(*const GraphRaw2, *mut GraphRaw3) -> u32,
    call3: unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw3) -> u32,
    call4: unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw2) -> u32,
    call5: unsafe extern "C" fn(*const GraphRaw2, *mut GraphRaw3) -> u32,
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
                initialize: symbol!("recursivecheckedrecords_graph_initialize", unsafe extern "C" fn() -> u32),
                ready: symbol!("recursivecheckedrecords_graph_ready", unsafe extern "C" fn() -> i32),
                retire: symbol!("recursivecheckedrecords_graph_retire", unsafe extern "C" fn()),
            },
            diagnostic: symbol!("recursivecheckedrecords_graph_error", unsafe extern "C" fn() -> *const std::ffi::c_char),
            call0: symbol!("recursivecheckedrecords_echo_graph", unsafe extern "C" fn(*const GraphRaw2, *mut GraphRaw2) -> u32),
            call1: symbol!("recursivecheckedrecords_echo_groups_graph", unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw0) -> u32),
            call2: symbol!("recursivecheckedrecords_first_graph", unsafe extern "C" fn(*const GraphRaw2, *mut GraphRaw3) -> u32),
            call3: symbol!("recursivecheckedrecords_groups_graph", unsafe extern "C" fn(*const GraphRaw0, *mut GraphRaw3) -> u32),
            call4: symbol!("recursivecheckedrecords_produce_graph", unsafe extern "C" fn(*const GraphRaw3, *mut GraphRaw2) -> u32),
            call5: symbol!("recursivecheckedrecords_second_graph", unsafe extern "C" fn(*const GraphRaw2, *mut GraphRaw3) -> u32),
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

pub(super) fn call0(arg0: &Packet) -> Result<Packet, Error> {
    // Validate before loading assets. The guarded call also checks its inputs
    // and shares one conversion budget between arguments and the result.
    let mut budget = GraphBudget::new();
    graph_check2(arg0, 0, true, &mut budget).map_err(graph_error)?;
    let _ = budget;
    let runtime = graph_runtime()?;
    unsafe { graph_call_echo_guarded(Some(&runtime.lifecycle), runtime.call0, arg0) }.map_err(|error| graph_checked_error(error, runtime.diagnostic))
}

pub(super) fn call1(arg0: &[Graph2c3080f9e24fa7c11cff]) -> Result<Graphbf065e9a21862d87767f, Error> {
    // Validate before loading assets. The guarded call also checks its inputs
    // and shares one conversion budget between arguments and the result.
    let mut budget = GraphBudget::new();
    graph_check0(arg0, 0, true, &mut budget).map_err(graph_error)?;
    let _ = budget;
    let runtime = graph_runtime()?;
    unsafe { graph_call_echo_groups_guarded(Some(&runtime.lifecycle), runtime.call1, arg0) }.map_err(|error| graph_checked_error(error, runtime.diagnostic))
}

pub(super) fn call2(arg0: &Packet) -> Result<BigUint, Error> {
    // Validate before loading assets. The guarded call also checks its inputs
    // and shares one conversion budget between arguments and the result.
    let mut budget = GraphBudget::new();
    graph_check2(arg0, 0, true, &mut budget).map_err(graph_error)?;
    let _ = budget;
    let runtime = graph_runtime()?;
    unsafe { graph_call_first_guarded(Some(&runtime.lifecycle), runtime.call2, arg0) }.map_err(|error| graph_checked_error(error, runtime.diagnostic))
}

pub(super) fn call3(arg0: &[Graph2c3080f9e24fa7c11cff]) -> Result<BigUint, Error> {
    // Validate before loading assets. The guarded call also checks its inputs
    // and shares one conversion budget between arguments and the result.
    let mut budget = GraphBudget::new();
    graph_check0(arg0, 0, true, &mut budget).map_err(graph_error)?;
    let _ = budget;
    let runtime = graph_runtime()?;
    unsafe { graph_call_groups_guarded(Some(&runtime.lifecycle), runtime.call3, arg0) }.map_err(|error| graph_checked_error(error, runtime.diagnostic))
}

pub(super) fn call4(arg0: &BigUint) -> Result<Packet, Error> {
    // Validate before loading assets. The guarded call also checks its inputs
    // and shares one conversion budget between arguments and the result.
    let mut budget = GraphBudget::new();
    graph_check3(arg0, 0, true, &mut budget).map_err(graph_error)?;
    let _ = budget;
    let runtime = graph_runtime()?;
    unsafe { graph_call_produce_guarded(Some(&runtime.lifecycle), runtime.call4, arg0) }.map_err(|error| graph_checked_error(error, runtime.diagnostic))
}

pub(super) fn call5(arg0: &Packet) -> Result<BigUint, Error> {
    // Validate before loading assets. The guarded call also checks its inputs
    // and shares one conversion budget between arguments and the result.
    let mut budget = GraphBudget::new();
    graph_check2(arg0, 0, true, &mut budget).map_err(graph_error)?;
    let _ = budget;
    let runtime = graph_runtime()?;
    unsafe { graph_call_second_guarded(Some(&runtime.lifecycle), runtime.call5, arg0) }.map_err(|error| graph_checked_error(error, runtime.diagnostic))
}
