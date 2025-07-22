import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getTokenMetadata } from "../services/token";
import { Sparklines, SparklinesLine, SparklinesSpots } from "react-sparklines";

export const HomePage = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrichedTokens, setEnrichedTokens] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const tokensPerPage = 10;

  // State for header refresh logic
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshCountdown, setRefreshCountdown] = useState(20);
  const intervalRef = useRef(null);

  // Add loading progress state
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Fetching tokens...");

  const navigate = useNavigate();
  const dexScreenerApi = "https://api.dexscreener.com";

  // State for filters
  const [activeFilter, setActiveFilter] = useState("All");
  const [hideLowMC, setHideLowMC] = useState(false);

  // Format large numbers (supply, market cap, etc.)
  const formatNumber = (num) => {
    if (num === null || num === undefined) return "N/A";
    if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
    return num.toFixed(2).toString();
  };

  // Format price with appropriate decimal places
  const formatPrice = (price) => {
    if (price === null || price === undefined) return "N/A";
    const numPrice = parseFloat(price);
    if (numPrice >= 1) return `$${numPrice.toFixed(2)}`;
    if (numPrice >= 0.0001) return `$${numPrice.toFixed(4)}`;
    return `$${numPrice.toFixed(8)}`;
  };

  // Dummy FUD Score generator (REPLACE WITH REAL LOGIC)
  const getFudScore = (tokenAddress) => {
    return Math.floor(Math.random() * 6);
  };

  // Function to fetch historical price data
  const fetchHistoricalPriceData = async (tokenAddress) => {
    if (!tokenAddress) return [];
    try {
      const mockPrices = Array.from({ length: 30 }, (_, i) => {
        const basePrice = Math.random() * 100 + 10;
        return basePrice + (Math.random() - 0.5) * basePrice * 0.2;
      });
      return mockPrices;
    } catch (err) {
      console.error(
        `Error fetching historical price data for ${tokenAddress}:`,
        err
      );
      return [];
    }
  };

  // Main useEffect to handle all data fetching and enrichment
  useEffect(() => {
    const fetchAllTokenData = async () => {
      setLoading(true);
      setError(null);
      setLoadingProgress(0);
      setLoadingMessage("Fetching tokens...");

      try {
        // Step 1: Fetch initial token list
        setLoadingMessage("Fetching initial token data...");
        const initialResponse = await fetch(
          `${dexScreenerApi}/token-profiles/latest/v1`
        );
        if (!initialResponse.ok) {
          throw new Error(
            `Network response for token profiles was not ok: ${initialResponse.statusText}`
          );
        }
        const initialTokensData = await initialResponse.json();
        setLoadingProgress(20);

        if (initialTokensData.length === 0) {
          setEnrichedTokens([]);
          setLoading(false);
          return;
        }

        // Step 2: Process each token with progress tracking
        setLoadingMessage("Enriching token data...");
        const totalTokens = initialTokensData.length;
        let processedTokens = 0;

        const enrichedDataPromises = initialTokensData.map(
          async (token, index) => {
            let enrichedToken = { ...token };

            // Initialize with available data from initial response
            enrichedToken.displayName =
              token.name || token.baseToken?.name || null;
            enrichedToken.displaySymbol =
              token.symbol || token.baseToken?.symbol || null;
            enrichedToken.displayImage = token.image || token.icon || null;

            enrichedToken.isCentralized =
              token.metadata?.name === "Unicoin" ||
              token.baseToken?.name === "Unicoin";

            try {
              // Fetch metadata from your service
              if (token.tokenAddress) {
                try {
                  const metadata = await getTokenMetadata(token.tokenAddress);
                  if (metadata) {
                    enrichedToken.metadata = metadata;
                    // Update display fields with metadata if available
                    if (metadata.name)
                      enrichedToken.displayName = metadata.name;
                    if (metadata.symbol)
                      enrichedToken.displaySymbol = metadata.symbol;
                    if (metadata.image)
                      enrichedToken.displayImage = metadata.image;
                  }
                } catch (metaErr) {
                  console.warn(
                    `Failed to fetch metadata for ${token.tokenAddress}:`,
                    metaErr
                  );
                }
              }

              // Fetch price data and additional token info
              const addressToFetch =
                token.tokenAddress || token.baseToken?.address;
              if (addressToFetch) {
                const pairResponse = await fetch(
                  `${dexScreenerApi}/latest/dex/tokens/${addressToFetch}`
                );
                if (pairResponse.ok) {
                  const pairData = await pairResponse.json();
                  if (pairData.pairs && pairData.pairs.length > 0) {
                    const bestPair = pairData.pairs[0];

                    // Extract token info from the best pair
                    const tokenInfo = bestPair.baseToken || bestPair.quoteToken;
                    if (tokenInfo) {
                      // Update display fields with DexScreener data if we don't have them
                      if (!enrichedToken.displayName && tokenInfo.name) {
                        enrichedToken.displayName = tokenInfo.name;
                      }
                      if (!enrichedToken.displaySymbol && tokenInfo.symbol) {
                        enrichedToken.displaySymbol = tokenInfo.symbol;
                      }
                      if (
                        !enrichedToken.displayImage &&
                        bestPair.info?.imageUrl
                      ) {
                        enrichedToken.displayImage = bestPair.info.imageUrl;
                      }
                    }

                    enrichedToken.priceData = {
                      price: bestPair.priceUsd,
                      priceChange24h: bestPair.priceChange?.h24,
                      priceChange5m: bestPair.priceChange?.m5,
                      volume24h: bestPair.volume?.h24,
                      marketCap: bestPair.marketCap,
                      liquidity: bestPair.liquidity?.usd,
                      fdv: bestPair.fdv,
                      pairAddress: bestPair.pairAddress,
                      dexId: bestPair.dexId,
                      url: bestPair.url,
                    };
                  }
                } else {
                  console.warn(
                    `Failed to fetch pair data for ${addressToFetch}: ${pairResponse.statusText}`
                  );
                }

                // Fetch historical data
                enrichedToken.historicalPrices = await fetchHistoricalPriceData(
                  addressToFetch
                );
              }

              // Try to get token info from Jupiter API as fallback
              if (!enrichedToken.displayName || !enrichedToken.displaySymbol) {
                try {
                  const jupiterResponse = await fetch(
                    `https://token.jup.ag/strict`
                  );
                  if (jupiterResponse.ok) {
                    const jupiterTokens = await jupiterResponse.json();
                    const jupiterToken = jupiterTokens.find(
                      (t) => t.address === addressToFetch
                    );
                    if (jupiterToken) {
                      if (!enrichedToken.displayName)
                        enrichedToken.displayName = jupiterToken.name;
                      if (!enrichedToken.displaySymbol)
                        enrichedToken.displaySymbol = jupiterToken.symbol;
                      if (!enrichedToken.displayImage)
                        enrichedToken.displayImage = jupiterToken.logoURI;
                    }
                  }
                } catch (jupErr) {
                  console.warn(
                    `Jupiter API failed for ${addressToFetch}:`,
                    jupErr
                  );
                }
              }

              enrichedToken.fudScore = getFudScore(token.tokenAddress);
            } catch (err) {
              console.error(
                `❌ Error enriching token ${
                  token.tokenAddress || token.baseToken?.address
                }:`,
                err
              );
              enrichedToken.priceData = enrichedToken.priceData || {};
              enrichedToken.historicalPrices =
                enrichedToken.historicalPrices || [];
            }

            // Update progress
            processedTokens++;
            const progress =
              20 + Math.floor((processedTokens / totalTokens) * 70);
            setLoadingProgress(progress);
            setLoadingMessage(
              `Processing ${
                enrichedToken.displayName || "token"
              } (${processedTokens}/${totalTokens})...`
            );

            return enrichedToken;
          }
        );

        // Step 3: Wait for all enrichment to complete
        setLoadingMessage("Finalizing data...");
        const finalEnrichedData = await Promise.allSettled(
          enrichedDataPromises
        );

        // Step 4: Filter successful enrichments
        const successfulEnrichments = finalEnrichedData
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value)
          .filter((token) => {
            // Only include tokens that have meaningful data
            return (
              token.displayName ||
              token.priceData?.price ||
              token.tokenAddress ||
              token.baseToken?.address
            );
          });

        setLoadingProgress(100);
        setLoadingMessage("Data loaded successfully!");

        // Small delay to show 100% completion
        setTimeout(() => {
          setEnrichedTokens(successfulEnrichments);
          setLoading(false);
          setLastUpdated(new Date());
          setRefreshCountdown(20);
        }, 500);
      } catch (err) {
        console.error("❌ Failed to fetch all token data:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    // Initial fetch when component mounts
    fetchAllTokenData();

    // Setup the main data refresh interval
    intervalRef.current = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchAllTokenData();
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup interval on component unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // --- Filtering Logic ---
  const filteredTokens = enrichedTokens.filter((token) => {
    if (
      hideLowMC &&
      (!token.priceData?.marketCap || token.priceData.marketCap < 100000)
    ) {
      return false;
    }

    if (activeFilter === "Low FUD" && token.fudScore > 1) return false;
    if (
      activeFilter === "Medium FUD" &&
      (token.fudScore < 2 || token.fudScore > 3)
    )
      return false;
    if (activeFilter === "High FUD" && token.fudScore < 4) return false;

    if (
      activeFilter === "Pumping" &&
      (token.priceData?.priceChange24h === undefined ||
        token.priceData.priceChange24h <= 5)
    )
      return false;
    if (
      activeFilter === "Dumping" &&
      (token.priceData?.priceChange24h === undefined ||
        token.priceData.priceChange24h >= -5)
    )
      return false;

    return true;
  });

  // Pagination calculations
  const indexOfLastToken = currentPage * tokensPerPage;
  const indexOfFirstToken = indexOfLastToken - tokensPerPage;
  const paginatedTokens = filteredTokens.slice(
    indexOfFirstToken,
    indexOfLastToken
  );
  const totalPages = Math.ceil(filteredTokens.length / tokensPerPage);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111] text-white p-8 flex items-center justify-center">
        <div className="text-center max-w-md w-full">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-6"></div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>

          {/* Loading Message and Progress */}
          <div className="text-lg mb-2">{loadingMessage}</div>
          <div className="text-sm text-gray-400">
            {loadingProgress}% complete
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#111] text-white p-8">
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
          <h2 className="text-red-400 font-bold mb-2">Error Loading Tokens</h2>
          <p className="text-red-300">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111] text-white">
      {/* HEADER SECTION START */}
      <header className="bg-gray-900 py-4 px-8 border-b border-gray-700">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex flex-col">
            <div className="text-3xl font-bold text-green-500 flex items-center">
              <span className="mr-2">🛡️</span> Token Analyzer
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Your Shield Against Rugs. On Solana.
            </p>
          </div>

          <div className="text-sm text-gray-400">
            {lastUpdated && (
              <span>
                Last updated:{" "}
                {lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                <span className="ml-2">
                  (refreshing in {refreshCountdown}s)
                </span>
              </span>
            )}
          </div>
        </div>
      </header>
      {/* HEADER SECTION END */}

      <div className="max-w-7xl mx-auto p-8">
        {/* Filters Section */}
        <div className="flex flex-wrap gap-2 mb-6 items-center">
          <div className="text-gray-400 mr-2">Filters:</div>
          {[
            "All",
            "Low FUD",
            "Medium FUD",
            "High FUD",
            "Pumping",
            "Dumping",
          ].map((filter) => (
            <button
              key={filter}
              onClick={() => {
                setActiveFilter(filter);
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm transition-colors duration-200
                ${
                  activeFilter === filter
                    ? "bg-green-600 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                }`}
            >
              {filter}
            </button>
          ))}
          <label className="flex items-center ml-4 cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox h-4 w-4 text-green-600 bg-gray-900 border-gray-600 rounded"
              checked={hideLowMC}
              onChange={() => {
                setHideLowMC(!hideLowMC);
                setCurrentPage(1);
              }}
            />
            <span className="ml-2 text-gray-200 text-sm">Hide Low MC</span>
          </label>
        </div>

        {/* Token Table */}
        <div className="overflow-x-auto bg-[#1a1a1a] rounded-xl shadow-lg border border-gray-800">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-[#2a2a2a]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  TOKEN
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  PRICE
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  CHANGE (24H)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  VOLUME (24H)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  LIQUIDITY
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  MARKET CAP
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  FUD SCORE
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  LINKS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {paginatedTokens.length > 0 ? (
                paginatedTokens.map((token) => (
                  <tr
                    key={
                      token.tokenAddress ||
                      token.baseToken?.address ||
                      Math.random()
                    }
                    className="hover:bg-[#1f1f1f] transition-colors duration-150 cursor-pointer"
                    onClick={() =>
                      navigate(
                        `/token/${
                          token.tokenAddress || token.baseToken?.address
                        }`
                      )
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          {token.displayImage ? (
                            <img
                              className="h-8 w-8 rounded-full object-cover"
                              src={token.displayImage}
                              alt={`${token.displayName || "Token"} logo`}
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div
                            className={`h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-sm font-bold text-white ${
                              token.displayImage ? "hidden" : ""
                            }`}
                          >
                            {token.displaySymbol
                              ? token.displaySymbol.charAt(0).toUpperCase()
                              : token.displayName
                              ? token.displayName.charAt(0).toUpperCase()
                              : "?"}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-white">
                            {token.displayName ||
                              token.metadata?.name ||
                              token.baseToken?.name ||
                              `Token ${(
                                token.tokenAddress ||
                                token.baseToken?.address ||
                                ""
                              ).slice(0, 8)}...`}
                          </div>
                          <div className="text-xs text-gray-500">
                            {token.displaySymbol ||
                              token.metadata?.symbol ||
                              token.baseToken?.symbol ||
                              "Unknown"}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {token.isCentralized && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-blue-100">
                                Centralized
                              </span>
                            )}
                            {token.priceData?.dexId && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-600 text-gray-100">
                                {token.priceData.dexId.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">
                          {formatPrice(token.priceData?.price)}
                        </span>
                        {token.historicalPrices &&
                        token.historicalPrices.length > 0 ? (
                          <div className="mt-1">
                            <Sparklines
                              data={token.historicalPrices}
                              width={80}
                              height={15}
                              margin={0}
                            >
                              <SparklinesLine
                                style={{
                                  strokeWidth: 1,
                                  stroke: "#10B981",
                                  fill: "none",
                                }}
                              />
                              <SparklinesSpots
                                size={1.5}
                                style={{
                                  stroke: "#10B981",
                                  strokeWidth: 1,
                                  fill: "#10B981",
                                }}
                              />
                            </Sparklines>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs mt-1">
                            No history
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {token.priceData?.priceChange24h !== undefined ? (
                        <div
                          className={`flex items-center font-medium ${
                            token.priceData.priceChange24h >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {token.priceData.priceChange24h >= 0 ? (
                            <span>▲</span>
                          ) : (
                            <span>▼</span>
                          )}{" "}
                          {Math.abs(token.priceData.priceChange24h).toFixed(2)}%
                        </div>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {token.priceData?.volume24h
                        ? `$${formatNumber(token.priceData.volume24h)}`
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {token.priceData?.liquidity
                        ? `$${formatNumber(token.priceData.liquidity)}`
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {token.priceData?.marketCap
                        ? `$${formatNumber(token.priceData.marketCap)}`
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 font-medium">
                          {token.fudScore !== undefined
                            ? `${token.fudScore}/5`
                            : "N/A"}
                        </span>
                        {token.fudScore !== undefined && (
                          <div className="w-16 h-2 rounded-full bg-gray-700">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${(token.fudScore / 5) * 100}%`,
                                backgroundColor:
                                  token.fudScore <= 1
                                    ? "#22C55E"
                                    : token.fudScore <= 3
                                    ? "#FACC15"
                                    : "#EF4444",
                              }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        {token.tokenAddress || token.baseToken?.address ? (
                          <>
                            {token.priceData?.url ? (
                              <a
                                href={token.priceData.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-green-500 transition-colors"
                                title="View on DexScreener"
                                onClick={(e) => e.stopPropagation()}
                              >
                                📈
                              </a>
                            ) : (
                              <a
                                href={`https://dexscreener.com/solana/${
                                  token.tokenAddress || token.baseToken?.address
                                }`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-green-500 transition-colors"
                                title="View Chart"
                                onClick={(e) => e.stopPropagation()}
                              >
                                📈
                              </a>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const address =
                                  token.tokenAddress ||
                                  token.baseToken?.address;
                                navigator.clipboard.writeText(address);
                                // Create a temporary notification instead of alert
                                const notification =
                                  document.createElement("div");
                                notification.textContent = "Address copied!";
                                notification.className =
                                  "fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg z-50";
                                document.body.appendChild(notification);
                                setTimeout(
                                  () => document.body.removeChild(notification),
                                  2000
                                );
                              }}
                              className="text-gray-400 hover:text-white transition-colors"
                              title={`Copy Address: ${(
                                token.tokenAddress ||
                                token.baseToken?.address ||
                                ""
                              ).slice(0, 8)}...`}
                            >
                              📋
                            </button>
                          </>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="8"
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-4xl mb-2">🔍</span>
                      <div className="text-lg mb-2">No tokens found</div>
                      <div className="text-sm">Try adjusting your filters</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6 space-x-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum =
                currentPage <= 3
                  ? i + 1
                  : currentPage >= totalPages - 2
                  ? totalPages - 4 + i
                  : currentPage - 2 + i;

              if (pageNum < 1 || pageNum > totalPages) return null;

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    currentPage === pageNum
                      ? "bg-green-600 text-white"
                      : "bg-gray-700 text-white hover:bg-gray-600"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
