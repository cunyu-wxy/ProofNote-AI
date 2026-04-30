const hre = require("hardhat");

async function main() {
  if (hre.network.name !== "hardhat" && !process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required for non-local deployments.");
  }

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log(`Deploying ProofNoteRegistry to ${hre.network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} A0GI`);

  const ProofNoteRegistry = await hre.ethers.getContractFactory(
    "ProofNoteRegistry"
  );
  const registry = await ProofNoteRegistry.deploy();

  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();

  console.log(`ProofNoteRegistry deployed: ${registryAddress}`);
  console.log(
    `Set NEXT_PUBLIC_PROOFNOTE_REGISTRY_ADDRESS=${registryAddress} in apps/web/.env.local`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
