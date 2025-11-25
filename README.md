# Nad.fun TypeScript SDK

<div align="center">

**A comprehensive TypeScript SDK for interacting with Nad.fun ecosystem contracts on Monad**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

[Features](#-features) • [Installation](#-installation) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Examples](#-examples)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Documentation](#-documentation)
  - [Trading](#-trading)
  - [Token Operations](#-token-operations)
  - [Event Streaming](#-event-streaming)
  - [Automated Bots](#-automated-bots)
- [Examples](#-examples)
- [Configuration](#-configuration)
- [API Reference](#-api-reference)
- [Best Practices](#-best-practices)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

The Nad.fun SDK is a powerful TypeScript library designed for seamless interaction with the Nad.fun ecosystem on the Monad blockchain. It provides a complete toolkit for trading on bonding curves, monitoring real-time events, managing tokens, and building automated trading bots.

### What is Nad.fun?

Nad.fun is a token launch platform on Monad (similar to Pump.fun on Solana) that enables:
- **Bonding Curve Trading**: Buy and sell tokens before they graduate to DEX
- **Real-time Event Monitoring**: Track token creation, trades, and listings
- **Automated Trading**: Build sniper bots and bundlers for advanced strategies

### Key Capabilities

- ✅ **Complete Trading Suite**: Buy, sell, and quote operations with slippage protection
- ✅ **Real-time Monitoring**: WebSocket-based event streaming for instant updates
- ✅ **Gas Optimization**: Intelligent gas estimation with network-based calculations
- ✅ **Automated Bots**: Pre-built sniper and bundler bots for advanced trading
- ✅ **Type Safety**: Full TypeScript support with comprehensive type definitions
- ✅ **EIP-2612 Support**: Gasless approvals using permit signatures

---

## ✨ Features

### 🚀 Trading Operations
- Buy and sell tokens on bonding curves
- Automatic router selection (bonding curve or DEX)
- Slippage protection with configurable tolerance
- Network-based gas estimation
- Support for permit-based sells (gasless)

### 📊 Token Management
- Get token metadata, balances, and allowances
- Batch operations for multiple tokens
- EIP-2612 permit signature generation
- Token health checks and validation

### 🔄 Real-time Event Streaming
- WebSocket-based event monitoring
- Filter by event types and token addresses
- Historical event indexing
- Automatic pool discovery for DEX tokens

### 🤖 Automated Trading Bots
- **Sniper Bot**: Auto-buy new tokens on creation
- **Bundler Bot**: Execute multiple trades in sequence
- Configurable filters and rate limiting
- Comprehensive statistics and error handling

---

## 📦 Installation

### Using npm

```bash
npm install @nadfun/sdk
```

### Using yarn

```bash
yarn add @nadfun/sdk
```

### Using bun

```bash
bun add @nadfun/sdk
```

### Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.3.0 (for TypeScript projects)

---

## 🚀 Quick Start

### 1. Basic Setup

```typescript
import { Trade, Token, parseEther } from '@nadfun/sdk'

// Initialize trading client
const trade = new Trade(
  'https://your-rpc-endpoint',
  '0x-your-private-key'
)

// Initialize token helper
const token = new Token(
  'https://your-rpc-endpoint',
  '0x-your-private-key'
)
```

### 2. Buy Tokens

```typescript
const tokenAddress = '0x...' as `0x${string}`
const buyAmount = parseEther('0.1') // 0.1 MON

// Get quote
const { router, amount: expectedTokens } = await trade.getAmountOut(
  tokenAddress,
  buyAmount,
  true // isBuy
)

// Calculate minimum tokens with 5% slippage
import { calculateMinAmountOut } from '@nadfun/sdk'
const minTokens = calculateMinAmountOut(expectedTokens, 5.0)

// Estimate gas
const gasParams = {
  type: 'Buy' as const,
  token: tokenAddress,
  amountIn: buyAmount,
  amountOutMin: minTokens,
  to: trade.account.address,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
}
const estimatedGas = await trade.estimateGas(router, gasParams)
const gasWithBuffer = (estimatedGas * 120n) / 100n // 20% buffer

// Execute buy
const txHash = await trade.buy(
  {
    token: tokenAddress,
    to: trade.account.address,
    amountIn: buyAmount,
    amountOutMin: minTokens,
    deadline: Math.floor(Date.now() / 1000) + 300,
    gasLimit: gasWithBuffer,
  },
  router
)

console.log(`Transaction hash: ${txHash}`)
```

### 3. Monitor Events

```typescript
import { Stream as CurveStream, CurveEventType } from '@nadfun/sdk'

const stream = new CurveStream('wss://your-ws-endpoint')
stream.subscribeEvents([CurveEventType.Create, CurveEventType.Buy])

stream.onEvent((event) => {
  console.log(`Event: ${event.type} for token ${event.token}`)
})

await stream.start()
```

### 4. Use Sniper Bot

```typescript
import { SniperBot } from '@nadfun/sdk'

const sniper = new SniperBot({
  rpcUrl: 'https://your-rpc-endpoint',
  wsUrl: 'wss://your-ws-endpoint',
  privateKey: '0x-your-private-key',
  buyAmount: '0.1',
  slippagePercent: 5.0,
  gasMultiplier: 1.2,
})

sniper.onBuySuccess((event, txHash) => {
  console.log(`✅ Bought ${event.name} (${event.symbol})`)
  console.log(`   TX: ${txHash}`)
})

await sniper.start()
```

---

## 📚 Documentation

### 🛒 Trading

The `Trade` class provides comprehensive trading functionality for bonding curves and DEX.

#### Getting Quotes

```typescript
// Get amount out (tokens received for MON spent)
const { router, amount } = await trade.getAmountOut(
  tokenAddress,
  parseEther('0.1'),
  true // isBuy
)

// Get amount in (MON needed for tokens desired)
const { router, amount } = await trade.getAmountIn(
  tokenAddress,
  parseEther('1000'),
  true // isBuy
)
```

#### Executing Trades

```typescript
// Buy tokens
const txHash = await trade.buy(
  {
    token: tokenAddress,
    to: walletAddress,
    amountIn: parseEther('0.1'),
    amountOutMin: minTokens,
    deadline: Math.floor(Date.now() / 1000) + 300,
    gasLimit: gasLimit,
    gasPrice: gasPrice,
  },
  routerAddress
)

// Sell tokens (requires approval)
const txHash = await trade.sell(
  {
    token: tokenAddress,
    to: walletAddress,
    amountIn: tokenAmount,
    amountOutMin: minMon,
    deadline: Math.floor(Date.now() / 1000) + 300,
    gasLimit: gasLimit,
  },
  routerAddress
)

// Sell with permit (gasless)
const permit = await token.generatePermitSignature(
  tokenAddress,
  routerAddress,
  tokenAmount,
  deadline
)
const txHash = await trade.sellPermit(
  {
    token: tokenAddress,
    to: walletAddress,
    amountIn: tokenAmount,
    amountOutMin: minMon,
    amountAllowance: tokenAmount,
    deadline: Math.floor(Date.now() / 1000) + 300,
    v: permit.v,
    r: permit.r,
    s: permit.s,
    gasLimit: gasLimit,
  },
  routerAddress
)
```

#### Gas Estimation

The SDK provides intelligent gas estimation based on network conditions:

```typescript
const gasParams = {
  type: 'Buy' as const, // or 'Sell', 'SellPermit'
  token: tokenAddress,
  amountIn: buyAmount,
  amountOutMin: minTokens,
  to: walletAddress,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
}

const estimatedGas = await trade.estimateGas(routerAddress, gasParams)
const gasWithBuffer = (estimatedGas * 120n) / 100n // Add 20% buffer
```

**Gas Buffer Strategies:**
- **Buy operations**: 20% buffer recommended
- **Sell operations**: 15% buffer recommended
- **SellPermit operations**: 25% buffer recommended

### 🪙 Token Operations

The `Token` class provides utilities for ERC-20 token interactions.

#### Basic Operations

```typescript
// Get token metadata
const metadata = await token.getMetadata(tokenAddress)
console.log(`${metadata.name} (${metadata.symbol})`)

// Get balance
const balance = await token.getBalance(tokenAddress)
const [rawBalance, formattedBalance] = await token.getBalanceFormatted(tokenAddress)

// Get allowance
const allowance = await token.getAllowance(tokenAddress, spenderAddress)

// Approve tokens
const txHash = await token.approve(tokenAddress, spenderAddress, amount)

// Transfer tokens
const txHash = await token.transfer(tokenAddress, recipientAddress, amount)
```

#### Batch Operations

```typescript
// Get balances for multiple tokens
const balances = await token.batchGetBalances([token1, token2, token3])

// Get metadata for multiple tokens
const metadata = await token.batchGetMetadata([token1, token2, token3])

// Get allowances for multiple spenders
const allowances = await token.batchGetAllowances(tokenAddress, [spender1, spender2])
```

#### Permit Signatures (EIP-2612)

```typescript
// Generate permit signature
const permit = await token.generatePermitSignature(
  tokenAddress,
  spenderAddress,
  amount,
  deadline
)

// Use permit in sellPermit transaction
// (see Trading section above)
```

### 🔄 Event Streaming

Monitor bonding curve and DEX events in real-time using WebSocket connections.

#### Bonding Curve Events

```typescript
import { Stream as CurveStream, CurveEventType } from '@nadfun/sdk'

const stream = new CurveStream('wss://your-ws-endpoint')

// Filter by event types
stream.subscribeEvents([
  CurveEventType.Create,
  CurveEventType.Buy,
  CurveEventType.Sell,
])

// Filter by token addresses (optional)
stream.filterTokens([tokenAddress1, tokenAddress2])

// Handle events
stream.onEvent((event) => {
  switch (event.type) {
    case CurveEventType.Create:
      console.log(`New token: ${event.name} (${event.symbol})`)
      break
    case CurveEventType.Buy:
      console.log(`Buy: ${event.amountIn} MON -> ${event.amountOut} tokens`)
      break
    case CurveEventType.Sell:
      console.log(`Sell: ${event.amountIn} tokens -> ${event.amountOut} MON`)
      break
  }
})

await stream.start()
```

#### Historical Event Indexing

```typescript
import { Indexer as CurveIndexer, CurveEventType } from '@nadfun/sdk'

const indexer = new CurveIndexer('https://your-rpc-endpoint')

// Fetch events from block range
const events = await indexer.fetchEvents(
  18_000_000,
  18_010_000,
  [CurveEventType.Create, CurveEventType.Buy],
  [tokenAddress] // optional token filter
)

// Fetch all events with automatic batching
const allEvents = await indexer.fetchAllEvents(
  18_000_000,
  2000, // batch size
  [CurveEventType.Create]
)
```

#### DEX Swap Events

```typescript
import { DexStream } from '@nadfun/sdk'

// Auto-discover pools for tokens
const stream = await DexStream.discoverPoolsForTokens(
  'wss://your-ws-endpoint',
  [tokenAddress1, tokenAddress2]
)

stream.onSwap((event) => {
  console.log(`Swap in pool ${event.pool}`)
  console.log(`  ${event.amount0} -> ${event.amount1}`)
})

await stream.start()
```

### 🤖 Automated Bots

#### Sniper Bot

Automatically monitors for new token creation and executes buy transactions.

```typescript
import { SniperBot } from '@nadfun/sdk'

const sniper = new SniperBot({
  rpcUrl: 'https://your-rpc-endpoint',
  wsUrl: 'wss://your-ws-endpoint',
  privateKey: '0x-your-private-key',
  buyAmount: '0.1', // MON to spend per buy
  slippagePercent: 5.0,
  gasMultiplier: 1.2, // 20% higher gas
  minBuyInterval: 1000, // ms between buys
  autoBuy: true,
  
  // Optional filters
  tokenWhitelist: ['0xToken1', '0xToken2'],
  tokenBlacklist: ['0xToken3'],
  tokenFilter: async (event) => {
    // Custom filter logic
    return event.name.length > 3
  },
})

// Set up callbacks
sniper.onBuySuccess((event, txHash) => {
  console.log(`✅ Bought ${event.name} at ${txHash}`)
})

sniper.onBuyError((event, error) => {
  console.error(`❌ Failed to buy ${event.name}:`, error)
})

// Start monitoring
await sniper.start()

// Get statistics
const stats = sniper.getStats()
console.log(`Events: ${stats.totalEvents}, Buys: ${stats.successfulBuys}`)
```

#### Bundler Bot

Execute multiple buy/sell operations in sequence.

```typescript
import { BundlerBot } from '@nadfun/sdk'

const bundler = new BundlerBot({
  rpcUrl: 'https://your-rpc-endpoint',
  privateKey: '0x-your-private-key',
  defaultSlippagePercent: 5.0,
  gasMultiplier: 1.0,
  waitForConfirmation: true,
})

// Execute multiple operations
const results = await bundler.execute([
  { type: 'buy', token: '0xToken1', amountIn: '0.1' },
  { type: 'buy', token: '0xToken2', amountIn: '0.2' },
  { type: 'sell', token: '0xToken1', amountIn: '1000' },
  { type: 'sellPermit', token: '0xToken2', amountIn: '500' },
])

// Process results
results.forEach((result, i) => {
  if (result.success) {
    console.log(`✅ Operation ${i + 1}: ${result.txHash}`)
  } else {
    console.error(`❌ Operation ${i + 1}: ${result.error}`)
  }
})
```

---

## 💡 Examples

The SDK includes comprehensive examples in the `examples/` directory.

### Running Examples

#### Trading Examples

```bash
# Buy tokens
bun run example:buy -- \
  --rpc-url https://your-rpc-endpoint \
  --private-key 0x... \
  --token 0xTokenAddress \
  --amount 0.1

# Sell tokens
bun run example:sell -- \
  --rpc-url https://your-rpc-endpoint \
  --private-key 0x... \
  --token 0xTokenAddress

# Gas estimation
bun run example:gas-estimation -- \
  --rpc-url https://your-rpc-endpoint \
  --private-key 0x... \
  --token 0xTokenAddress
```

#### Bot Examples

```bash
# Sniper bot
bun run example:sniper -- \
  --rpc-url https://your-rpc-endpoint \
  --ws-url wss://your-ws-endpoint \
  --private-key 0x... \
  --buy-amount 0.1 \
  --slippage 5.0

# Bundler bot
bun run example:bundler -- \
  --rpc-url https://your-rpc-endpoint \
  --private-key 0x... \
  --operations "buy:0xToken1:0.1,buy:0xToken2:0.2"
```

#### Streaming Examples

```bash
# Monitor bonding curve events
bun run example:curve-stream -- \
  --ws-url wss://your-ws-endpoint \
  --events CurveCreate,CurveBuy

# Monitor DEX swaps
bun run example:dex-stream -- \
  --ws-url wss://your-ws-endpoint \
  --tokens 0xToken1,0xToken2
```

See [examples/bots/README.md](examples/bots/README.md) for detailed bot documentation.

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in your project root:

```bash
# RPC Configuration
RPC_URL=https://your-rpc-endpoint
WS_RPC_URL=wss://your-ws-endpoint

# Wallet
PRIVATE_KEY=0x-your-private-key

# Trading
TOKEN=0xTokenAddress
SLIPPAGE=5.0
BUY_AMOUNT=0.1

# Bot Configuration
GAS_MULTIPLIER=1.2
MAX_GAS_PRICE=100
```

### Contract Addresses

All contract addresses are defined in `src/constants.ts`:

- **Bonding Curve**: `0x52D34d8536350Cd997bCBD0b9E9d722452f341F5`
- **Bonding Curve Router**: `0x4F5A3518F082275edf59026f72B66AC2838c0414`
- **DEX Router**: `0x4FBDC27FAE5f99E7B09590bEc8Bf20481FCf9551`
- **Lens Contract**: `0xD47Dd1a82dd239688ECE1BA94D86f3D32960C339`
- **WMON Token**: `0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701`

---

## 📖 API Reference

### Trade Class

#### Methods

- `getAmountOut(token, amountIn, isBuy)`: Get quote for buying/selling
- `getAmountIn(token, amountOut, isBuy)`: Calculate input needed for desired output
- `buy(params, router)`: Execute buy transaction
- `sell(params, router)`: Execute sell transaction
- `sellPermit(params, router)`: Execute sell with permit signature
- `estimateGas(router, params)`: Estimate gas for transaction
- `getCurveState(token)`: Get bonding curve state
- `isListed(token)`: Check if token is listed on DEX
- `isLocked(token)`: Check if token is locked

### Token Class

#### Methods

- `getMetadata(token)`: Get token metadata (name, symbol, decimals, supply)
- `getBalance(token, address?)`: Get token balance
- `getAllowance(token, spender, owner?)`: Get token allowance
- `approve(token, spender, amount)`: Approve tokens
- `transfer(token, to, amount)`: Transfer tokens
- `generatePermitSignature(token, spender, value, deadline)`: Generate EIP-2612 permit
- `batchGetBalances(tokens, address?)`: Get balances for multiple tokens
- `batchGetMetadata(tokens)`: Get metadata for multiple tokens

### Stream Classes

- `CurveStream`: Real-time bonding curve event streaming
- `DexStream`: Real-time DEX swap event streaming
- `CurveIndexer`: Historical bonding curve event indexing
- `DexIndexer`: Historical DEX event indexing

### Bot Classes

- `SniperBot`: Automated token sniper
- `BundlerBot`: Batch transaction executor

See TypeScript definitions for complete API documentation.

---

## 🎓 Best Practices

### Gas Management

1. **Always use network-based estimation**: Don't hardcode gas limits
2. **Apply appropriate buffers**: 20% for buys, 15% for sells, 25% for permit operations
3. **Monitor gas prices**: Adjust multipliers based on network conditions
4. **Set maximum gas price**: Prevent excessive gas costs

### Slippage Protection

1. **Use appropriate slippage**: 5% is a good default, adjust based on volatility
2. **Calculate minimum amounts**: Always use `calculateMinAmountOut()` before trading
3. **Monitor actual slippage**: Compare expected vs actual amounts

### Error Handling

```typescript
try {
  const txHash = await trade.buy(params, router)
  console.log(`Success: ${txHash}`)
} catch (error) {
  if (error.message.includes('insufficient funds')) {
    console.error('Insufficient balance')
  } else if (error.message.includes('slippage')) {
    console.error('Slippage too high')
  } else {
    console.error('Transaction failed:', error)
  }
}
```

### Security

1. **Never commit private keys**: Use environment variables or secure key management
2. **Use testnet for development**: Test thoroughly before mainnet deployment
3. **Validate inputs**: Always validate token addresses and amounts
4. **Monitor transactions**: Track all transactions and verify receipts

### Performance

1. **Use batch operations**: When querying multiple tokens, use batch methods
2. **Cache metadata**: Token metadata rarely changes, cache when possible
3. **Optimize gas**: Use permit signatures for sells when possible (gasless approval)
4. **Connection pooling**: Reuse RPC connections when possible

---

## 🔧 Troubleshooting

### Common Issues

#### Transaction Fails with "Insufficient Funds"

- Check your MON balance: `await trade.publicClient.getBalance({ address })`
- Ensure you have enough for gas + transaction amount
- Account for gas price multipliers

#### Transaction Fails with "Slippage Exceeded"

- Increase slippage tolerance
- Check current market conditions
- Verify token liquidity

#### Gas Estimation Fails

- Ensure RPC endpoint is accessible
- Check network connectivity
- Verify transaction parameters are valid
- Try with a fixed gas limit as fallback

#### WebSocket Connection Issues

- Verify WebSocket URL format (`wss://` not `https://`)
- Check firewall/proxy settings
- Ensure RPC provider supports WebSocket
- Implement reconnection logic

#### Token Approval Issues

- Check current allowance before selling
- Ensure approval transaction is confirmed
- For permit operations, verify signature is valid

### Getting Help

- 📖 Check [Examples](examples/) for usage patterns
- 🐛 [Report Issues](https://github.com/naddotfun/nadfun-sdk-typescript/issues)
- 💬 Join community discussions
- 📚 Review [TypeScript definitions](src/types/) for type information

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Follow the existing code style
4. **Add tests**: Ensure all tests pass
5. **Commit changes**: Use clear, descriptive commit messages
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**: Provide detailed description of changes

### Development Setup

```bash
# Clone repository
git clone https://github.com/naddotfun/nadfun-sdk-typescript.git
cd nadfun-sdk-typescript

# Install dependencies
bun install

# Build project
bun run build

# Run examples
bun run example:buy
```

### Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Ensure all examples work

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- **Documentation**: [Full API Docs](https://github.com/naddotfun/nadfun-sdk-typescript)
- **Examples**: [Examples Directory](examples/)
- **Issues**: [GitHub Issues](https://github.com/naddotfun/nadfun-sdk-typescript/issues)
- **Monad Testnet**: [Monad Explorer](https://testnet.monadexplorer.com)

---

<div align="center">

**Built with ❤️ for the Monad ecosystem**

[⬆ Back to Top](#nadfun-typescript-sdk)

</div>
