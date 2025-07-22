// Holder Details API Functions
// Add these functions to your existing token analysis component

import axios from "axios";

// --- CONFIGURATION ---
const HELIUS_API_KEY = "b8dab187-ffb1-40c7-b8a9-cb3f488a1d94";
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Function to get holder account details including name resolution
const getHolderDetails = async (holderAddress, mintAddress) => {
  try {
    console.log(`🔍 Fetching details for holder: ${holderAddress}`);

    let holderInfo = {
      address: holderAddress,
      name: null,
      avatar: null,
      balance: 0,
      balanceUsd: 0,
      isContract: false,
      programOwner: null,
      accountType: "wallet",
      socialLinks: {},
      domains: [],
      nfts: [],
      creationDate: null,
    };

    // 1. Check if it's a program/contract account
    const accountInfoResponse = await axios.post(RPC_URL, {
      jsonrpc: "2.0",
      id: "get-account-info",
      method: "getAccountInfo",
      params: [
        holderAddress,
        {
          encoding: "jsonParsed",
        },
      ],
    });

    if (accountInfoResponse.data.result?.value) {
      const accountInfo = accountInfoResponse.data.result.value;

      if (accountInfo.executable) {
        holderInfo.isContract = true;
        holderInfo.accountType = "program";
        holderInfo.programOwner = accountInfo.owner;
      } else if (accountInfo.owner !== "11111111111111111111111111111111") {
        holderInfo.accountType = "pda"; // Program Derived Account
        holderInfo.programOwner = accountInfo.owner;
      }
    }

    // 2. Get token balance for this specific token
    try {
      const tokenAccountsResponse = await axios.post(RPC_URL, {
        jsonrpc: "2.0",
        id: "get-token-accounts",
        method: "getTokenAccountsByOwner",
        params: [
          holderAddress,
          {
            mint: mintAddress,
          },
          {
            encoding: "jsonParsed",
          },
        ],
      });

      if (tokenAccountsResponse.data.result?.value?.length > 0) {
        const tokenAccount = tokenAccountsResponse.data.result.value[0];
        const tokenAmount = tokenAccount.account.data.parsed.info.tokenAmount;
        holderInfo.balance = parseFloat(tokenAmount.uiAmount) || 0;
      }
    } catch (error) {
      console.log("ℹ️ Could not fetch token balance");
    }

    // 3. Try to resolve domain names (SNS - Solana Name Service)
    try {
      const snsResponse = await axios.get(
        `https://sns-sdk-proxy.bonfida.workers.dev/resolve/${holderAddress}`,
        { timeout: 5000 }
      );

      if (snsResponse.data && snsResponse.data.length > 0) {
        holderInfo.domains = snsResponse.data;
        holderInfo.name = snsResponse.data[0]; // Use first domain as display name
      }
    } catch (error) {
      console.log("ℹ️ No SNS domain found");
    }

    // 4. Try to get profile from Solana social protocols (e.g., Cardinal)
    try {
      const profileResponse = await axios.get(
        `https://api.cardinal.so/metadata/${holderAddress}`,
        { timeout: 5000 }
      );

      if (profileResponse.data) {
        const profile = profileResponse.data;
        holderInfo.name =
          holderInfo.name || profile.displayName || profile.name;
        holderInfo.avatar = profile.image || profile.avatar;
        holderInfo.socialLinks = {
          twitter: profile.twitter,
          discord: profile.discord,
          website: profile.website,
        };
      }
    } catch (error) {
      console.log("ℹ️ No Cardinal profile found");
    }

    // 5. Check for well-known addresses (exchanges, programs, etc.)
    const knownAddresses = {
      "11111111111111111111111111111111": {
        name: "System Program",
        type: "program",
      },
      TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: {
        name: "SPL Token Program",
        type: "program",
      },
      ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL: {
        name: "Associated Token Program",
        type: "program",
      },
      "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": {
        name: "Raydium AMM",
        type: "exchange",
      },
      JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB: {
        name: "Jupiter",
        type: "exchange",
      },
      "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": {
        name: "Raydium Authority V4",
        type: "exchange",
      },
      "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1": {
        name: "Raydium Liquidity Pool",
        type: "exchange",
      },
      // Add more known addresses as needed
    };

    if (knownAddresses[holderAddress]) {
      const known = knownAddresses[holderAddress];
      holderInfo.name = known.name;
      holderInfo.accountType = known.type;
      holderInfo.isContract = true;
    }

    // 6. If still no name, try to identify by looking at recent transactions
    if (!holderInfo.name && !holderInfo.isContract) {
      try {
        const recentTxResponse = await axios.post(RPC_URL, {
          jsonrpc: "2.0",
          id: "get-signatures",
          method: "getSignaturesForAddress",
          params: [holderAddress, { limit: 5 }],
        });

        if (recentTxResponse.data.result?.length > 0) {
          const oldestTx =
            recentTxResponse.data.result[
              recentTxResponse.data.result.length - 1
            ];
          if (oldestTx.blockTime) {
            holderInfo.creationDate = new Date(oldestTx.blockTime * 1000);
          }
        }
      } catch (error) {
        console.log("ℹ️ Could not fetch transaction history");
      }
    }

    return holderInfo;
  } catch (error) {
    console.error("❌ Error fetching holder details:", error);
    return {
      address: holderAddress,
      name: null,
      balance: 0,
      error: error.message,
    };
  }
};

