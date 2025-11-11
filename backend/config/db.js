// config/db.js
const mongoose = require("mongoose");

const connectDatabases = async () => {
  try {
    const uri = "mongodb+srv://binormus006_db_user:helloworld@cluster0.ocpfhxf.mongodb.net/test?retryWrites=true&w=majority";

    // Connect to the 'test' database
    const testDB = mongoose.createConnection(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    testDB.on('connected', () => {
      console.log(`✅ Connected to database: ${testDB.name}`);
    });

    testDB.on('error', (err) => {
      console.error(`❌ Database connection error: ${err.message}`);
    });

    // We don't need separate campaignDB/transactionDB anymore
    // Both collections live in 'test' DB
    return { campaignDB: testDB, transactionDB: testDB };

  } catch (error) {
    console.error(`❌ Failed to connect to databases: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { connectDatabases };