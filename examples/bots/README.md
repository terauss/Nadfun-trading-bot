# Bot Examples

This directory contains examples for automated trading bots built with the Nadfun SDK.

## 🎯 Sniper Bot

Automatically monitors for new token creation events and buys them immediately.

### Features

- **Real-time Monitoring**: Uses WebSocket streaming to detect new tokens instantly
- **Auto-Buy**: Automatically executes buy transactions when new tokens are created
- **Configurable**: Customize buy amount, slippage, gas settings, and filters
- **Rate Limiting**: Prevents buying too frequently
- **Token Filtering**: Whitelist, blacklist, or custom filter functions
- **Statistics**: Tracks events, successful buys, and failures

### Usage

```bash
# Basic usage
bun run example:sniper

# With custom configuration
bun run example:sniper -- \
  --rpc-url https://rpc-url \
  --ws-url wss://ws-url \
  --private-key 0x... \
  --buy-amount 0.2 \
  --slippage 3.0 \
  --gas-multiplier 1.5 \
  --max-gas-price 100

# Disable auto-buy (monitor only)
bun run example:sniper -- --no-auto-buy
```

### Configuration Options

- `--rpc-url`: HTTP RPC URL for transactions
- `--ws-url`: WebSocket RPC URL for event streaming
- `--private-key`: Wallet private key
- `--buy-amount`: Amount of MON to spend per buy (default: 0.1)
- `--slippage`: Slippage tolerance percentage (default: 5.0)
- `--gas-multiplier`: Gas price multiplier (default: 1.2)
- `--max-gas-price`: Maximum gas price in gwei
- `--min-buy-interval`: Minimum time between buys in milliseconds (default: 1000)
- `--no-auto-buy`: Disable automatic buying (monitor only)

### Example Code

```typescript
import { SniperBot } from '@nadfun/sdk'

const sniper = new SniperBot({
  rpcUrl: 'https://rpc-url',
  wsUrl: 'wss://ws-url',
  privateKey: '0x...',
  buyAmount: '0.1',
  slippagePercent: 5.0,
  gasMultiplier: 1.2,
})

sniper.onBuySuccess((event, txHash) => {
  console.log(`Bought ${event.token} at ${txHash}`)
})

sniper.onBuyError((event, error) => {
  console.error(`Failed to buy ${event.token}:`, error)
})

await sniper.start()
```

### Advanced Filtering

```typescript
const sniper = new SniperBot({
  // ... basic config
  tokenWhitelist: ['0xToken1', '0xToken2'], // Only buy these tokens
  tokenBlacklist: ['0xToken3'], // Skip these tokens
  tokenFilter: async (event) => {
    // Custom filter logic
    return event.name.length > 3 && event.symbol.length <= 5
  },
})
```

## 📦 Bundler Bot

Execute multiple buy/sell operations in sequence.

### Features

- **Batch Operations**: Execute multiple trades in one go
- **Mixed Operations**: Combine buys and sells in a single bundle
- **Automatic Approvals**: Handles token approvals for sell operations
- **Permit Support**: Supports gasless sells using EIP-2612 permits
- **Transaction Tracking**: Detailed results for each operation

### Usage

```bash
# Basic usage with operations string
bun run example:bundler -- \
  --rpc-url https://rpc-url \
  --private-key 0x... \
  --operations "buy:0xToken1:0.1,buy:0xToken2:0.2,sell:0xToken1:1000"

# With custom slippage and gas
bun run example:bundler -- \
  --rpc-url https://rpc-url \
  --private-key 0x... \
  --operations "buy:0xToken1:0.1,sell:0xToken2:500" \
  --slippage 3.0 \
  --gas-multiplier 1.1 \
  --no-wait
```

### Operations Format

Operations are specified as a comma-separated string:
```
type:tokenAddress:amount
```

- `type`: `buy`, `sell`, or `sellPermit`
- `tokenAddress`: Token contract address
- `amount`: Amount to trade
  - For `buy`: Amount in MON (e.g., "0.1")
  - For `sell`/`sellPermit`: Amount in tokens (e.g., "1000")

### Examples

