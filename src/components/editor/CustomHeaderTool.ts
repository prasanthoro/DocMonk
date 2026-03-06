import type {
  API,
  BlockTool,
  BlockToolConstructorOptions,
  PasteEvent,
} from "@editorjs/editorjs";

type Alignment = "left" | "center" | "right";

interface HeaderToolConfig {
  levels: number[];
  defaultLevel: number;
  preserveBlank?: boolean;
}

interface HeaderToolData {
  text: string;
  level: number;
  alignment?: Alignment;
  indentLevel?: number;
}

export class CustomHeaderTool implements BlockTool {
  private _data: HeaderToolData;
  private _element: HTMLDivElement;
  private _settings: HTMLElement | null;
  private api: API;
  private readOnly: boolean;
  private config: HeaderToolConfig;
  private _preserveBlank: boolean;

  static get isInline() {
    return false;
  }

  static get sanitize() {
    return {
      level: false,
      text: {
        br: true,
        markup: ["strong", "em", "del", "u", "b", "i"],
      },
    };
  }

  static get isReadOnlySupported() {
    return true;
  }

  static get toolbox() {
    return {
      icon: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.25 3.75H4.5V14.25H2.25V3.75ZM13.5 3.75H15.75V14.25H13.5V3.75ZM6.75 6.75H11.25V8.25H6.75V6.75ZM6.75 9.75H11.25V11.25H6.75V9.75Z" fill="currentColor"/></svg>',
      title: "Heading",
    };
  }

  constructor({ data, config, api, readOnly }: BlockToolConstructorOptions) {
    this.api = api;
    this.readOnly = readOnly;
    this.config = {
      levels: [1, 2, 3, 4, 5, 6],
      defaultLevel: 2,
      ...config,
    };

    this._data = {
      text: data?.text || "",
      level: this._normalizeLevel(data?.level),
      alignment: data?.tunes?.alignment?.alignment || "center",
      indentLevel: data?.tunes?.indentTune?.indentLevel || 0,
    };

    this._element = this._createHeaderElement();
    this._preserveBlank = config?.preserveBlank ?? false;
    this._settings = null;
  }

  private _normalizeLevel(level?: number): number {
    return Math.min(Math.max(level ?? this.config.defaultLevel, 1), 6);
  }

  private _createHeaderElement(): HTMLDivElement {
    const element = document.createElement("div");
    element.classList.add("ce-header");
    return element;
  }

  renderSettings(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.classList.add("ce-header-settings");

    this.config.levels.forEach((level) => {
      const button = document.createElement("button");
      button.classList.add("ce-header-settings__button");
      button.type = "button";
      button.innerHTML = `H${level}`;
      button.classList.toggle("active", this._data.level === level);

      button.addEventListener("click", () => {
        this.setLevel(level);
      });

      wrapper.appendChild(button);
    });

    this._settings = wrapper;
    return wrapper;
  }

  setLevel(level: number): void {
    this._data.level = this._normalizeLevel(level);

    if (this._element) {
      this._element.className = `ce-header ce-header-level-${this._data.level}`;
      this._element.dataset.level = this._data.level.toString();
      this._applyHeaderStyle();
    }

    if (this._settings) {
      this._settings
        .querySelectorAll(".ce-header-settings__button")
        .forEach((button) => {
          button.classList.toggle(
            "active",
            button.innerHTML === `H${this._data.level}`
          );
        });
    }
  }

  private _applyHeaderStyle(): void {
    const styles: Record<
      number,
      { fontSize: string; fontWeight: string; textAlign?: Alignment }
    > = {
      1: {
        fontSize: "2em",
        fontWeight: "bold",
        textAlign: this._data.alignment || "left",
      },
      2: {
        fontSize: "1.5em",
        fontWeight: "bold",
        textAlign: this._data.alignment || "left",
      },
      3: {
        fontSize: "1.17em",
        fontWeight: "bold",
        textAlign: this._data.alignment || "left",
      },
      4: {
        fontSize: "1em",
        fontWeight: "bold",
        textAlign: this._data.alignment || "left",
      },
      5: {
        fontSize: "0.83em",
        fontWeight: "bold",
        textAlign: this._data.alignment || "left",
      },
      6: {
        fontSize: "0.67em",
        fontWeight: "bold",
        textAlign: this._data.alignment || "left",
      },
    };

    Object.assign(this._element.style, styles[this._data.level]);
  }

  render(): HTMLElement {
    this._element.innerHTML = this._data.text || "";
    this._element.contentEditable = (!this.readOnly).toString();
    this._element.dataset.level = this._data.level.toString();
    this._applyHeaderStyle();
    this._element.style.textAlign = this._data.alignment ?? "left";
    this._element.style.paddingLeft = `${(this._data.indentLevel ?? 0) * 20}px`;
    return this._element;
  }

  save(): HeaderToolData | null {
    const text = this._element.innerHTML.trim();
    return this._preserveBlank || text
      ? { text, level: this._data.level }
      : null;
  }

  static get conversionConfig() {
    return {
      export: "text",
      import: "text",
    };
  }

  static get pasteConfig() {
    return {
      tags: ["H1", "H2", "H3", "H4", "H5", "H6"],
      patterns: {
        heading: /^(#{1,6})\s+(.+)$/,
      },
    };
  }

  onPaste(event: PasteEvent | any) {
    const content = event.detail.data;

    if (content.innerHTML !== undefined) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = content.innerHTML;

      const headingMatch = tempDiv.querySelector("h1, h2, h3, h4, h5, h6");
      if (headingMatch) {
        const level = Number.parseInt(headingMatch.tagName.charAt(1));
        this.setLevel(level);

        this._element.innerHTML = headingMatch.innerHTML;
        return;
      }
    }

    if (typeof content.text === "string") {
      const markdownMatch = content.text.match(/^(#{1,6})\s+(.+)$/);
      if (markdownMatch) {
        const level = markdownMatch[1].length;
        const text = markdownMatch[2];

        this.setLevel(level);
        this._element.innerHTML = text;
        return;
      }
    }

    if (content.innerHTML) {
      this._element.innerHTML = content.innerHTML;
    } else if (content.text) {
      this._element.innerHTML = content.text;
    }

    this._preserveFormatting();
  }

  private _preserveFormatting() {
    const styleMap = {
      "font-weight: bold": "strong",
      "font-style: italic": "em",
      "text-decoration: underline": "u",
      "text-decoration: line-through": "del",
    };

    const walker = document.createTreeWalker(
      this._element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null
    );

    const nodesToProcess = [];
    while (walker.nextNode()) {
      nodesToProcess.push(walker.currentNode);
    }

    nodesToProcess.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const style = element.getAttribute("style");

        if (style) {
          Object.entries(styleMap).forEach(([styleAttr, tag]) => {
            if (style.includes(styleAttr)) {
              const wrapper = document.createElement(tag);
              element.replaceWith(wrapper);
              wrapper.appendChild(element);
              element.removeAttribute("style");
            }
          });
        }
      }
    });
  }
}
