import Lean
import Lean.Compiler.IR.EmitUtil

/- Read freshly compiled application interfaces, not source text or package declarations.
   The generated host module is the only authorized source of foreign imports. -/
open Lean Meta

namespace LeanBridge.HostExports

structure Nominal where
  lean : String
  id : String
  deriving FromJson

structure PullProtocol where
  «open» : String
  next : String
  close : String
  deriving FromJson, ToJson

structure Request where
  modules : Array String
  exportModules : Array String
  exports : Array String
  taskExports : Array String
  asyncIterators : Array PullProtocol
  resources : Array Nominal
  hostModule : Option String := none
  leanResources : Array String := #[]
  pythonTaskCallbacks : Option Bool := none
  pythonTaskObjects : Option Bool := none
  rustTaskCallbacks : Option Bool := none
  cppTaskCallbacks : Option Bool := none
  cTaskCallbacks : Option Bool := none
  staticTaskOwner : Option String := none
  rubyTaskCallbacks : Option Bool := none
  rubyTaskObjects : Option Bool := none
  dotnetTaskCallbacks : Option Bool := none
  dotnetTaskObjects : Option Bool := none
  jvmTaskCallbacks : Option Bool := none
  jvmTaskObjects : Option Bool := none
  perlTaskCallbacks : Option Bool := none
  perlTaskObjects : Option Bool := none
  phpTaskCallbacks : Option Bool := none
  phpNativeTaskObjects : Option Bool := none
  phpNativeFunctions : Option Bool := none
  phpWasmTaskObjects : Option Bool := none
  javascriptTaskCallbacks : Option Bool := none
  javascriptThreadedHostMembers : Option Bool := none
  witTaskCallbacks : Option Bool := none
  witCursorIO : Option Bool := none
  taskIOErrors : Option (Array String) := none
  nativeEffectPolicy : Option String := none
  synchronousIO : Option Bool := none
  members : Array String
  deriving FromJson

def Request.ownerTaskCallbacks (r : Request) : Bool :=
  r.pythonTaskCallbacks.getD false || r.rustTaskCallbacks.getD false ||
    r.cppTaskCallbacks.getD false || r.cTaskCallbacks.getD false || r.rubyTaskCallbacks.getD false ||
    r.dotnetTaskCallbacks.getD false || r.jvmTaskCallbacks.getD false || r.perlTaskCallbacks.getD false ||
    r.phpTaskCallbacks.getD false || r.javascriptTaskCallbacks.getD false ||
    r.witTaskCallbacks.getD false

def Request.ownerHostMembers (r : Request) : Bool :=
  r.javascriptThreadedHostMembers == some true && r.hostModule == some "LeanBridge.Host.Javascript" &&
    (!r.taskExports.isEmpty || !r.asyncIterators.isEmpty)

/-- PHP workers may carry opaque objects to an owner callback, but may
    not invoke PHP members themselves. Do not grant the JS dispatcher here. -/
def Request.phpTaskObjects (r : Request) : Bool :=
  ((r.phpNativeTaskObjects == some true && r.phpWasmTaskObjects.isNone) ||
    (r.phpWasmTaskObjects == some true && r.phpNativeTaskObjects.isNone)) &&
    r.hostModule == some "LeanBridge.Host.Php" &&
    (!r.taskExports.isEmpty || !r.asyncIterators.isEmpty) &&
    (r.phpTaskCallbacks == some true) == !r.taskExports.isEmpty

/-- An opaque Python object may travel with the worker. Only its asyncio owner
    calls the application, never the worker or a Lean external finalizer. -/
def Request.pythonObjects (r : Request) : Bool :=
  r.pythonTaskObjects == some true && r.hostModule == some "LeanBridge.Host.Python" &&
    (!r.taskExports.isEmpty || !r.asyncIterators.isEmpty) &&
    (r.pythonTaskCallbacks == some true) == !r.taskExports.isEmpty

/-- MRI words carry an opaque identity, never permission to invoke MRI on a worker. -/
def Request.rubyObjects (r : Request) : Bool :=
  r.rubyTaskObjects == some true && r.hostModule == some "LeanBridge.Host.Ruby" &&
    (!r.taskExports.isEmpty || !r.asyncIterators.isEmpty) &&
    (r.rubyTaskCallbacks == some true) == !r.taskExports.isEmpty

