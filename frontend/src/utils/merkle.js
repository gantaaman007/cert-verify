import { ethers } from "ethers";

export function hashCertificate(cert, batchId = "") {
  return ethers.solidityPackedKeccak256(
    ["string", "string", "string", "string", "uint256"],
    [
      batchId.trim().toLowerCase(),
      cert.name.trim().toLowerCase(),
      cert.degree.trim().toLowerCase(),
      cert.university.trim().toLowerCase(),
      cert.year
    ]
  );
}

export function buildMerkleTree(leaves) {
  if (leaves.length === 0) return { root: ethers.ZeroHash, tree: [] };
  let layer = [...leaves];
  if (layer.length % 2 !== 0) layer.push(layer[layer.length - 1]);
  const tree = [layer];
  while (layer.length > 1) {
    const nextLayer = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left  = layer[i];
      const right = layer[i + 1] || layer[i];
      const combined = [left, right].sort();
      const parent = ethers.solidityPackedKeccak256(
        ["bytes32", "bytes32"],
        [combined[0], combined[1]]
      );
      nextLayer.push(parent);
    }
    layer = nextLayer;
    tree.push(layer);
  }
  return { root: layer[0], tree };
}

export function getMerkleProof(leaves, index) {
  let layer = [...leaves];
  if (layer.length % 2 !== 0) layer.push(layer[layer.length - 1]);
  const proof = [];
  let idx = index;
  while (layer.length > 1) {
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (siblingIdx < layer.length) proof.push(layer[siblingIdx]);
    const nextLayer = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left  = layer[i];
      const right = layer[i + 1] || layer[i];
      const combined = [left, right].sort();
      const parent = ethers.solidityPackedKeccak256(
        ["bytes32", "bytes32"],
        [combined[0], combined[1]]
      );
      nextLayer.push(parent);
    }
    layer = nextLayer;
    idx = Math.floor(idx / 2);
  }
  return proof;
}

export function verifyMerkleProof(leaf, proof, root) {
  let computed = leaf;

  if (proof.length === 0) {
    const combined = [computed, computed].sort();
    computed = ethers.solidityPackedKeccak256(
      ["bytes32", "bytes32"],
      [combined[0], combined[1]]
    );
    return computed.toLowerCase() === root.toLowerCase();
  }

  for (const proofElement of proof) {
    const combined = [computed, proofElement].sort();
    computed = ethers.solidityPackedKeccak256(
      ["bytes32", "bytes32"],
      [combined[0], combined[1]]
    );
  }
  return computed.toLowerCase() === root.toLowerCase();
}