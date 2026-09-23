Here's the complete `README.md` file — save this directly as `README.md` in your `C:\Users\ganta\cert-verify` folder:

```markdown
# CertVerify — Decentralized Certificate Verification System

A blockchain-based certificate verification system built on Ethereum Sepolia testnet. Institutions issue certificates in batches using Merkle trees. Anyone can verify a certificate is genuine without needing a wallet or account.

**Live App:** https://cert-verify-henna.vercel.app  
**Smart Contract:** https://sepolia.etherscan.io/address/0x42e828cafB2ffF70900C6A3f1D5AE970E4b279C1  
**GitHub:** https://github.com/gantaaman007/cert-verify

---

## The Problem

Existing certificate verification systems have critical weaknesses:

- Students must manage private keys (Blockcerts)
- Revocation is centralized — defeats blockchain purpose
- Verifiers need wallets or accounts to verify
- No multi-party approval — single issuer can issue fraudulent certificates
- One transaction per certificate — expensive at scale
- No tamper detection after issuance

## The Solution

CertVerify addresses these gaps with:

- **Merkle tree batching** — one transaction covers all students in a batch
- **On-chain revocation** — no central server needed
- **Multisig approval** — two parties must sign before any batch executes
- **Hash-based verification** — employer pastes one hash, no details needed
- **URL-based verification** — no wallet required for verifiers
- **QR code on PDF** — scan and verify instantly

---

## Architecture

```
Smart Contract (Ethereum Sepolia)
  → Merkle root per batch
  → Issuer registry
  → On-chain revocation
  → Multisig proposal/approval flow

Supabase (PostgreSQL)
  → Batch metadata
  → Student proof data (saved only after full execution)
  → Pending batches (multisig staging)
  → Hash-based certificate lookup

React Frontend (Vercel)
  → PDF certificate generation with QR code
  → Three verification modes: hash, details, QR scan
  → Pending proposals UI for second approver
  → Admin panel for issuer management
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity 0.8.19, Hardhat |
| Blockchain | Ethereum Sepolia Testnet |
| Frontend | React, ethers.js, Material UI |
| Database | Supabase (PostgreSQL) |
| PDF Generation | jsPDF, QRCode |
| Hosting | Vercel |

---

## Key Features

### Merkle Tree Batching
Each batch of certificates is hashed into a Merkle tree. Only the root is stored on chain — one transaction covers any number of students. O(log n) verification complexity. Changing any single certificate detail changes the root — tamper detection built in.

### Multisig Approval (2-of-N)
Mirrors real university governance:
- Registrar proposes a batch
- Academic Dean approves it
- Neither can complete the process alone
- Same wallet cannot propose and approve the same batch
- Configurable threshold — set to 1 for single approval, 2 for 2-of-2

### Three Verification Modes
1. **By Hash** — paste the 66-character cert hash from the PDF, no other details needed
2. **By Details** — enter batch ID, name, degree, university, year
3. **QR Scan** — scan QR code on PDF, page opens and auto-verifies instantly

### Secure Proof Storage Flow
```
requiredApprovals = 1:
Propose → BatchExecuted → save to Supabase immediately

requiredApprovals = 2:
Propose → save to pending_batches only
Second approval → BatchExecuted → move to batches + proofs → delete from pending
```
Proofs are never accessible for verification until the batch is fully executed on chain.

### Certificate Hash
Each certificate hash is computed as:
```
keccak256(batchId + name + degree + university + year)
```
- Batch ID is included so the same student in different batches has a unique hash
- All inputs are lowercased and trimmed before hashing
- Hash is 66 characters starting with 0x

---

## Smart Contract

**CertificateRegistry.sol** deployed at:  
`0x42e828cafB2ffF70900C6A3f1D5AE970E4b279C1` on Sepolia

| Function | Description |
|----------|-------------|
| `proposeBatch(batchId, merkleRoot)` | Propose a new batch (any approved issuer) |
| `approveBatch(proposalId)` | Approve a pending proposal (different issuer required) |
| `revokeBatch(batchId, reason)` | Revoke an entire batch on chain |
| `verifyCertificate(batchId, certHash)` | Verify a certificate — free, no gas, view only |
| `addIssuer(address)` | Add approved issuer (owner only) |
| `setRequiredApprovals(n)` | Set multisig threshold (owner only) |

---

## How It Works

