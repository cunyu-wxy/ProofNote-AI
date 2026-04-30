require("dotenv").config({ quiet: true });
require("@nomicfoundation/hardhat-ethers");

const ogChainId = Number(
  process.env.OG_CHAIN_ID ?? process.env.NEXT_PUBLIC_OG_CHAIN_ID ?? 16602
);
const ogRpcUrl =
  process.env.OG_RPC_URL ??
  process.env.NEXT_PUBLIC_OG_RPC_URL ??
  "https://evmrpc-testnet.0g.ai";
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;

/** @type {import("hardhat/config").HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    ogGalileo: {
      url: ogRpcUrl,
      chainId: ogChainId,
      accounts: deployerPrivateKey ? [deployerPrivateKey] : []
    }
  }
};
