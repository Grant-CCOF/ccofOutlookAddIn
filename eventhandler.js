Office.onReady(() => {
  if (Office.context.mailbox.item) {
    console.log("Office is ready. Item context available.");
    startBackgroundProcessing();
  } else {
    console.log("Office is ready, but no item context found.");
  }
});

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
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
    "https://graph.microsoft.com/Mail.ReadWrite",
    "https://graph.microsoft.com/Mail.Send",
    "https://graph.microsoft.com/User.Read"
  ]
};

async function startBackgroundProcessing() {
  console.log("Starting background processing...");

  console.log("Fetching inbox messages...");
  const messages = await getInboxMessages();
  console.log(`Found ${messages.length} inbox messages.`);

  for (let msg of messages) {
    console.log(`Processing message: ${msg.subject}`);

    const hasReplied = await hasRepliedCategory(msg.id);
    if (hasReplied) {
      console.log("Message already has a replied category. Skipping.");
      continue;
    }
    
    const isReplied = await hasBeenRepliedTo(msg.id);
    if (isReplied) {
      console.log("Message has been replied to. Removing priority category and tagging as 'replied'.");
      await replaceCategories(msg.id, "Replied");
      continue;
    }

    const hasPriority = await hasPriorityCategory(msg);
    if (hasPriority) {
      console.log("Message already has a priority category but has not been replied to. Skipping.");
      continue;
    }

    console.log("No priority and not replied. Getting priority from LLM...");
    const priority = await getPriorityFromLLM(msg);
    const catagoriesInbox = {
      1: "1 AI Priority",
      2: "2 AI Priority",
      3: "3 AI Priority",
      4: "4 AI Priority",
      5: "5 AI Priority",
    };
    console.log(`LLM returned priority: ${priority}`);
    await replaceCategories(msg.id, catagoriesInbox[priority]);
    console.log(`Tagged message ${msg.id} with priority: ${priority}`);
    
  }

  console.log("Fetching sent messages...");
  const sentMessages = await getSentMessages();
  console.log(`Found ${sentMessages.length} sent messages.`);

  for (let msg of sentMessages) {
    console.log(`\nEvaluating follow-up need for sent message: ${msg.subject}`);

    const hasReplied = await hasRepliedCategory(msg.id);
    if (hasReplied) {
      console.log("Message already has a replied category. Skipping.");
      continue;
    }
    
    const isReplied = await hasBeenRepliedTo(msg.id);
    if (isReplied) {
      console.log("This sent message has already been replied to. Setting as replied.");
      await replaceCategories(msg.id, "Replied");
      continue;
    }

    const hasFollowUpCategory = getFollowUpCategory(msg.categories);
    const sentTime = new Date(msg.sentDateTime || msg.receivedDateTime);
    const overdueThresholds = {
      high: 2,
      normal: 5,
      low: 10,
    };

    if (hasFollowUpCategory) {
      if (hasFollowUpCategory != "nudge" && hasFollowUpCategory != "nor") {
        const now = new Date();
        const ageDays = Math.floor((now - sentTime) / (1000 * 60 * 60 * 24));
        console.log(`Message already has a follow-up tag. Sent ${ageDays} days ago.`);

        if (ageDays >= overdueThresholds[hasFollowUpCategory]) {
          console.log(`Follow-up overdue! Sent ${ageDays} days ago and still no reply.`);
          try {
            await replaceCategories(msg.id, "0 - Nudge");
            console.log(`Replaced categories for message ${msg.id} with: AI FollowUp Nudge`);
          } catch (error) {
            console.error(`Failed to replace categories for message ${msg.id}:`, error);
          }
        }
      }
      continue; // Already tagged, don’t re-check with LLM
    }

    console.log("No follow-up tag and no reply. Calling LLM to check follow-up urgency...");
    const urgency = await needsFollowUp(msg);
    const catagories = {
      High: "1 - AI FollowUp High",
      Normal: "2 - AI FollowUp Normal",
      Low: "3 - AI FollowUp Low",
    };

    if (urgency && urgency != 'No Response Required')  {
      console.log(`LLM follow-up urgency: ${urgency}`);
      const now = new Date();
      const ageDays = Math.floor((now - sentTime) / (1000 * 60 * 60 * 24));
      console.log(`Cheking Message for a follow Up. Sent ${ageDays} days ago.`);

      if (ageDays >= overdueThresholds[urgency]) {
        console.log(`Follow-up overdue! Sent ${ageDays} days ago and still no reply.`);
        try {
          await replaceCategories(msg.id, "0 - Nudge");
          console.log(`Replaced categories for message ${msg.id} with: AI FollowUp Nudge`);
        } catch (error) {
          console.error(`Failed to replace categories for message ${msg.id}:`, error);
        }
      } else {
        await replaceCategories(msg.id, catagories[urgency]);
      }
      console.log(`Tagged message ${msg.id} for follow-up: ${urgency}`);
    } else {
      console.log("No follow-up needed.");
      await replaceCategories(msg.id, "4 - AI FollowUp No Response Required");
    }
  }

  console.log("Background processing complete.");
}

