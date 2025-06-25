Office.onReady(() => {
  if (Office.context.mailbox.item) {
    console.log("Office is ready. Item context available.");
    generateReplySuggestion();
  } else {
    console.log("Office is ready, but no item context found.");
  }
});

async function generateReplySuggestion() {
  console.log("Generating suggested reply...");

  const item = Office.context.mailbox.item;
  const suggestionElement = document.getElementById("suggestion");
  suggestionElement.textContent = "Generating AI reply suggestion... Please wait.";

  try {
    // Get subject
    const subject = await getItemSubject(item);
    console.log(`Email subject: ${subject}`);

    // Get body
    item.body.getAsync("text", async (bodyResult) => {
      if (bodyResult.status !== Office.AsyncResultStatus.Succeeded) {
        console.error("Failed to get email body:", bodyResult.error);
        suggestionElement.textContent = "Error retrieving email body.";
        return;
      }

      const bodyText = bodyResult.value;
      console.log("Email body retrieved successfully.");

      // Construct AI prompt
      const prompt = `
      Craft a professional, helpful, and friendly email reply to the most recent message in the email chain below. Your response should be clear, concise, and suitable for business communication. Use earlier emails in the chain only as background context.

      Do not include a subject line, greeting, closing signature, sign-off, or your name. Respond only with the body of the email.

      If the most recent message in the chain does not require a response, reply with a short and polite explanation for why no response is needed. Do not make assumptions or add new information not found in the email.

      Email Chain:
      Subject: ${subject}
      Body:
      ${bodyText}
      `;

      console.log("Sending prompt to local LLM...");

      /* Local Fetch
      const response = await fetch("http://localhost:11434/api/generate", {
        method: "POST",
        body: JSON.stringify({ model: "llama3.1:8b", prompt }),
        headers: { "Content-Type": "application/json" }
      });
      */

      const token = await getAccessToken();
      const response = await fetch("https://ccofficefurniture.com/wp-json/openai-proxy/v1/generate", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`, // Microsoft Graph access token
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: prompt
        })
      });

      const text = await response.text();
      console.log("Raw NDJSON:", text);

      // Split the NDJSON by lines
      const lines = text.trim().split('\n');

      // Parse each line and combine responses
      let fullResponse = "";
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          fullResponse += obj.response || "";
        } catch (e) {
          console.error("Failed to parse line:", line, e);
        }
      }

      if (fullResponse != "") {
        console.log("AI response received.");
        suggestionElement.textContent = fullResponse;
      } else {
        console.warn("AI response was empty or invalid.");
        suggestionElement.textContent = "No suggestion generated.";
      }
    });
  } catch (err) {
    console.error("Error generating reply suggestion:", err);
    suggestionElement.textContent = "An error occurred while generating the suggestion.";
  }
}

function getItemSubject(item) {
  return new Promise((resolve, reject) => {
    item.subject.getAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve(result.value);
      } else {
        reject(result.error);
      }
    });
  });
}

async function getAccessToken() {
  const msalConfig = {
    auth: {
      clientId: "63e4f7da-45fc-45fa-9300-72b3038e72ef",
      authority: "https://login.microsoftonline.com/common",
      redirectUri: "https://grant-ccof.github.io/ccofOutlookAddIn/redirect.html"
    },
    cache: {
      cacheLocation: "localStorage",
      storeAuthStateInCookie: false
    }
  };
  const loginRequest = {
    scopes: [
      "api://2f0ea062-93bd-4937-bcc1-5c87af3d6026/access_as_a_user"
    ]
  };
  console.log("Getting access token...");
  const msalInstance = new msal.PublicClientApplication(msalConfig);
  const accounts = msalInstance.getAllAccounts();
  console.log(`Found ${accounts.length} accounts.`);

  await msalInstance.loginPopup(loginRequest);

  if (accounts.length === 0) {
    console.log("Triggering login popup...");
    await msalInstance.loginPopup(loginRequest);
  }

  const activeAccount = msalInstance.getAllAccounts()[0];
  if (!activeAccount) {
    console.error("No active account found after login.");
    throw new Error("No active account found after login.");
  }

  const result = await msalInstance.acquireTokenSilent({
    ...loginRequest,
    account: activeAccount
  });

  console.log("Access token acquired.");
  console.log("Token: " + result.accessToken);
  return result.accessToken;
}
