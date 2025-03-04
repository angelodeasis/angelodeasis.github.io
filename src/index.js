const express = require("express"); // express model imported
const path = require("path"); // built-in path module imported
const bcrypt = require("bcrypt"); // bcrypt model imported
const collection = require("./config"); 
// const animation = require("./flashcards")
// const backend = require("./backend");
const multer = require("multer")
const app = express(); // Creates express application
const Groq = require('groq-sdk');
const pdfIn = require('pdfjs-dist');
const uploadDir = path.join(__dirname, '../uploads'); // Go up one level
const fs = require('fs');






// JSON Data conversion
app.use(express.json());
app.use(express.urlencoded({extended: false}));

// Use EJS as view engine
app.set('view engine', 'ejs');

app.use(express.static("./images")); // must declare static folder in order to use (images)

// Static file (Linking CSS sheet to our EJS files)
app.use(express.static("public"));

app.get('/', (req, res) => {
    res.render("home");
}); //(THIS WILL BE USED LATER)

app.get('/login', (req, res) => { // Login request/respond function
    res.render("login");
});

app.get('/signup', (req, res) => { // Sign-up request/respond function
    res.render("signup");
});

app.get('/pricing', (req, res) => { // pricing route
    res.render("pricing");
});
  
// File upload
let storage = multer.diskStorage({
    destination: function(req, file, callback) {
        callback(null, './uploads')
    },
    filename: function(req, file, callback) {
        console.log(file)
        callback(null, file.originalname);
    }
   })
 
   app.get('/', function(req, res) {
    res.render('index')
   })
 
   async function readPdf(filePath) {
    const absolutePath = path.resolve(filePath);      // Get absolute path
    const fileUrl = `file://${absolutePath}`;         // Convert to file URL

    try {
        const pdf = await pdfIn.getDocument(fileUrl).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(" ");
            fullText += pageText + "\n";
        }

        return fullText;
    } catch (error) {
        console.error("Error reading PDF:", error);
        throw error;
    }
}


app.post('/', function (req, res) {
    let upload = multer({
        storage: storage,
        fileFilter: function (req, file, callback) {
            let ext = path.extname(file.originalname);
            if (ext !== '.pdf') {
                return callback(res.end('Only pdf files are allowed'), null);
            }
            callback(null, true);
        }
    }).single('userFile');

    upload(req, res, async function (err) {
        if (err) {
            return res.status(500).send("Error uploading file: " + err);
        }

        const uploadedFilePath = path.join(uploadDir, req.file.filename);

        try {
            // Convert PDF to text
            let pdfString = await readPdf(uploadedFilePath);
            console.log("Extracted Text from PDF:", pdfString);  // Debugging output

            // Send extracted text to AI model
            const groq = new Groq({
                apiKey: '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' // Make sure the key is in quotes
            });
            const chatCompletion = await groq.chat.completions.create({
                model: 'mixtral-8x7b-32768',
                messages: [{ role: 'user', content: `Create a list of study questions and answers from this text: ${pdfString}` }]
            });

            let qnaString = chatCompletion.choices[0].message.content;
            console.log("Generated Q&A:", qnaString);  // Debugging output

            // Function to split Q&A into arrays
            function parseQnA(text) {
                let qArray = [];
                let aArray = [];
                let lines = text.split("\n");
                
                let currentQuestion = null;
                let currentAnswer = [];
            
                lines.forEach(line => {
                    line = line.trim();
                    
                    if (/^\d+\./.test(line)) {  // Detects numbered questions (e.g., "1. What is photosynthesis?")
                        if (currentQuestion && currentAnswer.length > 0) {
                            qArray.push(currentQuestion);
                            aArray.push(currentAnswer.join(" "));  // Combine multi-line answers
                        }
                        currentQuestion = line.replace(/^\d+\.\s*/, "");  // Remove numbering
                        currentAnswer = [];
                    } else if (currentQuestion) {
                        currentAnswer.push(line.replace(/^A:\s*/, "").trim()); // Remove "A:" prefix if present
                    }
                });
            
                // Add the last Q&A pair
                if (currentQuestion && currentAnswer.length > 0) {
                    qArray.push(currentQuestion);
                    aArray.push(currentAnswer.join(" "));
                }
            
                return qArray.map((q, index) => ({
                    question: q,
                    answer: aArray[index] || "No answer available"
                }));
            }
            

            let flashcards = parseQnA(qnaString);

            // Delete file after processing (optional)
            fs.unlink(uploadedFilePath, (deleteErr) => {
                if (deleteErr) console.log("Error deleting file:", deleteErr);
            });

            // Render flashcards.ejs with Q&A data
            console.log("Raw Q&A String Before Parsing:\n", qnaString);

            console.log("Flashcards to be sent:", flashcards);

            res.render("flashcards", { flashcards: flashcards });

        } catch (error) {
            console.error("Error processing PDF:", error);
            res.status(500).send("Error processing file.");
        }
    });
});




