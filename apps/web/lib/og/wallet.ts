import type { JsonRpcSigner } from "ethers";

export async function assertExpectedSignerAddress({
  signer,
  expectedWalletAddress,
  getAddress,
  isAddress
}: {
  signer: JsonRpcSigner;
  expectedWalletAddress?: string;
  getAddress: (address: string) => string;
  isAddress: (address: string) => boolean;
}) {
  const expectedAddress = expectedWalletAddress?.trim();

  if (!expectedAddress) {
    return;
  }

  if (!isAddress(expectedAddress)) {
    throw new Error("Configured wallet address is not a valid EVM address.");
  }

  const connectedAddress = await signer.getAddress();

  if (getAddress(connectedAddress) !== getAddress(expectedAddress)) {
    throw new Error(
      `Connected wallet ${connectedAddress} does not match configured wallet ${expectedAddress}.`
    );
  }
}
