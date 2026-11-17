import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";
import { hashCertificate, buildMerkleTree, getMerkleProof, verifyMerkleProof } from "./utils/merkle";
import { saveBatchToDB, savePendingBatch, getPendingBatch, deletePendingBatch, getProofFromDB, getAllProofsForBatch, getAllBatches, getProofByHash } from "./db";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import {
  Box, Button, Card, CardContent, Chip, CircularProgress,
  Container, Divider, Grid, Tab, Tabs, TextField,
  Typography, Alert, Stack
} from "@mui/material";

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

const T = {
  bg: "#0B0D14", panel: "#11141F", panel2: "#161A28", border: "#252A3E",
  text: "#E8EAF2", muted: "#A8B0C5", dim: "#8E97AE",
  purple: "#8B5CF6", violet: "#A78BFA", green: "#34D399", red: "#F87171", amber: "#FBBF24",
};
const SAMPLE_HASH = "0xeb2a5b974ed0d6b1051bcd60ce268d12eb96e26a50d8cdfc72b4daefa0d73136"; // sample certificate (batch CSE-004)
const fontCss = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');`;
const headFont = "'Space Grotesk', sans-serif";
const monoFont = "'JetBrains Mono', monospace";

function Stepper({ count, required }) {
  const done = count >= required;
  const dot = (bg, border, color, content) => (
    <Box sx={{ width: 26, height: 26, borderRadius: "50%", background: bg, border: `2px solid ${border}`,
      color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{content}</Box>
  );
  const line = (on) => <Box sx={{ flex: 1, height: 2, background: on ? T.green : T.border, mx: 1 }} />;
  return (
    <Box sx={{ display: "flex", alignItems: "center", mt: 1.5 }}>
      {dot(T.green, T.green, "#052E1F", "✓")}
      {line(true)}
      {dot("transparent", done ? T.green : T.purple, done ? T.green : "#C4B5FD", `${count}/${required}`)}
      {line(done)}
      {dot("transparent", done ? T.green : "#3A4058", done ? T.green : T.dim, "3")}
    </Box>
  );
}

function saveProofs(batchId, students, leaves, setProofJson) {
  const proofData = {};
  students.forEach((student, i) => {
    const key = `${student.name.trim()}|${student.degree.trim()}|${student.university.trim()}|${student.year}`;
    proofData[key] = {
      student: {
        ...student,
        name: student.name.trim(),
        degree: student.degree.trim(),
        university: student.university.trim()
      },
      leaf: leaves[i],
      index: i
    };
  });
  localStorage.setItem(`batch-${batchId}`, JSON.stringify(proofData));
  const fullData = JSON.stringify({ batchId, proofData }, null, 2);
  if (setProofJson) setProofJson(fullData);
}

function getStoredProof(batchId, cert) {
  const key = `${cert.name.trim()}|${cert.degree.trim()}|${cert.university.trim()}|${cert.year}`;
  const data = localStorage.getItem(`batch-${batchId}`);
  if (!data) return null;
  const proofData = JSON.parse(data);
  return proofData[key] || null;
}

// QR codes must point at the public site, never at localhost.
const PUBLIC_URL = "https://cert-verify-henna.vercel.app";
const SITE_URL = window.location.hostname === "localhost" ? PUBLIC_URL : window.location.origin;

async function generateCertificatePDF(student, batchId, certHash, merkleRoot, issuedAt, issuedBy) {
  const batchData = JSON.parse(localStorage.getItem(`batch-${batchId}`));
  let verifyUrl;

  if (batchData) {
    const allLeaves = Object.values(batchData)
      .sort((a, b) => a.index - b.index)
      .map(l => l.leaf);
    const key = `${student.name.trim()}|${student.degree.trim()}|${student.university.trim()}|${student.year}`;
    const storedEntry = batchData[key];
    if (storedEntry) {
      const proof = getMerkleProof(allLeaves, storedEntry.index);
      verifyUrl = `${SITE_URL}?batchId=${encodeURIComponent(batchId)}&name=${encodeURIComponent(student.name.trim())}&degree=${encodeURIComponent(student.degree.trim())}&university=${encodeURIComponent(student.university.trim())}&year=${student.year}&proof=${encodeURIComponent(JSON.stringify(proof))}&leaf=${storedEntry.leaf}`;
    }
  }

  if (!verifyUrl) {
    verifyUrl = `${SITE_URL}?batchId=${encodeURIComponent(batchId)}&name=${encodeURIComponent(student.name.trim())}&degree=${encodeURIComponent(student.degree.trim())}&university=${encodeURIComponent(student.university.trim())}&year=${student.year}`;
  }

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 120, margin: 1 });
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFillColor(15, 17, 23);
  doc.rect(0, 0, 297, 210, "F");
  doc.setFillColor(26, 31, 46);
  doc.roundedRect(10, 10, 277, 190, 5, 5, "F");
  doc.setDrawColor(167, 139, 250);
  doc.setLineWidth(0.8);
  doc.roundedRect(10, 10, 277, 190, 5, 5, "S");
  doc.setDrawColor(167, 139, 250);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, 14, 269, 182, 3, 3, "S");

  doc.setTextColor(167, 139, 250);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("BLOCKCHAIN VERIFIED CERTIFICATE", 148.5, 28, { align: "center" });
  doc.setDrawColor(167, 139, 250);
  doc.setLineWidth(0.3);
  doc.line(60, 31, 238, 31);

  doc.setTextColor(232, 234, 240);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("This is to certify that", 148.5, 44, { align: "center" });

  doc.setTextColor(167, 139, 250);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(student.name.trim(), 148.5, 62, { align: "center" });
  doc.setDrawColor(167, 139, 250);
  doc.setLineWidth(0.2);
  doc.line(80, 65, 218, 65);

  doc.setTextColor(232, 234, 240);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("has successfully completed the requirements for the degree of", 148.5, 75, { align: "center" });

  doc.setTextColor(52, 211, 153);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(student.degree.trim(), 148.5, 88, { align: "center" });

  doc.setTextColor(232, 234, 240);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`from ${student.university.trim()} in the year ${student.year}`, 148.5, 98, { align: "center" });

  doc.setDrawColor(50, 50, 70);
  doc.setLineWidth(0.3);
  doc.line(20, 108, 277, 108);

  doc.setTextColor(122, 128, 153);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("BATCH ID", 22, 116);
  doc.setTextColor(200, 200, 220);
  doc.setFontSize(7.5);
  doc.text(batchId, 22, 121);

  doc.setTextColor(122, 128, 153);
  doc.setFontSize(7);
  doc.text("CERTIFICATE HASH", 22, 129);
  doc.setTextColor(200, 200, 220);
  doc.setFontSize(6.5);
  doc.text(certHash.substring(0, 42), 22, 134);
  doc.text(certHash.substring(42), 22, 138);

  doc.setTextColor(122, 128, 153);
  doc.setFontSize(7);
  doc.text("MERKLE ROOT", 22, 144);
  doc.setTextColor(200, 200, 220);
  doc.setFontSize(6.5);
  doc.text(merkleRoot.substring(0, 42), 22, 149);
  doc.text(merkleRoot.substring(42), 22, 153);

  doc.setTextColor(122, 128, 153);
  doc.setFontSize(7);
  doc.text("ISSUED BY", 22, 159);
  doc.setTextColor(200, 200, 220);
  doc.setFontSize(6.5);
  doc.text(issuedBy, 22, 164);

  doc.setTextColor(122, 128, 153);
  doc.setFontSize(7);
  doc.text("ISSUED AT", 22, 170);
  doc.setTextColor(200, 200, 220);
  doc.setFontSize(7.5);
  doc.text(new Date(Number(issuedAt) * 1000).toLocaleString(), 22, 175);

  doc.setTextColor(122, 128, 153);
  doc.setFontSize(7);
  doc.text("BLOCKCHAIN", 22, 181);
  doc.setTextColor(52, 211, 153);
  doc.setFontSize(7.5);
  doc.text("Ethereum Sepolia Testnet", 22, 186);

  doc.addImage(qrDataUrl, "PNG", 242, 112, 38, 38);
  doc.setTextColor(122, 128, 153);
  doc.setFontSize(6);
  doc.text("Scan to verify", 261, 153, { align: "center" });
  doc.setTextColor(122, 128, 153);
  doc.setFontSize(6);
  doc.text(`Contract: ${CONTRACT_ADDRESS}`, 148.5, 196, { align: "center" });

  doc.save(`${student.name.trim().replace(/ /g, "_")}_${batchId}_certificate.pdf`);
}

