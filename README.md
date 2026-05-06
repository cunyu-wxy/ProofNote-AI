# ProofNote AI

ProofNote AI is a verifiable AI report generator built for the 0G APAC Hackathon. Users upload a `.txt` or `.md` source document, generate a structured AI report, upload both artifacts to 0G Storage, and record the resulting root hashes on 0G Chain through `ProofNoteRegistry`.

## Submission Links

- GitHub repo: TBD
- Demo video: TBD
- 0G contract address: TBD
- 0G Explorer transaction: TBD
- X post: TBD

## Project Overview

AI-generated reports are useful only when readers can verify what source material was used and whether the generated result was preserved unchanged. ProofNote AI creates a simple proof trail:

1. The source document is uploaded to 0G Storage.
2. The generated report JSON is uploaded to 0G Storage.
3. The source and report root hashes are recorded on 0G Chain.
4. A verifier can read the registry record by report ID and compare the stored roots.

The MVP focuses on verifiable persistence and traceability. It does not introduce accounts, payments, tokens, NFTs, or database state.

## Architecture

```mermaid
flowchart TD
  User[User Browser] --> Upload[Upload .txt or .md source]
  Upload --> Web[Next.js Web App]
  User --> Runtime[Runtime Settings in sessionStorage]
  Runtime --> Web
  Web --> Api[POST /api/generate-report]
  Api --> OpenAI[OpenAI-compatible Responses API]
  Api --> Mock[Mock fallback when API key is missing]
  OpenAI --> Report[Structured Report JSON]
  Mock --> Report
  Report --> StorageClient[0G Storage SDK in Browser]
  Upload --> StorageClient
  StorageClient --> ZGStorage[0G Storage]
  ZGStorage --> Roots[sourceRootHash and reportRootHash]
  Roots --> Wallet[Wallet Signature]
  Wallet --> Registry[ProofNoteRegistry on 0G Chain]
  Registry --> Verify[/verify page]
  Verify --> Reader[Verifier reads title, owner, roots, timestamp]
```

## 0G Components

- **0G Storage**: Stores the original source text and generated report JSON as verifiable artifacts. The app uses the official `@0gfoundation/0g-ts-sdk` browser entrypoint so uploads are signed by the user's wallet.
- **0G Chain**: Stores the proof record in `ProofNoteRegistry`, including title, source root hash, report root hash, metadata root hash, owner, and timestamp.
- **0G Explorer**: Used for transaction and contract links after upload and registry recording.
- **0G Storage Explorer**: Optional link target for root hash inspection when `NEXT_PUBLIC_OG_STORAGE_EXPLORER_URL` is configured.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Solidity
- Hardhat
- ethers
- 0G TypeScript SDK
- Request-scoped OpenAI-compatible API proxy with Responses and Chat Completions fallback

## Project Structure

```text
apps/web/                               Next.js app
apps/web/app/api/generate-report/       Request-scoped report generation route
apps/web/app/verify/                    On-chain report verification page
apps/web/lib/reportGenerator.ts         Frontend report generation client
apps/web/lib/runtimeConfig.ts           Browser session runtime config
apps/web/lib/og/storage.ts              0G Storage upload abstraction
apps/web/lib/og/registry.ts             0G Chain registry interaction abstraction
apps/web/lib/contracts/                 Frontend ABI exports
contracts/ProofNoteRegistry.sol         Registry smart contract
scripts/deploy-proofnote-registry.js    0G Chain deployment script
PROJECT_SPEC.md                         MVP specification
```

## Local Deployment

Enable pnpm with Corepack if `pnpm` is not available:

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

If your Node installation cannot write global shims, install them in your user path:

```bash
mkdir -p ~/.local/bin
corepack enable --install-directory ~/.local/bin
```

Install dependencies:

```bash
pnpm install
```

Create environment files:

```bash
cp .env.example apps/web/.env.local
cp .env.example .env
```

Configure the web app in `apps/web/.env.local`:

```bash
NEXT_PUBLIC_OG_CHAIN_ID=16602
NEXT_PUBLIC_OG_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_OG_STORAGE_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
NEXT_PUBLIC_OG_FLOW_ADDRESS=0x22e03a6a89b950f1c82ec5e74f8eca321a105296
NEXT_PUBLIC_OG_EXPLORER_URL=https://chainscan-galileo.0g.ai
NEXT_PUBLIC_OG_STORAGE_EXPLORER_URL=https://storagescan-galileo.0g.ai
NEXT_PUBLIC_OG_STORAGE_GAS_LIMIT=500000
```

Run the app:

