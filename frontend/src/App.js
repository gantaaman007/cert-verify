import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";
import { hashCertificate, buildMerkleTree, getMerkleProof, verifyMerkleProof } from "./utils/merkle";
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
      verifyUrl = `${window.location.origin}?batchId=${encodeURIComponent(batchId)}&name=${encodeURIComponent(student.name.trim())}&degree=${encodeURIComponent(student.degree.trim())}&university=${encodeURIComponent(student.university.trim())}&year=${student.year}&proof=${encodeURIComponent(JSON.stringify(proof))}&leaf=${storedEntry.leaf}`;
    }
  }

  if (!verifyUrl) {
    verifyUrl = `${window.location.origin}?batchId=${encodeURIComponent(batchId)}&name=${encodeURIComponent(student.name.trim())}&degree=${encodeURIComponent(student.degree.trim())}&university=${encodeURIComponent(student.university.trim())}&year=${student.year}`;
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
  doc.text(certHash.substring(0, 42) + "...", 22, 134);

  doc.setTextColor(122, 128, 153);
  doc.setFontSize(7);
  doc.text("MERKLE ROOT", 22, 142);
  doc.setTextColor(200, 200, 220);
  doc.setFontSize(6.5);
  doc.text(merkleRoot.substring(0, 42) + "...", 22, 147);

  doc.setTextColor(122, 128, 153);
  doc.setFontSize(7);
  doc.text("ISSUED BY", 22, 155);
  doc.setTextColor(200, 200, 220);
  doc.setFontSize(6.5);
  doc.text(issuedBy, 22, 160);

  doc.setTextColor(122, 128, 153);
  doc.setFontSize(7);
  doc.text("ISSUED AT", 22, 168);
  doc.setTextColor(200, 200, 220);
  doc.setFontSize(7.5);
  doc.text(new Date(Number(issuedAt) * 1000).toLocaleString(), 22, 173);

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

  const showMsg = (text, severity = "success") => {
    setMessage({ text, severity });
    setTimeout(() => setMessage(null), 6000);
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
      const provider = new ethers.JsonRpcProvider(
        "https://eth-sepolia.g.alchemy.com/v2/alch_mslyZ-pynP9e20GEMgFDp"
      );
      const readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const cert = {
        name:       (overrideName       || verifyCertName).trim(),
        degree:     (overrideDegree     || verifyDegree).trim(),
        university: (overrideUni        || verifyUni).trim(),
        year:       parseInt(overrideYear || verifyYear)
      };
      const useBatchId = (overrideBatchId || verifyBatchId).trim();
      const certHash = hashCertificate(cert);
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
          merkleValid = true;
        }
      }

      setVerifyResult({
        valid: merkleValid, revoked: false,
        reason: merkleValid ? "" : "Merkle proof failed — certificate not part of this batch",
        merkleRoot: result.merkleRoot, issuedAt: result.issuedAt,
        issuedBy: result.issuedBy, certHash, cert
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
    updated[i][field] = field === "year" ? parseInt(value) : value;
    setStudents(updated);
  };

  const issueBatch = async () => {
    if (!contract) { showMsg("Connect wallet first.", "warning"); return; }
    if (!batchId)  { showMsg("Enter a batch ID.", "warning"); return; }
    setLoading(true);
    try {
      const leaves = students.map(s => hashCertificate(s));
      const { root } = buildMerkleTree(leaves);
      const tx = await contract.proposeBatch(batchId, root);
      const receipt = await tx.wait();
      saveProofs(batchId, students, leaves, setProofJson);

      const executedEvent = receipt.logs.find(log => {
        try { return contract.interface.parseLog(log).name === "BatchExecuted"; }
        catch { return false; }
      });

      if (executedEvent) {
        showMsg(`Batch issued successfully.`);
        setIssuedBatch({ batchId, students, leaves, root });
      } else {
        const proposedEvent = receipt.logs.find(log => {
          try { return contract.interface.parseLog(log).name === "BatchProposed"; }
          catch { return false; }
        });
        if (proposedEvent) {
          const parsed = contract.interface.parseLog(proposedEvent);
          showMsg(`Batch proposed. Proposal ID: ${parsed.args[0]}. Waiting for approvals.`, "warning");
        }
      }
      setBatchId("");
      setStudents([{ name: "", degree: "", university: "", year: 2024 }]);
    } catch (e) {
      showMsg(e.reason || e.message, "error");
    }
    setLoading(false);
  };

  const approveBatch = async () => {
    if (!contract) { showMsg("Connect wallet first.", "warning"); return; }
    setLoading(true);
    try {
      await (await contract.approveBatch(parseInt(proposalId))).wait();
      showMsg("Batch approved successfully.");
      setProposalId("");
    } catch (e) {
      showMsg(e.reason || e.message, "error");
    }
    setLoading(false);
  };

  const downloadPDF = async (student) => {
    try {
      const provider = new ethers.JsonRpcProvider(
        "https://eth-sepolia.g.alchemy.com/v2/alch_mslyZ-pynP9e20GEMgFDp"
      );
      const readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const batch = await readContract.getBatch(issuedBatch.batchId);
      const certHash = hashCertificate(student);
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
    await generateCertificatePDF(
      verifyResult.cert, verifyBatchId,
      verifyResult.certHash, verifyResult.merkleRoot,
      verifyResult.issuedAt, verifyResult.issuedBy
    );
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
    const provider = new ethers.JsonRpcProvider(
      "https://eth-sepolia.g.alchemy.com/v2/alch_mslyZ-pynP9e20GEMgFDp"
    );
    const apiKey = "H57R9V3NSAGCSUE7MKRPE3JB64HF21C8QS";
    const url = `https://api.etherscan.io/v2/api?chainid=11155111&module=logs&action=getLogs&address=${CONTRACT_ADDRESS}&topic0=0x9d115c21e92347f43a5a77bc34f9d83e2638b1aaab21840c87251322d239fe4b&fromBlock=11628001&toBlock=latest&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log("Etherscan response:", data);

    if (data.status === "0") {
      showMsg("No batches found.", "warning");
      setLoadingHistory(false);
      return;
    }

    const iface = new ethers.Interface([
      "event BatchIssued(string indexed batchId, bytes32 merkleRoot, address indexed issuedBy, uint256 issuedAt)"
    ]);

    const history = await Promise.all(data.result.map(async log => {
      let batchId = log.transactionHash.substring(0, 10);
      let root    = log.topics[1] ? log.topics[1].toString() : "";
      let issuedBy = log.topics[2] ? "0x" + log.topics[2].slice(26) : "";
      let issuedAt = parseInt(log.timeStamp, 16);

      try {
        const receipt = await provider.getTransactionReceipt(log.transactionHash);
        for (const rlog of receipt.logs) {
          try {
            const parsed = iface.parseLog(rlog);
            if (parsed && parsed.name === "BatchIssued") {
              console.log("parsed args:", parsed.args, typeof parsed.args[0], JSON.stringify(parsed.args));
              batchId  = parsed.args.batchId   || parsed.args[0]?.toString() || log.transactionHash.substring(0, 10);
              root     = parsed.args.merkleRoot || parsed.args[1]?.toString() || root;
              issuedBy = parsed.args.issuedBy  || parsed.args[2]?.toString() || issuedBy;
              issuedAt = parsed.args.issuedAt  ? Number(parsed.args.issuedAt) : issuedAt;
              break;
            }
          } catch {}
        }
      } catch {}

      return {
        batchId:  batchId,
        root:     root,
        issuedBy: issuedBy,
        issuedAt: issuedAt
      };
    }));

    setBatchHistory(history.reverse());
    showMsg(`Found ${history.length} batch(es).`);
  } catch (e) {
    console.error(e);
    showMsg(e.message, "error");
  }
  setLoadingHistory(false);
};
  return (
    <Box sx={{ minHeight: "100vh", background: "#0f1117", color: "#e8eaf0" }}>
      <Box sx={{ background: "#171b26", borderBottom: "1px solid #2a2f42", px: 4, py: 2,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#a78bfa" }}>CertVerify</Typography>
        {wallet ? (
          <Chip label={`${wallet.substring(0, 6)}...${wallet.substring(38)}`}
            sx={{ background: "#1e2333", color: "#34d399", border: "1px solid #34d399" }} />
        ) : (
          <Button variant="outlined" onClick={connectWallet}
            sx={{ borderColor: "#a78bfa", color: "#a78bfa" }}>Connect Wallet</Button>
        )}
      </Box>

      <Container maxWidth="md" sx={{ py: 4 }}>
        {message && (
          <Alert severity={message.severity} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}

        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{ "& .MuiTab-root": { color: "#7a8099" },
                "& .Mui-selected": { color: "#a78bfa" },
                "& .MuiTabs-indicator": { backgroundColor: "#a78bfa" } }}>
          <Tab label="Verify" />
          <Tab label="Issue Batch" />
          <Tab label="Revoke" />
          <Tab label="Admin" />
        </Tabs>

        <Divider sx={{ borderColor: "#2a2f42" }} />

        {/* VERIFY */}
        <TabPanel value={tab} index={0}>
          <Typography variant="h6" sx={{ mb: 2, color: "#e8eaf0" }}>Verify a Certificate</Typography>
          <Typography variant="body2" sx={{ color: "#7a8099", mb: 3 }}>
            Scan the QR code on a certificate for instant verification, or enter details manually.
          </Typography>

          {loading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              <CircularProgress size={20} sx={{ color: "#a78bfa" }} />
              <Typography variant="body2" sx={{ color: "#a78bfa" }}>
                Verifying on blockchain...
              </Typography>
            </Box>
          )}

          <Stack spacing={2}>
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
              sx={{ background: "#a78bfa", "&:hover": { background: "#7c3aed" } }}>
              {loading ? <CircularProgress size={20} color="inherit" /> : "Verify Certificate"}
            </Button>

            <Card sx={{ background: "#1e2333", border: "1px dashed #2a2f42", p: 2 }}>
              <Typography variant="caption" sx={{ color: "#7a8099", display: "block", mb: 1 }}>
                Optional — paste proof JSON or import file for Merkle verification:
              </Typography>
              <TextField
                placeholder='Paste proof JSON {"batchId": "...", "proofData": {...}}'
                multiline rows={2} fullWidth size="small"
                value={pasteProof}
                onChange={e => handlePasteProof(e.target.value)}
                sx={inputSx}
              />
              <Button variant="outlined" component="label" size="small"
                sx={{ mt: 1, borderColor: "#2a2f42", color: "#7a8099" }}>
                Import Proof File (.json)
                <input type="file" accept=".json" hidden onChange={importProofs} />
              </Button>
            </Card>
          </Stack>

          {verifyResult && (
            <Card sx={{ mt: 3, background: "#171b26",
              border: `1px solid ${verifyResult.valid ? "#34d399" : "#f87171"}` }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                  <Typography variant="h6" sx={{ color: verifyResult.valid ? "#34d399" : "#f87171" }}>
                    {verifyResult.valid ? "✓ VALID" : "✗ INVALID"}
                  </Typography>
                  {verifyResult.revoked && (
                    <Chip label="REVOKED" size="small"
                      sx={{ background: "#f87171", color: "#fff" }} />
                  )}
                </Stack>
                {verifyResult.reason && (
                  <Typography variant="body2" sx={{ color: "#fbbf24", mb: 1 }}>
                    Reason: {verifyResult.reason}
                  </Typography>
                )}
                <Divider sx={{ borderColor: "#2a2f42", my: 1 }} />
                <Typography variant="caption" sx={{ color: "#7a8099", display: "block" }}>
                  Cert Hash: {verifyResult.certHash?.substring(0, 30)}...
                </Typography>
                <Typography variant="caption" sx={{ color: "#7a8099", display: "block" }}>
                  Merkle Root: {verifyResult.merkleRoot?.substring(0, 30)}...
                </Typography>
                <Typography variant="caption" sx={{ color: "#7a8099", display: "block" }}>
                  Issued By: {verifyResult.issuedBy}
                </Typography>
                <Typography variant="caption" sx={{ color: "#7a8099", display: "block" }}>
                  Issued At: {verifyResult.issuedAt
                    ? new Date(Number(verifyResult.issuedAt) * 1000).toLocaleString()
                    : "—"}
                </Typography>
                {verifyResult.valid && (
                  <Button variant="outlined" onClick={downloadVerifiedPDF}
                    sx={{ mt: 2, borderColor: "#34d399", color: "#34d399" }}>
                    Download Certificate PDF
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabPanel>

        {/* ISSUE */}
        <TabPanel value={tab} index={1}>
          <Typography variant="h6" sx={{ mb: 2, color: "#e8eaf0" }}>Issue Certificate Batch</Typography>
          <Typography variant="body2" sx={{ color: "#7a8099", mb: 3 }}>
            Wallet required. Merkle tree built automatically. QR code on PDF contains verification proof.
          </Typography>
          <Stack spacing={2}>
            <TextField label="Batch ID (e.g. MIT-CS-2024-003)" value={batchId}
              onChange={e => setBatchId(e.target.value)} fullWidth sx={inputSx} />
            {students.map((s, i) => (
              <Card key={i} sx={{ background: "#1e2333", border: "1px solid #2a2f42", p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" sx={{ color: "#a78bfa" }}>Student {i + 1}</Typography>
                  {students.length > 1 && (
                    <Button size="small" onClick={() => removeStudent(i)}
                      sx={{ color: "#f87171", minWidth: 0 }}>✕</Button>
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
              sx={{ borderColor: "#2a2f42", color: "#7a8099" }}>
              + Add Student
            </Button>
            <Button variant="contained" onClick={issueBatch} disabled={loading || !wallet}
              sx={{ background: "#a78bfa", "&:hover": { background: "#7c3aed" } }}>
              {loading ? <CircularProgress size={20} color="inherit" /> : "Propose & Issue Batch"}
            </Button>
          </Stack>

          {issuedBatch && (
            <Card sx={{ mt: 3, background: "#1e2333", border: "1px solid #34d399" }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ color: "#34d399", mb: 2 }}>
                  ✓ Batch Issued — Download Certificates
                </Typography>
                <Stack spacing={1}>
                  {issuedBatch.students.map((s, i) => (
                    <Stack key={i} direction="row" justifyContent="space-between" alignItems="center"
                      sx={{ background: "#171b26", p: 1.5, borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ color: "#e8eaf0" }}>
                        {s.name.trim()} — {s.degree.trim()}
                      </Typography>
                      <Button size="small" variant="outlined" onClick={() => downloadPDF(s)}
                        sx={{ borderColor: "#a78bfa", color: "#a78bfa" }}>
                        Download PDF
                      </Button>
                    </Stack>
                  ))}
                </Stack>

                {proofJson && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" sx={{ color: "#fbbf24", display: "block", mb: 1 }}>
                      Backup proof JSON — copy and save if needed:
                    </Typography>
                    <Box sx={{ background: "#0a0d14", p: 2, borderRadius: 1,
                      maxHeight: 100, overflow: "auto" }}>
                      <Typography variant="caption" sx={{
                        fontFamily: "monospace", color: "#7a8099",
                        fontSize: 10, whiteSpace: "pre" }}>
                        {proofJson}
                      </Typography>
                    </Box>
                    <Button size="small" variant="outlined"
                      sx={{ mt: 1, borderColor: "#fbbf24", color: "#fbbf24" }}
                      onClick={() => navigator.clipboard.writeText(proofJson)
                        .then(() => showMsg("Proof JSON copied!"))}>
                      Copy Proof JSON
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          <Card sx={{ mt: 3, background: "#1e2333", border: "1px solid #2a2f42" }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ color: "#a78bfa", mb: 2 }}>
                Approve Pending Proposal (Multisig)
              </Typography>
              <Stack direction="row" spacing={2}>
                <TextField label="Proposal ID" value={proposalId}
                  onChange={e => setProposalId(e.target.value)}
                  size="small" sx={{ ...inputSx, flex: 1 }} />
                <Button variant="contained" onClick={approveBatch} disabled={loading || !wallet}
                  sx={{ background: "#34d399", color: "#000", "&:hover": { background: "#059669" } }}>
                  {loading ? <CircularProgress size={20} color="inherit" /> : "Approve"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </TabPanel>

        {/* REVOKE */}
        <TabPanel value={tab} index={2}>
          <Typography variant="h6" sx={{ mb: 2, color: "#e8eaf0" }}>Revoke a Batch</Typography>
          <Stack spacing={2}>
            <TextField label="Batch ID" value={revokeBatchId}
              onChange={e => setRevokeBatchId(e.target.value)} fullWidth sx={inputSx} />
            <TextField label="Reason" value={revokeReason}
              onChange={e => setRevokeReason(e.target.value)} fullWidth multiline rows={3} sx={inputSx} />
            <Button variant="contained" onClick={revokeBatch} disabled={loading || !wallet}
              sx={{ background: "#f87171", "&:hover": { background: "#dc2626" } }}>
              {loading ? <CircularProgress size={20} color="inherit" /> : "Revoke Batch"}
            </Button>
          </Stack>
        </TabPanel>

        {/* ADMIN */}
        <TabPanel value={tab} index={3}>
          <Typography variant="h6" sx={{ mb: 2, color: "#e8eaf0" }}>Admin — Manage Issuers</Typography>
          <Stack spacing={3}>

            <Card sx={{ background: "#1e2333", border: "1px solid #2a2f42", p: 2 }}>
              <Typography variant="subtitle2" sx={{ color: "#a78bfa", mb: 2 }}>Add Issuer</Typography>
              <Stack spacing={2}>
                <TextField label="Issuer Wallet Address" value={issuerAddress}
                  onChange={e => setIssuerAddress(e.target.value)} fullWidth sx={inputSx} />
                <Button variant="contained" onClick={addIssuer} disabled={loading || !wallet}
                  sx={{ background: "#34d399", color: "#000", "&:hover": { background: "#059669" } }}>
                  {loading ? <CircularProgress size={20} color="inherit" /> : "Add Issuer"}
                </Button>
              </Stack>
            </Card>

            <Card sx={{ background: "#1e2333", border: "1px solid #2a2f42", p: 2 }}>
              <Typography variant="subtitle2" sx={{ color: "#a78bfa", mb: 2 }}>
                Multisig — Required Approvals
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField label="Required Approvals" type="number"
                  value={requiredApprovals}
                  onChange={e => setRequiredApprovals(parseInt(e.target.value))}
                  size="small" sx={{ ...inputSx, width: 180 }} />
                <Button variant="contained" onClick={updateRequiredApprovals}
                  disabled={loading || !wallet}
                  sx={{ background: "#a78bfa", "&:hover": { background: "#7c3aed" } }}>
                  {loading ? <CircularProgress size={20} color="inherit" /> : "Update"}
                </Button>
              </Stack>
              <Typography variant="caption" sx={{ color: "#7a8099", mt: 1, display: "block" }}>
                Set to 1 for single approval. Set to 2 for 2-of-N multisig.
              </Typography>
            </Card>

            <Card sx={{ background: "#1e2333", border: "1px solid #2a2f42", p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle2" sx={{ color: "#a78bfa" }}>
                  All Issued Batches
                </Typography>
                <Button size="small" variant="outlined" onClick={loadBatchHistory}
                  disabled={loadingHistory}
                  sx={{ borderColor: "#a78bfa", color: "#a78bfa" }}>
                  {loadingHistory
                    ? <CircularProgress size={16} color="inherit" />
                    : "Load History"}
                </Button>
              </Stack>
              {batchHistory.length === 0 ? (
                <Typography variant="caption" sx={{ color: "#7a8099" }}>
                  Click Load History to fetch all batches from the blockchain.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {batchHistory.map((b, i) => (
                    <Card key={i} sx={{ background: "#171b26", border: "1px solid #2a2f42", p: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="body2" sx={{ color: "#a78bfa", fontWeight: 600 }}>
                            {b.batchId}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#7a8099", display: "block" }}>
                            Issued: {new Date(Number(b.issuedAt) * 1000).toLocaleString()}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#7a8099", display: "block" }}>
                            By: {b.issuedBy.substring(0, 10)}...
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#7a8099", display: "block" }}>
                            Root: {b.root.substring(0, 20)}...
                          </Typography>
                        </Box>
                        <Button size="small" variant="outlined"
                          onClick={() => { setVerifyBatchId(b.batchId); setTab(0); }}
                          sx={{ borderColor: "#2a2f42", color: "#7a8099", fontSize: 10 }}>
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

const inputSx = {
  "& .MuiOutlinedInput-root": {
    color: "#e8eaf0",
    "& fieldset": { borderColor: "#2a2f42" },
    "&:hover fieldset": { borderColor: "#a78bfa" },
    "&.Mui-focused fieldset": { borderColor: "#a78bfa" },
  },
  "& .MuiInputLabel-root": { color: "#7a8099" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#a78bfa" },
};