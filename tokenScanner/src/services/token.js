import axios from "axios";


// services/tokenService.js
const HELIUS_API_KEY = "b8dab187-ffb1-40c7-b8a9-cb3f488a1d94";
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
// const SOLANA_TRACKER_API_KEY = process.env.REACT_APP_SOLANA_TRACKER_API_KEY || 'your-solana-tracker-api-key';
export async function getTokenMetadata(mintAddress) {
  try {
    console.log("🏷️ Fetching token metadata with Helius getAsset...");

    let metadata = {
      name: null,
      symbol: null,
      decimals: null,
      logoUri: null,
      description: null,
    };

    // --- PRIMARY METHOD: Helius getAsset API with Timeout ---
    try {
      const heliusMetadataResponse = await axios.post(
        `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
        {
          jsonrpc: "2.0",
          id: "get-asset",
          method: "getAsset",
          params: { id: mintAddress },
        },
        {
          timeout: 5000, // Add a 5-second timeout for Helius
        }
      );

      if (heliusMetadataResponse.data.result) {
        const asset = heliusMetadataResponse.data.result;
        metadata.name = asset.content?.metadata?.name || null;
        metadata.symbol = asset.content?.metadata?.symbol || null;
        metadata.description = asset.content?.metadata?.description || null;
        metadata.logoUri = asset.content?.links?.image || asset.content?.files?.[0]?.uri || null;
        metadata.decimals = asset.spl_token_info?.decimals || null;

        console.log("✅ Helius getAsset successful:", metadata);
        if (metadata.name) {
          return metadata;
        }
      }
    } catch (heliusError) {
      console.warn("⚠️ Helius getAsset failed or timed out, trying Jupiter fallback:", heliusError.message);
      // Don't rethrow, proceed to fallback
    }

    // --- FALLBACK METHOD: Jupiter Token List (only fetch once per session) ---
    // This is a more significant optimization.
    // Instead of fetching jup.ag/strict every time, fetch it once and cache it.
    // This requires managing a global cache or a module-level variable.
    if (!window.__JUPITER_TOKEN_LIST__) { // Simple global cache for demonstration
      console.log("ℹ️ Fetching Jupiter token list for the first time...");
      const jupiterResponse = await axios.get(`https://token.jup.ag/strict`, {
        timeout: 5000, // Timeout for Jupiter list download
      });
      window.__JUPITER_TOKEN_LIST__ = jupiterResponse.data;
      console.log("✅ Jupiter token list loaded.");
    }

    const tokenInfo = window.__JUPITER_TOKEN_LIST__.find(
      (token) => token.address === mintAddress
    );

    if (tokenInfo) {
      metadata.name = metadata.name || tokenInfo.name;
      metadata.symbol = metadata.symbol || tokenInfo.symbol;
      metadata.logoUri = metadata.logoUri || tokenInfo.logoURI;
      metadata.decimals = metadata.decimals || tokenInfo.decimals;
      console.log("✅ Jupiter fallback successful:", metadata);
    } else {
        console.log("❌ Token not found in Jupiter list.");
    }

    return metadata;
  } catch (error) {
    console.error("❌ Overall error fetching token metadata:", error.message);
    return {
      name: null,
      symbol: null,
      decimals: null,
      logoUri: null,
      description: null,
    };
  }
}

// // Helius API for token metadata
// // export const getTokenMetadata = async (tokenAddress) => {
// //   try {
// //     const response = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`, {
// //       method: 'POST',
// //       headers: {
// //         'Content-Type': 'application/json',
// //       },
// //       body: JSON.stringify({
// //         mintAccounts: [tokenAddress],
// //         includeOffChain: true,
// //         disableCache: false,
// //       }),
// //     });

// //     if (!response.ok) throw new Error('Failed to fetch token metadata');

// //     const data = await response.json();
// //     const metadata = data[0];

