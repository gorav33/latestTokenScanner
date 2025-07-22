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
import { getTokenMetadata } from "../services/token.js";
import { getCompleteHolderProfile } from "../services/comprehensiveTokenService";
import { CandlestickChart } from "../components/CandlestickChart.jsx";

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
  const [selectedHolder, setSelectedHolder] = useState(null);
  const [holderProfile, setHolderProfile] = useState(null);
  const [holderModalOpen, setHolderModalOpen] = useState(false);
  const [loadingHolderProfile, setLoadingHolderProfile] = useState(false);

  // All data states - will only be set once everything is loaded
  const [allData, setAllData] = useState(null);

  const handleHolderClick = async (holderAddress) => {
    setSelectedHolder(holderAddress);
    setHolderModalOpen(true);
    setLoadingHolderProfile(true);
    setHolderProfile(null);

    try {
      const profile = await getCompleteHolderProfile(
        holderAddress,
        mintAddress
      );
      setHolderProfile(profile);
    } catch (error) {
      console.error("Error fetching holder profile:", error);
      setHolderProfile({ error: "Failed to load holder profile" });
    } finally {
      setLoadingHolderProfile(false);
    }
  };

  const getRiskScoreColor = (score) => {
    if (!score) return "text-gray-400";
    if (score >= 80) return "text-red-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-green-500";
  };

  // Helper function to format large numbers
  // Helper function to format large numbers
  const formatNumber = (num) => {
    // ✅ FIX: Check for undefined, null, or non-numeric inputs
    if (num === null || num === undefined || isNaN(num)) {
      return "0"; // Return a default value like "0" or "N/A"
    }

    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
    return num.toString();
  };
  const closeHolderModal = () => {
    setHolderModalOpen(false);
    setSelectedHolder(null);
    setHolderProfile(null);
    setLoadingHolderProfile(false);
  };

  // Function to update loading progress
  const updateProgress = (step, message) => {
    setLoadingProgress({
      step,
      total: 6,
      message,
    });
  };
  console.log(holderProfile);

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
  // 📈 Function to get real candlestick data from DexScreener
  const getCandlestickData = async (mintAddress) => {
    try {
      // 1. Search for the token to find its main trading pair address
      const searchResponse = await axios.get(
        `http://localhost:4000/api/search?mintAddress=${mintAddress}`,
        {
          headers: {
            Accept: "*/*",
          },
        }
      );
      console.log("get pair data", searchResponse);
      if (
        !searchResponse.data.pairs ||
        searchResponse.data.pairs.length === 0
      ) {
        console.log("No trading pairs found for this mint.");
        return [];
      }
      // Get the pair with the most liquidity
      const bestPair = searchResponse.data.pairs.sort(
        (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0];
      const pairAddress = bestPair.pairAddress;

      // 2. Fetch the candle data for that pair address
      const candlesResponse = await axios.get(
        `https://api.dexscreener.com/latest/dex/candles/${pairAddress}?resolution=60` // 60-min candles
      );

      return candlesResponse.data.candles || [];
    } catch (error) {
      console.error("Failed to fetch candlestick data:", error);
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

  const HolderDetailsModal = () => {
    if (!holderModalOpen) return null;

    // ✅ FIXED: Added this helper function which was missing.
    const getTransactionIcon = (type) => {
      switch (type) {
        case "TRANSFER":
        case "TOKEN_TRANSFER":
          return "↔️";
        case "SWAP":
          return "🔄";
        case "BURN":
        case "MINT":
          return "🔥";
        default:
          return "⚙️";
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
        <div className="bg-[#222] rounded-xl max-w-5xl w-full max-h-[95vh] overflow-hidden">
          {/* Modal Header */}
          <div className="bg-[#333] p-4 flex items-center justify-between border-b border-[#444]">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">👤</span>
              Holder Details
              {holderProfile?.riskScore && (
                <span
                  className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${getRiskScoreColor(
                    holderProfile.riskScore
                  )} bg-opacity-20`}
                >
                  Risk: {holderProfile.riskScore}/100
                </span>
              )}
            </h2>
            <button
              onClick={closeHolderModal}
              className="text-gray-400 hover:text-white hover:bg-[#444] rounded-full p-2 transition-colors"
            >
              <span className="text-xl">✕</span>
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(95vh-80px)]">
            {loadingHolderProfile ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-4"></div>
                <span className="text-lg">Loading holder profile...</span>
                <p className="text-sm text-gray-400 mt-2">
                  Fetching transaction history and portfolio data
                </p>
              </div>
            ) : holderProfile?.error ? (
              <div className="text-center py-16">
                <div className="text-red-500 text-6xl mb-4">❌</div>
                <p className="text-red-400 text-lg mb-4">
                  {holderProfile.error}
                </p>
                <button
                  onClick={() => handleHolderClick(selectedHolder)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : holderProfile ? (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#333]">
                  <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <span className="text-2xl">ℹ️</span>
                    Account Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Address</p>
                      <p className="font-semibold text-lg">
                        {holderProfile.name ||
                          `${holderProfile.address.slice(
                            0,
                            4
                          )}...${holderProfile.address.slice(-4)}`}
                        {holderProfile.domains?.length > 0 && (
                          <span className="ml-2 text-sm bg-blue-600 px-2 py-1 rounded">
                            .sol
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Account Type</p>
                      <p className="font-semibold capitalize">
                        {holderProfile.isContract
                          ? "🤖 Contract/Program"
                          : "👤 Wallet"}
                        <span className="ml-2 text-sm text-gray-400">
                          ({holderProfile.accountType})
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">
                        Total Transactions
                      </p>
                      <p className="font-semibold text-lg">
                        {formatNumber(holderProfile.transactions.length)}
                      </p>
                    </div>
                    <div className="md:col-span-2 lg:col-span-3">
                      <p className="text-gray-400 text-sm mb-1">Address</p>
                      <div className="flex items-center gap-3">
                        <p className="font-mono text-sm break-all flex-1">
                          {holderProfile.address}
                        </p>
                        <div className="flex gap-2">
                          <a
                            href={`https://solscan.io/account/${holderProfile.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                          >
                            Solscan
                          </a>
                          <a
                            href={`https://explorer.solana.com/address/${holderProfile.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors"
                          >
                            Explorer
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Balances */}
                <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#333]">
                  <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <span className="text-2xl">💰</span>
                    Portfolio Overview
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center bg-gradient-to-br from-green-900/30 to-green-600/20 rounded-lg p-4 border border-green-600/20">
                      <p className="text-gray-300 text-sm mb-1">
                        Token Balance
                      </p>
                      <p className="text-2xl font-bold text-green-400">
                        {formatNumber(holderProfile.balance)}
                      </p>
                    </div>
                    <div className="text-center bg-gradient-to-br from-blue-900/30 to-blue-600/20 rounded-lg p-4 border border-blue-600/20">
                      <p className="text-gray-300 text-sm mb-1">SOL Balance</p>
                      <p className="text-2xl font-bold text-blue-400">
                        {holderProfile.solBalance}
                      </p>
                    </div>
                    <div className="text-center bg-gradient-to-br from-purple-900/30 to-purple-600/20 rounded-lg p-4 border border-purple-600/20">
                      <p className="text-gray-300 text-sm mb-1">Other Tokens</p>
                      <p className="text-2xl font-bold text-purple-400">
                        {holderProfile.tokenPortfolio?.length || 0}
                      </p>
                    </div>
                    <div className="text-center bg-gradient-to-br from-orange-900/30 to-orange-600/20 rounded-lg p-4 border border-orange-600/20">
                      <p className="text-gray-300 text-sm mb-1">Trading Vol</p>
                      <p className="text-2xl font-bold text-orange-400">
                        {formatNumber(holderProfile.tradingVolume)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#333]">
                  <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <span className="text-2xl">📜</span>
                    Recent Transactions (
                    {holderProfile.transactions?.length || 0})
                  </h3>
                  {holderProfile.transactions?.length > 0 ? (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                      {holderProfile.transactions
                        .slice(0, 15)
                        .map((tx, idx) => (
                          <div
                            key={tx.signature || idx}
                            className="bg-[#333] rounded-lg p-4 hover:bg-[#3a3a3a] transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4">
                                <span className="text-2xl mt-1">
                                  {getTransactionIcon(tx.type)}
                                </span>
                                <div className="flex-1">
                                  <p className="font-semibold mb-1">
                                    {tx.description}
                                  </p>
                                  <p className="text-xs text-gray-400 font-mono mb-2">
                                    {tx.signature
                                      ? `${tx.signature.slice(0, 32)}...`
                                      : "No signature"}
                                  </p>
                                  {tx.fee && (
                                    <p className="text-xs text-gray-500">
                                      Fee: {tx.fee} SOL
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                {tx.amount > 0 && (
                                  <p className="font-mono font-semibold mb-1">
                                    {formatNumber(tx.amount)}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400">
                                  {tx.blockTime
                                    ? new Date(
                                        tx.blockTime * 1000
                                      ).toLocaleDateString()
                                    : "Unknown date"}
                                </p>
                                {tx.blockTime && (
                                  <p className="text-xs text-gray-500">
                                    {new Date(
                                      tx.blockTime * 1000
                                    ).toLocaleTimeString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <span className="text-4xl mb-4 block">📭</span>
                      <p className="text-gray-400">
                        No recent transactions found
                      </p>
                    </div>
                  )}
                </div>

                {/* Token Portfolio */}
                {holderProfile.tokenPortfolio?.length > 0 && (
                  <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#333]">
                    <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                      <span className="text-2xl">🪙</span>
                      Token Portfolio ({holderProfile.tokenPortfolio.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto pr-2">
                      {holderProfile.tokenPortfolio
                        .slice(0, 12)
                        .map((token, idx) => (
                          <div
                            key={token.mint || idx}
                            className="bg-[#333] rounded-lg p-4 hover:bg-[#3a3a3a] transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-sm mb-1">
                                  {token.symbol || "Unknown Token"}
                                </p>
                                <p className="font-mono text-xs text-gray-400 truncate">
                                  {token.mint
                                    ? `${token.mint.slice(0, 12)}...`
                                    : "No mint"}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">
                                  {formatNumber(token.balance)}
                                </p>
                                {token.value && (
                                  <p className="text-xs text-gray-400">
                                    ~${token.value.toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Social Links */}
                {holderProfile.socialLinks &&
                  Object.values(holderProfile.socialLinks).some(
                    (link) => link
                  ) && (
                    <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#333]">
                      <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <span className="text-2xl">🔗</span>
                        Social Links
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {holderProfile.socialLinks.twitter && (
                          <a
                            href={holderProfile.socialLinks.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            <span className="text-lg">🐦</span>
                            <span>Twitter</span>
                          </a>
                        )}
                        {holderProfile.socialLinks.discord && (
                          <a
                            href={holderProfile.socialLinks.discord}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                          >
                            <span className="text-lg">💬</span>
                            <span>Discord</span>
                          </a>
                        )}
                        {holderProfile.socialLinks.telegram && (
                          <a
                            href={holderProfile.socialLinks.telegram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
                          >
                            <span className="text-lg">✈️</span>
                            <span>Telegram</span>
                          </a>
                        )}
                        {holderProfile.socialLinks.website && (
                          <a
                            href={holderProfile.socialLinks.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                          >
                            <span className="text-lg">🌐</span>
                            <span>Website</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                {/* Additional Analysis */}
                {holderProfile.domains?.length > 0 && (
                  <div className="bg-[#1a1a1a] rounded-lg p-6 border border-[#333]">
                    <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                      <span className="text-2xl">🏷️</span>
                      Solana Domains
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {holderProfile.domains.map((domain, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-blue-600/20 border border-blue-600/30 rounded-full text-sm font-medium"
                        >
                          {domain}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16">
                <span className="text-6xl mb-4 block">👤</span>
                <p className="text-gray-400">No holder selected</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
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
        // const chartData = await getChartData(mintAddress); // <-- REMOVE THIS
        const chartData = await getCandlestickData(mintAddress);

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
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 mb-8">
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
              {/* Price Card */}
              <div className="bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-lg p-4 text-center">
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

              {/* Market Cap Card */}
              <div className="bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-lg p-4 text-center">
                <p className="text-gray-400 text-sm">Market Cap</p>
                <p className="text-2xl font-bold text-blue-400">
                  {marketData.marketCap
                    ? `$${(marketData.marketCap / 1000000).toFixed(2)}M`
                    : marketData.price && marketData.supply
                    ? `$${(
                        (marketData.price * marketData.supply) /
                        1000000
                      ).toFixed(2)}M`
                    : "N/A"}
                </p>
              </div>

              {/* Volume Card */}
              <div className="bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-lg p-4 text-center">
                <p className="text-gray-400 text-sm">Volume (24h)</p>
                <p className="text-lg font-semibold text-purple-400">
                  {marketData.volume24h
                    ? `$${(marketData.volume24h / 1000000).toFixed(2)}M`
                    : "N/A"}
                </p>
              </div>

              {/* Supply Card */}
              <div className="bg-[#2a2a2a] border border-gray-700 rounded-lg shadow-lg p-4 text-center">
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

        {/* ✅ FIXED: Invalid comment syntax changed to JSX style */}
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
                    onClick={() => handleHolderClick(address)}
                    className="border-t border-[#444] hover:bg-[#2a2a2a] transition-colors cursor-pointer group"
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
                    <td className="px-4 py-3 font-mono truncate max-w-xs group-hover:text-blue-400 transition-colors">
                      {address}
                      <span className="ml-2 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click for details
                      </span>
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
        {/* Holder Modal */}
        <HolderDetailsModal />
      </div>
    </div>
  );
};