// Backend for Handling PDF
// NEEDS TO BE FIXED // 
// Should we add a loading screen to correctly parse the pdf file? 
app.post('flashcards', function(req, res) {
    var pdf;
    pdf = upload;
    console.log(pdf);

    function qna(str) {
        let qArray = [];
        let aArray = [];
        let string;
        let output;
        // Removing question and answer labels (python holdover)
        str = str.replaceAll("Q:", "");
        str = str.replaceAll("A:", "");
        // Splitting string at newlines
        string = str.split("\n");
        // Pushing questions to question list, other strings to answer list
        for (let i = 0; i < string.length; i++) {
          if (string[i].includes("?")){
            qArray.push(string[i]);
          }
          else {
            aArray.push(string[i])
          }
        }
        // Removing potential label strings from answer list
        aArray.splice(0, 1);
        //aArray.splice(aArray.length - 1, 1)
        output = [qArray, aArray];
        return output;
      }

    const groq = new Groq({
      apiKey: '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',
    });
    
    async function runModel(pdf) {
      try {
        const chatCompletion = await groq.chat.completions.create({
          model: 'mixtral-8x7b-32768',
          messages: [{ role: 'user', content: `Create a list of study questions and answers from the provided text: ${pdf}` }],
          //`Read the name of the PDF variable provided: ${pdf}`
        });
        console.log(chatCompletion.choices[0].message.content); 
        let str = chatCompletion.choices[0].message.content;
        return str
      } catch (error) {
        console.error('Error:', error);
      }
    }
    let pdfOut;
    let arrayOut;
    let qList;
    let aList;
    // If pdfString is loaded properly, groq and qna will be run
    if(typeof pdfString == "string") {
      pdfOut = runModel();
      arrayOut = qna(pdfOut);
      // ARRAYS FOR USE IN NOTECARDS
      qList = arrayOut[0];
      aList = arrayOut[1];
    }
    else {
      console.log("Error: No PDF detected");
    };
    
    
    //let inputString = "Here are the study questions and answers based on the notes:\nQ: How does the film portray the human cost of war, particularly through the lens of children?\nA: The film portrays the human cost of war brutally and realistically, showing the intense shock and trauma of losing family at a young age.\nQ: What do we see through the lens of children in the film?\nA: We see the unnecessary death toll of war, as well as the possibility of losing family without warning or preparation, which is life-changing for young children."
    //console.log(arrayOut);


});


// Registering User
app.post('/signup', async (req, res) => {
    const data = {
        name: req.body.username, // Requests the username string from our EventListener in the body of HTML
        password: req.body.password // Requests password ^  
    }
    // Security 
    const existingUser = await collection.findOne({name: data.name});
    if(existingUser){
        res.send("User already exists.") // Sends a notification to the user if name is found in database
        return; // Required to catch THRW-HEADER error, since we need the user to be able to return to the previous page
    } else {
        const saltRounds = 10 // Number of hashing rounds bcrypt does on password
        const hashedPassword = await bcrypt.hash(data.password, saltRounds) // Hashes password to encrypt it

        data.password = hashedPassword; // Replaces password with hashed verison.

        const userdata = await collection.insertMany(data); // For await command, make sure function is asynchoronous
        console.log(userdata);  // Collecting userdata
    }

   
});

// Login Setup
app.post("/login", async (req, res) => {
    try{
        const check = await collection.findOne({name: req.body.username}); // Checks for username in database   
        if(!check){ // If check fails...
            res.send("Username cannot be found.");
            return;
        }
        // Check regular String password with Hashed password:
        const isPasswordMatch = await bcrypt.compare(req.body.password, check.password);
        if(isPasswordMatch) {
            res.render("Home"); // We will route this to the next page after Eldad/David's parts are done
        }else {
            req.send("Incorrect Password.");
            return;
        }
    } catch{
        res.send("Wrong credentials!");
        return;
    }

});





const port = 8000;
app.listen(port, () => {
    console.log(`Server running on port: ${port}`); // Listener
})