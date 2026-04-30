export const proofNoteRegistryAbi = [
  {
    type: "event",
    name: "ReportRecorded",
    anonymous: false,
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "title", type: "string", indexed: false },
      { name: "sourceRootHash", type: "string", indexed: false },
      { name: "reportRootHash", type: "string", indexed: false },
      { name: "metadataRootHash", type: "string", indexed: false },
      { name: "createdAt", type: "uint256", indexed: false }
    ]
  },
  {
    type: "function",
    name: "recordReport",
    stateMutability: "nonpayable",
    inputs: [
      { name: "title", type: "string" },
      { name: "sourceRootHash", type: "string" },
      { name: "reportRootHash", type: "string" },
      { name: "metadataRootHash", type: "string" }
    ],
    outputs: [{ name: "id", type: "uint256" }]
  },
  {
    type: "function",
    name: "getReport",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "title", type: "string" },
          { name: "sourceRootHash", type: "string" },
          { name: "reportRootHash", type: "string" },
          { name: "metadataRootHash", type: "string" },
          { name: "createdAt", type: "uint256" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "getReportCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;
