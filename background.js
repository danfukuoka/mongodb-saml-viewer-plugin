let samlResponseMemory = null;

// Listen to outgoing POST requests and extract SAMLResponse if present
chrome.webRequest.onBeforeRequest.addListener(
  function (details) {
    if (details.method === "POST" && details.requestBody) {
      const formData = details.requestBody.formData;

      if (formData && formData.SAMLResponse) {
        const samlResponsePost = formData.SAMLResponse[0];
        const decodedSamlPost = atob(samlResponsePost);
        console.log("Captured SAML Response (POST Binding):", decodedSamlPost);

        // Save SAML response in memory
        samlResponseMemory = decodedSamlPost;
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// Respond to popup request with stored SAML response
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSamlResponse") {
    sendResponse({ samlResponse: samlResponseMemory });
  }
});
