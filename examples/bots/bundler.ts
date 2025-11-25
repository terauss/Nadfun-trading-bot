/**
 * Bundler Bot Example
 * 
 * Execute multiple buy/sell operations in sequence
 * 
 * Usage:
 * bun run example:bundler
 * bun run example:bundler -- --operations "buy:0xToken1:0.1,buy:0xToken2:0.2,sell:0xToken1:1000"
 */

import { config } from 'dotenv'
import { parseArgs } from 'util'
import { BundlerBot, type BundledOperation } from '../../src/bots/bundler'
import { formatEther, formatUnits } from 'viem'

config()

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    'rpc-url': { type: 'string' },
    'private-key': { type: 'string' },
    operations: { type: 'string' },
    slippage: { type: 'string' },
    'gas-multiplier': { type: 'string' },
    'no-wait': { type: 'boolean' },
  },
  allowPositionals: false,
})

const RPC_URL = args['rpc-url'] || process.env.RPC_URL
const PRIVATE_KEY = args['private-key'] || process.env.PRIVATE_KEY
const OPERATIONS_STR = args.operations || process.env.OPERATIONS
const SLIPPAGE = Number(args.slippage || process.env.SLIPPAGE || '5.0')
const GAS_MULTIPLIER = Number(args['gas-multiplier'] || process.env.GAS_MULTIPLIER || '1.0')
const WAIT_FOR_CONFIRMATION = !args['no-wait']

/**
 * Parse operations string
 * Format: "type:token:amount,type:token:amount,..."
 * Example: "buy:0xToken1:0.1,buy:0xToken2:0.2,sell:0xToken1:1000"
 */
function parseOperations(operationsStr: string): BundledOperation[] {
  const operations: BundledOperation[] = []
  const parts = operationsStr.split(',')

  for (const part of parts) {
    const [type, token, amount] = part.trim().split(':')
    
    if (!type || !token || !amount) {
      throw new Error(`Invalid operation format: ${part}. Expected: type:token:amount`)
    }

    if (type === 'buy') {
      operations.push({
        type: 'buy',
        token: token as `0x${string}`,
        amountIn: amount,
        slippagePercent: SLIPPAGE,
      })
    } else if (type === 'sell') {
      operations.push({
        type: 'sell',
        token: token as `0x${string}`,
        amountIn: amount,
        slippagePercent: SLIPPAGE,
      })
    } else if (type === 'sellPermit') {
      operations.push({
        type: 'sellPermit',
        token: token as `0x${string}`,
        amountIn: amount,
        slippagePercent: SLIPPAGE,
      })
    } else {
      throw new Error(`Unknown operation type: ${type}. Expected: buy, sell, or sellPermit`)
    }
  }

  return operations
}

async function main() {
  if (!RPC_URL || !PRIVATE_KEY) {
    console.error('❌ Missing required configuration')
    console.log('💡 Required: RPC_URL, PRIVATE_KEY')
    console.log('💡 Usage: bun run example:bundler -- --rpc-url <url> --private-key <key> --operations "buy:0xToken:0.1"')
    process.exit(1)
  }

  if (!OPERATIONS_STR) {
    console.error('❌ Missing operations')
    console.log('💡 Usage: --operations "buy:0xToken1:0.1,buy:0xToken2:0.2,sell:0xToken1:1000"')
    process.exit(1)
  }

  console.log('📦 Nadfun Bundler Bot\n')

  // Parse operations
  let operations: BundledOperation[]
  try {
    operations = parseOperations(OPERATIONS_STR)
  } catch (error: any) {
    console.error('❌ Error parsing operations:', error.message)
    process.exit(1)
  }

  console.log(`📋 Operations to execute: ${operations.length}`)
  operations.forEach((op, i) => {
    console.log(`   ${i + 1}. ${op.type.toUpperCase()} ${op.token} - ${op.amountIn} ${op.type === 'buy' ? 'MON' : 'tokens'}`)
  })
  console.log('')

  // Create bundler bot
  const bundler = new BundlerBot({
    rpcUrl: RPC_URL,
    privateKey: PRIVATE_KEY,
    defaultSlippagePercent: SLIPPAGE,
    gasMultiplier: GAS_MULTIPLIER,
    waitForConfirmation: WAIT_FOR_CONFIRMATION,
  })

  console.log(`💰 Wallet: ${bundler.getAddress()}`)
  console.log(`   Slippage: ${SLIPPAGE}%`)
  console.log(`   Gas Multiplier: ${GAS_MULTIPLIER}x`)
  console.log(`   Wait for Confirmation: ${WAIT_FOR_CONFIRMATION ? 'Yes' : 'No'}`)
  console.log('')

  // Execute operations
  try {
    const results = await bundler.execute(operations)

    // Detailed results
    console.log('\n📊 Detailed Results:')
    results.forEach((result, i) => {
      const op = result.operation
      console.log(`\n[${i + 1}] ${op.type.toUpperCase()} ${op.token}`)
      if (result.success) {
        console.log(`   ✅ Success`)
        console.log(`   TX Hash: ${result.txHash}`)
        if (result.expectedAmount) {
          console.log(`   Expected: ${formatUnits(result.expectedAmount, 18)}`)
        }
        console.log(`   🔗 Explorer: https://testnet.monadexplorer.com/tx/${result.txHash}`)
      } else {
        console.log(`   ❌ Failed: ${result.error}`)
      }
    })

    // Final summary
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log('\n' + '='.repeat(50))
    console.log('📊 Final Summary:')
    console.log(`   Total Operations: ${results.length}`)
    console.log(`   ✅ Successful: ${successful}`)
    console.log(`   ❌ Failed: ${failed}`)
    console.log(`   Success Rate: ${((successful / results.length) * 100).toFixed(1)}%`)
  } catch (error: any) {
    console.error('❌ Bundler execution failed:', error.message || error)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { main as runBundlerExample }

