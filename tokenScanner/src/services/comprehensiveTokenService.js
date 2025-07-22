// services/comprehensiveTokenService.js
const HELIUS_API_KEY = "b8dab187-ffb1-40c7-b8a9-cb3f488a1d94";
const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Your enhanced token fetcher using multiple free APIs
export const getTokenMetadata = async (tokenAddress) => {
  try {
    const response = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mintAccounts: [tokenAddress],
        includeOffChain: true,
        disableCache: false,
      }),
    });

    if (!response.ok) throw new Error('Failed to fetch token metadata');

    const data = await response.json();
    const metadata = data[0];

    return {
      tokenAddress,
      name: metadata?.account?.data?.parsed?.info?.name || metadata?.offChainMetadata?.name || 'Unknown Token',
      symbol: metadata?.account?.data?.parsed?.info?.symbol || metadata?.offChainMetadata?.symbol || 'N/A',
      logo: metadata?.offChainMetadata?.image || null,
      description: metadata?.offChainMetadata?.description || '',
      decimals: metadata?.account?.data?.parsed?.info?.decimals || 9,
      supply: metadata?.account?.data?.parsed?.info?.supply || '0',
      mintAuthority: metadata?.account?.data?.parsed?.info?.mintAuthority,
      freezeAuthority: metadata?.account?.data?.parsed?.info?.freezeAuthority,
    };
  } catch (error) {
    console.error(`Error fetching metadata for ${tokenAddress}:`, error);
    return {
      tokenAddress,
      name: 'Unknown Token',
      symbol: 'N/A',
      logo: null,
      description: '',
      decimals: 9,
      supply: '0',
    };
  }
};

// Get trending tokens from DexScreener (free API)
export const getDexScreenerTrending = async () => {
  try {
    const response = await fetch('https://api.dexscreener.com/latest/dex/pairs/solana');
    
    if (!response.ok) throw new Error('Failed to fetch DexScreener data');

    const data = await response.json();
    
    // Filter and sort by volume, get top 30
    const trendingTokens = data.pairs
      ?.filter(pair => pair.baseToken && pair.volume?.h24 > 1000) // Filter by volume
      ?.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      ?.slice(0, 30)
      ?.map(pair => ({
        tokenAddress: pair.baseToken.address,
        name: pair.baseToken.name,
        symbol: pair.baseToken.symbol,
        logo: pair.info?.imageUrl,
        price: parseFloat(pair.priceUsd) || 0,
        priceChange24h: parseFloat(pair.priceChange?.h24) || 0,
        volume24h: parseFloat(pair.volume?.h24) || 0,
        marketCap: parseFloat(pair.marketCap) || 0,
        liquidity: parseFloat(pair.liquidity?.usd) || 0,
        pairAddress: pair.pairAddress,
        dexId: pair.dexId,
        source: 'dexscreener'
      })) || [];

    return trendingTokens;
  } catch (error) {
    console.error('Error fetching DexScreener trending tokens:', error);
    return [];
  }
};

// Get new token launches using Helius webhook data simulation
export const getNewTokenLaunches = async () => {
  try {
    // Use Helius to get recent token mints
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'new-tokens',
        method: 'getSignaturesForAddress',
        params: [
          'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token Program
          {
            limit: 100,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error('Failed to fetch from Helius');

    const data = await response.json();
    
    if (data.error) {
      console.error('Helius RPC Error:', data.error);
      return [];
    }

    // Get recent transaction signatures and extract token mints
    const signatures = data.result?.slice(0, 20) || [];
    
    const tokenPromises = signatures.map(async (sig) => {
      try {
        const txResponse = await fetch(RPC_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'tx-detail',
            method: 'getTransaction',
            params: [
              sig.signature,
              {
                encoding: 'jsonParsed',
                maxSupportedTransactionVersion: 0,
              },
            ],
          }),
        });

        const txData = await txResponse.json();
        
        if (txData.result?.meta?.postTokenBalances) {
          const tokenMints = txData.result.meta.postTokenBalances
            .map(balance => balance.mint)
            .filter(Boolean);
          
          return tokenMints[0]; // Return first token mint found
        }
        
        return null;
      } catch (error) {
        console.error('Error processing transaction:', error);
        return null;
      }
    });

    const tokenAddresses = (await Promise.all(tokenPromises))
      .filter(Boolean)
      .slice(0, 15); // Limit to prevent rate limiting

    return tokenAddresses.map(address => ({
      tokenAddress: address,
      source: 'helius-new'
    }));

  } catch (error) {
    console.error('Error fetching new token launches:', error);
    return [];
  }
};

