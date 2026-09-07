import Std
import UnionFindCore

/-!
Correctness theorems for both the direct representative-only solver and the
diagnostic certifying union-find implementation in `UnionFindCore.lean`.
-/

namespace LeanUnionFind

def LinkEdge (count : Nat) (links : Array Nat) (left right : Nat) : Prop :=
  left < count ∧ right < count ∧ ∃ edge, edge < links.size / 2 ∧
    let index := edge * 2
    (arrayGet links index 0 = left ∧ arrayGet links (index + 1) 0 = right) ∨
    (arrayGet links index 0 = right ∧ arrayGet links (index + 1) 0 = left)

inductive Connected (count : Nat) (links : Array Nat) : Nat → Nat → Prop
  | edge {left right} : LinkEdge count links left right → Connected count links left right
  | refl (vertex) : vertex < count → Connected count links vertex vertex
  | symm {left right} : Connected count links left right → Connected count links right left
  | trans {left middle right} : Connected count links left middle →
      Connected count links middle right → Connected count links left right

theorem edgeMatches_linkEdge (count : Nat) (links : Array Nat) (edge source target : Nat)
    (sourceBound : source < count) (targetBound : target < count)
    (matched : edgeMatches links edge source target = true) :
    LinkEdge count links source target := by
  refine ⟨sourceBound, targetBound, edge, ?_, ?_⟩
  · simp only [edgeMatches, Bool.and_eq_true, Bool.or_eq_true, decide_eq_true_eq] at matched
    omega
  · simp only [edgeMatches, Bool.and_eq_true, Bool.or_eq_true, decide_eq_true_eq] at matched
    exact matched.2

theorem allFrom_get (predicate : Nat → Bool) : ∀ fuel start index,
    allFrom predicate fuel start = true → start ≤ index → index < start + fuel →
      predicate index = true := by
  intro fuel
  induction fuel with
  | zero => intro start index _ _ bound; omega
  | succ fuel ih =>
      intro start index checked lower upper
      simp only [allFrom, Bool.and_eq_true] at checked
      by_cases first : index = start
      · subst index
        exact checked.1
      · exact ih start.succ index checked.2 (by omega) (by omega)

theorem certificate_parent_connected (count : Nat) (links representatives : Array Nat)
    (certificate : PartitionCertificate)
    (depthSize : certificate.depth.size = count)
    (checked : ∀ vertex, vertex < count →
      certificateVertexCheck count links representatives certificate vertex = true) :
    ∀ vertex, vertex < count →
      Connected count links vertex (arrayGet representatives vertex count) := by
  intro vertex vertexBound
  generalize depthEq : arrayGet certificate.depth vertex 0 = depth
  induction depth using Nat.strongRecOn generalizing vertex with
  | ind depth ih =>
      let representative := arrayGet representatives vertex count
      let parent := arrayGet certificate.parent vertex count
      have vertexCheck := checked vertex vertexBound
      change (if representative = vertex then
        parent = vertex && arrayGet certificate.depth vertex 1 = 0
      else parent < count &&
        arrayGet representatives parent count = representative &&
        arrayGet certificate.depth parent count < arrayGet certificate.depth vertex 0 &&
        edgeMatches links (arrayGet certificate.edge vertex (links.size / 2)) vertex parent) = true
        at vertexCheck
      by_cases isRepresentative : representative = vertex
      · simp only [isRepresentative, if_true, Bool.and_eq_true, decide_eq_true_eq] at vertexCheck
        change Connected count links vertex representative
        rw [isRepresentative]
        exact Connected.refl vertex vertexBound
      · simp only [isRepresentative, if_false, Bool.and_eq_true, decide_eq_true_eq] at vertexCheck
        have parentBound : parent < count := vertexCheck.1.1.1
        have parentRepresentative : arrayGet representatives parent count = representative :=
          vertexCheck.1.1.2
        have parentDepth : arrayGet certificate.depth parent count <
            arrayGet certificate.depth vertex 0 := vertexCheck.1.2
        have parentDepthZero : arrayGet certificate.depth parent 0 =
            arrayGet certificate.depth parent count := by
          have bound : parent < certificate.depth.size := by omega
          simp [arrayGet, Array.getD, bound]
        have parentConnected := ih (arrayGet certificate.depth parent 0) (by omega)
          parent parentBound rfl
        have edge := edgeMatches_linkEdge count links
          (arrayGet certificate.edge vertex (links.size / 2)) vertex parent vertexBound parentBound
          vertexCheck.2
        have first : Connected count links vertex parent := Connected.edge edge
        rw [parentRepresentative] at parentConnected
        exact Connected.trans first parentConnected

