const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const { connectDatabases } = require("./config/db");

const app = express();
const port = 3000;

// CORS Fix: Allow frontend + pre-flight
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  })
);

app.use(express.json());

(async () => {
  try {
    const { campaignDB, transactionDB } = await connectDatabases();
    console.log("Databases connected successfully");

    // =========================
    // SCHEMAS & MODELS
    // =========================

    const CampaignSchema = new mongoose.Schema(
        {
          campaign_id: {
            type: String,
            required: true,
            unique: true,
            index: true,
          },
          title: { type: String, required: true },
          description: String,
          endDate: String,
          imageUrl: String,
          donationLimit: String,
          userAddress: { type: String, required: true },
          
          // ←←← UPDATED DONATIONS ARRAY ←←←
          donations: [
            {
              donorAddress: String,
              amount: Number,
              txDigest: String,                                      // ← ADD
              status: {                                              // ← ADD
                type: String,
                enum: ["success", "failed", "pending"],
                default: "pending"
              },
              gasUsed: Object,                                       // ← ADD
              error: String,                                         // ← ADD
              timestamp: { type: Date, default: Date.now },
            },
          ],
          // ←←← END UPDATE ←←←
      
          totalDonations: { type: Number, default: 0 },
        },
        { timestamps: true }
      );

    const Campaign = campaignDB.model("Campaign", CampaignSchema, "campaigns");

    // Generate unique campaign_id
    const generateCampaignId = async () => {
      while (true) {
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        const campaignId = `CAMP-${random}`;
        const exists = await Campaign.exists({ campaign_id: campaignId });
        if (!exists) return campaignId;
      }
    };
        
  
    const TransactionSchema = new mongoose.Schema(
        {
          contributionId: { type: String, default: uuidv4 },
          userAddress: { type: String, required: true },
          campaignId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Campaign",
            required: true,
          },
          campaignTitle: { type: String },
          amount: { type: Number, required: true },
          
          // ←←← ADD THESE FIELDS ←←←
          txDigest: { type: String },
          status: {
            type: String,
            enum: ["success", "failed", "pending"],
            default: "pending"
          },
          gasUsed: { type: Object },
          error: { type: String },
          // ←←← END ADD ←←←
          
          date: { type: Date, default: Date.now },
        },
        { timestamps: true }
      );
      
      // ←←← ADD THESE INDEXES (optional but recommended) ←←←
      TransactionSchema.index({ userAddress: 1, createdAt: -1 });
      TransactionSchema.index({ txDigest: 1 });
    const Transaction = transactionDB.model("Transaction", TransactionSchema, "transactions");
   
    
    // =========================
    // ROUTES
    // =========================

    app.get("/", (req, res) => res.send("Crowdfunding Backend Running!"));

    // Home Campaigns
    app.get("/api/home_campaigns", async (req, res) => {
      try {
        const { search } = req.query;
        let query = {};

        if (search) {
          const regex = new RegExp(search.trim(), "i");
          query = {
            $or: [
              { title: regex },
              { userAddress: regex },
              { campaign_id: regex },
            ],
          };
        }

        const campaigns = await Campaign.find(query)
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();

        res.json(campaigns);
      } catch (err) {
        console.error("Home campaigns error:", err);
        res.status(500).json({ message: "Server error" });
      }
    });

    // User campaigns
    app.get("/api/campaigns/user/:address", async (req, res) => {
      try {
        const { address } = req.params;
        const campaigns = await Campaign.find({ userAddress: address })
          .sort({ createdAt: -1 })
          .lean();
        res.json(campaigns);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
    });

    // Create campaign
    app.post("/api/campaigns", async (req, res) => {
      try {
        const campaignId = await generateCampaignId();
        const campaign = new Campaign({
          ...req.body,
          campaign_id: campaignId,
        });

        await campaign.save();
        console.log(`Campaign created: ${campaignId} - ${campaign.title}`);
        res.status(201).json(campaign);
      } catch (err) {
        console.error("Create campaign error:", err);
        res.status(400).json({ message: err.message || "Failed to create campaign" });
      }
    });

    // Update campaign
    app.put("/api/campaigns/:identifier", async (req, res) => {
      try {
        const { identifier } = req.params;
        const updates = req.body;

        let campaign;
        if (mongoose.Types.ObjectId.isValid(identifier)) {
          campaign = await Campaign.findById(identifier);
        } else {
          campaign = await Campaign.findOne({ campaign_id: identifier.toUpperCase() });
        }

        if (!campaign) return res.status(404).json({ message: "Campaign not found" });

        Object.keys(updates).forEach((key) => {
          if (updates[key] !== undefined) campaign[key] = updates[key];
        });

        await campaign.save();
        res.json(campaign);
      } catch (err) {
        console.error("Update error:", err);
        res.status(400).json({ message: err.message });
      }
    });

    // Delete campaign
    app.delete("/api/campaigns/:identifier", async (req, res) => {
      try {
        const { identifier } = req.params;
        let result;

        if (mongoose.Types.ObjectId.isValid(identifier)) {
          result = await Campaign.findByIdAndDelete(identifier);
        } else {
          result = await Campaign.findOneAndDelete({ campaign_id: identifier.toUpperCase() });
        }

        if (!result) return res.status(404).json({ message: "Campaign not found" });

        res.json({ message: "Campaign deleted", campaign_id: result.campaign_id });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
      }
    });

    const { SuiClient } = require("@mysten/sui/client");
const suiClient = new SuiClient({
  url: "https://fullnode.testnet.sui.io:443", // Change if devnet/mainnet
});

app.post("/api/campaigns/donate/:identifier", async (req, res) => {
  console.log("DONATE HIT:", req.params.identifier, req.body);

  try {
    const { identifier } = req.params;
    const { donorAddress, amount, txDigest } = req.body;

    if (!donorAddress || !amount || amount <= 0 || !txDigest) {
      return res.status(400).json({ message: "Missing fields" });
    }

    let campaign;
    if (identifier.startsWith("CAMP-")) {
      campaign = await Campaign.findOne({ campaign_id: identifier.toUpperCase() });
    } else if (mongoose.Types.ObjectId.isValid(identifier)) {
      campaign = await Campaign.findById(identifier);
    } else {
      return res.status(400).json({ message: "Invalid ID" });
    }

    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    // INSTANT ON-CHAIN CHECK — NO WAITING
    let isSuccess = false;
    let gasUsed = null;
    let error = null;

    try {
      const tx = await suiClient.getTransactionBlock({
        digest: txDigest,
        options: { showEffects: true },
      });

      if (tx.effects?.status?.status === "success") {
        isSuccess = true;
        gasUsed = tx.effects.gasUsed;
      } else {
        error = tx.effects?.status?.error || "Failed";
      }
    } catch (err) {
      error = "Not found on-chain";
    }

    // ONLY ADD IF REAL SUCCESS
    if (isSuccess) {
      campaign.totalDonations += Number(amount);
    }

    campaign.donations.push({
      donorAddress,
      amount: Number(amount),
      txDigest,
      status: isSuccess ? "success" : "failed",
      gasUsed,
      error,
      timestamp: new Date(),
    });

    await campaign.save();

    const transaction = new Transaction({
      userAddress: donorAddress,
      campaignId: campaign._id,
      campaignTitle: campaign.title,
      amount: Number(amount),
      txDigest,
      status: isSuccess ? "success" : "failed",
      gasUsed,
      error,
    });

    await transaction.save();

    console.log(`DONATION ${isSuccess ? "SUCCESS" : "FAILED"}: ${amount} SUI → ${campaign.campaign_id}`);

    res.json({
      message: isSuccess ? "Success" : "Failed or not indexed",
      verified: isSuccess,
      campaign,
    });
  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});
    // Get user transactions
    app.get("/api/transactions/user/:address", async (req, res) => {
      try {
        const { address } = req.params;
        const transactions = await Transaction.find({ userAddress: address })
          .sort({ createdAt: -1 })
          .populate("campaignId", "title imageUrl campaign_id")
          .lean();

        res.json(transactions);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
      }
    });

    // Test route
    app.get("/api/test", (req, res) => {
      res.json({ message: "Server is alive!", time: new Date() });
    });

    // =========================
    // START SERVER
    // =========================
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
      console.log(`Test: http://localhost:${port}/api/test`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
})();