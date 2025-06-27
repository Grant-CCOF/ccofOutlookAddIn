Office.onReady(() => {
  if (Office.context.mailbox.item) {
    console.log("Office is ready. Item context available.");
    loadEmailContent();
    document.getElementById("generateBtn").addEventListener("click", generateReplySuggestion);
  } else {
    console.log("Office is ready, but no item context found.");
  }
});

let emailSubject = "";
let emailBody = "";

async function loadEmailContent() {
  const item = Office.context.mailbox.item;
  const suggestionElement = document.getElementById("suggestion");
  suggestionElement.textContent = "Loading email content...";

  try {
    emailSubject = await getItemSubject(item);
    item.body.getAsync("text", (bodyResult) => {
      if (bodyResult.status !== Office.AsyncResultStatus.Succeeded) {
        suggestionElement.textContent = "Error retrieving email body.";
        return;
      }

      emailBody = bodyResult.value;
      suggestionElement.textContent = "Instructions loaded. Click Generate when ready.";
    });
  } catch (err) {
    console.error("Error loading email:", err);
    suggestionElement.textContent = "Error loading email.";
  }
}

async function generateReplySuggestion() {
  const userInstructions = document.getElementById("instruction").value.trim();
  const suggestionElement = document.getElementById("suggestion");
  suggestionElement.textContent = "Generating AI reply suggestion... Please wait.";

  const fullPrompt = `
    ${userInstructions}
    
    Email Chain:
    Subject: ${emailSubject}
    Body:
    ${emailBody}
  `.trim();

  try {
    const token = await getAccessToken();

    const response = await fetch("https://ccofficefurniture.com/wp-json/openai-proxy/v1/generate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt: fullPrompt })
    });

    const text = await response.text();
    const obj = JSON.parse(text);
    const fullResponse = obj.choices?.[0]?.message?.content;

    suggestionElement.textContent = fullResponse || "No suggestion generated.";
  } catch (err) {
    console.error("Error generating suggestion:", err);
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
