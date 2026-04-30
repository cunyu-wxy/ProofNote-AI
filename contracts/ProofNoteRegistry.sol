pragma solidity ^0.8.24;

contract ProofNoteRegistry {
    struct Report {
        address owner;
        string title;
        string sourceRootHash;
        string reportRootHash;
        string metadataRootHash;
        uint256 createdAt;
    }

    Report[] private reports;

    event ReportRecorded(
        uint256 indexed id,
        address indexed owner,
        string title,
        string sourceRootHash,
        string reportRootHash,
        string metadataRootHash,
        uint256 createdAt
    );

    function recordReport(
        string calldata title,
        string calldata sourceRootHash,
        string calldata reportRootHash,
        string calldata metadataRootHash
    ) external returns (uint256 id) {
        require(bytes(title).length > 0, "TITLE_REQUIRED");
        require(bytes(sourceRootHash).length > 0, "SOURCE_ROOT_REQUIRED");
        require(bytes(reportRootHash).length > 0, "REPORT_ROOT_REQUIRED");
        require(bytes(metadataRootHash).length > 0, "METADATA_ROOT_REQUIRED");

        id = reports.length;
        uint256 createdAt = block.timestamp;

        reports.push(
            Report({
                owner: msg.sender,
                title: title,
                sourceRootHash: sourceRootHash,
                reportRootHash: reportRootHash,
                metadataRootHash: metadataRootHash,
                createdAt: createdAt
            })
        );

        emit ReportRecorded(
            id,
            msg.sender,
            title,
            sourceRootHash,
            reportRootHash,
            metadataRootHash,
            createdAt
        );
    }

    function getReport(uint256 id) external view returns (Report memory) {
        require(id < reports.length, "REPORT_NOT_FOUND");
        return reports[id];
    }

    function getReportCount() external view returns (uint256) {
        return reports.length;
    }
}
