document.addEventListener("DOMContentLoaded", function () {
  const toggle = document.getElementById("hostAccessToggle");

  // Check permission status on load
  chrome.permissions.contains({ origins: ["<all_urls>"] }, function (granted) {
    // If <all_urls> is granted, uncheck the box (i.e., not restricted)
    toggle.checked = !granted;
  });

  // Handle toggle interaction
  toggle.addEventListener("change", function () {
    if (!toggle.checked) {
      // User wants to allow access to all URLs
      chrome.permissions.request({ origins: ["<all_urls>"] }, function (granted) {
        if (!granted) toggle.checked = true; // If user cancels, revert checkbox
      });
    } else {
      // User wants to restrict to only auth.mongodb.com
      chrome.permissions.remove({ origins: ["<all_urls>"] }, function (removed) {
        if (!removed) toggle.checked = false; // If removal failed, revert checkbox
      });
    }
  });

  // Request latest SAML response from background
  chrome.runtime.sendMessage({ action: "getSamlResponse" }, function (response) {
    const noResponseMessage = document.getElementById("noResponseMessage");
    const contentContainer = document.getElementById("contentContainer");
    const copyButton = document.getElementById("copyButton");
    const hostAccessField = document.getElementById("hostAccessField");

    if (response && response.samlResponse) {
      noResponseMessage.style.display = "none";
      contentContainer.style.display = "block";
      hostAccessField.style.display = "none";

      const formattedSAML = response.samlResponse;
      document.getElementById("samlOutput").textContent = formattedSAML;

      try {
        const fields = extractSAMLFields(formattedSAML);
        updateField("nameID", fields.nameID);
        updateField("firstName", fields.firstName);
        updateField("lastName", fields.lastName);
        updateField("memberOf", fields.memberOf);

        copyButton.disabled = false;
        copyButton.addEventListener("click", function () {
          const nameID = document.getElementById("nameID").textContent.trim();
          const firstName = document.getElementById("firstName").textContent.trim();
          const lastName = document.getElementById("lastName").textContent.trim();
          const memberOf = document.getElementById("memberOf").innerHTML.trim();

          const copyText = `
SAML Response:
${formattedSAML}

Fields:
NameID: ${nameID}
First Name: ${firstName}
Last Name: ${lastName}
Member Of: ${memberOf}`;

          navigator.clipboard.writeText(copyText).then(function () {
            copyButton.textContent = "Copied! Paste it into your MongoDB support case.";
            setTimeout(() => (copyButton.textContent = "Copy to Clipboard"), 5000);
          }).catch(console.error);
        });
      } catch (e) {
        console.error("Error parsing SAML response:", e);
      }
    } else {
      noResponseMessage.style.display = "block";
      contentContainer.style.display = "none";
    }
  });
});

// Parse SAML fields using XPath
function extractSAMLFields(xmlString) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const nsResolver = (prefix) => {
      const ns = {
        saml: "urn:oasis:names:tc:SAML:2.0:assertion"
      };
      return ns[prefix] || null;
    };

    const getText = (xpath) => {
      const result = xmlDoc.evaluate(xpath, xmlDoc, nsResolver, XPathResult.STRING_TYPE, null);
      return result.stringValue.trim() || null;
    };

    const getMultiText = (xpath) => {
      const nodes = xmlDoc.evaluate(xpath, xmlDoc, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      return Array.from({ length: nodes.snapshotLength }, (_, i) => nodes.snapshotItem(i).textContent.trim());
    };

    return {
      nameID: getText("//saml:NameID"),
      firstName: getText("//saml:Attribute[@Name='firstName']/saml:AttributeValue"),
      lastName: getText("//saml:Attribute[@Name='lastName']/saml:AttributeValue"),
      memberOf: getMultiText("//saml:Attribute[@Name='memberOf']/saml:AttributeValue")
    };
  } catch (e) {
    console.error("Error parsing XML:", e);
    return { nameID: null, firstName: null, lastName: null, memberOf: [] };
  }
}

// Update UI with parsed field
function updateField(fieldId, value) {
  const element = document.getElementById(fieldId);

  if (!value || (Array.isArray(value) && value.length === 0)) {
    element.classList.remove("ok");
    return;
  }

  element.classList.add("ok");

  if (fieldId === "memberOf") {
    element.innerHTML = value.map(val => `<span>- ${val}</span>`).join("<br>");
  } else {
    element.textContent = value;
  }
}