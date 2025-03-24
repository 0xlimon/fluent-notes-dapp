# Blockchain Notes DApp

A decentralized application for storing personal notes on the Fluent blockchain.

## Features

- **Blockchain Storage**: All notes are stored on the Fluent blockchain
- **Wallet-based Access**: Access your notes from any device with your blockchain wallet
- **Privacy**: Your notes are private and only accessible by you
- **Full Ownership**: Your data remains under your control

## Project Structure

When sent to GitHub, the project will have this structure:

```
fluent-notes-dapp/
├── contracts/           # Smart contract code
│   └── rust/            # Rust contract source
│       ├── Cargo.toml   # Dependencies and build config
│       └── src/
│           └── lib.rs   # Contract implementation
├── public/              # Static assets
└── src/                 # Frontend source code
    ├── components/      # React components
    ├── contracts/       # Contract ABIs and addresses
    └── ...              # Other React files
```

## How to Use

### Prerequisites

- MetaMask or another Ethereum-compatible wallet
- Connection to the Fluent network
- Some ETH tokens for transaction fees

### Setup Guide

1. **Connect your wallet**: Click the "Connect Wallet" button in the header
2. **Create notes**: Click "Create Note" to add a new note
3. **View and edit**: Select any note from the list to view or edit it

## Development Guide

### Rust Contract

To build and deploy:

```bash
# Navigate to the rust contract directory
cd contracts/rust

# Build the contract
gblend build rust -r

# Deploy the contract (replace <PRIVATE_KEY> with your wallet private key)
gblend deploy \
  --private-key <PRIVATE_KEY> \
  --dev lib.wasm \
  --gas-limit 3000000
```

After deployment, you'll receive a contract address that you need to update in `src/contracts/addresses.js`.

### Frontend

To run the frontend locally:

```bash
# Install dependencies
npm install

# Start the development server
npm start
```

### Building for Production

```bash
# Build the frontend
npm run build
```

This creates a `build` folder with optimized production files that can be deployed to any static hosting service.

## Connecting to Fluent Network

You'll need to add the Fluent network to your MetaMask wallet:

- **Network Name**: Fluent Devnet
- **RPC URL**: https://rpc.dev.gblend.xyz/
- **Chain ID**: 0x5201 (20993 in decimal)
- **Currency Symbol**: ETH
- **Block Explorer URL**: https://blockscout.dev.gblend.xyz/

## Troubleshooting

If you encounter any issues:

1. Make sure your wallet is connected to the Fluent network
2. Use the refresh button in the notes list to update the display
3. Check that you have sufficient ETH tokens for gas fees
4. Use the Diagnostics button to troubleshoot contract interaction issues

## License

This project is licensed under the MIT License.

## Credits

- Developed by [0xLimon](https://twitter.com/zxLimon_)
- Repository: [GitHub](https://github.com/0xlimon/fluent-notes-dapp)