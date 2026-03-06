import type { BlockTool, BlockToolConstructorOptions, BlockToolData } from "@editorjs/editorjs";

interface ImageData {
  url: string;
  caption?: string;
  withBorder?: boolean;
  withBackground?: boolean;
  stretched?: boolean;
  width?: string;
  height?: string;
}

/**
 * Lightweight image display tool — renders images that come from the DOCX parser
 * (base64 data URLs). Does NOT support file-upload from within the editor;
 * images can only be added by pasting a URL or parsing a DOCX.
 */
export default class SimpleImageTool implements BlockTool {
  private _data: ImageData;
  private _wrapper: HTMLElement;
  private readOnly: boolean;

  static get toolbox() {
    return {
      title: "Image",
      icon: `<svg width="17" height="15" viewBox="0 0 336 276" xmlns="http://www.w3.org/2000/svg">
        <path d="M291 150V79c0-19-15-34-34-34H79c-19 0-34 15-34 34v42l67-44 81 72 56-29zM0 79C0 35 35 0 79 0h178c44 0 79 35 79 79v118c0 44-35 79-79 79H79c-44 0-79-35-79-79V79z"/>
        <path d="M0 189l89-89 110 110-14 16H0zM312 214l-89-89-42 42-16-16 57-57 105 105z"/>
      </svg>`,
    };
  }

  static get isReadOnlySupported() {
    return true;
  }

  static get sanitize() {
    return {
      url: {},
      caption: { br: false },
      withBorder: {},
      withBackground: {},
      stretched: {},
    };
  }

  static get pasteConfig() {
    return {
      tags: ["IMG"],
      patterns: {
        image: /https?:\/\/\S+\.(jpe?g|png|gif|svg|webp)(\?.*)?$/i,
      },
    };
  }

  constructor({ data, readOnly }: BlockToolConstructorOptions) {
    this.readOnly = readOnly;
    this._data = {
      url: data?.url || data?.file?.url || "",
      caption: data?.caption || "",
      withBorder: data?.withBorder ?? false,
      withBackground: data?.withBackground ?? false,
      stretched: data?.stretched ?? false,
      width: data?.width || "",
      height: data?.height || "",
    };
    this._wrapper = document.createElement("div");
  }

  render(): HTMLElement {
    this._wrapper.innerHTML = "";
    this._wrapper.className = "cdx-simple-image";
    this._wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 0;
    `;

    if (!this._data.url) {
      if (this.readOnly) return this._wrapper;
      const placeholder = document.createElement("div");
      placeholder.style.cssText = `
        border: 2px dashed #d1d5db;
        border-radius: 8px;
        padding: 32px;
        text-align: center;
        color: #9ca3af;
        font-size: 14px;
        width: 100%;
        cursor: default;
      `;
      placeholder.textContent = "Image (paste URL to add)";
      this._wrapper.appendChild(placeholder);

      if (!this.readOnly) {
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Paste image URL here…";
        input.style.cssText = `
          width: 100%;
          margin-top: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 14px;
          outline: none;
        `;
        input.addEventListener("change", () => {
          this._data.url = input.value.trim();
          this.render();
        });
        this._wrapper.appendChild(input);
      }
      return this._wrapper;
    }

    const img = document.createElement("img");
    img.src = this._data.url;
    img.alt = this._data.caption || "";
    img.style.cssText = `
      display: block;
      max-width: 100%;
      border-radius: 4px;
      ${this._data.withBorder ? "border: 1px solid #e5e7eb;" : ""}
      ${this._data.withBackground ? "background: #f9fafb; padding: 8px;" : ""}
      ${this._data.stretched ? "width: 100%;" : ""}
      ${this._data.width ? `width: ${this._data.width};` : ""}
      ${this._data.height ? `height: ${this._data.height};` : ""}
    `;
    img.onerror = () => {
      img.style.display = "none";
    };
    this._wrapper.appendChild(img);

    if (this._data.caption) {
      const caption = document.createElement("p");
      caption.textContent = this._data.caption;
      caption.style.cssText = `
        margin: 6px 0 0;
        font-size: 13px;
        color: #6b7280;
        text-align: center;
        font-style: italic;
      `;
      this._wrapper.appendChild(caption);
    }

    return this._wrapper;
  }

  save(): ImageData {
    return {
      url: this._data.url,
      caption: this._data.caption,
      withBorder: this._data.withBorder,
      withBackground: this._data.withBackground,
      stretched: this._data.stretched,
    };
  }

  onPaste(event: any): void {
    const detail = event.detail;
    if (detail?.data?.src) {
      this._data.url = detail.data.src;
      this._data.caption = detail.data.alt || "";
    } else if (detail?.data?.match) {
      this._data.url = detail.data[0];
    }
    this.render();
  }

  static get conversionConfig() {
    return {
      export: (data: ImageData) => data.caption || data.url,
      import: (string: string) => ({ url: string }),
    };
  }
}
