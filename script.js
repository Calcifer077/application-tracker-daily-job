const imaps = require("imap-simple");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { simpleParser } = require("mailparser");

dotenv.config({ path: "./config.env" });

const linkedinApplicationText = "Mahesh, your application was sent to";
const linkedinEmail = `"LinkedIn" <jobs-noreply@linkedin.com>`;

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
    const searchCriteria = ["UNSEEN", ["SINCE", yesterday]];

    const fetchOptions = {
      // getting full raw email
      bodies: [""],
      // This is one way to mark a message as read, other is using 'uid' and adding flags as displayed below. This will mark the message as read when fetching so not a good option if we want to add some conditions.
      // markSeen: true,
      markSeen: false,
    };

    // Get all the emails from the given fields that we have provided.
    const results = await connection.search(searchCriteria, fetchOptions);

    // We get all the emails in the past 24 hours but we only want one which meet our use case, which is to get emails regarding job applied on linkedin.
    for (const res of results) {
      // This 'uid' is later used to mark the email as read.
      const uid = res.attributes.uid;
      const all = res.parts.find((part) => part.which === ""); // raw message
      if (!all) continue;

      // Parsing using mailparser
      const parsed = await simpleParser(all.body);

      // LinkedIn check
      if (
        parsed.subject.startsWith(linkedinApplicationText) &&
        parsed.from?.text === linkedinEmail
      ) {
        // Finding link for the Position

        // Splitting by new line.
        const text = parsed.text.split(/\r?\n/);

        let url = "";
        for (const currEl of text) {
          if (currEl.startsWith("View job:")) {
            url = currEl.split(" ")[2];
            break;
          }
        }

        const subjectArr = parsed.subject.split(" ");
        for (let i = 0; i <= 5; i++) {
          subjectArr.shift();
        }

        const companyName = subjectArr.join(" ");
        const date = formatDate(parsed.date);

        const newApplication = {
          company: companyName,
          platform: "Linkedin",
          url: url,
          status: "pending",
          date_applied: date,
        };

        // Creating application
        await createNewApplication(newApplication);
        console.log("New application created succesfully!");
        // Marking the mail as seen if it is not already seen
        await connection.addFlags(uid, ["\\Seen"]);
        console.log("Email marked as read!");
      }
    }

    connection.end();
  } catch (err) {
    console.log(err);
  }
}

fetchEmails();

// To kill the process in certain time.
/*
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout after ${ms / 1000} seconds`)),
        ms
      )
    ),
  ]);
}

(async () => {
  try {
    // 10 minutes = 600,000 ms
    await withTimeout(fetchEmails(), 10 * 60 * 1000);
    console.log("Process completed before timeout");
  } catch (err) {
    console.error("Process timed out or failed:", err.message);
    process.exit(1); // exit immediately if it timed out
  }
})();
*/
