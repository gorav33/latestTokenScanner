// In a new service file, e.g., src/services/transaction.js
import axios from 'axios';

const HELIUS_API_KEY = "b8dab187-ffb1-40c7-b8a9-cb3f488a1d94"; // Keep this secure in a real app
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export const getAddressTransactions = async (address, limit = 10) => {
    try {
        console.log(`fetching transactions for address: ${address}`);
        const response = await axios.post(HELIUS_RPC_URL, {
            jsonrpc: "2.0",
            id: "my-id",
            method: "getConfirmedSignaturesForAddress2",
            params: [
                address,
                {
                    limit: limit,
                    // You might want to add before/until signatures for pagination
                }
            ]
        });

        if (response.data.error) {
            throw new Error(`Error fetching transactions: ${response.data.error.message}`);
        }

        const signatures = response.data.result.map(tx => tx.signature);

        // Now, fetch the full transaction details for each signature
        const transactions = await Promise.all(signatures.map(async (signature) => {
            const txDetailsResponse = await axios.post(HELIUS_RPC_URL, {
                jsonrpc: "2.0",
                id: "my-id-tx-details",
                method: "getTransaction",
                params: [
                    signature,
                    {
                        encoding: "jsonParsed",
                        maxSupportedTransactionVersion: 0, // Or higher if dealing with newer versions
                    }
                ]
            });
            return txDetailsResponse.data.result;
        }));

        console.log(`found ${transactions.length} transactions for ${address}`);
        return transactions.filter(tx => tx !== null); // Filter out any null responses
    } catch (error) {
        console.error(`Error in getAddressTransactions for ${address}:`, error);
        return [];
    }
};

// You could also use Helius's enhanced transaction history API (if available via RPC endpoint for your plan)
// It's often more efficient for getting parsed transactions directly.
export const getParsedTransactions = async (address, limit = 10) => {
    try {
        console.log(`fetching parsed transactions for address: ${address}`);
        const response = await axios.get(
            `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`
        );
        return response.data; // Helius's API usually returns parsed data directly
    } catch (error) {
        console.error(`Error fetching parsed transactions for ${address}:`, error);
        return [];
    }
};