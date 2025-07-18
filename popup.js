class UIDevKitPopup {
  constructor() {
    this.measureBtn = document.getElementById("measureBtn");
    this.clearBtn = document.getElementById("clearBtn");
    this.status = document.getElementById("status");
    this.statusText = this.status.querySelector(".status-text");

    // Converter elements
    this.converterInput = document.getElementById("converterInput");
    this.converterOutput = document.getElementById("converterOutput");
    this.fromUnit = document.getElementById("fromUnit");
    this.toUnit = document.getElementById("toUnit");
    this.rootFontSize = document.getElementById("rootFontSize");
    this.viewportWidth = document.getElementById("viewportWidth");
    this.viewportHeight = document.getElementById("viewportHeight");

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

    // Check current state when popup opens
    this.checkCurrentState();

    // Initial conversion
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
      const results = await browser.tabs.sendMessage(tab.id, {
        action: "getState",
      });

      if (results && results.measuring) {
        this.measureBtn.classList.add("active");
        this.measureBtn.querySelector("span:last-child").textContent =
          "Stop Measuring";
        this.updateStatus("Click and drag to measure distance");
      }
    } catch (error) {
      console.log("Content script not ready yet");
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
      }, 3500);
    } catch (error) {
      console.error("Error clearing measurements:", error);
    }
  }

  updateStatus(message) {
    this.statusText.textContent = message;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new UIDevKitPopup();
});