function getFollowUpCategory(categories) {
  if (!categories || !Array.isArray(categories)) return null;

  if (categories.includes("AI FollowUp High")) return "high";
  if (categories.includes("AI FollowUp Normal")) return "normal";
  if (categories.includes("AI FollowUp Low")) return "low";
  if (categories.includes("AI FollowUp Nudge")) return "nudge";
  if (categories.includes("AI FollowUp No Response Required")) return "nor";
  return null;
}

async function hasPriorityCategory(msg) {
  console.log(`Message Categories: ${msg.categories}`)
  const hasCategory = msg.categories?.some(c =>
    c.toLowerCase().includes("ai.priority") || c.toLowerCase().includes("ai priority")
  );
  console.log(`hasPriorityCategory(${msg.id}): ${hasCategory}`);
  return hasCategory;
}

async function hasRepliedCategory(msg) {
  console.log(`Message Categories: ${msg.categories}`)
  const hasCategory = msg.categories?.some(c => c.toLowerCase().includes("replied"));
  console.log(`hasRepliedCategory(${msg.id}): ${hasCategory}`);
  return hasCategory;
}

async function needsFollowUp(msg) {
  console.log(`Calling LLM to evaluate follow-up need for message ${msg.id}...`);

  const subject = typeof msg.subject === "string" ? msg.subject.trim() : "";
  const body = typeof msg.body?.content === "string" ? msg.body.content.trim() : "";

  const prompt = `
    You are an AI assistant helping a user manage their email inbox. 
    Given the subject and content of the email below, determine whether it requires a response.

    Your response must be strictly in the following JSON format:
    {
      "requires_response": true | false,
      "urgency": "High" | "Normal" | "Low" | null
    }

    Only say true if the message clearly requests something, asks a question, or implies the sender expects a reply. Otherwise, return false.

    Subject: ${subject}
    Body:
    ${body}
  `;

  /* Local Fetch
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    body: JSON.stringify({
      model: "llama3.1:8b",
      prompt: prompt,
      stream: false
    }),
    headers: { "Content-Type": "application/json" }
  });
  */

  const token = await getAccessToken();
  const res = await fetch("https://ccofficefurniture.com/wp-json/openai-proxy/v1/generate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`, // Microsoft Graph access token
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt: prompt
    })
  });

  const text = await res.text();

  let fullResponse = "";
  const lines = text.trim().split("\n");

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (typeof obj.response === "string") {
        fullResponse += obj.response;
      }
    } catch (e) {
      console.error("Failed to parse line:", line, e);
    }
  }

  console.log(`LLM reconstructed response: ${fullResponse}`);

  try {
    const parsed = JSON.parse(fullResponse);
    if (parsed.requires_response === true) {
      return parsed.urgency || "Normal";
    }
    return null;
  } catch (e) {
    console.warn("Failed to parse full response as JSON. Attempting fallback.");

    const lower = fullResponse.toLowerCase();
    if (lower.includes("true")) {
      if (lower.includes("high")) return "High";
      if (lower.includes("normal")) return "Normal";
      if (lower.includes("low")) return "Low";
      return "Normal";
    }
    return "No Response Required";
  }
}

async function replaceCategories(messageId, newCategories) {
  patchCategories = [newCategories];
  const token = await getAccessToken();
  console.log(`Replacing categories on message ${messageId} with: ${patchCategories}`);
  await fetch(`${GRAPH_BASE}/me/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      categories: patchCategories
    })
  });
}

function stripHtml(html) {
  if (typeof html !== "string") return "";

  // Remove style, script tags and comments
  const cleaned = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?[^>]+(>|$)/g, ""); // Remove remaining HTML tags

  // Decode HTML entities and normalize whitespace
  const temp = document.createElement("div");
  temp.innerHTML = cleaned;
  return temp.textContent.replace(/\s+/g, " ").trim();
}


async function getPriorityFromLLM(msg) {
  console.log(`Calling LLM to score message ${msg.id}...`);

  const rawBody = typeof msg.body?.content === "string" ? msg.body.content : msg.body || "";
  const strippedBody = stripHtml(rawBody);
  const subject = msg.subject || "(No Subject)";
  console.log(`Subject: ${subject}`);
  console.log(`Stripped email body:\n${strippedBody.slice(0, 20000)}\n`); // show first 20000 chars

  const prompt = `
    You are a project manager at an office furniture dealership responsible for evaluating incoming emails to determine how urgently they require a response. You follow a priority scale from 1 to 5:

    - 1: Extremely urgent — requires an immediate response, such as crises, blocking issues, or key client needs that impact revenue or deadlines.
    - 2: High priority — important or time-sensitive matters that should be addressed soon to keep projects or communications on track.
    - 3: Normal priority — routine emails and standard requests that can be responded to when time allows without urgent pressure.
    - 4: Low priority — informational messages or updates that may not need a response and can be deferred.
    - 5: Very low priority or no response necessary — newsletters, FYIs, CCs, or other communications that generally do not require any reply.

    Please read the most recent message in the email chain below and respond ONLY with a single digit number from 1 to 5 that reflects its priority. Do not explain why you made this choice.

    Subject: ${subject}

    Email:
    ${strippedBody}
  `;

  /* Local Fetch
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    body: JSON.stringify({
      model: "llama3.1:8b",
      prompt: prompt.trim()
    }),
    headers: {
      "Content-Type": "application/json"
    }
  });
  */

  const token = await getBackEndAccessToken();
  const res = await fetch("https://ccofficefurniture.com/wp-json/openai-proxy/v1/generate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`, // Microsoft Graph access token
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt: prompt.trim()
    })
  });

  const text = await res.text();

  const lines = text.trim().split('\n');
  let data = "";
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      data += obj.response || "";
    } catch (e) {
      console.error("Failed to parse line:", line, e);
    }
  }
  console.log(`LLM priority score response: ${data}`);

  if (["1", "2", "3", "4", "5"].includes(data)) {
    return data;
  }

  console.warn(`Unexpected priority response: "${data}". Returning "Unknown".`);
  return "Unknown";
}

