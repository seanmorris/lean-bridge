import Std
import UnionFindCore

/-!
Correctness theorems for the exact certifying union-find implementation exported
by `UnionFindCore.lean`.
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

end LeanUnionFind