export default function App() {
  const params = new URLSearchParams(window.location.search);

  const [tab, setTab]             = useState(0);
  const [wallet, setWallet]       = useState(null);
  const [contract, setContract]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [message, setMessage]     = useState(null);
  const [proofJson, setProofJson] = useState(null);

  const [batchId, setBatchId]     = useState("");
  const [students, setStudents]   = useState([
    { name: "", degree: "", university: "", year: 2024 }
  ]);
  const [issuedBatch, setIssuedBatch] = useState(null);

  const [verifyMode, setVerifyMode]         = useState("hash");
  const [certHashInput, setCertHashInput]   = useState("");
  const [verifyBatchId, setVerifyBatchId]   = useState(params.get("batchId")    || "");
  const [verifyCertName, setVerifyCertName] = useState(params.get("name")       || "");
  const [verifyDegree, setVerifyDegree]     = useState(params.get("degree")     || "");
  const [verifyUni, setVerifyUni]           = useState(params.get("university") || "");
  const [verifyYear, setVerifyYear]         = useState(parseInt(params.get("year")) || 2024);
  const [verifyResult, setVerifyResult]     = useState(null);
  const [pasteProof, setPasteProof]         = useState("");

  const [revokeBatchId, setRevokeBatchId]   = useState("");
  const [revokeReason, setRevokeReason]     = useState("");
  const [issuerAddress, setIssuerAddress]   = useState("");
  const [proposalId, setProposalId]         = useState("");
  const [requiredApprovals, setRequiredApprovals] = useState(1);
  const [batchHistory, setBatchHistory]     = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [pendingProposals, setPendingProposals] = useState([]);
  const [loadingProposals, setLoadingProposals] = useState(false);

  const showMsg = (text, severity = "success") => {
    setMessage({ text, severity });
    setTimeout(() => setMessage(null), 6000);
  };

  const verifyByHash = async () => {
    if (!certHashInput) { showMsg("Enter a certificate hash.", "warning"); return; }
    setLoading(true);
    setVerifyResult(null);
    try {
      const cleanHash = certHashInput.replace(/\s+/g, "").toLowerCase();
      const dbProof = await getProofByHash(cleanHash);
      if (!dbProof) {
        setVerifyResult({
          valid: false, revoked: false,
          reason: "Certificate hash not found in database.",
          merkleRoot: "", issuedAt: null, issuedBy: "", certHash: cleanHash
        });
        setLoading(false);
        return;
      }

      const provider = new ethers.JsonRpcProvider(
        "https://eth-sepolia.g.alchemy.com/v2/alch_mslyZ-pynP9e20GEMgFDp"
      );
      const readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const result = await readContract.verifyCertificate(dbProof.batch_id, cleanHash);

      if (!result.valid) {
        setVerifyResult({
          valid: false, revoked: result.revoked,
          reason: result.reason || "Certificate not valid",
          merkleRoot: result.merkleRoot, issuedAt: result.issuedAt,
          issuedBy: result.issuedBy, certHash: cleanHash,
          studentName: dbProof.student_name,
          degree: dbProof.degree,
          university: dbProof.university,
          year: dbProof.year
        });
        setLoading(false);
        return;
      }

      const allProofs = await getAllProofsForBatch(dbProof.batch_id);
      const allLeaves = allProofs.map(p => p.leaf);
      const proof = getMerkleProof(allLeaves, dbProof.proof_index);
      const merkleValid = verifyMerkleProof(cleanHash, proof, result.merkleRoot);

      setVerifyResult({
        valid: merkleValid, revoked: false,
        reason: merkleValid ? "" : "Merkle proof failed",
        merkleRoot: result.merkleRoot, issuedAt: result.issuedAt,
        issuedBy: result.issuedBy, certHash: cleanHash,
        batchId: dbProof.batch_id,
        studentName: dbProof.student_name,
        degree: dbProof.degree,
        university: dbProof.university,
        year: dbProof.year,
        cert: {
          name: dbProof.student_name,
          degree: dbProof.degree,
          university: dbProof.university,
          year: dbProof.year
        }
      });
    } catch (e) {
      showMsg(e.message, "error");
    }
    setLoading(false);
  };

  const verifyCertificate = async (
    overrideBatchId,
    overrideName,
    overrideDegree,
    overrideUni,
    overrideYear,
    overrideProof,
    overrideLeaf
  ) => {
    setLoading(true);
    setVerifyResult(null);
    try {
      const certName    = (overrideName    || verifyCertName).trim();
      const certDegree  = (overrideDegree  || verifyDegree).trim();
      const certUni     = (overrideUni     || verifyUni).trim();
      const certYear    = parseInt(overrideYear || verifyYear);
      const useBatchId  = (overrideBatchId || verifyBatchId).trim();

      if (!certName || !certDegree || !certUni || !certYear || !useBatchId) {
        showMsg("Please fill in all certificate details.", "warning");
        setLoading(false);
        return;
      }

      const provider = new ethers.JsonRpcProvider(
        "https://eth-sepolia.g.alchemy.com/v2/alch_mslyZ-pynP9e20GEMgFDp"
      );
      const readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const cert = {
        name:       certName,
        degree:     certDegree,
        university: certUni,
        year:       certYear
      };
      const certHash = hashCertificate(cert, useBatchId);
      const result = await readContract.verifyCertificate(useBatchId, certHash);

      if (!result.valid) {
        setVerifyResult({
          valid: false, revoked: result.revoked,
          reason: result.reason || "Certificate not valid",
          merkleRoot: result.merkleRoot, issuedAt: result.issuedAt,
          issuedBy: result.issuedBy, certHash
        });
        setLoading(false);
        return;
      }

      const urlProof = overrideProof || params.get("proof");
      const urlLeaf  = overrideLeaf  || params.get("leaf");
      let merkleValid = false;

      if (urlProof && urlLeaf) {
        const proof = JSON.parse(decodeURIComponent(urlProof));
        merkleValid = verifyMerkleProof(urlLeaf, proof, result.merkleRoot);
      } else {
        const stored = getStoredProof(useBatchId, cert);
        if (stored) {
          const batchData = JSON.parse(localStorage.getItem(`batch-${useBatchId}`));
          const allLeaves = Object.values(batchData)
            .sort((a, b) => a.index - b.index)
            .map(l => l.leaf);
          const proof = getMerkleProof(allLeaves, stored.index);
          merkleValid = verifyMerkleProof(certHash, proof, result.merkleRoot);
        } else {
          const dbProof = await getProofFromDB(useBatchId, cert);
          if (dbProof) {
            const allProofs = await getAllProofsForBatch(useBatchId);
            const allLeaves = allProofs.map(p => p.leaf);
            const proof = getMerkleProof(allLeaves, dbProof.proof_index);
            merkleValid = verifyMerkleProof(certHash, proof, result.merkleRoot);
          } else {
            setVerifyResult({
              valid: false, revoked: false,
              reason: "Certificate details not found. Use hash-based verification or scan the QR code.",
              merkleRoot: result.merkleRoot, issuedAt: result.issuedAt,
              issuedBy: result.issuedBy, certHash
            });
            setLoading(false);
            return;
          }
        }
      }

      setVerifyResult({
        valid: merkleValid, revoked: false,
        reason: merkleValid ? "" : "Merkle proof failed — certificate details do not match what was issued.",
        merkleRoot: result.merkleRoot, issuedAt: result.issuedAt,
        issuedBy: result.issuedBy, certHash, cert, batchId: useBatchId
      });
    } catch (e) {
      showMsg(e.message, "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const bId    = p.get("batchId");
    const name   = p.get("name");
    const degree = p.get("degree");
    const uni    = p.get("university");
    const year   = p.get("year");
    const proof  = p.get("proof");
    const leaf   = p.get("leaf");
    if (bId && name && proof) {
      setVerifyMode("manual");
      setTimeout(() => {
        verifyCertificate(bId, name, degree, uni, year, proof, leaf);
      }, 800);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        showMsg("MetaMask not found. Please install it.", "error");
        return;
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const c = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      setWallet(await signer.getAddress());
      setContract(c);
      showMsg("Wallet connected successfully.");
    } catch (e) {
      showMsg(e.message, "error");
    }
  };

  const handlePasteProof = (value) => {
    setPasteProof(value);
    try {
      const data = JSON.parse(value);
      localStorage.setItem(`batch-${data.batchId}`, JSON.stringify(data.proofData));
      showMsg(`Proof loaded for batch: ${data.batchId}`);
    } catch {}
  };

  const importProofs = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        localStorage.setItem(`batch-${data.batchId}`, JSON.stringify(data.proofData));
        showMsg(`Proof imported for batch: ${data.batchId}`);
      } catch {
        showMsg("Invalid proof file", "error");
      }
    };
    reader.readAsText(file);
  };

  const addStudent = () => {
    setStudents([...students, { name: "", degree: "", university: "", year: 2024 }]);
  };

  const removeStudent = (i) => {
    if (students.length === 1) return;
    setStudents(students.filter((_, idx) => idx !== i));
  };

  const updateStudent = (i, field, value) => {
  const updated = [...students];
  if (field === "year") {
    updated[i][field] = parseInt(value);
  } else if (field === "name" || field === "degree" || field === "university") {
    updated[i][field] = value.replace(/[0-9]/g, "");
  } else {
    updated[i][field] = value;
  }
  setStudents(updated);
};

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

  const approveBatch = async (overrideProposalId) => {
    if (!contract) { showMsg("Connect wallet first.", "warning"); return; }
    setLoading(true);
    try {
      const pid = parseInt(overrideProposalId !== undefined ? overrideProposalId : proposalId);
      const receipt = await (await contract.approveBatch(pid)).wait();

      const executedEvent = receipt.logs.find(log => {
        try { return contract.interface.parseLog(log).name === "BatchExecuted"; }
        catch { return false; }
      });

      if (executedEvent) {
        const pending = await getPendingBatch(pid);
        if (pending) {
          saveProofs(pending.batch_id, pending.students, pending.leaves, setProofJson);
          await saveBatchToDB(pending.batch_id, pending.merkle_root, pending.proposed_by, pending.students, pending.leaves);
          await deletePendingBatch(pid);
          setIssuedBatch({
            batchId: pending.batch_id,
            students: pending.students,
            leaves: pending.leaves,
            root: pending.merkle_root
          });
          showMsg("Batch approved and executed. Certificates ready to download.");
        } else {
          showMsg("Batch approved and executed.");
        }
      } else {
        showMsg("Approval recorded. Waiting for more approvals.", "warning");
      }

      setProposalId("");
      setPendingProposals(prev => prev.filter(p => p.id !== pid));
    } catch (e) {
      showMsg(e.reason || e.message, "error");
    }
    setLoading(false);
  };

  const loadPendingProposals = async () => {
    if (!contract || !wallet) {
      showMsg("Connect wallet first.", "warning");
      return;
    }
    setLoadingProposals(true);
    try {
      const count = await contract.proposalCount();
      const all = [];
      for (let i = 0; i < Number(count); i++) {
        const proposal = await contract.getProposal(i);
        if (!proposal.executed) {
          const alreadyApproved = await contract.hasApproved(i, wallet);
          const reqApprovals = await contract.requiredApprovals();
          all.push({
            id: i,
            batchId:       proposal.batchId,
            proposedBy:    proposal.proposedBy,
            approvalCount: Number(proposal.approvalCount),
            required:      Number(reqApprovals),
            canApprove:    !alreadyApproved
          });
        }
      }
      setPendingProposals(all);
      if (all.length === 0) showMsg("No pending proposals.", "warning");
    } catch (e) {
      showMsg(e.message, "error");
    }
    setLoadingProposals(false);
  };

  const downloadPDF = async (student) => {
    try {
      const provider = new ethers.JsonRpcProvider(
        "https://eth-sepolia.g.alchemy.com/v2/alch_mslyZ-pynP9e20GEMgFDp"
      );
      const readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const batch = await readContract.getBatch(issuedBatch.batchId);
      const certHash = hashCertificate(student, issuedBatch.batchId);
      await generateCertificatePDF(
        student, issuedBatch.batchId, certHash,
        batch.merkleRoot, batch.issuedAt, batch.issuedBy
      );
    } catch (e) {
      showMsg(e.message, "error");
    }
  };

  const downloadVerifiedPDF = async () => {
    if (!verifyResult?.valid) return;
    try {
      await generateCertificatePDF(
        verifyResult.cert, verifyResult.batchId || verifyBatchId,
        verifyResult.certHash, verifyResult.merkleRoot,
        verifyResult.issuedAt, verifyResult.issuedBy
      );
    } catch (e) {
      showMsg("Could not generate PDF: " + e.message, "error");
    }
  };

  const revokeBatch = async () => {
    if (!contract) { showMsg("Connect wallet first.", "warning"); return; }
    setLoading(true);
    try {
      const tx = await contract.revokeBatch(revokeBatchId, revokeReason);
      await tx.wait();
      showMsg("Batch revoked successfully.");
      setRevokeBatchId(""); setRevokeReason("");
    } catch (e) {
      showMsg(e.reason || e.message, "error");
    }
    setLoading(false);
  };

  const addIssuer = async () => {
    if (!contract) { showMsg("Connect wallet first.", "warning"); return; }
    setLoading(true);
    try {
      const tx = await contract.addIssuer(issuerAddress);
      await tx.wait();
      showMsg("Issuer added successfully.");
      setIssuerAddress("");
    } catch (e) {
      showMsg(e.reason || e.message, "error");
    }
    setLoading(false);
  };

  const updateRequiredApprovals = async () => {
    if (!contract) { showMsg("Connect wallet first.", "warning"); return; }
    setLoading(true);
    try {
      const tx = await contract.setRequiredApprovals(requiredApprovals);
      await tx.wait();
      showMsg(`Required approvals updated to ${requiredApprovals}.`);
    } catch (e) {
      showMsg(e.reason || e.message, "error");
    }
    setLoading(false);
  };

  const loadBatchHistory = async () => {
    setLoadingHistory(true);
    try {
      const batches = await getAllBatches();
      setBatchHistory(batches);
      if (batches.length === 0) {
        showMsg("No batches found.", "warning");
      } else {
        showMsg(`Found ${batches.length} batch(es).`);
      }
    } catch (e) {
      showMsg(e.message, "error");
    }
    setLoadingHistory(false);
  };

  return (
    <Box sx={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Inter', sans-serif" }}>
      <style>{fontCss}</style>
      <Box sx={{ borderBottom: "1px solid #1C2030", px: { xs: 2, md: 4 }, py: 2,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Stack direction="row" spacing={3} alignItems="center">
          <Box component="a" href="#/" sx={{ color: T.muted, textDecoration: "none", fontSize: 14, "&:hover": { color: "#fff" } }}>
            ← Overview
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>
            <Typography sx={{ fontFamily: headFont, fontWeight: 700, fontSize: 19 }}>CertVerify</Typography>
          </Stack>
        </Stack>
        {wallet ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label="Sepolia" size="small"
              sx={{ background: "transparent", color: T.green, border: "1px solid rgba(52,211,153,0.4)" }} />
            <Chip label={`${wallet.substring(0, 6)}...${wallet.substring(38)}`}
              sx={{ background: T.panel2, color: T.green, border: "1px solid rgba(52,211,153,0.4)", fontFamily: monoFont, fontSize: 12 }} />
            <Button size="small" variant="outlined"
              onClick={() => { setWallet(null); setContract(null); }}
              sx={{ borderColor: T.red, color: T.red, fontSize: 11 }}>
              Disconnect
            </Button>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label="Sepolia" size="small"
              sx={{ background: "transparent", color: T.green, border: "1px solid rgba(52,211,153,0.4)" }} />
            <Button variant="outlined" onClick={connectWallet}
              sx={{ borderColor: "#3A4058", color: T.text, borderRadius: "10px", textTransform: "none", fontWeight: 500 }}>
              Connect Wallet
            </Button>
          </Stack>
        )}
      </Box>

      <Container maxWidth="md" sx={{ py: 4 }}>
        {message && (
          <Alert severity={message.severity} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{ "& .MuiTab-root": { color: T.dim, textTransform: "none", fontSize: 15, fontWeight: 500 },
                "& .Mui-selected": { color: "#fff !important", fontWeight: 600 },
                "& .MuiTabs-indicator": { backgroundColor: T.purple, height: 3, borderRadius: 2 } }}>
          <Tab label="Verify" />
          <Tab label="Issue Batch" />
          <Tab label="Revoke" />
          <Tab label="Admin" />
        </Tabs>

        <Divider sx={{ borderColor: "#1C2030" }} />

        {/* VERIFY */}
        <TabPanel value={tab} index={0}>
          <Typography sx={{ mb: 2, fontFamily: headFont, fontWeight: 700, fontSize: 30, letterSpacing: "-0.02em" }}>Verify a Certificate</Typography>

          <Stack direction="row" spacing={1} mb={3}>
            <Button
              variant={verifyMode === "hash" ? "contained" : "outlined"}
              size="small"
              onClick={() => { setVerifyMode("hash"); setVerifyResult(null); }}
              sx={verifyMode === "hash"
                ? { background: T.purple, borderRadius: "8px", textTransform: "none", fontWeight: 600 }
                : { borderColor: "#2A3047", color: T.muted, borderRadius: "8px", textTransform: "none" }}>
              By Hash
            </Button>
            <Button
              variant={verifyMode === "manual" ? "contained" : "outlined"}
              size="small"
              onClick={() => { setVerifyMode("manual"); setVerifyResult(null); }}
              sx={verifyMode === "manual"
                ? { background: T.purple, borderRadius: "8px", textTransform: "none", fontWeight: 600 }
                : { borderColor: "#2A3047", color: T.muted, borderRadius: "8px", textTransform: "none" }}>
              By Details
            </Button>
          </Stack>

          {loading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              <CircularProgress size={20} sx={{ color: T.violet }} />
              <Typography variant="body2" sx={{ color: T.violet }}>
                Verifying on blockchain...
              </Typography>
            </Box>
          )}

          {verifyMode === "hash" && (
            <Stack spacing={2}>
              <Typography variant="body2" sx={{ color: T.dim }}>
                Paste the certificate hash from the PDF. No other details needed.
              </Typography>
              <TextField
                label="Certificate Hash (0x...)"
                value={certHashInput}
                onChange={e => setCertHashInput(e.target.value.replace(/\s+/g, ""))}
                fullWidth
                placeholder="0x96314bedb9af57ceb6b84b336a19c9927b6dbc771f2736ff43e225a2c1df9021"
                sx={inputSx}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button variant="contained" onClick={verifyByHash} disabled={loading}
                  sx={{ ...primaryBtn, flex: 1 }}>
                  {loading ? <CircularProgress size={20} color="inherit" /> : "Verify on blockchain"}
                </Button>
                <Button variant="outlined" disabled={loading}
                  onClick={() => { setCertHashInput(SAMPLE_HASH); setVerifyResult(null); }}
                  sx={{ borderColor: "#5B4A9E", borderStyle: "dashed", color: "#C4B5FD",
                    borderRadius: "10px", textTransform: "none", fontWeight: 500 }}>
                  ✨ Try a sample certificate
                </Button>
              </Stack>
            </Stack>
          )}

          {verifyMode === "manual" && (
            <Stack spacing={2}>
              <Typography variant="body2" sx={{ color: T.dim }}>
                Enter exact certificate details or scan QR code for instant verification.
              </Typography>
              <TextField label="Batch ID" value={verifyBatchId}
                onChange={e => setVerifyBatchId(e.target.value)} fullWidth sx={inputSx} />
              <TextField label="Student Name" value={verifyCertName}
                onChange={e => setVerifyCertName(e.target.value)} fullWidth sx={inputSx} />
              <TextField label="Degree" value={verifyDegree}
                onChange={e => setVerifyDegree(e.target.value)} fullWidth sx={inputSx} />
              <TextField label="University" value={verifyUni}
                onChange={e => setVerifyUni(e.target.value)} fullWidth sx={inputSx} />
              <TextField label="Year" type="number" value={verifyYear}
                onChange={e => setVerifyYear(e.target.value)} fullWidth sx={inputSx} />
              <Button variant="contained"
                onClick={() => verifyCertificate()} disabled={loading}
                sx={primaryBtn}>
                {loading ? <CircularProgress size={20} color="inherit" /> : "Verify Certificate"}
              </Button>

              <Card sx={{ background: T.panel2, border: `1px dashed ${T.border}`, p: 2 }}>
                <Typography variant="caption" sx={{ color: T.dim, display: "block", mb: 1 }}>
                  Optional — paste proof JSON or import file:
                </Typography>
                <TextField
                  placeholder='Paste proof JSON {"batchId": "...", "proofData": {...}}'
                  multiline rows={2} fullWidth size="small"
                  value={pasteProof}
                  onChange={e => handlePasteProof(e.target.value)}
                  sx={inputSx}
                />
                <Button variant="outlined" component="label" size="small"
                  sx={{ mt: 1, borderColor: T.border, color: T.dim }}>
                  Import Proof File (.json)
                  <input type="file" accept=".json" hidden onChange={importProofs} />
                </Button>
              </Card>
            </Stack>
          )}

          {verifyResult && (() => {
            const status = verifyResult.valid ? "valid" : verifyResult.revoked ? "revoked" : "invalid";
            const col = { valid: T.green, revoked: T.amber, invalid: T.red }[status];
            const label = { valid: "VALID", revoked: "REVOKED", invalid: "INVALID" }[status];
            const sub = {
              valid: "Verified against the on-chain Merkle root",
              revoked: "The issuer revoked this batch",
              invalid: "This certificate could not be verified",
            }[status];
            const row = (k, v, mono) => (
              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Typography variant="body2" sx={{ color: T.dim }}>{k}</Typography>
                <Typography variant="body2" sx={{ color: T.text, fontFamily: mono ? monoFont : "inherit",
                  fontSize: mono ? 12 : undefined, wordBreak: "break-all", textAlign: "right" }}>{v}</Typography>
              </Stack>
            );
            return (
              <Card sx={{ mt: 3, background: `${col}14`, border: `1px solid ${col}66`, borderRadius: "18px",
                boxShadow: `0 0 70px ${col}1A` }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Box sx={{ width: 48, height: 48, borderRadius: "50%", background: col, color: "#0B0D14",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800 }}>
                      {status === "valid" ? "✓" : status === "revoked" ? "!" : "✕"}
                    </Box>
                    <Box>
                      <Typography sx={{ fontFamily: headFont, fontWeight: 700, fontSize: 26, color: col, lineHeight: 1.1 }}>
                        {label}
                      </Typography>
                      <Typography variant="body2" sx={{ color: T.muted }}>{sub}</Typography>
                    </Box>
                  </Stack>

                  {verifyResult.studentName && (
                    <Box sx={{ mb: 2 }}>
                      <Typography sx={{ fontFamily: headFont, fontWeight: 600, fontSize: 24 }}>
                        {verifyResult.studentName}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#C7CDDD" }}>
                        {verifyResult.degree} · {verifyResult.university} · {verifyResult.year}
                      </Typography>
                    </Box>
                  )}

                  {verifyResult.reason && (
                    <Typography variant="body2" sx={{ color: T.amber, mb: 1.5 }}>
                      Reason: {verifyResult.reason}
                    </Typography>
                  )}

                  <Stack spacing={1} sx={{ borderTop: `1px solid ${col}40`, pt: 2 }}>
                    {row("Cert hash", `${verifyResult.certHash?.substring(0, 22)}…`, true)}
                    {verifyResult.merkleRoot && row("Merkle root", `${verifyResult.merkleRoot?.substring(0, 22)}…`, true)}
                    {verifyResult.issuedBy && row("Issued by", `${verifyResult.issuedBy.substring(0, 8)}…${verifyResult.issuedBy.slice(-4)}`, true)}
                    {row("Issued at", verifyResult.issuedAt
                      ? new Date(Number(verifyResult.issuedAt) * 1000).toLocaleString() : "—")}
                    {row("Network", "Ethereum Sepolia")}
                  </Stack>

                  <Stack direction="row" spacing={2} sx={{ mt: 2 }} alignItems="center" flexWrap="wrap">
                    <Box component="a" href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                      target="_blank" rel="noreferrer"
                      sx={{ color: col, fontSize: 13, textDecoration: "none" }}>
                      View contract on Etherscan →
                    </Box>
                    {verifyResult.valid && verifyResult.cert && (
                      <Button variant="outlined" onClick={downloadVerifiedPDF}
                        sx={{ borderColor: T.green, color: T.green, borderRadius: "10px", textTransform: "none" }}>
                        Download Certificate PDF
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            );
          })()}
        </TabPanel>

        {/* ISSUE */}
        <TabPanel value={tab} index={1}>
          <Typography variant="h6" sx={{ mb: 2, color: T.text }}>Issue Certificate Batch</Typography>
          <Typography variant="body2" sx={{ color: T.dim, mb: 3 }}>
            Wallet required. Merkle tree built automatically. Proofs saved to Supabase only after full execution.
          </Typography>
          <Stack spacing={2}>
            <TextField label="Batch ID (e.g. MIT-CS-2024-003)" value={batchId}
              onChange={e => setBatchId(e.target.value)} fullWidth sx={inputSx} />
            {students.map((s, i) => (
              <Card key={i} sx={{ background: T.panel2, border: `1px solid ${T.border}`, p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" sx={{ color: T.violet }}>Student {i + 1}</Typography>
                  {students.length > 1 && (
                    <Button size="small" onClick={() => removeStudent(i)}
                      sx={{ color: T.red, minWidth: 0 }}>✕</Button>
                  )}
                </Stack>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <TextField label="Name" value={s.name}
                      onChange={e => updateStudent(i, "name", e.target.value)}
                      fullWidth size="small" sx={inputSx} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="Degree" value={s.degree}
                      onChange={e => updateStudent(i, "degree", e.target.value)}
                      fullWidth size="small" sx={inputSx} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="University" value={s.university}
                      onChange={e => updateStudent(i, "university", e.target.value)}
                      fullWidth size="small" sx={inputSx} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField label="Year" type="number" value={s.year}
                      onChange={e => updateStudent(i, "year", e.target.value)}
                      fullWidth size="small" sx={inputSx} />
                  </Grid>
                </Grid>
              </Card>
            ))}
            <Button onClick={addStudent} variant="outlined"
              sx={{ borderColor: T.border, color: T.dim }}>
              + Add Student
            </Button>
            <Button variant="contained" onClick={issueBatch} disabled={loading || !wallet}
              sx={primaryBtn}>
              {loading ? <CircularProgress size={20} color="inherit" /> : "Propose & Issue Batch"}
            </Button>
          </Stack>

          {issuedBatch && (
            <Card sx={{ mt: 3, background: T.panel2, border: "1px solid #34d399" }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ color: T.green, mb: 2 }}>
                  ✓ Batch Issued — Download Certificates
                </Typography>
                <Stack spacing={1}>
                  {issuedBatch.students.map((s, i) => (
                    <Stack key={i} direction="row" justifyContent="space-between" alignItems="center"
                      sx={{ background: T.panel, p: 1.5, borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ color: T.text }}>
                        {s.name.trim()} — {s.degree.trim()}
                      </Typography>
                      <Button size="small" variant="outlined" onClick={() => downloadPDF(s)}
                        sx={{ borderColor: T.violet, color: T.violet }}>
                        Download PDF
                      </Button>
                    </Stack>
                  ))}
                </Stack>

                {proofJson && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" sx={{ color: T.amber, display: "block", mb: 1 }}>
                      Backup proof JSON — copy and save if needed:
                    </Typography>
                    <Box sx={{ background: "#0a0d14", p: 2, borderRadius: 1,
                      maxHeight: 100, overflow: "auto" }}>
                      <Typography variant="caption" sx={{
                        fontFamily: "monospace", color: T.dim,
                        fontSize: 10, whiteSpace: "pre" }}>
                        {proofJson}
                      </Typography>
                    </Box>
                    <Button size="small" variant="outlined"
                      sx={{ mt: 1, borderColor: T.amber, color: T.amber }}
                      onClick={() => navigator.clipboard.writeText(proofJson)
                        .then(() => showMsg("Proof JSON copied!"))}>
                      Copy Proof JSON
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {/* MULTISIG PENDING PROPOSALS */}
          <Card sx={{ mt: 3, background: T.panel2, border: `1px solid ${T.border}` }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle2" sx={{ color: T.violet }}>
                  Pending Approvals (Multisig)
                </Typography>
                <Button size="small" variant="outlined" onClick={loadPendingProposals}
                  disabled={loadingProposals || !wallet}
                  sx={{ borderColor: T.violet, color: T.violet }}>
                  {loadingProposals
                    ? <CircularProgress size={16} color="inherit" />
                    : "Load Pending"}
                </Button>
              </Stack>

              {pendingProposals.length === 0 ? (
                <Typography variant="caption" sx={{ color: T.dim }}>
                  Connect wallet and click Load Pending to see proposals awaiting approval.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {pendingProposals.map((p, i) => (
                    <Card key={i} sx={{ background: T.panel, border: `1px solid ${T.border}`, p: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="body2" sx={{ color: T.violet, fontWeight: 600 }}>
                            {p.batchId}
                          </Typography>
                          <Typography variant="caption" sx={{ color: T.dim, display: "block" }}>
                            Approvals: {p.approvalCount} / {p.required}
                          </Typography>
                          <Typography variant="caption" sx={{ color: T.dim, display: "block" }}>
                            Proposed by: {p.proposedBy.substring(0, 10)}...
                          </Typography>
                          <Box sx={{ width: 220 }}><Stepper count={p.approvalCount} required={p.required} /></Box>
                        </Box>
                        {p.canApprove ? (
                          <Button size="small" variant="contained"
                            onClick={() => approveBatch(p.id)}
                            disabled={loading}
                            sx={{ background: T.green, color: "#000",
                              "&:hover": { background: "#059669" } }}>
                            Approve
                          </Button>
                        ) : (
                          <Chip label="Awaiting others"
                            size="small"
                            sx={{ background: "#2a2f42", color: T.dim }} />
                        )}
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}

              <Divider sx={{ borderColor: T.border, my: 2 }} />
              <Typography variant="caption" sx={{ color: T.dim, display: "block", mb: 1 }}>
                Or approve manually by Proposal ID:
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField label="Proposal ID" value={proposalId}
                  onChange={e => setProposalId(e.target.value)}
                  size="small" sx={{ ...inputSx, flex: 1 }} />
                <Button variant="contained" onClick={() => approveBatch()}
                  disabled={loading || !wallet}
                  sx={{ background: T.green, color: "#000",
                    "&:hover": { background: "#059669" } }}>
                  {loading ? <CircularProgress size={20} color="inherit" /> : "Approve"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </TabPanel>

        {/* REVOKE */}
        <TabPanel value={tab} index={2}>
          <Typography variant="h6" sx={{ mb: 2, color: T.text }}>Revoke a Batch</Typography>
          <Stack spacing={2}>
            <TextField label="Batch ID" value={revokeBatchId}
              onChange={e => setRevokeBatchId(e.target.value)} fullWidth sx={inputSx} />
            <TextField label="Reason" value={revokeReason}
              onChange={e => setRevokeReason(e.target.value)} fullWidth multiline rows={3} sx={inputSx} />
            <Button variant="contained" onClick={revokeBatch} disabled={loading || !wallet}
              sx={{ background: T.red, "&:hover": { background: "#dc2626" } }}>
              {loading ? <CircularProgress size={20} color="inherit" /> : "Revoke Batch"}
            </Button>
          </Stack>
        </TabPanel>

        {/* ADMIN */}
        <TabPanel value={tab} index={3}>
          <Typography variant="h6" sx={{ mb: 2, color: T.text }}>Admin — Manage Issuers</Typography>
          <Stack spacing={3}>

            <Card sx={{ background: T.panel2, border: `1px solid ${T.border}`, p: 2 }}>
              <Typography variant="subtitle2" sx={{ color: T.violet, mb: 2 }}>Add Issuer</Typography>
              <Stack spacing={2}>
                <TextField label="Issuer Wallet Address" value={issuerAddress}
                  onChange={e => setIssuerAddress(e.target.value)} fullWidth sx={inputSx} />
                <Button variant="contained" onClick={addIssuer} disabled={loading || !wallet}
                  sx={{ background: T.green, color: "#000", "&:hover": { background: "#059669" } }}>
                  {loading ? <CircularProgress size={20} color="inherit" /> : "Add Issuer"}
                </Button>
              </Stack>
            </Card>

            <Card sx={{ background: T.panel2, border: `1px solid ${T.border}`, p: 2 }}>
              <Typography variant="subtitle2" sx={{ color: T.violet, mb: 2 }}>
                Multisig — Required Approvals
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField label="Required Approvals" type="number"
                  value={requiredApprovals}
                  onChange={e => setRequiredApprovals(parseInt(e.target.value))}
                  size="small" sx={{ ...inputSx, width: 180 }} />
                <Button variant="contained" onClick={updateRequiredApprovals}
                  disabled={loading || !wallet}
                  sx={primaryBtn}>
                  {loading ? <CircularProgress size={20} color="inherit" /> : "Update"}
                </Button>
              </Stack>
              <Typography variant="caption" sx={{ color: T.dim, mt: 1, display: "block" }}>
                Set to 1 for single approval. Set to 2 for 2-of-N multisig.
              </Typography>
            </Card>

            <Card sx={{ background: T.panel2, border: `1px solid ${T.border}`, p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle2" sx={{ color: T.violet }}>
                  All Issued Batches
                </Typography>
                <Button size="small" variant="outlined" onClick={loadBatchHistory}
                  disabled={loadingHistory}
                  sx={{ borderColor: T.violet, color: T.violet }}>
                  {loadingHistory
                    ? <CircularProgress size={16} color="inherit" />
                    : "Load History"}
                </Button>
              </Stack>
              {batchHistory.length === 0 ? (
                <Typography variant="caption" sx={{ color: T.dim }}>
                  Click Load History to fetch all batches.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {batchHistory.map((b, i) => (
                    <Card key={i} sx={{ background: T.panel, border: `1px solid ${T.border}`, p: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="body2" sx={{ color: T.violet, fontWeight: 600 }}>
                            {b.batch_id}
                          </Typography>
                          <Typography variant="caption" sx={{ color: T.dim, display: "block" }}>
                            Issued: {new Date(b.issued_at).toLocaleString()}
                          </Typography>
                          <Typography variant="caption" sx={{ color: T.dim, display: "block" }}>
                            By: {b.issued_by?.substring(0, 10)}...
                          </Typography>
                          <Typography variant="caption" sx={{ color: T.dim, display: "block" }}>
                            Root: {b.merkle_root?.substring(0, 20)}...
                          </Typography>
                        </Box>
                        <Button size="small" variant="outlined"
                          onClick={() => { setVerifyBatchId(b.batch_id); setTab(0); setVerifyMode("manual"); }}
                          sx={{ borderColor: T.border, color: T.dim, fontSize: 10 }}>
                          Go to Verify
                        </Button>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}
            </Card>

          </Stack>
        </TabPanel>

      </Container>
    </Box>
  );
}

const primaryBtn = {
  background: T.purple, borderRadius: "10px", textTransform: "none", fontWeight: 600, py: 1.4,
  boxShadow: "0 8px 28px rgba(139,92,246,0.3)", "&:hover": { background: "#7C3AED" },
};

const inputSx = {
  "& .MuiOutlinedInput-root": {
    color: T.text, borderRadius: "10px", background: T.bg,
    "& fieldset": { borderColor: "#2A3047" },
    "&:hover fieldset": { borderColor: T.violet },
    "&.Mui-focused fieldset": { borderColor: T.violet },
  },
  "& .MuiInputLabel-root": { color: T.dim },
  "& .MuiInputLabel-root.Mui-focused": { color: T.violet },
};