import type { Address } from 'viem'
import { Trade } from '../trading/trade'
import { Token } from '../token/token'
import { Stream as CurveStream } from '../stream/curve/stream'
import { CurveEventType, CreateEvent } from '../types'
import { calculateMinAmountOut, parseEther, formatEther } from '../trading/slippage'
import { formatUnits, parseEther as viemParseEther } from 'viem'

/**
 * Configuration for the sniper bot
 */
export interface SniperConfig {
  /** RPC URL for HTTP operations */
  rpcUrl: string
  /** WebSocket URL for event streaming */
  wsUrl: string
  /** Private key for wallet */
  privateKey: string
  /** Amount of MON to spend per buy (in ether, e.g., "0.1") */
  buyAmount: string
  /** Slippage tolerance percentage (e.g., 5.0 for 5%) */
  slippagePercent: number
  /** Gas price multiplier (e.g., 1.2 for 20% higher gas) */
  gasMultiplier?: number
  /** Maximum gas price in gwei (optional) */
  maxGasPrice?: bigint
  /** Minimum time between buys in milliseconds (rate limiting) */
  minBuyInterval?: number
  /** Optional token filter - only buy tokens matching these addresses */
  tokenWhitelist?: Address[]
  /** Optional token filter - skip tokens matching these addresses */
  tokenBlacklist?: Address[]
  /** Optional callback for token filtering */
  tokenFilter?: (event: CreateEvent) => Promise<boolean> | boolean
  /** Enable/disable auto-buy */
  autoBuy?: boolean
}

/**
 * Sniper bot for automatically buying new tokens on bonding curve
 * 
 * Monitors CurveCreate events and automatically executes buy transactions
 * 
 * @example
 * ```typescript
 * const sniper = new SniperBot({
 *   rpcUrl: 'https://rpc-url',
 *   wsUrl: 'wss://ws-url',
 *   privateKey: '0x...',
 *   buyAmount: '0.1',
 *   slippagePercent: 5.0,
 *   gasMultiplier: 1.2,
 * })
 * 
 * sniper.onBuySuccess((event, txHash) => {
 *   console.log(`Bought ${event.token} at ${txHash}`)
 * })
 * 
 * sniper.onBuyError((event, error) => {
 *   console.error(`Failed to buy ${event.token}:`, error)
 * })
 * 
 * await sniper.start()
 * ```
 */
export class SniperBot {
  private trade: Trade
  private token: Token
  private stream: CurveStream
  private config: SniperConfig
  private isRunning: boolean = false
  private lastBuyTime: number = 0
  private buyCallbacks: Array<(event: CreateEvent, txHash: string) => void> = []
  private errorCallbacks: Array<(event: CreateEvent, error: Error) => void> = []
  private stats = {
    totalEvents: 0,
    totalBuys: 0,
    successfulBuys: 0,
    failedBuys: 0,
    skippedBuys: 0,
  }

  constructor(config: SniperConfig) {
    this.config = {
      gasMultiplier: 1.2,
      minBuyInterval: 1000,
      autoBuy: true,
      ...config,
    }

    this.trade = new Trade(this.config.rpcUrl, this.config.privateKey)
    this.token = new Token(this.config.rpcUrl, this.config.privateKey)
    this.stream = new CurveStream(this.config.wsUrl)

    // Subscribe to Create events only
    this.stream.subscribeEvents([CurveEventType.Create])
  }

  /**
   * Add callback for successful buys
   */
  onBuySuccess(callback: (event: CreateEvent, txHash: string) => void): void {
    this.buyCallbacks.push(callback)
  }

  /**
   * Add callback for buy errors
   */
  onBuyError(callback: (event: CreateEvent, error: Error) => void): void {
    this.errorCallbacks.push(callback)
  }

