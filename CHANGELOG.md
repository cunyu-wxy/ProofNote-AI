# Changelog

## 2026-04-30

### Added

- Added ProofNoteRegistry deployment support for 0G Chain.
- Added frontend ABI export for `ProofNoteRegistry`.
- Added browser-side `recordReportOnChain()` for wallet-signed registry writes.
- Connected the app flow so successful 0G Storage uploads are recorded on chain.
- Added UI fields for registry transaction hash, contract address, and explorer links.
- Added clear wallet rejection handling for on-chain transactions.
- Added `/verify` page for reading and validating `ProofNoteRegistry.getReport(id)`.

### Changed

- Updated environment examples and README setup steps for registry deployment.
- Added Hardhat 0G Galileo network configuration and deploy script.
