import Lean

/- Checked native export metadata. Source scanning never supplies a type. -/
open Lean Meta

namespace LeanBridge.NativeExports

structure MetadataModule where
  name : String
  sourcePath : String
  sourceSha256 : String
  interfaceSha256 : String
  deriving FromJson

structure MetadataContext where
  toolchain : String
  invocationIdentitySha256 : String
  modules : Array MetadataModule
  deriving FromJson

structure Specialization where
  name : String
  declaration : String
  types : Array String
  deriving FromJson

structure OwnedAggregatePolicy where
  ownership : String
  disposal : String
  fallback : String
  cycles : String
  deriving FromJson, ToJson

structure Request where
  profile : Option String := none
  modules : Array String
  exportModules : Option (Array String) := none
  exports : Array String := #[]
  resources : Array String := #[]
  ownedAggregates : Option OwnedAggregatePolicy := none
  arities : Array (String × Nat) := #[]
  specializations : Option (Array Specialization) := none
  contracts : Option Json := none
  metadata : Option MetadataContext := none
  deriving FromJson

def obj (fields : List (String × Json)) : Json := Json.mkObj fields
def str (value : String) : Json := toJson value

def primitives : List (Name × String) := [
  (``Unit, "unit"), (``Bool, "bool"), (``UInt8, "uint8"), (``UInt16, "uint16"),
  (``UInt32, "uint32"), (``UInt64, "uint64"), (``Int8, "int8"), (``Int16, "int16"),
  (``Int32, "int32"), (``Int64, "int64"), (``Nat, "nat"), (``Int, "int"),
  (``Float32, "float32"), (``Float, "float64"), (``String, "string"), (``ByteArray, "bytes"),
  (``Char, "char"), (``USize, "usize"), (``ISize, "isize")]

def reject (e : Expr) (reason : String) : MetaM α :=
  throwError "{reason}: {e}"

def abi (e : Expr) : MetaM Json := do
  let lowered ← Compiler.LCNF.toImpureType (← Compiler.LCNF.toMonoType (← Compiler.LCNF.toLCNFType e))
  let (cType, suffix) :=
    if lowered == Compiler.LCNF.ImpureType.uint8 then ("uint8_t", "")
    else if lowered == Compiler.LCNF.ImpureType.uint16 then ("uint16_t", "")
    else if lowered == Compiler.LCNF.ImpureType.uint32 then ("uint32_t", "_uint32")
    else if lowered == Compiler.LCNF.ImpureType.uint64 then ("uint64_t", "_uint64")
    else if lowered == Compiler.LCNF.ImpureType.usize then ("size_t", "_usize")
    else if lowered == Compiler.LCNF.ImpureType.float32 then ("float", "_float32")
    else if lowered == Compiler.LCNF.ImpureType.float then ("double", "_float")
    else if lowered == Compiler.LCNF.ImpureType.object ||
      lowered == Compiler.LCNF.ImpureType.tobject || lowered == Compiler.LCNF.ImpureType.tagged then ("lean_object*", "")
    else ("unsupported", "")
  if cType == "unsupported" then reject e "unsupported native compiler representation"
  return obj [("cType", str cType), ("box", str ("lean_box" ++ suffix)),
    ("unbox", str ("lean_unbox" ++ suffix)), ("heap", toJson (lowered == Compiler.LCNF.ImpureType.object))]

def nativeIdentifier (name : String) : Bool :=
  (name.splitOn ".").all fun part =>
    !part.isEmpty && part.toList.head!.isAlpha && part.toList.head!.toNat < 128 &&
      part.toList.all (fun c => c.toNat < 128 && (c.isAlphanum || c == '_'))

partial def checkBody (request : Request) (name : Name) (seen : NameSet := {}) : MetaM NameSet := do
  if seen.contains name then return seen
  let mut seen := seen.insert name
  let env ← getEnv
  let some index := env.getModuleIdxFor? name | return seen
  if !request.modules.contains env.header.moduleNames[index.toNat]!.toString then return seen
  let info ← getConstInfo name
  let partialImplementation := (env.find? (Compiler.mkUnsafeRecName name)).any (·.isPartial)
  if info.isUnsafe || info.isPartial || partialImplementation || isExtern env name || (Compiler.getImplementedBy? env name).isSome then
    throwError "{name} needs a reviewed unsafe, partial or foreign implementation contract"
  if let some value := info.value? then
    for dependency in value.getUsedConstants do
      seen ← checkBody request dependency seen
  return seen

-- Callable signatures use the checked value representation. Traverse aliases
-- only after the finite table has been checked and acyclic types expanded.
def callableTarget (value : Json) : MetaM Json := do
  let original := value
  let mut value := value
  let mut types : Array Json := #[]
  if (value.getObjValAs? String "kind").toOption == some "graph" then
    types ← ofExcept <| value.getObjValAs? (Array Json) "types"
    value ← ofExcept <| value.getObjVal? "root"
  -- Alias depth is not value nesting. A finite alias table can still denote a
  -- primitive callable argument; do not leave it disguised as a copied graph.
  for _ in [:1025] do
    let kind := (value.getObjValAs? String "kind").toOption.getD ""
    if kind == "alias" then
      value ← ofExcept <| value.getObjVal? "target"
    else if kind == "reference" then
      let name ← ofExcept <| value.getObjValAs? String "name"
      let some type := types.find? (fun item => (item.getObjValAs? String "name").toOption == some name)
        | throwError "missing callable alias definition: {name}"
      if (type.getObjValAs? String "kind").toOption != some "alias" then return original
      value ← ofExcept <| type.getObjVal? "target"
    else
      -- Compound graphs retain their table and their separate adapter gate.
      return if types.isEmpty || kind == "primitive" then value else original
  throwError "callable alias chain exceeds the nominal type limit"

def nominalReference (e : Expr) (name : Name) : MetaM Json := do
  return obj [("kind", str "reference"), ("name", str name.toString),
    ("lean", str name.toString), ("abi", ← abi e)]

/-- Generic-structure aliases in the request's compiled source closure, grouped by structure. -/
abbrev ParentAliasIndex := Array (Name × Array Name)

/-- Declarations scanned while indexing aliases for inherited generic parents, per request. -/
def parentAliasWorkLimit : Nat := 65536

/-- Request-wide inherited-parent discovery state. The index is built only when a site first needs
discovery, so a request without inherited generic parents never scans. A scan that exceeds the limit
is attempted once: the request remembers it and every later site refuses with the same diagnostic.
The counters are internal: normal metadata never reports them. -/
structure ParentAliasCache where
  limit : Nat := parentAliasWorkLimit
  index : Option ParentAliasIndex := none
  resolved : Array (Expr × Name) := #[]
  attempts : Nat := 0
  builds : Nat := 0
  scanned : Nat := 0
  probes : Nat := 0
  hits : Nat := 0
  exhausted : Bool := false

structure ShapeState where
  types : Array Json := #[]
  nodes : Nat := 0
  parentAliases : Option (IO.Ref ParentAliasCache) := none

abbrev ShapeM := StateT ShapeState MetaM

def rememberShape (e : Expr) (name : Name) (value : Json) : ShapeM Json := do
  if (← get).types.size >= 1024 then reject e "copied graph exceeds 1024 nominal definitions"
  if (← get).nodes >= 4096 then reject e "copied type graph exceeds its node limit"
  modify fun state => { state with types := state.types.push value, nodes := state.nodes + 1 }
  return ← nominalReference e name

/-- A record with proof fields crosses only at a top-level site. A parameter is built by the
configured checked constructor alone, whose explicit binders are the payload fields by name and
type, in Lean order, and whose result is `Option` of the exact record. A result is produced by Lean,
which already holds the proofs, so it takes no constructor. -/
def checkedRecordSite (request : Request) (e : Expr) (reference : Json)
    (payload : Array (Name × Expr)) (depth : Nat) (copied structural : Bool)
    (checked : Option String) (callbackSite : Option Bool) (hostReply : Bool) : MetaM Json := do
  if payload.isEmpty then reject e "checked records need at least one payload field"
  unless depth == 0 && !copied && structural && callbackSite.isSome && !hostReply do
    reject e "checked records currently require a top-level parameter or result"
  if callbackSite == some true then
    if checked.isSome then reject e "Lean-produced checked records take no constructor"
    return reference
  let some constructor := checked
    | reject e "checked records require a configured checked constructor"
  let constructorName := constructor.toName
  let env ← getEnv
  let some moduleIndex := env.getModuleIdxFor? constructorName
    | reject e "checked record constructor module is unavailable"
  unless request.modules.contains env.header.moduleNames[moduleIndex.toNat]!.toString do
    reject e "checked record constructor must belong to a selected module"
  let constructorType ← inferType (← mkConstWithFreshMVarLevels constructorName)
  discard <| forallTelescopeReducing constructorType fun arguments result => do
    unless arguments.size == payload.size do
      reject e "checked record constructor must take exactly the payload fields"
    for argument in arguments, (field, fieldType) in payload do
      let declaration ← argument.fvarId!.getDecl
      unless declaration.binderInfo == .default do
        reject e "checked record constructor takes only explicit payload values"
      -- Binder names map host payload fields to constructor inputs; an initial convention.
      unless declaration.userName == field do
        reject e s!"checked record constructor input {declaration.userName} must be named {field}"
      unless ← isDefEq declaration.type fieldType do
        reject e s!"checked record constructor input {field} must equal the payload field type"
    unless result.isAppOfArity ``Option 1 && (← isDefEq result.appArg! e) do
      reject e "checked record constructor must return Option of the exact record"
  discard <| checkBody request constructorName
  -- The constructor is the only source of the erased proofs, so none of them may be assumed.
  if (← collectAxioms constructorName).contains ``sorryAx then
    reject e "checked record constructor depends on sorry"
  return obj [("kind", str "refinement"), ("base", reference),
    ("predicate", obj [("kind", str "checked-record"), ("constructor", str constructor)]),
    ("abi", ← abi e)]