// Function to get holder's transaction history
const getHolderTransactions = async (
  holderAddress,
  mintAddress,
  limit = 50
) => {
  try {
    console.log(`📜 Fetching transactions for: ${holderAddress}`);

    // Get recent signatures
    const signaturesResponse = await axios.post(RPC_URL, {
      jsonrpc: "2.0",
      id: "get-signatures-for-address",
      method: "getSignaturesForAddress",
      params: [
        holderAddress,
        {
          limit: limit,
          commitment: "confirmed",
        },
      ],
    });

    if (
      !signaturesResponse.data.result ||
      signaturesResponse.data.result.length === 0
    ) {
      return [];
    }

    const signatures = signaturesResponse.data.result;
    console.log(`Found ${signatures.length} transactions`);
    // Get detailed transaction info for each signature
    const transactions = [];
    const batchSize = 10; // Process in batches to avoid rate limits

    for (let i = 0; i < signatures.length; i += batchSize) {
      const batch = signatures.slice(i, i + batchSize);
      const batchPromises = batch.map(async (sig) => {
        try {
          const txResponse = await axios.post(RPC_URL, {
            jsonrpc: "2.0",
            id: `get-transaction-${sig.signature}`,
            method: "getTransaction",
            params: [
              sig.signature,
              {
                encoding: "jsonParsed",
                maxSupportedTransactionVersion: 0,
              },
            ],
          });

          if (txResponse.data.result) {
            const tx = txResponse.data.result;

            // Parse the transaction to find token-related activities
            const parsedTx = parseTransaction(tx, holderAddress, mintAddress);
            if (parsedTx) {
              return {
                signature: sig.signature,
                blockTime: sig.blockTime,
                slot: sig.slot,
                err: sig.err,
                ...parsedTx,
              };
            }
          }
        } catch (error) {
          console.log(`ℹ️ Could not fetch transaction ${sig.signature}`);
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      transactions.push(...batchResults.filter((tx) => tx !== null));

      // Small delay between batches
      if (i + batchSize < signatures.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return transactions.sort((a, b) => b.blockTime - a.blockTime);
  } catch (error) {
    console.error("❌ Error fetching transactions:", error);
    return [];
  }
};

// Helper function to parse transaction details
const parseTransaction = (tx, holderAddress, mintAddress) => {
  try {
    if (!tx.meta || tx.meta.err) {
      return null;
    }

    let transactionType = "unknown";
    let amount = 0;
    let from = null;
    let to = null;
    let description = "Transaction";

    // Look through the instructions for token transfers
    const instructions = tx.transaction.message.instructions;

    for (const instruction of instructions) {
      if (instruction.program === "spl-token" && instruction.parsed) {
        const parsed = instruction.parsed;

        if (parsed.type === "transfer" || parsed.type === "transferChecked") {
          const info = parsed.info;

          // Check if this transfer involves our mint address
          if (parsed.type === "transferChecked" && info.mint === mintAddress) {
            amount = parseFloat(info.tokenAmount?.uiAmount || info.amount || 0);
            from = info.source;
            to = info.destination;
            transactionType = "transfer";

            // Determine if this was a buy/sell/transfer for our holder
            if (info.authority === holderAddress) {
              description = "Token Transfer (Sent)";
              transactionType = "send";
            } else {
              description = "Token Transfer (Received)";
              transactionType = "receive";
            }
          } else if (parsed.type === "transfer") {
            // For regular transfers, we need to check token accounts
            amount = parseFloat(info.amount || 0);
            from = info.source;
            to = info.destination;
            transactionType = "transfer";
            description = "Token Transfer";
          }
        }

        if (parsed.type === "mintTo" && info.mint === mintAddress) {
          amount = parseFloat(info.amount || 0);
          to = info.account;
          transactionType = "mint";
          description = "Token Mint";
        }

        if (parsed.type === "burn" && info.mint === mintAddress) {
          amount = parseFloat(info.amount || 0);
          from = info.account;
          transactionType = "burn";
          description = "Token Burn";
        }
      }
    }

    // Check for DEX trades (Raydium, Jupiter, etc.)
    for (const instruction of instructions) {
      const programId = instruction.programId;

      // Raydium
      if (programId === "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8") {
        transactionType = "swap";
        description = "Raydium Swap";
      }

      // Jupiter
      if (programId === "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB") {
        transactionType = "swap";
        description = "Jupiter Swap";
      }
    }

    return {
      type: transactionType,
      description: description,
      amount: amount,
      from: from,
      to: to,
      fee: tx.meta.fee || 0,
      status: tx.meta.err ? "failed" : "success",
    };
  } catch (error) {
    console.log("ℹ️ Could not parse transaction");
    return null;
  }
};

// Function to get holder's other token holdings
const getHolderTokenPortfolio = async (holderAddress) => {
  try {
    console.log(`💰 Fetching token portfolio for: ${holderAddress}`);
    const MAX_LIMIT = 20; // Adjust this value based on the API documentation
    // Validate the limit parameter
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new Error(
        `Invalid limit: ${limit}. It must be between 1 and ${MAX_LIMIT}.`
      );
    }
    const response = await axios.post(RPC_URL, {
      jsonrpc: "2.0",
      id: "getConfirmedSignaturesForAddress2",
      method: "getConfirmedSignaturesForAddress2",
      params: [
        holderAddress,
        {
          limit: limit,
          commitment: "confirmed",
        },
      ],
    });

    if (!response.data.result?.value) {
      return [];
    }

    const tokenAccounts = response.data.result.value;
    console.log(tokenAccounts);
    const portfolio = [];

    for (const account of tokenAccounts) {
      const tokenInfo = account.account.data.parsed.info;
      const balance = parseFloat(tokenInfo.tokenAmount.uiAmount);

      if (balance > 0) {
        portfolio.push({
          mint: tokenInfo.mint,
          balance: balance,
          decimals: tokenInfo.tokenAmount.decimals,
          address: account.pubkey,
        });
      }
    }

    return portfolio.slice(0, 20); // Limit to top 20 tokens
  } catch (error) {
    console.error("❌ Error fetching token portfolio:", error);
    return [];
  }
};

// Function to get SOL balance
const getSolBalance = async (holderAddress) => {
  try {
    const response = await axios.post(RPC_URL, {
      jsonrpc: "2.0",
      id: "get-balance",
      method: "getBalance",
      params: [holderAddress],
    });

    if (response.data.result?.value !== undefined) {
      return response.data.result.value / 1e9; // Convert lamports to SOL
    }
    return 0;
  } catch (error) {
    console.error("❌ Error fetching SOL balance:", error);
    return 0;
  }
};

// Main function to get complete holder profile
const getCompleteHolderProfile = async (holderAddress, mintAddress) => {
  try {
    console.log(`🔍 Getting complete profile for: ${holderAddress}`);

    const [holderDetails, transactions, tokenPortfolio, solBalance] =
      await Promise.all([
        getHolderDetails(holderAddress, mintAddress),
        getHolderTransactions(holderAddress, mintAddress, 20),
        getHolderTokenPortfolio(holderAddress),
        getSolBalance(holderAddress),
      ]);

    return {
      ...holderDetails,
      solBalance: solBalance,
      transactions: transactions,
      tokenPortfolio: tokenPortfolio,
      profileComplete: true,
    };
  } catch (error) {
    console.error("❌ Error fetching complete holder profile:", error);
    return {
      address: holderAddress,
      error: error.message,
      profileComplete: false,
    };
  }
};

// Export all functions for use in your component
export {
  getHolderDetails,
  getHolderTransactions,
  getHolderTokenPortfolio,
  getSolBalance,
  getCompleteHolderProfile,
};