async function getInboxMessages() {
  console.log("Getting inbox messages...");
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE}/me/mailFolders/inbox/messages?$top=50`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
  const data = await res.json();
  console.log("Inbox fetch complete.");
  return data.value || [];
}

async function getSentMessages() {
  console.log("Fetching sent messages from the last 30 days...");
  const token = await getAccessToken();

  // Calculate ISO timestamp for 30 days ago
  const now = new Date();
  const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30)).toISOString();

  // Apply filter for sentDateTime
  let url = `${GRAPH_BASE}/me/mailFolders/sentitems/messages?$top=50&$filter=sentDateTime ge ${thirtyDaysAgo}`;
  const allMessages = [];

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    const data = await res.json();
    allMessages.push(...(data.value || []));
    console.log(`Fetched ${allMessages.length} messages so far...`);

    url = data["@odata.nextLink"]; // Get next page if exists
  }

  console.log(`Total sent messages from the last 30 days: ${allMessages.length}`);
  return allMessages;
}

async function appendCategory(messageId, newCategory) {
  console.log(`Appending category ${newCategory} to message ${messageId}`);
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE}/me/messages/${messageId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
  const msg = await res.json();
  const categories = new Set(msg.categories || []);
  categories.add(newCategory);
  await fetch(`${GRAPH_BASE}/me/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      categories: Array.from(categories)
    })
  });
  console.log(`Category appended to ${messageId}.`);
}

async function hasBeenRepliedTo(messageId) {
  console.log(`--- Checking reply status for message ID: ${messageId} ---`);

  const token = await getAccessToken();

  // Step 1: Fetch original message details
  const originalRes = await fetch(`${GRAPH_BASE}/me/messages/${messageId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });

  if (!originalRes.ok) {
    const err = await originalRes.text();
    console.error(`Failed to fetch original message: ${err}`);
    return false;
  }

  const originalMsg = await originalRes.json();
  const originalInternetId = originalMsg.internetMessageId;
  const originalDate = new Date(originalMsg.receivedDateTime);
  const conversationId = originalMsg.conversationId;

  if (!originalInternetId || !originalDate || !conversationId) {
    console.warn(`Missing internetMessageId, receivedDateTime, or conversationId`);
    return false;
  }

  console.log(`Original internetMessageId: ${originalInternetId}`);
  console.log(`Original receivedDateTime: ${originalDate.toISOString()}`);
  console.log(`Conversation ID: ${conversationId}`);

  // Step 2: Get all messages in the same conversation (Inbox + SentItems)
  const folders = ["inbox", "sentitems"];
  for (const folder of folders) {
    console.log(`Searching ${folder} for replies in conversation`);

    let nextLink = `${GRAPH_BASE}/me/mailFolders/${folder}/messages?$top=50&$filter=conversationId eq '${conversationId}'&$select=receivedDateTime,bodyPreview`;

    while (nextLink) {
      const replyRes = await fetch(nextLink, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
      });

      if (!replyRes.ok) {
        const err = await replyRes.text();
        console.error(`Failed to fetch messages from ${folder}: ${err}`);
        break;
      }

      const data = await replyRes.json();
      const messages = data.value || [];

      for (const msg of messages) {
        console.log(`Data from search ${msg.receivedDateTime}`);
        console.log(`Data from search ${msg.bodyPreview}`);

        const msgDate = new Date(msg.receivedDateTime);
        if (msgDate <= originalDate) continue;
        // If it is later in the chain it is replied to and should be marked as such
        // Even if the user re-sent a message or re-received one the new one will be marked as waiting or needs reply so it works!
        console.log(`Reply found for message ID: ${messageId}`);
        return true;
      }

      nextLink = data["@odata.nextLink"] || null;
    }
  }

  console.log(`No reply found for message ID: ${messageId}`);
  return false;
}

async function getAccessToken() {
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

async function getBackEndAccessToken() {
  const msalConfig = {
    auth: {
      clientId: "63e4f7da-45fc-45fa-9300-72b3038e72ef",
      authority: "https://login.microsoftonline.com/common",
      redirectUri: "https://outlook.office.com/"
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
  return result.accessToken;
}
