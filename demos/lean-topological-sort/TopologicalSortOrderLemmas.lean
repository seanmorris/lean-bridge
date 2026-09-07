import Init

namespace LeanTopologicalSort.Total

/-- Prepending a source to an order of the remaining vertices preserves every edge. -/
theorem source_prepend {α : Type} [BEq α] [LawfulBEq α]
    (edge : α → α → Bool) (vertices order : List α) (source : α)
    (permutation : order.Perm (vertices.erase source))
    (unique : vertices.Nodup) (present : source ∈ vertices)
    (noIncoming : ∀ y ∈ vertices, edge y source = false)
    (ordered : ∀ u ∈ vertices.erase source, ∀ v ∈ vertices.erase source,
      edge u v = true → order.idxOf u < order.idxOf v) :
    (source :: order).Perm vertices ∧
      ∀ u ∈ vertices, ∀ v ∈ vertices,
        edge u v = true → (source :: order).idxOf u < (source :: order).idxOf v := by
  constructor
  · exact (permutation.cons source).trans (List.perm_cons_erase present).symm
  · intro u hu v hv connected
    have targetNe : v ≠ source := by
      intro same
      subst v
      rw [noIncoming u hu] at connected
      cases connected
    by_cases sourceEq : u = source
    · subst u
      simp [List.idxOf_cons, cond_eq_ite, beq_iff_eq, Ne.symm targetNe]
    · have hu' : u ∈ vertices.erase source := unique.mem_erase_iff.mpr ⟨sourceEq, hu⟩
      have hv' : v ∈ vertices.erase source := unique.mem_erase_iff.mpr ⟨targetNe, hv⟩
      simpa [List.idxOf_cons, cond_eq_ite, beq_iff_eq, Ne.symm sourceEq, Ne.symm targetNe] using
        Nat.succ_lt_succ (ordered u hu' v hv' connected)

end LeanTopologicalSort.Total