// //     return {
// //       tokenAddress,
// //       name: metadata?.account?.data?.parsed?.info?.name || metadata?.offChainMetadata?.name || 'Unknown Token',
// //       symbol: metadata?.account?.data?.parsed?.info?.symbol || metadata?.offChainMetadata?.symbol || 'N/A',
// //       logo: metadata?.offChainMetadata?.image || null,
// //       description: metadata?.offChainMetadata?.description || '',
// //       decimals: metadata?.account?.data?.parsed?.info?.decimals || 9,
// //       supply: metadata?.account?.data?.parsed?.info?.supply || '0',
// //       mintAuthority: metadata?.account?.data?.parsed?.info?.mintAuthority,
// //       freezeAuthority: metadata?.account?.data?.parsed?.info?.freezeAuthority,
// //     };
// //   } catch (error) {
// //     console.error(`Error fetching metadata for ${tokenAddress}:`, error);
// //     return {
// //       tokenAddress,
// //       name: 'Unknown Token',
// //       symbol: 'N/A',
// //       logo: null,
// //       description: '',
// //       decimals: 9,
// //       supply: '0',
// //     };
// //   }
// // };

// // Get latest tokens using Helius RPC
// export const getLatestTokensFromHelius = async (limit = 50) => {
//   try {
//     const response = await fetch(RPC_URL, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         jsonrpc: '2.0',
//         id: 'latest-tokens',
//         method: 'getProgramAccounts',
//         params: [
//           'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token Program
//           {
//             encoding: 'jsonParsed',
//             filters: [
//               {
//                 dataSize: 82, // Size of mint account
//               },
//             ],
//           },
//         ],
//       }),
//     });

//     if (!response.ok) throw new Error('Failed to fetch from Helius RPC');

//     const data = await response.json();
    
//     if (data.error) {
//       throw new Error(data.error.message);
//     }

//     // Sort by most recent and take limited number
//     const tokens = data.result
//       .map(account => ({
//         tokenAddress: account.pubkey,
//         decimals: account.account.data.parsed.info.decimals,
//         supply: account.account.data.parsed.info.supply,
//         mintAuthority: account.account.data.parsed.info.mintAuthority,
//         freezeAuthority: account.account.data.parsed.info.freezeAuthority,
//       }))
//       .slice(0, limit);

//     return tokens;
//   } catch (error) {
//     console.error('Error fetching latest tokens from Helius:', error);
//     return [];
//   }
// };
// export const getNewTokens = async (limit = 50) => {
//   try {
//     const response = await fetch(`https://data.solanatracker.io/tokens/new`, {
//       method: 'GET',
//       headers: {
//         'X-API-KEY': SOLANA_TRACKER_API_KEY,
//         'Content-Type': 'application/json',
//       },
//     });

//     if (!response.ok) throw new Error('Failed to fetch new tokens');

//     const data = await response.json();
//     return data.slice(0, limit);
//   } catch (error) {
//     console.error('Error fetching new tokens:', error);
//     return [];
//   }
// };

// // Get DexScreener trending tokens (free API, no key required)
// export const getDexScreenerTrending = async () => {
//   try {
//     const response = await fetch('https://api.dexscreener.com/latest/dex/tokens/trending/solana');
    
//     if (!response.ok) throw new Error('Failed to fetch DexScreener trending tokens');

//     const data = await response.json();
    
//     return data.pairs?.slice(0, 30).map(pair => ({
//       tokenAddress: pair.baseToken.address,
//       name: pair.baseToken.name,
//       symbol: pair.baseToken.symbol,
//       logo: pair.info?.imageUrl,
//       price: parseFloat(pair.priceUsd),
//       priceChange24h: parseFloat(pair.priceChange?.h24),
//       volume24h: parseFloat(pair.volume?.h24),
//       marketCap: parseFloat(pair.marketCap),
//       liquidity: parseFloat(pair.liquidity?.usd),
//       pairAddress: pair.pairAddress,
//       dexId: pair.dexId,
//     })) || [];
//   } catch (error) {
//     console.error('Error fetching DexScreener trending tokens:', error);
//     return [];
//   }
// };
// // Get Birdeye trending tokens (free API with rate limits)
// export const getBirdeyeTrending = async () => {
//   try {
//     const response = await fetch('https://public-api.birdeye.so/defi/tokenlist?sort_by=v24hUSD&sort_type=desc&offset=0&limit=50', {
//       headers: {
//         'X-API-KEY': process.env.REACT_APP_BIRDEYE_API_KEY || 'public', // Public access available
//       }
//     });
    
//     if (!response.ok) throw new Error('Failed to fetch Birdeye tokens');

//     const data = await response.json();
    
