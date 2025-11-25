import type { Address } from 'viem'
import { parseEther, parseUnits } from 'viem'
import { Trade } from '../trading/trade'
import { Token } from '../token/token'
import { BuyParams, SellParams, SellPermitParams } from '../types'
import { calculateMinAmountOut } from '../trading/slippage'

/**
 * Bundled transaction operation
 */
export type BundledOperation =
  | {
      type: 'buy'
      token: Address
      amountIn: string // Amount in MON (e.g., "0.1")
      slippagePercent?: number
    }
  | {
      type: 'sell'
      token: Address
      amountIn: string // Amount in tokens (e.g., "1000")
      slippagePercent?: number
    }
  | {
      type: 'sellPermit'
      token: Address
      amountIn: string // Amount in tokens
      slippagePercent?: number
    }

/**
 * Configuration for the bundler bot
 */
export interface BundlerConfig {
  /** RPC URL */
  rpcUrl: string
  /** Private key for wallet */
  privateKey: string
  /** Default slippage percentage */
  defaultSlippagePercent?: number
  /** Gas price multiplier */
  gasMultiplier?: number
  /** Maximum gas price in gwei */
  maxGasPrice?: bigint
  /** Whether to wait for each transaction before sending the next */
  waitForConfirmation?: boolean
}

/**
 * Result of a bundled operation
 */
export interface BundledOperationResult {
  operation: BundledOperation
  success: boolean
  txHash?: string
  error?: string
  expectedAmount?: bigint
  actualAmount?: bigint
}

/**
 * Bundler bot for executing multiple transactions in sequence
 * 
 * Useful for batch operations, MEV strategies, or portfolio rebalancing
 * 
 * @example
 * ```typescript
 * const bundler = new BundlerBot({
 *   rpcUrl: 'https://rpc-url',
 *   privateKey: '0x...',
 *   defaultSlippagePercent: 5.0,
 * })
 * 
 * const results = await bundler.execute([
 *   { type: 'buy', token: '0x...', amountIn: '0.1' },
 *   { type: 'buy', token: '0x...', amountIn: '0.2' },
 *   { type: 'sell', token: '0x...', amountIn: '1000' },
 * ])
 * 
 * results.forEach(result => {
 *   if (result.success) {
 *     console.log(`✅ ${result.operation.type} succeeded: ${result.txHash}`)
 *   } else {
 *     console.error(`❌ ${result.operation.type} failed: ${result.error}`)
 *   }
 * })
 * ```
 */
export class BundlerBot {
  private trade: Trade
  private token: Token
  private config: BundlerConfig

  constructor(config: BundlerConfig) {
    this.config = {
      defaultSlippagePercent: 5.0,
      gasMultiplier: 1.0,
      waitForConfirmation: true,
      ...config,
    }

    this.trade = new Trade(this.config.rpcUrl, this.config.privateKey)
    this.token = new Token(this.config.rpcUrl, this.config.privateKey)
  }

  /**
   * Execute multiple operations in sequence
   * 
   * @param operations Array of operations to execute
   * @returns Array of results for each operation
   */
  async execute(operations: BundledOperation[]): Promise<BundledOperationResult[]> {
    console.log(`📦 Bundling ${operations.length} operations...`)
    console.log(`   Wallet: ${this.trade.account.address}`)
    console.log('')

    const results: BundledOperationResult[] = []

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i]
      console.log(`[${i + 1}/${operations.length}] Processing ${operation.type} for ${operation.token}...`)

