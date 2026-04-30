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
  Web --> Api[POST /api/generate-report]
  Api --> OpenAI[OpenAI API]
  Api --> Mock[Mock fallback when OPENAI_API_KEY is missing]
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
- OpenAI API with local mock fallback

## Project Structure

```text
apps/web/                               Next.js app
apps/web/app/api/generate-report/       Server-side report generation route
apps/web/app/verify/                    On-chain report verification page
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
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
NEXT_PUBLIC_OG_CHAIN_ID=16602
NEXT_PUBLIC_OG_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_OG_STORAGE_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
NEXT_PUBLIC_OG_EXPLORER_URL=https://chainscan-galileo.0g.ai
NEXT_PUBLIC_OG_STORAGE_EXPLORER_URL=
NEXT_PUBLIC_PROOFNOTE_REGISTRY_ADDRESS=
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

Copy the printed contract address into `apps/web/.env.local`:

```bash
NEXT_PUBLIC_PROOFNOTE_REGISTRY_ADDRESS=0x...
```

Restart `pnpm dev` after changing public environment variables.

## Demo Flow

1. Open the app at `http://localhost:3000`.
2. Upload a `.txt` or `.md` source document.
3. Enter a report instruction.
4. Generate a structured report JSON.
5. Connect a wallet with 0G Galileo testnet A0GI.
6. Click `Upload and record proof`.
7. Confirm 0G Storage upload transactions in the wallet.
8. Confirm the `recordReport()` transaction.
9. Copy the report ID or transaction details.
10. Open `/verify`, enter the report ID, and inspect the on-chain proof record.

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
- The report generator uses OpenAI when configured and a mock fallback otherwise.
- The MVP does not download and compare 0G Storage file contents on the verify page yet.
- Large 0G Storage uploads that fragment into multiple roots are not displayed as multi-root proofs yet.
- `metadataRootHash` currently reuses the report root until a dedicated metadata artifact is added.
- No database, user accounts, payments, tokens, NFTs, or access control.
- Browser wallet and testnet A0GI are required for real storage and registry transactions.

## Useful Commands

```bash
pnpm dev
pnpm build
pnpm --filter @proofnote/web lint
pnpm --filter @proofnote/web exec tsc --noEmit
pnpm hardhat compile
pnpm deploy:og
```