  /**
   * Start the sniper bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Sniper bot is already running')
      return
    }

    console.log('🎯 Starting Sniper Bot...')
    console.log(`   Wallet: ${this.trade.account.address}`)
    console.log(`   Buy Amount: ${this.config.buyAmount} MON`)
    console.log(`   Slippage: ${this.config.slippagePercent}%`)
    console.log(`   Gas Multiplier: ${this.config.gasMultiplier}x`)
    console.log(`   Auto-Buy: ${this.config.autoBuy ? 'Enabled' : 'Disabled'}`)
    console.log('')

    // Set up event listener
    this.stream.onEvent(async (event) => {
      if (event.type === CurveEventType.Create) {
        await this.handleCreateEvent(event as CreateEvent)
      }
    })

    // Start streaming
    await this.stream.start()
    this.isRunning = true

    console.log('✅ Sniper bot is now monitoring for new tokens...')
    console.log('⏳ Press Ctrl+C to stop')
  }

  /**
   * Stop the sniper bot
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    console.log('🛑 Stopping sniper bot...')
    this.stream.stop()
    this.isRunning = false

    console.log('\n📊 Final Stats:')
    console.log(`   Total Events: ${this.stats.totalEvents}`)
    console.log(`   Total Buys Attempted: ${this.stats.totalBuys}`)
    console.log(`   Successful: ${this.stats.successfulBuys}`)
    console.log(`   Failed: ${this.stats.failedBuys}`)
    console.log(`   Skipped: ${this.stats.skippedBuys}`)
  }

  /**
   * Handle token creation event
   */
  private async handleCreateEvent(event: CreateEvent): Promise<void> {
    this.stats.totalEvents++

    console.log(`\n🎉 New token created!`)
    console.log(`   Token: ${event.token}`)
    console.log(`   Name: ${event.name} (${event.symbol})`)
    console.log(`   Creator: ${event.creator}`)
    console.log(`   Block: ${event.blockNumber}`)
    console.log(`   TX: ${event.transactionHash}`)

    // Check rate limiting
    const now = Date.now()
    if (now - this.lastBuyTime < (this.config.minBuyInterval || 1000)) {
      console.log(`   ⏭️ Skipped (rate limit)`)
      this.stats.skippedBuys++
      return
    }

    // Check whitelist
    if (this.config.tokenWhitelist && this.config.tokenWhitelist.length > 0) {
      const isWhitelisted = this.config.tokenWhitelist.some(
        addr => addr.toLowerCase() === event.token.toLowerCase()
      )
      if (!isWhitelisted) {
        console.log(`   ⏭️ Skipped (not in whitelist)`)
        this.stats.skippedBuys++
        return
      }
    }

    // Check blacklist
    if (this.config.tokenBlacklist && this.config.tokenBlacklist.length > 0) {
      const isBlacklisted = this.config.tokenBlacklist.some(
        addr => addr.toLowerCase() === event.token.toLowerCase()
      )
      if (isBlacklisted) {
        console.log(`   ⏭️ Skipped (blacklisted)`)
        this.stats.skippedBuys++
        return
      }
    }

    // Check custom filter
    if (this.config.tokenFilter) {
      try {
        const shouldBuy = await this.config.tokenFilter(event)
        if (!shouldBuy) {
          console.log(`   ⏭️ Skipped (custom filter)`)
          this.stats.skippedBuys++
          return
        }
      } catch (error) {
        console.error(`   ❌ Filter error:`, error)
        this.stats.skippedBuys++
        return
      }
    }

    // Execute buy if auto-buy is enabled
    if (this.config.autoBuy) {
      await this.executeBuy(event)
    } else {
      console.log(`   ℹ️ Auto-buy disabled, skipping purchase`)
    }
  }

  /**
   * Execute buy transaction
   */
  private async executeBuy(event: CreateEvent): Promise<void> {
    this.stats.totalBuys++
    this.lastBuyTime = Date.now()

    try {
      const tokenAddress = event.token as Address
      const buyAmount = viemParseEther(this.config.buyAmount)

      // Check balance
      const balance = await this.trade.publicClient.getBalance({
        address: this.trade.account.address,
      })

      if (balance < buyAmount) {
        throw new Error(`Insufficient balance: ${formatEther(balance)} MON < ${this.config.buyAmount} MON`)
      }

      console.log(`   💰 Executing buy...`)
      console.log(`      Amount: ${this.config.buyAmount} MON`)

      // Get quote
      const quote = await this.trade.getAmountOut(tokenAddress, buyAmount, true)
      const minTokens = calculateMinAmountOut(quote.amount, this.config.slippagePercent)

      console.log(`      Expected: ${formatUnits(quote.amount, 18)} tokens`)
      console.log(`      Minimum: ${formatUnits(minTokens, 18)} tokens (${this.config.slippagePercent}% slippage)`)

      // Get current gas price
      const gasPrice = await this.trade.publicClient.getGasPrice()
      let finalGasPrice = gasPrice

      // Apply gas multiplier
      if (this.config.gasMultiplier && this.config.gasMultiplier > 1) {
        finalGasPrice = (gasPrice * BigInt(Math.floor(this.config.gasMultiplier * 100))) / 100n
      }

      // Check max gas price
      if (this.config.maxGasPrice && finalGasPrice > this.config.maxGasPrice) {
        finalGasPrice = this.config.maxGasPrice
        console.log(`      ⚠️ Gas price capped at ${formatUnits(finalGasPrice, 9)} gwei`)
      }

      console.log(`      Gas Price: ${formatUnits(finalGasPrice, 9)} gwei`)

      // Estimate gas
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 300) // 5 minutes
      const gasParams = {
        type: 'Buy' as const,
        token: tokenAddress,
        amountIn: buyAmount,
        amountOutMin: minTokens,
        to: this.trade.account.address,
        deadline,
      }

      const estimatedGas = await this.trade.estimateGas(quote.router, gasParams)
      const gasWithBuffer = (estimatedGas * 120n) / 100n // 20% buffer

      console.log(`      Gas Limit: ${gasWithBuffer.toString()}`)

      // Execute buy
      const txHash = await this.trade.buy(
        {
          token: tokenAddress,
          to: this.trade.account.address,
          amountIn: buyAmount,
          amountOutMin: minTokens,
          deadline: Number(deadline),
          gasLimit: gasWithBuffer,
          gasPrice: finalGasPrice,
        },
        quote.router
      )

      this.stats.successfulBuys++
      console.log(`   ✅ Buy successful!`)
      console.log(`      TX Hash: ${txHash}`)
      console.log(`      Explorer: https://testnet.monadexplorer.com/tx/${txHash}`)

      // Call success callbacks
      this.buyCallbacks.forEach(callback => {
        try {
          callback(event, txHash)
        } catch (error) {
          console.error('Error in buy success callback:', error)
        }
      })
    } catch (error: any) {
      this.stats.failedBuys++
      console.error(`   ❌ Buy failed:`, error.message || error)

      // Call error callbacks
      this.errorCallbacks.forEach(callback => {
        try {
          callback(event, error instanceof Error ? error : new Error(String(error)))
        } catch (err) {
          console.error('Error in buy error callback:', err)
        }
      })
    }
  }

  /**
   * Get current statistics
   */
  getStats() {
    return { ...this.stats }
  }

  /**
   * Check if bot is running
   */
  isActive(): boolean {
    return this.isRunning
  }
}