//     return data.data?.tokens?.map(token => ({
//       tokenAddress: token.address,
//       name: token.name,
//       symbol: token.symbol,
//       logo: token.logoURI,
//       price: token.price,
//       priceChange24h: token.priceChange24h,
//       volume24h: token.v24hUSD,
//       marketCap: token.mc,
//       source: 'birdeye'
//     })) || [];
//   } catch (error) {
//     console.error('Error fetching Birdeye tokens:', error);
//     return [];
//   }
// };

// // Get pump.fun tokens via Bitquery (GraphQL)
// export const getPumpFunTokens = async (limit = 20) => {
//   const query = `
//     query GetPumpFunTokens {
//       Solana {
//         Instructions(
//           where: {
//             Instruction: {
//               Program: {
//                 Address: {is: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"}
//               }
//             }
//             Transaction: {Result: {Success: true}}
//           }
//           orderBy: {descending: Block_Time}
//           limit: ${limit}
//         ) {
//           Block {
//             Time
//           }
//           Transaction {
//             Signature
//           }
//           Instruction {
//             Accounts {
//               Address
//             }
//             Data
//           }
//         }
//       }
//     }
//   `;

//   try {
//     const response = await fetch('https://graphql.bitquery.io/', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'X-API-KEY': process.env.REACT_APP_BITQUERY_API_KEY || 'your-bitquery-api-key',
//       },
//       body: JSON.stringify({ query }),
//     });

//     if (!response.ok) throw new Error('Failed to fetch pump.fun tokens');

//     const data = await response.json();
//     return data.data?.Solana?.Instructions || [];
//   } catch (error) {
//     console.error('Error fetching pump.fun tokens:', error);
//     return [];
//   }
// };

// // Get Raydium new pairs
// export const getRadiumNewPairs = async (limit = 20) => {
//   try {
//     const response = await fetch(`https://api.raydium.io/v2/main/pairs?limit=${limit}&sort=liquidity&order=desc`);
    
//     if (!response.ok) throw new Error('Failed to fetch Raydium pairs');

//     const data = await response.json();
//     return data.data || [];
//   } catch (error) {
//     console.error('Error fetching Raydium pairs:', error);
//     return [];
//   }
// };

// // Get token price from Jupiter
// export const getTokenPrice = async (tokenAddress) => {
//   try {
//     const response = await fetch(`https://price.jup.ag/v4/price?ids=${tokenAddress}`);
    
//     if (!response.ok) throw new Error('Failed to fetch token price');

//     const data = await response.json();
//     return data.data?.[tokenAddress]?.price || null;
//   } catch (error) {
//     console.error(`Error fetching price for ${tokenAddress}:`, error);
//     return null;
//   }
// };

// // Combined function to get comprehensive token data
// export const getComprehensiveTokenData = async (tokenAddress) => {
//   try {
//     const [metadata, price] = await Promise.all([
//       getTokenMetadata(tokenAddress),
//       getTokenPrice(tokenAddress),
//     ]);

//     return {
//       ...metadata,
//       price,
//       priceFormatted: price ? `$${price.toFixed(6)}` : 'N/A',
//     };
//   } catch (error) {
//     console.error(`Error fetching comprehensive data for ${tokenAddress}:`, error);
//     return {
//       tokenAddress,
//       name: 'Unknown Token',
//       symbol: 'N/A',
//       logo: null,
//       price: null,
//       priceFormatted: 'N/A',
//     };
//   }
// };

// // Fallback function using Jupiter's token list for popular tokens
// export const getJupiterTokenList = async () => {
//   try {
//     const response = await fetch('https://token.jup.ag/all');
    
//     if (!response.ok) throw new Error('Failed to fetch Jupiter token list');

//     const data = await response.json();
    
//     // Filter for recently added tokens (this is approximate as Jupiter doesn't provide creation dates)
//     const popularTokens = data
//       .filter(token => token.daily_volume > 1000) // Filter by volume
//       .sort((a, b) => (b.daily_volume || 0) - (a.daily_volume || 0))
//       .slice(0, 50)
//       .map(token => ({
//         tokenAddress: token.address,
//         name: token.name,
//         symbol: token.symbol,
//         logo: token.logoURI,
//         decimals: token.decimals,
//         tags: token.tags || [],
//       }));

//     return popularTokens;
//   } catch (error) {
//     console.error('Error fetching Jupiter token list:', error);
//     return [];
//   }
// };