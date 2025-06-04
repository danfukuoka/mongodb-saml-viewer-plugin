document.addEventListener("DOMContentLoaded", function () {
  const toggle = document.getElementById("hostAccessToggle");

  // Check permission status on load
  chrome.permissions.contains({ origins: ["<all_urls>"] }, function (granted) {
    toggle.checked = !granted;
  });

  // Handle toggle interaction
  toggle.addEventListener("change", function () {
    if (!toggle.checked) {
      chrome.permissions.request({ origins: ["<all_urls>"] }, function (granted) {
        if (!granted) toggle.checked = true;
      });
    } else {
      chrome.permissions.remove({ origins: ["<all_urls>"] }, function (removed) {
        if (!removed) toggle.checked = false;
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

      const samlResponse = response.samlResponse;

      // Decode the base64-encoded SAMLResponse to retrieve the XML payload
      const formattedSamlResponse = formatXML(atob(samlResponse));

      document.getElementById("samlOutput").textContent = formattedSamlResponse;

      try {
        const fields = extractSAMLFields(formattedSamlResponse);
        updateField("nameID", fields.nameID);
        updateField("firstName", fields.firstName);
        updateField("lastName", fields.lastName);
        updateField("memberOf", fields.memberOf);

        copyButton.disabled = false;
        copyButton.addEventListener("click", function () {
          navigator.clipboard.writeText(samlResponse).then(function () {
            copyButton.textContent = "Copied.";
            setTimeout(() => (copyButton.textContent = "Copy SAML Response to Clipboard"), 5000);
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
      firstName: getText("//saml:Attribute[@Name='firstName']/*[local-name()='AttributeValue']"),
      lastName: getText("//saml:Attribute[@Name='lastName']/*[local-name()='AttributeValue']"),
      memberOf: getMultiText("//saml:Attribute[@Name='memberOf']/*[local-name()='AttributeValue']")
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

// Pretty-print XML with indentation
function formatXML(xml) {
  const PADDING = '  '; // 2 spaces
  const reg = /(>)(<)(\/*)/g;
  let pad = 0;

  xml = xml.replace(reg, '$1\r\n$2$3');
  return xml.split('\r\n').map((node) => {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (node.match(/^<\/\w/)) {
      if (pad !== 0) pad -= 1;
    } else if (node.match(/^<\w([^>]*[^/])?>.*$/)) {
      indent = 1;
    } else {
      indent = 0;
    }

    const line = PADDING.repeat(pad) + node;
    pad += indent;
    return line;
  }).join('\r\n');
}