// Get Jupiter token list for popular tokens
export const getJupiterPopular = async () => {
  try {
    const response = await fetch('https://token.jup.ag/strict');
    
    if (!response.ok) throw new Error('Failed to fetch Jupiter tokens');

    const data = await response.json();
    
    // Get tokens with good liquidity and volume
    const popularTokens = data
      ?.filter(token => token.daily_volume && token.daily_volume > 10000)
      ?.sort((a, b) => (b.daily_volume || 0) - (a.daily_volume || 0))
      ?.slice(0, 40)
      ?.map(token => ({
        tokenAddress: token.address,
        name: token.name,
        symbol: token.symbol,
        logo: token.logoURI,
        decimals: token.decimals,
        tags: token.tags || [],
        source: 'jupiter-popular',
        volume24h: token.daily_volume,
      })) || [];

    return popularTokens;
  } catch (error) {
    console.error('Error fetching Jupiter popular tokens:', error);
    return [];
  }
};

// Get pump.fun trending tokens using their public API
export const getPumpFunTrending = async () => {
  try {
    // Pump.fun has a public API endpoint
    const response = await fetch('https://frontend-api.pump.fun/coins/trending?offset=0&limit=30&includeNsfw=false');
    
    if (!response.ok) throw new Error('Failed to fetch pump.fun trending');

    const data = await response.json();
    
    return data?.map(coin => ({
      tokenAddress: coin.mint,
      name: coin.name,
      symbol: coin.symbol,
      logo: coin.image_uri,
      description: coin.description,
      marketCap: coin.usd_market_cap,
      createdTimestamp: coin.created_timestamp,
      source: 'pumpfun-trending',
      twitter: coin.twitter,
      telegram: coin.telegram,
      website: coin.website,
    })) || [];
  } catch (error) {
    console.error('Error fetching pump.fun trending tokens:', error);
    return [];
  }
};

// Get comprehensive token data with pricing
export const getTokenPrice = async (tokenAddress) => {
  try {
    // Use Jupiter aggregator for price
    const response = await fetch(`https://price.jup.ag/v4/price?ids=${tokenAddress}`);
    
    if (!response.ok) return null;

    const data = await response.json();
    return data.data?.[tokenAddress]?.price || null;
  } catch (error) {
    console.error(`Error fetching price for ${tokenAddress}:`, error);
    return null;
  }
};

// Master function to get all token categories
export const getAllTokenCategories = async () => {
  try {
    console.log('Fetching tokens from all sources...');
    
    const [
      dexScreenerTokens,
      jupiterTokens,
      pumpFunTokens,
      newTokens
    ] = await Promise.all([
      getDexScreenerTrending(),
      getJupiterPopular(),
      getPumpFunTrending(),
      getNewTokenLaunches()
    ]);

    return {
      trending: dexScreenerTokens,
      popular: jupiterTokens,
      pumpfun: pumpFunTokens,
      new: newTokens
    };
  } catch (error) {
    console.error('Error fetching all token categories:', error);
    return {
      trending: [],
      popular: [],
      pumpfun: [],
      new: []
    };
  }
};

// Enhanced function to get comprehensive token data
export const getComprehensiveTokenData = async (tokenAddress) => {
  try {
    const [metadata, price] = await Promise.all([
      getTokenMetadata(tokenAddress),
      getTokenPrice(tokenAddress),
    ]);

    return {
      ...metadata,
      price,
      priceFormatted: price ? `$${price < 0.01 ? price.toExponential(2) : price.toFixed(6)}` : 'N/A',
    };
  } catch (error) {
    console.error(`Error fetching comprehensive data for ${tokenAddress}:`, error);
    return {
      tokenAddress,
      name: 'Unknown Token',
      symbol: 'N/A',
      logo: null,
      price: null,
      priceFormatted: 'N/A',
    };
  }
};

// Real-time token monitoring using Helius webhooks (advanced feature)
export const setupTokenMonitoring = async (tokenAddresses) => {
  try {
    const response = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhookURL: 'https://your-webhook-endpoint.com/solana-token-updates',
        transactionTypes: ['SWAP'],
        accountAddresses: tokenAddresses,
        webhookType: 'enhanced',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Webhook setup successful:', data);
      return data;
    }
  } catch (error) {
    console.error('Error setting up token monitoring:', error);
  }
  
  return null;
};

export default {
  getTokenMetadata,
  getDexScreenerTrending,
  getNewTokenLaunches,
  getJupiterPopular,
  getPumpFunTrending,
  getAllTokenCategories,
  getComprehensiveTokenData,
  setupTokenMonitoring,
};