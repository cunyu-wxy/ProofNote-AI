const hre = require("hardhat");

async function main() {
  if (hre.network.name !== "hardhat" && !process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required for non-local deployments.");
  }

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log(`Deploying ProofNoteRegistry to ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} 0G`);

  const ProofNoteRegistry = await hre.ethers.getContractFactory(
    "ProofNoteRegistry"
  );
  const registry = await ProofNoteRegistry.deploy();

  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();

  console.log(`ProofNoteRegistry deployed: ${registryAddress}`);
  console.log(`Paste ${registryAddress} into the app Runtime Settings panel.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
