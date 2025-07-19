class UIDevKitPopup {
  constructor() {
    this.measureBtn = document.getElementById("measureBtn");
    this.clearBtn = document.getElementById("clearBtn");
    this.status = document.getElementById("status");
    this.statusText = this.status.querySelector(".status-text");

    // Measure Converter elements
    this.converterInput = document.getElementById("converterInput");
    this.converterOutput = document.getElementById("converterOutput");
    this.fromUnit = document.getElementById("fromUnit");
    this.toUnit = document.getElementById("toUnit");
    this.rootFontSize = document.getElementById("rootFontSize");
    this.viewportWidth = document.getElementById("viewportWidth");
    this.viewportHeight = document.getElementById("viewportHeight");

    // Color Picker elements
    this.pickColorBtn = document.getElementById("pickColorBtn");
    this.pickedColorHex = document.getElementById("pickedColorHex");
    this.colorPreview = document.getElementById("colorPreview");

    // Color Converter elements
    this.colorInputHex = document.getElementById("colorInputHex");
    this.colorInputRgba = document.getElementById("colorInputRgba");
    this.colorInputOklch = document.getElementById("colorInputOklch");

    this.init();
  }

  init() {
    this.measureBtn.addEventListener("click", () => this.toggleMeasurement());
    this.clearBtn.addEventListener("click", () => this.clearMeasurements());

    // Converter event listeners
    this.converterInput.addEventListener("input", () => this.convertUnits());
    this.fromUnit.addEventListener("change", () => this.convertUnits());
    this.toUnit.addEventListener("change", () => this.convertUnits());
    this.rootFontSize.addEventListener("input", () => this.convertUnits());
    this.viewportWidth.addEventListener("input", () => this.convertUnits());
    this.viewportHeight.addEventListener("input", () => this.convertUnits());

    // Color Picker event listener
    this.pickColorBtn.addEventListener("click", () => this.toggleColorPicker());

    // Color Converter event listeners
    this.colorInputHex.addEventListener("input", () =>
      this.convertColor("hex")
    );
    this.colorInputRgba.addEventListener("input", () =>
      this.convertColor("rgba")
    );
    this.colorInputOklch.addEventListener("input", () =>
      this.convertColor("oklch")
    );

    // Listen for messages from content scripts (only for pickedColor now)
    browser.runtime.onMessage.addListener((message) =>
      this.handleMessage(message)
    );

    // Check current state when popup opens
    this.checkCurrentState();
    // Load last picked color from storage
    this.loadLastPickedColor();

    // Initial unit conversion
    this.convertUnits();
  }

  convertUnits() {
    const inputValue = parseFloat(this.converterInput.value);
    if (isNaN(inputValue)) {
      this.converterOutput.value = "";
      return;
    }

    const fromUnit = this.fromUnit.value;
    const toUnit = this.toUnit.value;
    const rootSize = parseFloat(this.rootFontSize.value) || 16;
    const vpWidth = parseFloat(this.viewportWidth.value) || 1920;
    const vpHeight = parseFloat(this.viewportHeight.value) || 1080;

    // Convert input to pixels first
    let pixelValue = this.convertToPixels(
      inputValue,
      fromUnit,
      rootSize,
      vpWidth,
      vpHeight
    );

    // Convert pixels to target unit
    let result = this.convertFromPixels(
      pixelValue,
      toUnit,
      rootSize,
      vpWidth,
      vpHeight
    );

    // Format result
    if (result % 1 === 0) {
      this.converterOutput.value = result.toString();
    } else {
      this.converterOutput.value = result.toFixed(4).replace(/\.?0+$/, "");
    }
  }

  convertToPixels(value, unit, rootSize, vpWidth, vpHeight) {
    switch (unit) {
      case "px":
        return value;
      case "rem":
        return value * rootSize;
      case "em":
        return value * rootSize; // Assuming em = rem for simplicity
      case "pt":
        return value * (96 / 72); // 1pt = 1/72 inch, 96 DPI
      case "vh":
        return (value / 100) * vpHeight;
      case "vw":
        return (value / 100) * vpWidth;
      case "percent":
        return (value / 100) * vpWidth; // Assuming % of viewport width
      default:
        return value;
    }
  }

  convertFromPixels(pixels, unit, rootSize, vpWidth, vpHeight) {
    switch (unit) {
      case "px":
        return pixels;
      case "rem":
        return pixels / rootSize;
      case "em":
        return pixels / rootSize; // Assuming em = rem for simplicity
      case "pt":
        return pixels / (96 / 72); // 1pt = 1/72 inch, 96 DPI
      case "vh":
        return (pixels / vpHeight) * 100;
      case "vw":
        return (pixels / vpWidth) * 100;
      case "percent":
        return (pixels / vpWidth) * 100; // Assuming % of viewport width
      default:
        return pixels;
    }
  }

  async checkCurrentState() {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      // Send message to both content scripts to get their state
      const rulerState = await browser.tabs.sendMessage(tab.id, {
        action: "getState",
        tool: "ruler",
      });
      const eyedropperState = await browser.tabs.sendMessage(tab.id, {
        action: "getState",
        tool: "eyedropper",
      });

      if (rulerState && rulerState.measuring) {
        this.measureBtn.classList.add("active");
        this.measureBtn.querySelector("span:last-child").textContent =
          "Stop Measuring";
        this.updateStatus("Click and drag to measure distance");
      } else {
        this.measureBtn.classList.remove("active");
        this.measureBtn.querySelector("span:last-child").textContent =
          "Measure Distance";
      }

      if (eyedropperState && eyedropperState.pickingColor) {
        this.pickColorBtn.classList.add("active");
        this.pickColorBtn.querySelector("span:last-child").textContent =
          "Stop Picking Color";
        this.updateStatus("Click on any element to pick its color");
      } else {
        this.pickColorBtn.classList.remove("active");
        this.pickColorBtn.querySelector("span:last-child").textContent =
          "Pick Color from Page";
      }

      // If neither is active, set status to Ready
      if (!rulerState.measuring && !eyedropperState.pickingColor) {
        this.updateStatus("Ready");
      }
    } catch (error) {
      console.log(
        "Content script not ready yet or error getting state:",
        error
      );
      this.updateStatus("Error: Please refresh the page");
    }
  }

  async toggleMeasurement() {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const results = await browser.tabs.sendMessage(tab.id, {
        action: "toggleMeasurement",
      });

      if (results && results.measuring) {
        this.measureBtn.classList.add("active");
        this.measureBtn.querySelector("span:last-child").textContent =
          "Stop Measuring";
        this.updateStatus("Click and drag to measure distance");
        // Ensure color picker is off if measurement starts
        if (this.pickColorBtn.classList.contains("active")) {
          await browser.tabs.sendMessage(tab.id, {
            action: "toggleColorPicker",
          }); // Turn off eyedropper
          this.pickColorBtn.classList.remove("active");
          this.pickColorBtn.querySelector("span:last-child").textContent =
            "Pick Color from Page";
        }
      } else {
        this.measureBtn.classList.remove("active");
        this.measureBtn.querySelector("span:last-child").textContent =
          "Measure Distance";
        this.updateStatus("Ready");
      }
    } catch (error) {
      console.error("Error toggling measurement:", error);
      this.updateStatus("Error: Please refresh the page");
    }
  }

  async clearMeasurements() {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      await browser.tabs.sendMessage(tab.id, { action: "clearMeasurements" });
      this.updateStatus("All measurements cleared");
      setTimeout(() => {
        this.updateStatus("Ready");
      }, 3000);
    } catch (error) {
      console.error("Error clearing measurements:", error);
    }
  }

  async toggleColorPicker() {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const results = await browser.tabs.sendMessage(tab.id, {
        action: "toggleColorPicker",
      });

      if (results && results.pickingColor) {
        this.pickColorBtn.classList.add("active");
        this.pickColorBtn.querySelector("span:last-child").textContent =
          "Stop Picking Color";
        this.updateStatus("Click on any element to pick its color");
        // Ensure measurement tool is off if color picker starts
        if (this.measureBtn.classList.contains("active")) {
          await browser.tabs.sendMessage(tab.id, {
            action: "toggleMeasurement",
          }); // Turn off ruler
          this.measureBtn.classList.remove("active");
          this.measureBtn.querySelector("span:last-child").textContent =
            "Measure Distance";
        }
      } else {
        this.pickColorBtn.classList.remove("active");
        this.pickColorBtn.querySelector("span:last-child").textContent =
          "Pick Color from Page";
        this.updateStatus("Ready");
      }
    } catch (error) {
      console.error("Error toggling color picker:", error);
      this.updateStatus("Error: Please refresh the page");
    }
  }

  handleMessage(message) {
    if (
      message.action === "pickedColor" &&
      message.color &&
      message.color.hex
    ) {
      // Update the picked color display with the new color
      this.updatePickedColorFromHex(message.color.hex);

      // Update status to show color was picked
      this.updateStatus(`Color picked: ${message.color.hex}`);
      setTimeout(() => {
        this.updateStatus("Ready");
      }, 3000);
    } else if (message.action === "updateStatus") {
      this.updateStatus(message.message);
    }
  }

  /**
   * Updates the UI with the picked color
   * @param {string} hexColor - The HEX color string.
   */
  updatePickedColorFromHex(hexColor) {
    this.pickedColorHex.value = hexColor || "";
    this.colorPreview.style.backgroundColor = hexColor || "#000000";
  }

  /**
   * Loads the last picked HEX color from browser local storage
   */
  async loadLastPickedColor() {
    try {
      const result = await browser.storage.local.get("lastPickedColor");
      if (result.lastPickedColor) {
        this.updatePickedColorFromHex(result.lastPickedColor);
      } else {
        this.updatePickedColorFromHex("#ffffff"); // Default to white if no color is stored
      }
    } catch (error) {
      console.error("Error loading last picked color:", error);
    }
  }

  convertColor(fromFormat) {
    let hex = "";
    let rgba = "";
    let oklch = "";

    try {
      if (fromFormat === "hex") {
        hex = this.colorInputHex.value.trim();
        if (!hex) {
          this.colorInputRgba.value = "";
          this.colorInputOklch.value = "";
          return;
        }
        const rgbaArray = this.hexToRgbaArray(hex);
        rgba = rgbaArray ? `rgba(${rgbaArray.join(", ")})` : "";
        oklch = rgbaArray ? this.rgbaToOklch(rgbaArray) : "";
      } else if (fromFormat === "rgba") {
        rgba = this.colorInputRgba.value.trim();
        if (!rgba) {
          this.colorInputHex.value = "";
          this.colorInputOklch.value = "";
          return;
        }
        const rgbaArray = this.parseRgba(rgba);
        hex = rgbaArray ? this.rgbaArrayToHex(rgbaArray) : "";
        oklch = rgbaArray ? this.rgbaToOklch(rgbaArray) : "";
      } else if (fromFormat === "oklch") {
        oklch = this.colorInputOklch.value.trim();
        if (!oklch) {
          this.colorInputHex.value = "";
          this.colorInputRgba.value = "";
          return;
        }
        const rgbaArray = this.oklchToRgba(oklch);
        hex = rgbaArray ? this.rgbaArrayToHex(rgbaArray) : "";
        rgba = rgbaArray ? `rgba(${rgbaArray.join(", ")})` : "";
      }
    } catch (e) {
      console.error("Color conversion error:", e);
      // Clear outputs on error
      if (fromFormat !== "hex") this.colorInputHex.value = "";
      if (fromFormat !== "rgba") this.colorInputRgba.value = "";
      if (fromFormat !== "oklch") this.colorInputOklch.value = "";
      return;
    }

    if (fromFormat !== "hex") this.colorInputHex.value = hex;
    if (fromFormat !== "rgba") this.colorInputRgba.value = rgba;
    if (fromFormat !== "oklch") this.colorInputOklch.value = oklch;
  }

  // Helper functions for color conversion
  hexToRgbaArray(hex) {
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
      c = hex.substring(1).split("");
      if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      c = "0x" + c.join("");
      // Ensure alpha is 1 if not explicitly present in hex (e.g., #RRGGBB vs #RRGGBBAA)
      return [(c >> 16) & 255, (c >> 8) & 255, c & 255, 1];
    }
    return null;
  }

  rgbaArrayToHex(rgbaArray) {
    if (!rgbaArray || rgbaArray.length < 3) return "";
    const toHex = (c) => {
      const hex = Math.round(c).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };
    const alphaHex =
      rgbaArray[3] !== undefined && rgbaArray[3] < 1
        ? toHex(rgbaArray[3] * 255)
        : "";
    return `#${toHex(rgbaArray[0])}${toHex(rgbaArray[1])}${toHex(
      rgbaArray[2]
    )}${alphaHex}`;
  }

  parseRgba(rgbaString) {
    const match = rgbaString.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*\.?\d+))?\)/
    );
    if (match) {
      return [
        parseInt(match[1]),
        parseInt(match[2]),
        parseInt(match[3]),
        match[4] ? parseFloat(match[4]) : 1,
      ];
    }
    return null;
  }

  // Simplified OKLCH conversion (requires a more robust library for accurate conversion)
  rgbaToOklch(rgbaArray) {
    if (!rgbaArray) return "";
    const r = rgbaArray[0] / 255;
    const g = rgbaArray[1] / 255;
    const b = rgbaArray[2] / 255;

    const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) * 100;
    const C = Math.sqrt((r - 0.5) ** 2 + (g - 0.5) ** 2 + (b - 0.5) ** 2) * 100;
    const H = Math.atan2(g - 0.5, r - 0.5) * (180 / Math.PI);
    return `oklch(${L.toFixed(2)}% ${C.toFixed(2)} ${H.toFixed(2)})`;
  }

  oklchToRgba(oklchString) {
    const match = oklchString.match(
      /oklch\((\d*\.?\d+)%\s*(\d*\.?\d+)\s*(\d*\.?\d+)\)/
    );
    if (match) {
      const L = parseFloat(match[1]) / 100;
      const C = parseFloat(match[2]) / 100;
      const H = parseFloat(match[3]) * (Math.PI / 180);

      const r = L + C * Math.cos(H);
      const g = L + C * Math.sin(H);
      const b = L - C * Math.cos(H) - C * Math.sin(H);

      return [
        Math.round(Math.max(0, Math.min(255, r * 255))),
        Math.round(Math.max(0, Math.min(255, g * 255))),
        Math.round(Math.max(0, Math.min(255, b * 255))),
        1,
      ];
    }
    return null;
  }

  updateStatus(message) {
    this.statusText.textContent = message;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new UIDevKitPopup();
});
