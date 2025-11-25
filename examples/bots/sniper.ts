/**
 * Sniper Bot Example
 * 
 * Automatically monitors for new token creation events and buys them immediately
 * 
 * Usage:
 * bun run example:sniper
 * bun run example:sniper -- --buy-amount 0.2 --slippage 3.0 --gas-multiplier 1.5
 */

import { config } from 'dotenv'
import { parseArgs } from 'util'
import { SniperBot } from '../../src/bots/sniper'
import { CurveEventType } from '../../src/types'
import { formatEther } from 'viem'

config()

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'rpc-url': { type: 'string' },
    'ws-url': { type: 'string' },
    'private-key': { type: 'string' },
    'buy-amount': { type: 'string' },
    slippage: { type: 'string' },
    'gas-multiplier': { type: 'string' },
    'max-gas-price': { type: 'string' },
    'min-buy-interval': { type: 'string' },
    'no-auto-buy': { type: 'boolean' },
  },
  allowPositionals: false,
})

const RPC_URL = args['rpc-url'] || process.env.RPC_URL
const WS_URL = args['ws-url'] || process.env.WS_RPC_URL
const PRIVATE_KEY = args['private-key'] || process.env.PRIVATE_KEY
const BUY_AMOUNT = args['buy-amount'] || process.env.BUY_AMOUNT || '0.1'
const SLIPPAGE = Number(args.slippage || process.env.SLIPPAGE || '5.0')
const GAS_MULTIPLIER = Number(args['gas-multiplier'] || process.env.GAS_MULTIPLIER || '1.2')
const MAX_GAS_PRICE = args['max-gas-price']
  ? BigInt(parseFloat(args['max-gas-price']) * 1e9)
  : undefined
const MIN_BUY_INTERVAL = args['min-buy-interval']
  ? Number(args['min-buy-interval'])
  : 1000
const AUTO_BUY = !args['no-auto-buy']

async function main() {
  if (!RPC_URL || !WS_URL || !PRIVATE_KEY) {
    console.error('❌ Missing required configuration')
    console.log('💡 Required: RPC_URL, WS_RPC_URL, PRIVATE_KEY')
    console.log('💡 Usage: bun run example:sniper -- --rpc-url <url> --ws-url <url> --private-key <key>')
    process.exit(1)
  }

  console.log('🎯 Nadfun Sniper Bot\n')

  // Create sniper bot
  const sniper = new SniperBot({
    rpcUrl: RPC_URL,
    wsUrl: WS_URL,
    privateKey: PRIVATE_KEY,
    buyAmount: BUY_AMOUNT,
    slippagePercent: SLIPPAGE,
    gasMultiplier: GAS_MULTIPLIER,
    maxGasPrice: MAX_GAS_PRICE,
    minBuyInterval: MIN_BUY_INTERVAL,
    autoBuy: AUTO_BUY,
  })

  // Set up callbacks
  sniper.onBuySuccess((event, txHash) => {
    console.log(`\n🎉 Buy Success Callback:`)
    console.log(`   Token: ${event.name} (${event.symbol})`)
    console.log(`   Address: ${event.token}`)
    console.log(`   TX: ${txHash}`)
  })

  sniper.onBuyError((event, error) => {
    console.error(`\n❌ Buy Error Callback:`)
    console.error(`   Token: ${event.name} (${event.symbol})`)
    console.error(`   Error: ${error.message}`)
  })

  // Start the bot
  await sniper.start()

  // Show stats every 30 seconds
  const statsInterval = setInterval(() => {
    const stats = sniper.getStats()
    if (stats.totalEvents > 0) {
      console.log(`\n📊 Stats: ${stats.totalEvents} events, ${stats.successfulBuys} successful buys, ${stats.failedBuys} failed`)
    }
  }, 30000)

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...')
    clearInterval(statsInterval)
    sniper.stop()
    process.exit(0)
  })

  // Keep running
  await new Promise(() => {})
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { main as runSniperExample }

