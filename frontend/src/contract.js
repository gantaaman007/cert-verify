export const CONTRACT_ADDRESS = "0xF669E0d06cEC1F9eF3BFbCEa0dC29b719716633E";

export const CONTRACT_ABI = [
  "function addIssuer(address _issuer) external",
  "function removeIssuer(address _issuer) external",
  "function setPaused(bool _state) external",
  "function issueBatch(string calldata _batchId, bytes32 _merkleRoot) external",
  "function revokeBatch(string calldata _batchId, string calldata _reason) external",
  "function revokeCertificate(bytes32 _certHash, string calldata _reason) external",
  "function verifyCertificate(string calldata _batchId, bytes32 _certHash) external view returns (bool valid, bool revoked, string memory reason, bytes32 merkleRoot, uint256 issuedAt, address issuedBy)",
  "function getBatch(string calldata _batchId) external view returns (tuple(bytes32 merkleRoot, uint256 issuedAt, address issuedBy, bool isRevoked, string revokeReason))",
  "function isIssuer(address _addr) external view returns (bool)",
  "function owner() external view returns (address)",
  "function totalBatches() external view returns (uint256)",
  "function paused() external view returns (bool)",
  "event BatchIssued(string indexed batchId, bytes32 merkleRoot, address indexed issuedBy, uint256 issuedAt)",
  "event BatchRevoked(string indexed batchId, address revokedBy, string reason, uint256 timestamp)",
  "event CertRevoked(bytes32 indexed certHash, address revokedBy, string reason, uint256 timestamp)",
  "event IssuerAdded(address indexed issuer, address addedBy, uint256 timestamp)",
  "event IssuerRemoved(address indexed issuer, address removedBy, uint256 timestamp)"
];