theorem certificate_edges_closed (count : Nat) (links representatives : Array Nat)
    (closed : allFrom (fun edge =>
      let index := edge * 2
      arrayGet representatives (arrayGet links index count) count =
        arrayGet representatives (arrayGet links (index + 1) count) count)
      (links.size / 2) 0 = true) :
    ∀ left right, Connected count links left right →
      arrayGet representatives left count = arrayGet representatives right count := by
  intro left right connection
  induction connection with
  | edge edgeProof =>
      rcases edgeProof with ⟨_, _, edge, edgeBound, endpoints⟩
      have firstBound : edge * 2 < links.size := by omega
      have secondBound : edge * 2 + 1 < links.size := by omega
      have firstFallback : arrayGet links (edge * 2) 0 = arrayGet links (edge * 2) count := by
        simp [arrayGet, Array.getD, firstBound]
      have secondFallback : arrayGet links (edge * 2 + 1) 0 =
          arrayGet links (edge * 2 + 1) count := by
        simp [arrayGet, Array.getD, secondBound]
      dsimp only at endpoints
      rw [firstFallback, secondFallback] at endpoints
      have edgeClosed : arrayGet representatives (arrayGet links (edge * 2) count) count =
          arrayGet representatives (arrayGet links (edge * 2 + 1) count) count := by
        simpa only [decide_eq_true_eq] using allFrom_get _ (links.size / 2) 0 edge closed
          (by omega) (by omega)
      rcases endpoints with endpoints | endpoints
      · rw [← endpoints.1, ← endpoints.2]
        exact edgeClosed
      · rw [← endpoints.1, ← endpoints.2]
        exact edgeClosed.symm
  | refl _ _ => rfl
  | symm _ ih => exact ih.symm
  | trans _ _ ihLeft ihRight => exact ihLeft.trans ihRight

theorem partitionCertificate_exact (count : Nat) (links : Array Nat)
    (certified : CertifiedPartition)
    (checked : partitionCertificateCheck count links certified = true) :
    ∀ left right, left < count → right < count →
      (arrayGet certified.result.representatives left count =
          arrayGet certified.result.representatives right count ↔
        Connected count links left right) := by
  simp only [partitionCertificateCheck, Bool.and_eq_true, decide_eq_true_eq] at checked
  have certificateDepthSize : certified.certificate.depth.size = count := checked.1.1.1.2
  have vertexChecks := checked.1.2
  have edgesClosed := checked.2
  intro left right leftBound rightBound
  constructor
  · intro same
    have leftConnected := certificate_parent_connected count links certified.result.representatives
      certified.certificate
      certificateDepthSize
      (fun vertex bound => allFrom_get _ count 0 vertex vertexChecks (by omega) (by omega))
      left leftBound
    have rightConnected := certificate_parent_connected count links certified.result.representatives
      certified.certificate
      certificateDepthSize
      (fun vertex bound => allFrom_get _ count 0 vertex vertexChecks (by omega) (by omega))
      right rightBound
    rw [same] at leftConnected
    exact Connected.trans leftConnected (Connected.symm rightConnected)
  · exact certificate_edges_closed count links certified.result.representatives edgesClosed left right

/-- A checked optimized partition has equal representatives exactly for linked elements. -/
theorem certifiedPartition_correct (count : Nat) (links : Array Nat)
    (certified : CertifiedPartition)
    (found : certifiedPartition count links = some certified) :
    ∀ left right, left < count → right < count →
      (arrayGet certified.result.representatives left count =
          arrayGet certified.result.representatives right count ↔
        Connected count links left right) := by
  simp only [certifiedPartition] at found
  split at found
  · rename_i checked
    simp only [Option.some.injEq] at found
    subst certified
    exact partitionCertificate_exact count links _ checked
  · simp at found

def FinConnected (count : Nat) (links : Array Nat) (left right : Fin count) : Prop :=
  Connected count links left right

theorem connected_equivalence (count : Nat) (links : Array Nat) :
    Equivalence (FinConnected count links) := {
  refl := fun vertex => Connected.refl vertex vertex.isLt
  symm := Connected.symm
  trans := Connected.trans
}

