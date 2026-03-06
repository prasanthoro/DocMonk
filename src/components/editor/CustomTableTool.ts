interface TableData {
  content: string[][];
  withHeading: boolean;
  headerRows?: number[];
  styles: {
    table: {
      width: string;
      backgroundColor: string;
      borderColor: string;
      borderWidth: string;
      borderStyle: string;
      tableLayout?: string;
    };
    rows: { [key: string]: { backgroundColor: string } };
    cells: {
      [key: string]: {
        backgroundColor?: string;
        borderColor?: string;
        borderWidth?: string;
        borderStyle?: string;
        textAlign?: string;
        colSpan?: number;
        rowSpan?: number;
      };
    };
  };
}

interface PasteConfig {
  tags: string[];
  files: {
    mimeTypes: string[];
  };
  patterns: {
    [key: string]: RegExp;
  };
}

class TableTool {
  static get toolbox() {
    return {
      title: "Table",
      icon: `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.5 2.5h13v11h-13v-11zm1 1v2h5v-2h-5zm6 0v2h5v-2h-5zm5 3h-5v2h5v-2zm0 3h-5v2h5v-2zm-6-3h-5v2h5v-2zm-5 5h5v2h-5v-2zm6 0h5v2h-5v-2z" fill="#4a90e2"/>
      </svg>`,
    };
  }
  static get isReadOnlySupported() {
    return true;
  }

  private data: any;
  private wrapper: HTMLElement | any;
  private readOnly = false;
  private table: any;
  private contextMenu: any;
  private selectedCell: any;
  private selectedRow: any;
  private isSelecting = false;
  private selectionStart: any;
  private selectionEnd: any;
  private selectionStartRow: number;
  private selectionStartCol: number;
  private selectionStartEndCol: number;
  private selectionEndRow: number;
  private selectionEndCol: number;
  private selectionEndEndCol: number;
  private selectedMinRow: number | undefined;
  private selectedMaxRow: number | undefined;
  private selectedMinCol: number | undefined;
  private selectedMaxCol: number | undefined;
  private ownerGrid:
    | { cell: HTMLTableCellElement; startRow: number; startCol: number }[][]
    | undefined;
  private setOpenTableProperties?: any;
  private openTableProperties?: any;
  private completedPreview = false;

  private readonly CSS = {
    wrapper: "te-table-wrapper",
    table: "te-table",
    cell: "te-table-cell",
    row: "te-table-row",
    selected: "te-cell-selected",
    selecting: "te-cell-selecting",
    contextMenu: "te-context-menu",
    contextMenuItem: "te-context-menu-item",
    contextMenuIcon: "te-context-menu-icon",
    submenu: "te-submenu",
    header: "te-table-header",
    resizeHandle: "table-resize-handle",
  };

  constructor({
    data,
    readOnly = false,
    config,
  }: {
    data: any;
    readOnly?: boolean;
    config: any;
  }) {
    this.readOnly = readOnly;
    this.data = {
      id: data.id || this.generateUniqueId(),
      content: data.content || [
        ["", "", ""],
        ["", "", ""],
        ["", "", ""],
      ],
      withHeading: data.withHeading || false,
      headerRows: data.headerRows || [],
      styles: {
        table: {
          width: "100%",
          height: "auto",
          backgroundColor: "#ffffff",
          borderColor: "#d1d5db",
          borderWidth: "1px",
          borderStyle: "solid",
          position: "relative",
          tableLayout: "fixed",
          ...data.styles?.table,
        },
        rows: data.styles?.rows || {},
        cells: data.styles?.cells || {},
      },
    };

    this.wrapper = document.createElement("div");
    this.wrapper.classList.add(this.CSS.wrapper);
    this.setOpenTableProperties = config?.setOpenTableProperties;
    this.openTableProperties = config?.openTableProperties;
    this.completedPreview = config.isEditable || false;
  }

  private getParentWidth(): number {
    const parent = this.wrapper.parentElement;
    if (!parent) return 729;
    return parent.offsetWidth || 729;
  }

  private createResizeHandle() {
    if (this.readOnly || this.completedPreview) return null;

    const resizeHandle = document.createElement("div");
    resizeHandle.classList.add(this.CSS.resizeHandle);

    resizeHandle.style.cssText = `
      position: absolute;
      width: 15px;
      height: 15px;
      cursor: se-resize;
      background-color: rgba(0,0,0,0.2);
      z-index: 20;
      pointer-events: auto;
      touch-action: none;
    `;

    let isResizing = false;
    let startX: number, startY: number;
    let startWidth: number, startHeight: number;

    const updateHandlePosition = () => {
      const tableRect = this.table.getBoundingClientRect();
      const wrapperRect = this.wrapper.getBoundingClientRect();
      resizeHandle.style.bottom = `${wrapperRect.bottom - tableRect.bottom}px`;
      resizeHandle.style.right = `${wrapperRect.right - tableRect.right}px`;
    };

    const startResize = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = this.table.offsetWidth;
      startHeight = this.table.offsetHeight;

      document.addEventListener("mousemove", resize);
      document.addEventListener("mouseup", stopResize);
      document.addEventListener("mouseleave", stopResize);
    };

    const resize = (e: MouseEvent) => {
      if (!isResizing) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const maxWidth = this.getParentWidth() - 2;
      const newWidth = Math.max(200, Math.min(startWidth + dx, maxWidth));
      const newHeight = Math.max(100, startHeight + dy);

      this.table.style.width = `${newWidth}px`;
      this.table.style.height = `${newHeight}px`;

      this.data.styles.table.width = `${newWidth}px`;
      this.data.styles.table.height = `${newHeight}px`;

      updateHandlePosition();
    };

    const stopResize = () => {
      isResizing = false;
      document.removeEventListener("mousemove", resize);
      document.removeEventListener("mouseup", stopResize);
      document.removeEventListener("mouseleave", stopResize);
      this.updateData();
    };

    resizeHandle.addEventListener("mousedown", startResize);

    updateHandlePosition();

    const resizeObserver = new ResizeObserver(() => {
      updateHandlePosition();
    });
    resizeObserver.observe(this.table);

