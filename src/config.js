// Database connection
const mongoose = require("mongoose");
const connect = mongoose.connect("mongodb+srv://adeasis:NeptuneMilk1843!@flashcard.7d0g9.mongodb.net/?retryWrites=true&w=majority&appName=flashcard"); // Establish connection with MongoDB 



// Check ff connection is successful
connect.then(() => {
    console.log("Connection to MongoDB successful!");
})
.catch(() => {
    console.log("Connection failed.");
});

// Create a schema (Login Schema)
const LoginSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    }
});

// Data collection
const collection = new mongoose.model("users", LoginSchema)

// Exporting model
module.exports = collection;
