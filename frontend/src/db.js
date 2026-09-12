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
    cert_hash:    leaves[i]
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
    .eq("cert_hash", certHash)
    .single();

  if (error || !data) return null;
  return data;
}