/-- Whether a shape, or any definition it references, has a node of the given kind. -/
partial def containsKind (types : Array Json) (value : Json) (kind : String) (seen : List String := []) : Bool :=
  match value with
  | .obj fields =>
    if (value.getObjValAs? String "kind").toOption == some kind then true
    else if (value.getObjValAs? String "kind").toOption == some "reference" then
      match (value.getObjValAs? String "name").toOption with
      | some name =>
        if seen.contains name then false
        else match types.find? (fun item => (item.getObjValAs? String "name").toOption == some name) with
          | some type => containsKind types type kind (name :: seen)
          | none => false
      | none => false
    else fields.toArray.any (fun (_, child) => containsKind types child kind seen)
  | .arr values => values.any (fun child => containsKind types child kind seen)
  | _ => false

/-- Structures with their own mappings: never generic-record instantiations, however an alias spells them. -/
def structuralConstructors : List Name := [``Array, ``Prod, ``Fin, ``Subtype]

/-- The structure a closed application may instantiate as an alias-named record. -/
def genericStructure? (env : Environment) (name : Name) : Option StructureInfo :=
  if structuralConstructors.contains name then none else getStructureInfo? env name

/-- Index every safe, public, universe-free abbrev of a generic structure in the request's compiled
source closure: request.modules, which includes captured dependency modules the project imports.
Unimported modules and the rest of the environment are never candidates. Returns no index when the
scan exceeds the limit, with the declarations it scanned either way. -/
def buildParentAliasIndex (request : Request) (limit : Nat := parentAliasWorkLimit) : MetaM (Option ParentAliasIndex × Nat) := do
  let env ← getEnv
  let mut index : ParentAliasIndex := #[]
  let mut scanned := 0
  for position in [0:env.header.moduleNames.size] do
    unless request.modules.contains env.header.moduleNames[position]!.toString do continue
    for name in env.header.moduleData[position]!.constNames do
      scanned := scanned + 1
      if scanned > limit then return (none, scanned)
      let some (.defnInfo definition) := env.find? name | continue
      unless definition.levelParams.isEmpty && definition.safety == .safe && !isPrivateName name &&
          nativeIdentifier name.toString do continue
      let some structureName := definition.value.getAppFn.constName? | continue
      unless (genericStructure? env structureName).isSome do continue
      index := match index.findIdx? (·.1 == structureName) with
        | some found => index.modify found fun (key, names) => (key, names.push name)
        | none => index.push (structureName, #[name])
  return (some index, scanned)

/-- The one diagnostic for a request whose alias search exceeded its limit. -/
def parentAliasExhausted (limit : Nat) : MetaM α :=
  throwError "inherited parent alias search exceeds its limit of {limit} declarations"

/-- Resolve the unnamed type of an inherited generic parent to the one source alias that denotes it.
Each candidate is probed without keeping metavariable assignments; no match or several matches refuse. -/
def resolveParentAlias (request : Request) (child : Name) (e : Expr) : ShapeM Name := do
  let e ← instantiateMVars e
  if e.hasMVar || e.hasFVar || e.hasLevelMVar then reject e "an inherited generic parent must be a closed type"
  if (e.find? (·.isConstOf child)).isSome then reject e "recursive generic records are not admitted"
  -- A site without a request-wide cache still discovers, with its own cache.
  let cache ← match (← get).parentAliases with
    | some cache => pure cache
    | none => do
      let cache ← IO.mkRef ({} : ParentAliasCache)
      modify fun state => { state with parentAliases := some cache }
      pure cache
  if let some (_, name) := (← cache.get).resolved.find? (·.1 == e) then
    cache.modify fun state => { state with hits := state.hits + 1 }
    return name
  let limit := (← cache.get).limit
  if (← cache.get).exhausted then parentAliasExhausted limit
  let index ← match (← cache.get).index with
    | some index => pure index
    | none => do
      let (index?, scanned) ← buildParentAliasIndex request limit
      cache.modify fun state => { state with attempts := state.attempts + 1, scanned := state.scanned + scanned }
      let some index := index? | do
        cache.modify fun state => { state with exhausted := true }
        parentAliasExhausted limit
      cache.modify fun state => { state with index := some index, builds := state.builds + 1 }
      pure index
  let some structureName := e.getAppFn.constName? | reject e "an inherited generic parent must instantiate a structure"
  let candidates := (index.find? (·.1 == structureName)).map (·.2) |>.getD #[]
  let mut matching := #[]
  for name in candidates do
    cache.modify fun state => { state with probes := state.probes + 1 }
    let denotes : MetaM Bool := withoutModifyingState <| withNewMCtxDepth do
      return (← whnf (← inferType (mkConst name))).isSort && (← isDefEq (mkConst name) e)
    if ← denotes then matching := matching.push name
  match (matching.qsort (·.toString < ·.toString)).toList with
  | [] => reject e "name this inherited generic parent with an abbrev in the compiled source"
  | [name] =>
    cache.modify fun state => { state with resolved := state.resolved.push (e, name) }
    return name
  | names => reject e s!"ambiguous inherited generic parent; candidates: {", ".intercalate (names.map toString)}"

/-- `structural` stays true while only arrays, lists, options, products, results, aliases and
plain record and variant fields separate a position from its top-level parameter or result.
`callbackSite` marks a top-level export site: `some false` for a parameter, where a callback is
the host's, and `some true` for the result, where a callback is a Lean closure leased to the host.
`hostReply` marks positions the host produces while Lean runs: a host callback's result. -/
partial def shapeTree (request : Request) (e : Expr) (seen : List Name := [])
    (depth : Nat := 0) (copied : Bool := false) (checked : Option String := none)
    (containerFin : Bool := true) (structural : Bool := true) (alias : Option Name := none)
    (callbackSite : Option Bool := none) (hostReply : Bool := false) : ShapeM Json := do
  if depth > 32 then reject e "native copied type nesting exceeds 32 inline edges"
  if seen.length > 1024 || (← get).nodes >= 4096 then reject e "copied type graph exceeds its node limit"
  modify fun state => { state with nodes := state.nodes + 1 }
  if e.hasFVar || e.hasLooseBVars || e.hasMVar then
    reject e "dependent or unresolved native type"
  if e.isAppOfArity ``Fin 1 then
    if (depth != 0 || copied) && !containerFin then
      reject e "Fin refinements require a top-level or structural-container parameter or result"
    -- Native libraries check bounds around top-level parameters and results, inside their
    -- structural containers, in plain record and variant fields, in the arguments of a Lean
    -- closure leased to the host, and where Lean itself produces the value for the host.
    -- A host callback's result would reach running Lean code before any check could refuse
    -- it, and native packages never substitute a value, so it stays refused.
    if request.profile.getD "component-scalars-v1" != "component-scalars-v1" && !structural then
      if hostReply then
        reject e "Fin refinements in a host callback result are refused: the host produces the value while Lean runs"
      reject e "Fin refinements are not implemented by the native-library profile inside callbacks or generic record instantiations"
    let bound ← whnf e.appArg!
    let .lit (.natVal bound) := bound
      | reject e "Fin refinements require a closed literal bound"
    return obj [
      ("kind", str "refinement"),
      ("base", obj [("kind", str "primitive"), ("name", str "nat"),
        ("lean", str "Nat"), ("abi", ← abi (mkConst ``Nat))]),
      ("predicate", obj [("kind", str "fin"), ("bound", str (toString bound))]),
      ("abi", ← abi e)]
  if e.isAppOfArity ``Subtype 2 then
    -- Native packages check Subtype only at top-level sites; npm also keeps that rule today.
    if depth != 0 || copied || !structural then
      reject e "Subtype refinements currently require a top-level parameter or result"
    let some constructor := checked
      | reject e "Subtype refinements require a configured checked constructor"
    let constructorName := constructor.toName
    let env ← getEnv
    let some moduleIndex := env.getModuleIdxFor? constructorName
      | reject e "Subtype checked constructor module is unavailable"
    unless request.modules.contains env.header.moduleNames[moduleIndex.toNat]!.toString do
      reject e "Subtype checked constructor must belong to a selected module"
    let constructorValue ← mkConstWithFreshMVarLevels constructorName
    let constructorType ← inferType constructorValue
    discard <| forallTelescopeReducing constructorType fun arguments result => do
      unless arguments.size == 1 do
        reject e "Subtype checked constructor must take exactly one explicit value"
      let argument ← arguments[0]!.fvarId!.getDecl
      unless argument.binderInfo == .default && (← isDefEq argument.type e.getAppArgs[0]!) do
        reject e "Subtype checked constructor input must equal the subtype base"
      unless result.isAppOfArity ``Option 1 && (← isDefEq result.appArg! e) do
        reject e "Subtype checked constructor must return Option of the exact subtype"
    discard <| checkBody request constructorName
    let base ← shapeTree request e.getAppArgs[0]!
    unless (base.getObjValAs? String "kind").toOption == some "primitive" do
      reject e "Subtype checked constructors currently require a primitive base"
    return obj [
      ("kind", str "refinement"), ("base", base),
      ("predicate", obj [("kind", str "subtype"), ("constructor", str constructor)]),
      ("abi", ← abi e)]
  if let .const name levels := e then
    if !(primitives.any (·.1 == name)) && !request.resources.contains name.toString then
      if (← get).types.any (fun type => (type.getObjValAs? String "name").toOption == some name.toString) then
        return ← nominalReference e name
      let info ← getConstInfo name
      if let .defnInfo definition := info then
        if (← whnf definition.type).isSort then
          if let some index := (← getEnv).getModuleIdxFor? name then
            if request.modules.contains (← getEnv).header.moduleNames[index.toNat]!.toString then
              if !nativeIdentifier name.toString || !levels.isEmpty || !definition.levelParams.isEmpty ||
                  info.isUnsafe || info.isPartial then reject e "unsupported copied alias definition"
              if seen.contains name then
                let guarded ← (seen.takeWhile (· != name)).anyM fun other => do
                  return (← getConstInfo other) matches .inductInfo _
                unless guarded do reject e "cyclic copied alias"
                return ← nominalReference e name
              -- Alias spelling does not change the permitted refinement position: a Fin or Subtype
              -- alias keeps its depth, so an aliased Subtype in a callback argument is not top-level.
              let unfolded ← whnf definition.value
              let directFin := unfolded.isAppOfArity ``Fin 1 || unfolded.isAppOfArity ``Subtype 2
              -- A closed application of a generic structure becomes a record named by this alias.
              let instantiation := definition.value.isApp && definition.value.getAppFn.isConst &&
                (genericStructure? (← getEnv) definition.value.getAppFn.constName!).isSome
              let target ← shapeTree request definition.value (name :: seen) (if directFin then depth else 0) copied checked containerFin structural (if instantiation then some name else none) callbackSite hostReply
              if ["resource", "callback", "refinement"].contains ((target.getObjValAs? String "kind").toOption.getD "") then
                return target
              if (target.getObjValAs? String "kind").toOption == some "reference" &&
                  (target.getObjValAs? String "name").toOption == some name.toString then
                return target
              return ← rememberShape e name <| obj [("kind", str "alias"), ("name", str name.toString),
                ("lean", str name.toString), ("target", target), ("abi", ← abi e)]
  if (← isDefEq e (mkConst ``Unit)) then
    return obj [("kind", str "primitive"), ("name", str "unit"), ("lean", str "Unit"), ("abi", ← abi e)]
  -- Established structural constructors keep their mappings ahead of generic-record admission.
  if e.isAppOfArity ``Array 1 then
    return obj [("kind", str "array"), ("element", ← shapeTree request e.appArg! seen (depth + 1) true none containerFin structural (hostReply := hostReply)), ("abi", ← abi e)]
  if e.isAppOfArity ``List 1 then
    return obj [("kind", str "list"), ("element", ← shapeTree request e.appArg! seen (depth + 1) true none containerFin structural (hostReply := hostReply)), ("abi", ← abi e)]
  if e.isAppOfArity ``Option 1 then
    return obj [("kind", str "option"), ("element", ← shapeTree request e.appArg! seen (depth + 1) true none containerFin structural (hostReply := hostReply)), ("abi", ← abi e)]
  if e.isAppOfArity ``Except 2 || e.isAppOfArity ``Prod 2 then
    let args := e.getAppArgs
    -- Products and results are structural containers: native packages check Fin in both
    -- components and in the active branch.
    let first ← shapeTree request args[0]! seen (depth + 1) true none containerFin structural (hostReply := hostReply)
    let second ← shapeTree request args[1]! seen (depth + 1) true none containerFin structural (hostReply := hostReply)
    -- IR result arguments are [success, error]; Lean's Except is [error, success].
    let result := e.isAppOfArity ``Except 2
    return obj [("kind", str (if result then "result" else "tuple")),
      ("arguments", toJson (if result then #[second, first] else #[first, second])), ("abi", ← abi e)]
  if e.isApp then
    if let .const structureName levels := e.getAppFn then
      if let some info := genericStructure? (← getEnv) structureName then
        -- A closed instantiation is admitted only through the alias that names it: the alias is the
        -- record's identity and Lean spelling, and the application is recorded as its provenance.
        let some aliasName := alias
          | reject e "name this instantiation of a generic structure with an abbrev"
        let .inductInfo induct ← getConstInfo structureName | reject e "invalid record"
        let args := e.getAppArgs
        if !nativeIdentifier structureName.toString || !nativeIdentifier induct.ctors.head!.toString then
          reject e "unsupported native record identifier"
        if induct.numParams != args.size || induct.numIndices != 0 then
          reject e "indexed and partially applied generic records require a reviewed projection"
        if levels.length != induct.levelParams.length then reject e "generic record universe instantiation is incomplete"
        -- Every type argument is a closed runtime type: a Sort-typed, non-proposition, copied shape.
        let mut arguments := #[]
        for argument in args do
          unless (← whnf (← inferType argument)).isSort do
            -- A value index is recorded only as instantiation provenance. This slice admits a
            -- closed Nat literal; other index kinds are refused at their source.
            unless ← isDefEq (← inferType argument) (mkConst ``Nat) do
              reject e "generic record value arguments must be Nat literals"
            let .lit (.natVal index) ← whnf argument
              | reject e "generic record value arguments must be closed Nat literals"
            arguments := arguments.push (obj [("kind", str "value"),
              ("type", ← shapeTree request (mkConst ``Nat)), ("value", str (toString index))])
            continue
          if ← isProp argument then reject e "generic record arguments cannot be propositions"
          let shape ← shapeTree request argument (aliasName :: seen) 0 true none containerFin false
          -- An argument is a plain copied type throughout: no identity, callback or refinement
          -- anywhere inside it, including the definitions it references.
          for kind in ["resource", "callback", "refinement"] do
            if containsKind (← get).types shape kind then
              reject e s!"generic record arguments cannot carry {kind} types"
          arguments := arguments.push shape
        -- Field types come from Lean's own inference on a typed receiver, with the structure's
        -- universes and arguments instantiated; a field that depends on the receiver is rejected.
        let mut fields := #[]
        -- Proof fields are erased: they never cross, and only a checked constructor builds them.
        let mut erased : Array Name := #[]
        let mut payload : Array (Name × Expr) := #[]
        for field in info.fieldNames, position in [0:info.fieldNames.size] do
          let some projection := info.getProjFn? position | reject e "missing record projection"
          if !nativeIdentifier field.toString || (field.toString.splitOn ".").length != 1 ||
              ["new", "DESTROY", "CLONE", "CLONE_SKIP"].contains field.toString ||
              !nativeIdentifier projection.toString then reject e "invalid or reserved native record field"
          let (fieldType, proof) ← withLocalDecl `value .default e fun receiver => do
            let application := mkAppN (mkConst projection levels) (args.push receiver)
            let fieldType ← instantiateMVars (← inferType application)
            if ← isProp fieldType then return (fieldType, true)
            if fieldType.containsFVar receiver.fvarId! then reject e s!"generic record field {field} depends on the record value"
            return (fieldType, false)
          if proof then
            erased := erased.push field
            continue
          payload := payload.push (field, fieldType)
          -- An inherited generic parent is one subobject field whose Lean type is an unnamed
          -- application; it resolves to the single source alias that denotes it. Fields that a
          -- program names explicitly never take this path.
          let parent := info.parentInfo.any fun item => item.subobject && item.projFn == projection
          let env ← getEnv
          let generic := fieldType.getAppFn.constName?.any fun head => (genericStructure? env head).isSome
          let fieldShape ← if parent && fieldType.isApp && generic then
              shapeTree request (mkConst (← resolveParentAlias request structureName fieldType)) (aliasName :: seen) 0 true none containerFin false
            else shapeTree request fieldType (aliasName :: seen) 0 true none containerFin false
          fields := fields.push (obj [("name", str field.toString),
            ("projection", str projection.toString),
            ("type", fieldShape)])
        -- The constructor at the same universes, applied to the arguments, must take exactly the
        -- projected field types in order and build the closed alias; the probe is Lean-typed.
        let constructorType ← inferType (mkAppN (mkConst induct.ctors.head! levels) args)
        forallTelescopeReducing constructorType fun binders result => do
          unless binders.size == info.fieldNames.size do reject e "generic record constructor arity disagrees with its projections"
          unless ← isDefEq result e do reject e "generic record constructor does not build the instantiated record"
          for binder in binders, index in [0:binders.size] do
            -- A proof binder's type mentions earlier binders; only Lean's own constructor holds it.
            if erased.contains info.fieldNames[index]! then continue
            let declared ← inferType binder
            let projected ← withLocalDecl `value .default e fun receiver => do
              instantiateMVars (← inferType (mkAppN (mkConst (info.getProjFn? index).get! levels) (args.push receiver)))
            unless ← isDefEq declared projected do reject e "generic record constructor and projection types disagree"
        let aliasType ← inferType (mkConst aliasName)
        unless (← whnf aliasType).isSort do reject e "generic record alias must denote a type"
        unless ← isDefEq (mkConst aliasName) e do reject e "generic record alias does not unfold to the instantiation"
        let reference ← rememberShape e aliasName <| obj ([("kind", str "record"), ("name", str aliasName.toString),
          ("lean", str aliasName.toString), ("constructor", str induct.ctors.head!.toString),
          ("provenance", obj [("structure", str structureName.toString), ("arguments", toJson arguments)]),
          ("fields", toJson fields)] ++ (if erased.isEmpty then [] else [("erased", toJson (erased.map toString))]) ++
          [("abi", ← abi e)])
        if erased.isEmpty then return reference
        return ← checkedRecordSite request e reference payload depth copied structural checked callbackSite hostReply
  if let .const name _ := e then
    if let some (_, primitive) := primitives.find? (·.1 == name) then
      return obj [("kind", str "primitive"), ("name", str primitive), ("lean", str name.toString), ("abi", ← abi e)]
    if request.resources.contains name.toString then
      if copied && request.ownedAggregates.isNone then
        reject e "identity resources inside copied values require an ownership policy"
      if !nativeIdentifier name.toString then reject e "unsupported native resource identifier"
      if !(← getEnv).contains name then reject e "unknown resource"
      let lowered ← abi e
      if (lowered.getObjValAs? Bool "heap").toOption != some true then
        reject e "resource has no stable heap identity; use a copied value"
      let some index := (← getEnv).getModuleIdxFor? name | reject e "resource module is unavailable"
      if !request.modules.contains (← getEnv).header.moduleNames[index.toNat]!.toString then
        reject e "resource module is outside the compiled source closure"
      return obj [("kind", str "resource"), ("name", str name.toString), ("lean", str name.toString),
        ("module", str (← getEnv).header.moduleNames[index.toNat]!.toString), ("abi", lowered)]
    if let some info := getStructureInfo? (← getEnv) name then
      if seen.contains name then return ← nominalReference e name
      let .inductInfo induct ← getConstInfo name | reject e "invalid record"
      if !nativeIdentifier name.toString || !nativeIdentifier induct.ctors.head!.toString then
        reject e "unsupported native record identifier"
      if induct.numParams != 0 || induct.numIndices != 0 then
        reject e "generic and dependent records require a reviewed projection"
      -- An inherited record keeps Lean's own layout: each subobject parent is one field, such as
      -- toBase of the parent record, and the constructor takes exactly these closed fields in order.
      if !info.parentInfo.isEmpty then
        let constructor := mkConst induct.ctors.head! (induct.levelParams.map mkLevelParam)
        forallTelescopeReducing (← inferType constructor) fun binders _ => do
          unless binders.size == info.fieldNames.size do reject e "inherited record constructor arity disagrees with its projections"
          for binder in binders, index in [0:binders.size] do
            let some projection := info.getProjFn? index | reject e "missing record projection"
            let .forallE _ _ fieldType _ := (← getConstInfo projection).type | reject e "invalid record projection"
            if fieldType.hasLooseBVars then reject e "inherited record fields cannot depend on the record value"
            unless ← isDefEq (← inferType binder) fieldType do reject e "inherited record constructor and projection types disagree"
      let mut fields := #[]
      -- Proof fields are erased: they never cross, and only a checked constructor builds them.
      let mut erased : Array Name := #[]
      let mut payload : Array (Name × Expr) := #[]
      for field in info.fieldNames, position in [0:info.fieldNames.size] do
        let some projection := info.getProjFn? position | reject e "missing record projection"
        if !nativeIdentifier field.toString || (field.toString.splitOn ".").length != 1 ||
            ["new", "DESTROY", "CLONE", "CLONE_SKIP"].contains field.toString ||
            !nativeIdentifier projection.toString then reject e "invalid or reserved native record field"
        let projectionInfo ← getConstInfo projection
        let .forallE _ _ fieldType _ := projectionInfo.type | reject e "invalid record projection"
        let proof ← withLocalDecl `value .default e fun receiver => isProp (fieldType.instantiate1 receiver)
        if proof then
          erased := erased.push field
          continue
        -- A payload field that depends on another field stays refused as a dependent type.
        payload := payload.push (field, fieldType)
        -- A plain record's fields are structural: each Fin field is checked where the record crosses.
        fields := fields.push (obj [("name", str field.toString),
          ("projection", str projection.toString),
          ("type", ← shapeTree request fieldType (name :: seen) 0 true none containerFin true)])
      let types := (← get).types
      if !erased.isEmpty && fields.any (fun field => containsKind types ((field.getObjVal? "type").toOption.getD Json.null) "refinement") then
        reject e "checked record payload fields cannot carry refinements yet"
      let reference ← rememberShape e name <| obj ([("kind", str "record"), ("name", str name.toString),
        ("lean", str name.toString), ("constructor", str induct.ctors.head!.toString), ("fields", toJson fields)] ++
        (if erased.isEmpty then [] else [("erased", toJson (erased.map toString))]) ++ [("abi", ← abi e)])
      if erased.isEmpty then return reference
      return ← checkedRecordSite request e reference payload depth copied structural checked callbackSite hostReply
    if let .inductInfo induct ← getConstInfo name then
      if seen.contains name then return ← nominalReference e name
      if !nativeIdentifier name.toString || induct.numParams != 0 || induct.numIndices != 0 then
        reject e "generic or indexed variants require a checked specialization"
      if induct.ctors.isEmpty || induct.ctors.length > 1024 || (← isProp e) then
        reject e "copied variants require between 1 and 1024 value constructors"
      let mut cases := #[]
      for constructor in induct.ctors do
        if (← get).nodes >= 4096 then reject e "copied type graph exceeds its node limit"
        modify fun state => { state with nodes := state.nodes + 1 }
        if !nativeIdentifier constructor.toString then reject e "unsupported variant constructor identifier"
        let .str owner caseName := constructor | reject e "unnamed variant constructor"
        if owner != name then reject e "variant constructor belongs to a different type"
        let constructorInfo ← getConstInfoCtor constructor
        let mut pending := constructorInfo.type
        let mut declared : List String := []
        while let .forallE fieldName _ body _ := pending do
          if !fieldName.isAnonymous && !fieldName.hasMacroScopes then
            declared := fieldName.toString :: declared
          pending := body
        let mut rest := constructorInfo.type
        let mut fields := #[]
        let mut names : List String := []
        while let .forallE fieldName fieldType body binder := rest do
          if binder != .default || fields.size >= 1024 || (← isProp fieldType) then
            reject e "implicit, proof or oversized variant fields require a reviewed representation"
          -- Arrow-only constructor fields have compiler-generated hygienic
          -- names. Publish stable positional names, not internal macro scopes.
          let generated := fieldName.isAnonymous || fieldName.hasMacroScopes
          let mut fieldName := if generated then s!"arg{fields.size}" else fieldName.toString
          if generated then
            while declared.contains fieldName || names.contains fieldName do
              fieldName := fieldName ++ "_"
          if !nativeIdentifier fieldName || (fieldName.splitOn ".").length != 1 ||
              ["kind", "new", "DESTROY", "CLONE", "CLONE_SKIP"].contains fieldName || names.contains fieldName then
            reject e s!"invalid, reserved or duplicate variant field name {fieldName}"
          -- Variant fields are structural too; only the active case is checked.
          fields := fields.push (obj [("name", str fieldName),
            ("type", ← shapeTree request fieldType (name :: seen) 0 true none containerFin true)])
          names := fieldName :: names
          rest := body
        unless ← isDefEq rest e do reject e "variant constructor has a dependent result"
        cases := cases.push (obj [("name", str caseName), ("constructor", str constructor.toString), ("fields", toJson fields)])
      return ← rememberShape e name <| obj [("kind", str "variant"), ("name", str name.toString),
        ("lean", str name.toString), ("cases", toJson cases), ("abi", ← abi e)]
  if e.isForall then
    if copied then reject e "callbacks inside copied values require a retention policy"
    let mut result := e
    let mut parameters := #[]
    repeat
      result ← whnf result
      match result with
      | .forallE _ argument rest binder =>
        if binder != .default || rest.hasLooseBVars then reject e "dependent or implicit callback"
        if parameters.size >= 16 then reject e "native callbacks support at most 16 arguments"
        -- Arguments of a top-level callback are checked before a leased closure runs, or come
        -- from Lean when the host is called; a callback nested in a callback stays unchecked.
        parameters := parameters.push (← shapeTree request argument seen (depth + 1) false none containerFin callbackSite.isSome)
        result := rest
      | _ => break
    -- A leased closure's result comes from Lean; a host callback's result is a host reply.
    return obj [("kind", str "callback"), ("parameters", toJson parameters),
      ("result", ← shapeTree request result seen (depth + 1) false none containerFin (callbackSite == some true)
        (hostReply := callbackSite == some false)), ("abi", ← abi e)]
  let reduced ← whnf e
  if reduced != e then return ← shapeTree request reduced seen (depth + 1) copied checked containerFin structural (callbackSite := callbackSite) (hostReply := hostReply)
  reject e "unsupported native export type"

/- Preserve the existing inline report for small acyclic types. Expansion has
   its own budget: sharing and nominal depth must not grow an exponential tree. -/
partial def inlineCopiedType (types : Array Json) (value : Json)
    (seen : List String := []) (depth : Nat := 0) : OptionT (StateT Nat MetaM) Json := do
  if depth > 32 || (← get) >= 4096 then return ← OptionT.fail
  modify (· + 1)
  let kind := (value.getObjValAs? String "kind").toOption.getD ""
  if kind == "reference" then
    let name ← ofExcept <| value.getObjValAs? String "name"
    if seen.contains name then return ← OptionT.fail
    let some type := types.find? (fun item => (item.getObjValAs? String "name").toOption == some name)
      | throwError "missing copied type definition: {name}"
    return ← inlineCopiedType types type (name :: seen) depth
  if kind == "alias" || kind == "array" || kind == "list" || kind == "option" then
    let key := if kind == "alias" then "target" else "element"
    return value.setObjVal! key (← inlineCopiedType types (← ofExcept <| value.getObjVal? key) seen (depth + 1))
  if kind == "result" || kind == "tuple" then
    let args ← ofExcept <| value.getObjValAs? (Array Json) "arguments"
    return value.setObjVal! "arguments" (toJson (← args.mapM fun child => inlineCopiedType types child seen (depth + 1)))
  -- A checked record's site keeps its predicate around the inlined record.
  if kind == "refinement" && (value.getObjVal? "base" |>.toOption |>.bind fun base => base.getObjValAs? String "kind" |>.toOption) == some "reference" then
    return value.setObjVal! "base" (← inlineCopiedType types (← ofExcept <| value.getObjVal? "base") seen (depth + 1))
  let expandFields := fun (owner : Json) => do
    let fields ← ofExcept <| owner.getObjValAs? (Array Json) "fields"
    let fields ← fields.mapM fun (field : Json) => do
      pure (field.setObjVal! "type" (← inlineCopiedType types (← ofExcept <| field.getObjVal? "type") seen (depth + 1)))
    pure (owner.setObjVal! "fields" (toJson fields))
  if kind == "record" then
    let value ← expandFields value
    -- Provenance arguments expand like fields, so a definition only the instantiation names stays inline.
    let some provenance := (value.getObjVal? "provenance").toOption | return value
    let arguments ← ofExcept <| provenance.getObjValAs? (Array Json) "arguments"
    let arguments ← arguments.mapM fun child => inlineCopiedType types child seen (depth + 1)
    return value.setObjVal! "provenance" (provenance.setObjVal! "arguments" (toJson arguments))
  if kind == "variant" then
    let cases ← ofExcept <| value.getObjValAs? (Array Json) "cases"
    return value.setObjVal! "cases" (toJson (← cases.mapM expandFields))
  return value

partial def copiedReferenceNames (value : Json) : List String :=
  match value with
  | .obj fields =>
    if (value.getObjValAs? String "kind").toOption == some "reference" then
      (value.getObjValAs? String "name").toOption.toList
    else fields.toArray.toList.flatMap (fun (_, child) => copiedReferenceNames child)
  | .arr values => values.toList.flatMap copiedReferenceNames
  | _ => []

partial def hasResource (value : Json) : Bool :=
  match value with
  | .obj fields =>
    (value.getObjValAs? String "kind").toOption == some "resource" ||
      fields.toArray.any (fun (_, child) => hasResource child)
  | .arr values => values.any hasResource
  | _ => false

partial def finiteCopiedGraph (types : Array Json) (value : Json)
    (policy : Option OwnedAggregatePolicy := none) : MetaM Json := do
  if (value.getObjValAs? String "kind").toOption == some "callback" then
    let parameters ← ofExcept <| value.getObjValAs? (Array Json) "parameters"
    let result ← ofExcept <| value.getObjVal? "result"
    let parameters ← parameters.mapM fun parameter => do
      callableTarget (← finiteCopiedGraph types parameter policy)
    return value.setObjVal! "parameters" (toJson parameters)
      |>.setObjVal! "result" (← callableTarget (← finiteCopiedGraph types result policy))
  -- Preserve the existing inline fast path when no ownership policy was chosen.
  if policy.isNone then
    let (expanded, _) ← (inlineCopiedType types value).run.run 0
    if let some inline := expanded then return inline
  let mut pending := copiedReferenceNames value
  let mut names : List String := []
  let mut selected := #[]
  while !pending.isEmpty do
    let name := pending.head!
    pending := pending.tail!
    unless names.contains name do
      names := name :: names
      let some type := types.find? (fun item => (item.getObjValAs? String "name").toOption == some name)
        | throwError "missing copied type definition: {name}"
      selected := selected.push type
      pending := copiedReferenceNames type ++ pending
  let kind := (value.getObjValAs? String "kind").toOption.getD ""
  let owned := kind != "resource" && (hasResource value || selected.any hasResource)
  if owned then
    let some ownership := policy | throwError "resource aggregates require an explicit ownership policy"
    return obj [("kind", str "owned-graph"), ("root", value),
      ("types", toJson (selected.qsort fun a b =>
        (a.getObjValAs? String "name").toOption.getD "" < (b.getObjValAs? String "name").toOption.getD "")),
      ("policy", toJson ownership), ("abi", ← ofExcept <| value.getObjVal? "abi")]
  if policy.isSome then
    let (expanded, _) ← (inlineCopiedType types value).run.run 0
    if let some inline := expanded then return inline
  return obj [("kind", str "graph"), ("root", value),
    ("types", toJson (selected.qsort fun a b =>
      (a.getObjValAs? String "name").toOption.getD "" < (b.getObjValAs? String "name").toOption.getD "")),
    ("abi", ← ofExcept <| value.getObjVal? "abi")]

def shape (request : Request) (e : Expr) (checked : Option String := none)
    (callbackSite : Option Bool := none) (parentAliases : Option (IO.Ref ParentAliasCache) := none) : MetaM Json := do
  if let some policy := request.ownedAggregates then
    unless policy.ownership == "lease" && policy.disposal == "required" &&
        ["none", "queued-finalizer"].contains policy.fallback && policy.cycles == "reject" do
      reject e "invalid resource aggregate ownership policy"
  let (value, state) ← (shapeTree request e (checked := checked) (callbackSite := callbackSite)).run { parentAliases }
  finiteCopiedGraph state.types value request.ownedAggregates

partial def signature (request : Request) (e : Expr) (limit : Nat)
    (checkedParameters : Array (Option String) := #[]) (checkedResult : Option String := none)
    (index : Nat := 0) (parentAliases : Option (IO.Ref ParentAliasCache) := none) : MetaM (Array Json × Json) := do
  let reduced ← whnf e
  if index < limit then
    if let .forallE _ argument result binder := reduced then
      if binder != .default || result.hasLooseBVars then reject e "dependent or implicit parameter"
      let parameter ← shape request argument (checkedParameters[index]?.join) (callbackSite := some false) parentAliases
      let (rest, result) ← signature request result limit checkedParameters checkedResult (index + 1) parentAliases
      return (#[obj [("name", str s!"arg{index}"), ("type", parameter)]] ++ rest, result)
  return (#[], ← shape request e checkedResult (callbackSite := some true) parentAliases)

def expression (e : Expr) : MetaM String := do
  withOptions (fun opts => opts.setBool `pp.fullNames true |>.setBool `pp.universes true) do
    return (← ppExpr e).pretty

def binderName : BinderInfo → String
  | .default => "explicit"
  | .implicit => "implicit"
  | .strictImplicit => "strict-implicit"
  | .instImplicit => "instance-implicit"

def unsupported (reason text : String) : Json :=
  obj [("status", str "unsupported"), ("reason", str reason), ("expression", str text)]

partial def effectNames (e : Expr) (seen : NameSet := {}) (depth : Nat := 0) : MetaM (Array String) := do
  if depth > 32 then return #[]
  match e with
  | .forallE _ _ result _ | .lam _ _ result _ =>
    return ← effectNames result seen (depth + 1)
  | _ => pure ()
  let some name := e.getAppFn.constName? | return #[]
  if seen.contains name then return #[]
  if [``IO, ``EIO, ``BaseIO, ``Task, ``ST].contains name then return #[name.toString]
  if let some (.defnInfo info) := (← getEnv).find? name then
    return ← effectNames (info.value.beta e.getAppArgs) (seen.insert name) (depth + 1)
  return #[]

def scalarType (request : Request) (e : Expr) : MetaM Json := do
  let value ← shape request e
  if (value.getObjValAs? String "kind").toOption != some "primitive" then
    throwError "ordinary components require a primitive value"
  let name ← ofExcept <| value.getObjValAs? String "name"
  return obj [("kind", str "primitive"), ("name", str name)]

partial def componentCopiedType (value : Json) : MetaM Json := do
  let kind := (value.getObjValAs? String "kind").toOption.getD ""
  -- A value index is instantiation provenance only, never a host type.
  if kind == "value" then
    return obj [("kind", str kind), ("type", ← componentCopiedType (← ofExcept <| value.getObjVal? "type")),
      ("value", ← ofExcept <| value.getObjVal? "value")]
  if kind == "reference" then
    return obj [("kind", str kind), ("name", ← ofExcept <| value.getObjVal? "name")]
  if kind == "graph" then
    let types ← ofExcept <| value.getObjValAs? (Array Json) "types"
    return obj [("kind", str kind),
      ("root", ← componentCopiedType (← ofExcept <| value.getObjVal? "root")),
      ("types", toJson (← types.mapM componentCopiedType))]
  if (value.getObjValAs? String "kind").toOption == some "primitive" then
    return obj [("kind", str "primitive"), ("name", ← ofExcept <| value.getObjVal? "name")]
  let kind := (value.getObjValAs? String "kind").toOption.getD ""
  if kind == "refinement" then
    return obj [("kind", str kind),
      ("base", ← componentCopiedType (← ofExcept <| value.getObjVal? "base")),
      ("predicate", ← ofExcept <| value.getObjVal? "predicate")]
  if kind == "alias" then
    return obj [("kind", str kind), ("name", ← ofExcept <| value.getObjVal? "name"),
      ("target", ← componentCopiedType (← ofExcept <| value.getObjVal? "target"))]
  if kind == "array" || kind == "list" || kind == "option" then
    return obj [("kind", str kind),
      ("element", ← componentCopiedType (← ofExcept <| value.getObjVal? "element"))]
  if kind == "result" || kind == "tuple" then
    let args ← ofExcept <| value.getObjValAs? (Array Json) "arguments"
    return obj [("kind", str kind), ("arguments", toJson (← args.mapM componentCopiedType))]
  if (value.getObjValAs? String "kind").toOption == some "record" then
    let fields ← ofExcept <| value.getObjValAs? (Array Json) "fields"
    let fields ← fields.mapM fun (field : Json) => do
      pure <| obj [("name", ← ofExcept <| field.getObjVal? "name"),
        ("type", ← componentCopiedType (← ofExcept <| field.getObjVal? "type"))]
    let provenance ← match value.getObjVal? "provenance" with
      | .ok provenance => do
        let args ← ofExcept <| provenance.getObjValAs? (Array Json) "arguments"
        pure [("provenance", obj [("structure", ← ofExcept <| provenance.getObjVal? "structure"),
          ("arguments", toJson (← args.mapM componentCopiedType))])]
      | .error _ => pure []
    let erased := match value.getObjVal? "erased" with | .ok names => [("erased", names)] | .error _ => []
    return obj ([("kind", str "record"), ("name", ← ofExcept <| value.getObjVal? "name")] ++ provenance ++ [("fields", toJson fields)] ++ erased)
  if kind == "variant" then
    let cases ← ofExcept <| value.getObjValAs? (Array Json) "cases"
    let cases ← cases.mapM fun (item : Json) => do
      let fields ← ofExcept <| item.getObjValAs? (Array Json) "fields"
      let fields ← fields.mapM fun (field : Json) => do
        pure <| obj [("name", ← ofExcept <| field.getObjVal? "name"),
          ("type", ← componentCopiedType (← ofExcept <| field.getObjVal? "type"))]
      pure <| obj [("name", ← ofExcept <| item.getObjVal? "name"), ("fields", toJson fields)]
    return obj [("kind", str kind), ("name", ← ofExcept <| value.getObjVal? "name"), ("cases", toJson cases)]
  throwError "component copied values require primitives, aliases, arrays, lists, records, variants, Option, Except or Prod"

def componentType (value : Json) : MetaM Json := do
  if (value.getObjValAs? String "kind").toOption != some "callback" then
    return ← componentCopiedType value
  let parameters ← ofExcept <| value.getObjValAs? (Array Json) "parameters"
  let result ← ofExcept <| value.getObjVal? "result"
  return obj [("kind", str "callback"), ("parameters", toJson (← parameters.mapM componentCopiedType)),
    ("result", ← componentCopiedType result)]

def describeScalarSignature (request : Request) (type : Expr) : MetaM (Array Json × String × Json) :=
  forallTelescopeReducing type fun arguments result => do
    let mut parameters := #[]
    let mut runtimeParameters := #[]
    let mut problem : Option Json := none
    for argument in arguments do
      let binder ← argument.fvarId!.getDecl
      let text ← expression binder.type
      parameters := parameters.push <| obj [("name", str binder.userName.toString),
        ("binderInfo", str (binderName binder.binderInfo)), ("typeExpression", str text)]
      let reason := if binder.binderInfo == .instImplicit then some "instance-parameter"
        else if binder.binderInfo != .default then some "implicit-parameter"
        else if binder.type.hasFVar then some "dependent-type" else none
      if let some reason := reason then
        if problem.isNone then problem := some (unsupported reason text)
      else
        try
          runtimeParameters := runtimeParameters.push <| obj [("name", str binder.userName.toString),
            ("type", ← scalarType request binder.type)]
        catch _ =>
          if problem.isNone then problem := some (unsupported "unsupported-parameter-type" text)
    let resultText ← expression result
    if result.hasFVar && problem.isNone then problem := some (unsupported "dependent-type" resultText)
    let mut runtimeResult := Json.null
    try runtimeResult ← scalarType request result
    catch _ =>
      if problem.isNone then problem := some (unsupported "unsupported-result-type" resultText)
    if arguments.size > 32 then problem := some (unsupported "arity-limit" resultText)
    return (parameters, resultText, problem.getD <| obj [("status", str "supported"),
      ("bindingShape", str "pure-function"), ("parameters", toJson runtimeParameters),
      ("result", runtimeResult)])

/- Contracts constrain the adapter; they never supply a type or authorize erasure. -/
partial def containsRefinement (type : Json) : Bool :=
  let kind := (type.getObjValAs? String "kind").toOption.getD ""
  if kind == "refinement" then true
  else if kind == "graph" then
    containsRefinement ((type.getObjVal? "root").toOption.getD Json.null) ||
      ((type.getObjValAs? (Array Json) "types").toOption.getD #[]).any containsRefinement
  else if kind == "alias" then
    containsRefinement ((type.getObjVal? "target").toOption.getD Json.null)
  else if kind == "record" then
    ((type.getObjValAs? (Array Json) "fields").toOption.getD #[]).any fun field =>
      containsRefinement ((field.getObjVal? "type").toOption.getD Json.null)
  else if kind == "variant" then
    ((type.getObjValAs? (Array Json) "cases").toOption.getD #[]).any fun branch =>
      ((branch.getObjValAs? (Array Json) "fields").toOption.getD #[]).any fun field =>
        containsRefinement ((field.getObjVal? "type").toOption.getD Json.null)
  else if kind == "callback" then
    ((type.getObjValAs? (Array Json) "parameters").toOption.getD #[]).any containsRefinement ||
      containsRefinement ((type.getObjVal? "result").toOption.getD Json.null)
  else if ["array", "list", "option"].contains kind then
    containsRefinement ((type.getObjVal? "element").toOption.getD Json.null)
  else if ["tuple", "result"].contains kind then
    ((type.getObjValAs? (Array Json) "arguments").toOption.getD #[]).any containsRefinement
  else false

def contractSiteProblem (site type : Json) (result : Bool) (label : String)
    (owned : Bool := false) : Option String := Id.run do
  if let .ok refinement := site.getObjVal? "refinement" then
    if refinement == str "reject" then
      if containsRefinement type then
        return some s!"{label}: the contract rejects compiler-checked refined values"
    else
      let predicate := (type.getObjVal? "predicate").toOption.getD Json.null
      let configured := (refinement.getObjValAs? String "constructor").toOption
      if (type.getObjValAs? String "kind").toOption != some "refinement" ||
          !["subtype", "checked-record"].contains ((predicate.getObjValAs? String "kind").toOption.getD "") ||
          configured != (predicate.getObjValAs? String "constructor").toOption then
        return some s!"{label}: checked refinement constructor does not match the compiler-checked Subtype"
  let identity := ["resource", "callback", "owned-graph"].contains ((type.getObjValAs? String "kind").toOption.getD "")
  let lifetime := (site.getObjVal? "lifetime").toOption.getD Json.null
  if owned && !result && identity &&
      (site.getObjValAs? String "ownership").toOption == some "transfer" &&
      ["call", "explicit"].contains ((lifetime.getObjValAs? String "scope").toOption.getD "") &&
      (lifetime.getObjVal? "anchor").toOption == some Json.null then
    return none
  if owned && result && identity &&
      (site.getObjValAs? String "ownership").toOption == some "borrow" &&
      ["parameter", "receiver"].contains ((lifetime.getObjValAs? String "scope").toOption.getD "") then
    return none
  let ownership := if identity then (if result then "lease" else "borrow") else "copy"
  if (site.getObjValAs? String "ownership").toOption != some ownership then
    return some s!"{label}: ownership or lifetime differs from the implemented adapter"
  if identity then
    if (lifetime.getObjValAs? String "scope").toOption != some (if result then "explicit" else "call") ||
        (lifetime.getObjVal? "anchor").toOption != some Json.null then
      return some s!"{label}: ownership or lifetime differs from the implemented adapter"
  else if lifetime != Json.null then
    return some s!"{label}: ownership or lifetime differs from the implemented adapter"
  return none

partial def contractProblem (contract projection : Json) (owned : Bool := false) : Option String := Id.run do
  let parameters := (projection.getObjValAs? (Array Json) "parameters").toOption.getD #[]
  let receiverKind := (contract.getObjValAs? String "receiver").toOption
  if let some kind := receiverKind then
    if !owned then return some "receiver exports require the explicit ownership-aware profile"
    let receiver := (parameters[0]?.bind fun p => (p.getObjVal? "type").toOption).getD Json.null
    let root := (receiver.getObjVal? "root").toOption.getD Json.null
    let definitions := (receiver.getObjValAs? (Array Json) "types").toOption.getD #[]
    let definition := definitions.find? fun item =>
      (item.getObjValAs? String "name").toOption == (root.getObjValAs? String "name").toOption
    let nominal := (receiver.getObjValAs? String "kind").toOption == some "owned-graph" &&
      (root.getObjValAs? String "kind").toOption == some "reference" &&
      ["record", "variant"].contains ((definition.bind fun item => (item.getObjValAs? String "kind").toOption).getD "")
    if (receiver.getObjValAs? String "kind").toOption != some "resource" && !nominal then
      return some "receiver must be the first argument and name a resource or owned record or variant"
    if kind == "property" && parameters.size != 1 then
      return some "a property must have only its receiver argument"
  if let .ok effects := contract.getObjValAs? (Array String) "effects" then
    let hasCallback := parameters.any fun parameter =>
      ((parameter.getObjVal? "type" >>= fun type => type.getObjValAs? String "kind").toOption == some "callback")
    let retained := fun (type : Json) =>
      ["resource", "callback", "owned-graph"].contains ((type.getObjValAs? String "kind").toOption.getD "")
    let mut expected := if hasCallback then #["fails", "host-call"] else #[]
    if owned then
      if parameters.any (fun p => retained ((p.getObjVal? "type").toOption.getD Json.null)) then
        expected := expected.push "reads-resource"
      if retained ((projection.getObjVal? "result").toOption.getD Json.null) then
        expected := expected.push "allocates"
    if effects.qsort (· < ·) != expected.qsort (· < ·) then
      return some "effects differ from the implemented boundary effects"
  if let .ok sites := contract.getObjValAs? (Array Json) "parameters" then
    if sites.size != parameters.size then
      return some "parameter decisions must cover the exact runtime argument count"
    for index in [:sites.size] do
      let type := (parameters[index]!.getObjVal? "type").toOption.getD Json.null
      if let some problem := contractSiteProblem sites[index]! type false s!"arg{index}" owned then
        return some problem
  if let .ok site := contract.getObjVal? "result" then
    let type := (projection.getObjVal? "result").toOption.getD Json.null
    if let some problem := contractSiteProblem site type true "result" owned then return some problem
    if (site.getObjValAs? String "ownership").toOption == some "borrow" then
      let lifetime := (site.getObjVal? "lifetime").toOption.getD Json.null
      let anchor := (lifetime.getObjValAs? String "anchor").toOption.getD ""
      let receiver := (lifetime.getObjValAs? String "scope").toOption == some "receiver"
      let index := if receiver then (if receiverKind.isSome then some 0 else none)
        else (List.range parameters.size).find? fun index => anchor == s!"arg{index}"
      if !receiver && receiverKind.isSome && index == some 0 then
        return some "result: use receiver scope to borrow from the receiver"
      if let some index := index then
        let anchorType := (parameters[index]!.getObjVal? "type").toOption.getD Json.null
        if !["resource", "callback", "owned-graph"].contains ((anchorType.getObjValAs? String "kind").toOption.getD "") then
          return some "result: borrowed results require a retained identity or aggregate anchor"
        let sites := (contract.getObjValAs? (Array Json) "parameters").toOption.getD #[]
        if let some input := sites[index]? then
          if (input.getObjValAs? String "ownership").toOption == some "transfer" then
            return some "result: borrowed results cannot use a transferred input as their anchor"
      else
        return some "result: borrowed results require a retained identity or aggregate anchor"
  let mut sites : Array (Json × Json × String) := #[]
  if let .ok choices := contract.getObjValAs? (Array Json) "parameters" then
    for index in [:choices.size] do
      sites := sites.push (choices[index]!, (parameters[index]!.getObjVal? "type").toOption.getD Json.null, s!"arg{index}")
  if let .ok site := contract.getObjVal? "result" then
    sites := sites.push (site, (projection.getObjVal? "result").toOption.getD Json.null, "result")
  for (site, type, label) in sites do
    if let .ok choice := site.getObjVal? "callable" then
      if (type.getObjValAs? String "kind").toOption != some "callback" then
        return some s!"{label}: callable decisions require a compiler-checked callback type"
      let choices := (choice.getObjValAs? (Array Json) "parameters").toOption.getD #[]
      if choices.any (fun value => (value.getObjValAs? String "ownership").toOption == some "transfer") then
        return some s!"{label}: callback inputs require call-scoped borrows or copied values"
      let arguments := (type.getObjValAs? (Array Json) "parameters").toOption.getD #[]
      let nested := obj [("status", str "supported"),
        ("parameters", toJson (arguments.map fun type => obj [("type", type)])),
        ("result", (type.getObjVal? "result").toOption.getD Json.null)]
      if let some problem := contractProblem choice nested owned then
        return some s!"{label}.callable: {problem}"
  return none

def constrainProjection (request : Request) (name : String) (projection : Json) : Json := Id.run do
  if (projection.getObjValAs? String "status").toOption != some "supported" then return projection
  if let some contracts := request.contracts then
    if let .ok contract := contracts.getObjVal? name then
      if let some problem := contractProblem contract projection request.ownedAggregates.isSome then
        return unsupported "export-contract-mismatch" problem
  return projection

def checkedConstructor (site : Json) : Option String := do
  let refinement ← (site.getObjVal? "refinement").toOption
  (refinement.getObjValAs? String "constructor").toOption

def describeSignature (request : Request) (name : String) (type : Expr) (parentAliases : Option (IO.Ref ParentAliasCache) := none) : MetaM (Array Json × String × Json) := do
  let (parameters, resultText, scalarProjection) ← describeScalarSignature request type
  let native := request.profile.getD "component-scalars-v1" == "native-library-v1"
  let selectedArity := request.arities.find? (·.1 == name) |>.map (·.2)
  if !native && selectedArity.isNone && (scalarProjection.getObjValAs? String "reason").toOption == some "arity-limit" then
    return (parameters, resultText, scalarProjection)
  let arity := selectedArity.getD (if native then 1024 else 32)
  let contract := request.contracts.bind fun contracts => (contracts.getObjVal? name).toOption
  let checkedParameters := contract.bind (fun value => (value.getObjValAs? (Array Json) "parameters").toOption)
    |>.getD #[] |>.map checkedConstructor
  let checkedResult := contract.bind (fun value => (value.getObjVal? "result").toOption) |>.bind checkedConstructor
  try
    let (nativeParameters, result) ← signature request type arity checkedParameters checkedResult (parentAliases := parentAliases)
    if !native && nativeParameters.size > 32 then throwError "components support at most 32 arguments"
    let nativeParameters ← if native then pure nativeParameters else nativeParameters.mapM fun (parameter : Json) => do
      pure <| obj [("name", ← ofExcept <| parameter.getObjVal? "name"),
        ("type", ← componentType (← ofExcept <| parameter.getObjVal? "type"))]
    let result ← if native then pure result else componentType result
    let nativeParameters := nativeParameters.mapIdx fun index parameter =>
      obj [("name", (parameters[index]?.bind fun value => (value.getObjVal? "name").toOption).getD (str s!"arg{index}")),
        ("type", (parameter.getObjVal? "type").toOption.getD Json.null)]
    return (parameters, resultText, obj [("status", str "supported"),
      ("bindingShape", str (if native then "native-function" else "pure-function")), ("parameters", toJson nativeParameters), ("result", result)])
  catch error =>
    if !native then
      if (scalarProjection.getObjValAs? String "status").toOption == some "supported" ||
          checkedParameters.any Option.isSome || checkedResult.isSome then
        return (parameters, resultText, unsupported "unsupported-native-type" (← error.toMessageData.toString))
      return (parameters, resultText, scalarProjection)
    let reason := (scalarProjection.getObjValAs? String "reason").toOption.getD "unsupported-native-type"
    let reason := if ["implicit-parameter", "instance-parameter", "dependent-type"].contains reason then reason else "unsupported-native-type"
    return (parameters, resultText, unsupported reason (← error.toMessageData.toString))

def diagnostic (category code message moduleName : String) (name : Option String) : Json :=
  obj [("category", str category), ("code", str code), ("severity", str "error"),
    ("message", str message), ("module", str moduleName), ("declaration", toJson name)]

def diagnosticKey (value : Json) : String :=
  ["category", "code", "module", "declaration"].foldl (init := "") fun key field =>
    key ++ "|" ++ (value.getObjValAs? String field).toOption.getD ""

/- Apply only a finite leading type prefix, then resolve its instance dictionaries.
   The caller still checks the resulting runtime signature and all used bodies. -/
def specialize (selection : Specialization) : MetaM Expr := do
  let mut value ← mkConstWithFreshMVarLevels selection.declaration.toName
  for typeName in selection.types do
    let .forallE _ domain _ _ ← whnf (← inferType value)
      | throwError "{selection.declaration} has fewer leading type parameters than configured"
    unless (← whnf domain).isSort do
      throwError "{selection.declaration}: configured types must bind leading type parameters"
    let argument ← mkConstWithFreshMVarLevels typeName.toName
    let argumentType ← inferType argument
    unless (← whnf argumentType).isSort && (← isDefEq domain argumentType) do
      throwError "{typeName} is not a closed type accepted by {selection.declaration}"
    value := mkApp value argument
  repeat
    let .forallE _ domain _ .instImplicit ← whnf (← inferType value) | break
    value := mkApp value (← synthInstance domain)
  value ← instantiateMVars value
  if value.hasMVar || value.hasLevelParam || value.hasFVar || value.hasLooseBVars then
    throwError "{selection.declaration} still has unresolved type or universe parameters"
  return value

/- Serialize the checked expression, rather than resolving pretty-printed names
   again in an adapter namespace. Every constant has an absolute Lean name. -/
partial def applicationSource (value : Expr) (variables : Array String := #[])
    (depth : Nat := 0) : MetaM String := do
  if depth > 128 then throwError "specialization application exceeds the expression nesting limit"
  let render := fun e => applicationSource e variables (depth + 1)
  match value with
  | .const name levels =>
    if isPrivateName name || name.hasMacroScopes then
      throwError "specialization requires a public named dictionary or a monomorphic wrapper: {name}"
    let identifier ← PrettyPrinter.ppTerm ⟨mkIdent (rootNamespace ++ name)⟩
    let levels ← levels.mapM fun level => return (← PrettyPrinter.ppLevel level).pretty
    return "@" ++ identifier.pretty ++ (if levels.isEmpty then "" else ".{" ++ String.intercalate ", " levels ++ "}")
  | .app .. =>
    let fn := value.getAppFn
    if !fn.isConst && !fn.isBVar then
      let reduced ← whnf value
      if reduced != value then return ← render reduced
      throwError "specialization requires a named function application or a monomorphic wrapper"
    let head ← render fn
    let arguments ← value.getAppArgs.mapM fun arg => return "(" ++ (← render arg) ++ ")"
    return "(" ++ (if fn.isBVar then "@" else "") ++ head ++ " " ++ String.intercalate " " arguments.toList ++ ")"
  | .mdata _ body => render body
  | .bvar index =>
    if index < variables.size then return variables[variables.size - 1 - index]!
    throwError "specialization application contains an unbound variable"
  | .sort level => return s!"(Sort {(← PrettyPrinter.ppLevel level).pretty})"
  | .lit (.natVal value) => return s!"({value} : _root_.Nat)"
  | .lit (.strVal value) => return (← PrettyPrinter.ppTerm ⟨Syntax.mkStrLit value⟩).pretty
  | .lam _ type body binder | .forallE _ type body binder =>
    let name := s!"_bridgeSpecial{variables.size}"
    let declaration := s!"{name} : {← render type}"
    let binding := match binder with
      | .default => "(" ++ declaration ++ ")"
      | .implicit => "{" ++ declaration ++ "}"
      | .strictImplicit => "⦃" ++ declaration ++ "⦄"
      | .instImplicit => "[" ++ declaration ++ "]"
    let body ← applicationSource body (variables.push name) (depth + 1)
    return if value.isLambda then s!"(fun {binding} => {body})" else s!"(∀ {binding}, {body})"
  | .letE _ type assigned body _ =>
    let name := s!"_bridgeSpecial{variables.size}"
    return s!"(let {name} : {← render type} := {← render assigned}; {← applicationSource body (variables.push name) (depth + 1)})"
  | _ => throwError "specialization application requires a monomorphic wrapper for this expression: {value}"

def checkedApplicationSource (value : Expr) : MetaM String := do
  let source ← applicationSource value
  let parsed ← ofExcept <| Parser.runParserCategory (← getEnv) `term source
  let reconstructed ← Elab.Term.TermElabM.run' <| Elab.Term.withoutErrToSorry do
    let term ← Elab.Term.elabTermEnsuringType parsed (← inferType value)
    Elab.Term.synthesizeSyntheticMVarsNoPostponing
    instantiateMVars term
  unless !reconstructed.hasMVar && (← isDefEq value reconstructed) do
    throwError "serialized specialization differs from its compiler application"
  return source

def extractSpecialization (request : Request) (source : Json) (selection : Specialization) (parentAliases : Option (IO.Ref ParentAliasCache) := none) : MetaM Json := do
  let mut result := source.setObjVal! "identity" (str selection.name) |>.setObjVal! "selected" (toJson true)
  let mut application := Json.null
  try
    unless (source.getObjValAs? String "visibility").toOption == some "public" &&
        (source.getObjValAs? String "kind").toOption != some "theorem" do
      throwError "specializations require a public executable source declaration"
    let value ← specialize selection
    for name in value.getUsedConstants do
      let _ ← checkBody request name
      if (← collectAxioms name).contains ``sorryAx then
        throwError "specialization depends on sorry: {name}"
    let type ← inferType value
    let (parameters, resultText, projection) ← describeSignature request selection.name type parentAliases
    let effects ← effectNames type
    let typeText ← expression type
    let projection := constrainProjection request selection.name <|
      if effects.isEmpty then projection else unsupported "unsupported-effect" typeText
    result := result.setObjVal! "typeExpression" (str typeText)
      |>.setObjVal! "parameters" (toJson parameters) |>.setObjVal! "resultExpression" (str resultText)
      |>.setObjVal! "effects" (toJson effects) |>.setObjVal! "projection" projection
    application := str (← checkedApplicationSource value)
  catch error =>
    result := result.setObjVal! "projection" (unsupported "invalid-specialization" (← error.toMessageData.toString))
  return result.setObjVal! "specialization" (obj [("declaration", str selection.declaration),
    ("types", toJson selection.types), ("application", application)])

/- Rehydrate only Lean's built-in class/instance indexes. Importing arbitrary
   extension initializers would execute package code during analysis. -/
def loadBuiltinIndex {α β σ : Type} [Inhabited σ]
    (extension : PersistentEnvExtension α β σ) (env : Environment) : IO Environment := do
  let entries := (extension.toEnvExtension.getState env).importedEntries
  let state ← extension.addImportedFn entries { env := env, opts := {} }
  return extension.setState env state

def extractMetadata (request : Request) (parentAliases : Option (IO.Ref ParentAliasCache) := none) : MetaM Json := do
  let some context := request.metadata | throwError "metadata context is required"
  let profile := request.profile.getD "component-scalars-v1"
  unless ["component-scalars-v1", "native-library-v1"].contains profile do
    throwError "unsupported metadata profile"
  let env ← getEnv
  -- One lazily built alias index per request, shared by every site that needs discovery.
  let parentAliases := some (← match parentAliases with | some cache => pure cache | none => IO.mkRef ({} : ParentAliasCache))
  let specializations := request.specializations.getD #[]
  for selection in specializations do
    if env.contains selection.name.toName then
      throwError "specialization name already exists: {selection.name}"
  let selectedModules := request.exportModules.getD request.modules
  if selectedModules.isEmpty || selectedModules.any (!request.modules.contains ·) ||
      context.modules.map (·.name) != request.modules then
    throwError "metadata modules differ from the compiled closure"
  let mut declarations : Array (Name × ConstantInfo) := #[]
  let mut theorems : Array (Name × Expr) := #[]
  for (name, info) in env.constants.toList do
    if let some index := env.getModuleIdxFor? name then
      let moduleName := env.header.moduleNames[index.toNat]!.toString
      if request.modules.contains moduleName then
        if info matches .thmInfo _ then theorems := theorems.push (name, info.type)
        if selectedModules.contains moduleName && (info matches .defnInfo _ | .opaqueInfo _ | .thmInfo _) then
          if (← getProjectionFnInfo? name).isNone && !isAuxRecursor env name && !isNoConfusion env name &&
              (isPrivateName name || !(← isAutoDeclOrPrivate_Internal name)) then
            declarations := declarations.push (name, info)
  declarations := declarations.qsort (fun a b => a.1.toString < b.1.toString)
  let mut modules := #[]
  let mut diagnostics := #[]
  let mut discovered := #[]
  for source in context.modules do
    let some moduleIndex := env.getModuleIdx? source.name.toName | throwError "missing metadata module {source.name}"
    let mut items := #[]
    for (name, info) in declarations do
      if env.getModuleIdxFor? name == some moduleIndex then
        let kind := match info with
          | .thmInfo _ => "theorem"
          | .opaqueInfo _ => "opaque"
          | .defnInfo definition => if definition.hints matches .abbrev then "abbreviation" else "definition"
          | _ => "definition"
        let visibility := if isPrivateName name then "private" else if isProtected env name then "protected" else "public"
        let typeValue ← forallTelescopeReducing info.type fun _ result => pure result.isSort
        let proofValue ← forallTelescopeReducing info.type fun _ result => isProp result
        let selected := if request.exports.isEmpty then visibility == "public" && kind != "theorem" && !typeValue && !proofValue &&
            !specializations.any (·.declaration == name.toString)
          else request.exports.contains name.toString
        if selected then discovered := discovered.push name.toString
        let typeText ← expression info.type
        let (parameters, resultText, runtimeProjection) ← describeSignature request name.toString info.type parentAliases
        let effects ← effectNames info.type
        let mut projection := runtimeProjection
        if !info.levelParams.isEmpty then projection := unsupported "specialization-required" typeText
        if !effects.isEmpty then projection := unsupported "unsupported-effect" typeText
        if typeValue then projection := unsupported "type-declaration" typeText
        if proofValue || kind == "theorem" then projection := unsupported "proof-only" typeText
        if visibility != "public" then projection := unsupported "visibility" typeText
        if selected then
          try
            let _ ← checkBody request name
            if (← collectAxioms name).contains ``sorryAx then
              projection := unsupported "admitted-implementation" typeText
          catch error => projection := unsupported "unreviewed-implementation" (← error.toMessageData.toString)
        if selected then projection := constrainProjection request name.toString projection
        let ranges ← findDeclarationRanges? name
        let position := ranges.map fun ranges => obj [("path", str source.sourcePath),
          ("startLine", toJson ranges.range.pos.line), ("startColumn", toJson ranges.range.charUtf16),
          ("endLine", toJson ranges.range.endPos.line), ("endColumn", toJson ranges.range.endCharUtf16)]
        if selected && position.isNone then
          diagnostics := diagnostics.push <| diagnostic "extractor-failure" "missing-source-position"
            s!"Lean supplied no source range for {name}" source.name (some name.toString)
        if selected && (projection.getObjValAs? String "status").toOption == some "unsupported" then
          let reason ← ofExcept <| projection.getObjValAs? String "reason"
          let explanation := if reason == "export-contract-mismatch" then
              (projection.getObjValAs? String "expression").toOption.getD reason else reason
          diagnostics := diagnostics.push <| diagnostic "unsupported-meaning" reason
            s!"{name}: {explanation}" source.name (some name.toString)
        let references := theorems.filter (fun item => item.2.getUsedConstants.contains name)
          |>.map (·.1.toString) |>.qsort (· < ·)
        let documentation ← findDocString? env name
        items := items.push <| obj [("identity", str name.toString), ("kind", str kind),
          ("visibility", str visibility), ("selected", toJson selected), ("source", position.getD Json.null),
          ("documentation", toJson documentation), ("typeExpression", str typeText),
          ("parameters", toJson parameters), ("resultExpression", str resultText),
          ("effects", toJson effects), ("theoremReferences", toJson references), ("projection", projection)]
    let originals := items
    for selection in specializations do
      if let some original := originals.find? (fun item => (item.getObjValAs? String "identity").toOption == some selection.declaration) then
        let item ← extractSpecialization request original selection parentAliases
        items := items.push item
        discovered := discovered.push selection.name
        let projection ← ofExcept <| item.getObjVal? "projection"
        if (projection.getObjValAs? String "status").toOption == some "unsupported" then
          let reason ← ofExcept <| projection.getObjValAs? String "reason"
          let message ← ofExcept <| projection.getObjValAs? String "expression"
          diagnostics := diagnostics.push <| diagnostic "unsupported-meaning" reason
            s!"{selection.name}: {message}" source.name (some selection.name)
        if (item.getObjVal? "source").toOption == some Json.null then
          diagnostics := diagnostics.push <| diagnostic "extractor-failure" "missing-source-position"
            s!"Lean supplied no source range for {selection.declaration}" source.name (some selection.name)
    let imports := env.header.moduleData[moduleIndex.toNat]!.imports.map (·.module.toString)
      |>.toList |>.mergeSort (· < ·) |>.eraseDups |>.toArray
    modules := modules.push <| obj [("name", str source.name), ("sourcePath", str source.sourcePath),
      ("sourceSha256", str source.sourceSha256), ("interfaceSha256", str source.interfaceSha256),
      ("directImports", toJson imports), ("declarations", toJson (items.qsort fun a b =>
        (a.getObjValAs? String "identity").toOption.getD "" < (b.getObjValAs? String "identity").toOption.getD ""))]
  for name in (request.exports ++ specializations.map (·.name)).toList.eraseDups do
    if !discovered.contains name then
      diagnostics := diagnostics.push <| diagnostic "unsupported-meaning" "missing-declaration"
        s!"Selected export is absent or outside selected modules: {name}" "" (some name)
  if let some contracts := request.contracts then
    for (name, _) in (← ofExcept contracts.getObj?).toArray do
      if !discovered.contains name then
        diagnostics := diagnostics.push <| diagnostic "unsupported-meaning" "unused-export-contract"
          s!"Contract must name a selected public export: {name}" "" (some name)
  return obj [("schemaVersion", toJson (2 : Nat)), ("kind", str "lean-bridge-elaborated-exports"),
    ("profile", str profile),
    ("producer", obj [("adapter", str "lean-bridge-elaborator"), ("adapterVersion", toJson (2 : Nat)),
      ("tool", str "Lean"), ("toolVersion", str Lean.versionString), ("toolchain", str context.toolchain),
      ("invocationIdentitySha256", str context.invocationIdentitySha256)]),
    ("modules", toJson (modules.qsort fun a b => (a.getObjValAs? String "name").toOption.getD "" < (b.getObjValAs? String "name").toOption.getD "")),
    ("diagnostics", toJson (diagnostics.qsort fun a b => diagnosticKey a < diagnosticKey b))]

end LeanBridge.NativeExports

unsafe def main (args : List String) : IO UInt32 := do
  let (path, safetyOnly) ← match args with
    | ["--check-bodies", path] => pure (path, true)
    | ["--metadata", path] => pure (path, false)
    | _ => throw (IO.userError "expected --metadata or --check-bodies and an export request JSON path")
  let json ← IO.ofExcept <| Json.parse (← IO.FS.readFile path)
  let request ← IO.ofExcept <| fromJson? (α := LeanBridge.NativeExports.Request) json
  initSearchPath (← findSysroot)
  let mut env ← importModules (request.modules.map fun name => { module := name.toName }) {} 0
  if !(request.specializations.getD #[]).isEmpty then
    env ← LeanBridge.NativeExports.loadBuiltinIndex classExtension env
    env ← LeanBridge.NativeExports.loadBuiltinIndex instanceExtension.ext env
  let operation := if safetyOnly then do
      if request.exports.isEmpty then throwError "no exports supplied for implementation checking"
      for name in request.exports do
        let info ← getConstInfo name.toName
        let some index := env.getModuleIdxFor? name.toName
          | throwError "missing module for {name}"
        if !request.modules.contains env.header.moduleNames[index.toNat]!.toString then
          throwError "export outside selected modules: {name}"
        if isPrivateName name.toName || isProtected env name.toName then
          throwError "nonpublic export {name}"
        if !info.levelParams.isEmpty then throwError "generic export {name} requires specialization"
        match info with
        | .defnInfo _ | .opaqueInfo _ => pure ()
        | _ => throwError "{name} is not an executable definition"
        let _ ← LeanBridge.NativeExports.checkBody request name.toName
        if (← collectAxioms name.toName).contains ``sorryAx then
          throwError "export {name} depends on sorry"
      pure <| Json.mkObj [("checked", toJson request.exports)]
    else LeanBridge.NativeExports.extractMetadata request
  let (metadata, _, _) ← operation.toIO
    { fileName := "<native-exports>", fileMap := default } { env }
  IO.println metadata.compress
  return 0