    return resizeHandle;
  }

  render() {
    this.createTable();
    this.attachEventListeners();
    this.applyTableStyles();

    this.wrapper.style.position = "relative";
    this.wrapper.style.overflow = "visible";

    const existingHandle = this.wrapper.querySelector(
      `.${this.CSS.resizeHandle}`
    );
    if (existingHandle) {
      existingHandle.remove();
    }

    const resizeHandle = this.createResizeHandle();
    if (resizeHandle) {
      this.wrapper.appendChild(resizeHandle);
    }
    return this.wrapper;
  }

  private generateUniqueId(): string {
    return (
      "table-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9)
    );
  }

  private createTable() {
    this.table = document.createElement("table");
    this.table.style.marginTop = "12px";
    this.table.classList.add(this.CSS.table);
    this.table.id = this.data.id;
    this.applyTableStyles();
    this.table.style.position = "relative";
    this.table.style.width = "100%";

    this.data.content.forEach((row: string[], rowIndex: number) => {
      const tr = document.createElement("tr");
      tr.classList.add(this.CSS.row);

      if (this.data.headerRows?.includes(rowIndex)) {
        tr.classList.add(this.CSS.header);
      }

      if (this.data.styles.rows[rowIndex]) {
        Object.assign(tr.style, this.data.styles.rows[rowIndex]);
      }

      row.forEach((cellContent, colIndex) => {
        const tag = this.data.headerRows?.includes(rowIndex) ? "th" : "td";
        const cell = document.createElement(tag);
        cell.classList.add(this.CSS.cell);
        cell.contentEditable = this.readOnly ? "false" : "true";
        cell.innerHTML = cellContent;

        cell.style.wordBreak = "break-word";
        cell.style.whiteSpace = "pre-wrap";
        cell.style.overflowWrap = "break-word";

        if (
          this.data.styles.cells[rowIndex] &&
          this.data.styles.cells[rowIndex][colIndex]
        ) {
          const cellStyles = this.data.styles.cells[rowIndex][colIndex];
          const rawStyleStr =
            this.data.styles.cells[rowIndex] &&
            this.data.styles.cells[rowIndex][colIndex];
          if (rawStyleStr) {
            const styleObj = this.parseStyleString(rawStyleStr);
            Object.assign(cell.style, styleObj);
          }
          if (cellStyles.backgroundColor)
            cell.style.backgroundColor = cellStyles.backgroundColor;
          if (cellStyles.borderColor)
            cell.style.borderColor = cellStyles.borderColor;
          if (cellStyles.borderWidth)
            cell.style.borderWidth = cellStyles.borderWidth;
          if (cellStyles.borderStyle)
            cell.style.borderStyle = cellStyles.borderStyle;
          if (cellStyles.textAlign) cell.style.textAlign = cellStyles.textAlign;
          if (cellStyles.colSpan) cell.colSpan = cellStyles.colSpan;
          if (cellStyles.rowSpan) cell.rowSpan = cellStyles.rowSpan;
        } else {
          cell.style.borderWidth = this.data.styles.table.borderWidth;
          cell.style.borderStyle = this.data.styles.table.borderStyle;
          cell.style.borderColor = this.data.styles.table.borderColor;
        }

        tr.appendChild(cell);
        cell.addEventListener("input", () => {
          this.data.content[rowIndex][colIndex] = cell.innerHTML;
          this.updateData();
        });
      });
      this.table.appendChild(tr);
    });

    this.wrapper.innerHTML = "";
    this.wrapper.appendChild(this.table);

    this.assignLogicalCols();
  }

  private parseStyleString(styleStr: string) {
    const regex = /style="([^"]+)"/g;
    let match;
    const styleObj: any = {};
    while ((match = regex.exec(styleStr)) !== null) {
      const declarations = match[1].split(";");
      declarations.forEach((decl) => {
        const [property, value] = decl
          .split(":")
          .map((item) => item && item.trim());
        if (property && value) {
          styleObj[property] = value;
        }
      });
    }
    return styleObj;
  }

  private getNumCols(): number {
    let max = 0;
    Array.from(this.table.rows).forEach((row: HTMLTableRowElement) => {
      let sum = 0;
      Array.from(row.cells).forEach((cell: HTMLTableCellElement) => {
        sum += cell.colSpan || 1;
      });
      max = Math.max(max, sum);
    });
    return max;
  }

  private assignLogicalCols() {
    const numRows = this.table.rows.length;
    const numCols = this.getNumCols();
    const owner: {
      cell: HTMLTableCellElement;
      startRow: number;
      startCol: number;
    }[][] = Array.from({ length: numRows }, () => Array(numCols).fill(null));

    for (let i = 0; i < numRows; i++) {
      let c = 0;
      const row = this.table.rows[i];
      for (let k = 0; k < row.cells.length; k++) {
        const cell = row.cells[k];
        while (c < numCols && owner[i][c] !== null) c++;
        if (c >= numCols) return;
        const rs = cell.rowSpan || 1;
        const cs = cell.colSpan || 1;
        if (c + cs > numCols) return;
        for (let rr = i; rr < i + rs; rr++) {
          if (rr >= numRows) break;
          for (let cc = c; cc < c + cs; cc++) {
            if (owner[rr][cc] !== null) return;
            owner[rr][cc] = { cell, startRow: i, startCol: c };
          }
        }
        cell.dataset.logicalStartCol = c.toString();
        cell.dataset.logicalEndCol = (c + cs - 1).toString();
        c += cs;
      }
    }
    this.ownerGrid = owner;
  }

  private createContextMenu() {
    const menu = document.createElement("div");
    menu.classList.add(this.CSS.contextMenu);

    menu.style.position = "absolute";
    menu.style.zIndex = "1000";
    menu.style.display = "flex";
    menu.style.flexWrap = "wrap";
    menu.style.backgroundColor = "#f0f0f0";
    menu.style.border = "1px solid #d1d5db";
    menu.style.padding = "1px";
    menu.style.gap = "5px";
    menu.style.alignItems = "center";
    menu.style.justifyContent = "flex-start";
    menu.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
    menu.style.borderRadius = "4px";
    menu.style.maxWidth = "636px";

    const menuItems = [
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#3498db" xmlns="http://www.w3.org/2000/svg"><path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm-1-11h2v2h-2v-2zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z"/></svg>`,
        label: "Background Color",
        action: () => this.showColorPicker("background"),
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#2ecc71" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg>`,
        label: "Row Background",
        action: () => this.showColorPicker("rowBackground"),
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#e74c3c" xmlns="http://www.w3.org/2000/svg"><path d="M6 3v18h2V3H6zm5 0v18h2V3h-2zm5 0v18h2V3h-2z"/></svg>`,
        label: "Column Background",
        action: () => this.showColorPicker("columnBackground"),
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#f1c40f" xmlns="http://www.w3.org/2000/svg"><path d="M3 4h18v4H3V4zm0 6h18v4H3v-4zm0 6h18v4H3v-4z"/></svg>`,
        label: "Toggle Header",
        action: () => this.toggleHeader(),
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#9b59b6" xmlns="http://www.w3.org/2000/svg"><path d="M3 3v18h18V3H3zm2 2h14v14H5V5zm2 2v10h10V7H7z"/></svg>`,
        label: "Border Color",
        action: () => this.showColorPicker("border"),
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#e67e22" xmlns="http://www.w3.org/2000/svg"><path d="M3 3v18h18V3H3zm2 2h14v14H5V5zm2 2v2h10V7H7zm0 4v2h10v-2H7zm0 4v2h10v-2H7z" stroke="#e67e22" stroke-width="2" stroke-dasharray="2"/></svg>`,
        label: "Border Style",
        submenu: true,
        action: () => this.showBorderStylePicker(),
      },
      { type: "separator" },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#1abc9c" xmlns="http://www.w3.org/2000/svg"><path d="M3 10h18V7H3v3zm0 4h18v-3H3v3z" fill="#1abc9c"/><path d="M12 3l-4 4h8l-4-4z" fill="#1abc9c"/></svg>`,
        label: "Insert Row Above",
        action: () => this.insertRow("above"),
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#3498db" xmlns="http://www.w3.org/2000/svg"><path d="M3 10h18V7H3v3zm0 4h18v-3H3v3z" fill="#3498db"/><path d="M12 21l4-4h-8l4 4z" fill="#3498db"/></svg>`,
        label: "Insert Row Below",
        action: () => this.insertRow("below"),
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#e74c3c" xmlns="http://www.w3.org/2000/svg"><path d="M10 3v18H7V3h3zm4 0v18h-3V3h3z" fill="#e74c3c"/><path d="M3 12l4-4v8l-4-4z" fill="#e74c3c"/></svg>`,
        label: "Insert Column Left",
        action: () => this.insertColumn("left"),
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#2ecc71" xmlns="http://www.w3.org/2000/svg"><path d="M10 3v18H7V3h3zm4 0v18h-3V3h3z" fill="#2ecc71"/><path d="M21 12l-4-4v8l4-4z" fill="#2ecc71"/></svg>`,
        label: "Insert Column Right",
        action: () => this.insertColumn("right"),
      },
      { type: "separator" },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#9b59b6" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18v12H3V6zm4 4h10v4H7v-4z"/></svg>`,
        label: "Merge Selected Cells",
        action: () => this.mergeCells(),
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#f1c40f" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18v12H3V6zm8 4h2v4h-2v-4zm4 0h2v4h-2v-4z"/></svg>`,
        label: "Split Cell",
        action: () => this.splitCell(),
      },
      { type: "separator" },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#e74c3c" xmlns="http://www.w3.org/2000/svg"><path d="M3 8h18v2H3V8zm9 4v6l3-3-3-3z"/></svg>`,
        label: "Delete Row",
        action: () => this.deleteRow(),
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#e67e22" xmlns="http://www.w3.org/2000/svg"><path d="M8 3v18h2V3H8zm4 9h6l-3-3-3 3z"/></svg>`,
        label: "Delete Column",
        action: () => this.deleteColumn(),
      },
      { type: "separator" },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#2ecc71" xmlns="http://www.w3.org/2000/svg"><path d="M3 3v18h18V3H3zm4 4h10v10H7V7zm2 2v6h2V9H9z"/></svg>`,
        label: "Align Left",
        action: () => this.setAlignment("left"),
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#3498db" xmlns="http://www.w3.org/2000/svg"><path d="M3 3v18h18V3H3zm4 4h10v10H7V7zm4 2v6h2V9h-2z"/></svg>`,
        label: "Align Center",
        action: () => this.setAlignment("center"),
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#e74c3c" xmlns="http://www.w3.org/2000/svg"><path d="M3 3v18h18V3H3zm4 4h10v10H7V7zm6 2v6h2V9h-2z"/></svg>`,
        label: "Align Right",
        action: () => this.setAlignment("right"),
      },
      {
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#9b59b6" xmlns="http://www.w3.org/2000/svg"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm1-12h-2v2h2v-2zm0 4h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>`,
        label: "Table Properties",
        action: () => this.openTablePropertiesPanel(),
      },
    ];

    menuItems.forEach((item: any) => {
      if (item.type === "separator") {
        const separator = document.createElement("hr");
        separator.style.width = "1px";
        separator.style.height = "20px";
        separator.style.backgroundColor = "#d1d5db";
        separator.style.margin = "0 2px";
        menu.appendChild(separator);
        return;
      }

      const menuItem = document.createElement("div");
      menuItem.classList.add(this.CSS.contextMenuItem);
      menuItem.style.display = "flex";
      menuItem.style.alignItems = "center";
      menuItem.style.gap = "5px";
      menuItem.style.cursor = "pointer";
      menuItem.style.padding = "3px 5px";
      menuItem.style.borderRadius = "4px";
      menuItem.style.transition = "background-color 0.2s";
      menuItem.style.fontSize = "12px";
      menuItem.style.whiteSpace = "nowrap";

      menuItem.addEventListener("mouseenter", () => {
        menuItem.style.backgroundColor = "#e5e7eb";
      });
      menuItem.addEventListener("mouseleave", () => {
        menuItem.style.backgroundColor = "transparent";
      });

      const icon = document.createElement("span");
      icon.classList.add(this.CSS.contextMenuIcon);
      icon.innerHTML = item.icon;
      icon.style.width = "18px";
      icon.style.height = "18px";
      icon.style.display = "flex";
      icon.style.alignItems = "center";
      icon.style.justifyContent = "center";
      icon.style.flexShrink = "0";

      const label = document.createElement("span");
      label.textContent = item.label;
      label.style.overflow = "hidden";
      label.style.textOverflow = "ellipsis";
      label.style.whiteSpace = "nowrap";

      menuItem.appendChild(icon);
      menuItem.appendChild(label);

      if (item.submenu) {
        const arrow = document.createElement("span");
        arrow.textContent = "▶";
        arrow.style.marginLeft = "5px";
        arrow.style.fontSize = "10px";
        arrow.style.color = "#666";
        menuItem.appendChild(arrow);
      }

      menuItem.addEventListener("click", (e) => {
        e.stopPropagation();
        item.action();
        this.hideContextMenu();
      });

      menu.appendChild(menuItem);
    });

    return menu;
  }

  private openTablePropertiesPanel() {
    if (this.setOpenTableProperties) {
      this.setOpenTableProperties({
        visible: true,
        selectedCell: this.data,
      });
    }
  }

  private createColorPicker(
    type: "background" | "border" | "rowBackground" | "columnBackground"
  ) {
    const picker = document.createElement("input");
    picker.type = "color";

    if (this.selectedCell) {
      const cellRect = this.selectedCell.getBoundingClientRect();
      picker.style.position = "fixed";
      picker.style.left = `${cellRect.left}px`;
      picker.style.top = `${cellRect.bottom + 5}px`;
      picker.style.zIndex = "1000";
    }

    picker.addEventListener("change", (e) => {
      const color = (e.target as HTMLInputElement).value;
      switch (type) {
        case "background":
          this.setCellBackground(color);
          break;
        case "border":
          this.setCellBorder(color);
          break;
        case "rowBackground":
          this.setRowBackground(color);
          break;
        case "columnBackground":
          this.setColumnBackground(color);
          break;
      }
      picker.remove();
    });

    const closeHandler = (e: MouseEvent) => {
      if (e.target !== picker) {
        picker.remove();
        document.removeEventListener("click", closeHandler);
      }
    };
    document.addEventListener("click", closeHandler);

    return picker;
  }

  private showColorPicker(
    type: "background" | "border" | "rowBackground" | "columnBackground"
  ) {
    const picker = this.createColorPicker(type);
    document.body.appendChild(picker);
    setTimeout(() => picker.click(), 100);
  }

  private showBorderStylePicker() {
    const styles = ["solid", "dashed", "dotted", "double", "none"];
    const menu = document.createElement("div");
    menu.classList.add(this.CSS.contextMenu, this.CSS.submenu);

    menu.style.position = "absolute";
    menu.style.zIndex = "1001";
    menu.style.backgroundColor = "#f0f0f0";
    menu.style.border = "1px solid #d1d5db";
    menu.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
    menu.style.borderRadius = "4px";
    menu.style.padding = "5px 0";
    menu.style.display = "flex";
    menu.style.flexDirection = "column";
    menu.style.minWidth = "120px";

    if (this.contextMenu) {
      const menuItems = this.contextMenu.querySelectorAll(
        `.${this.CSS.contextMenuItem}`
      );
      let borderStyleItem: HTMLElement | null = null;

      menuItems.forEach((item: Element) => {
        if (item.textContent?.includes("Border Style")) {
          borderStyleItem = item as HTMLElement;
        }
      });

      if (borderStyleItem) {
        const itemRect = borderStyleItem.getBoundingClientRect();
        const wrapperRect = this.wrapper.getBoundingClientRect();

        const spaceRight = window.innerWidth - itemRect.right;
        const spaceLeft = itemRect.left;
        const submenuWidth = 120;

        if (spaceRight >= submenuWidth) {
          menu.style.left = `${itemRect.right - wrapperRect.left + 5}px`;
          menu.style.top = `${itemRect.top - wrapperRect.top}px`;
        } else if (spaceLeft >= submenuWidth) {
          menu.style.right = `${wrapperRect.right - itemRect.left + 5}px`;
          menu.style.top = `${itemRect.top - wrapperRect.top}px`;
        } else {
          menu.style.left = `${itemRect.left - wrapperRect.left}px`;
          menu.style.top = `${itemRect.bottom - wrapperRect.top + 5}px`;
        }
      }
    }

    styles.forEach((style) => {
      const item = document.createElement("div");
      item.classList.add(this.CSS.contextMenuItem);
      item.textContent = style;
      item.style.padding = "5px 10px";
      item.style.cursor = "pointer";
      item.style.fontSize = "12px";

      item.addEventListener("mouseenter", () => {
        item.style.backgroundColor = "#e5e7eb";
      });
      item.addEventListener("mouseleave", () => {
        item.style.backgroundColor = "transparent";
      });

      item.addEventListener("click", () => {
        this.setBorderStyle(style);
        menu.remove();
        this.hideContextMenu();
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);

    const closeHandler = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener("click", closeHandler);
    }, 10);
  }

  private attachEventListeners() {
    if (!this.table) return;

    this.table.addEventListener("contextmenu", (e: any) => {
      if (this.readOnly) return;
      e.preventDefault();
      const cell = (e.target as HTMLElement).closest("td, th");
      if (!cell) return;

      this.selectedCell = cell as HTMLTableCellElement;
      this.selectedRow = cell.parentElement as HTMLTableRowElement;

      this.hideContextMenu();
      this.contextMenu = this.createContextMenu();

      const tableRect = this.table.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      const wrapperRect = this.wrapper.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      const menuHeight = 180;
      const menuWidth = Math.min(636, wrapperRect.width - 10);

      const spaceBelow = viewportHeight - cellRect.bottom;
      const spaceAbove = cellRect.top;

      let topPosition: number;

      if (spaceBelow >= menuHeight || spaceBelow >= spaceAbove) {
        topPosition = cellRect.bottom - wrapperRect.top + 5;
        this.contextMenu.style.top = `${topPosition}px`;
        this.contextMenu.style.bottom = "auto";
      } else {
        const bottomPosition = wrapperRect.bottom - cellRect.top + 5;
        this.contextMenu.style.bottom = `${bottomPosition}px`;
        this.contextMenu.style.top = "auto";
      }

      this.contextMenu.style.left = "5px";
      this.contextMenu.style.right = "5px";
      this.contextMenu.style.width = `calc(100% - 10px)`;
      this.contextMenu.style.maxWidth = `${menuWidth}px`;

      this.wrapper.appendChild(this.contextMenu);
    });

    document.addEventListener("click", this.handleDocumentClick.bind(this));

    this.table.addEventListener("mousedown", (e: MouseEvent) => {
      if (e.button !== 0 || this.readOnly) return;

      const cell: any = (e.target as HTMLElement).closest("td, th");
      if (cell) {
        if (e.shiftKey && this.selectionStart) {
          this.selectionEnd = cell as HTMLTableCellElement;
          this.selectionEndRow = cell.parentElement!.rowIndex;
          this.selectionEndCol = parseInt(cell.dataset.logicalStartCol!);
          this.selectionEndEndCol = parseInt(cell.dataset.logicalEndCol!);
          this.highlightCells();
          this.finalizeSelection();
        } else {
          this.clearSelection();
          this.selectionStart = cell as HTMLTableCellElement;
          this.selectionStartRow = cell.parentElement!.rowIndex;
          this.selectionStartCol = parseInt(cell.dataset.logicalStartCol!);
          this.selectionStartEndCol = parseInt(cell.dataset.logicalEndCol!);
          this.isSelecting = true;
        }
      }
    });

    this.table.addEventListener("mousemove", (e: MouseEvent) => {
      if (this.isSelecting && this.selectionStart) {
        const cell: any = (e.target as HTMLElement).closest("td, th");
        if (cell) {
          this.selectionEnd = cell as HTMLTableCellElement;
          this.selectionEndRow = cell.parentElement!.rowIndex;
          this.selectionEndCol = parseInt(cell.dataset.logicalStartCol!);
          this.selectionEndEndCol = parseInt(cell.dataset.logicalEndCol!);
          this.highlightCells();
        }
      }
    });

    document.addEventListener("mouseup", () => {
      if (this.isSelecting) {
        this.isSelecting = false;
        if (!this.selectionEnd) {
          this.selectionEnd = this.selectionStart;
          this.selectionEndRow = this.selectionStartRow;
          this.selectionEndCol = this.selectionStartCol;
          this.selectionEndEndCol = this.selectionStartEndCol;
        }
        this.finalizeSelection();
      }
    });

    this.table.addEventListener("keydown", (e: KeyboardEvent) => {
      const cell = e.target as HTMLElement;
      if (cell.tagName !== "TD" && cell.tagName !== "TH") return;

      if (e.key === "Enter") {
        if (e.shiftKey) {
          e.preventDefault();
          document.execCommand("insertLineBreak");
        } else {
          const row: any = cell.parentElement;
          if (row && row.rowIndex === this.table!.rows.length - 1) {
            e.preventDefault();
            this.insertRow("below");
            const newRow = this.table!.rows[row.rowIndex + 1];
            if (newRow && newRow.cells[0]) {
              newRow.cells[0].focus();
            }
          }
        }
      }
    });
  }

  private highlightCells() {
    Array.from(this.table.querySelectorAll("td, th")).forEach((c: any) =>
      c.classList.remove(this.CSS.selecting)
    );
    if (!this.selectionStart || !this.selectionEnd) return;
    const minRow = Math.min(this.selectionStartRow, this.selectionEndRow);
    const maxRow = Math.max(this.selectionStartRow, this.selectionEndRow);
    const minCol = Math.min(this.selectionStartCol, this.selectionEndCol);
    const maxCol = Math.max(this.selectionStartEndCol, this.selectionEndEndCol);
    Array.from(this.table.querySelectorAll("td, th")).forEach((cell: any) => {
      const row = cell.parentElement.rowIndex;
      const startCol = parseInt(cell.dataset.logicalStartCol!);
      const endCol = parseInt(cell.dataset.logicalEndCol!);
      if (
        row >= minRow &&
        row <= maxRow &&
        startCol <= maxCol &&
        endCol >= minCol
      ) {
        cell.classList.add(this.CSS.selecting);
      }
    });
  }

  private finalizeSelection() {
    const minRow = Math.min(this.selectionStartRow, this.selectionEndRow);
    const maxRow = Math.max(this.selectionStartRow, this.selectionEndRow);
    const minCol = Math.min(this.selectionStartCol, this.selectionEndCol);
    const maxCol = Math.max(this.selectionStartEndCol, this.selectionEndEndCol);
    this.selectedMinRow = minRow;
    this.selectedMaxRow = maxRow;
    this.selectedMinCol = minCol;
    this.selectedMaxCol = maxCol;
    Array.from(this.table.querySelectorAll(`.${this.CSS.selecting}`)).forEach(
      (c: any) => {
        c.classList.remove(this.CSS.selecting);
        c.classList.add(this.CSS.selected);
      }
    );
  }

  private clearSelection() {
    Array.from(this.table.querySelectorAll("td, th")).forEach((c: any) =>
      c.classList.remove(this.CSS.selected)
    );
    this.selectedMinRow = undefined;
    this.selectedMaxRow = undefined;
    this.selectedMinCol = undefined;
    this.selectedMaxCol = undefined;
  }

  private handleDocumentClick(e: MouseEvent) {
    if (!this.contextMenu?.contains(e.target as Node)) {
      this.hideContextMenu();
    }
  }

  private hideContextMenu() {
    this.contextMenu?.remove();
    this.contextMenu = null;
  }

  private setCellBackground(color: string) {
    if (this.selectedMinRow === undefined) {
      if (this.selectedCell) {
        this.selectedCell.style.backgroundColor = color;
        this.updateCellStyles();
      }
    } else {
      const minRow = this.selectedMinRow;
      const maxRow = this.selectedMaxRow!;
      const minCol = this.selectedMinCol!;
      const maxCol = this.selectedMaxCol!;
      Array.from(this.table.querySelectorAll("td, th")).forEach((cell: any) => {
        const row = cell.parentElement.rowIndex;
        const startCol = parseInt(cell.dataset.logicalStartCol!);
        const endCol = parseInt(cell.dataset.logicalEndCol!);
        if (
          row >= minRow &&
          row <= maxRow &&
          startCol <= maxCol &&
          endCol >= minCol
        ) {
          cell.style.backgroundColor = color;
          this.updateCellStyles(cell);
        }
      });
    }
  }

  private setRowBackground(color: string) {
    if (!this.selectedRow) return;
    this.selectedRow.style.backgroundColor = color;
    const rowIndex = this.selectedRow.rowIndex;
    this.data.styles.rows[rowIndex] = { backgroundColor: color };
    this.updateData();
  }

  private setColumnBackground(color: string) {
    if (this.selectedCell) {
      const columnIndex = parseInt(this.selectedCell.dataset.logicalStartCol!);
      Array.from(this.table.rows).forEach((row: HTMLTableRowElement) => {
        Array.from(row.cells).forEach((cell: HTMLTableCellElement) => {
          const startCol = parseInt(cell.dataset.logicalStartCol!);
          if (startCol === columnIndex) {
            cell.style.backgroundColor = color;
          }
        });
      });
      this.updateData();
    }
  }

  private setCellBorder(color: string) {
    if (this.selectedMinRow === undefined) {
      if (this.selectedCell) {
        this.selectedCell.style.borderColor = color;
        this.selectedCell.style.borderWidth =
          this.data.styles.table.borderWidth;
        this.selectedCell.style.borderStyle =
          this.data.styles.table.borderStyle;
        this.updateCellStyles();
      }
    } else {
      const minRow = this.selectedMinRow;
      const maxRow = this.selectedMaxRow!;
      const minCol = this.selectedMinCol!;
      const maxCol = this.selectedMaxCol!;
      Array.from(this.table.querySelectorAll("td, th")).forEach((cell: any) => {
        const row = cell.parentElement.rowIndex;
        const startCol = parseInt(cell.dataset.logicalStartCol!);
        const endCol = parseInt(cell.dataset.logicalEndCol!);
        if (
          row >= minRow &&
          row <= maxRow &&
          startCol <= maxCol &&
          endCol >= minCol
        ) {
          cell.style.borderColor = color;
          cell.style.borderWidth = this.data.styles.table.borderWidth;
          cell.style.borderStyle = this.data.styles.table.borderStyle;
          this.updateCellStyles(cell);
        }
      });
    }
  }

  private setBorderStyle(style: string) {
    if (this.selectedMinRow === undefined) {
      if (this.selectedCell) {
        this.selectedCell.style.borderStyle = style;
        this.selectedCell.style.borderWidth =
          this.data.styles.table.borderWidth;
        this.updateCellStyles();
      }
    } else {
      const minRow = this.selectedMinRow;
      const maxRow = this.selectedMaxRow!;
      const minCol = this.selectedMinCol!;
      const maxCol = this.selectedMaxCol!;
      Array.from(this.table.querySelectorAll("td, th")).forEach((cell: any) => {
        const row = cell.parentElement.rowIndex;
        const startCol = parseInt(cell.dataset.logicalStartCol!);
        const endCol = parseInt(cell.dataset.logicalEndCol!);
        if (
          row >= minRow &&
          row <= maxRow &&
          startCol <= maxCol &&
          endCol >= minCol
        ) {
          cell.style.borderStyle = style;
          cell.style.borderWidth = this.data.styles.table.borderWidth;
          this.updateCellStyles(cell);
        }
      });
    }
  }

  private toggleHeader() {
    if (!this.selectedRow) return;

    const rowIndex = this.selectedRow.rowIndex;
    const isHeader = !this.selectedRow.classList.contains(this.CSS.header);

    if (isHeader) {
      this.selectedRow.classList.add(this.CSS.header);
    } else {
      this.selectedRow.classList.remove(this.CSS.header);
    }

    Array.from(this.selectedRow.cells).forEach((cell: any) => {
      const cellContent = cell.innerHTML;
      const cellStyles = cell.style.cssText;
      const newCell = isHeader
        ? document.createElement("th")
        : document.createElement("td");

      newCell.innerHTML = cellContent;
      newCell.style.cssText = cellStyles;
      newCell.classList.add(this.CSS.cell);
      newCell.contentEditable = this.readOnly ? "false" : "true";
      newCell.dataset.logicalStartCol = cell.dataset.logicalStartCol;
      newCell.dataset.logicalEndCol = cell.dataset.logicalEndCol;
      if (cell.colSpan > 1) newCell.colSpan = cell.colSpan;
      if (cell.rowSpan > 1) newCell.rowSpan = cell.rowSpan;

      newCell.style.whiteSpace = "pre-wrap";
      newCell.style.wordBreak = "break-word";
      newCell.style.overflowWrap = "break-word";

      cell.replaceWith(newCell);
    });

    if (!this.data.headerRows) {
      this.data.headerRows = [];
    }

    if (isHeader) {
      if (!this.data.headerRows.includes(rowIndex)) {
        this.data.headerRows.push(rowIndex);
      }
    } else {
      this.data.headerRows = this.data.headerRows.filter(
        (idx: number) => idx !== rowIndex
      );
    }

    this.data.withHeading = this.data.headerRows.length > 0;

    this.updateData();
  }

  private setAlignment(align: "left" | "center" | "right") {
    if (this.selectedMinRow === undefined) {
      if (this.selectedCell) {
        this.selectedCell.style.textAlign = align;
        this.updateCellStyles();
      }
    } else {
      const minRow = this.selectedMinRow;
      const maxRow = this.selectedMaxRow!;
      const minCol = this.selectedMinCol!;
      const maxCol = this.selectedMaxCol!;
      Array.from(this.table.querySelectorAll("td, th")).forEach((cell: any) => {
        const row = cell.parentElement.rowIndex;
        const startCol = parseInt(cell.dataset.logicalStartCol!);
        const endCol = parseInt(cell.dataset.logicalEndCol!);
        if (
          row >= minRow &&
          row <= maxRow &&
          startCol <= maxCol &&
          endCol >= minCol
        ) {
          cell.style.textAlign = align;
          this.updateCellStyles(cell);
        }
      });
    }
  }

  private mergeCells() {
    if (this.selectedMinRow === undefined) return;

    const minRow = this.selectedMinRow;
    const maxRow = this.selectedMaxRow!;
    const minCol = this.selectedMinCol!;
    const maxCol = this.selectedMaxCol!;

    if (minRow === maxRow && minCol === maxCol) return;

    if (!this.ownerGrid) this.assignLogicalCols();

    const owner = this.ownerGrid!;

    const numPositions = (maxRow - minRow + 1) * (maxCol - minCol + 1);
    const cellSet = new Set<HTMLTableCellElement>();
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const o = owner[r][c];
        if (!o) {
          console.warn("Invalid selection: hole in table");
          return;
        }
        cellSet.add(o.cell);
        if (
          o.startRow < minRow ||
          o.startRow > maxRow ||
          o.startCol < minCol ||
          o.startCol > maxCol
        ) {
          console.warn("Invalid selection: owner outside range");
          return;
        }
      }
    }

    if (cellSet.size !== numPositions) {
      console.warn("Invalid selection: already merged cells inside");
      return;
    }

    let topLeft: {
      cell: HTMLTableCellElement;
      row: number;
      col: number;
    } | null = null;
    cellSet.forEach((cell: any) => {
      const r = cell.parentElement!.rowIndex;
      const c = parseInt(cell.dataset.logicalStartCol!);
      if (
        !topLeft ||
        r < topLeft.row ||
        (r === topLeft.row && c < topLeft.col)
      ) {
        topLeft = { cell, row: r, col: c };
      }
    });

    if (!topLeft) return;

    const contents = Array.from(cellSet)
      .map((cell) => cell.innerHTML)
      .join(" ");
    topLeft.cell.innerHTML = contents;

    topLeft.cell.rowSpan = maxRow - minRow + 1;
    topLeft.cell.colSpan = maxCol - minCol + 1;

    cellSet.forEach((cell) => {
      if (cell !== topLeft!.cell) {
        cell.remove();
      }
    });

    this.assignLogicalCols();
    this.updateData();
    this.clearSelection();
  }

  private splitCell() {
    if (!this.selectedCell) return;

    const cell: any = this.selectedCell as HTMLTableCellElement;
    const rowSpan = cell.rowSpan || 1;
    const colSpan = cell.colSpan || 1;
    if (rowSpan === 1 && colSpan === 1) return;

    const startRow = cell.parentElement!.rowIndex;
    const startCol = parseInt(cell.dataset.logicalStartCol!);
    const endRow = startRow + rowSpan - 1;
    const endCol = startCol + colSpan - 1;

    cell.rowSpan = 1;
    cell.colSpan = 1;

    for (let r = startRow; r <= endRow; r++) {
      const row = this.table.rows[r];
      for (let c = startCol; c <= endCol; c++) {
        if (r === startRow && c === startCol) continue;

        const newCell = document.createElement(
          row.classList.contains(this.CSS.header) ? "th" : "td"
        );
        newCell.classList.add(this.CSS.cell);
        newCell.contentEditable = this.readOnly ? "false" : "true";
        newCell.innerHTML = "";
        newCell.style.borderWidth = this.data.styles.table.borderWidth;
        newCell.style.borderStyle = this.data.styles.table.borderStyle;
        newCell.style.borderColor = this.data.styles.table.borderColor;
        newCell.style.wordBreak = "break-word";
        newCell.style.whiteSpace = "pre-wrap";
        newCell.style.overflowWrap = "break-word";

        let insertBefore: HTMLTableCellElement | null = null;
        Array.from(row.cells).forEach((existing: HTMLTableCellElement) => {
          const exC = parseInt(existing.dataset.logicalStartCol!);
          if (exC >= c && !insertBefore) {
            insertBefore = existing;
          }
        });
        row.insertBefore(newCell, insertBefore);
      }
    }

    this.assignLogicalCols();
    this.updateData();
  }

  private insertRow(position: "above" | "below"): void {
    if (!this.selectedRow || !this.table) return;

    const newRow = document.createElement("tr");
    newRow.classList.add(this.CSS.row);
    const cellCount = this.getNumCols();

    for (let i = 0; i < cellCount; i++) {
      const cell = document.createElement(
        this.selectedRow.classList.contains(this.CSS.header) ? "th" : "td"
      );
      cell.classList.add(this.CSS.cell);
      cell.contentEditable = "true";

      cell.style.borderWidth = this.data.styles.table.borderWidth;
      cell.style.borderStyle = this.data.styles.table.borderStyle;
      cell.style.borderColor = this.data.styles.table.borderColor;
      cell.style.wordBreak = "break-word";
      cell.style.whiteSpace = "pre-wrap";
      cell.style.overflowWrap = "break-word";

      newRow.appendChild(cell);
      cell.addEventListener("input", () => {
        const rowIndex = newRow.rowIndex;
        const colIndex = cell.cellIndex;
        this.data.content[rowIndex][colIndex] = cell.innerHTML;
        this.updateData();
      });
    }

    if (position === "above") {
      this.selectedRow.before(newRow);
    } else {
      this.selectedRow.after(newRow);
    }

    if (position === "above" && this.data.headerRows) {
      this.data.headerRows = this.data.headerRows.map((idx: number) =>
        idx >= this.selectedRow.rowIndex ? idx + 1 : idx
      );
    }

    this.assignLogicalCols();
    this.updateData();
  }

  private insertColumn(position: "left" | "right"): void {
    if (!this.selectedCell || !this.table) return;

    const logicalCol = parseInt(this.selectedCell.dataset.logicalStartCol!);

    const rows = this.table.rows;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const newCell = document.createElement(
        row.classList.contains(this.CSS.header) ? "th" : "td"
      );
      newCell.classList.add(this.CSS.cell);
      newCell.contentEditable = "true";

      newCell.style.borderWidth = this.data.styles.table.borderWidth;
      newCell.style.borderStyle = this.data.styles.table.borderStyle;
      newCell.style.borderColor = this.data.styles.table.borderColor;
      newCell.style.wordBreak = "break-word";
      newCell.style.whiteSpace = "pre-wrap";
      newCell.style.overflowWrap = "break-word";

      newCell.addEventListener("input", () => {
        const rowIndex = row.rowIndex;
        const colIndex = newCell.cellIndex;
        this.data.content[rowIndex][colIndex] = newCell.innerHTML;
        this.updateData();
      });

      let insertBefore: HTMLTableCellElement | null = null;
      Array.from(row.cells).forEach((cell: HTMLTableCellElement) => {
        const startCol = parseInt(cell.dataset.logicalStartCol!);
        if (
          (position === "left" && startCol >= logicalCol) ||
          (position === "right" && startCol >= logicalCol + 1)
        ) {
          if (!insertBefore) insertBefore = cell;
        }
      });
      row.insertBefore(newCell, insertBefore);
    }

    this.assignLogicalCols();
    this.updateData();
  }

  private deleteRow() {
    if (!this.selectedRow) return;
    const rowIndex = this.selectedRow.rowIndex;
    this.selectedRow.remove();
    this.selectedCell = null;
    this.selectedRow = null;

    if (this.data.headerRows) {
      this.data.headerRows = this.data.headerRows
        .filter((idx: number) => idx !== rowIndex)
        .map((idx: number) => (idx > rowIndex ? idx - 1 : idx));
    }

    this.assignLogicalCols();
    this.updateData();
  }

  private deleteColumn(): void {
    if (!this.selectedCell || !this.table) return;

    const logicalCol = parseInt(this.selectedCell.dataset.logicalStartCol!);

    const rows = this.table.rows;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      Array.from(row.cells).forEach((cell: HTMLTableCellElement) => {
        const startCol = parseInt(cell.dataset.logicalStartCol!);
        const endCol = parseInt(cell.dataset.logicalEndCol!);
        if (startCol <= logicalCol && endCol >= logicalCol) {
          if (cell.colSpan > 1) {
            cell.colSpan -= 1;
          } else {
            cell.remove();
          }
        }
      });
    }

    this.selectedCell = null;
    this.assignLogicalCols();
    this.updateData();
  }

  private updateCellStyles(cell?: HTMLTableCellElement) {
    const targetCell = cell || this.selectedCell;
    if (!targetCell) return;
    const rowIndex = targetCell.parentElement?.rowIndex || 0;
    const colIndex = targetCell.cellIndex;
    const key = `${rowIndex}-${colIndex}`;

    const existingStyles = this.data.styles.cells[key] || {};
    if (!this.data.styles.cells[rowIndex]) {
      this.data.styles.cells[rowIndex] = {};
    }

    this.data.styles.cells[rowIndex][colIndex] = {
      ...existingStyles,
      backgroundColor:
        targetCell.style.backgroundColor || existingStyles.backgroundColor,
      borderColor: targetCell.style.borderColor || existingStyles.borderColor,
      borderWidth: targetCell.style.borderWidth || existingStyles.borderWidth,
      borderStyle: targetCell.style.borderStyle || existingStyles.borderStyle,
      textAlign: targetCell.style.textAlign || existingStyles.textAlign,
      colSpan: targetCell.colSpan > 1 ? targetCell.colSpan : undefined,
      rowSpan: targetCell.rowSpan > 1 ? targetCell.rowSpan : undefined,
    };

    this.updateData();
  }

  private applyTableStyles() {
    if (!this.table) return;
    Object.assign(this.table.style, this.data.styles.table);
  }

  private updateData() {
    if (!this.table) return;

    const content: string[][] = [];
    const rows = this.table.rows;

    const cellStyles: any = {};
    const rowStyles: any = {};
    const headerRows: number[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowData: string[] = [];
      const cells = rows[i].cells;

      if (rows[i].classList.contains(this.CSS.header)) {
        headerRows.push(i);
      }

      if (rows[i].style.backgroundColor) {
        rowStyles[i] = { backgroundColor: rows[i].style.backgroundColor };
      }

      if (!cellStyles[i]) {
        cellStyles[i] = {};
      }

      for (let j = 0; j < cells.length; j++) {
        const cell = cells[j];
        rowData.push(cell.innerHTML);

        const cellStyle: any = {};
        if (cell.style.backgroundColor)
          cellStyle.backgroundColor = cell.style.backgroundColor;
        if (cell.style.borderColor)
          cellStyle.borderColor = cell.style.borderColor;
        if (cell.style.borderWidth)
          cellStyle.borderWidth = cell.style.borderWidth;
        if (cell.style.borderStyle)
          cellStyle.borderStyle = cell.style.borderStyle;
        if (cell.style.textAlign) cellStyle.textAlign = cell.style.textAlign;
        if (cell.colSpan > 1) cellStyle.colSpan = cell.colSpan;
        if (cell.rowSpan > 1) cellStyle.rowSpan = cell.rowSpan;

        if (Object.keys(cellStyle).length > 0) {
          cellStyles[i][j] = cellStyle;
        }
      }

      content.push(rowData);
    }

    this.data.content = content;
    this.data.styles.cells = cellStyles;
    this.data.styles.rows = rowStyles;
    this.data.headerRows = headerRows;
    this.data.withHeading = headerRows.length > 0;
  }

  save() {
    this.updateData();
    return {
      ...this.data,
      withHeading: this.data.withHeading,
      headerRows: this.data.headerRows,
    };
  }

  static get pasteConfig(): PasteConfig {
    return {
      tags: ["TABLE", "TR", "TD", "TBODY", "THEAD", "TH"],
      files: {
        mimeTypes: ["text/csv"],
      },
      patterns: {
        table: /^([^|\n]+\|)+([^|\n]+)$/m,
        csv: /^[^,\n]+(?:,[^,\n]+)*$/m,
      },
    };
  }

  onPaste(event: CustomEvent) {
    const { data } = event.detail;

    if (data.tagName === "TABLE") {
      return this.pasteHtmlTable(data);
    }

    if (data.file && data.file.type === "text/csv") {
      return this.pasteCsvFile(data.file);
    }

    if (typeof data.textContent === "string") {
      return this.pasteText(data.textContent);
    }

    return false;
  }

  private async pasteHtmlTable(tableElement: HTMLElement) {
    try {
      const rows = Array.from(tableElement.querySelectorAll("tr"));
      const content: string[][] = [];
      const headerRows: number[] = [];

      rows.forEach((row, index) => {
        const isHeader = row.closest("thead") || row.querySelector("th");
        if (isHeader) {
          headerRows.push(index);
        }
        const cells = Array.from(row.querySelectorAll("td, th")).map(
          (cell) => cell.textContent || ""
        );
        content.push(cells);
      });

      this.data.content = content;
      this.data.headerRows = headerRows;
      this.data.withHeading = headerRows.length > 0;
      this.render();

      return true;
    } catch (error) {
      console.error("Error pasting HTML table:", error);
      return false;
    }
  }

  private async pasteCsvFile(file: File) {
    try {
      const text = await file.text();
      return this.pasteText(text);
    } catch (error) {
      console.error("Error pasting CSV file:", error);
      return false;
    }
  }

  private pasteText(text: string) {
    try {
      let content: string[][] = [];

      if (this.constructor.pasteConfig.patterns.table.test(text)) {
        content = text
          .split("\n")
          .filter((line) => line.trim() && !line.includes("|-"))
          .map((row) =>
            row
              .split("|")
              .map((cell) => cell.trim())
              .filter((cell) => cell)
          );
      } else if (this.constructor.pasteConfig.patterns.csv.test(text)) {
        content = text
          .split("\n")
          .filter((line) => line.trim())
          .map((row) => row.split(",").map((cell) => cell.trim()));
      } else {
        content = text
          .split("\n")
          .filter((line) => line.trim())
          .map((row) =>
            row
              .split(/\t|\s{2,}/)
              .map((cell) => cell.trim())
              .filter((cell) => cell)
          );
      }

      if (content.length > 0 && content[0].length > 0) {
        this.data.content = content;
        this.render();
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error pasting text:", error);
      return false;
    }
  }
}

export default TableTool;
