class UIDevKitEyedropper {
  constructor() {
    this.pickingColor = false;
    this.hoverFeedbackBox = null;
    this.overlay = null;
    this.screenshotCanvas = null;
    this.screenshotCtx = null;
    this.screenshotData = null;
    this.devicePixelRatio = window.devicePixelRatio || 1; // Get device pixel ratio for accurate pixel picking

    // Store references to resolve/reject the startPicking promise
    this._resolveStartPicking = null;
    this._rejectStartPicking = null;

    this.init();
  }

  async init() {
    this.createHoverFeedback();
    this.createOverlay();

    // Listen for messages from popup and background script
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "toggleColorPicker") {
        // Toggle color picker and then send response
        this.toggleColorPicker().then((result) => {
          sendResponse(result);
        });
        return true; // Keep message channel open for async response
      } else if (
        message.action === "getState" &&
        message.tool === "eyedropper"
      ) {
        sendResponse({ pickingColor: this.pickingColor });
      } else if (message.action === "screenshotCaptured") {
        // This message comes from the background script after it captures the screenshot
        if (this._resolveStartPicking || this._rejectStartPicking) {
          // Only process if startPicking is awaiting
          if (message.dataUrl) {
            this.loadScreenshotToCanvas(message.dataUrl)
              .then(() => {
                this.pickingColor = true; // Set pickingColor to true after canvas is ready
                this.showPickingInterface();
                this.updateStatus(
                  "Click right-mouse button to pick color, or Esc to cancel."
                );
                if (this._resolveStartPicking) this._resolveStartPicking(); // Resolve the startPicking promise
              })
              .catch((error) => {
                console.error("Error loading screenshot to canvas:", error);
                this.updateStatus(
                  "Error: Could not prepare color picker. " + error.message
                );
                this.stopPicking();
                if (this._rejectStartPicking) this._rejectStartPicking(error); // Reject the startPicking promise
              });
          } else {
            const error = new Error(
              message.error ||
                "Screenshot data not received from background script."
            );
            console.error(error.message);
            this.updateStatus(
              "Error: Could not get screenshot for color picker."
            );
            this.stopPicking();
            if (this._rejectStartPicking) this._rejectStartPicking(error); // Reject the startPicking promise
          }
        }
      }
    });
  }

  createHoverFeedback() {
    this.hoverFeedbackBox = document.createElement("div");
    this.hoverFeedbackBox.className = "uidevkit-hover-feedback";
    this.hoverFeedbackBox.innerHTML = `
      <div class="color-swatch"></div>
      <span class="color-text">#ffffff</span>
    `;
    document.body.appendChild(this.hoverFeedbackBox);
  }

  createOverlay() {
    this.overlay = document.createElement("div");
    this.overlay.className = "uidevkit-color-picker-overlay";
    document.body.appendChild(this.overlay);
  }

  async toggleColorPicker() {
    if (this.pickingColor) {
      this.stopPicking();
    } else {
      // Await startPicking to ensure the tool is fully activated and ready
      try {
        await this.startPicking();
      } catch (error) {
        console.error(
          "toggleColorPicker caught error from startPicking:",
          error
        );
        this.pickingColor = false; // Ensure state is false if startPicking failed
      }
    }
    return { pickingColor: this.pickingColor };
  }

  async startPicking() {
    if (this.pickingColor) return; // Prevent multiple activations

    this.updateStatus("Capturing screenshot...");

    return new Promise(async (resolve, reject) => {
      // Store resolve/reject for the 'screenshotCaptured' message handler to call
      this._resolveStartPicking = resolve;
      this._rejectStartPicking = reject;

      try {
        // Send a message to background.js to capture the screenshot.
        // Await this message's response to confirm the request was sent
        const response = await browser.runtime.sendMessage({
          action: "captureScreenshot",
        });

        if (!response.success) {
          throw new Error(
            response.error || "Background script failed to initiate screenshot."
          );
        }
        // If response.success is true, the 'screenshotCaptured' message will follow
        // to handle the rest of the activation (loading canvas, showing interface).
        // Promise will be resolved in the message listener.
      } catch (error) {
        console.error("Error requesting screenshot from background:", error);
        this.updateStatus(
          "Error: Failed to request screenshot. " + error.message
        );
        this.stopPicking();
        reject(error); // Reject the promise immediately if request fails
        this._resolveStartPicking = null; // Clear resolvers
        this._rejectStartPicking = null;
      }
    });
  }

  async loadScreenshotToCanvas(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Remove existing canvas if any to prevent duplicates
        if (this.screenshotCanvas && this.screenshotCanvas.parentNode) {
          this.screenshotCanvas.remove();
        }

        // Create canvas to hold screenshot
        this.screenshotCanvas = document.createElement("canvas");
        // Hide canvas visually, but keep it in DOM for pixel data
        this.screenshotCanvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            z-index: -1; /* Keep it behind everything */
            opacity: 0; /* Make it invisible */
            pointer-events: none; /* Do not interfere with mouse events */
        `;
        document.body.appendChild(this.screenshotCanvas);

        this.screenshotCtx = this.screenshotCanvas.getContext("2d");

        // Set canvas size to match the image
        this.screenshotCanvas.width = img.width;
        this.screenshotCanvas.height = img.height;

        // Draw image to canvas
        this.screenshotCtx.drawImage(img, 0, 0);

        // Get image data for pixel sampling
        this.screenshotData = this.screenshotCtx.getImageData(
          0,
          0,
          this.screenshotCanvas.width,
          this.screenshotCanvas.height
        );

        resolve();
      };
      img.onerror = (e) => {
        console.error("Error loading screenshot image:", e);
        reject(new Error("Failed to load screenshot image."));
      };
      img.src = dataUrl;
    });
  }

  showPickingInterface() {
    this.hoverFeedbackBox.style.display = "flex";
    this.overlay.style.display = "block";
    document.body.style.cursor = "crosshair";

    // Add event listeners to the overlay and document
    this.overlay.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.overlay.addEventListener(
      "contextmenu",
      this.handleRightClick.bind(this)
    );
    document.addEventListener("keydown", this.handleEscapeKey.bind(this));
    document.addEventListener("contextmenu", this.preventDefault);
  }

  handleMouseMove(event) {
    if (!this.pickingColor || !this.screenshotData) return;

    // Update hover feedback position
    this.updateHoverFeedbackPosition(event.clientX, event.clientY);

    // Get color at cursor position from screenshot data
    const color = this.getColorAtPosition(event.clientX, event.clientY);
    this.updateHoverFeedback(color);
  }

  getColorAtPosition(clientX, clientY) {
    if (!this.screenshotData) return "#ffffff";

    // Account for device pixel ratio and scroll position
    // clientX/Y are relative to viewport. screenshotData is relative to full page/tab.
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Convert client coordinates to screenshot coordinates, considering DPR
    const x = Math.floor((clientX + scrollX) * this.devicePixelRatio);
    const y = Math.floor((clientY + scrollY) * this.devicePixelRatio);

    // Ensure coordinates are within bounds of the screenshot data
    const maxX = this.screenshotData.width - 1;
    const maxY = this.screenshotData.height - 1;

    const clampedX = Math.max(0, Math.min(x, maxX));
    const clampedY = Math.max(0, Math.min(y, maxY));

    // Calculate pixel index in the flat data array (RGBA, 4 bytes per pixel)
    const pixelIndex = (clampedY * this.screenshotData.width + clampedX) * 4;
    const r = this.screenshotData.data[pixelIndex];
    const g = this.screenshotData.data[pixelIndex + 1];
    const b = this.screenshotData.data[pixelIndex + 2];
    // const a = this.screenshotData.data[pixelIndex + 3]; // Alpha value, not strictly needed for HEX

    // Convert to hex
    return this.rgbToHex([r, g, b]);
  }

  rgbToHex(rgbArray) {
    const toHex = (c) => {
      const hex = Math.round(Math.max(0, Math.min(255, c))).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    return `#${toHex(rgbArray[0])}${toHex(rgbArray[1])}${toHex(rgbArray[2])}`;
  }

  updateHoverFeedbackPosition(x, y) {
    const rect = this.hoverFeedbackBox.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x + 15;
    let top = y - rect.height - 15;

    // Adjust if going off screen
    if (left + rect.width > viewportWidth) {
      left = x - rect.width - 15;
    }
    if (top < 0) {
      top = y + 15;
    }

    this.hoverFeedbackBox.style.left = left + "px";
    this.hoverFeedbackBox.style.top = top + "px";
    this.hoverFeedbackBox.style.right = "auto";
  }

  updateHoverFeedback(hexColor) {
    if (!hexColor) hexColor = "#ffffff";

    const colorSwatch = this.hoverFeedbackBox.querySelector(".color-swatch");
    const colorText = this.hoverFeedbackBox.querySelector(".color-text");

    colorSwatch.style.backgroundColor = hexColor;
    colorText.textContent = hexColor.toUpperCase();
  }

  handleRightClick(event) {
    if (!this.pickingColor || !this.screenshotData) return;

    event.preventDefault(); // Prevent default context menu
    event.stopPropagation(); // Stop event propagation

    const color = this.getColorAtPosition(event.clientX, event.clientY);
    this.processPickedColor(color);
    this.stopPicking(); // Stop picking after color is saved
  }

  handleEscapeKey(event) {
    if (event.key === "Escape" && this.pickingColor) {
      this.stopPicking();
    }
  }

  async processPickedColor(hexColor) {
    // Ensure hex color is properly formatted
    if (!hexColor) {
      hexColor = "#ffffff";
    }

    if (!hexColor.startsWith("#")) {
      hexColor = "#" + hexColor;
    }

    // Normalize to uppercase for consistency
    hexColor = hexColor.toUpperCase();

    // Save to localStorage
    try {
      await browser.storage.local.set({ lastPickedColor: hexColor });
    } catch (error) {
      console.error("Error saving color to storage:", error);
    }

    // Send message to popup if it's open
    try {
      await browser.runtime.sendMessage({
        action: "pickedColor",
        color: { hex: hexColor },
      });
    } catch (error) {
      // Popup might be closed, ignore error
      console.log("Could not send message to popup:", error);
    }
  }

  updateStatus(message) {
    // Send status update to popup if needed
    try {
      browser.runtime.sendMessage({
        action: "updateStatus",
        message: message,
      });
    } catch (error) {
      // Popup might be closed, ignore error
    }
  }

  preventDefault(event) {
    event.preventDefault();
  }

  stopPicking() {
    this.pickingColor = false;

    if (this.hoverFeedbackBox) {
      this.hoverFeedbackBox.style.display = "none";
    }

    if (this.overlay) {
      this.overlay.style.display = "none";
    }

    document.body.style.cursor = "";

    // Clean up screenshot data
    if (this.screenshotCanvas && this.screenshotCanvas.parentNode) {
      this.screenshotCanvas.remove();
      this.screenshotCanvas = null;
      this.screenshotCtx = null;
      this.screenshotData = null;
    }

    // Remove all event listeners
    if (this.overlay) {
      this.overlay.removeEventListener("mousemove", this.handleMouseMove);
      this.overlay.removeEventListener("contextmenu", this.handleRightClick);
    }
    document.removeEventListener("keydown", this.handleEscapeKey);
    document.removeEventListener("contextmenu", this.preventDefault);

    // Clear pending promise resolvers/rejectors
    this._resolveStartPicking = null;
    this._rejectStartPicking = null;
  }
}

// Initialize the eyedropper when the script loads
const uidevkitEyedropper = new UIDevKitEyedropper();
