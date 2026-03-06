// Hardcoded font list (no external dependency)
const fontConstants = [
  { value: "Arial", label: "Arial" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Georgia", label: "Georgia" },
  { value: "Courier New", label: "Courier New" },
  { value: "Verdana", label: "Verdana" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Trebuchet MS", label: "Trebuchet MS" },
];

interface FontConstant {
  value: string;
  label?: string;
}

interface TextColorToolAPI {
  inlineToolbar?: {
    open?: () => void;
    close?: () => void;
  };
  [key: string]: any;
}

export class TextColorTool {
  static get isInline(): boolean {
    return true;
  }

  static get sanitize(): Record<string, Record<string, boolean>> {
    return {
      span: {
        style: true,
      },

    };
  }

  private api: TextColorToolAPI;
  private colorPickerBtn!: HTMLButtonElement;
  private bgColorPickerBtn!: HTMLButtonElement;
  private fontPicker!: HTMLSelectElement;
  private fontSizePicker!: HTMLSelectElement;
  private superscriptBtn!: HTMLButtonElement;
  private subscriptBtn!: HTMLButtonElement;

  private colorPickerModal!: HTMLDivElement;
  private customColorInput!: HTMLInputElement;
  private colorPalette!: HTMLDivElement;
  private isForegroundPicker: boolean = true;
  private currentColorValue: string = "#000000";
  // Saved selection so clicking the color picker doesn't lose it
  private savedRange: Range | null = null;

  private readonly defaultColors = [
    "#000000",
    "#424242",
    "#636363",
    "#9E9E9E",
    "#C1C1C1",
    "#E0E0E0",
    "#FFFFFF",
    "#FFEBEE",
    "#FFCDD2",
    "#EF9A9A",
    "#E57373",
    "#EF5350",
    "#F44336",
    "#D32F2F",
    "#E3F2FD",
    "#BBDEFB",
    "#90CAF9",
    "#64B5F6",
    "#42A5F5",
    "#2196F3",
    "#1565C0",
    "#E8F5E9",
    "#C8E6C9",
    "#A5D6A7",
    "#81C784",
    "#66BB6A",
    "#4CAF50",
    "#2E7D32",
    "#FFFDE7",
    "#FFF9C4",
    "#FFF59D",
    "#FFF176",
    "#FFEE58",
    "#FFC107",
    "#FF9800",
    "#F3E5F5",
    "#E1BEE7",
    "#CE93D8",
    "#BA68C8",
    "#AB47BC",
    "#9C27B0",
    "#7B1FA2",
  ];

  private readonly defaultBgColors = [
    "#FFFFFF",
    "#F5F5F5",
    "#EEEEEE",
    "#E0E0E0",
    "#BDBDBD",
    "#9E9E9E",
    "#FFEBEE",
    "#F3E5F5",
    "#E8EAF6",
    "#E3F2FD",
    "#E0F2F1",
    "#F1F8E9",
    "#FFFDE7",
    "#FFF3E0",
    "#FFCDD2",
    "#F8BBD0",
    "#C5CAE9",
    "#BBDEFB",
    "#B2DFDB",
    "#DCEDC8",
    "#FFF9C4",
    "#FFE0B2",
    "#EF9A9A",
    "#F48FB1",
    "#9FA8DA",
    "#90CAF9",
    "#80CBC4",
    "#C5E1A5",
    "#FFF59D",
    "#FFCC80",
  ];

  constructor({ api }: { api: TextColorToolAPI }) {
    this.api = api || {};
    this.injectCss();
    this.createColorPickerModal();
  }

  render(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "texttool-wrapper";
    wrapper.style.display = "flex";
    wrapper.style.gap = "8px";
    wrapper.style.alignItems = "center";
    wrapper.style.padding = "8px";

    const colorSection = this.createSection("");
    this.colorPickerBtn = document.createElement("button");
    this.colorPickerBtn.type = "button";
    this.colorPickerBtn.title = "Text Color";
    this.colorPickerBtn.className = "texttool-color-btn";
    this.colorPickerBtn.innerHTML = this.createColorIcon("#000000", false);
    colorSection.appendChild(this.colorPickerBtn);

    const bgColorSection = this.createSection("");
    this.bgColorPickerBtn = document.createElement("button");
    this.bgColorPickerBtn.type = "button";
    this.bgColorPickerBtn.title = "Background Color";
    this.bgColorPickerBtn.className = "texttool-color-btn";
    this.bgColorPickerBtn.innerHTML = this.createColorIcon("#ffffff", true);
    bgColorSection.appendChild(this.bgColorPickerBtn);

    this.fontPicker = document.createElement("select");
    this.fontPicker.title = "Font Family";
    this.fontPicker.className = "texttool-select texttool-font-select";

    const arialOption = document.createElement("option");
    arialOption.value = "Arial";
    arialOption.textContent = "Arial";
    arialOption.style.fontFamily = "Arial";
    this.fontPicker.appendChild(arialOption);

    fontConstants.forEach((font: FontConstant) => {
      const option = document.createElement("option");
      option.value = font.value;
      option.textContent = font.label || font.value;
      option.style.fontFamily = font.value;
      this.fontPicker.appendChild(option);
    });

    this.fontSizePicker = document.createElement("select");
    this.fontSizePicker.title = "Font Size";
    this.fontSizePicker.className = "texttool-select texttool-size-select";

    [
      "10px",
      "12px",
      "14px",
      "16px",
      "18px",
      "20px",
      "24px",
      "28px",
      "32px",
    ].forEach((size: string) => {
      const option = document.createElement("option");
      option.value = size;
      option.textContent = size.replace("px", "");
      if (size === "16px") option.selected = true;
      this.fontSizePicker.appendChild(option);
    });

    this.superscriptBtn = this.createStyledButton("Superscript", "x⁺");
    this.subscriptBtn = this.createStyledButton("Subscript", "x₋");

    const formattingSection = document.createElement("div");
    formattingSection.style.display = "flex";
    formattingSection.style.gap = "6px";

    this.colorPickerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openColorPicker(true);
    });
    this.bgColorPickerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openColorPicker(false);
    });
    this.fontPicker.addEventListener("change", () =>
      this.applyFontFamily(this.fontPicker.value)
    );
    this.fontSizePicker.addEventListener("change", () =>
      this.applyFontSize(this.fontSizePicker.value)
    );
    this.superscriptBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleSuperscript();
    });
    this.subscriptBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleSubscript();
    });

    wrapper.appendChild(colorSection);
    wrapper.appendChild(bgColorSection);
    wrapper.appendChild(this.fontPicker);
    wrapper.appendChild(this.fontSizePicker);
    wrapper.appendChild(formattingSection);

    setTimeout(() => {
      try {
        this.setDefaultStyles();
      } catch (err) {
        console.error("Error setting default styles:", err);
      }
    }, 10);

    return wrapper;
  }

  createColorIcon(color: string, isBackground: boolean): string {
    if (isBackground) {
      return `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="14" height="14" rx="2" stroke="${this.getContrastColor(color)}" stroke-width="1.5" fill="${color}"/>
          <path d="M5 5L15 15" stroke="${this.getContrastColor(color)}" stroke-width="1.5" stroke-linecap="round"/>
          <rect x="1" y="13" width="8" height="6" rx="1" fill="${color}" stroke="${this.getContrastColor(color)}" stroke-width="0.5"/>
        </svg>
      `;
    } else {
      return `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10 3L15 17H13L11.8 14H8.2L7 17H5L10 3Z"
            fill="${this.getContrastColor(color)}"
          />
          <rect
            x="4"
            y="15.5"
            width="12"
            height="2.5"
            fill="${color}"
            rx="1"
          />
        </svg>
      `;
    }
  }

  createColorPickerModal(): void {
    this.colorPickerModal = document.createElement("div");
    this.colorPickerModal.className = "texttool-color-modal";
    this.colorPickerModal.style.cssText = `
      position: fixed;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 8px 30px rgba(0, 0, 0, 0.1);
      padding: 16px;
      z-index: 10000;
      min-width: 280px;
      display: none;
      border: 1px solid #e0e0e0;
      transform: translateY(10px);
      opacity: 0;
      transition: opacity 0.2s, transform 0.2s;
    `;

    const title = document.createElement("div");
    title.className = "texttool-color-modal-title";
    title.textContent = "Text Color";
    title.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #333;
      padding-bottom: 8px;
      border-bottom: 1px solid #f0f0f0;
    `;

    this.colorPalette = document.createElement("div");
    this.colorPalette.className = "texttool-color-palette";
    this.colorPalette.style.cssText = `
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 6px;
      margin-bottom: 16px;
    `;

    const customColorSection = document.createElement("div");
    customColorSection.className = "texttool-custom-color-section";
    customColorSection.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    `;

    const customColorLabel = document.createElement("span");
    customColorLabel.textContent = "Custom:";
    customColorLabel.style.cssText = `
      font-size: 13px;
      color: #666;
      min-width: 60px;
    `;

    this.customColorInput = document.createElement("input");
    this.customColorInput.type = "color";
    this.customColorInput.className = "texttool-custom-color-input";
    this.customColorInput.value = "#000000";
    this.customColorInput.style.cssText = `
      width: 36px;
      height: 36px;
      border: none;
      cursor: pointer;
      border-radius: 4px;
      border: 1px solid #e0e0e0;
    `;

    const customColorDisplay = document.createElement("div");
    customColorDisplay.className = "texttool-custom-color-display";
    customColorDisplay.textContent = "#000000";
    customColorDisplay.style.cssText = `
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      padding: 6px 10px;
      background: #f8f9fa;
      border-radius: 4px;
      border: 1px solid #e0e0e0;
      min-width: 70px;
      text-align: center;
      flex-grow: 1;
    `;

    customColorSection.appendChild(customColorLabel);
    customColorSection.appendChild(this.customColorInput);
    customColorSection.appendChild(customColorDisplay);

    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "texttool-color-modal-buttons";
    buttonsContainer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    `;

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "texttool-color-modal-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = `
      padding: 6px 12px;
      border: 1px solid #d6d9dc;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      color: #666;
      transition: background-color 0.2s;
    `;

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "texttool-color-modal-ok";
    okBtn.textContent = "OK";
    okBtn.style.cssText = `
      padding: 6px 12px;
      border: none;
      background: #4a90e2;
      color: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background-color 0.2s;
    `;

    buttonsContainer.appendChild(cancelBtn);
    buttonsContainer.appendChild(okBtn);

    this.colorPickerModal.appendChild(title);
    this.colorPickerModal.appendChild(this.colorPalette);
    this.colorPickerModal.appendChild(customColorSection);
    this.colorPickerModal.appendChild(buttonsContainer);
    document.body.appendChild(this.colorPickerModal);

    this.customColorInput.addEventListener("input", () => {
      const color = this.customColorInput.value;
      customColorDisplay.textContent = color.toUpperCase();
      customColorDisplay.style.backgroundColor = color;
      customColorDisplay.style.color = this.getContrastColor(color);
      this.currentColorValue = color;
    });

    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeColorPicker();
    });

    okBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.applyCustomColor();
    });

    document.addEventListener("click", (e) => {
      if (
        this.colorPickerModal.style.display === "block" &&
        !this.colorPickerModal.contains(e.target as Node) &&
        e.target !== this.colorPickerBtn &&
        e.target !== this.bgColorPickerBtn &&
        !this.colorPickerBtn.contains(e.target as Node) &&
        !this.bgColorPickerBtn.contains(e.target as Node)
      ) {
        this.closeColorPicker();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        this.colorPickerModal.style.display === "block"
      ) {
        this.closeColorPicker();
      }
    });
  }

  openColorPicker(isForeground: boolean): void {
    // Save the current selection so clicking the modal doesn't lose it
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      this.savedRange = sel.getRangeAt(0).cloneRange();
    }

    this.isForegroundPicker = isForeground;
    const title = this.colorPickerModal.querySelector(
      ".texttool-color-modal-title"
    ) as HTMLElement;
    title.textContent = isForeground ? "Text Color" : "Background Color";

    const button = isForeground ? this.colorPickerBtn : this.bgColorPickerBtn;
    const buttonColor = button
      .querySelector("svg")
      ?.querySelector("[fill]")
      ?.getAttribute("fill");
    this.currentColorValue =
      buttonColor || (isForeground ? "#000000" : "#ffffff");

    const hexColor = this.currentColorValue;
    this.customColorInput.value = hexColor;

    const display = this.colorPickerModal.querySelector(
      ".texttool-custom-color-display"
    ) as HTMLElement;
    display.textContent = hexColor.toUpperCase();
    display.style.backgroundColor = hexColor;
    display.style.color = this.getContrastColor(hexColor);

    this.populateColorPalette(
      isForeground ? this.defaultColors : this.defaultBgColors
    );

    const buttonRect = button.getBoundingClientRect();
    const modalRect = this.colorPickerModal.getBoundingClientRect();

    let top = buttonRect.bottom + 5;
    let left = buttonRect.left;

    if (top + modalRect.height > window.innerHeight) {
      top = buttonRect.top - modalRect.height - 5;
    }
    if (left + modalRect.width > window.innerWidth) {
      left = window.innerWidth - modalRect.width - 10;
    }

    this.colorPickerModal.style.top = `${top}px`;
    this.colorPickerModal.style.left = `${left}px`;
    this.colorPickerModal.style.display = "block";

    setTimeout(() => {
      this.colorPickerModal.style.opacity = "1";
      this.colorPickerModal.style.transform = "translateY(0)";
    }, 10);
  }

  closeColorPicker(): void {
    this.colorPickerModal.style.opacity = "0";
    this.colorPickerModal.style.transform = "translateY(10px)";
    setTimeout(() => {
      this.colorPickerModal.style.display = "none";
    }, 200);
  }

  populateColorPalette(colors: string[]): void {
    this.colorPalette.innerHTML = "";

    colors.forEach((color) => {
      const colorBtn = document.createElement("button");
      colorBtn.type = "button";
      colorBtn.className = "texttool-color-swatch";
      colorBtn.title = `Click to apply ${color}`;
      colorBtn.style.cssText = `
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
        padding: 0;
      `;
      colorBtn.style.backgroundColor = color;

      if (this.isLightColor(color)) {
        colorBtn.style.border = "1px solid #e0e0e0";
      }

      if (color.toLowerCase() === this.currentColorValue.toLowerCase()) {
        const checkmark = document.createElement("div");
        checkmark.innerHTML = "✓";
        checkmark.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: ${this.getContrastColor(color)};
          font-size: 12px;
          font-weight: bold;
          pointer-events: none;
        `;
        colorBtn.appendChild(checkmark);
      }

      colorBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.applyColorFromPalette(color);
      });

      colorBtn.addEventListener("mouseenter", () => {
        colorBtn.style.transform = "scale(1.1)";
        colorBtn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
        colorBtn.style.zIndex = "1";
      });

      colorBtn.addEventListener("mouseleave", () => {
        colorBtn.style.transform = "scale(1)";
        colorBtn.style.boxShadow = "none";
        colorBtn.style.zIndex = "0";
      });

      this.colorPalette.appendChild(colorBtn);
    });
  }

  applyColorFromPalette(color: string): void {
    this.currentColorValue = color;
    this.customColorInput.value = color;

    const display = this.colorPickerModal.querySelector(
      ".texttool-custom-color-display"
    ) as HTMLElement;
    display.textContent = color.toUpperCase();
    display.style.backgroundColor = color;
    display.style.color = this.getContrastColor(color);

    if (this.isForegroundPicker) {
      this.applyColor(color);
      this.colorPickerBtn.innerHTML = this.createColorIcon(color, false);
    } else {
      this.applyBackgroundColor(color);
      this.bgColorPickerBtn.innerHTML = this.createColorIcon(color, true);
    }

    this.populateColorPalette(
      this.isForegroundPicker ? this.defaultColors : this.defaultBgColors
    );
  }

  applyCustomColor(): void {
    const color = this.currentColorValue;

    if (this.isForegroundPicker) {
      this.applyColor(color);
      this.colorPickerBtn.innerHTML = this.createColorIcon(color, false);
    } else {
      this.applyBackgroundColor(color);
      this.bgColorPickerBtn.innerHTML = this.createColorIcon(color, true);
    }

    this.closeColorPicker();
  }

  getContrastColor(hexColor: string): string {
    let r = 0,
      g = 0,
      b = 0;

    if (hexColor.startsWith("#")) {
      if (hexColor.length === 4) {
        r = parseInt(hexColor[1] + hexColor[1], 16);
        g = parseInt(hexColor[2] + hexColor[2], 16);
        b = parseInt(hexColor[3] + hexColor[3], 16);
      } else if (hexColor.length === 7) {
        r = parseInt(hexColor.slice(1, 3), 16);
        g = parseInt(hexColor.slice(3, 5), 16);
        b = parseInt(hexColor.slice(5, 7), 16);
      }
    }

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#ffffff";
  }

  isLightColor(color: string): boolean {
    if (color.startsWith("#")) {
      let r = 0,
        g = 0,
        b = 0;
      if (color.length === 4) {
        r = parseInt(color[1] + color[1], 16);
        g = parseInt(color[2] + color[2], 16);
        b = parseInt(color[3] + color[3], 16);
      } else if (color.length === 7) {
        r = parseInt(color.slice(1, 3), 16);
        g = parseInt(color.slice(3, 5), 16);
        b = parseInt(color.slice(5, 7), 16);
      }
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.7;
    }
    return false;
  }

  createSection(labelText: string): HTMLDivElement {
    const section = document.createElement("div");
    section.style.display = "flex";
    section.style.alignItems = "center";
    section.style.gap = "6px";

    if (labelText) {
      const label = document.createElement("label");
      label.textContent = labelText;
      label.style.fontSize = "12px";
      label.style.fontWeight = "600";
      label.style.color = "#333";
      section.appendChild(label);
    }

    return section;
  }

  createStyledButton(tooltip: string, text: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.title = tooltip;
    button.innerHTML = text;
    button.className = "texttool-btn";
    return button;
  }

  toggleSuperscript(): void {
    this.toggleTextStyle("vertical-align", "super");
    this.toggleButtonState(this.superscriptBtn);
    if (this.superscriptBtn.classList.contains("active")) {
      this.subscriptBtn.classList.remove("active");
      this.updateButtonVisual(this.subscriptBtn, false);
    }
  }

  toggleSubscript(): void {
    this.toggleTextStyle("vertical-align", "sub");
    this.toggleButtonState(this.subscriptBtn);
    if (this.subscriptBtn.classList.contains("active")) {
      this.superscriptBtn.classList.remove("active");
      this.updateButtonVisual(this.superscriptBtn, false);
    }
  }

  toggleButtonState(btn: HTMLButtonElement): void {
    btn.classList.toggle("active");
    this.updateButtonVisual(btn, btn.classList.contains("active"));
  }

  updateButtonVisual(btn: HTMLButtonElement, active: boolean): void {
    if (active) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  }

  applyStyle(property: string, value: string): void {
    // Restore the selection that was saved when the picker opened
    if (this.savedRange) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(this.savedRange);
      }
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      return;
    }

    const commonAncestor = range.commonAncestorContainer;
    let element: Element | null = null;

    if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
      element = commonAncestor as Element;
    } else {
      element = commonAncestor.parentElement;
    }

    const editorWrapper = element?.closest('[contenteditable="true"]');
    if (!editorWrapper) {
      console.warn("Not inside an editable area");
      return;
    }

    const contents = range.extractContents();
    const span = document.createElement("span");

    span.style.setProperty(property, value);
    span.dataset.textToolStyled = "true";

    span.appendChild(contents);
    range.insertNode(span);

    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.addRange(newRange);

    try {
      if (this.api?.inlineToolbar?.open) {
        this.api.inlineToolbar.open();
      } else if ((this.api as any)?.inlineToolbar?.show) {
        (this.api as any).inlineToolbar.show();
      }
    } catch (err) {
      console.warn("Could not open inline toolbar:", err);
    }
  }

  applyColor(color: string): void {
    this.applyStyle("color", color);
  }

  applyBackgroundColor(bgColor: string): void {
    this.applyStyle("background-color", bgColor);
  }

  applyFontFamily(fontFamily: string): void {
    const safe = fontFamily.includes(" ") ? `'${fontFamily}'` : fontFamily;
    this.applyStyle("font-family", safe);
  }

  applyFontSize(fontSize: string): void {
    this.applyStyle("font-size", fontSize);
  }

  toggleTextStyle(property: string, value: string): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const parent =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as Element)
        : (range.commonAncestorContainer.parentElement as Element | null);

    let already = false;
    if (parent) {
      const cs = window.getComputedStyle(parent);
      const prop = property.replace(/-([a-z])/g, (_, g) => g.toUpperCase());
      const current = (cs as any)[prop];
      already = String(current).includes(value);
    }

    if (already) {
      this.applyStyle(property, "normal");
    } else {
      this.applyStyle(property, value);
    }
  }

  setDefaultStyles(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const parentElement =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as Element)
        : (range.commonAncestorContainer.parentElement as Element | null);

    if (!parentElement) return;

    const computedStyle = window.getComputedStyle(parentElement);

    try {
      const c = computedStyle.color || "rgb(0,0,0)";
      const hexColor = rgbToHex(c);
      this.colorPickerBtn.innerHTML = this.createColorIcon(hexColor, false);
    } catch (err) {
      this.colorPickerBtn.innerHTML = this.createColorIcon("#000000", false);
    }

    try {
      const bg = computedStyle.backgroundColor || "rgba(0,0,0,0)";
      const hexBg = rgbToHex(bg === "transparent" ? "#ffffff" : bg);
      this.bgColorPickerBtn.innerHTML = this.createColorIcon(hexBg, true);
    } catch (err) {
      this.bgColorPickerBtn.innerHTML = this.createColorIcon("#ffffff", true);
    }

    const inlineFont = this.extractFontFromElement(parentElement);
    const currentFont =
      inlineFont ||
      (computedStyle.fontFamily || "")
        .replace(/['"]+/g, "")
        .split(",")[0]
        .trim();

    let fontFound = false;
    for (let i = 0; i < this.fontPicker.options.length; i++) {
      if (
        this.fontPicker.options[i].value.toLowerCase() ===
        currentFont.toLowerCase()
      ) {
        this.fontPicker.selectedIndex = i;
        fontFound = true;
        break;
      }
    }
    if (!fontFound) {
      this.fontPicker.selectedIndex = 0;
    }

    const rawSize = computedStyle.fontSize || "";
    const normalized = normalizeFontSize(rawSize);
    let sizeFound = false;
    for (let i = 0; i < this.fontSizePicker.options.length; i++) {
      if (this.fontSizePicker.options[i].value === normalized) {
        this.fontSizePicker.selectedIndex = i;
        sizeFound = true;
        break;
      }
    }
    if (!sizeFound) {
      for (let i = 0; i < this.fontSizePicker.options.length; i++) {
        if (this.fontSizePicker.options[i].value === "16px") {
          this.fontSizePicker.selectedIndex = i;
          break;
        }
      }
    }

    const isSuper = computedStyle.verticalAlign === "super";
    const isSub = computedStyle.verticalAlign === "sub";
    this.updateButtonVisual(this.superscriptBtn, isSuper);
    this.updateButtonVisual(this.subscriptBtn, isSub);
    if (isSuper) this.superscriptBtn.classList.add("active");
    if (isSub) this.subscriptBtn.classList.add("active");
  }

  extractFontFromElement(el: Element): string | null {
    const styleAttr = el.getAttribute("style");
    if (styleAttr) {
      const match = styleAttr.match(/font-family\s*:\s*([^;]+)/i);
      if (match && match[1]) {
        return match[1].replace(/['"]+/g, "").split(",")[0].trim();
      }
    }
    return null;
  }

  injectCss(): void {
    const id = "texttool-word-like-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `
  .texttool-wrapper {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .texttool-select {
    border-radius: 6px;
    border: 1px solid #d6d9dc;
    background: #fff;
    font-size: 13px;
    transition: border-color 0.2s;
  }

  .texttool-select:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.1);
  }

  .texttool-font-select {
    width: 100px;
    padding: 6px 8px;
  }

  .texttool-size-select {
    width: 70px;
    padding: 6px 8px;
  }

  .texttool-color-btn {
    width: 32px;
    height: 32px;
    padding: 6px;
    border: none;
    cursor: pointer;
    border-radius: 6px;
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .texttool-color-btn:hover {
    background: #e9ecef;
    border-color: #dee2e6;
    transform: translateY(-1px);
  }

  .texttool-btn {
    border-radius: 6px;
    border: 1px solid #d6d9dc;
    background: #fff;
    cursor: pointer;
    font-size: 13px;
    padding: 6px 10px;
    transition: all 0.2s;
  }

  .texttool-btn:hover {
    background: #f4f6f8;
    border-color: #c8ccd0;
  }

  .texttool-btn.active {
    background: #e6f0ff;
    border-color: #6b8ef5;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04) inset;
    color: #2c5cc5;
  }

  .texttool-color-modal {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    backdrop-filter: blur(2px);
  }

  .texttool-color-swatch {
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  }

  .texttool-color-swatch:hover {
    box-shadow: 0 0 0 2px #4a90e2 !important;
    z-index: 1;
  }

  .texttool-custom-color-input::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .texttool-custom-color-input::-webkit-color-swatch {
    border: none;
    border-radius: 4px;
  }

  .texttool-color-modal-ok:hover {
    background: #3a7bc8 !important;
  }

  .texttool-color-modal-cancel:hover {
    background: #f5f5f5 !important;
  }

  .texttool-wrapper label {
    user-select: none;
  }

  .ce-inline-toolbar {
    z-index: 9999;
  }
  `;
    document.head.appendChild(style);
  }
}

function rgbToHex(rgb: string): string {
  if (!rgb) return "#000000";
  rgb = rgb.trim();
  if (rgb.startsWith("#")) {
    if (rgb.length === 4) {
      const a = rgb[1],
        b = rgb[2],
        c = rgb[3];
      return `#${a}${a}${b}${b}${c}${c}`.toLowerCase();
    }
    return rgb.toLowerCase();
  } else if (rgb.startsWith("rgb")) {
    const vals = rgb.match(/\d+(\.\d+)?/g);
    if (!vals || vals.length < 3) return "#000000";
    const r = Number(vals[0]),
      g = Number(vals[1]),
      b = Number(vals[2]);
    const hex =
      "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
    return hex.toLowerCase();
  } else if (rgb === "transparent" || rgb === "rgba(0, 0, 0, 0)") {
    return "#ffffff";
  } else {
    try {
      const s = new Option().style;
      s.color = rgb;
      const computed = s.color;
      if (computed && computed.startsWith("rgb")) return rgbToHex(computed);
    } catch {}
    return "#000000";
  }
}

function normalizeFontSize(fontSize: string): string {
  if (!fontSize) return "16px";
  fontSize = fontSize.trim().toLowerCase();

  if (fontSize.endsWith("pt")) {
    const num = parseFloat(fontSize.replace("pt", ""));
    if (Number.isFinite(num)) {
      const px = Math.round(num * 1.3333333333);
      return `${px}px`;
    }
  }

  if (fontSize.endsWith("px")) {
    const num = parseFloat(fontSize.replace("px", ""));
    if (Number.isFinite(num)) {
      const px = Math.round(num);
      return `${px}px`;
    }
  }

  return "16px";
}
