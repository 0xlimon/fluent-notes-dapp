// Contract addresses for Fluent Devnet
// Unified approach using a single Rust contract that handles both encryption and storage
export const CONTRACT_ADDRESSES = {
  // Primary Rust contract address (unified contract with all functionality)
  SECURE_NOTES_RUST: "0xdf6a95ff02f2fb4f8aeeabcf0dfceddda5976465",
  
  // For backward compatibility - both point to the same unified Rust contract
  NOTES_ENCRYPTION: "0xdf6a95ff02f2fb4f8aeeabcf0dfceddda5976465", // Same as SECURE_NOTES_RUST
  SECURE_NOTES: "0xdf6a95ff02f2fb4f8aeeabcf0dfceddda5976465", // Same as SECURE_NOTES_RUST
  
  // Fluent network settings
  NETWORK: {
    chainId: "0x5201", // 20993 in hex (Fluent devnet)
    chainName: "Fluent Devnet",
    rpcUrls: ["https://rpc.dev.gblend.xyz/"],
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18
    },
    blockExplorerUrls: ["https://blockscout.dev.gblend.xyz/"]
  }
};