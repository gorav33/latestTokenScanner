// Add these imports and state to your existing TokenAnalysis component

import React, { useState, useEffect } from "react";
// ... your existing imports

// Helper function to get complete holder profile
const getCompleteHolderProfile = async (holderAddress, mintAddress) => {
  try {
    // Replace with your actual API endpoint
    const response = await fetch(
      `/api/holder-profile/${holderAddress}?mint=${mintAddress}`
    );
    if (!response.ok) throw new Error("Failed to fetch holder profile");

    const data = await response.json();

    // Structure the response data
    return {
      address: holderAddress,
      name: data.name || null,
      domains: data.domains || [],
      isContract: data.isContract || false,
      accountType: data.accountType || "wallet",
      balance: data.balance || 0,
      solBalance: data.solBalance || 0,
      transactions: data.transactions || [],
      tokenPortfolio: data.tokenPortfolio || [],
      socialLinks: data.socialLinks || {},
      createdAt: data.createdAt || null,
      lastActivity: data.lastActivity || null,
      totalTransactions: data.totalTransactions || 0,
      tradingVolume: data.tradingVolume || 0,
      riskScore: data.riskScore || null,
    };
  } catch (error) {
    console.error("Error fetching holder profile:", error);
    throw error;
  }
};

// Add these new state variables to your component
export const TokenAnalysis = () => {
  // ... your existing states

  // New states for holder details
  const [selectedHolder, setSelectedHolder] = useState(null);
  const [holderProfile, setHolderProfile] = useState(null);
  const [holderModalOpen, setHolderModalOpen] = useState(false);
  const [loadingHolderProfile, setLoadingHolderProfile] = useState(false);

  // Function to handle holder click
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

  // Function to close holder modal
  const closeHolderModal = () => {
    setHolderModalOpen(false);
    setSelectedHolder(null);
    setHolderProfile(null);
    setLoadingHolderProfile(false);
  };

  // Add this helper function to format transaction types
  const getTransactionIcon = (type) => {
    switch (type) {
      case "send":
        return "📤";
      case "receive":
        return "📥";
      case "swap":
        return "🔄";
      case "mint":
        return "🪙";
      case "burn":
        return "🔥";
      case "transfer":
        return "💸";
      case "stake":
        return "🔒";
      case "unstake":
        return "🔓";
      default:
        return "📋";
    }
  };

  // Helper function to get risk score color
  const getRiskScoreColor = (score) => {
    if (!score) return "text-gray-400";
    if (score >= 80) return "text-red-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-green-500";
  };

  // Helper function to format large numbers
  const formatNumber = (num) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
    return num.toString();
  };

  // Update your existing table row to be clickable
  const renderHoldersTable = () => (
    <tbody>
      {holderData.topHolders.map(({ rank, address, amount, percentage }) => (
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
                ${percentage > 1 && percentage <= 5 ? "text-yellow-400" : ""}
                ${percentage > 0.1 && percentage <= 1 ? "text-blue-400" : ""}
              `}
            >
              {percentage.toFixed(4)}%
            </span>
          </td>
        </tr>
      ))}
    </tbody>
  );

  // Add this modal component before your return statement
  const HolderDetailsModal = () => {
    if (!holderModalOpen) return null;

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
                      <p className="text-gray-400 text-sm mb-1">Name</p>
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
                        {formatNumber(holderProfile.totalTransactions)}
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
                        {holderProfile.solBalance.toFixed(2)}
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

  // Make sure to include the modal in your main component return
  return (
    <div className="token-analysis">
      {/* Your existing component JSX */}

      {/* Holders Table */}
      <div className="bg-[#1a1a1a] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#333]">
            <tr>
              <th className="px-4 py-3 text-left">Rank</th>
              <th className="px-4 py-3 text-left">Address</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">%</th>
            </tr>
          </thead>
          {renderHoldersTable()}
        </table>
      </div>

      {/* Holder Details Modal */}
      <HolderDetailsModal />
    </div>
  );
};

export default handleHolderClick;