```bash
pnpm dev
```

Open `http://localhost:3000`.

Build locally:

```bash
pnpm build
```

## Smart Contract Deployment

Compile the contract:

```bash
pnpm hardhat compile
```

Configure `.env` for deployment:

```bash
OG_CHAIN_ID=16602
OG_RPC_URL=https://evmrpc-testnet.0g.ai
DEPLOYER_PRIVATE_KEY=0x...
```

Deploy `ProofNoteRegistry` to 0G Chain:

```bash
pnpm deploy:og
```

Copy the printed contract address into the app's `Runtime Settings` panel.

## Demo Flow

1. Open the app at `http://localhost:3000`.
2. Enter `Runtime Settings`: OpenAI-compatible base URL, model, API key, expected wallet address, and registry contract address. Use the refresh button beside `Model` to load provider model IDs from `/models`.
3. Upload a `.txt` or `.md` source document.
4. Enter a report instruction.
5. Generate a structured report JSON.
6. Connect a wallet with 0G Galileo testnet 0G.
7. Click `Upload and record proof`.
8. Confirm 0G Storage upload transactions in the wallet.
9. Confirm the `recordReport()` transaction.
10. Copy the report ID or transaction details.
11. Open `/verify`, enter the registry contract address and report ID, then inspect the on-chain proof record.

## Smart Contract

`ProofNoteRegistry` stores report metadata on chain:

- `recordReport(title, sourceRootHash, reportRootHash, metadataRootHash)`
- `getReport(id)`
- `getReportCount()`

Event:

```solidity
ReportRecorded(
  id,
  owner,
  title,
  sourceRootHash,
  reportRootHash,
  metadataRootHash,
  createdAt
)
```

## Report JSON Schema

```json
{
  "title": "string",
  "summary": "string",
  "key_points": ["string"],
  "risks": [
    {
      "level": "low | medium | high",
      "description": "string",
      "evidence": "string"
    }
  ],
  "conclusion": "string"
}
```

## Verification

The `/verify` page reads `ProofNoteRegistry.getReport(id)` from the configured contract and displays:

- title
- owner
- sourceRootHash
- reportRootHash
- metadataRootHash
- createdAt
- contract and explorer links
- simple verification result card

## Known Limitations

- Only `.txt` and `.md` source files are supported.
- No PDF, image, or rich document parsing yet.
- The report generator sends request-scoped provider settings to the local API route and falls back to a mock report when no API key is entered.
- Runtime API keys are not written to `.env`, committed to the repo, or stored by the server.
- The MVP does not download and compare 0G Storage file contents on the verify page yet.
- Large 0G Storage uploads that fragment into multiple roots are not displayed as multi-root proofs yet.
- `metadataRootHash` currently reuses the report root until a dedicated metadata artifact is added.
- No database, user accounts, payments, tokens, NFTs, or access control.
- Browser wallet and testnet 0G are required for real storage and registry transactions.

## Troubleshooting

- `could not decode result data ... market()` means the wallet RPC returned empty data for the 0G Storage Flow contract. In MetaMask, edit the `0G-Testnet-Galileo` network RPC URL to `https://evmrpc-testnet.0g.ai`, confirm chain ID `16602`, and make sure the domain uses the digit `0` in `0g.ai`, not the letter `O`.
- If MetaMask warns that the native token symbol does not match, use `0G` for Galileo. `A0GI` was used by older 0G testnet references and should not be used for `Chain ID 16602`.
- If MetaMask reports `insufficient funds` while the 0G balance is visible, keep `NEXT_PUBLIC_OG_STORAGE_GAS_LIMIT=500000` so the wallet does not re-estimate the 0G Storage transaction against a stale RPC view.
- If storage upload still fails, check `NEXT_PUBLIC_OG_STORAGE_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai` and `NEXT_PUBLIC_OG_FLOW_ADDRESS=0x22e03a6a89b950f1c82ec5e74f8eca321a105296`.
- If report generation fails with provider errors, check the Runtime Settings base URL, model, and API key. The app tries `/responses` first, then falls back to `/chat/completions` when the provider does not support Responses.
- If the provider says `Not supported model`, load models with the refresh button beside `Model` and select an exact returned model ID.
- API keys and wallet addresses are entered in the web UI and stored only in browser `sessionStorage`; the API key is used only for the current local API route request.

## Useful Commands

```bash
pnpm dev
pnpm build
pnpm --filter @proofnote/web lint
pnpm --filter @proofnote/web exec tsc --noEmit
pnpm hardhat compile
pnpm deploy:og
```
