const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const requiredApprovals = 1;

  const CertificateRegistry = await hre.ethers.getContractFactory("CertificateRegistry");
  const registry = await CertificateRegistry.deploy(requiredApprovals);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("CertificateRegistry deployed to:", address);
  console.log("Required approvals set to:", requiredApprovals);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});