/-! Direct correctness layer for the representative-only production path. -/

inductive ParentPath (count : Nat) (parents : Array Nat) : Nat → Nat → Nat → Prop
  | root {vertex} : vertex < count → arrayGet parents vertex vertex = vertex →
      ParentPath count parents 0 vertex vertex
  | step {length vertex next root} : vertex < count → next < count →
      arrayGet parents vertex vertex = next → next ≠ vertex →
      ParentPath count parents length next root →
      ParentPath count parents (length + 1) vertex root

theorem ParentPath.root_bound {count parents length vertex root}
    (path : ParentPath count parents length vertex root) : root < count := by
  induction path with
  | root bound _ => exact bound
  | step _ _ _ _ _ ih => exact ih

theorem ParentPath.root_fixed {count parents length vertex root}
    (path : ParentPath count parents length vertex root) :
    arrayGet parents root root = root := by
  induction path with
  | root _ fixed => exact fixed
  | step _ _ _ _ _ ih => exact ih

theorem rootFrom_eq_of_path {count parents length vertex root fuel}
    (path : ParentPath count parents length vertex root) (enough : length < fuel) :
    rootFrom count fuel vertex parents = root := by
  induction path generalizing fuel with
  | root _ fixed =>
      cases fuel with
      | zero => omega
      | succ fuel => simp [rootFrom, fixed]
  | step _ _ parent notFixed _ ih =>
      cases fuel with
      | zero => omega
      | succ fuel =>
          simp only [rootFrom, parent]
          simp only [notFixed, if_false]
          exact ih (by omega)

def ParentSound (count : Nat) (links parents : Array Nat) : Prop :=
  ∀ vertex, vertex < count →
    let parent := arrayGet parents vertex vertex
    parent ≠ vertex → Connected count links vertex parent

theorem ParentPath.connected {count links parents length vertex root}
    (sound : ParentSound count links parents)
    (path : ParentPath count parents length vertex root) :
    Connected count links vertex root := by
  induction path with
  | root bound _ => exact Connected.refl _ bound
  | step sourceBound _ parent notFixed _ ih =>
      have edge := sound _ sourceBound
      rw [parent] at edge
      exact Connected.trans (edge notFixed) ih

def RootedWithin (count : Nat) (parents : Array Nat) (steps : Nat) : Prop :=
  ∀ vertex, vertex < count → ∃ length root,
    length ≤ steps ∧ ParentPath count parents length vertex root

def EdgesClosedBefore (count : Nat) (links parents : Array Nat) (processed : Nat) : Prop :=
  ∀ edge, edge < processed →
    let left := arrayGet links (edge * 2) count
    let right := arrayGet links (edge * 2 + 1) count
    ∃ leftLength rightLength root,
      leftLength ≤ processed ∧ rightLength ≤ processed ∧
      ParentPath count parents leftLength left root ∧
      ParentPath count parents rightLength right root

structure FastCorrect (count : Nat) (links : Array Nat) (processed : Nat) (state : State) : Prop where
  parentSize : state.parent.size = count
  rooted : RootedWithin count state.parent processed
  sound : ParentSound count links state.parent
  closed : EdgesClosedBefore count links state.parent processed

theorem linksValid_get {count : Nat} {links : Array Nat}
    (valid : linksValid count links = true) {index : Nat} (bound : index < links.size) :
    arrayGet links index count < count := by
  simp only [linksValid, Bool.and_eq_true] at valid
  have item := Array.all_eq_true.mp valid.2 index bound
  simpa [arrayGet, Array.getD, bound] using item

theorem initialParents_get {count vertex : Nat} (bound : vertex < count) :
    arrayGet (Array.ofFn fun index : Fin count => index.val) vertex vertex = vertex := by
  simp [arrayGet, Array.getD, bound]

theorem fastInitial_correct (count : Nat) (links : Array Nat) :
    FastCorrect count links 0 {
      parent := Array.ofFn fun index : Fin count => index.val
      size := Array.replicate count 1
    } := by
  constructor
  · simp
  · intro vertex bound
    exact ⟨0, vertex, by omega, ParentPath.root bound (initialParents_get bound)⟩
  · intro vertex bound
    simp only [initialParents_get bound]
    exact fun impossible => (impossible rfl).elim
  · intro edge impossible
    omega

