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
    this.colorInputRgb = document.getElementById("colorInputRgb");
    this.colorInputOklch = document.getElementById("colorInputOklch");
    this.colorInputHsl = document.getElementById("colorInputHsl");

    // Quick Links
    this.quickLinks = document.querySelector(".quick-links");
    this.addLinkBtn = document.getElementById("addLinkBtn");
    this.addLinkForm = document.getElementById("addLinkForm");
    this.newLinkName = document.getElementById("linkName");
    this.newLinkUrl = document.getElementById("linkUrl");
    this.newLinkDesc = document.getElementById("linkDesc");
    this.saveLinkBtn = document.getElementById("saveLinkBtn");
    this.cancelLinkBtn = document.getElementById("cancelLinkBtn");

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
    this.colorInputRgb.addEventListener("input", () =>
      this.convertColor("rgb")
    );
    this.colorInputOklch.addEventListener("input", () =>
      this.convertColor("oklch")
    );
    this.colorInputHsl.addEventListener("input", () =>
      this.convertColor("hsl")
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

    // Initialize Quick Links
    this.populateQuickLinks();
    this.addLinkBtn.addEventListener("click", () => this.addQuickLink());
    this.saveLinkBtn.addEventListener("click", () => this.handleNewLink());
    this.cancelLinkBtn.addEventListener("click", () => this.hideAddLinkForm());
  }

  resetStatus() {
    setTimeout(() => {
      this.updateStatus("Ready");
    }, 3000);
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
      this.resetStatus();
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
      this.resetStatus();
    } else if (message.action === "updateStatus") {
      this.updateStatus(message.message);
      this.resetStatus();
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
    let rgb = "";
    let hsl = "";
    let oklch = "";

    try {
      let color;

      if (fromFormat === "hex") {
        hex = this.colorInputHex.value.trim();
        if (!hex) {
          this.clearColorOutputs(fromFormat);
          return;
        }
        color = new Color(hex);
      } else if (fromFormat === "rgb") {
        rgb = this.colorInputRgb.value.trim();
        if (!rgb) {
          this.clearColorOutputs(fromFormat);
          return;
        }
        color = new Color(rgb);
      } else if (fromFormat === "hsl") {
        hsl = this.colorInputHsl.value.trim();
        if (!hsl) {
          this.clearColorOutputs(fromFormat);
          return;
        }
        color = new Color(hsl);
      } else if (fromFormat === "oklch") {
        oklch = this.colorInputOklch.value.trim();
        if (!oklch) {
          this.clearColorOutputs(fromFormat);
          return;
        }
        color = new Color(oklch);
      }

      if (!color) {
        this.clearColorOutputs(fromFormat);
        return;
      }

      // Convert to all formats using Color.js built-in methods
      if (fromFormat !== "hex") {
        hex = color.toString({ format: "hex" });
      }
      if (fromFormat !== "rgb") {
        rgb = color.toString({ format: "rgb" });
      }
      if (fromFormat !== "hsl") {
        hsl = color.toString({ format: "hsl" });
      }
      if (fromFormat !== "oklch") {
        oklch = color.toString({ format: "oklch" });
      }
    } catch (e) {
      console.error("Color conversion error:", e);
      this.clearColorOutputs(fromFormat);
      return;
    }

    // Update the UI
    if (fromFormat !== "hex") this.colorInputHex.value = hex;
    if (fromFormat !== "rgb") this.colorInputRgb.value = rgb;
    if (fromFormat !== "hsl") this.colorInputHsl.value = hsl;
    if (fromFormat !== "oklch") this.colorInputOklch.value = oklch;
  }

  clearColorOutputs(exceptFormat) {
    if (exceptFormat !== "hex") this.colorInputHex.value = "";
    if (exceptFormat !== "rgb") this.colorInputRgb.value = "";
    if (exceptFormat !== "hsl") this.colorInputHsl.value = "";
    if (exceptFormat !== "oklch") this.colorInputOklch.value = "";
  }

  // loads user links from storage
  async loadUserLinks() {
    try {
      const result = await browser.storage.local.get(["userQuickLinks"]);
      return result.userQuickLinks || [];
    } catch (error) {
      console.error("Error loading user links:", error);
      return [];
    }
  }

  // Save user links to storage
  async saveUserLinks(userLinks) {
    try {
      await browser.storage.local.set({ userQuickLinks: userLinks });
    } catch (error) {
      console.error("Error saving user links:", error);
    }
  }

  // Function to populate QuickLinks
  async populateQuickLinks() {
    const defaultLinks = [
      {
        name: "MDN Web Docs",
        url: "https://developer.mozilla.org/en-US/",
        desc: "Documentation",
        isDefault: true,
      },
      {
        name: "Unused CSS",
        url: "https://unused-css.com/",
        desc: "Various CSS utilities",
        isDefault: true,
      },
      {
        name: "Minifier",
        url: "https://www.minifier.org/",
        desc: "Minify CSS, JS",
        isDefault: true,
      },
    ];

    // Load user defined links from storage
    const userLinks = await this.loadUserLinks();

    const allLinks = [...defaultLinks, ...userLinks];

    // Clear existing content to prevent duplication on re-population
    this.quickLinks.innerHTML = "";

    allLinks.forEach((link, index) => {
      // Only user-added links should be removable
      const removeButtonHtml = link.isDefault
        ? ""
        : `<button class="remove-link-btn" data-index="${index}">➖</button>`;

      this.quickLinks.innerHTML += `
        <li data-url="${link.url}">
        ${removeButtonHtml}
          <a href="${link.url}" target="_blank"
            ><b>${link.name} </b> [<i>${link.desc}</i>]
          </a>          
        </li>
      `;
    });

    // Attach event listeners to newly created remove buttons
    this.quickLinks.querySelectorAll(".remove-link-btn").forEach((button) => {
      button.addEventListener("click", (event) =>
        this.handleRemoveLinkClick(event)
      );
    });
  }

  // Handle click on remove link button
  async handleRemoveLinkClick(event) {
    const listItem = event.target.closest("li");
    if (!listItem) return;

    const urlToRemove = listItem.dataset.url; // Get URL from data attribute

    let userLinks = await this.loadUserLinks();
    // Filter out the link to be removed based on its URL
    userLinks = userLinks.filter((link) => link.url !== urlToRemove);

    await this.saveUserLinks(userLinks); // Save the updated list
    await this.populateQuickLinks(); // Re-populate the UI
    this.updateStatus("Link removed successfully!");
    this.resetStatus();
  }

  addQuickLink() {
    this.addLinkForm.style.display = "block";
  }
  hideAddLinkForm() {
    this.addLinkForm.style.display = "none";
  }
  clearLinkForm() {
    this.newLinkName.value = "";
    this.newLinkUrl.value = "";
    this.newLinkDesc.value = "";
  }

  // Function to handle user input for new link
  async handleNewLink() {
    const name = this.newLinkName.value.trim();
    const url = this.newLinkUrl.value.trim();
    const desc = this.newLinkDesc.value.trim();

    if (!name || !url) {
      this.updateStatus("Please provide both name and URL for the link.");
      this.resetStatus();
      return;
    }

    let userLinks = await this.loadUserLinks();
    if (userLinks.some((link) => link.url === url)) {
      this.updateStatus("This link already exists!");
      this.resetStatus();
      return;
    }

    await this.saveUserLinks([...userLinks, { name, url, desc }]);

    // Clear form and refresh display
    this.clearLinkForm();
    this.hideAddLinkForm();
    await this.populateQuickLinks();
    this.updateStatus("Link added successfully!");
    this.resetStatus();
  }

  updateStatus(message) {
    this.statusText.textContent = message;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new UIDevKitPopup();
});