/-- A Lean worker may carry a CLR instance; only the binding's owner may invoke its members. -/
def Request.dotnetObjects (r : Request) : Bool :=
  r.dotnetTaskObjects == some true && r.hostModule == some "LeanBridge.Host.Dotnet" &&
    (!r.taskExports.isEmpty || !r.asyncIterators.isEmpty) &&
    (r.dotnetTaskCallbacks == some true) == !r.taskExports.isEmpty

/-- A worker carries a Java class as data; JNI member calls belong to the bound host. -/
def Request.jvmObjects (r : Request) : Bool :=
  r.jvmTaskObjects == some true && r.hostModule == some "LeanBridge.Host.Jvm" &&
    (!r.taskExports.isEmpty || !r.asyncIterators.isEmpty) &&
    (r.jvmTaskCallbacks == some true) == !r.taskExports.isEmpty

/-- A worker may carry an opaque Perl object, but only its interpreter may call a member. -/
def Request.perlObjects (r : Request) : Bool :=
  r.perlTaskObjects == some true && r.hostModule == some "LeanBridge.Host.Perl" &&
    (!r.taskExports.isEmpty || !r.asyncIterators.isEmpty) &&
    (r.perlTaskCallbacks == some true) == !r.taskExports.isEmpty

/-- Native owners transport opaque objects. Only the owner's callback may
    dereference one; selecting a different scheduler does not grant access. -/
def Request.staticObjects (r : Request) : Bool :=
  let hasTasks := !r.taskExports.isEmpty
  let markers := #[r.cTaskCallbacks, r.cppTaskCallbacks, r.rustTaskCallbacks,
    r.pythonTaskCallbacks, r.rubyTaskCallbacks, r.dotnetTaskCallbacks, r.jvmTaskCallbacks,
    r.perlTaskCallbacks, r.phpTaskCallbacks, r.javascriptTaskCallbacks, r.witTaskCallbacks]
  let matchesOwner := fun (mod : String) (flag : Option Bool) =>
    r.hostModule == some mod && flag == (if hasTasks then some true else none)
  (hasTasks || !r.asyncIterators.isEmpty) && (markers.filter Option.isSome).size == (if hasTasks then 1 else 0) &&
    match r.staticTaskOwner with
    | some "c" => matchesOwner "LeanBridge.Host.C" r.cTaskCallbacks
    | some "cpp" => matchesOwner "LeanBridge.Host.Cpp" r.cppTaskCallbacks
    | some "rust" => matchesOwner "LeanBridge.Host.Rust" r.rustTaskCallbacks
    | some "wit-wasi" => matchesOwner "LeanBridge.Host.WitWasi" r.witTaskCallbacks
    | _ => false

def Request.staticLabel (r : Request) : String :=
  if r.staticTaskOwner == some "c" then "C" else if r.staticTaskOwner == some "cpp" then "C++" else if r.staticTaskOwner == some "wit-wasi" then "WIT/WASI" else "Rust"

def Request.localObjects (r : Request) : Bool :=
  r.pythonObjects || r.rubyObjects || r.dotnetObjects || r.jvmObjects || r.perlObjects || r.staticObjects

def Request.hostValues (r : Request) : Bool := r.ownerHostMembers || r.phpTaskObjects || r.localObjects

/-- A task in a package does not change the delivery mode of adjacent exports. -/
def Request.immediateValues (r : Request) : Bool :=
  r.synchronousIO.getD false ||
    ((r.resources.isEmpty || r.hostValues) && (!r.taskExports.isEmpty || !r.asyncIterators.isEmpty))

def primitives : List (Name × String) := [
  (``Unit, "unit"), (``Bool, "bool"), (``Char, "char"), (``String, "string"),
  (``ByteArray, "bytes"), (``Nat, "nat"), (``Int, "int"), (``Float, "float64"),
  (``Float32, "float32"), (``USize, "usize"), (``ISize, "isize"),
  (``UInt8, "uint8"), (``UInt16, "uint16"), (``UInt32, "uint32"), (``UInt64, "uint64"),
  (``Int8, "int8"), (``Int16, "int16"), (``Int32, "int32"), (``Int64, "int64")]

def carrier (request : Request) (e : Expr) : MetaM Json := do
  let e ← instantiateMVars e
  if let .const name _ := e.consumeMData then
    if let some (_, tag) := primitives.find? (·.1 == name) then
      return Json.mkObj [("kind", toJson "primitive"), ("name", toJson tag)]
    if let some r := request.resources.find? (·.lean == name.toString) then
      return Json.mkObj [("kind", toJson "named"), ("id", toJson r.id)]
    if request.leanResources.contains name.toString then
      return Json.mkObj [("kind", toJson "named"), ("id", toJson ("lean:" ++ name.toString))]
  throwError "unsupported host export carrier: {e}"