theorem arrayGet_setIfInBounds {values : Array Nat} {index value source fallback : Nat}
    (sourceBound : source < values.size) :
    arrayGet (values.setIfInBounds index value) source fallback =
      if index = source then value else arrayGet values source fallback := by
  simp only [arrayGet, Array.getD, Array.size_setIfInBounds, sourceBound, dif_pos]
  exact Array.getElem_setIfInBounds sourceBound

theorem ParentPath.linkRoot {count parents length vertex root child parent}
    (parentSize : parents.size = count)
    (path : ParentPath count parents length vertex root)
    (childBound : child < count) (parentBound : parent < count)
    (childFixed : arrayGet parents child child = child)
    (parentFixed : arrayGet parents parent parent = parent)
    (different : child ≠ parent) :
    ∃ nextLength,
      nextLength ≤ length + 1 ∧
      ParentPath count (parents.setIfInBounds child parent) nextLength vertex
        (if root = child then parent else root) := by
  induction path with
  | root vertexBound fixed =>
      rename_i current
      by_cases isChild : current = child
      · have linkedParent : ParentPath count (parents.setIfInBounds child parent) 0 parent parent := by
          apply ParentPath.root parentBound
          rw [arrayGet_setIfInBounds (values := parents) (index := child)
            (value := parent) (source := parent) (fallback := parent) (by omega)]
          simp [different, parentFixed]
        have linkedChild : ParentPath count (parents.setIfInBounds child parent) 1 child parent := by
          apply ParentPath.step childBound parentBound
          · rw [arrayGet_setIfInBounds (values := parents) (index := child)
              (value := parent) (source := child) (fallback := child) (by omega)]
            simp
          · exact different.symm
          · exact linkedParent
        exact ⟨1, by omega, by simpa [isChild] using linkedChild⟩
      · have linkedRoot : ParentPath count (parents.setIfInBounds child parent) 0 current current := by
          apply ParentPath.root vertexBound
          rw [arrayGet_setIfInBounds (values := parents) (index := child)
            (value := parent) (source := current) (fallback := current) (by omega)]
          simp [Ne.symm isChild, fixed]
        exact ⟨0, by omega, by simpa [isChild] using linkedRoot⟩
  | step sourceBound nextBound edge notFixed nextPath ih =>
      rename_i pathLength source next pathRoot
      have sourceNotChild : child ≠ source := by
        intro same
        subst child
        rw [childFixed] at edge
        exact notFixed edge.symm
      obtain ⟨nextLength, nextLengthBound, linkedTail⟩ := ih
      refine ⟨nextLength + 1, by omega, ?_⟩
      apply ParentPath.step sourceBound nextBound
      · rw [arrayGet_setIfInBounds (values := parents) (index := child)
          (value := parent) (source := _) (fallback := _) (by omega)]
        simp [sourceNotChild, edge]
      · exact notFixed
      · exact linkedTail

theorem currentLinkEdge {count : Nat} {links : Array Nat} {edge : Nat}
    (valid : linksValid count links = true) (edgeBound : edge < links.size / 2) :
    LinkEdge count links (arrayGet links (edge * 2) count)
      (arrayGet links (edge * 2 + 1) count) := by
  have leftBound : edge * 2 < links.size := by omega
  have rightBound : edge * 2 + 1 < links.size := by omega
  refine ⟨?_, ?_, edge, edgeBound, ?_⟩
  · exact linksValid_get valid leftBound
  · exact linksValid_get valid rightBound
  · left
    constructor <;> simp [arrayGet, Array.getD, leftBound, rightBound]

theorem parentSound_link {count links parents child parent}
    (parentSize : parents.size = count)
    (sound : ParentSound count links parents)
    (_childBound : child < count)
    (connected : Connected count links child parent) :
    ParentSound count links (parents.setIfInBounds child parent) := by
  intro vertex vertexBound
  rw [arrayGet_setIfInBounds (values := parents) (index := child)
    (value := parent) (source := vertex) (fallback := vertex) (by omega)]
  split
  · rename_i same
    subst vertex
    exact fun _ => connected
  · rename_i different
    exact sound vertex vertexBound

