/**
 * Background Script for UI DEV Kit
 */

// Import to make 'browser' API available in the service worker context
importScripts("lib/browser-polyfill.min.js");

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "captureScreenshot") {
    return handleScreenshotCapture(request, sender);
  }
  // For other messages not handled here, do nothing.
});

/**
 * Handles the screenshot capture request.
 * This function is async and returns a Promise that resolves with the screenshot data or an error.
 * The promise resolution will be used by the sender's await/then.
 * @param {object} request - The message request object.
 * @param {object} sender - The sender object containing tab information.
 * @returns {Promise<object>} A promise that resolves with { success: boolean, dataUrl?: string, error?: string }.
 */
async function handleScreenshotCapture(request, sender) {
  try {
    // Capture the visible tab
    const dataUrl = await browser.tabs.captureVisibleTab(sender.tab.windowId, {
      format: "png",
    });

    // Send the screenshot data back to the content script
    browser.tabs
      .sendMessage(sender.tab.id, {
        action: "screenshotCaptured",
        dataUrl: dataUrl,
      })
      .catch((error) => {
        console.error("Error sending screenshot to content script:", error);
      });

    return { success: true, dataUrl: dataUrl };
  } catch (error) {
    console.error("Error capturing screenshot:", error);

    // Send error message to content script
    browser.tabs
      .sendMessage(sender.tab.id, {
        action: "screenshotCaptured",
        error: error.message,
      })
      .catch((sendError) => {
        console.error(
          "Error sending error message to content script:",
          sendError
        );
      });

    return { success: false, error: error.message };
  }
}