```bash
# Buy multiple tokens
--operations "buy:0xToken1:0.1,buy:0xToken2:0.2,buy:0xToken3:0.15"

# Sell multiple tokens
--operations "sell:0xToken1:1000,sell:0xToken2:2000"

# Mixed operations
--operations "buy:0xToken1:0.1,sell:0xToken2:500,buy:0xToken3:0.2"

# Using sellPermit (gasless)
--operations "sellPermit:0xToken1:1000"
```

### Configuration Options

- `--rpc-url`: HTTP RPC URL
- `--private-key`: Wallet private key
- `--operations`: Comma-separated operations string
- `--slippage`: Default slippage percentage (default: 5.0)
- `--gas-multiplier`: Gas price multiplier (default: 1.0)
- `--no-wait`: Don't wait for transaction confirmation between operations

### Example Code

```typescript
import { BundlerBot } from '@nadfun/sdk'

const bundler = new BundlerBot({
  rpcUrl: 'https://rpc-url',
  privateKey: '0x...',
  defaultSlippagePercent: 5.0,
  gasMultiplier: 1.0,
})

const results = await bundler.execute([
  { type: 'buy', token: '0xToken1', amountIn: '0.1' },
  { type: 'buy', token: '0xToken2', amountIn: '0.2' },
  { type: 'sell', token: '0xToken1', amountIn: '1000' },
])

results.forEach(result => {
  if (result.success) {
    console.log(`✅ ${result.operation.type}: ${result.txHash}`)
  } else {
    console.error(`❌ ${result.operation.type}: ${result.error}`)
  }
})
```

## 🔧 Environment Variables

Both bots support configuration via environment variables:

```bash
# .env file
RPC_URL=https://rpc-url
WS_RPC_URL=wss://ws-url
PRIVATE_KEY=0x...

# Sniper bot specific
BUY_AMOUNT=0.1
SLIPPAGE=5.0
GAS_MULTIPLIER=1.2

# Bundler bot specific
OPERATIONS=buy:0xToken1:0.1,buy:0xToken2:0.2
```

## ⚠️ Important Notes

1. **Private Keys**: Never commit private keys to version control. Use environment variables or secure key management.

2. **Gas Prices**: Monitor gas prices and adjust multipliers accordingly. High gas multipliers can lead to expensive transactions.

3. **Slippage**: Set appropriate slippage tolerance based on market conditions. Too low may cause failed transactions.

4. **Rate Limiting**: The sniper bot includes rate limiting to prevent excessive transactions. Adjust `minBuyInterval` as needed.

5. **Balance Checks**: Both bots check balances before executing transactions, but ensure you have sufficient funds.

6. **Error Handling**: Both bots include comprehensive error handling, but monitor logs for any issues.

7. **Network**: Currently configured for Monad Testnet. Update chain configuration for mainnet.

## 📊 Monitoring

### Sniper Bot Statistics

The sniper bot tracks:
- Total events detected
- Total buy attempts
- Successful buys
- Failed buys
- Skipped buys (rate limit, filters, etc.)

Access stats with:
```typescript
const stats = sniper.getStats()
console.log(stats)
```

### Bundler Bot Results

The bundler bot returns detailed results for each operation:
- Success/failure status
- Transaction hash (if successful)
- Error message (if failed)
- Expected vs actual amounts

## 🚀 Advanced Usage

### Custom Token Filter

```typescript
const sniper = new SniperBot({
  // ... config
  tokenFilter: async (event) => {
    // Check token metadata
    const metadata = await token.getMetadata(event.token)
    
    // Only buy tokens with specific criteria
    return metadata.name.length > 5 && 
           metadata.totalSupply > parseEther('1000000')
  },
})
```

### Sequential Bundling with Dependencies

```typescript
// First buy tokens
const buyResults = await bundler.execute([
  { type: 'buy', token: '0xToken1', amountIn: '0.1' },
  { type: 'buy', token: '0xToken2', amountIn: '0.2' },
])

// Wait for all buys to complete
await Promise.all(
  buyResults
    .filter(r => r.success && r.txHash)
    .map(r => bundler.trade.publicClient.waitForTransactionReceipt({ hash: r.txHash }))
)

// Then sell
const sellResults = await bundler.execute([
  { type: 'sell', token: '0xToken1', amountIn: '1000' },
])
```

## 📝 License

MIT License - see main LICENSE file for details.