### Issuing a Certificate

1. Institution connects MetaMask wallet (must be approved issuer)
2. Enters student details — name, degree, university, year
3. Frontend computes hash for each student: `keccak256(batchId + name + degree + university + year)`
4. Builds Merkle tree from all hashes
5. Calls `proposeBatch(batchId, merkleRoot)` on chain
6. If requiredApprovals = 1 → executes immediately
7. If requiredApprovals = 2 → second approver connects, loads pending proposals, approves
8. `BatchExecuted` event fires → proofs saved to Supabase
9. PDF certificates generated with QR codes for each student

### Verifying a Certificate

1. Verifier pastes cert hash from PDF or scans QR code
2. Frontend queries Supabase for proof by hash
3. Calls `verifyCertificate(batchId, certHash)` on chain — checks batch exists and is not revoked
4. Verifies Merkle proof locally — confirms certificate is part of the batch
5. Shows ✓ VALID or ✗ INVALID with student details

### Revocation

1. Approved issuer calls `revokeBatch(batchId, reason)` on chain
2. All certificates in that batch immediately return REVOKED on verification
3. Revocation reason is stored permanently on chain
4. Cannot be undone — mirrors real world where fraudulent degrees are permanently flagged

---

## Comparison With Existing Systems

| Feature | CertVerify | Blockcerts | BCdiploma | Accredify |
|---------|-----------|------------|-----------|-----------|
| No wallet for verifier | ✓ | ✗ | ✓ | ✓ |
| On-chain revocation | ✓ | ✗ | Partial | ✗ |
| Multisig approval | ✓ | ✗ | ✗ | ✗ |
| Merkle batching | ✓ | ✓ | ✓ | ✗ |
| Open source | ✓ | ✓ | ✗ | ✗ |
| Hash-based verification | ✓ | ✗ | ✗ | ✗ |
| QR code on certificate | ✓ | ✗ | ✓ | ✓ |

---

## Known Limitations

| Limitation | Production Fix |
|-----------|---------------|
| Proof storage in Supabase (centralized) | IPFS + Filecoin for decentralized backup |
| Contract not upgradeable | OpenZeppelin proxy upgrade pattern |
| Single network — Sepolia testnet only | Multi-chain deployment on mainnet + L2s |
| No formal security audit | Professional audit before mainnet deployment |
| GDPR tension with blockchain immutability | Encrypted IPFS + cryptographic erasure |
| Key compromise window | Hardware wallets + time-locked transactions |

---

## Local Setup

```bash
# Clone the repository
git clone https://github.com/gantaaman007/cert-verify.git
cd cert-verify

# Install contract dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..

# Create .env file in root directory
# Add the following:
PRIVATE_KEY=your_wallet_private_key
SEPOLIA_RPC_URL=your_alchemy_rpc_url

# Compile the smart contract
npx hardhat compile

# Deploy to Sepolia
npx hardhat run scripts/deploy.js --network sepolia

# Update CONTRACT_ADDRESS in frontend/src/contract.js with new address

# Run the frontend locally
cd frontend
npm start
```

---

## Project Structure

```
cert-verify/
├── contracts/
│   └── CertificateRegistry.sol    # Smart contract
├── scripts/
│   └── deploy.js                  # Deployment script
├── hardhat.config.js              # Hardhat configuration
├── frontend/
│   └── src/
│       ├── App.js                 # Main React application
│       ├── contract.js            # ABI and contract address
│       ├── db.js                  # Supabase database helpers
│       ├── supabase.js            # Supabase client
│       └── utils/
│           └── merkle.js          # Merkle tree utilities
└── README.md
```

---

## Supabase Schema

```sql
-- Issued batches
batches: id, batch_id, merkle_root, issued_by, issued_at, is_revoked, revoke_reason

-- Certificate proofs
proofs: id, batch_id, student_name, degree, university, year, leaf, proof_index, cert_hash

-- Multisig staging
pending_batches: id, proposal_id, batch_id, merkle_root, proposed_by, students, leaves, created_at
```

---

## Author

**Ganta Aman Reddy**  
MS Computer Science — Auburn University at Montgomery  
Blockchain Specialization  

GitHub: [@gantaaman007](https://github.com/gantaaman007)  
Project: [cert-verify](https://github.com/gantaaman007/cert-verify)

---

## License

MIT License — free to use, modify, and distribute.