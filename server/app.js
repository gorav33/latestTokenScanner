// app.js
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS so your frontend (localhost:5173) can access this server
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET"],
    credentials: false, // Set to true only if you're using cookies or authentication
  })
);

// Route to proxy Dexscreener API search
app.get("/api/search", async (req, res) => {
  const { mintAddress } = req.query;
  console.log(mintAddress);
  if (!mintAddress) {
    return res
      .status(400)
      .json({ error: "The 'q' query parameter is required." });
  }

  const DEXSCREENER_URL = `https://api.dexscreener.com/latest/dex/search?q=SOL/USDC`;

  try {
    console.log(`Searching Dexscreener for: ${mintAddress}`);

    const response = await axios.get(DEXSCREENER_URL, {
      params: { mintAddress },
      headers: {
        Accept: "*/*",
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching data from Dexscreener:", error.message);
    res
      .status(500)
      .json({ error: "Failed to fetch data from Dexscreener API." });
  }
});

// Add this route to your existing Express app (e.g., in server.js)

// Add this route to your Express app
// app.get("/api/candles", async (req, res) => {
//   // ✅ FIX 1: Changed 'interval' to 'type' to match the Birdeye API
//   // Valid types: 1m, 5m, 15m, 1h, 4h, 1d
//   const { address, type = "1h" } = req.query;

//   if (!address) {
//     return res
//       .status(400)
//       .json({ error: "Missing 'address' query parameter" });
//   }

//   // Use your actual API key
//   const BIRDEYE_API_KEY = "5664209e8a7c4bdd9dc5f134074f8a6a";
  
//   // ✅ FIX 2: Corrected the API endpoint URL
//   const BIRDEYE_URL = "https://public-api.birdeye.so/defi/candles";

//   try {
//     console.log(`Fetching ${type} candles for address: ${address} from Birdeye`);

//     const response = await axios.get(BIRDEYE_URL, {
//         params: {
//             address: address,
//             type: type,
//             chain: 'solana' // Optional, but good to be explicit
//         },
//         headers: {
//             "X-API-KEY": BIRDEYE_API_KEY,
//         },
//     });

//     // ✅ FIX 3: Birdeye nests the candle data inside response.data.data
//     const candles = response.data.data?.items || [];
//     console.log(`Found ${candles.length} candles.`);

//     res.json(response.data); // Send the full Birdeye response back

//   } catch (err) {
//     // ✅ FIX 4: Improved error logging to show the actual API error
//     if (err.response) {
//       console.error("Birdeye API Error:", err.response.status, err.response.data);
//       res.status(err.response.status).json({
//         error: "Failed to fetch candles from Birdeye",
//         details: err.response.data,
//       });
//     } else {
//       console.error("Error fetching candles from Birdeye:", err.message);
//       res.status(500).json({ error: "Failed to fetch candles" });
//     }
//   }
// });

app.get("/api/candles", async (req, res) => {
  // We are temporarily ignoring the query parameters for this test.
  const address = "9wMUPXRFtSCpHU3MPcFNb6bgYKaSdkBmDorLrYTvj2Sd"; // Known valid address for Wrapped SOL
  const type = "1h";

  console.log(`--- DEBUG MODE: Testing with hardcoded address: ${address} ---`);

  const BIRDEYE_URL = "https://public-api.birdeye.so/defi/candles";

  try {
    const response = await axios.get(BIRDEYE_URL, {
        params: { address, type },
        headers: { "X-API-KEY": BIRDEYE_API_KEY },
    });

    console.log("✅ Success! Birdeye responded with data.");
    res.json(response.data);

  } catch (err) {
    if (err.response) {
      console.error("❌ Birdeye API Error:", err.response.status, err.response.data);
      res.status(err.response.status).json({
        error: "Failed to fetch candles from Birdeye",
        details: err.response.data,
      });
    } else {
      console.error("❌ Network or Axios Error:", err.message);
      res.status(500).json({ error: "Failed to fetch candles" });
    }
  }
});
// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