      try {
        let result: BundledOperationResult

        switch (operation.type) {
          case 'buy':
            result = await this.executeBuy(operation)
            break
          case 'sell':
            result = await this.executeSell(operation)
            break
          case 'sellPermit':
            result = await this.executeSellPermit(operation)
            break
          default:
            result = {
              operation,
              success: false,
              error: `Unknown operation type: ${(operation as any).type}`,
            }
        }

        results.push(result)

        if (result.success) {
          console.log(`   ✅ Success: ${result.txHash}`)
        } else {
          console.error(`   ❌ Failed: ${result.error}`)
        }

        // Wait for confirmation if enabled
        if (this.config.waitForConfirmation && result.success && result.txHash) {
          await this.trade.publicClient.waitForTransactionReceipt({ hash: result.txHash as `0x${string}` })
        }
      } catch (error: any) {
        const result: BundledOperationResult = {
          operation,
          success: false,
          error: error.message || String(error),
        }
        results.push(result)
        console.error(`   ❌ Error: ${result.error}`)
      }

      console.log('')
    }

    // Summary
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log('📊 Bundle Summary:')
    console.log(`   Total: ${results.length}`)
    console.log(`   Successful: ${successful}`)
    console.log(`   Failed: ${failed}`)

    return results
  }

  /**
   * Execute a buy operation
   */
  private async executeBuy(operation: BundledOperation & { type: 'buy' }): Promise<BundledOperationResult> {
    try {
      const slippage = operation.slippagePercent || this.config.defaultSlippagePercent || 5.0
      const amountIn = parseEther(operation.amountIn)

      // Check balance
      const balance = await this.trade.publicClient.getBalance({
        address: this.trade.account.address,
      })

      if (balance < amountIn) {
        return {
          operation,
          success: false,
          error: `Insufficient balance: ${balance.toString()} < ${amountIn.toString()}`,
        }
      }

      // Get quote
      const quote = await this.trade.getAmountOut(operation.token, amountIn, true)
      const minTokens = calculateMinAmountOut(quote.amount, slippage)

      // Get gas price
      const gasPrice = await this.getGasPrice()

      // Estimate gas
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
      const gasParams = {
        type: 'Buy' as const,
        token: operation.token,
        amountIn,
        amountOutMin: minTokens,
        to: this.trade.account.address,
        deadline,
      }

      const estimatedGas = await this.trade.estimateGas(quote.router, gasParams)
      const gasWithBuffer = (estimatedGas * 120n) / 100n

      // Execute buy
      const txHash = await this.trade.buy(
        {
          token: operation.token,
          to: this.trade.account.address,
          amountIn,
          amountOutMin: minTokens,
          deadline: Number(deadline),
          gasLimit: gasWithBuffer,
          gasPrice,
        },
        quote.router
      )

      return {
        operation,
        success: true,
        txHash,
        expectedAmount: quote.amount,
      }
    } catch (error: any) {
      return {
        operation,
        success: false,
        error: error.message || String(error),
      }
    }
  }

  /**
   * Execute a sell operation
   */
  private async executeSell(operation: BundledOperation & { type: 'sell' }): Promise<BundledOperationResult> {
    try {
      const slippage = operation.slippagePercent || this.config.defaultSlippagePercent || 5.0

      // Get token decimals
      const decimals = await this.token.getDecimals(operation.token)
      const amountIn = parseUnits(operation.amountIn, decimals)

      // Check balance
      const balance = await this.token.getBalance(operation.token)
      if (balance < amountIn) {
        return {
          operation,
          success: false,
          error: `Insufficient token balance: ${balance.toString()} < ${amountIn.toString()}`,
        }
      }

      // Check allowance
      const router = await this.trade.getAmountOut(operation.token, 1n, false)
      const allowance = await this.token.getAllowance(operation.token, router.router)

      if (allowance < amountIn) {
        // Approve tokens
        console.log(`   ⚠️ Approving tokens...`)
        await this.token.approve(operation.token, router.router, amountIn)
      }

      // Get quote
      const quote = await this.trade.getAmountOut(operation.token, amountIn, false)
      const minMon = calculateMinAmountOut(quote.amount, slippage)

      // Get gas price
      const gasPrice = await this.getGasPrice()

      // Estimate gas
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
      const gasParams = {
        type: 'Sell' as const,
        token: operation.token,
        amountIn,
        amountOutMin: minMon,
        to: this.trade.account.address,
        deadline,
      }

      const estimatedGas = await this.trade.estimateGas(router.router, gasParams)
      const gasWithBuffer = (estimatedGas * 120n) / 100n

      // Execute sell
      const txHash = await this.trade.sell(
        {
          token: operation.token,
          to: this.trade.account.address,
          amountIn,
          amountOutMin: minMon,
          deadline: Number(deadline),
          gasLimit: gasWithBuffer,
          gasPrice,
        },
        router.router
      )

      return {
        operation,
        success: true,
        txHash,
        expectedAmount: quote.amount,
      }
    } catch (error: any) {
      return {
        operation,
        success: false,
        error: error.message || String(error),
      }
    }
  }

  /**
   * Execute a sell with permit operation
   */
  private async executeSellPermit(
    operation: BundledOperation & { type: 'sellPermit' }
  ): Promise<BundledOperationResult> {
    try {
      const slippage = operation.slippagePercent || this.config.defaultSlippagePercent || 5.0

      // Get token decimals
      const decimals = await this.token.getDecimals(operation.token)
      const amountIn = parseUnits(operation.amountIn, decimals)

      // Check balance
      const balance = await this.token.getBalance(operation.token)
      if (balance < amountIn) {
        return {
          operation,
          success: false,
          error: `Insufficient token balance: ${balance.toString()} < ${amountIn.toString()}`,
        }
      }

      // Get router
      const router = await this.trade.getAmountOut(operation.token, 1n, false)

      // Get quote
      const quote = await this.trade.getAmountOut(operation.token, amountIn, false)
      const minMon = calculateMinAmountOut(quote.amount, slippage)

      // Generate permit signature
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
      const permitDeadline = deadline
      const permit = await this.token.generatePermitSignature(
        operation.token,
        router.router,
        amountIn,
        permitDeadline
      )

      // Get gas price
      const gasPrice = await this.getGasPrice()

      // Estimate gas
      const gasParams = {
        type: 'SellPermit' as const,
        token: operation.token,
        amountIn,
        amountOutMin: minMon,
        amountAllowance: amountIn,
        to: this.trade.account.address,
        deadline,
        v: permit.v,
        r: permit.r as `0x${string}`,
        s: permit.s as `0x${string}`,
      }

      const estimatedGas = await this.trade.estimateGas(router.router, gasParams)
      const gasWithBuffer = (estimatedGas * 120n) / 100n

      // Execute sell with permit
      const txHash = await this.trade.sellPermit(
        {
          token: operation.token,
          to: this.trade.account.address,
          amountIn,
          amountOutMin: minMon,
          amountAllowance: amountIn,
          deadline: Number(deadline),
          gasLimit: gasWithBuffer,
          gasPrice,
          v: permit.v,
          r: permit.r as `0x${string}`,
          s: permit.s as `0x${string}`,
        },
        router.router
      )

      return {
        operation,
        success: true,
        txHash,
        expectedAmount: quote.amount,
      }
    } catch (error: any) {
      return {
        operation,
        success: false,
        error: error.message || String(error),
      }
    }
  }

  /**
   * Get gas price with multiplier and max cap
   */
  private async getGasPrice(): Promise<bigint> {
    const gasPrice = await this.trade.publicClient.getGasPrice()
    let finalGasPrice = gasPrice

    // Apply multiplier
    if (this.config.gasMultiplier && this.config.gasMultiplier > 1) {
      finalGasPrice = (gasPrice * BigInt(Math.floor(this.config.gasMultiplier * 100))) / 100n
    }

    // Apply max cap
    if (this.config.maxGasPrice && finalGasPrice > this.config.maxGasPrice) {
      finalGasPrice = this.config.maxGasPrice
    }

    return finalGasPrice
  }

  /**
   * Get wallet address
   */
  getAddress(): Address {
    return this.trade.account.address
  }
}

