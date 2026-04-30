# ProofNote AI

ProofNote AI is a verifiable report workflow for the 0G APAC Hackathon. The current repository contains the local Next.js app and the Solidity registry contract. 0G Storage integration is intentionally not implemented yet.

## Stack

- Next.js, TypeScript, Tailwind CSS
- Solidity, Hardhat
- viem for EVM address utilities
- pnpm workspaces

## Project Structure

```text
apps/web/                 Next.js web app
contracts/                Solidity contracts
contracts/ProofNoteRegistry.sol
PROJECT_SPEC.md           Product and MVP notes
```

## Local Setup

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

Create local environment files:

```bash
cp .env.example apps/web/.env.local
cp .env.example .env
```

Set `OPENAI_API_KEY` in `apps/web/.env.local` to enable server-side OpenAI report generation. If it is not set, `/api/generate-report` falls back to local mock report generation.

The app uploads generated artifacts to 0G Storage from the browser with the connected wallet. Configure these public values in `apps/web/.env.local`:

```bash
NEXT_PUBLIC_OG_CHAIN_ID=16602
NEXT_PUBLIC_OG_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_OG_STORAGE_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
NEXT_PUBLIC_OG_EXPLORER_URL=https://chainscan-galileo.0g.ai
```

Your wallet must hold testnet A0GI for upload fees.

Run the web app:

```bash
pnpm dev
```

Open `http://localhost:3000`.

Build the web app:

```bash
pnpm build
```

Compile contracts:

```bash
pnpm hardhat compile
```

## Smart Contract

`ProofNoteRegistry` stores report metadata on chain:

- `recordReport(title, sourceRootHash, reportRootHash, metadataRootHash)`
- `getReport(id)`
- `getReportCount()`

The contract emits `ReportRecorded(id, owner, title, sourceRootHash, reportRootHash, metadataRootHash, createdAt)` for every recorded report.

## Current MVP Behavior

The web app can load `.txt` and `.md` files, read the file content in the browser, send `title`, `sourceText`, and `instruction` to `POST /api/generate-report`, and display a structured report matching the schema in `PROJECT_SPEC.md`. The OpenAI API key is read only by the server route and is never exposed to the browser. After report generation, the browser can upload both the original source text and report JSON to 0G Storage and display `sourceRootHash`, `reportRootHash`, `sourceTxHash`, and `reportTxHash`.

On-chain registry writes are left for the next implementation phase.
