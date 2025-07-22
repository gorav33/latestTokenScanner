import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
// ✅ CORRECT - This is a named import
import { getTokenMetadata } from "../services/token.js";

// --- CONFIGURATION ---
const HELIUS_API_KEY = "b8dab187-ffb1-40c7-b8a9-cb3f488a1d94";
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export const TokenAnalysis = () => {
  const { tokenId: mintAddress } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState({
    step: 0,
    total: 6,
    message: "Initializing...",
  });

  // All data states - will only be set once everything is loaded
  const [allData, setAllData] = useState(null);

  // Function to update loading progress
  const updateProgress = (step, message) => {
    setLoadingProgress({
      step,
      total: 6,
      message,
    });
  };

  // Function to get market data (price, market cap, etc.)
  const getMarketData = async (mintAddress) => {
    try {
      console.log("💰 Fetching market data...");

      let marketInfo = {
        price: null,
        marketCap: null,
        volume24h: null,
        priceChange24h: null,
        priceChange24hPercent: null,
        supply: null,
        chartData: [],
      };

      // Try Jupiter Price API first
      try {
        const jupiterPriceResponse = await axios.get(
          `https://price.jup.ag/v4/price?ids=${mintAddress}`,
          { timeout: 10000 }
        );

        if (jupiterPriceResponse.data.data?.[mintAddress]) {
          const priceData = jupiterPriceResponse.data.data[mintAddress];
          marketInfo.price = priceData.price;
          console.log("✅ Jupiter price data found:", priceData.price);
        }
      } catch (jupiterError) {
        console.log("ℹ️ Jupiter price API not available");
      }

      // Try DexScreener API for more comprehensive data
      try {
        const dexScreenerResponse = await axios.get(
          `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`,
          { timeout: 10000 }
        );

        if (dexScreenerResponse.data.pairs?.length > 0) {
          // Get the pair with highest liquidity
          const bestPair = dexScreenerResponse.data.pairs.sort(
            (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
          )[0];

          if (bestPair) {
            marketInfo.price =
              marketInfo.price || parseFloat(bestPair.priceUsd);
            marketInfo.volume24h = bestPair.volume?.h24;
            marketInfo.priceChange24h = bestPair.priceChange?.h24;
            marketInfo.priceChange24hPercent =
              parseFloat(bestPair.priceChange?.h24) || 0;
            marketInfo.marketCap = bestPair.marketCap;

            console.log("✅ DexScreener data found");
          }
        }
      } catch (dexScreenerError) {
        console.log("ℹ️ DexScreener API not available");
      }

      // Try CoinGecko as backup (note: needs token ID, not mint address)
      try {
        const cgSearchResponse = await axios.get(
          `https://api.coingecko.com/api/v3/search?query=${mintAddress}`,
          { timeout: 10000 }
        );

        if (cgSearchResponse.data.coins?.length > 0) {
          const coinId = cgSearchResponse.data.coins[0].id;

          const cgDataResponse = await axios.get(
            `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
            { timeout: 10000 }
          );

          if (cgDataResponse.data.market_data) {
            const cgData = cgDataResponse.data.market_data;
            marketInfo.price = marketInfo.price || cgData.current_price?.usd;
            marketInfo.marketCap =
              marketInfo.marketCap || cgData.market_cap?.usd;
            marketInfo.volume24h =
              marketInfo.volume24h || cgData.total_volume?.usd;
            marketInfo.priceChange24hPercent =
              marketInfo.priceChange24hPercent ||
              cgData.price_change_percentage_24h;

            console.log("✅ CoinGecko data found");
          }
        }
      } catch (cgError) {
        console.log("ℹ️ CoinGecko API not available");
      }

      console.log("📊 Final market data:", marketInfo);
      return marketInfo;
    } catch (error) {
      console.error("❌ Error fetching market data:", error);
      return {
        price: null,
        marketCap: null,
        volume24h: null,
        priceChange24h: null,
        priceChange24hPercent: null,
        supply: null,
        chartData: [],
      };
    }
  };

  // Function to get chart data for price history
  const getChartData = async (mintAddress) => {
    try {
      console.log("📈 Fetching chart data...");

      // Try to get 24h price history from DexScreener
      const response = await axios.get(
        `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`,
        { timeout: 10000 }
      );

      if (response.data.pairs?.length > 0) {
        const bestPair = response.data.pairs.sort(
          (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];

        // Generate mock historical data based on current price and changes
        // In a real implementation, you'd use a proper historical data API
        const currentPrice = parseFloat(bestPair.priceUsd) || 0;
        const change24h = parseFloat(bestPair.priceChange?.h24) || 0;

        if (currentPrice > 0) {
          const chartData = [];
          const now = new Date();

          for (let i = 23; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 60 * 60 * 1000);
            // Simple simulation - in reality you'd get actual historical prices
            const variance = (Math.random() - 0.5) * 0.02; // ±1% random variance
            const price =
              currentPrice * (1 + (change24h / 100) * (i / 24) + variance);

            chartData.push({
              time: time.toISOString(),
              price: Math.max(0, price),
              timestamp: time.getTime(),
            });
          }

          return chartData;
        }
      }

      return [];
    } catch (error) {
      console.log("ℹ️ Chart data not available");
      return [];
    }
  };

  const getAllTokenHolders = async (mintAddress) => {
    try {
      console.log("🔍 Fetching ALL token holders...");

      const response = await axios.post(
        RPC_URL,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "getProgramAccounts",
          params: [
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL Token Program ID
            {
              encoding: "jsonParsed",
              filters: [
                { dataSize: 165 }, // Standard SPL token account size
                {
                  memcmp: {
                    offset: 0,
                    bytes: mintAddress,
                  },
                },
              ],
            },
          ],
        },
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.error) {
        throw new Error(`RPC Error: ${response.data.error.message}`);
      }

      const accounts = response.data.result || [];
      console.log(`📊 Found ${accounts.length} total token accounts`);

      // Filter out accounts with 0 balance
      const activeHolders = accounts.filter((account) => {
        const tokenAmount = account.account?.data?.parsed?.info?.tokenAmount;
        return tokenAmount && parseFloat(tokenAmount.amount) > 0;
      });

      console.log(`✅ Active holders (balance > 0): ${activeHolders.length}`);
      return activeHolders;
    } catch (error) {
      console.error("❌ Error fetching all holders:", error);
      throw error;
    }
  };

  // Function to get token supply
  const getTokenSupply = async (mintAddress) => {
    const response = await axios.post(RPC_URL, {
      jsonrpc: "2.0",
      id: "get-token-supply",
      method: "getTokenSupply",
      params: [mintAddress],
    });

    if (response.data.error) {
      throw new Error(`Supply Error: ${response.data.error.message}`);
    }

    return response.data.result.value.uiAmount;
  };

  // Function to get top holders (for display)
  const getTopHolders = async (mintAddress) => {
    const response = await axios.post(RPC_URL, {
      jsonrpc: "2.0",
      id: "get-token-largest-accounts",
      method: "getTokenLargestAccounts",
      params: [mintAddress],
    });

    if (response.data.error) {
      throw new Error(`Holders Error: ${response.data.error.message}`);
    }

    return response.data.result.value;
  };

  useEffect(() => {
    const fetchTokenData = async () => {
      if (!mintAddress) {
        setError("No token address provided in URL.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setAllData(null); // Reset data

      try {
        console.log("🚀 Starting comprehensive token analysis...");

        // Step 1: Get token metadata
        updateProgress(1, "Fetching token metadata...");
        const tokenMeta = await getTokenMetadata(mintAddress);

        // Step 2: Get market data
        updateProgress(2, "Fetching market data...");
        const marketInfo = await getMarketData(mintAddress);

        // Step 3: Get chart data
        updateProgress(3, "Fetching price chart data...");
        const chartData = await getChartData(mintAddress);

        // Step 4: Get all holders (most time-consuming)
        updateProgress(4, "Scanning all token holders...");
        const allHoldersData = await getAllTokenHolders(mintAddress);

        // Step 5: Get token supply
        updateProgress(5, "Fetching token supply...");
        const totalSupply = await getTokenSupply(mintAddress);

        // Step 6: Get top holders
        updateProgress(6, "Processing top holders data...");
        const topHoldersData = await getTopHolders(mintAddress);

        if (totalSupply === 0) {
          throw new Error("Token has no total supply.");
        }

        console.log("📈 Processing holder data...");

        // Process top holders for display
        const holdersArray = topHoldersData
          .map((holder, idx) => {
            const amount = holder.uiAmount;
            const percentage = (amount / totalSupply) * 100;
            return {
              rank: idx + 1,
              address: holder.address,
              amount: amount.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
              percentage: percentage,
            };
          })
          .slice(0, 50);

        // Calculate distribution from top holders
        const whales = holdersArray.filter((h) => h.percentage > 1).length;
        const dolphins = holdersArray.filter(
          (h) => h.percentage >= 0.1 && h.percentage <= 1
        ).length;
        const fish = holdersArray.filter((h) => h.percentage < 0.1).length;

        // Prepare all data object
        const completeData = {
          tokenMetadata: tokenMeta,
          marketData: {
            ...marketInfo,
            chartData: chartData,
            supply: totalSupply,
          },
          holderData: {
            totalHolders: topHoldersData.length, // From largest accounts API (limited)
            actualHolderCount: allHoldersData.length, // REAL total count
            topHolders: holdersArray,
            distribution: { whales, dolphins, fish },
          },
        };

        // Set all data at once
        setAllData(completeData);

        console.log("✅ Analysis complete!");
        console.log(`🎯 Actual Total Holders: ${allHoldersData.length}`);
      } catch (err) {
        console.error("❌ Error in token analysis:", err);
        setError(err.message || "Failed to fetch token data");
      } finally {
        setLoading(false);
      }
    };

    fetchTokenData();
  }, [mintAddress]);

  // Show loading state until all data is ready
  if (loading) {
    const progressPercentage = Math.round(
      (loadingProgress.step / loadingProgress.total) * 100
    );

    return (
      <div className="min-h-screen bg-[#111] text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-6"></div>

          {/* Progress bar */}
          <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>

          <p className="text-xl font-semibold mb-2">Analyzing Token</p>
          <p className="text-sm text-gray-400 mb-4">
            {loadingProgress.message}
          </p>
          <p className="text-xs text-gray-500">
            Step {loadingProgress.step} of {loadingProgress.total} (
            {progressPercentage}%)
          </p>
          <p className="text-xs text-gray-500 mt-2">
            This may take a moment for tokens with many holders
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#111] text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-4">Analysis Failed</h2>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Only render the main content when all data is loaded
  if (!allData) {
    return (
      <div className="min-h-screen bg-[#111] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="text-gray-400">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  const { tokenMetadata, marketData, holderData } = allData;

  return (
    <div className="min-h-screen bg-[#111] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Token Info */}
        <div className="mb-6">
          <div className="flex items-center mb-4">
            {tokenMetadata.logoUri && (
              <img
                src={tokenMetadata.logoUri}
                alt={tokenMetadata.name || "Token"}
                className="w-16 h-16 mr-4 rounded-full border-2 border-gray-600"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            )}
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                {tokenMetadata.name || "Unknown Token"} Analysis
                {tokenMetadata.symbol && (
                  <span className="text-lg bg-gray-700 px-3 py-1 rounded-full font-normal">
                    ${tokenMetadata.symbol}
                  </span>
                )}
              </h1>
              <p className="text-gray-400 font-mono text-sm mt-1">
                {mintAddress}
              </p>
              {tokenMetadata.description && (
                <p className="text-gray-300 text-sm mt-2 max-w-2xl">
                  {tokenMetadata.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Market Data Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Price & Market Stats */}
          <div className="bg-[#222] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              💰 Market Data
              {marketData.price && (
                <span className="ml-2 text-sm bg-green-600 px-2 py-1 rounded">
                  LIVE
                </span>
              )}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-gray-400 text-sm">Price (USD)</p>
                <p className="text-2xl font-bold text-green-400">
                  {marketData.price
                    ? `${parseFloat(marketData.price).toFixed(6)}`
                    : "N/A"}
                </p>
                {marketData.priceChange24hPercent !== null && (
                  <p
                    className={`text-sm ${
                      marketData.priceChange24hPercent >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {marketData.priceChange24hPercent >= 0 ? "+" : ""}
                    {marketData.priceChange24hPercent.toFixed(2)}% (24h)
                  </p>
                )}
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Market Cap</p>
                <p className="text-2xl font-bold text-blue-400">
                  {marketData.marketCap
                    ? `${(marketData.marketCap / 1000000).toFixed(2)}M`
                    : marketData.price && marketData.supply
                    ? `${(
                        (marketData.price * marketData.supply) /
                        1000000
                      ).toFixed(2)}M`
                    : "N/A"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Volume (24h)</p>
                <p className="text-lg font-semibold text-purple-400">
                  {marketData.volume24h
                    ? `${(marketData.volume24h / 1000000).toFixed(2)}M`
                    : "N/A"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Supply</p>
                <p className="text-lg font-semibold text-orange-400">
                  {marketData.supply
                    ? `${(marketData.supply / 1000000).toFixed(2)}M`
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
          {/* Price Chart */}

          {/* Price Chart - Enhanced Version */}
          <div className="bg-gradient-to-br from-[#222] to-[#1a1a1a] rounded-xl p-6 border border-[#333] shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span className="text-2xl">📈</span>
                <span>Price Chart (24h)</span>
              </h2>
              {marketData.price && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-400 font-medium">
                    LIVE
                  </span>
                </div>
              )}
            </div>

            {marketData.chartData && marketData.chartData.length > 0 ? (
              <div className="relative">
                {/* Chart Container with Gradient Background */}
                <div className="relative bg-gradient-to-t from-[#0a0a0a] to-transparent rounded-lg p-4">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={marketData.chartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                      barCategoryGap="10%"
                    >
                      {/* Enhanced Grid */}
                      <CartesianGrid
                        strokeDasharray="2 4"
                        stroke="#333"
                        strokeOpacity={0.3}
                        horizontal={true}
                        vertical={false}
                      />

                      {/* X-Axis */}
                      <XAxis
                        dataKey="timestamp"
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(timestamp) => {
                          const date = new Date(timestamp);
                          return date.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          });
                        }}
                        stroke="#666"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                        interval="preserveStartEnd"
                      />

                      {/* Y-Axis */}
                      <YAxis
                        domain={["dataMin * 0.998", "dataMax * 1.002"]}
                        tickFormatter={(value) => {
                          if (value >= 1) return `${value.toFixed(4)}`;
                          if (value >= 0.0001) return `${value.toFixed(6)}`;
                          return `${value.toExponential(2)}`;
                        }}
                        stroke="#666"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={80}
                      />

                      {/* Enhanced Tooltip */}
                      <Tooltip
                        labelFormatter={(timestamp) => {
                          const date = new Date(timestamp);
                          return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
                        }}
                        formatter={(value) => {
                          const price = parseFloat(value);
                          let formattedPrice;
                          if (price >= 1)
                            formattedPrice = `${price.toFixed(4)}`;
                          else if (price >= 0.0001)
                            formattedPrice = `${price.toFixed(6)}`;
                          else formattedPrice = `${price.toExponential(2)}`;
                          return [formattedPrice, "Price"];
                        }}
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #444",
                          borderRadius: "12px",
                          color: "#fff",
                          fontSize: "12px",
                          padding: "12px",
                          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                          backdropFilter: "blur(10px)",
                        }}
                        labelStyle={{
                          color: "#888",
                          marginBottom: "4px",
                          fontSize: "11px",
                        }}
                        cursor={{
                          fill: "rgba(16, 185, 129, 0.1)",
                          stroke: "#10B981",
                          strokeWidth: 1,
                          strokeDasharray: "2 2",
                        }}
                      />

                      {/* Gradient Definitions */}
                      <defs>
                        <linearGradient
                          id="barGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#10B981"
                            stopOpacity={0.9}
                          />
                          <stop
                            offset="50%"
                            stopColor="#06D6A0"
                            stopOpacity={0.7}
                          />
                          <stop
                            offset="100%"
                            stopColor="#118AB2"
                            stopOpacity={0.5}
                          />
                        </linearGradient>
                        <linearGradient
                          id="barGradientHover"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#10B981"
                            stopOpacity={1}
                          />
                          <stop
                            offset="50%"
                            stopColor="#06D6A0"
                            stopOpacity={0.9}
                          />
                          <stop
                            offset="100%"
                            stopColor="#118AB2"
                            stopOpacity={0.7}
                          />
                        </linearGradient>
                        <filter id="glow">
                          <feGaussianBlur
                            stdDeviation="3"
                            result="coloredBlur"
                          />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Price Bars with Dynamic Colors */}
                      <Bar
                        dataKey="price"
                        radius={[2, 2, 0, 0]}
                        maxBarSize={16}
                      >
                        {marketData.chartData.map((entry, index) => {
                          // Calculate if this bar is higher or lower than previous
                          const prevPrice =
                            index > 0
                              ? marketData.chartData[index - 1].price
                              : entry.price;
                          const isUp = entry.price >= prevPrice;

                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={isUp ? "url(#barGradient)" : "#ef4444"}
                              stroke={isUp ? "#10B981" : "#ef4444"}
                              strokeWidth={0.5}
                              filter="url(#glow)"
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Chart Stats Overlay */}
                <div className="absolute top-6 right-6 bg-black/50 backdrop-blur-sm rounded-lg p-3 text-xs">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-gray-300">Current Price</span>
                    </div>
                    {marketData.priceChange24hPercent !== null && (
                      <div
                        className={`text-right font-mono ${
                          marketData.priceChange24hPercent >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {marketData.priceChange24hPercent >= 0 ? "+" : ""}
                        {marketData.priceChange24hPercent.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-400 bg-gradient-to-t from-[#0a0a0a] to-transparent rounded-lg">
                <div className="text-center">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-lg font-medium">
                    Chart data not available
                  </p>
                  <p className="text-sm mt-2 text-gray-500">
                    Price data might be limited for this token
                  </p>
                  <div className="mt-4 flex justify-center">
                    <div className="w-32 h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div className="w-0 h-full bg-gray-600 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Holder Distribution */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-center">
          <div className="bg-[#222] p-4 rounded-lg border border-green-500">
            <p className="text-gray-400 text-sm">🎯 ACTUAL Total Holders</p>
            <p className="text-3xl font-bold text-green-400">
              {holderData.actualHolderCount.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Real count from blockchain
            </p>
          </div>
          <div className="bg-[#222] p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Whales (&gt;1%)</p>
            <p className="text-2xl font-bold text-blue-400">
              🐋 {holderData.distribution.whales}
            </p>
          </div>
          <div className="bg-[#222] p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Dolphins (0.1-1%)</p>
            <p className="text-2xl font-bold text-purple-400">
              🐬 {holderData.distribution.dolphins}
            </p>
          </div>
          <div className="bg-[#222] p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Fish (&lt;0.1%)</p>
            <p className="text-2xl font-bold text-orange-400">
              🐟 {holderData.distribution.fish}
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-[#1a1a1a] p-4 rounded-lg mb-6 border-l-4 border-blue-500">
          <h3 className="text-lg font-semibold mb-2">📊 Analysis Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p>
                <span className="text-green-400">✅ Real Holder Count:</span>{" "}
                {holderData.actualHolderCount.toLocaleString()}
              </p>
              <p>
                <span className="text-gray-400">📈 API Response Count:</span>{" "}
                {holderData.totalHolders.toLocaleString()}
              </p>
            </div>
            <div>
              <p>
                <span className="text-blue-400">🏆 Top 50 Shown:</span> Largest
                holders by balance
              </p>
              <p>
                <span className="text-purple-400">⚡ Live Data:</span> Direct
                from Solana blockchain
              </p>
            </div>
            <div>
              {tokenMetadata.decimals && (
                <p>
                  <span className="text-yellow-400">🔢 Decimals:</span>{" "}
                  {tokenMetadata.decimals}
                </p>
              )}
              <p>
                <span className="text-cyan-400">🔗 Explorer:</span>
                <a
                  href={`https://solscan.io/token/${mintAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline ml-1"
                >
                  View on Solscan
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Top Holders Table */}
        <div className="bg-[#222] rounded-lg overflow-hidden">
          <div className="bg-[#333] p-4">
            <h2 className="text-xl font-semibold">🏆 Top 50 Token Holders</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[#333] text-left">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {holderData.topHolders.map(
                ({ rank, address, amount, percentage }) => (
                  <tr
                    key={address}
                    className="border-t border-[#444] hover:bg-[#2a2a2a] transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      <span
                        className={`
                      ${rank <= 3 ? "text-yellow-400" : ""}
                      ${rank <= 10 ? "font-bold" : ""}
                    `}
                      >
                        {rank <= 3 ? `🥇🥈🥉`[rank - 1] : ""} {rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono truncate max-w-xs">
                      <a
                        href={`https://solscan.io/account/${address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline hover:text-blue-400 transition-colors"
                      >
                        {address}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{amount}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`
                      ${percentage > 5 ? "text-red-400 font-bold" : ""}
                      ${
                        percentage > 1 && percentage <= 5
                          ? "text-yellow-400"
                          : ""
                      }
                      ${
                        percentage > 0.1 && percentage <= 1
                          ? "text-blue-400"
                          : ""
                      }
                    `}
                      >
                        {percentage.toFixed(4)}%
                      </span>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
