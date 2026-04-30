# ProofNote AI - Project Spec

## Goal

Build a verifiable AI report generator for the 0G APAC Hackathon.

Users upload a source document. The app generates an AI report, uploads both the source document and report to 0G Storage, then records the storage root hashes on 0G Chain.

## MVP User Flow

1. User connects wallet.
2. User uploads a .txt or .md file.
3. User enters a report instruction.
4. App generates a structured AI report.
5. App uploads the source file to 0G Storage.
6. App uploads the generated report JSON to 0G Storage.
7. App calls the ProofNoteRegistry smart contract.
8. App displays:
   - sourceRootHash
   - reportRootHash
   - transaction hash
   - contract address
   - 0G Explorer link

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Solidity
- Hardhat
- ethers or viem
- 0G Storage TypeScript SDK

## Non-goals

- No PDF support in MVP.
- No user account system.
- No database.
- No payment system.
- No complex access control.
- No token.
- No NFT.
- No DeFi.

## Smart Contract

Contract name: ProofNoteRegistry

Functions:
- recordReport(title, sourceRootHash, reportRootHash, metadataRootHash)
- getReport(id)
- getReportCount()

Events:
- ReportRecorded(id, owner, title, sourceRootHash, reportRootHash, metadataRootHash, createdAt)

## Report JSON Schema

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

## Acceptance Criteria

- App runs with `pnpm dev`.
- Contract compiles with `pnpm hardhat compile`.
- User can upload a .txt or .md file.
- User can generate a report.
- User can upload source and report to 0G Storage.
- User can record hashes on 0G Chain.
- UI displays root hashes and transaction hash.
- README explains local setup and 0G integration.