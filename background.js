let samlResponse = null; // Stored in memory (lifetime of the background script)

// Listen to outgoing POST requests and extract SAMLResponse if present
chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    if (details.method === "POST" && details.requestBody) {
      const formData = details.requestBody.formData;

      if (formData && formData.SAMLResponse) {
        // Save the captured SAMLResponse in memory (background script memory)
        samlResponse = formData.SAMLResponse[0];
        console.log("Captured SAML Response (POST Binding):", samlResponse);
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// Respond to popup request with stored SAML response
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSamlResponse") {
    // Return the SAMLResponse currently stored in memory
    sendResponse({ samlResponse: samlResponse });
  }
});
