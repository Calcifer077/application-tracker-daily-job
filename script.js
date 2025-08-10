const imaps = require("imap-simple");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config({ path: "./config.env" });

const linkedinApplicationText = "Mahesh, your application was sent to";
const linkedinEmail = "LinkedIn <jobs-noreply@linkedin.com>";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function createNewApplication(newApplication) {
  const { data, error } = await supabase
    .from("Applications")
    .insert([{ ...newApplication }])
    .select();

  return data;
}

function formatDate(RFCFormat) {
  const date = new Date(RFCFormat);
  const formattedDate = date.toISOString().split("T")[0];

  return formattedDate;
}

const config = {
  imap: {
    user: process.env.GMAIL_USER,
    password: process.env.GMAIL_PASSWORD_14,
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    tlsOptions: {
      rejectUnauthorized: false,
    },
    authTimeout: 3000,
  },
};

async function fetchEmails() {
  try {
    const connection = await imaps.connect(config);
    await connection.openBox("INBOX");

    // This is used to fetch emails for the past one day.
    const delay = 24 * 60 * 60 * 1000;
    let yesterday = new Date();
    yesterday.setTime(Date.now() - delay);
    yesterday = yesterday.toISOString();

    // Below two variables are required by 'IMAP'.
    const searchCriteria = [["SINCE", yesterday]];

    const fetchOptions = {
      bodies: ["HEADER", "TEXT"],
      markSeen: false,
    };

    // Get all the emails from the given fields that we have provided.
    const results = await connection.search(searchCriteria, fetchOptions);

    // We get all the emails in the past 24 hours but we only want one which meet our use case, which is to get emails regarding job applied on linkedin.
    for (const res of results) {
      for (const email of res.parts) {
        // Each email is basically divided in two parts, one is the title('HEADER') and another is subject ('TEXT').
        // We check the header for some certain text and sender email which will make sure that the given email was sent by linkedin only.
        if (email.which === "HEADER") {
          const subjectArr = email.body.subject[0].split(" ");
          const tomatch = subjectArr.slice(0, 6).join(" ");

          if (
            tomatch === linkedinApplicationText &&
            email.body.from[0] === linkedinEmail
          ) {
            const companyName = subjectArr[6];
            const date = formatDate(email.body.date[0]);

            const newApplication = {
              company: companyName,
              platform: "Linkedin",
              url: "",
              status: "pending",
              date_applied: date,
            };

            // Creating new application on supabase.
            await createNewApplication(newApplication);
          }
        }
      }
    }

    connection.end();
  } catch (err) {
    console.log(err);
  }
}

fetchEmails();
