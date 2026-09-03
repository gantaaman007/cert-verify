import { ethers } from "ethers";

export function hashCertificate(cert) {
  return ethers.solidityPackedKeccak256(
    ["string", "string", "string", "uint256"],
    [cert.name.trim(), cert.degree.trim(), cert.university.trim(), cert.year]
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
  for (const proofElement of proof) {
    const combined = [computed, proofElement].sort();
    computed = ethers.solidityPackedKeccak256(
      ["bytes32", "bytes32"],
      [combined[0], combined[1]]
    );
  }
  return computed === root;
}