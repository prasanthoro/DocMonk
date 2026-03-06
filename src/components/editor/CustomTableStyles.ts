export class TableStyleTool {
  static get isInline() {
    return false; // This tool is not inline like the TextColorTool
  }

  static get sanitize() {
    return {
      table: {
        style: true,
      },
      thead: {
        style: true,
      },
    };
  }

  private api: any;
  private tableElement: HTMLElement | null;
  private borderColorPicker: HTMLInputElement | null;
  private backgroundColorPicker: HTMLInputElement | null;
  private headerBackgroundColorPicker: HTMLInputElement | null;

  constructor({ api }: any) {
    this.api = api;
    this.tableElement = null;
    this.borderColorPicker = null;
    this.backgroundColorPicker = null;
    this.headerBackgroundColorPicker = null;
  }

  render() {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "10px";

    // Border Color Picker
    this.borderColorPicker = document.createElement("input");
    this.borderColorPicker.type = "color";
    this.borderColorPicker.value = "#000000";
    this.borderColorPicker.style.border = "none";
    this.borderColorPicker.style.width = "30px";
    this.borderColorPicker.style.height = "30px";
    this.borderColorPicker.style.cursor = "pointer";

    this.borderColorPicker.addEventListener("input", () => {
      const color = this.borderColorPicker!.value;
      this.applyBorderColor(color);
    });

    // Background Color Picker
    this.backgroundColorPicker = document.createElement("input");
    this.backgroundColorPicker.type = "color";
    this.backgroundColorPicker.value = "#ffffff";
    this.backgroundColorPicker.style.border = "none";
    this.backgroundColorPicker.style.width = "30px";
    this.backgroundColorPicker.style.height = "30px";
    this.backgroundColorPicker.style.cursor = "pointer";

    this.backgroundColorPicker.addEventListener("input", () => {
      const color = this.backgroundColorPicker!.value;
      this.applyBackgroundColor(color);
    });

    // Header Background Color Picker
    this.headerBackgroundColorPicker = document.createElement("input");
    this.headerBackgroundColorPicker.type = "color";
    this.headerBackgroundColorPicker.value = "#f2f2f2";
    this.headerBackgroundColorPicker.style.border = "none";
    this.headerBackgroundColorPicker.style.width = "30px";
    this.headerBackgroundColorPicker.style.height = "30px";
    this.headerBackgroundColorPicker.style.cursor = "pointer";

    this.headerBackgroundColorPicker.addEventListener("input", () => {
      const color = this.headerBackgroundColorPicker!.value;
      this.applyHeaderBackgroundColor(color);
    });

    // Append pickers to the wrapper
    wrapper.appendChild(this.borderColorPicker);
    wrapper.appendChild(this.backgroundColorPicker);
    wrapper.appendChild(this.headerBackgroundColorPicker);

    return wrapper;
  }

  applyBorderColor(color: string) {
    if (this.tableElement) {
      this.tableElement.style.border = `1px solid ${color}`;
    }
  }

  applyBackgroundColor(color: string) {
    if (this.tableElement) {
      this.tableElement.style.backgroundColor = color;
    }
  }

  applyHeaderBackgroundColor(color: string) {
    if (this.tableElement) {
      const headerRows = this.tableElement.querySelectorAll("thead");
      headerRows.forEach((header) => {
        header.style.backgroundColor = color;
      });
    }
  }

  show(tableElement: HTMLElement) {
    this.tableElement = tableElement;

    const computedStyle = window.getComputedStyle(this.tableElement);

    // Set the color pickers with current styles of the table
    const borderColor = computedStyle.borderColor;
    const backgroundColor = computedStyle.backgroundColor;
    const headerBackgroundColor = this.tableElement.querySelector("thead")
      ? window.getComputedStyle(this.tableElement.querySelector("thead")!)
          .backgroundColor
      : "#f2f2f2";

    if (this.borderColorPicker) {
      this.borderColorPicker.value = rgbToHex(borderColor);
    }

    if (this.backgroundColorPicker) {
      this.backgroundColorPicker.value = rgbToHex(backgroundColor);
    }

    if (this.headerBackgroundColorPicker) {
      this.headerBackgroundColorPicker.value = rgbToHex(headerBackgroundColor);
    }
  }
}

function rgbToHex(rgb: string): string {
  const rgbValues = rgb.match(/\d+/g);
  if (!rgbValues || rgbValues.length < 3) return "#000000";

  return `#${rgbValues
    .slice(0, 3)
    .map((value) => parseInt(value, 10).toString(16).padStart(2, "0"))
    .join("")}`;
}