theorem FastCorrect.linkRoots {count links processed state child parent nextSize}
    (correct : FastCorrect count links processed state)
    (childBound : child < count) (parentBound : parent < count)
    (childFixed : arrayGet state.parent child child = child)
    (parentFixed : arrayGet state.parent parent parent = parent)
    (different : child ≠ parent)
    (connected : Connected count links child parent)
    (currentClosed :
      let left := arrayGet links (processed * 2) count
      let right := arrayGet links (processed * 2 + 1) count
      ∃ leftLength rightLength root,
        leftLength ≤ processed + 1 ∧ rightLength ≤ processed + 1 ∧
        ParentPath count (state.parent.setIfInBounds child parent) leftLength left root ∧
        ParentPath count (state.parent.setIfInBounds child parent) rightLength right root) :
    FastCorrect count links (processed + 1) {
      parent := state.parent.setIfInBounds child parent
      size := nextSize
    } := by
  constructor
  · simp [correct.parentSize]
  · intro vertex vertexBound
    obtain ⟨length, root, lengthBound, path⟩ := correct.rooted vertex vertexBound
    obtain ⟨nextLength, nextLengthBound, nextPath⟩ :=
      path.linkRoot correct.parentSize childBound parentBound childFixed parentFixed different
    exact ⟨nextLength, _, by omega, nextPath⟩
  · exact parentSound_link correct.parentSize correct.sound childBound connected
  · intro edge edgeBound
    by_cases current : edge = processed
    · subst edge
      exact currentClosed
    · have old : edge < processed := by omega
      obtain ⟨leftLength, rightLength, root, leftLengthBound, rightLengthBound,
        leftPath, rightPath⟩ := correct.closed edge old
      obtain ⟨nextLeftLength, nextLeftBound, nextLeft⟩ :=
        leftPath.linkRoot correct.parentSize childBound parentBound childFixed parentFixed different
      obtain ⟨nextRightLength, nextRightBound, nextRight⟩ :=
        rightPath.linkRoot correct.parentSize childBound parentBound childFixed parentFixed different
      exact ⟨nextLeftLength, nextRightLength, _, by omega, by omega, nextLeft, nextRight⟩

theorem FastCorrect.advanceSame {count links processed state}
    (correct : FastCorrect count links processed state)
    (currentClosed :
      let left := arrayGet links (processed * 2) count
      let right := arrayGet links (processed * 2 + 1) count
      ∃ leftLength rightLength root,
        leftLength ≤ processed + 1 ∧ rightLength ≤ processed + 1 ∧
        ParentPath count state.parent leftLength left root ∧
        ParentPath count state.parent rightLength right root) :
    FastCorrect count links (processed + 1) state := by
  constructor
  · exact correct.parentSize
  · intro vertex vertexBound
    obtain ⟨length, root, lengthBound, path⟩ := correct.rooted vertex vertexBound
    exact ⟨length, root, by omega, path⟩
  · exact correct.sound
  · intro edge edgeBound
    by_cases current : edge = processed
    · subst edge
      exact currentClosed
    · obtain ⟨leftLength, rightLength, root, leftBound, rightBound,
        leftPath, rightPath⟩ := correct.closed edge (by omega)
      exact ⟨leftLength, rightLength, root, by omega, by omega, leftPath, rightPath⟩

