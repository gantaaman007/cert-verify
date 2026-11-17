import React from "react";

const C = {
  bg: "#0B0D14", panel: "#11141F", border: "#252A3E", text: "#E8EAF2",
  muted: "#A8B0C5", dim: "#8E97AE", purple: "#8B5CF6", violet: "#A78BFA",
  green: "#34D399", amber: "#FBBF24",
};
const GITHUB = "https://github.com/gantaaman007/cert-verify"; // TODO: your repo URL
const CONTRACT = "0x42e828cafB2ffF70900C6A3f1D5AE970E4b279C1";
const ETHERSCAN = `https://sepolia.etherscan.io/address/${CONTRACT}`;

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
.cv-root{background:${C.bg};color:${C.text};font-family:'Inter',sans-serif;min-height:100vh}
.cv-root *{box-sizing:border-box}
.cv-root a{color:${C.muted};text-decoration:none}.cv-root a:hover{color:#fff}
.cv-h{font-family:'Space Grotesk',sans-serif}
.cv-wrap{max-width:1152px;margin:0 auto;padding:0 24px}
.cv-btn{display:inline-block;border-radius:12px;padding:16px 28px;font-size:16px;font-weight:600;cursor:pointer;border:0}
.cv-primary{background:${C.purple};color:#fff!important;box-shadow:0 8px 32px rgba(139,92,246,.35)}
.cv-primary:hover{background:#7C3AED}
.cv-ghost{background:transparent;color:${C.text}!important;border:1px solid #3A4058}
.cv-card{background:${C.panel};border:1px solid ${C.border};border-radius:18px;padding:28px}
.cv-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.cv-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
.cv-eyebrow{font-size:12px;letter-spacing:.12em;font-weight:600;color:${C.violet}}
.cv-sec{padding:72px 0;border-top:1px solid #1C2030}
.cv-chip{background:#141828;border:1px solid #232842;border-radius:10px;padding:10px 16px;font-size:14px}
@media(max-width:800px){.cv-grid3,.cv-grid2{grid-template-columns:1fr}.cv-hero h1{font-size:44px!important}.cv-navlinks{display:none}.cv-stats{flex-wrap:wrap;gap:24px!important}.cv-lim{flex-direction:column}}
`;

const problems = [
  ["Forgery is easy", "A PDF or paper copy proves nothing on its own. Employers can't tell an original from an edit."],
  ["Verification takes weeks", "Background-check firms email registrars and wait. Every check is a manual, paid step."],
  ["One database to trust", "A central registry can be breached, edited or go offline, and the verifier must trust it blindly."],
];
const steps = [
  ["01", "Issue", "A registrar enters the students. Each certificate is hashed and the whole class rolls up into one Merkle root, proposed on-chain."],
  ["02", "Approve", "A second issuer approves. The proposer can't approve their own batch, so no single key can issue alone. On approval, the batch executes."],
  ["03", "Verify", "Anyone pastes the hash or scans the QR on the PDF. The app rebuilds the Merkle proof and checks it against the on-chain root."],
];
const features = [
  ["Merkle batching", "One root covers thousands of certificates, so gas cost stays flat. Strict proof checking means nothing is trusted blindly."],
  ["On-chain multisig", "proposeBatch and approveBatch with a required approval count and write-once batch IDs, enforced in the contract."],
  ["Revocation with reasons", "Revoke a whole batch or a single certificate. The reason is permanent and visible to every verifier."],
  ["QR-embedded proofs", "Each PDF carries a QR code with its proof. Scanning it opens the app and verifies automatically."],
];
const limits = [
  "Proofs live in Supabase. Next step: IPFS or Pinata for decentralized storage.",
  "The contract is not upgradeable and has not been audited.",
  "Single network (Sepolia). Future work: Chainlink CCIP for cross-chain verification.",
  "Name canonicalization (Unicode normalization) is still on the roadmap.",
];
const stack = ["Solidity 0.8.19", "Ethereum Sepolia", "React + MUI", "ethers v6", "Supabase", "jsPDF + QR", "Vercel"];
const stats = [["1 tx", "per batch of any size"], ["2-of-N", "multisig approval"], ["0", "wallets needed to verify"], ["< 5s", "to verify a certificate"]];

const Title = ({ eyebrow, children }) => (
  <div style={{ marginBottom: 32 }}>
    <div className="cv-eyebrow">{eyebrow}</div>
    <h2 className="cv-h" style={{ margin: "8px 0 0", fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em", maxWidth: 800 }}>{children}</h2>
  </div>
);

export default function Landing() {
  return (
    <div className="cv-root">
      <style>{css}</style>

      <div style={{ borderBottom: "1px solid #1C2030" }}>
        <div className="cv-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 76 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.violet} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>
            <span className="cv-h" style={{ fontWeight: 700, fontSize: 21 }}>CertVerify</span>
          </div>
          <div className="cv-navlinks" style={{ display: "flex", gap: 32, fontSize: 15 }}>
            <a href="#problem">Problem</a><a href="#how">How it works</a><a href="#hood">Under the hood</a>
            <a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
          </div>
          <a href="#/app" className="cv-btn cv-primary" style={{ padding: "11px 20px", fontSize: 14 }}>Launch Live Demo</a>
        </div>
      </div>

      <div className="cv-wrap cv-hero" style={{ textAlign: "center", padding: "96px 24px 72px", display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #2A3047", borderRadius: 999, padding: "7px 14px", fontSize: 13, color: C.muted }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />
          Portfolio project · Live on Ethereum Sepolia
        </div>
        <h1 className="cv-h" style={{ margin: 0, fontWeight: 700, fontSize: 80, lineHeight: 1.02, letterSpacing: "-0.035em" }}>
          Certificates that{" "}
          <span style={{ background: `linear-gradient(90deg, ${C.violet}, ${C.green})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>can't be faked.</span>
        </h1>
        <p style={{ margin: 0, fontSize: 21, lineHeight: 1.55, color: C.muted, maxWidth: 700 }}>
          A decentralized certificate registry. Universities issue whole graduating classes in one multisig-approved transaction, and anyone can verify a degree in seconds with no wallet and no account.
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
          <a href="#/app" className="cv-btn cv-primary">Try the live demo →</a>
          <a href={GITHUB} target="_blank" rel="noreferrer" className="cv-btn cv-ghost">View code on GitHub</a>
        </div>
        <div className="cv-stats" style={{ display: "flex", gap: 48, marginTop: 40, paddingTop: 32, borderTop: "1px solid #1C2030", width: "100%", justifyContent: "center" }}>
          {stats.map(([n, l]) => (
            <div key={l} style={{ textAlign: "left" }}>
              <div className="cv-h" style={{ fontWeight: 700, fontSize: 34 }}>{n}</div>
              <div style={{ fontSize: 13, color: C.dim }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div id="problem" className="cv-sec"><div className="cv-wrap">
        <Title eyebrow="THE PROBLEM">Verifying a degree today is slow, manual and easy to fake.</Title>
        <div className="cv-grid3">
          {problems.map(([t, d]) => (
            <div className="cv-card" key={t}>
              <div className="cv-h" style={{ fontWeight: 600, fontSize: 22, marginBottom: 12 }}>{t}</div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: C.muted }}>{d}</p>
            </div>
          ))}
        </div>
      </div></div>

      <div id="how" className="cv-sec"><div className="cv-wrap">
        <Title eyebrow="HOW IT WORKS">Issue. Approve. Verify.</Title>
        <div className="cv-grid3">
          {steps.map(([n, t, d]) => (
            <div className="cv-card" key={n}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: C.violet, marginBottom: 12 }}>{n}</div>
              <div className="cv-h" style={{ fontWeight: 600, fontSize: 24, marginBottom: 12 }}>{t}</div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: C.muted }}>{d}</p>
            </div>
          ))}
        </div>
      </div></div>

      <div id="hood" className="cv-sec"><div className="cv-wrap">
        <Title eyebrow="UNDER THE HOOD">Built like a real system, not a demo.</Title>
        <div className="cv-grid2">
          {features.map(([t, d]) => (
            <div className="cv-card" key={t}>
              <div className="cv-h" style={{ fontWeight: 600, fontSize: 20, marginBottom: 10 }}>{t}</div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: C.muted }}>{d}</p>
            </div>
          ))}
        </div>
      </div></div>

      <div className="cv-wrap" style={{ padding: "24px 24px 72px" }}>
        <div className="cv-card cv-lim" style={{ borderRadius: 22, padding: 40, display: "flex", gap: 48 }}>
          <div style={{ flex: 1 }}>
            <div className="cv-eyebrow" style={{ color: C.amber }}>HONEST LIMITATIONS</div>
            <h3 className="cv-h" style={{ margin: "10px 0", fontSize: 30, fontWeight: 700 }}>What I'd fix before production.</h3>
            <p style={{ margin: 0, fontSize: 15, color: C.muted }}>Knowing the trade-offs is part of the engineering.</p>
          </div>
          <div style={{ flex: 1.4, display: "flex", flexDirection: "column", gap: 14, fontSize: 15, lineHeight: 1.5, color: "#C7CDDD" }}>
            {limits.map((l) => <div key={l}>{l}</div>)}
          </div>
        </div>
      </div>

      <div className="cv-wrap" style={{ paddingBottom: 72 }}>
        <div className="cv-eyebrow" style={{ marginBottom: 20 }}>TECH STACK</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {stack.map((s) => <span className="cv-chip" key={s}>{s}</span>)}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: C.dim, marginTop: 20, wordBreak: "break-all" }}>
          Contract: {CONTRACT} · <a href={ETHERSCAN} target="_blank" rel="noreferrer" style={{ color: C.violet }}>view on Etherscan →</a>
        </div>
      </div>

      <div className="cv-wrap" style={{ paddingBottom: 72 }}>
        <div style={{ borderRadius: 24, border: "1px solid #3A2F66", background: "linear-gradient(135deg, rgba(139,92,246,0.22), rgba(52,211,153,0.10))", padding: "64px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <h2 className="cv-h" style={{ margin: 0, fontWeight: 700, fontSize: 48, letterSpacing: "-0.02em" }}>Don't take my word for it.</h2>
          <p style={{ margin: 0, fontSize: 19, color: "#C7CDDD", maxWidth: 560, lineHeight: 1.5 }}>Verify a real certificate on the live blockchain. No wallet needed.</p>
          <a href="#/app" className="cv-btn cv-primary" style={{ padding: "18px 36px", fontSize: 17 }}>Open the live app →</a>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #1C2030" }}>
        <div className="cv-wrap" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, padding: "28px 24px", fontSize: 14, color: C.dim }}>
          <span>Built by Ganta Aman Reddy · MS Computer Science, AUM</span>
          <div style={{ display: "flex", gap: 24 }}>
            <a href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
            <a href={ETHERSCAN} target="_blank" rel="noreferrer">Etherscan</a>
          </div>
        </div>
      </div>
    </div>
  );
}
