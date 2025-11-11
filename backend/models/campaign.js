// models/Campaign.js
const mongoose = require("mongoose");

const CampaignSchema = new mongoose.Schema({
  userAddress: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  endDate: { type: Date, required: true },
  imageUrl: { type: String, default: "" },
  donationLimit: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Campaign", CampaignSchema);