theorem fastUnion_correct {count : Nat} {links : Array Nat} {edge : Nat} {state : State}
    (valid : linksValid count links = true)
    (edgeBound : edge < links.size / 2)
    (correct : FastCorrect count links edge state) :
    FastCorrect count links (edge + 1)
      (fastUnion count (links.size / 2)
        (arrayGet links (edge * 2) count)
        (arrayGet links (edge * 2 + 1) count) state) := by
  let left := arrayGet links (edge * 2) count
  let right := arrayGet links (edge * 2 + 1) count
  have leftIndex : edge * 2 < links.size := by omega
  have rightIndex : edge * 2 + 1 < links.size := by omega
  have leftBound : left < count := linksValid_get valid leftIndex
  have rightBound : right < count := linksValid_get valid rightIndex
  obtain ⟨leftLength, leftRoot, leftLengthBound, leftPath⟩ := correct.rooted left leftBound
  obtain ⟨rightLength, rightRoot, rightLengthBound, rightPath⟩ := correct.rooted right rightBound
  have leftFound : rootFrom count (links.size / 2 + 1) left state.parent = leftRoot :=
    rootFrom_eq_of_path leftPath (by omega)
  have rightFound : rootFrom count (links.size / 2 + 1) right state.parent = rightRoot :=
    rootFrom_eq_of_path rightPath (by omega)
  have leftRootBound := leftPath.root_bound
  have rightRootBound := rightPath.root_bound
  have leftRootFixed := leftPath.root_fixed
  have rightRootFixed := rightPath.root_fixed
  have rootsConnected : Connected count links leftRoot rightRoot :=
    Connected.trans (Connected.symm (leftPath.connected correct.sound))
      (Connected.trans (Connected.edge (by simpa [left, right] using currentLinkEdge valid edgeBound))
        (rightPath.connected correct.sound))
  change FastCorrect count links (edge + 1)
    (fastUnion count (links.size / 2) left right state)
  rw [fastUnion, leftFound, rightFound]
  by_cases sameRoot : leftRoot = rightRoot
  · simp only [sameRoot, if_true]
    apply correct.advanceSame
    exact ⟨leftLength, rightLength, leftRoot, by omega, by omega,
      leftPath, by simpa [sameRoot] using rightPath⟩
  · simp only [sameRoot, if_false]
    split
    · have linkedLeft := leftPath.linkRoot correct.parentSize leftRootBound rightRootBound
        leftRootFixed rightRootFixed sameRoot
      have linkedRight := rightPath.linkRoot correct.parentSize leftRootBound rightRootBound
        leftRootFixed rightRootFixed sameRoot
      obtain ⟨nextLeftLength, nextLeftBound, nextLeft⟩ := linkedLeft
      obtain ⟨nextRightLength, nextRightBound, nextRight⟩ := linkedRight
      apply correct.linkRoots leftRootBound rightRootBound leftRootFixed rightRootFixed sameRoot
        rootsConnected
      exact ⟨nextLeftLength, nextRightLength, rightRoot, by omega, by omega,
        by simpa using nextLeft, by simpa [sameRoot] using nextRight⟩
    · have reverseDifferent : rightRoot ≠ leftRoot := fun equal => sameRoot equal.symm
      have linkedRight := rightPath.linkRoot correct.parentSize rightRootBound leftRootBound
        rightRootFixed leftRootFixed reverseDifferent
      have linkedLeft := leftPath.linkRoot correct.parentSize rightRootBound leftRootBound
        rightRootFixed leftRootFixed reverseDifferent
      obtain ⟨nextRightLength, nextRightBound, nextRight⟩ := linkedRight
      obtain ⟨nextLeftLength, nextLeftBound, nextLeft⟩ := linkedLeft
      apply correct.linkRoots rightRootBound leftRootBound rightRootFixed leftRootFixed reverseDifferent
        (Connected.symm rootsConnected)
      exact ⟨nextLeftLength, nextRightLength, leftRoot, by omega, by omega,
        by simpa [sameRoot] using nextLeft, by simpa using nextRight⟩

theorem fastProcessFrom_correct {count : Nat} {links : Array Nat}
    {fuel index edge : Nat} {state : State}
    (valid : linksValid count links = true)
    (indexAtEdge : index = edge * 2)
    (finishes : edge + fuel = links.size / 2)
    (correct : FastCorrect count links edge state) :
    FastCorrect count links (links.size / 2)
      (fastProcessFrom count (links.size / 2) links fuel index edge state) := by
  induction fuel generalizing index edge state with
  | zero =>
      simp only [Nat.add_zero] at finishes
      subst edge
      simpa [fastProcessFrom] using correct
  | succ fuel ih =>
      have edgeBound : edge < links.size / 2 := by omega
      have nextCorrect := fastUnion_correct valid edgeBound correct
      simp only [fastProcessFrom]
      apply ih (state := fastUnion count (links.size / 2)
        (arrayGet links index count) (arrayGet links (index + 1) count) state)
      · omega
      · omega
      · simpa [indexAtEdge] using nextCorrect

theorem FastCorrect.processedEdgeRootsEqual {count links state}
    (correct : FastCorrect count links (links.size / 2) state)
    {edge : Nat} (edgeBound : edge < links.size / 2) :
    rootFrom count (links.size / 2 + 1) (arrayGet links (edge * 2) count) state.parent =
      rootFrom count (links.size / 2 + 1)
        (arrayGet links (edge * 2 + 1) count) state.parent := by
  obtain ⟨leftLength, rightLength, root, leftBound, rightBound,
    leftPath, rightPath⟩ := correct.closed edge edgeBound
  rw [rootFrom_eq_of_path leftPath (by omega), rootFrom_eq_of_path rightPath (by omega)]