/-- A returned Except is a value. Its success arm is first in Binding IR. -/
partial def returned (r : Request) (e : Expr) (copyOnly := false) (hostLeases := false) : MetaM Json := do
  let e := (← instantiateMVars e).consumeMData
  let args := e.getAppArgs
  if e.getAppFn.constName? == some ``Except && args.size == 2 then
    return Json.mkObj [("kind", toJson "apply"), ("constructor", toJson "result"),
      ("arguments", Json.arr #[← returned r args[1]! true hostLeases, ← returned r args[0]! true hostLeases])]
  let t ← carrier r e
  if copyOnly && e.constName?.any (fun n => r.leanResources.contains n.toString) then
    throwError "a leased Lean resource cannot be a copied exception payload: {e}"
  if copyOnly && !primitives.any (fun p => e.constName? == some p.1) then
    -- Only ports with an explicit host lease can expose a nominal result.
    if hostLeases && (r.hostModule.any (fun m =>
        #["LeanBridge.Host.Dotnet", "LeanBridge.Host.Jvm", "LeanBridge.Host.Ruby", "LeanBridge.Host.Python",
          "LeanBridge.Host.C", "LeanBridge.Host.Cpp", "LeanBridge.Host.Rust", "LeanBridge.Host.WitWasi", "LeanBridge.Host.Perl", "LeanBridge.Host.Javascript", "LeanBridge.Host.Php"].contains m)) &&
        e.constName?.any (fun n => r.resources.any (fun k => k.lean == n.toString)) then return t
    throwError "an owned host object cannot be a copied exception payload: {e}"
  return t

/-- A function delivered by a factory is not a retained host callback.
    Only admit a host with a binding-owned invocation and revocation path. -/
def immediateResult (r : Request) (effect : Name) (e : Expr) : MetaM Json := do
  if effect == ``IO && (r.phpNativeFunctions == some true || r.hostModule.any (fun m => #["LeanBridge.Host.Python", "LeanBridge.Host.Ruby", "LeanBridge.Host.C", "LeanBridge.Host.Cpp", "LeanBridge.Host.Rust", "LeanBridge.Host.Dotnet", "LeanBridge.Host.Jvm"].contains m)) &&
      r.nativeEffectPolicy == some "native-host-io-v1" then
    if let .forallE _ a b .default := (← instantiateMVars e).consumeMData then
      let b := b.consumeMData
      unless !b.hasLooseBVars && b.getAppFn.constName? == some ``IO && b.getAppArgs.size == 1 do
        throwError "returned host closures require a nondependent unary IO function: {e}"
      let reply := b.getAppArgs[0]!
      let admitted := fun (t : Expr) => primitives.any (fun p => t.isConstOf p.1) ||
        t.constName?.any (fun n => r.resources.any (fun k => k.lean == n.toString))
      unless admitted a && admitted reply do
        throwError "returned host closure arguments and replies must be copied scalars or declared host objects: {e}"
      return Json.mkObj [("kind", toJson "io-closure"), ("argument", ← carrier r a), ("reply", ← carrier r reply)]
  returned r e false true

/-- Admit a leased nominal by itself, or a checked host lease in a synchronous declared error. -/
def delivered (r : Request) (e : Expr) (hostLeases := false) : MetaM Json := do
  if let some name := (← instantiateMVars e).consumeMData.constName? then
    if r.leanResources.contains name.toString then return ← carrier r e
  returned r e true hostLeases

/-- An actual unary, nondependent IO function, not a foreign host object or a pure borrow. -/
def taskInput (r : Request) (e : Expr) : MetaM Json := do
  if r.ownerTaskCallbacks then
    if let .forallE _ a b .default := (← instantiateMVars e).consumeMData then
      let b := b.consumeMData
      unless !b.hasLooseBVars && b.getAppFn.constName? == some ``IO && b.getAppArgs.size == 1 do
        throwError "retained task callbacks require an explicit unary IO function: {e}"
      let v := b.getAppArgs[0]!
      let admitted := fun (t : Expr) =>
        primitives.any (fun p => t.constName? == some p.1) ||
        (((r.ownerHostMembers && r.javascriptTaskCallbacks == some true) || r.phpTaskObjects || r.localObjects) &&
          t.constName?.any (fun n => r.resources.any (fun k => k.lean == n.toString)))
      unless [a, v].all admitted do
        if r.staticObjects then
          throwError "retained task callback arguments and replies must be copied scalars or declared {r.staticLabel} owner classes: {e}"
        else if r.ownerHostMembers then
          throwError "retained task callback arguments and replies must be copied scalars or declared JavaScript owner classes: {e}"
        else if r.rubyObjects then
          throwError "retained task callback arguments and replies must be copied scalars or declared Ruby owner classes: {e}"
        else if r.dotnetObjects then
          throwError "retained task callback arguments and replies must be copied scalars or declared CLR owner classes: {e}"
        else if r.jvmObjects then
          throwError "retained task callback arguments and replies must be copied scalars or declared JVM owner classes: {e}"
        else if r.perlObjects then
          throwError "retained task callback arguments and replies must be copied scalars or declared Perl owner classes: {e}"
        else if r.pythonObjects then
          throwError "retained task callback arguments and replies must be copied scalars or declared Python owner classes: {e}"
        else if r.phpTaskObjects then
          throwError "retained task callback arguments and replies must be copied scalars or declared PHP owner classes: {e}"
        else
          throwError "retained task callback arguments and replies must be copied scalars: {e}"
      return Json.mkObj [("kind", toJson "io-callback"), ("argument", ← carrier r a), ("reply", ← carrier r v)]
  delivered r e r.hostValues

/-- Match the native extractor's definite-heap rule; tagged/scalar values have no stable identity. -/
def resourceOwner (r : Request) (name : String) : MetaM Json := do
  let env ← getEnv
  let n := name.toName
  let info ← getConstInfo n
  let some idx := env.getModuleIdxFor? n | throwError "no owner for resource {n}"
  let owner := env.header.modules[idx.toNat]!.module.toString
  match info with
  | .inductInfo _ | .defnInfo _ | .opaqueInfo _ => pure ()
  | _ => throwError "resource must have an executable application definition: {n}"
  unless r.modules.contains owner && r.hostModule != some owner && !isPrivateName n &&
      !isProtected env n && info.levelParams.isEmpty && info.type.isSort && !info.type.isProp do
    throwError "resource must be a public concrete application type: {n}"
  let ty := mkConst n
  let lowered ← Compiler.LCNF.toImpureType (← Compiler.LCNF.toMonoType (← Compiler.LCNF.toLCNFType ty))
  unless lowered == Compiler.LCNF.ImpureType.object do
    throwError "resource has no stable heap identity: {n}"
  return Json.mkObj [("declaration", toJson name), ("module", toJson owner)]

partial def checkDependencies (r : Request) (n : Name) (seen : NameSet) : MetaM NameSet := do
  if seen.contains n then return seen
  let mut seen := seen.insert n
  let env ← getEnv
  let some index := env.getModuleIdxFor? n | return seen
  let module := env.header.modules[index.toNat]!.module.toString
  if r.hostModule == some module then
    if isExtern env n && !r.members.contains n.toString then throwError "undeclared host member {n}"
    return seen
  if !r.modules.contains module then return seen
  let info ← getConstInfo n
  if info.isUnsafe || info.isPartial || (env.find? (Compiler.mkUnsafeRecName n)).any (·.isPartial)
    || isExtern env n || (Compiler.getImplementedBy? env n).isSome then
    throwError "unreviewed unsafe, partial or foreign application declaration: {n}"
  if let some initFn := getInitFnNameFor? env n then
    unless env.getModuleIdxFor? initFn == some index && initFn != n do
      throwError "unreviewed application initializer: {n}"
    if (← collectAxioms initFn).contains ``sorryAx then throwError "initializer {initFn} depends on sorry"
    seen ← checkDependencies r initFn seen
  else if let .axiomInfo _ := info then throwError "unimplemented application axiom: {n}"
  if let some v := info.value? (allowOpaque := true) then
    for dep in v.getUsedConstants do seen ← checkDependencies r dep seen
  return seen

def noWorkerHost (r : Request) (deps : NameSet) (n : Name) : MetaM Unit := do
  if r.ownerHostMembers then return
  if r.staticObjects then
    if r.members.any (fun m => deps.contains m.toName) then
      throwError "{r.staticLabel} task calls a {r.staticLabel} member outside its owner: {n}"
    return
  if r.perlObjects then
    if r.members.any (fun m => deps.contains m.toName) then
      throwError "Perl task calls a Perl member outside its owner: {n}"
    return
  if r.jvmObjects then
    if r.members.any (fun m => deps.contains m.toName) then
      throwError "JVM task calls a JVM member outside its owner: {n}"
    return
  if r.dotnetObjects then
    if r.members.any (fun m => deps.contains m.toName) then
      throwError "CLR task calls a CLR member outside its owner: {n}"
    return
  if r.rubyObjects then
    if r.members.any (fun m => deps.contains m.toName) then
      throwError "Ruby task calls a Ruby member outside its owner: {n}"
    return
  if r.pythonObjects then
    if r.members.any (fun m => deps.contains m.toName) then
      throwError "Python task calls a Python member outside its owner: {n}"
    return
  if r.phpTaskObjects then
    if r.members.any (fun m => deps.contains m.toName) then
      if r.phpWasmTaskObjects == some true then
        throwError "PHP-Wasm worker calls a PHP member outside its owner: {n}"
      throwError "native PHP task calls a PHP member outside its owner: {n}"
    return
  if r.members.any (fun m => deps.contains m.toName) || r.resources.any (fun t => deps.contains t.lean.toName) then
    throwError "host identities or calls cannot cross this task scheduler: {n}"

/-- Read each protocol member independently; a review cannot authorize a different cursor or an extern. -/
def cursorMember (r : Request) (memberName : String) (cursor : Expr) : MetaM (Expr × NameSet) := do
  let n := memberName.toName
  let env ← getEnv
  let info ← getConstInfo n
  let some idx := env.getModuleIdxFor? n | throwError "missing cursor operation {n}"
  unless r.exportModules.contains env.header.modules[idx.toNat]!.module.toString &&
      !isPrivateName n && !isProtected env n && info.levelParams.isEmpty do
    throwError "cursor operation must be a public monomorphic application definition: {n}"
  match info with
  | .defnInfo _ | .opaqueInfo _ => pure ()
  | _ => throwError "expected an executable cursor operation: {n}"
  let deps ← checkDependencies r n {}
  noWorkerHost r deps n
  if (← collectAxioms n).contains ``sorryAx then throwError "cursor operation {n} depends on sorry"
  forallTelescope info.type fun args result => do
    unless args.size == 1 do throwError "cursor operation takes exactly one cursor: {n}"
    let d ← args[0]!.fvarId!.getDecl
    unless d.binderInfo == .default && (← isDefEq d.type cursor) && !result.hasFVar do
      throwError "cursor operation has the wrong cursor or a dependent result: {n}"
    return (result.consumeMData, deps)

def usedMembers (r : Request) (deps : NameSet) : Array String :=
  r.members.filter (fun m => deps.contains m.toName)

def pullFields (r : Request) (p : PullProtocol) (result : Expr) (deps : NameSet) : MetaM (List (String × Json)) := do
  noWorkerHost r deps p.open.toName
  let head := result.getAppFn.constName?
  let args := result.getAppArgs
  let (effect, cursor, extra) ← if (head == some ``IO || head == some ``BaseIO) && args.size == 1 then
    pure (head.get!.toString, args[0]!, [])
  else if head == some ``EIO && args.size == 2 then
    pure ("EIO", args[1]!, [("error", ← delivered r args[0]! r.hostValues)])
  else pure ("pure", result, [])
  let env ← getEnv
  let some cn := cursor.getAppFn.constName? | throwError "expected an application-owned cursor"
  let some idx := env.getModuleIdxFor? cn | throwError "expected an application-owned cursor: {cn}"
  unless r.modules.contains env.header.modules[idx.toNat]!.module.toString && !cursor.hasFVar do
    throwError "expected a concrete application-owned cursor: {cn}"
  let (stop, closeDeps) ← cursorMember r p.close cursor
  unless (← isDefEq stop (← mkAppM ``BaseIO #[mkConst ``Unit])) do
    throwError "cursor close must return BaseIO Unit: {p.close}"
  let (step, pullDeps) ← cursorMember r p.next cursor
  unless step.getAppFn.constName? == some ``BaseIO && step.getAppArgs.size == 1 do
    throwError "cursor next must return BaseIO (Task ...): {p.next}"
  let task := step.getAppArgs[0]!
  unless task.getAppFn.constName? == some ``Task && task.getAppArgs.size == 1 do
    throwError "cursor next must return a real Task: {p.next}"
  let v := task.getAppArgs[0]!
  let (item, failure) ← if v.getAppFn.constName? == some ``Except && v.getAppArgs.size == 2 then
    let err := v.getAppArgs[0]!
    if (r.hostValues || r.witCursorIO == some true) && err.isConstOf ``IO.Error then
      pure (v.getAppArgs[1]!, [("stepIO", toJson true)])
    else pure (v.getAppArgs[1]!, [("stepError", ← delivered r err r.hostValues)])
  else pure (v, [])
  unless item.getAppFn.constName? == some ``Option && item.getAppArgs.size == 1 do
    throwError "cursor step must distinguish exhaustion with Option: {p.next}"
  return [("effect", toJson effect), ("delivery", toJson "async-iterator"),
    ("protocol", toJson p), ("result", ← delivered r item.getAppArgs[0]! r.hostValues)] ++ extra ++ failure ++
    (if r.ownerHostMembers || r.phpWasmTaskObjects == some true || r.localObjects then [("protocolHostMembers", Json.mkObj [
      ("pull", toJson (usedMembers r pullDeps)), ("close", toJson (usedMembers r closeDeps))])] else [])

/-- Module-system imports store code in the IR section; classic application modules
    store it alongside their declarations. Look up the exact symbol in either case. -/
private def compiled? (env : Environment) (n : Name) : Option IR.Decl := do
  let index ← env.getModuleIdxFor? n
  let find := fun (ds : Array IR.Decl) => ds.binSearch (IR.Decl.extern n #[] default default)
    (fun a b => Name.quickLt a.name b.name)
  find (IR.declMapExt.getModuleIREntries env index) <|> find (IR.declMapExt.getModuleEntries env index)

/-- Allocating a partial application in a global does not run the function.
    Its body is still inspected if reachable from any entry that uses the closure. -/
private partial def mayCall : IR.FnBody → Bool
  | .vdecl _ _ (.fap ..) _ | .vdecl _ _ (.ap ..) _ => true
  | .jdecl _ _ v b => mayCall v || mayCall b
  | .case _ _ _ alts => alts.any (fun a => mayCall a.body)
  | b => !b.isTerminal && mayCall b.body

/-- Follow codegen's dependencies, including partially applied workers, without
    calling the application. An opaque implementation is not evidence of purity. -/
private partial def nativeLeaves (env : Environment) (root : Name) (pending : List Name)
    (seen : NameSet := {}) (leaves : Array Json := #[]) : MetaM (Array Json) := do
  let n :: rest := pending | return leaves
  if seen.contains n then return ← nativeLeaves env root rest seen leaves
  let seen := seen.insert n
  match compiled? env n with
  | some (d@(.fdecl ..)) =>
    return ← nativeLeaves env root ((IR.collectUsedDecls env [d]).toList ++ rest) seen leaves
  | some (.extern _ _ _ attr) =>
    let some (.standard _ symbol) := getExternEntryFor attr `c
      | throwError "native effect policy: {root} reaches unclassified native implementation {n}"
    let some index := env.getModuleIdxFor? n | throwError "native effect policy: no owner for {n}"
    let leaf := Json.mkObj [("name", toJson n.toString), ("symbol", toJson symbol),
      ("module", toJson env.header.modules[index.toNat]!.module.toString)]
    return ← nativeLeaves env root rest seen (leaves.push leaf)
  | none => throwError "native effect policy: {root} reaches {n} without compiled IR"

def extract (r : Request) : MetaM Json := do
  let env ← getEnv
  if r.staticTaskOwner.isSome && !r.staticObjects then
    throwError "invalid static worker object owner"
  if r.witCursorIO.isSome && (r.witCursorIO != some true || r.hostModule.isSome || r.asyncIterators.isEmpty) then
    throwError "invalid standalone WIT cursor IO selection"
  if r.javascriptThreadedHostMembers.isSome && !r.ownerHostMembers then
    throwError "invalid JavaScript owner-dispatch selection"
  if r.phpNativeTaskObjects.isSome && !r.phpTaskObjects then
    throwError "invalid native PHP task object selection"
  if r.phpNativeFunctions.isSome && (r.phpNativeFunctions != some true || r.hostModule != some "LeanBridge.Host.Php" ||
      r.phpWasmTaskObjects.isSome || r.nativeEffectPolicy != some "native-host-io-v1") then
    throwError "invalid native PHP returned-function owner"
  if r.pythonTaskObjects.isSome && !r.pythonObjects then
    throwError "invalid Python task object selection"
  if r.rubyTaskObjects.isSome && !r.rubyObjects then
    throwError "invalid Ruby task object selection"
  if r.jvmTaskObjects.isSome && !r.jvmObjects then
    throwError "invalid JVM task object selection"
  if r.perlTaskObjects.isSome && !r.perlObjects then
    throwError "invalid Perl task object selection"
  if r.dotnetTaskObjects.isSome && !r.dotnetObjects then
    throwError "invalid CLR task object selection"
  if r.phpWasmTaskObjects.isSome && !r.phpTaskObjects then
    throwError "invalid PHP-Wasm task object selection"
  if let some m := r.hostModule then
    unless #["LeanBridge.Host.Python", "LeanBridge.Host.Ruby", "LeanBridge.Host.Jvm", "LeanBridge.Host.Dotnet",
             "LeanBridge.Host.C", "LeanBridge.Host.Cpp", "LeanBridge.Host.Rust", "LeanBridge.Host.WitWasi", "LeanBridge.Host.Perl", "LeanBridge.Host.Javascript", "LeanBridge.Host.Php"].contains m &&
        r.modules.contains m && !r.exportModules.contains m && !r.resources.isEmpty &&
        r.resources.all (fun t => t.lean.startsWith (m ++ ".")) &&
        r.members.all (fun n => n.startsWith (m ++ ".")) do
      throwError "invalid generated host module or member selection"
  else unless r.resources.isEmpty && r.members.isEmpty do
    throwError "imported host resources require a generated host module"
  let owned ← r.leanResources.mapM (resourceOwner r)
  for name in r.leanResources do
    let _ ← checkDependencies r name.toName {}
    if (← collectAxioms name.toName).contains ``sorryAx then throwError "resource {name} depends on sorry"
  -- Module startup runs even declarations that no public function references.
  let mut startup : NameSet := {}
  for module in r.modules do
    if r.hostModule == some module then continue
    let some idx := env.getModuleIdx? module.toName | throwError "missing source module {module}"
    if r.nativeEffectPolicy.isSome then
      -- In addition to 'initialize', codegen may eagerly evaluate an ordinary
      -- zero-arity global. Do not count constructing a literal/closure as a call.
      for ds in #[IR.declMapExt.getModuleIREntries env idx, IR.declMapExt.getModuleEntries env idx] do
        for d in ds do
          if let .fdecl n xs _ body _ := d then
            if xs.isEmpty && !(getInitFnNameFor? env n).isSome &&
                !isClosedTermName env n && !Compiler.LCNF.isSimpleGroundDecl env n && mayCall body then
              startup := startup.insert n
    for n in env.header.moduleData[idx.toNat]!.constNames do
      if (getBuiltinInitFnNameFor? env n).isSome || isIOUnitBuiltinInitFn env n then
        throwError "unreviewed application builtin initializer: {n}"
      if (getInitFnNameFor? env n).isSome || isIOUnitInitFn env n then
        startup := startup.insert ((getInitFnNameFor? env n).getD n)
        let deps ← checkDependencies r n {}
        if (← collectAxioms n).contains ``sorryAx then throwError "initializer {n} depends on sorry"
        if r.members.any (fun m => deps.contains m.toName) then
          throwError "application initializer {n} calls a host before it is bound"
  let mut rows := #[]
  for publicName in r.exports do
    let n := publicName.toName
    let info ← getConstInfo n
    let some idx := env.getModuleIdxFor? n | throwError "no source module for {n}"
    let owner := env.header.modules[idx.toNat]!.module.toString
    unless r.exportModules.contains owner && !isPrivateName n && !isProtected env n && info.levelParams.isEmpty do
      throwError "expected a public monomorphic declaration in a selected module: {n}"
    match info with
    | .defnInfo _ | .opaqueInfo _ => pure ()
    | _ => throwError "not an executable application definition: {n}"
    let deps ← checkDependencies r n {}
    if (← collectAxioms n).contains ``sorryAx then throwError "export {n} depends on sorry"
    -- A host member belongs to its language runtime, not the Lean scheduler.
    -- Check before lowering arguments, where the copied-sum diagnostic is misleading.
    if r.taskExports.contains publicName || r.asyncIterators.any (·.open == publicName) then
      noWorkerHost r deps n
    let row ← forallTelescope info.type fun args result => do
      let mut params := #[]
      for arg in args do
        let decl ← arg.fvarId!.getDecl
        unless decl.binderInfo == .default do throwError "explicit application parameters required: {n}"
        if !r.hostValues && (r.taskExports.contains publicName || r.asyncIterators.any (·.open == publicName)) then
          if let some ty := (← instantiateMVars decl.type).consumeMData.constName? then
            if r.resources.any (·.lean == ty.toString) then
              throwError "host identities or calls cannot cross this task scheduler: {n}"
        let t ← if r.taskExports.contains publicName then taskInput r decl.type else carrier r decl.type
        params := params.push <| Json.mkObj [("name", toJson decl.userName.toString), ("type", t)]
      let result := result.consumeMData
      let some head := result.getAppFn.constName? | throwError "expected synchronous IO result: {n}"
      let resultArgs := result.getAppArgs
      let fields ← if let some protocol := r.asyncIterators.find? (·.open == publicName) then do
        for a in args do
          let _ ← delivered r (← a.fvarId!.getDecl).type r.hostValues
        pullFields r protocol result deps
      else if r.taskExports.contains publicName then do
        let (effect, task, extra) ← if head == ``Task then
          pure ("pure", result, [])
        else if (head == ``IO || head == ``BaseIO) && resultArgs.size == 1 then
          pure (head.toString, resultArgs[0]!, [])
        else if head == ``EIO && resultArgs.size == 2 then
          pure ("EIO", resultArgs[1]!, [("error", ← delivered r resultArgs[0]! r.hostValues)])
        else throwError "taskExports requires a real Lean Task result: {n}"
        unless task.getAppFn.constName? == some ``Task && task.getAppArgs.size == 1 do
          throwError "taskExports requires a real Lean Task result: {n}"
        let payload := task.getAppArgs[0]!
        let (value, terminal) ← if (r.taskIOErrors.getD #[]).contains publicName then do
          -- A typed terminal IO error does not require a callback dispatcher.
          unless payload.getAppFn.constName? == some ``Except && payload.getAppArgs.size == 2 &&
              payload.getAppArgs[0]!.isConstOf ``IO.Error do
            throwError "taskIOErrors requires Task (Except IO.Error value): {n}"
          pure (payload.getAppArgs[1]!, [("taskIO", toJson true)])
        else pure (payload, [])
        pure <| [("effect", toJson effect), ("delivery", toJson "task"), ("result", ← delivered r value r.hostValues)] ++ extra ++ terminal
      else if (head == ``IO || (head == ``BaseIO && r.immediateValues)) && resultArgs.size == 1 then
        pure [("effect", toJson head.toString), ("result", ← immediateResult r head resultArgs[0]!)]
      else if head == ``EIO && resultArgs.size == 2 then
        pure [("effect", toJson "EIO"), ("error", ← delivered r resultArgs[0]! true),
          ("result", ← returned r resultArgs[1]! false true)]
      else if head == ``Except && resultArgs.size == 2 then
        pure [("effect", toJson "pure"), ("result", ← returned r result false true)]
      else if r.immediateValues then
        pure [("effect", toJson "pure"), ("result", ← returned r result)]
      else throwError "expected synchronous IO result, typed EIO or returned Except: {n}"
      return Json.mkObj <| fields ++ [("declaration", toJson publicName), ("module", toJson owner),
        ("parameters", toJson params), ("hostMembers", toJson (usedMembers r deps))]
    rows := rows.push row
  let mut extra := []
  if let some policy := r.nativeEffectPolicy then
    unless policy == "native-host-io-v1" do throwError "unknown native effect policy: {policy}"
    let mut roots := startup
    for s in r.exports do roots := roots.insert s.toName
    for p in r.asyncIterators do roots := (roots.insert p.next.toName).insert p.close.toName
    let facts ← roots.toList.mapM fun n => do
      return Json.mkObj [("declaration", toJson n.toString), ("leaves", toJson (← nativeLeaves env n [n]))]
    extra := [("nativeEffectAudit", Json.mkObj [("policy", toJson policy),
      ("initializers", toJson (startup.toList.map Name.toString)), ("roots", toJson facts)])]
  return Json.mkObj <| extra ++ [("schemaVersion", toJson (1 : Nat)), ("kind", toJson "lean-bridge-host-export-metadata"),
    ("leanVersion", toJson Lean.versionString), ("entries", toJson rows)] ++
    (if owned.isEmpty then [] else [("leanResources", toJson owned)])

end LeanBridge.HostExports

unsafe def main (args : List String) : IO Unit := do
  let [path] := args | throw (IO.userError "expected a host-import selection file")
  let r ← IO.ofExcept <| fromJson? (α := LeanBridge.HostExports.Request) (← IO.ofExcept <| Json.parse (← IO.FS.readFile path))
  initSearchPath (← findSysroot)
  let env ← importModules (r.modules.map fun m => { module := m.toName }) {} 0
  let (result, _, _) ← (LeanBridge.HostExports.extract r).toIO
    { fileName := "<host-imports>", fileMap := default } { env }
  IO.println result.compress
