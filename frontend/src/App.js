import { useState } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";
import { hashCertificate, buildMerkleTree, getMerkleProof, verifyMerkleProof } from "./utils/merkle";
import {
  Box, Button, Card, CardContent, Chip, CircularProgress,
  Container, Divider, Grid, Tab, Tabs, TextField,
  Typography, Alert, Stack
} from "@mui/material";

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

function saveProofs(batchId, students, leaves) {
  console.log("saveProofs called", batchId, students, leaves);
  const proofData = {};
  students.forEach((student, i) => {
    const key = `${student.name}|${student.degree}|${student.university}|${student.year}`;
    proofData[key] = { student, leaf: leaves[i], index: i };
  });
  localStorage.setItem(`batch-${batchId}`, JSON.stringify(proofData));
  console.log("saved:", localStorage.getItem(`batch-${batchId}`));
}

function getStoredProof(batchId, cert) {
  const key = `${cert.name}|${cert.degree}|${cert.university}|${cert.year}`;
  const data = localStorage.getItem(`batch-${batchId}`);
  if (!data) return null;
  const proofData = JSON.parse(data);
  return proofData[key] || null;
}

export default function App() {
  const [tab, setTab]             = useState(0);
  const [wallet, setWallet]       = useState(null);
  const [contract, setContract]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [message, setMessage]     = useState(null);

  const [batchId, setBatchId]     = useState("");
  const [students, setStudents]   = useState([
    { name: "", degree: "", university: "", year: 2024 }
  ]);

  const [verifyBatchId, setVerifyBatchId]   = useState("");
  const [verifyCertName, setVerifyCertName] = useState("");
  const [verifyDegree, setVerifyDegree]     = useState("");
  const [verifyUni, setVerifyUni]           = useState("");
  const [verifyYear, setVerifyYear]         = useState(2024);
  const [verifyResult, setVerifyResult]     = useState(null);

  const [revokeBatchId, setRevokeBatchId] = useState("");
  const [revokeReason, setRevokeReason]   = useState("");
  const [issuerAddress, setIssuerAddress] = useState("");

  const showMsg = (text, severity = "success") => {
    setMessage({ text, severity });
    setTimeout(() => setMessage(null), 6000);
  };

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

  const addStudent = () => {
    setStudents([...students, { name: "", degree: "", university: "", year: 2024 }]);
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
      const tx = await contract.issueBatch(batchId, root);
      await tx.wait();
      saveProofs(batchId, students, leaves);
      showMsg(`Batch issued. Root: ${root.substring(0, 20)}...`);
      setBatchId("");
      setStudents([{ name: "", degree: "", university: "", year: 2024 }]);
    } catch (e) {
      showMsg(e.reason || e.message, "error");
    }
    setLoading(false);
  };

  const verifyCertificate = async () => {
    setLoading(true);
    setVerifyResult(null);
    try {
      const provider = new ethers.JsonRpcProvider(
        "https://eth-sepolia.g.alchemy.com/v2/alch_mslyZ-pynP9e20GEMgFDp"
      );
      const readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

      const cert = {
        name: verifyCertName,
        degree: verifyDegree,
        university: verifyUni,
        year: parseInt(verifyYear)
      };
      const certHash = hashCertificate(cert);
      const result = await readContract.verifyCertificate(verifyBatchId, certHash);

      if (!result.valid) {
        setVerifyResult({
          valid: false,
          revoked: result.revoked,
          reason: result.reason || "Certificate not valid",
          merkleRoot: result.merkleRoot,
          issuedAt: result.issuedAt,
          issuedBy: result.issuedBy,
          certHash
        });
        setLoading(false);
        return;
      }

      const stored = getStoredProof(verifyBatchId, cert);
      if (!stored) {
        setVerifyResult({
          valid: false,
          revoked: false,
          reason: "Certificate not found in local batch records — was this batch issued on this device?",
          merkleRoot: result.merkleRoot,
          issuedAt: result.issuedAt,
          issuedBy: result.issuedBy,
          certHash
        });
        setLoading(false);
        return;
      }

      const batchData = JSON.parse(localStorage.getItem(`batch-${verifyBatchId}`));
      const allLeaves = Object.values(batchData)
        .sort((a, b) => a.index - b.index)
        .map(l => l.leaf);

      const proof = getMerkleProof(allLeaves, stored.index);
      console.log("certHash:", certHash);
      console.log("proof:", proof);
      console.log("onChainRoot:", result.merkleRoot);
      console.log("allLeaves:", allLeaves);
      const merkleValid = verifyMerkleProof(certHash, proof, result.merkleRoot);
      console.log("merkleValid:", merkleValid);

      setVerifyResult({
        valid: merkleValid,
        revoked: false,
        reason: merkleValid ? "" : "Merkle proof failed — certificate not part of this batch",
        merkleRoot: result.merkleRoot,
        issuedAt: result.issuedAt,
        issuedBy: result.issuedBy,
        certHash
      });
    } catch (e) {
      showMsg(e.message, "error");
    }
    setLoading(false);
  };

  const revokeBatch = async () => {
    if (!contract) { showMsg("Connect wallet first.", "warning"); return; }
    setLoading(true);
    try {
      const tx = await contract.revokeBatch(revokeBatchId, revokeReason);
      await tx.wait();
      showMsg("Batch revoked successfully.");
      setRevokeBatchId("");
      setRevokeReason("");
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

  return (
    <Box sx={{ minHeight: "100vh", background: "#0f1117", color: "#e8eaf0" }}>
      <Box sx={{ background: "#171b26", borderBottom: "1px solid #2a2f42", px: 4, py: 2,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#a78bfa" }}>
          CertVerify
        </Typography>
        {wallet ? (
          <Chip label={`${wallet.substring(0, 6)}...${wallet.substring(38)}`}
            sx={{ background: "#1e2333", color: "#34d399", border: "1px solid #34d399" }} />
        ) : (
          <Button variant="outlined" onClick={connectWallet}
            sx={{ borderColor: "#a78bfa", color: "#a78bfa" }}>
            Connect Wallet
          </Button>
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
            No wallet needed. Enter the exact certificate details to verify on the blockchain.
          </Typography>
          <Stack spacing={2}>
            <TextField label="Batch ID" value={verifyBatchId} onChange={e => setVerifyBatchId(e.target.value)} fullWidth sx={inputSx} />
            <TextField label="Student Name" value={verifyCertName} onChange={e => setVerifyCertName(e.target.value)} fullWidth sx={inputSx} />
            <TextField label="Degree" value={verifyDegree} onChange={e => setVerifyDegree(e.target.value)} fullWidth sx={inputSx} />
            <TextField label="University" value={verifyUni} onChange={e => setVerifyUni(e.target.value)} fullWidth sx={inputSx} />
            <TextField label="Year" type="number" value={verifyYear} onChange={e => setVerifyYear(e.target.value)} fullWidth sx={inputSx} />
            <Button variant="contained" onClick={verifyCertificate} disabled={loading}
              sx={{ background: "#a78bfa", "&:hover": { background: "#7c3aed" } }}>
              {loading ? <CircularProgress size={20} color="inherit" /> : "Verify Certificate"}
            </Button>
          </Stack>

          {verifyResult && (
            <Card sx={{ mt: 3, background: "#171b26", border: `1px solid ${verifyResult.valid ? "#34d399" : "#f87171"}` }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                  <Typography variant="h6" sx={{ color: verifyResult.valid ? "#34d399" : "#f87171" }}>
                    {verifyResult.valid ? "✓ VALID" : "✗ INVALID"}
                  </Typography>
                  {verifyResult.revoked && <Chip label="REVOKED" size="small" sx={{ background: "#f87171", color: "#fff" }} />}
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
                  Issued At: {verifyResult.issuedAt ? new Date(Number(verifyResult.issuedAt) * 1000).toLocaleString() : "—"}
                </Typography>
              </CardContent>
            </Card>
          )}
        </TabPanel>

        {/* ISSUE */}
        <TabPanel value={tab} index={1}>
          <Typography variant="h6" sx={{ mb: 2, color: "#e8eaf0" }}>Issue Certificate Batch</Typography>
          <Typography variant="body2" sx={{ color: "#7a8099", mb: 3 }}>
            Wallet required. Builds a Merkle tree and stores the root on-chain in one transaction.
          </Typography>
          <Stack spacing={2}>
            <TextField label="Batch ID (e.g. MIT-CS-2024-002)" value={batchId}
              onChange={e => setBatchId(e.target.value)} fullWidth sx={inputSx} />
            {students.map((s, i) => (
              <Card key={i} sx={{ background: "#1e2333", border: "1px solid #2a2f42", p: 2 }}>
                <Typography variant="caption" sx={{ color: "#a78bfa", mb: 1, display: "block" }}>
                  Student {i + 1}
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}><TextField label="Name" value={s.name} onChange={e => updateStudent(i, "name", e.target.value)} fullWidth size="small" sx={inputSx} /></Grid>
                  <Grid item xs={6}><TextField label="Degree" value={s.degree} onChange={e => updateStudent(i, "degree", e.target.value)} fullWidth size="small" sx={inputSx} /></Grid>
                  <Grid item xs={6}><TextField label="University" value={s.university} onChange={e => updateStudent(i, "university", e.target.value)} fullWidth size="small" sx={inputSx} /></Grid>
                  <Grid item xs={6}><TextField label="Year" type="number" value={s.year} onChange={e => updateStudent(i, "year", e.target.value)} fullWidth size="small" sx={inputSx} /></Grid>
                </Grid>
              </Card>
            ))}
            <Button onClick={addStudent} variant="outlined" sx={{ borderColor: "#2a2f42", color: "#7a8099" }}>
              + Add Student
            </Button>
            <Button variant="contained" onClick={issueBatch} disabled={loading || !wallet}
              sx={{ background: "#a78bfa", "&:hover": { background: "#7c3aed" } }}>
              {loading ? <CircularProgress size={20} color="inherit" /> : "Issue Batch on Blockchain"}
            </Button>
          </Stack>
        </TabPanel>

        {/* REVOKE */}
        <TabPanel value={tab} index={2}>
          <Typography variant="h6" sx={{ mb: 2, color: "#e8eaf0" }}>Revoke a Batch</Typography>
          <Stack spacing={2}>
            <TextField label="Batch ID" value={revokeBatchId} onChange={e => setRevokeBatchId(e.target.value)} fullWidth sx={inputSx} />
            <TextField label="Reason" value={revokeReason} onChange={e => setRevokeReason(e.target.value)} fullWidth multiline rows={3} sx={inputSx} />
            <Button variant="contained" onClick={revokeBatch} disabled={loading || !wallet}
              sx={{ background: "#f87171", "&:hover": { background: "#dc2626" } }}>
              {loading ? <CircularProgress size={20} color="inherit" /> : "Revoke Batch"}
            </Button>
          </Stack>
        </TabPanel>

        {/* ADMIN */}
        <TabPanel value={tab} index={3}>
          <Typography variant="h6" sx={{ mb: 2, color: "#e8eaf0" }}>Admin — Manage Issuers</Typography>
          <Stack spacing={2}>
            <TextField label="Issuer Wallet Address" value={issuerAddress} onChange={e => setIssuerAddress(e.target.value)} fullWidth sx={inputSx} />
            <Button variant="contained" onClick={addIssuer} disabled={loading || !wallet}
              sx={{ background: "#34d399", "&:hover": { background: "#059669" }, color: "#000" }}>
              {loading ? <CircularProgress size={20} color="inherit" /> : "Add Issuer"}
            </Button>
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