import { supabase } from "./supabase";

export async function saveBatchToDB(batchId, merkleRoot, issuedBy, students, leaves) {
  const { error: batchError } = await supabase
    .from("batches")
    .insert({
      batch_id:    batchId,
      merkle_root: merkleRoot,
      issued_by:   issuedBy,
    });

  if (batchError) {
    console.error("Batch insert error:", batchError);
    return false;
  }

  const proofRows = students.map((student, i) => ({
    batch_id:     batchId,
    student_name: student.name.trim(),
    degree:       student.degree.trim(),
    university:   student.university.trim(),
    year:         student.year,
    leaf:         leaves[i],
    proof_index:  i,
    cert_hash:    leaves[i].toLowerCase()
  }));

  const { error: proofError } = await supabase
    .from("proofs")
    .insert(proofRows);

  if (proofError) {
    console.error("Proof insert error:", proofError);
    return false;
  }

  return true;
}

export async function savePendingBatch(proposalId, batchId, merkleRoot, proposedBy, students, leaves) {
  const { error } = await supabase
    .from("pending_batches")
    .insert({
      proposal_id:  proposalId,
      batch_id:     batchId,
      merkle_root:  merkleRoot,
      proposed_by:  proposedBy,
      students:     JSON.stringify(students),
      leaves:       JSON.stringify(leaves)
    });

  if (error) {
    console.error("Pending batch insert error:", error);
    return false;
  }
  return true;
}

export async function getPendingBatch(proposalId) {
  const { data, error } = await supabase
    .from("pending_batches")
    .select("*")
    .eq("proposal_id", proposalId)
    .single();

  if (error || !data) return null;
  return {
    ...data,
    students: JSON.parse(data.students),
    leaves:   JSON.parse(data.leaves)
  };
}

export async function deletePendingBatch(proposalId) {
  const { error } = await supabase
    .from("pending_batches")
    .delete()
    .eq("proposal_id", proposalId);

  if (error) console.error("Delete pending batch error:", error);
}

export async function getProofFromDB(batchId, cert) {
  const { data, error } = await supabase
    .from("proofs")
    .select("*")
    .eq("batch_id", batchId)
    .eq("student_name", cert.name.trim())
    .eq("degree", cert.degree.trim())
    .eq("university", cert.university.trim())
    .eq("year", cert.year)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getAllProofsForBatch(batchId) {
  const { data, error } = await supabase
    .from("proofs")
    .select("*")
    .eq("batch_id", batchId)
    .order("proof_index", { ascending: true });

  if (error || !data) return null;
  return data;
}

export async function getAllBatches() {
  const { data, error } = await supabase
    .from("batches")
    .select("*")
    .order("issued_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function getProofByHash(certHash) {
  const { data, error } = await supabase
    .from("proofs")
    .select("*")
    .eq("cert_hash", certHash.replace(/\s+/g, "").toLowerCase())
    .single();

  if (error || !data) return null;
  return data;
}