const issueBatch = async () => {
  if (!contract) { showMsg("Connect wallet first.", "warning"); return; }
  if (!batchId)  { showMsg("Enter a batch ID.", "warning"); return; }
  setLoading(true);
  try {
    const leaves = students.map(s => hashCertificate(s, batchId));
    const { root } = buildMerkleTree(leaves);
    const tx = await contract.proposeBatch(batchId, root);
    const receipt = await tx.wait();

    const executedEvent = receipt.logs.find(log => {
      try { return contract.interface.parseLog(log).name === "BatchExecuted"; }
      catch { return false; }
    });

    if (executedEvent) {
      saveProofs(batchId, students, leaves, setProofJson);
      await saveBatchToDB(batchId, root, wallet, students, leaves);
      showMsg(`Batch issued successfully.`);
      setIssuedBatch({ batchId, students, leaves, root });
    } else {
      const proposedEvent = receipt.logs.find(log => {
        try { return contract.interface.parseLog(log).name === "BatchProposed"; }
        catch { return false; }
      });
      if (proposedEvent) {
        const parsed = contract.interface.parseLog(proposedEvent);
        const pid = Number(parsed.args[0]);
        await savePendingBatch(pid, batchId, root, wallet, students, leaves);
        showMsg(`Batch proposed. Proposal ID: ${pid}. Waiting for approvals.`, "warning");
      }
    }
    setBatchId("");
    setStudents([{ name: "", degree: "", university: "", year: 2024 }]);
  } catch (e) {
    showMsg(e.reason || e.message, "error");
  }
  setLoading(false);
};