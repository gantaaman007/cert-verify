// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CertificateRegistry {

    address public owner;
    uint256 public totalBatches;
    bool public paused;
    uint256 public requiredApprovals;

    struct Batch {
        bytes32 merkleRoot;
        uint256 issuedAt;
        address issuedBy;
        bool isRevoked;
        string revokeReason;
    }

    struct Proposal {
        string batchId;
        bytes32 merkleRoot;
        address proposedBy;
        uint256 approvalCount;
        bool executed;
        mapping(address => bool) approved;
    }

    mapping(string => Batch) public batches;
    mapping(address => bool) public approvedIssuers;
    mapping(bytes32 => bool) public revokedCerts;
    mapping(string => bool) private batchExists;
    mapping(uint256 => Proposal) private proposals;
    uint256 public proposalCount;

    event BatchIssued(string indexed batchId, bytes32 merkleRoot, address indexed issuedBy, uint256 issuedAt);
    event BatchRevoked(string indexed batchId, address revokedBy, string reason, uint256 timestamp);
    event CertRevoked(bytes32 indexed certHash, address revokedBy, string reason, uint256 timestamp);
    event IssuerAdded(address indexed issuer, address addedBy, uint256 timestamp);
    event IssuerRemoved(address indexed issuer, address removedBy, uint256 timestamp);
    event BatchProposed(uint256 indexed proposalId, string batchId, bytes32 merkleRoot, address proposedBy);
    event BatchApproved(uint256 indexed proposalId, address approvedBy, uint256 approvalCount);
    event BatchExecuted(uint256 indexed proposalId, string batchId);

    constructor(uint256 _requiredApprovals) {
        owner = msg.sender;
        paused = false;
        requiredApprovals = _requiredApprovals;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "CertRegistry: caller is not the owner");
        _;
    }

    modifier onlyIssuer() {
        require(approvedIssuers[msg.sender], "CertRegistry: caller is not an approved issuer");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "CertRegistry: contract is paused");
        _;
    }

    function addIssuer(address _issuer) external onlyOwner {
        require(_issuer != address(0), "CertRegistry: invalid address");
        require(!approvedIssuers[_issuer], "CertRegistry: already an issuer");
        approvedIssuers[_issuer] = true;
        emit IssuerAdded(_issuer, msg.sender, block.timestamp);
    }

    function removeIssuer(address _issuer) external onlyOwner {
        require(approvedIssuers[_issuer], "CertRegistry: not an issuer");
        approvedIssuers[_issuer] = false;
        emit IssuerRemoved(_issuer, msg.sender, block.timestamp);
    }

    function setPaused(bool _state) external onlyOwner {
        paused = _state;
    }

    function setRequiredApprovals(uint256 _required) external onlyOwner {
        require(_required > 0, "CertRegistry: must require at least 1");
        requiredApprovals = _required;
    }

    function proposeBatch(string calldata _batchId, bytes32 _merkleRoot)
        external
        onlyIssuer
        whenNotPaused
        returns (uint256)
    {
        require(!batchExists[_batchId], "CertRegistry: batch ID already exists");
        require(_merkleRoot != bytes32(0), "CertRegistry: merkle root cannot be zero");

        uint256 proposalId = proposalCount++;
        Proposal storage p = proposals[proposalId];
        p.batchId     = _batchId;
        p.merkleRoot  = _merkleRoot;
        p.proposedBy  = msg.sender;
        p.approvalCount = 1;
        p.executed    = false;
        p.approved[msg.sender] = true;

        emit BatchProposed(proposalId, _batchId, _merkleRoot, msg.sender);
        emit BatchApproved(proposalId, msg.sender, 1);

        if (requiredApprovals == 1) {
            _executeBatch(proposalId);
        }

        return proposalId;
    }

    function approveBatch(uint256 _proposalId)
        external
        onlyIssuer
        whenNotPaused
    {
        Proposal storage p = proposals[_proposalId];
        require(!p.executed, "CertRegistry: already executed");
        require(!p.approved[msg.sender], "CertRegistry: already approved");
        require(!batchExists[p.batchId], "CertRegistry: batch already exists");

        p.approved[msg.sender] = true;
        p.approvalCount++;

        emit BatchApproved(_proposalId, msg.sender, p.approvalCount);

        if (p.approvalCount >= requiredApprovals) {
            _executeBatch(_proposalId);
        }
    }

    function _executeBatch(uint256 _proposalId) internal {
        Proposal storage p = proposals[_proposalId];
        require(!p.executed, "CertRegistry: already executed");

        p.executed = true;
        batchExists[p.batchId] = true;

        batches[p.batchId] = Batch({
            merkleRoot:   p.merkleRoot,
            issuedAt:     block.timestamp,
            issuedBy:     p.proposedBy,
            isRevoked:    false,
            revokeReason: ""
        });

        totalBatches++;
        emit BatchExecuted(_proposalId, p.batchId);
        emit BatchIssued(p.batchId, p.merkleRoot, p.proposedBy, block.timestamp);
    }

    function revokeBatch(string calldata _batchId, string calldata _reason)
        external
        onlyIssuer
    {
        require(batchExists[_batchId], "CertRegistry: batch does not exist");
        Batch storage b = batches[_batchId];
        require(!b.isRevoked, "CertRegistry: batch already revoked");
        b.isRevoked = true;
        b.revokeReason = _reason;
        emit BatchRevoked(_batchId, msg.sender, _reason, block.timestamp);
    }

    function revokeCertificate(bytes32 _certHash, string calldata _reason)
        external
        onlyIssuer
    {
        require(_certHash != bytes32(0), "CertRegistry: invalid cert hash");
        require(!revokedCerts[_certHash], "CertRegistry: certificate already revoked");
        revokedCerts[_certHash] = true;
        emit CertRevoked(_certHash, msg.sender, _reason, block.timestamp);
    }

    function verifyCertificate(string calldata _batchId, bytes32 _certHash)
        external
        view
        returns (
            bool    valid,
            bool    revoked,
            string  memory reason,
            bytes32 merkleRoot,
            uint256 issuedAt,
            address issuedBy
        )
    {
        if (!batchExists[_batchId]) {
            return (false, false, "Batch not found", bytes32(0), 0, address(0));
        }
        Batch memory b = batches[_batchId];
        if (b.isRevoked) {
            return (false, true, b.revokeReason, b.merkleRoot, b.issuedAt, b.issuedBy);
        }
        if (revokedCerts[_certHash]) {
            return (false, true, "Certificate individually revoked", b.merkleRoot, b.issuedAt, b.issuedBy);
        }
        return (true, false, "", b.merkleRoot, b.issuedAt, b.issuedBy);
    }

    function getBatch(string calldata _batchId)
        external
        view
        returns (Batch memory)
    {
        return batches[_batchId];
    }

    function getProposal(uint256 _proposalId)
        external
        view
        returns (
            string memory batchId,
            bytes32 merkleRoot,
            address proposedBy,
            uint256 approvalCount,
            bool executed
        )
    {
        Proposal storage p = proposals[_proposalId];
        return (p.batchId, p.merkleRoot, p.proposedBy, p.approvalCount, p.executed);
    }

    function hasApproved(uint256 _proposalId, address _issuer)
        external
        view
        returns (bool)
    {
        return proposals[_proposalId].approved[_issuer];
    }

    function isIssuer(address _addr)
        external
        view
        returns (bool)
    {
        return approvedIssuers[_addr];
    }
}