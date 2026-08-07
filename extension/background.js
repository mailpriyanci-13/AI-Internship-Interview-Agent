chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Interview & Internship Agent installed successfully.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getStorageData") {
    chrome.storage.local.get(null, (data) => {
      sendResponse(data);
    });
    return true;
  }
});