theorem FastCorrect.connectedRootsEqual {count links state}
    (correct : FastCorrect count links (links.size / 2) state)
    {left right : Nat} (connection : Connected count links left right) :
    rootFrom count (links.size / 2 + 1) left state.parent =
      rootFrom count (links.size / 2 + 1) right state.parent := by
  induction connection with
  | edge edgeProof =>
      rcases edgeProof with ⟨_, _, edge, edgeBound, endpoints⟩
      have firstBound : edge * 2 < links.size := by omega
      have secondBound : edge * 2 + 1 < links.size := by omega
      have closed := correct.processedEdgeRootsEqual edgeBound
      have firstFallback : arrayGet links (edge * 2) 0 =
          arrayGet links (edge * 2) count := by
        simp [arrayGet, Array.getD, firstBound]
      have secondFallback : arrayGet links (edge * 2 + 1) 0 =
          arrayGet links (edge * 2 + 1) count := by
        simp [arrayGet, Array.getD, secondBound]
      dsimp only at endpoints
      rw [firstFallback, secondFallback] at endpoints
      rcases endpoints with endpoints | endpoints
      · rw [endpoints.1, endpoints.2] at closed
        exact closed
      · rw [endpoints.1, endpoints.2] at closed
        exact closed.symm
  | refl _ _ => rfl
  | symm _ ih => exact ih.symm
  | trans _ _ ihLeft ihRight => exact ihLeft.trans ihRight

theorem fastProcess_correct {count : Nat} {links : Array Nat}
    (valid : linksValid count links = true) :
    FastCorrect count links (links.size / 2)
      (fastProcessFrom count (links.size / 2) links (links.size / 2) 0 0 {
        parent := Array.ofFn fun index : Fin count => index.val
        size := Array.replicate count 1
      }) := by
  apply fastProcessFrom_correct valid (by omega) (by omega)
  exact fastInitial_correct count links

theorem fastRepresentatives_get {count : Nat} {links : Array Nat}
    {vertex : Nat} (bound : vertex < count) :
    arrayGet (fastRepresentatives count links) vertex count =
      rootFrom count (links.size / 2 + 1) vertex
        (fastProcessFrom count (links.size / 2) links (links.size / 2) 0 0 {
          parent := Array.ofFn fun index : Fin count => index.val
          size := Array.replicate count 1
        }).parent := by
  simp [fastRepresentatives, arrayGet, Array.getD, bound]

/-- The allocation-conscious representative array is exact for graph connectivity. -/
theorem fastRepresentatives_correct (count : Nat) (links : Array Nat)
    (valid : linksValid count links = true) :
    ∀ left right, left < count → right < count →
      (arrayGet (fastRepresentatives count links) left count =
          arrayGet (fastRepresentatives count links) right count ↔
        Connected count links left right) := by
  let state := fastProcessFrom count (links.size / 2) links (links.size / 2) 0 0 {
    parent := Array.ofFn fun index : Fin count => index.val
    size := Array.replicate count 1
  }
  have correct : FastCorrect count links (links.size / 2) state := fastProcess_correct valid
  intro left right leftBound rightBound
  rw [fastRepresentatives_get leftBound, fastRepresentatives_get rightBound]
  constructor
  · intro sameRoot
    obtain ⟨leftLength, leftRoot, leftLengthBound, leftPath⟩ :=
      correct.rooted left leftBound
    obtain ⟨rightLength, rightRoot, rightLengthBound, rightPath⟩ :=
      correct.rooted right rightBound
    have leftFound := rootFrom_eq_of_path leftPath (fuel := links.size / 2 + 1) (by omega)
    have rightFound := rootFrom_eq_of_path rightPath (fuel := links.size / 2 + 1) (by omega)
    rw [leftFound, rightFound] at sameRoot
    exact Connected.trans (leftPath.connected correct.sound)
      (by rw [sameRoot]; exact Connected.symm (rightPath.connected correct.sound))
  · exact correct.connectedRootsEqual

/-- The representative-only function called by the Wasm bridge is exact. -/
theorem solvePartition_correct (count : UInt32) (links : Array Nat)
    (valid : linksValid count.toNat links = true) :
    ∀ left right, left < count.toNat → right < count.toNat →
      (arrayGet (solvePartition count links) left count.toNat =
          arrayGet (solvePartition count links) right count.toNat ↔
        Connected count.toNat links left right) := by
  simpa [solvePartition] using fastRepresentatives_correct count.toNat links valid

end LeanUnionFind
