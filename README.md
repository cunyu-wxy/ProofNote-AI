# ProofNote AI

ProofNote AI is a verifiable AI report generator for the 0G APAC Hackathon.
It turns a text-based source document into a structured AI report, uploads both
artifacts to 0G Storage, and records their root hashes on 0G Chain.

ProofNote does not prove that an AI report is legally or factually correct. It
proves that a specific source document and a specific report existed at a
specific time, and that later source changes can be detected by recomputing the
same 0G Storage root hash.

## Links

- GitHub repo: https://github.com/cunyu-wxy/ProofNote-AI
- Demo video: TBD
- 0G contract address: TBD
- 0G Explorer transaction: TBD
- X post: TBD

## What It Does

1. Upload a text-based source document in the browser.
2. Generate a structured report through an OpenAI-compatible API.
3. Upload the source text and report JSON to 0G Storage.
4. Write `sourceRootHash`, `reportRootHash`, and `metadataRootHash` to `ProofNoteRegistry`.
5. Verify a report by reading `getReport(id)` from 0G Chain.
6. Upload a local source file on `/verify` to recompute its 0G root hash and detect tampering.

## Architecture

```mermaid
flowchart TD
  User[Browser User] --> Web[Next.js App]
  Web --> Config[Runtime Settings<br/>sessionStorage only]
  Web --> API[POST /api/generate-report]
  API --> LLM[OpenAI-compatible Provider]
  API --> Mock[Mock fallback]
  LLM --> Report[Report JSON]
  Mock --> Report
  Web --> SDK[0G Storage SDK<br/>browser]
  SDK --> Storage[0G Storage]
  Storage --> Roots[Source and Report Root Hashes]
  Roots --> Wallet[Wallet Signature]
  Wallet --> Contract[ProofNoteRegistry<br/>0G Chain]
  Contract --> Verify[/verify Page]
  Verify --> HashCheck[Recompute Source Root Hash]
```

## Core Implementation

- `apps/web/app/page.tsx`: source upload, runtime settings, report generation, storage upload, and on-chain recording.
- `apps/web/app/verify/page.tsx`: reads registry records and checks whether a local source file matches `sourceRootHash`.
- `apps/web/app/api/generate-report/route.ts`: server-side report generation route; keeps API keys out of browser-exposed code.
- `apps/web/app/api/provider-models/route.ts`: loads provider model IDs from an OpenAI-compatible `/models` endpoint.
- `apps/web/lib/og/storage.ts`: 0G Storage abstraction for upload and root hash computation.
- `apps/web/lib/og/registry.ts`: `recordReport()` and `getReport()` frontend contract calls.
- `apps/web/lib/sourceFiles.ts`: supported source document extensions and MIME types.
- `contracts/ProofNoteRegistry.sol`: minimal on-chain registry contract.
- `scripts/deploy-proofnote-registry.js`: deployment script for 0G Galileo.

## 0G Usage

- **0G Storage**: stores the original source text and generated report JSON.
- **0G Storage root hash**: provides content integrity. If the source changes, the recomputed root hash will not match the chain record.
- **0G Chain**: stores durable proof records in `ProofNoteRegistry`.
- **0G Explorer / StorageScan**: provides transaction and storage submission links for demo verification.

## Environment

The app requires:

- Git
- Node.js LTS, Node 20 or newer
- pnpm `9.15.4`
- A browser wallet such as MetaMask for real 0G transactions

Use the command block for your operating system. Each block installs Git,
Node.js, pnpm, project dependencies, creates `apps/web/.env.local`, and starts
the local app.

### Windows 10/11 PowerShell

Run PowerShell as a normal user:

```powershell
$ErrorActionPreference = "Stop"
winget install -e --id Git.Git --accept-package-agreements --accept-source-agreements
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements

$machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;$machinePath;$userPath"

node --version
git --version

if (Get-Command corepack -ErrorAction SilentlyContinue) {
  corepack enable
  corepack prepare pnpm@9.15.4 --activate
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  winget install -e --id pnpm.pnpm --accept-package-agreements --accept-source-agreements
  $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "C:\Program Files\nodejs;C:\Program Files\Git\cmd;$machinePath;$userPath"
}

pnpm --version

if (-not (Test-Path ProofNote-AI)) {
  git clone https://github.com/cunyu-wxy/ProofNote-AI.git
}

Set-Location ProofNote-AI
git pull
pnpm install
Copy-Item .env.example apps\web\.env.local -Force
pnpm dev
```

Open `http://localhost:3000`.

If `node --version` still fails after `winget` finishes, close PowerShell and
run the same block again. Some Windows installations do not expose newly
installed PATH entries to the current terminal process.

The Windows flow intentionally uses `corepack` first and `winget pnpm` as a
fallback. It does not require `npm install -g pnpm`, so it avoids package
manager shims that intercept `npm` before Node.js is active.

### macOS Terminal

```bash
if ! command -v brew >/dev/null 2>&1; then
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"; fi
if [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)"; fi
brew install git node pnpm
if [ ! -d ProofNote-AI ]; then git clone https://github.com/cunyu-wxy/ProofNote-AI.git; fi
cd ProofNote-AI
git pull
pnpm --version
pnpm install
cp .env.example apps/web/.env.local
pnpm dev
```

Open `http://localhost:3000`.

### Linux Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
git --version
if command -v corepack >/dev/null 2>&1; then
  sudo corepack enable
  corepack prepare pnpm@9.15.4 --activate
fi
if ! command -v pnpm >/dev/null 2>&1; then
  sudo npm install -g pnpm@9.15.4
fi
pnpm --version
if [ ! -d ProofNote-AI ]; then git clone https://github.com/cunyu-wxy/ProofNote-AI.git; fi
cd ProofNote-AI
git pull
pnpm install
cp .env.example apps/web/.env.local
pnpm dev
```

Open `http://localhost:3000`.

## Web Configuration

`apps/web/.env.local` is already created by the setup commands. It should keep
the default 0G Galileo values:

```bash
NEXT_PUBLIC_OG_CHAIN_ID=16602
NEXT_PUBLIC_OG_CHAIN_NAME=0G-Testnet-Galileo
NEXT_PUBLIC_OG_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_OG_STORAGE_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
NEXT_PUBLIC_OG_FLOW_ADDRESS=0x22e03a6a89b950f1c82ec5e74f8eca321a105296
NEXT_PUBLIC_OG_EXPLORER_URL=https://chainscan-galileo.0g.ai
NEXT_PUBLIC_OG_STORAGE_EXPLORER_URL=https://storagescan-galileo.0g.ai
NEXT_PUBLIC_OG_STORAGE_GAS_LIMIT=500000
```

API keys, model names, expected wallet address, and registry contract address
are entered in the web UI at runtime. They are stored in browser
`sessionStorage`; they are not committed to the repo.

## Smart Contract Deployment

Create the root `.env` file.

Windows PowerShell:

```powershell
Copy-Item .env.example .env -Force
notepad .env
```

macOS / Linux:

```bash
cp .env.example .env
nano .env
```

Set these deployment values:

```bash
OG_CHAIN_ID=16602
OG_RPC_URL=https://evmrpc-testnet.0g.ai
DEPLOYER_PRIVATE_KEY=0x...
```

Then compile and deploy:

```bash
pnpm hardhat compile
pnpm deploy:og
```

Copy the printed `ProofNoteRegistry` address into the app's Runtime Settings.

## Demo Flow

1. Start the app with `pnpm dev`.
2. Open Runtime Settings and enter provider API settings, expected wallet address, and registry contract address.
3. Upload a supported source file.
4. Generate the report.
5. Click `Upload and record proof`.
6. Confirm two 0G Storage uploads and one `recordReport()` wallet transaction.
7. Open `/verify`, enter the contract address and report ID.
8. Upload the original source file again to recompute the 0G root hash.
9. Confirm whether the file shows `Matched` or `Mismatch`.

## Smart Contract API

```solidity
recordReport(
  string title,
  string sourceRootHash,
  string reportRootHash,
  string metadataRootHash
)

getReport(uint256 id)
getReportCount()
```

Each record stores:

- `title`
- `owner`
- `sourceRootHash`
- `reportRootHash`
- `metadataRootHash`
- `createdAt`

## Report Schema

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

## Verification Model

ProofNote verifies content integrity, not truthfulness:

- If a local source file recomputes to the same `sourceRootHash`, it matches the recorded source.
- If the recomputed root hash differs, the file was changed or is not the original source.
- A modified file can create a new proof record, but it cannot replace the old on-chain record.
- The AI report is a structured interpretation layer; the proof comes from 0G Storage root hashes and 0G Chain records.

## Known Limitations

- Supports text-readable source files: `.txt`, `.md`, `.csv`, `.json`, `.yaml`, `.xml`, `.html`, `.rtf`, `.log`, and related text MIME types.
- PDF, DOCX, images, and rich document parsing are not included yet.
- `metadataRootHash` currently reuses the report root.
- No database, user accounts, token gating, NFT minting, or payment flow.
- Multi-root fragmented uploads are not displayed as a combined proof yet.
- Testnet 0G and a browser wallet are required for real storage and registry transactions.

## Commands

```bash
pnpm dev
pnpm build
pnpm --filter @proofnote/web lint
pnpm --filter @proofnote/web exec tsc --noEmit
pnpm hardhat compile
pnpm deploy:og
```
