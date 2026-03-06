import JSZip from "jszip";

// Inline table styles (replaces the esigns.io import)
const TABLE_STYLES: Record<string, any> = {
  TableNormal: { table: {}, firstRow: false },
  "Table Grid": { table: { borderCollapse: "collapse" }, firstRow: false },
  "Light Shading": { table: {}, firstRow: true },
  "Light List": { table: {}, firstRow: true },
  "Light Grid": { table: { borderCollapse: "collapse" }, firstRow: true },
  "Medium Shading 1": { table: {}, firstRow: true },
  "Medium Shading 2": { table: {}, firstRow: true },
  "Medium List 1": { table: {}, firstRow: true },
  "Medium List 2": { table: {}, firstRow: true },
  "Medium Grid 1": { table: { borderCollapse: "collapse" }, firstRow: true },
  "Medium Grid 2": { table: { borderCollapse: "collapse" }, firstRow: true },
  "Medium Grid 3": { table: { borderCollapse: "collapse" }, firstRow: true },
  "Dark List": { table: {}, firstRow: true },
  "Colorful Shading": { table: {}, firstRow: true },
  "Colorful List": { table: {}, firstRow: true },
  "Colorful Grid": { table: { borderCollapse: "collapse" }, firstRow: true },
};
interface EditorJSListItem {
  content: string;
  items?: EditorJSListItem[];
}

interface EditorJSList {
  type: "list";
  data: {
    style: "ordered" | "unordered";
    items: EditorJSListItem[];
  };
}

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const RELATIONSHIP_NS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const DRAWING_NS =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const MAIN_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PICTURE_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture";

const processRelationships = async (
  relsXml: string | undefined,
): Promise<{ [key: string]: string }> => {
  const relationships: { [key: string]: string } = {};

  if (relsXml) {
    const relsDoc = new DOMParser().parseFromString(relsXml, "text/xml");
    const rels = relsDoc.getElementsByTagName("Relationship");
    for (const rel of Array.from(rels)) {
      const id = rel.getAttribute("Id");
      const target = rel.getAttribute("Target");
      if (id && target) {
        relationships[id] = target;
      }
    }
  }

  return relationships;
};

const hasColumnLayout = (paragraph: Element): boolean => {
  const hasImage =
    paragraph.getElementsByTagNameNS(WORD_NS, "drawing").length > 0;
  const hasTextBox =
    paragraph.getElementsByTagNameNS(WORD_NS, "txbxContent").length > 0;

  const alternateContents = paragraph.getElementsByTagNameNS(
    "http://schemas.openxmlformats.org/markup-compatibility/2006",
    "AlternateContent",
  );
  for (const altContent of Array.from(alternateContents)) {
    const choice = altContent.getElementsByTagNameNS(
      "http://schemas.openxmlformats.org/markup-compatibility/2006",
      "Choice",
    )[0];
    if (choice) {
      const drawings = choice.getElementsByTagNameNS(WORD_NS, "drawing");
      for (const drawing of Array.from(drawings)) {
        const anchor = drawing.getElementsByTagNameNS(DRAWING_NS, "anchor")[0];
        if (anchor) {
          const graphic = anchor.getElementsByTagNameNS(MAIN_NS, "graphic")[0];
          if (graphic) {
            const graphicData = graphic.getElementsByTagNameNS(
              MAIN_NS,
              "graphicData",
            )[0];
            if (
              graphicData &&
              graphicData.getAttribute("uri") ===
                "http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
            ) {
              const wps = graphicData.getElementsByTagNameNS(
                "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
                "wsp",
              )[0];
              if (wps) {
                const txbx = wps.getElementsByTagNameNS(
                  "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
                  "txbx",
                )[0];
                if (txbx) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
  }

  return hasImage && hasTextBox;
};

const parseHeadersAndFooters = async (
  zip: JSZip,
  images: { [key: string]: string },
) => {
  const headerBlocks: any[] = [];
  const footerBlocks: any[] = [];

  const allRelationships: { [headerPath: string]: { [key: string]: string } } =
    {};

  for (const path in zip.files) {
    if (
      path.includes(".xml.rels") &&
      (path.includes("header") || path.includes("footer"))
    ) {
      try {
        const relsXml = await zip.file(path)?.async("text");
        if (!relsXml) continue;

        const basePath = path.replace(".xml.rels", ".xml");
        allRelationships[basePath] = {};

        const relsDoc = new DOMParser().parseFromString(relsXml, "text/xml");
        const rels = relsDoc.getElementsByTagName("Relationship");
        for (const rel of Array.from(rels)) {
          const id = rel.getAttribute("Id");
          const target = rel.getAttribute("Target");
          if (id && target) {
            allRelationships[basePath][id] = target;
            allRelationships[basePath][target] = id;
          }
        }
      } catch (error) {
        console.error(`Error processing relationships ${path}:`, error);
      }
    }
  }

  for (const path in zip.files) {
    if (path.startsWith("word/header") && path.endsWith(".xml")) {
      try {
        const headerXml = await zip.file(path)?.async("text");
        if (!headerXml) continue;

        const relationships = allRelationships[path] || {};

        for (const [relId, target] of Object.entries(relationships)) {
          if (
            relId.startsWith("rId") &&
            (target.includes("/media/") || target.includes("/images/"))
          ) {
            const imagePath = target.startsWith("/")
              ? `word${target}`
              : `word/${target}`;

            if (!images[relId] && !images[imagePath]) {
              try {
                const imageFile = zip.file(imagePath);
                if (imageFile) {
                  const imageData = await imageFile.async("base64");
                  const imageType =
                    imagePath.split(".").pop()?.toLowerCase() || "";
                  const mimeType = getMimeType(imageType);
                  if (mimeType) {
                    images[relId] = `data:${mimeType};base64,${imageData}`;
                    images[imagePath] = `data:${mimeType};base64,${imageData}`;
                  }
                }
              } catch (error) {
                console.error(
                  `Error loading header image ${imagePath}:`,
                  error,
                );
              }
            }
          }
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(headerXml, "text/xml");
        const paragraphs = xmlDoc.getElementsByTagNameNS(WORD_NS, "p");

        let hasColumnInHeader = false;
        const paragraphArray = Array.from(paragraphs);

        for (const paragraph of paragraphArray) {
          if (hasColumnLayout(paragraph)) {
            hasColumnInHeader = true;
            break;
          }
        }

        if (hasColumnInHeader) {
          const columnBlocks: any[] = [];

          const leftColumnContent: any[] = [];
          const rightColumnContent: any[] = [];

          for (const paragraph of paragraphArray) {
            if (hasColumnLayout(paragraph)) {
              const runs = paragraph.getElementsByTagNameNS(WORD_NS, "r");
              let processedImage = false;

              for (const run of Array.from(runs)) {
                const drawings = run.getElementsByTagNameNS(WORD_NS, "drawing");
                if (drawings.length > 0 && !processedImage) {
                  for (const drawing of Array.from(drawings)) {
                    const imageBlock = await processDrawing(
                      drawing,
                      relationships,
                      images,
                      paragraph,
                    );
                    if (imageBlock) {
                      leftColumnContent.push(imageBlock);
                      processedImage = true;
                    }
                  }
                }

                const alternateContents = run.getElementsByTagNameNS(
                  "http://schemas.openxmlformats.org/markup-compatibility/2006",
                  "AlternateContent",
                );
                if (alternateContents.length > 0) {
                  for (const altContent of Array.from(alternateContents)) {
                    const choice = altContent.getElementsByTagNameNS(
                      "http://schemas.openxmlformats.org/markup-compatibility/2006",
                      "Choice",
                    )[0];
                    if (choice) {
                      const drawings = choice.getElementsByTagNameNS(
                        WORD_NS,
                        "drawing",
                      );
                      for (const drawing of Array.from(drawings)) {
                        const anchor = drawing.getElementsByTagNameNS(
                          DRAWING_NS,
                          "anchor",
                        )[0];
                        if (anchor) {
                          const graphic = anchor.getElementsByTagNameNS(
                            MAIN_NS,
                            "graphic",
                          )[0];
                          if (graphic) {
                            const graphicData = graphic.getElementsByTagNameNS(
                              MAIN_NS,
                              "graphicData",
                            )[0];
                            if (
                              graphicData &&
                              graphicData.getAttribute("uri") ===
                                "http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
                            ) {
                              const wps = graphicData.getElementsByTagNameNS(
                                "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
                                "wsp",
                              )[0];
                              if (wps) {
                                const txbx = wps.getElementsByTagNameNS(
                                  "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
                                  "txbx",
                                )[0];
                                if (txbx) {
                                  const txbxContent =
                                    txbx.getElementsByTagNameNS(
                                      WORD_NS,
                                      "txbxContent",
                                    )[0];
                                  if (txbxContent) {
                                    const textParagraphs =
                                      txbxContent.getElementsByTagNameNS(
                                        WORD_NS,
                                        "p",
                                      );
                                    for (const textPara of Array.from(
                                      textParagraphs,
                                    )) {
                                      const block = await processParagraph(
                                        textPara,
                                        relationships,
                                        images,
                                      );
                                      if (block) {
                                        if (Array.isArray(block)) {
                                          rightColumnContent.push(
                                            ...block.filter((b) => b),
                                          );
                                        } else {
                                          rightColumnContent.push(block);
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              const block = await processParagraph(
                paragraph,
                relationships,
                images,
                true,
              );
              if (block) {
                if (Array.isArray(block)) {
                  leftColumnContent.push(...block.filter((b) => b));
                } else {
                  leftColumnContent.push(block);
                }
              }
            }
          }

          if (leftColumnContent.length > 0) {
            columnBlocks.push({
              blocks: leftColumnContent,
              width: 40,
            });
          }

          if (rightColumnContent.length > 0) {
            columnBlocks.push({
              blocks: rightColumnContent,
              width: 60,
            });
          }

          if (columnBlocks.length > 0) {
            const columnBlock = {
              type: "columns",
              data: {
                cols: columnBlocks,
                numberOfColumns: columnBlocks.length,
                layout: {
                  gap: 0,
                  backgroundColor: "transparent",
                  columnBackgroundColor: "transparent",
                  borderColor: "#e8e8eb",
                  borderRadius: 0,
                  padding: 0,
                  customCSS: "",
                  showBorders: false,
                  widthMode: "auto",
                },
              },
            };
            headerBlocks.push(...leftColumnContent, ...rightColumnContent);
          }
        } else {
          const allBlocks: any[] = [];

          for (const paragraph of paragraphArray) {
            const block = await processParagraph(
              paragraph,
              relationships,
              images,
            );
            if (block) {
              if (Array.isArray(block)) {
                allBlocks.push(...block.filter((b) => b));
              } else {
                allBlocks.push(block);
              }
            }
          }

          const tables = xmlDoc.getElementsByTagNameNS(WORD_NS, "tbl");
          for (const table of Array.from(tables)) {
            const block = await processTable(table, relationships, images);
            if (block) allBlocks.push(block);
          }

          const processedBlocks = processLists(allBlocks);
          headerBlocks.push(...processedBlocks);
        }
      } catch (error) {
        console.error(`Error processing header ${path}:`, error);
      }
    }
  }

  for (const path in zip.files) {
    if (path.startsWith("word/footer") && path.endsWith(".xml")) {
      try {
        const footerXml = await zip.file(path)?.async("text");
        if (!footerXml) continue;

        const relationships = allRelationships[path] || {};

        for (const [relId, target] of Object.entries(relationships)) {
          if (
            relId.startsWith("rId") &&
            (target.includes("/media/") || target.includes("/images/"))
          ) {
            const imagePath = target.startsWith("/")
              ? `word${target}`
              : `word/${target}`;

            if (!images[relId] && !images[imagePath]) {
              try {
                const imageFile = zip.file(imagePath);
                if (imageFile) {
                  const imageData = await imageFile.async("base64");
                  const imageType =
                    imagePath.split(".").pop()?.toLowerCase() || "";
                  const mimeType = getMimeType(imageType);
                  if (mimeType) {
                    images[relId] = `data:${mimeType};base64,${imageData}`;
                    images[imagePath] = `data:${mimeType};base64,${imageData}`;
                  }
                }
              } catch (error) {
                console.error(
                  `Error loading footer image ${imagePath}:`,
                  error,
                );
              }
            }
          }
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(footerXml, "text/xml");

        const paragraphs = xmlDoc.getElementsByTagNameNS(WORD_NS, "p");
        const paragraphArray = Array.from(paragraphs);

        let hasColumnInFooter = false;
        for (const paragraph of paragraphArray) {
          if (hasColumnLayout(paragraph)) {
            hasColumnInFooter = true;
            break;
          }
        }

        if (hasColumnInFooter) {
          const columnBlocks: any[] = [];
          const leftColumnContent: any[] = [];
          const rightColumnContent: any[] = [];

          for (const paragraph of paragraphArray) {
            if (hasColumnLayout(paragraph)) {
              const runs = paragraph.getElementsByTagNameNS(WORD_NS, "r");
              let processedImage = false;

              for (const run of Array.from(runs)) {
                const drawings = run.getElementsByTagNameNS(WORD_NS, "drawing");
                if (drawings.length > 0 && !processedImage) {
                  for (const drawing of Array.from(drawings)) {
                    const imageBlock = await processDrawing(
                      drawing,
                      relationships,
                      images,
                      paragraph,
                    );
                    if (imageBlock) {
                      leftColumnContent.push(imageBlock);
                      processedImage = true;
                    }
                  }
                }

                const alternateContents = run.getElementsByTagNameNS(
                  "http://schemas.openxmlformats.org/markup-compatibility/2006",
                  "AlternateContent",
                );
                if (alternateContents.length > 0) {
                  for (const altContent of Array.from(alternateContents)) {
                    const choice = altContent.getElementsByTagNameNS(
                      "http://schemas.openxmlformats.org/markup-compatibility/2006",
                      "Choice",
                    )[0];
                    if (choice) {
                      const drawings = choice.getElementsByTagNameNS(
                        WORD_NS,
                        "drawing",
                      );
                      for (const drawing of Array.from(drawings)) {
                        const anchor = drawing.getElementsByTagNameNS(
                          DRAWING_NS,
                          "anchor",
                        )[0];
                        if (anchor) {
                          const graphic = anchor.getElementsByTagNameNS(
                            MAIN_NS,
                            "graphic",
                          )[0];
                          if (graphic) {
                            const graphicData = graphic.getElementsByTagNameNS(
                              MAIN_NS,
                              "graphicData",
                            )[0];
                            if (
                              graphicData &&
                              graphicData.getAttribute("uri") ===
                                "http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
                            ) {
                              const wps = graphicData.getElementsByTagNameNS(
                                "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
                                "wsp",
                              )[0];
                              if (wps) {
                                const txbx = wps.getElementsByTagNameNS(
                                  "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
                                  "txbx",
                                )[0];
                                if (txbx) {
                                  const txbxContent =
                                    txbx.getElementsByTagNameNS(
                                      WORD_NS,
                                      "txbxContent",
                                    )[0];
                                  if (txbxContent) {
                                    const textParagraphs =
                                      txbxContent.getElementsByTagNameNS(
                                        WORD_NS,
                                        "p",
                                      );
                                    for (const textPara of Array.from(
                                      textParagraphs,
                                    )) {
                                      const block = await processParagraph(
                                        textPara,
                                        relationships,
                                        images,
                                      );
                                      if (block) {
                                        if (Array.isArray(block)) {
                                          rightColumnContent.push(
                                            ...block.filter((b) => b),
                                          );
                                        } else {
                                          rightColumnContent.push(block);
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              const block = await processParagraph(
                paragraph,
                relationships,
                images,
              );
              if (block) {
                if (Array.isArray(block)) {
                  leftColumnContent.push(...block.filter((b) => b));
                } else {
                  leftColumnContent.push(block);
                }
              }
            }
          }

          if (leftColumnContent.length > 0) {
            columnBlocks.push({
              blocks: leftColumnContent,
              width: 40,
            });
          }

          if (rightColumnContent.length > 0) {
            columnBlocks.push({
              blocks: rightColumnContent,
              width: 60,
            });
          }

          if (columnBlocks.length > 0) {
            const columnBlock = {
              type: "columns",
              data: {
                cols: columnBlocks,
                numberOfColumns: columnBlocks.length,
                layout: {
                  gap: 0,
                  backgroundColor: "transparent",
                  columnBackgroundColor: "transparent",
                  borderColor: "#e8e8eb",
                  borderRadius: 0,
                  padding: 0,
                  customCSS: "",
                  showBorders: false,
                  widthMode: columnBlocks.length > 1 ? "custom" : "auto",
                },
              },
            };

            footerBlocks.push(...leftColumnContent, ...rightColumnContent);
          }
        } else {
          const allBlocks: any[] = [];

          for (const paragraph of paragraphArray) {
            const block = await processParagraph(
              paragraph,
              relationships,
              images,
            );
            if (block) {
              if (Array.isArray(block)) {
                allBlocks.push(...block.filter((b) => b));
              } else {
                allBlocks.push(block);
              }
            }
          }

          const tables = xmlDoc.getElementsByTagNameNS(WORD_NS, "tbl");
          for (const table of Array.from(tables)) {
            const block = await processTable(table, relationships, images);
            if (block) allBlocks.push(block);
          }

          const processedBlocks = processLists(allBlocks);
          footerBlocks.push(...processedBlocks);
        }
      } catch (error) {
        console.error(`Error processing footer ${path}:`, error);
      }
    }
  }

  return { headerBlocks, footerBlocks };
};

export const parseDocxWithJSZip = async (file: File) => {
  try {
    const zip = await JSZip.loadAsync(file);
    const documentXml = await zip.file("word/document.xml")?.async("text");
    const relsXml = await zip
      .file("word/_rels/document.xml.rels")
      ?.async("text");
    if (!documentXml) {
      console.error("Could not read document.xml");
      return {};
    }
    const relationships: any = {};
    if (relsXml) {
      const relsDoc = new DOMParser().parseFromString(relsXml, "text/xml");
      const rels = relsDoc.getElementsByTagName("Relationship");
      for (const rel of Array.from(rels)) {
        const id = rel.getAttribute("Id");
        const target = rel.getAttribute("Target");
        if (id && target) {
          relationships[id] = target;
        }
      }
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(documentXml, "text/xml");
    const body = xmlDoc.getElementsByTagNameNS(WORD_NS, "body")[0];
    if (!body) {
      console.error("No body found in document");
      return {};
    }

    const pages: {
      [key: number]: { headers: any[]; main: any[]; footers: any[] };
    } = {};
    let currentPageIndex = 0;
    let currentPageBlocks: any[] = [];
    const images: { [key: string]: string } = {};

    for (const [path, file] of Object.entries(zip.files)) {
      if (
        path.startsWith("word/media/") ||
        path.startsWith("word/images/") ||
        path.includes("media/image") ||
        /word\/media\/image\d+\.\w+/.test(path)
      ) {
        try {
          const imageData = await file.async("base64");
          const imageType = path.split(".").pop()?.toLowerCase() || "";
          const mimeType = getMimeType(imageType);
          if (mimeType) {
            images[path] = `data:${mimeType};base64,${imageData}`;

            const relPath = path.replace("word/", "");
            images[relPath] = `data:${mimeType};base64,${imageData}`;
          }
        } catch (error) {
          console.error(`Error loading image ${path}:`, error);
        }
      }
    }

    const { headerBlocks, footerBlocks } = await parseHeadersAndFooters(
      zip,
      images,
    );
    for (const child of Array.from(body.children)) {
      if (child.namespaceURI === WORD_NS) {
        if (isPageBreak(child)) {
          if (currentPageBlocks.length > 0) {
            const processedBlocks = processLists(currentPageBlocks);
            pages[currentPageIndex] = {
              headers: headerBlocks || [],
              main: processedBlocks,
              footers: footerBlocks || [],
            };
            currentPageIndex++;
            currentPageBlocks = [];
          }
          continue;
        }

        if (child.localName === "p") {
          const block = await processParagraph(child, relationships, images);
          if (block) {
            if (Array.isArray(block)) {
              for (const singleBlock of block) {
                if (singleBlock) {
                  currentPageBlocks.push(singleBlock);
                }
              }
            } else {
              currentPageBlocks.push(block);
            }
          }
        } else if (child.localName === "tbl") {
          const block = await processTable(child, relationships, images);
          if (block) currentPageBlocks.push(block);
        } else if (child.localName === "sdt") {
          const tocBlocks = await processTOC(child, relationships, images);
          for (const block of tocBlocks) {
            currentPageBlocks.push(block);
          }
        }
      }
    }
    if (currentPageBlocks.length > 0) {
      const processedBlocks = processLists(currentPageBlocks);
      pages[currentPageIndex] = {
        headers: headerBlocks || [],
        main: processedBlocks,
        footers: footerBlocks || [],
      };
    }

    if (Object.keys(pages).length === 0) {
      const processedMainBlocks = processLists(currentPageBlocks);
      pages[0] = {
        headers: headerBlocks || [],
        main: processedMainBlocks,
        footers: footerBlocks || [],
      };
    }

    return pages;
  } catch (error) {
    console.error("Error parsing DOCX:", error);
    return {};
  }
};

async function processTOC(sdtNode: Element, relationships: any, images: any) {
  const galleryEls = sdtNode.getElementsByTagNameNS(WORD_NS, "docPartGallery");
  if (galleryEls.length > 0) {
    const galleryVal = galleryEls[0].getAttribute("w:val");
    if (galleryVal && galleryVal.toLowerCase().includes("table of contents")) {
      const tocEntries: any[] = [];
      const paragraphs = sdtNode.getElementsByTagNameNS(WORD_NS, "p");
      for (const p of Array.from(paragraphs)) {
        const block = await processParagraph(p, relationships, images);
        if (block) tocEntries.push(block);
      }
      return tocEntries;
    }
  }
  return null;
}

const isPageBreak = (element: Element): boolean => {
  if (element.localName !== "p") return false;

  const pPr = getElementByTagNameNS(element, "pPr");
  if (pPr) {
    const sectPr = getElementByTagNameNS(pPr, "sectPr");
    if (sectPr) {
      const type = getElementByTagNameNS(sectPr, "type");
      if (type) {
        const val = type.getAttributeNS(WORD_NS, "val");
        if (val === "nextPage" || val === "oddPage" || val === "evenPage") {
          return true;
        }
      }
    }

    const pageBreakBefore = getElementByTagNameNS(pPr, "pageBreakBefore");
    if (pageBreakBefore) {
      return true;
    }
  }

  const runs = getElementsByTagNameNS(element, "r");
  for (const run of runs) {
    const br = getElementByTagNameNS(run, "br");
    if (br) {
      const type = br.getAttributeNS(WORD_NS, "type");
      if (type === "page") {
        return true;
      }
    }
  }

  return false;
};

const getElementByTagNameNS = (
  element: Element,
  localName: string,
): Element | null => {
  return element.getElementsByTagNameNS(WORD_NS, localName)[0] || null;
};

const getElementsByTagNameNS = (
  element: Element,
  localName: string,
): Element[] => {
  return Array.from(element.getElementsByTagNameNS(WORD_NS, localName));
};

const processHyperlink = (hyperlink: Element, relationships: any): string => {
  try {
    let linkText = "";
    let href = "";

    const relId = hyperlink.getAttributeNS(RELATIONSHIP_NS, "id");
    if (relId && relationships[relId]) {
      href = relationships[relId];
    }

    const anchor = hyperlink.getAttributeNS(WORD_NS, "anchor") || "";
    if (anchor && !href) {
      href = `#${anchor}`;
    }

    const textRuns = getElementsByTagNameNS(hyperlink, "r");
    for (const run of textRuns) {
      const textElement = getElementByTagNameNS(run, "t");
      if (textElement) {
        let runText = textElement.textContent || "";

        if (textElement.getAttributeNS(WORD_NS, "space") === "preserve") {
          runText = " " + runText + " ";
        }

        const rPr = getElementByTagNameNS(run, "rPr");
        const textStyles = getTextStyles(rPr);
        if (textStyles.length > 0) {
          const safeStyles = textStyles
            .map((s) => s.replace(/"/g, "'"))
            .join("; ");

          runText = `<span style="${safeStyles}">${runText}</span>`;
        }

        linkText += runText;
      }
    }

    if (!href && linkText.trim()) {
      href = "#";
    }

    if (linkText.trim()) {
      const linkStyles = [
        "color: #0563C1",
        "text-decoration: underline",
        "cursor: pointer",
      ];

      return `<a href="${href}" style="${linkStyles.join(";")}">${linkText}</a>`;
    }

    return linkText;
  } catch (error) {
    console.error("Error processing hyperlink:", error);
    return "";
  }
};

const processDrawing = async (
  drawingElement: Element,
  relationships: { [key: string]: string },
  images: { [key: string]: string },
  paragraphElement?: Element | null,
): Promise<any> => {
  try {
    let inline: Element | null = null;
    let anchor: Element | null = null;

    for (const child of Array.from(drawingElement.children)) {
      if (child.localName === "inline") {
        inline = child;
        break;
      } else if (child.localName === "anchor") {
        anchor = child;
      }
    }

    const container = inline || anchor;
    if (!container) {
      console.warn("No inline or anchor found in drawing");
      return null;
    }

    const extent = container.getElementsByTagNameNS(DRAWING_NS, "extent")[0];
    const originalWidth = extent?.getAttribute("cx")
      ? Number.parseInt(extent.getAttribute("cx")!)
      : 0;
    const originalHeight = extent?.getAttribute("cy")
      ? Number.parseInt(extent.getAttribute("cy")!)
      : 0;

    const graphic = container.getElementsByTagNameNS(MAIN_NS, "graphic")[0];
    if (!graphic) {
      console.warn("No graphic element found");
      return null;
    }

    const graphicData = graphic.getElementsByTagNameNS(
      MAIN_NS,
      "graphicData",
    )[0];
    if (!graphicData) {
      console.warn("No graphicData element found");
      return null;
    }

    const pic = graphicData.getElementsByTagNameNS(PICTURE_NS, "pic")[0];
    if (!pic) {
      console.warn("No pic element found");
      return null;
    }

    const blipFill = pic.getElementsByTagNameNS(PICTURE_NS, "blipFill")[0];
    if (!blipFill) {
      console.warn("No blipFill element found");
      return null;
    }

    const blip = blipFill.getElementsByTagNameNS(MAIN_NS, "blip")[0];
    if (!blip) {
      console.warn("No blip element found");
      return null;
    }

    const imageId =
      blip.getAttributeNS(RELATIONSHIP_NS, "embed") ||
      blip.getAttributeNS(RELATIONSHIP_NS, "link");

    if (!imageId) {
      console.warn("No image ID found in blip element");
      return null;
    }

    let imageData: string | undefined;

    if (images[imageId]) {
      imageData = images[imageId];
    } else if (relationships[imageId]) {
      const target = relationships[imageId];

      const possiblePaths = [
        target,
        `word/${target}`,
        target.startsWith("/") ? `word${target}` : target,
        `media/${target.split("/").pop()}`,
        target.replace("../", ""),
      ];

      for (const path of possiblePaths) {
        if (images[path]) {
          imageData = images[path];
          break;
        }
      }
    } else {
      const searchPatterns = [
        imageId,
        `rId${imageId.replace("rId", "")}`,
        imageId.toLowerCase(),
        `media/image${imageId.replace("rId", "")}`,
      ];

      for (const pattern of searchPatterns) {
        const matchingKey = Object.keys(images).find(
          (key) => key.includes(pattern) || key.endsWith(pattern),
        );
        if (matchingKey) {
          imageData = images[matchingKey];
          break;
        }
      }
    }

    if (!imageData) {
      return null;
    }

    const img = new Image();
    const actualDimensions = await new Promise<{
      width: number;
      height: number;
    }>((resolve) => {
      img.onload = () => {
        resolve({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });
      };
      img.onerror = () => {
        console.warn("Failed to load image for dimension detection");
        resolve({
          width: originalWidth / 9525,
          height: originalHeight / 9525,
        });
      };
      img.src = imageData;
    });

    let alignment = "left";
    let wrapType = "none";
    let floatValue = "inline";

    if (anchor) {
      // Extract alignment
      const positionH = anchor.getElementsByTagNameNS(
        DRAWING_NS,
        "positionH",
      )[0];

      if (positionH) {
        const align = positionH.getElementsByTagNameNS(DRAWING_NS, "align")[0];
        if (align) {
          const alignValue = align.textContent?.toLowerCase() || "";
          if (alignValue === "center" || alignValue === "centered") {
            alignment = "center";
          } else if (alignValue === "right") {
            alignment = "right";
          } else if (alignValue === "left") {
            alignment = "left";
          }
        }
      } else if (paragraphElement) {
        const pPr = getElementByTagNameNS(paragraphElement, "pPr");
        alignment = getAlignmentFromPPr(pPr);
      }

      const wrapSquare = anchor.getElementsByTagNameNS(
        DRAWING_NS,
        "wrapSquare",
      )[0];
      const wrapTight = anchor.getElementsByTagNameNS(
        DRAWING_NS,
        "wrapTight",
      )[0];
      const wrapThrough = anchor.getElementsByTagNameNS(
        DRAWING_NS,
        "wrapThrough",
      )[0];
      const wrapTopBottom = anchor.getElementsByTagNameNS(
        DRAWING_NS,
        "wrapTopAndBottom",
      )[0];
      const wrapNone = anchor.getElementsByTagNameNS(DRAWING_NS, "wrapNone")[0];

      if (wrapSquare) {
        wrapType = "square";
        floatValue = alignment === "center" ? "inline" : alignment;
      } else if (wrapTight) {
        wrapType = "tight";
        floatValue = alignment === "center" ? "inline" : alignment;
      } else if (wrapThrough) {
        wrapType = "through";
        floatValue = alignment === "center" ? "inline" : alignment;
      } else if (wrapTopBottom) {
        wrapType = "top-bottom";
        floatValue = "inline";
      } else if (wrapNone) {
        wrapType = "none";
        floatValue = "inline";
      } else {
        wrapType = "square";
        floatValue = alignment === "center" ? "inline" : alignment;
      }
    } else if (inline && paragraphElement) {
      const pPr = getElementByTagNameNS(paragraphElement, "pPr");
      alignment = getAlignmentFromPPr(pPr);
    }

    if (alignment === "justify") {
      alignment = "left";
    }

    return {
      type: "image",
      data: {
        url: imageData,
        dimensions: {
          width: originalWidth / 9525,
          height: originalHeight / 9525,
          actual: actualDimensions,
          current: actualDimensions,
        },
        tunes: {
          alignment: {
            alignment: alignment,
          },
          imageTune: {
            float: floatValue,
            wrapText: wrapType,
            position: floatValue === "inline" ? "inline" : "relative",
            marginTop: "0px",
            marginRight: "0px",
            marginBottom: "0px",
            marginLeft: "0px",
          },
        },
      },
    };
  } catch (error) {
    console.error("Error processing drawing:", error);
    return null;
  }
};
const DEFAULT_STYLES = {
  Title: {
    fontSize: "36px",
    color: "#17365D",
    marginBottom: "24px",
    lineHeight: "1.3",
    align: "center",
  },
  Heading1: {
    fontSize: "19px",
    color: "#365F91",
    fontWeight: "bold",
    marginBottom: "20px",
    lineHeight: "1.3",
  },
  Heading2: {
    fontSize: "17px",
    color: "#4F81BD",
    fontWeight: "bold",
    marginBottom: "16px",
    lineHeight: "1.3",
  },
  Heading3: {
    fontSize: "15px",
    color: "#4F81BD",
    fontWeight: "bold",
    marginBottom: "12px",
    lineHeight: "1.3",
  },
};

const getStyleString = (styleObj: Record<string, string>): string => {
  return Object.entries(styleObj)
    .map(
      ([key, value]) =>
        `${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${value}`,
    )
    .join(";");
};

const processCustomParagraphs = async (
  paragraph: Element,
  relationships: { [key: string]: string },
  images: { [key: string]: string },
) => {};

const generatePlaceholder = (
  placeholderName: string,
  originalText: string,
  uniqueId: string = "",
): string => {
  const id =
    uniqueId ||
    `placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const underscoreCount = originalText.length;

  const width = Math.max(40, underscoreCount * 8);
  return `<mark data-placeholder-name="${placeholderName}" data-content-editable="false" data-unique-id="${id}" data-is-new="true"  data-field-type="text" contenteditable="false"  style="display: inline-block; white-space: nowrap; border-bottom: 1px solid rgb(0, 0, 0); min-width: 120px; height: 24px; vertical-align: middle; background-color: transparent; outline: none; width: auto; max-width: none; padding: 0px 4px; color: inherit; text-decoration: none; border-radius: 3px; cursor: context-menu; transition: 0.2s;" data-custom-width="120px" data-empty="false">&nbsp;</mark>
`;
};

const processUnderscorePlaceholders = (text: string): string => {
  const underscoreRegex = /_{3,}/g;

  return text.replace(underscoreRegex, (match) => {
    const placeholderName = `input_field_${match.length}`;
    return generatePlaceholder(placeholderName, match);
  });
};

const getParagraphBordersAndShading = (pPr: Element | null): string[] => {
  const styles: string[] = [];
  if (!pPr) return styles;

  const shd = getElementByTagNameNS(pPr, "shd");
  if (shd) {
    const fill = shd.getAttributeNS(WORD_NS, "fill");
    if (fill && fill !== "auto" && fill !== "000000") {
      styles.push(`background-color: #${fill}`);
      styles.push(`padding: 8px 12px`);
    }
  }

  const pBdr = getElementByTagNameNS(pPr, "pBdr");
  if (pBdr) {
    const borderElements = {
      top: getElementByTagNameNS(pBdr, "top"),
      bottom: getElementByTagNameNS(pBdr, "bottom"),
      left: getElementByTagNameNS(pBdr, "left"),
      right: getElementByTagNameNS(pBdr, "right"),
    };

    let hasBorder = false;
    const borderStyles: { [key: string]: string } = {};

    for (const [side, element] of Object.entries(borderElements)) {
      if (element) {
        const val = element.getAttributeNS(WORD_NS, "val");
        const sz = element.getAttributeNS(WORD_NS, "sz");
        const color = element.getAttributeNS(WORD_NS, "color");

        if (val && val !== "none" && val !== "nil") {
          hasBorder = true;
          const width = sz ? `${Math.max(1, parseInt(sz) / 8)}px` : "1px";
          const borderColor =
            color && color !== "auto" ? `#${color}` : "#000000";
          const borderStyle =
            val === "single" ? "solid" : val === "double" ? "double" : "solid";

          borderStyles[side] = `${width} ${borderStyle} ${borderColor}`;
        }
      }
    }

    if (hasBorder) {
      if (borderStyles.top) styles.push(`border-top: ${borderStyles.top}`);
      if (borderStyles.bottom)
        styles.push(`border-bottom: ${borderStyles.bottom}`);
      if (borderStyles.left) styles.push(`border-left: ${borderStyles.left}`);
      if (borderStyles.right)
        styles.push(`border-right: ${borderStyles.right}`);

      if (!shd) {
        styles.push(`padding: 8px 12px`);
      }
    }
  }

  return styles;
};
const createTextBlock = (textContent: string, pPr: Element | null) => {
  const pStyle = pPr ? getElementByTagNameNS(pPr, "pStyle") : null;
  const styleVal = pStyle?.getAttributeNS(WORD_NS, "val");

  // Check for drop cap
  const framePr = pPr ? getElementByTagNameNS(pPr, "framePr") : null;
  const dropCap = framePr?.getAttributeNS(WORD_NS, "dropCap");
  const lines = framePr?.getAttributeNS(WORD_NS, "lines") || "3";

  // Apply drop cap styling if present
  let processedText = textContent;
  if ((dropCap === "drop" || dropCap === "margin") && textContent.trim()) {
    const lineCount = parseInt(lines) || 3;
    const dropCapStyle = [
      `font-size: ${lineCount * 1.5}em`,
      `font-weight: bold`,
      `float: left`,
      `line-height: 0.8`,
      `margin-right: 8px`,
      `margin-top: 4px`,
      `color: inherit`,
    ].join("; ");

    processedText = textContent.replace(
      /^(\s*(?:<[^>]+>)*)(\S)/,
      `$1<span style="${dropCapStyle}">$2</span>`,
    );
  }

  // Extract borders and shading
  const bordersAndShading = getParagraphBordersAndShading(pPr);
  if (bordersAndShading.length > 0) {
    const styleString = bordersAndShading.join("; ");
    processedText = `<span style="${styleString}; padding: 8px 12px">${processedText}</span>`;
  }

  const baseBlock = {
    tunes: {
      alignment: {
        alignment: getAlignmentFromPPr(pPr),
      },
      indentTune: {
        indentLevel: getIndentLevel(pPr),
      },
    },
  };

  if (
    styleVal === "Title" ||
    styleVal === "Heading1" ||
    styleVal === "Heading2" ||
    styleVal === "Heading3"
  ) {
    const styleObj = DEFAULT_STYLES[styleVal as keyof typeof DEFAULT_STYLES];
    const styleString = getStyleString(styleObj);

    return {
      type: "paragraph",
      data: {
        text: `<span style="${styleString}">${processedText}</span>`,
      },
      tunes: {
        alignment: {
          alignment:
            styleVal === "Title"
              ? "center"
              : styleVal === "Heading1"
                ? "center"
                : getAlignmentFromPPr(pPr),
        },
        indentTune: {
          indentLevel: getIndentLevel(pPr),
        },
      },
    };
  } else if (styleVal?.startsWith("Heading")) {
    const level = Number.parseInt(styleVal.replace("Heading", "")) || 1;
    return {
      type: "header",
      data: {
        text: processedText,
        level,
      },
      ...baseBlock,
    };
  }

  const numPr = pPr ? getElementByTagNameNS(pPr, "numPr") : null;
  if (numPr) {
    const numId = getElementByTagNameNS(numPr, "numId")?.getAttributeNS(
      WORD_NS,
      "val",
    );
    const ilvl =
      getElementByTagNameNS(numPr, "ilvl")?.getAttributeNS(WORD_NS, "val") ||
      "0";

    return {
      type: "list",
      data: {
        style: numId === "1" ? "unordered" : "ordered",
        items: [processedText],
        level: Number.parseInt(ilvl),
      },
      ...baseBlock,
    };
  }

  return {
    type: "paragraph",
    data: {
      text: processedText,
    },
    ...baseBlock,
  };
};

const preserveSpacing = (text: string): string => {
  return text.replace(/ {2,}/g, (spaces) => {
    return "&nbsp;".repeat(spaces.length);
  });
};

const processParagraph = async (
  paragraph: Element,
  relationships: { [key: string]: string },
  images: { [key: string]: string },
  skipTextBoxes: boolean = false,
) => {
  try {
    const pPr = getElementByTagNameNS(paragraph, "pPr");
    const paragraphStyles = getParagraphStyles(pPr);

    let text = "";
    let hasContent = false;
    const imageBlocks: any[] = [];
    const processedBlocks: any[] = [];

    // Bookmark tracking
    const bookmarkStarts: Map<string, string> = new Map(); // id -> name
    let activeBookmarks: string[] = [];

    if (skipTextBoxes) {
      let parent = paragraph.parentElement;
      while (parent) {
        if (
          parent.localName === "txbxContent" &&
          parent.namespaceURI === WORD_NS
        ) {
          return null;
        }
        parent = parent.parentElement;
      }
    }

    for (const child of Array.from(paragraph.children)) {
      if (child.namespaceURI === WORD_NS) {
        if (child.localName === "bookmarkStart") {
          const id = child.getAttributeNS(WORD_NS, "id");
          const name = child.getAttributeNS(WORD_NS, "name");
          if (id && name && !name.startsWith("_")) {
            bookmarkStarts.set(id, name);
            activeBookmarks.push(name);
            text += `<span id="${name}" class="bookmark-marker" style="position: relative;"></span>`;
          }
        } else if (child.localName === "bookmarkEnd") {
          const id = child.getAttributeNS(WORD_NS, "id");
          if (id && bookmarkStarts.has(id)) {
            const name = bookmarkStarts.get(id)!;
            const index = activeBookmarks.indexOf(name);
            if (index > -1) {
              activeBookmarks.splice(index, 1);
            }
          }
        } else if (child.localName === "r") {
          const run = child;
          const textElement = getElementByTagNameNS(run, "t");
          const drawingElement = getElementByTagNameNS(run, "drawing");
          const brElement = getElementByTagNameNS(run, "br");
          const tabElement = getElementByTagNameNS(run, "tab");

          if (brElement) {
            text += "<br>";
          }

          if (tabElement) {
            const tabProps = getElementByTagNameNS(run, "rPr");

            const hasMultipleTabs =
              paragraph.getElementsByTagNameNS(WORD_NS, "tab").length > 1;

            if (hasMultipleTabs) {
              text +=
                '<span style="display: inline-block; min-width: 50px; width: auto; flex-grow: 1;"></span>';
            } else {
              text += "&emsp;&emsp;&emsp;";
            }
          }

          if (textElement) {
            let runText = textElement.textContent || "";

            const xmlSpace =
              textElement.getAttribute("xml:space") ||
              textElement.getAttributeNS(
                "http://www.w3.org/XML/1998/namespace",
                "space",
              );

            if (xmlSpace === "preserve") {
              runText = preserveSpacing(runText);
            }
            runText = processUnderscorePlaceholders(runText);

            if (textElement.getAttributeNS(WORD_NS, "space") === "preserve") {
              runText = " " + runText + " ";
            }

            if (runText.trim()) {
              hasContent = true;
            }

            const rPr = getElementByTagNameNS(run, "rPr");
            const textStyles = getTextStyles(rPr);

            if (textStyles.length > 0) {
              const safeStyles = textStyles
                .map((s) => s.replace(/"/g, "'"))
                .join("; ");

              runText = `<span style="${safeStyles}">${runText}</span>`;
            }

            text += runText;
          } else if (drawingElement) {
            const imageBlock = await processDrawing(
              drawingElement,
              relationships,
              images,
              paragraph,
            );
            if (imageBlock) {
              if (text.trim()) {
                processedBlocks.push(createTextBlock(text, pPr));
                text = "";
                hasContent = false;
              }
              processedBlocks.push(imageBlock);
            }
          }
        } else if (child.localName === "hyperlink") {
          const linkText = processHyperlink(child, relationships);
          if (linkText) {
            hasContent = true;
            text += linkText;
          }
        } else if (child.localName === "br") {
          text += "<br>";
        } else if (child.localName === "AlternateContent") {
          const choice = child.getElementsByTagNameNS(
            "http://schemas.openxmlformats.org/markup-compatibility/2006",
            "Choice",
          )[0];
          const fallback = child.getElementsByTagNameNS(
            "http://schemas.openxmlformats.org/markup-compatibility/2006",
            "Fallback",
          )[0];

          if (choice) {
            const drawings = choice.getElementsByTagNameNS(WORD_NS, "drawing");
            for (const drawing of Array.from(drawings)) {
              const imageBlock = await processDrawing(
                drawing,
                relationships,
                images,
                paragraph,
              );
              if (imageBlock) {
                if (text.trim()) {
                  processedBlocks.push(createTextBlock(text, pPr));
                  text = "";
                  hasContent = false;
                }
                processedBlocks.push(imageBlock);
              }
            }
          }

          if (fallback && processedBlocks.length === 0) {
            const pict = fallback.getElementsByTagNameNS(WORD_NS, "pict")[0];
            if (pict) {
              const vmlShapes = pict.getElementsByTagName("v:shape");
              for (const shape of Array.from(vmlShapes)) {
                const imagedata = shape.getElementsByTagName("v:imagedata")[0];
                if (imagedata) {
                  const imageId = imagedata.getAttributeNS(
                    RELATIONSHIP_NS,
                    "id",
                  );
                  if (imageId && relationships[imageId]) {
                    const imagePath = relationships[imageId].startsWith("/")
                      ? `word${relationships[imageId]}`
                      : `word/${relationships[imageId]}`;
                    const imageData = images[imagePath];

                    if (imageData) {
                      if (text.trim()) {
                        processedBlocks.push(createTextBlock(text, pPr));
                        text = "";
                        hasContent = false;
                      }

                      processedBlocks.push({
                        type: "image",
                        data: {
                          url: imageData,
                          float: "inline",
                          dimensions: {
                            width: 100,
                            height: 100,
                            actual: { width: 100, height: 100 },
                            current: { width: 100, height: 100 },
                          },
                        },
                      });
                    }
                  }
                }
              }
            }
          }
        } else if (child.localName === "t") {
          let runText = child.textContent || "";
          runText = processUnderscorePlaceholders(runText);

          if (child.getAttributeNS(WORD_NS, "space") === "preserve") {
            runText = " " + runText + " ";
          }

          if (runText.trim()) {
            hasContent = true;
          }

          text += runText;
        }
      }
    }

    if (text.trim() || text.includes("<br>")) {
      processedBlocks.push(createTextBlock(text, pPr));
    }

    if (processedBlocks.length === 0) {
      return null;
    } else if (processedBlocks.length === 1) {
      return processedBlocks[0];
    } else {
      return processedBlocks;
    }
  } catch (error) {
    console.error("Error processing paragraph:", error);
    console.error(
      "Paragraph content:",
      paragraph?.outerHTML?.substring(0, 500),
    );
    return null;
  }
};
const processLists = (blocks: any[]): any[] => {
  const processedBlocks: any[] = [];
  let currentList: EditorJSList | null = null;

  const flattenBlocks = (blocks: any[]): any[] => {
    return blocks.reduce((acc: any[], block) => {
      if (Array.isArray(block)) {
        return acc.concat(flattenBlocks(block));
      }
      acc.push(block);
      return acc;
    }, []);
  };

  const flattenedBlocks = flattenBlocks(blocks);

  const createNewList = (block: any): EditorJSList => ({
    type: "list",
    data: {
      style: block.data.style,
      items: [],
    },
  });

  const addItemToList = (list: EditorJSList, item: any, level: number) => {
    const newItem: EditorJSListItem = {
      content: item.data.items[0],
      items: [],
    };

    if (level === 0) {
      list.data.items.push(newItem);
    } else {
      let currentLevel = list.data.items;
      for (let i = 0; i < level; i++) {
        if (!currentLevel[currentLevel.length - 1]) {
          currentLevel.push({ content: "", items: [] });
        }
        if (!currentLevel[currentLevel.length - 1].items) {
          currentLevel[currentLevel.length - 1].items = [];
        }
        currentLevel = currentLevel[currentLevel.length - 1].items!;
      }
      currentLevel.push(newItem);
    }
  };

  for (const block of flattenedBlocks) {
    if (block && block.type === "list") {
      if (!currentList || currentList.data.style !== block.data.style) {
        if (currentList) {
          processedBlocks.push(currentList);
        }
        currentList = createNewList(block);
      }
      addItemToList(currentList, block, block.data.level || 0);
    } else {
      if (currentList) {
        processedBlocks.push(currentList);
        currentList = null;
      }
      processedBlocks.push(block);
    }
  }

  if (currentList) {
    processedBlocks.push(currentList);
  }

  return processedBlocks;
};

const getAlignmentFromPPr = (pPr: Element | null): string => {
  if (!pPr) return "left";
  const jc = getElementByTagNameNS(pPr, "jc");
  const val = jc?.getAttributeNS(WORD_NS, "val");

  const alignmentMap: { [key: string]: string } = {
    left: "left",
    right: "right",
    center: "center",
    both: "justify",
    justify: "justify",
  };

  return alignmentMap[val?.toLowerCase() || ""] || "left";
};

const getIndentLevel = (pPr: Element | null): number => {
  if (!pPr) return 0;
  const ind = getElementByTagNameNS(pPr, "ind");
  if (!ind) return 0;

  const leftInd =
    ind.getAttributeNS(WORD_NS, "left") ||
    ind.getAttributeNS(WORD_NS, "firstLine") ||
    "0";

  return Math.floor(parseInt(leftInd) / 720);
};

const processTable = async (
  table: Element,
  relationships: { [key: string]: string },
  images: { [key: string]: string },
): Promise<any> => {
  try {
    const rows = getElementsByTagNameNS(table, "tr");
    const tblPr = getElementByTagNameNS(table, "tblPr");
    const tblGrid = getElementByTagNameNS(table, "tblGrid");

    const gridCols = tblGrid
      ? Array.from(getElementsByTagNameNS(tblGrid, "gridCol"))
      : [];
    const totalGridCols = gridCols.length;

    const tblLook = tblPr ? getElementByTagNameNS(tblPr, "tblLook") : null;
    const tblStyle = tblPr ? getElementByTagNameNS(tblPr, "tblStyle") : null;
    const tblStyleVal: any = tblStyle
      ? tblStyle.getAttributeNS(WORD_NS, "val")
      : "";

    const tableStyleConfig =
      TABLE_STYLES[tblStyleVal] || TABLE_STYLES["TableNormal"];
    const conditionalFormatting = getTableConditionalFormatting(tblLook);

    if (tableStyleConfig.firstRow) {
      conditionalFormatting.firstRow = true;
    }

    const tableStyles = getTableStyles(tblPr);
    const customTableStyles = tableStyleConfig.table || {};
    const mergedTableStyles = { ...tableStyles, ...customTableStyles };

    const vMergeTracker: {
      [key: number]: { startRow: number; colspan: number };
    } = {};
    const cellsToSkip: Set<string> = new Set();

    const content: string[][] = [];
    const cellStyles: any = {};
    const rowStyles: any = {};
    const headerRows: number[] = [];

    for (const [rowIndex, row] of rows.entries()) {
      const cells = getElementsByTagNameNS(row, "tc");
      const rowData: string[] = [];

      const trPr = getElementByTagNameNS(row, "trPr");
      const rowStyleList = getRowStyles(trPr, rowIndex, conditionalFormatting);

      if (rowStyleList.length > 0) {
        const rowStyleObj: any = {};
        rowStyleList.forEach((style) => {
          const [prop, val] = style.split(": ");
          const camelProp = prop.replace(/-([a-z])/g, (g) =>
            g[1].toUpperCase(),
          );
          rowStyleObj[camelProp] = val;
        });
        rowStyles[rowIndex] = rowStyleObj;
      }

      if (rowIndex === 0 && conditionalFormatting.firstRow) {
        headerRows.push(rowIndex);
      }

      if (!cellStyles[rowIndex]) {
        cellStyles[rowIndex] = {};
      }

      let currentGridCol = 0;
      let visualColIndex = 0;

      for (const [cellIndex, cell] of cells.entries()) {
        while (cellsToSkip.has(`${rowIndex}-${currentGridCol}`)) {
          currentGridCol++;
        }

        const tcPr = getElementByTagNameNS(cell, "tcPr");

        const gridSpan = tcPr ? getElementByTagNameNS(tcPr, "gridSpan") : null;
        const colspan = gridSpan
          ? parseInt(gridSpan.getAttributeNS(WORD_NS, "val") || "1", 10)
          : 1;

        const vMerge = tcPr ? getElementByTagNameNS(tcPr, "vMerge") : null;
        let rowspan = 1;

        if (vMerge) {
          const val = vMerge.getAttributeNS(WORD_NS, "val");

          if (val === "restart" || val === null) {
            rowspan = 1;
            let checkRow = rowIndex + 1;

            while (checkRow < rows.length) {
              const nextRowCells = getElementsByTagNameNS(rows[checkRow], "tc");
              let nextGridCol = 0;
              let found = false;

              for (const nextCell of Array.from(nextRowCells)) {
                while (cellsToSkip.has(`${checkRow}-${nextGridCol}`)) {
                  nextGridCol++;
                }

                const nextTcPr = getElementByTagNameNS(nextCell, "tcPr");
                const nextGridSpan = nextTcPr
                  ? getElementByTagNameNS(nextTcPr, "gridSpan")
                  : null;
                const nextColspan = nextGridSpan
                  ? parseInt(
                      nextGridSpan.getAttributeNS(WORD_NS, "val") || "1",
                      10,
                    )
                  : 1;

                if (nextGridCol === currentGridCol) {
                  const nextVMerge = nextTcPr
                    ? getElementByTagNameNS(nextTcPr, "vMerge")
                    : null;

                  if (
                    nextVMerge &&
                    !nextVMerge.getAttributeNS(WORD_NS, "val")
                  ) {
                    rowspan++;
                    for (
                      let skipCol = nextGridCol;
                      skipCol < nextGridCol + nextColspan;
                      skipCol++
                    ) {
                      cellsToSkip.add(`${checkRow}-${skipCol}`);
                    }
                    found = true;
                    break;
                  } else {
                    found = false;
                    break;
                  }
                }

                nextGridCol += nextColspan;
              }

              if (!found) break;
              checkRow++;
            }
          } else {
            currentGridCol += colspan;
            continue;
          }
        }

        let cellContent = await processCellContent(cell, relationships, images);

        rowData.push(cellContent);

        const cellStyleList = getCellStyles(
          tcPr,
          rowIndex,
          visualColIndex,
          conditionalFormatting,
          rowStyleList,
          tableStyleConfig,
        );

        const cellStyleObj: any = {};

        cellStyleList.forEach((style) => {
          const [prop, val] = style.split(": ");
          const camelProp = prop.replace(/-([a-z])/g, (g) =>
            g[1].toUpperCase(),
          );
          cellStyleObj[camelProp] = val;
        });

        const bgColor = getCellBackgroundColor(tcPr);
        const textColor = getCellTextColor(tcPr);

        if (bgColor && !cellStyleObj.backgroundColor) {
          cellStyleObj.backgroundColor = `#${bgColor}`;
        }
        if (textColor && !cellStyleObj.color) {
          cellStyleObj.color = `#${textColor}`;
        }

        const vAlign = tcPr ? getElementByTagNameNS(tcPr, "vAlign") : null;
        if (vAlign) {
          const alignVal = vAlign.getAttributeNS(WORD_NS, "val");
          if (alignVal === "center") {
            cellStyleObj.verticalAlign = "middle";
          } else if (alignVal === "bottom") {
            cellStyleObj.verticalAlign = "bottom";
          } else if (alignVal === "top") {
            cellStyleObj.verticalAlign = "top";
          }
        }
        const paragraphs = getElementsByTagNameNS(cell, "p");
        if (paragraphs.length > 0) {
          const firstParagraph = paragraphs[0];
          const pPr = getElementByTagNameNS(firstParagraph, "pPr");
          if (pPr) {
            const jc = getElementByTagNameNS(pPr, "jc");
            if (jc) {
              const alignment = jc.getAttributeNS(WORD_NS, "val");
              if (alignment && !cellStyleObj.textAlign) {
                cellStyleObj.textAlign =
                  alignment === "both" ? "justify" : alignment;
              }
            }
          }
        }

        const tcMar = tcPr ? getElementByTagNameNS(tcPr, "tcMar") : null;
        if (tcMar) {
          const top = getElementByTagNameNS(tcMar, "top");
          const bottom = getElementByTagNameNS(tcMar, "bottom");
          const left = getElementByTagNameNS(tcMar, "left");
          const right = getElementByTagNameNS(tcMar, "right");

          if (top) {
            const val = top.getAttributeNS(WORD_NS, "w");
            if (val) cellStyleObj.paddingTop = `${parseInt(val) / 20}pt`;
          }
          if (bottom) {
            const val = bottom.getAttributeNS(WORD_NS, "w");
            if (val) cellStyleObj.paddingBottom = `${parseInt(val) / 20}pt`;
          }
          if (left) {
            const val = left.getAttributeNS(WORD_NS, "w");
            if (val) cellStyleObj.paddingLeft = `${parseInt(val) / 20}pt`;
          }
          if (right) {
            const val = right.getAttributeNS(WORD_NS, "w");
            if (val) cellStyleObj.paddingRight = `${parseInt(val) / 20}pt`;
          }
        }

        if (colspan > 1) {
          cellStyleObj.colSpan = colspan;
        }
        if (rowspan > 1) {
          cellStyleObj.rowSpan = rowspan;
        }

        if (Object.keys(cellStyleObj).length > 0) {
          cellStyles[rowIndex][visualColIndex] = cellStyleObj;
        }

        currentGridCol += colspan;
        visualColIndex++;
      }

      if (rowData.length > 0) {
        content.push(rowData);
      }
    }

    return {
      type: "table",
      data: {
        content,
        withHeading: headerRows.length > 0,
        headerRows,
        styles: {
          table: mergedTableStyles,
          rows: rowStyles,
          cells: cellStyles,
        },
      },
    };
  } catch (error) {
    console.error("Error processing table:", error);
    return null;
  }
};

const processCellContent = async (
  cell: Element,
  relationships: { [key: string]: string },
  images: { [key: string]: string },
): Promise<string> => {
  try {
    let cellContent = "";
    const paragraphs = getElementsByTagNameNS(cell, "p");

    for (const [paraIndex, paragraph] of paragraphs.entries()) {
      if (paraIndex > 0) cellContent += "\n";

      const pPr = getElementByTagNameNS(paragraph, "pPr");
      const paragraphStyles = getParagraphStyles(pPr);

      let paragraphContent = "";

      for (const child of Array.from(paragraph.children)) {
        if (child.namespaceURI !== WORD_NS) continue;

        if (child.localName === "r") {
          const run = child;
          const textElement = getElementByTagNameNS(run, "t");
          const brElement = getElementByTagNameNS(run, "br");
          const drawingElement = getElementByTagNameNS(run, "drawing");

          if (brElement) paragraphContent += "\n";

          if (textElement) {
            let runText = textElement.textContent || "";

            if (!runText.trim()) {
              runText = "&nbsp;";
            }

            runText = processUnderscorePlaceholders(runText);

            if (textElement.getAttributeNS(WORD_NS, "space") === "preserve") {
              runText = " " + runText + " ";
            }

            const rPr = getElementByTagNameNS(run, "rPr");
            const textStyles = getTextStyles(rPr);

            if (textStyles.length > 0) {
              const safeStyles = textStyles
                .map((s) => s.replace(/"/g, "'"))
                .join("; ");

              runText = `<span style="${safeStyles}">${runText}</span>`;
            }

            paragraphContent += runText;
          } else if (drawingElement) {
            const imageBlock = await processDrawing(
              drawingElement,
              relationships,
              images,
              paragraph,
            );
            if (imageBlock) {
              paragraphContent += `<img src="${imageBlock.data.url}" style="max-width: 100px; height: auto;" />`;
            }
          }
        } else if (child.localName === "hyperlink") {
          const linkText = processHyperlink(child, relationships);
          if (linkText) paragraphContent += linkText;
        } else if (child.localName === "br") {
          paragraphContent += "\n";
        }
      }

      if (paragraphStyles.length > 0) {
        const safePStyles = paragraphStyles
          .map((s) => s.replace(/"/g, "'"))
          .join("; ");

        paragraphContent = `<div style="${safePStyles}">${paragraphContent}</div>`;
      }

      cellContent += paragraphContent;
    }

    if (!cellContent.trim() && cell.textContent?.trim()) {
      cellContent = processUnderscorePlaceholders(cell.textContent);
    }

    return cellContent.trim() ? cellContent : "&nbsp;";
  } catch (error) {
    console.error("Error processing cell content:", error);
    return "&nbsp;";
  }
};

const getTextStyles = (rPr: Element | null): string[] => {
  const styles: string[] = [];

  if (!rPr) return styles;

  const rFonts = getElementByTagNameNS(rPr, "rFonts");
  if (rFonts) {
    const ascii = rFonts.getAttributeNS(WORD_NS, "ascii");
    const hAnsi = rFonts.getAttributeNS(WORD_NS, "hAnsi");
    const cs = rFonts.getAttributeNS(WORD_NS, "cs");
    const eastAsia = rFonts.getAttributeNS(WORD_NS, "eastAsia");

    const fontFamily = ascii || hAnsi || cs || eastAsia;
    if (fontFamily) {
      styles.push(`font-family: '${fontFamily}'`);
    }
  }

  const sz = getElementByTagNameNS(rPr, "sz");
  if (sz) {
    const size = sz.getAttributeNS(WORD_NS, "val");
    if (size) {
      styles.push(`font-size: ${parseInt(size) / 2}pt`);
    }
  }

  const color = getElementByTagNameNS(rPr, "color");
  if (color) {
    const val = color.getAttributeNS(WORD_NS, "val");
    if (val && val !== "auto") {
      styles.push(`color: #${val}`);
    }
  }

  const highlight = getElementByTagNameNS(rPr, "highlight");
  if (highlight) {
    const val = highlight.getAttributeNS(WORD_NS, "val");
    if (val) {
      const backgroundColor = getHighlightColor(val);
      styles.push(`background-color: ${backgroundColor}`);
    }
  }

  const shd = getElementByTagNameNS(rPr, "shd");
  if (shd) {
    const fill = shd.getAttributeNS(WORD_NS, "fill");
    if (fill && fill !== "auto") {
      styles.push(`background-color: #${fill}`);
    }
  }

  const vertAlign = getElementByTagNameNS(rPr, "vertAlign");
  if (vertAlign) {
    const val = vertAlign.getAttributeNS(WORD_NS, "val");
    switch (val) {
      case "superscript":
        styles.push("vertical-align: super");
        styles.push("font-size: smaller");
        break;
      case "subscript":
        styles.push("vertical-align: sub");
        styles.push("font-size: smaller");
        break;
    }
  }

  const strike = getElementByTagNameNS(rPr, "strike");
  const dstrike = getElementByTagNameNS(rPr, "dstrike");
  if (strike || dstrike) {
    styles.push("text-decoration: line-through");
  }

  if (getElementByTagNameNS(rPr, "b")) {
    styles.push("font-weight: bold");
  }

  if (getElementByTagNameNS(rPr, "i")) {
    styles.push("font-style: italic");
  }

  const u = getElementByTagNameNS(rPr, "u");
  if (u) {
    const val = u.getAttributeNS(WORD_NS, "val") || "single";
    const colorAttr = u.getAttributeNS(WORD_NS, "color");

    let underlineStyle = "underline";
    switch (val) {
      case "double":
        underlineStyle = "underline double";
        break;
      case "wave":
        underlineStyle = "underline wavy";
        break;
      default:
        underlineStyle = "underline";
    }

    if (colorAttr && colorAttr !== "auto") {
      styles.push(`text-decoration: ${underlineStyle} #${colorAttr}`);
    } else {
      styles.push(`text-decoration: ${underlineStyle}`);
    }
  }

  return styles;
};

const getCellBackgroundColor = (tcPr: Element | null): string | null => {
  if (tcPr) {
    const shd = getElementByTagNameNS(tcPr, "shd");
    if (shd) {
      return shd.getAttributeNS(WORD_NS, "fill") || null;
    }
  }
  return null;
};

const getCellTextColor = (tcPr: Element | null): string | null => {
  if (tcPr) {
    const color = getElementByTagNameNS(tcPr, "color");
    if (color) {
      return color.getAttributeNS(WORD_NS, "val") || null;
    }
  }
  return null;
};

const getRowStyles = (
  trPr: Element | null,
  rowIndex: number,
  conditionalFormatting: ReturnType<typeof getTableConditionalFormatting>,
): string[] => {
  const styles: string[] = [];

  if (!trPr) return styles;

  // Row background color
  const shd = getElementByTagNameNS(trPr, "shd");
  if (shd) {
    const fill = shd.getAttributeNS(WORD_NS, "fill");
    if (fill && fill !== "auto") {
      styles.push(`background-color: #${fill}`);
    }
  }
  if (conditionalFormatting.firstRow && rowIndex === 0) {
    styles.push("font-weight: bold");
  }

  return styles;
};

const getDetailedBorders = (borders: Element): string[] => {
  const styles: string[] = [];
  const sides = ["top", "right", "bottom", "left"];

  sides.forEach((side) => {
    const border = getElementByTagNameNS(borders, side);
    if (border) {
      const val = border.getAttributeNS(WORD_NS, "val");
      const size = border.getAttributeNS(WORD_NS, "sz");
      const color = border.getAttributeNS(WORD_NS, "color");

      if (val && val !== "none") {
        const width = size
          ? `${Math.max(1, Number.parseInt(size) / 8)}px`
          : "1px";
        const borderColor = color && color !== "auto" ? `#${color}` : "#000000";
        styles.push(`border-${side}: ${width} solid ${borderColor}`);
      }
    }
  });

  return styles;
};

const getTableConditionalFormatting = (
  tblLook: Element | null,
): {
  firstRow: boolean;
  lastRow: boolean;
  firstColumn: boolean;
  lastColumn: boolean;
  noHBand: boolean;
  noVBand: boolean;
} => {
  const defaultValue = {
    firstRow: false,
    lastRow: false,
    firstColumn: false,
    lastColumn: false,
    noHBand: false,
    noVBand: false,
  };

  if (!tblLook) return defaultValue;

  try {
    return {
      firstRow: tblLook.getAttributeNS(WORD_NS, "firstRow") === "1",
      lastRow: tblLook.getAttributeNS(WORD_NS, "lastRow") === "1",
      firstColumn: tblLook.getAttributeNS(WORD_NS, "firstColumn") === "1",
      lastColumn: tblLook.getAttributeNS(WORD_NS, "lastColumn") === "1",
      noHBand: tblLook.getAttributeNS(WORD_NS, "noHBand") === "1",
      noVBand: tblLook.getAttributeNS(WORD_NS, "noVBand") === "1",
    };
  } catch (error) {
    console.error("Error parsing table look:", error);
    return defaultValue;
  }
};

// const getTextStyles = (rPr: Element | null) => {
//   const styles: string[] = [];

//   if (!rPr) return styles;

//   // Font family
//   const rFonts = getElementByTagNameNS(rPr, "rFonts");
//   if (rFonts) {
//     const themeFont =
//       rFonts.getAttributeNS(WORD_NS, "asciiTheme") ||
//       rFonts.getAttributeNS(WORD_NS, "hAnsiTheme") ||
//       rFonts.getAttributeNS(WORD_NS, "cstheme");

//     if (themeFont) {
//       const fontFamily = mapThemeFont(themeFont);
//       styles.push(`font-family: ${fontFamily}`);
//     } else {
//       const fontFamily =
//         rFonts.getAttributeNS(WORD_NS, "ascii") ||
//         rFonts.getAttributeNS(WORD_NS, "hAnsi") ||
//         rFonts.getAttributeNS(WORD_NS, "cs");

//       if (fontFamily) {
//         styles.push(`font-family: "${fontFamily}, Arial, sans-serif"`);
//       }
//     }
//   }

//   // Font size
//   const sz = getElementByTagNameNS(rPr, "sz");
//   if (sz) {
//     const size = sz.getAttributeNS(WORD_NS, "val");
//     if (size) {
//       styles.push(`font-size: ${Number.parseInt(size) / 2}pt`);
//     }
//   }

//   // Text color
//   const color = getElementByTagNameNS(rPr, "color");
//   if (color) {
//     const val = color.getAttributeNS(WORD_NS, "val");
//     if (val && val !== "auto") {
//       styles.push(`color: #${val}`);
//     }
//   }

//   // Background color (highlight)
//   const highlight = getElementByTagNameNS(rPr, "highlight");
//   if (highlight) {
//     const val = highlight.getAttributeNS(WORD_NS, "val");
//     if (val) {
//       const backgroundColor = getHighlightColor(val);
//       styles.push(`background-color: ${backgroundColor}`);
//     }
//   }

//   // Background color (shading)
//   const shd = getElementByTagNameNS(rPr, "shd");
//   if (shd) {
//     const fill = shd.getAttributeNS(WORD_NS, "fill");
//     if (fill && fill !== "auto") {
//       styles.push(`background-color: #${fill}`);
//     }
//   }

//   // Vertical alignment (superscript/subscript)
//   const vertAlign = getElementByTagNameNS(rPr, "vertAlign");
//   if (vertAlign) {
//     const val = vertAlign.getAttributeNS(WORD_NS, "val");
//     switch (val) {
//       case "superscript":
//         styles.push("vertical-align: super");
//         styles.push("font-size: smaller");
//         break;
//       case "subscript":
//         styles.push("vertical-align: sub");
//         styles.push("font-size: smaller");
//         break;
//     }
//   }

//   // Strike through and double strike through
//   const strike = getElementByTagNameNS(rPr, "strike");
//   const dstrike = getElementByTagNameNS(rPr, "dstrike");
//   if (strike || dstrike) {
//     styles.push("text-decoration: line-through");
//   }

//   // Bold
//   if (getElementByTagNameNS(rPr, "b")) {
//     styles.push("font-weight: bold");
//   }

//   // Italic
//   if (getElementByTagNameNS(rPr, "i")) {
//     styles.push("font-style: italic");
//   }

//   // Underline
//   const u = getElementByTagNameNS(rPr, "u");
//   if (u) {
//     const val = u.getAttributeNS(WORD_NS, "val") || "single";
//     switch (val) {
//       case "double":
//         styles.push("text-decoration: underline double");
//         break;
//       case "wave":
//         styles.push("text-decoration: underline wavy");
//         break;
//       default:
//         styles.push("text-decoration: underline");
//     }
//   }

//   return styles;
// };

const getParagraphStyles = (pPr: any) => {
  const styles: string[] = [];

  if (!pPr) return styles;

  if (pPr.jc) {
    const alignment = pPr.jc["@_val"];
    switch (alignment?.toLowerCase()) {
      case "center":
        styles.push("text-align: center");
        styles.push("width: 100%");
        styles.push("display: block");
        break;
      case "right":
        styles.push("text-align: right");
        break;
      case "justify":
        styles.push("text-align: justify");
        break;
      default:
        styles.push("text-align: left");
    }
  }

  // Indentation
  if (pPr.ind) {
    const left = pPr.ind["@_left"];
    const right = pPr.ind["@_right"];
    const firstLine = pPr.ind["@_firstLine"];
    const hanging = pPr.ind["@_hanging"];

    if (left) styles.push(`margin-left: ${Number.parseInt(left) / 20}pt`);
    if (right) styles.push(`margin-right: ${Number.parseInt(right) / 20}pt`);
    if (firstLine)
      styles.push(`text-indent: ${Number.parseInt(firstLine) / 20}pt`);
    if (hanging)
      styles.push(`text-indent: -${Number.parseInt(hanging) / 20}pt`);
  }

  // Spacing
  if (pPr.spacing) {
    const before = pPr.spacing["@_before"];
    const after = pPr.spacing["@_after"];
    const line = pPr.spacing["@_line"];

    if (before) styles.push(`margin-top: ${Number.parseInt(before) / 20}pt`);
    if (after) styles.push(`margin-bottom: ${Number.parseInt(after) / 20}pt`);
    if (line) styles.push(`line-height: ${Number.parseInt(line) / 240}`);
  }

  return styles;
};

const getHighlightColor = (color: string): string => {
  const colorMap: { [key: string]: string } = {
    yellow: "#FFFF00",
    green: "#00FF00",
    cyan: "#00FFFF",
    magenta: "#FF00FF",
    blue: "#0000FF",
    red: "#FF0000",
    darkBlue: "#000080",
    darkCyan: "#008080",
    darkGreen: "#008000",
    darkMagenta: "#800080",
    darkRed: "#800000",
    darkYellow: "#808000",
    darkGray: "#808080",
    lightGray: "#C0C0C0",
    black: "#000000",
  };
  return colorMap[color] || color;
};

const mapThemeFont = (themeFont: string): string => {
  const themeFontMap: { [key: string]: string } = {
    minorHAnsi: "Arial, sans-serif",
    minorBidi: "Arial, sans-serif",
    minorEastAsia: "Arial, sans-serif",
    majorHAnsi: "Times New Roman, serif",
    majorBidi: "Times New Roman, serif",
    majorEastAsia: "Times New Roman, serif",
  };
  return themeFontMap[themeFont] || "Arial, sans-serif";
};
const getMimeType = (extension: string): string | null => {
  const mimeTypes: { [key: string]: string } = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    webp: "image/webp",
    tiff: "image/tiff",
    tif: "image/tiff",
  };

  return mimeTypes[extension] || null;
};

const getTableStyles = (tblPr: Element | null): { [key: string]: string } => {
  const styles: { [key: string]: string } = {
    width: "100%",
    borderCollapse: "collapse",
  };

  if (!tblPr) return styles;

  const tblBorders = getElementByTagNameNS(tblPr, "tblBorders");
  if (tblBorders) {
    const borderStyles = getDetailedBorders(tblBorders);
    borderStyles.forEach((style) => {
      const [property, value] = style.split(": ");
      styles[property] = value;
    });
  }

  const tblW = getElementByTagNameNS(tblPr, "tblW");
  if (tblW) {
    const width = tblW.getAttributeNS(WORD_NS, "w");
    const type = tblW.getAttributeNS(WORD_NS, "type");
    if (width && type) {
      if (type === "pct") {
        styles.width = `${Number.parseInt(width) / 50}%`;
      } else if (type === "dxa") {
        styles.width = `${Number.parseInt(width) / 20}pt`;
      }
    }
  }

  return styles;
};
const getCellStyles = (
  tcPr: Element | null,
  rowIndex: number,
  cellIndex: number,
  conditionalFormatting: ReturnType<typeof getTableConditionalFormatting>,
  rowStyles: string[],
  tableStyleConfig: any = {},
): string[] => {
  const styles: string[] = [];

  if (tableStyleConfig) {
    if (rowIndex === 0 && tableStyleConfig.firstRow) {
      Object.entries(tableStyleConfig.firstRow).forEach(([key, value]) => {
        styles.push(
          `${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${value}`,
        );
      });
    } else if (rowIndex % 2 === 0 && tableStyleConfig.evenRow) {
      Object.entries(tableStyleConfig.evenRow).forEach(([key, value]) => {
        styles.push(
          `${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${value}`,
        );
      });
    } else if (rowIndex % 2 === 1 && tableStyleConfig.oddRow) {
      Object.entries(tableStyleConfig.oddRow).forEach(([key, value]) => {
        styles.push(
          `${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${value}`,
        );
      });
    }

    if (tableStyleConfig.cell) {
      Object.entries(tableStyleConfig.cell).forEach(([key, value]) => {
        styles.push(
          `${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${value}`,
        );
      });
    }
  }

  if (!tcPr) return styles;

  // Cell borders
  const tcBorders = getElementByTagNameNS(tcPr, "tcBorders");
  if (tcBorders) {
    const borderStyles = getDetailedBorders(tcBorders);
    styles.push(...borderStyles);
  }

  // Cell background color
  const shd = getElementByTagNameNS(tcPr, "shd");
  if (shd) {
    const fill = shd.getAttributeNS(WORD_NS, "fill");
    if (fill && fill !== "auto") {
      styles.push(`background-color: #${fill}`);
    }
  }

  const tcMar = getElementByTagNameNS(tcPr, "tcMar");
  if (tcMar) {
    const top = getElementByTagNameNS(tcMar, "top");
    const bottom = getElementByTagNameNS(tcMar, "bottom");
    const left = getElementByTagNameNS(tcMar, "left");
    const right = getElementByTagNameNS(tcMar, "right");

    if (top) {
      const val = top.getAttributeNS(WORD_NS, "w");
      if (val) styles.push(`padding-top: ${parseInt(val) / 20}pt`);
    }
    if (bottom) {
      const val = bottom.getAttributeNS(WORD_NS, "w");
      if (val) styles.push(`padding-bottom: ${parseInt(val) / 20}pt`);
    }
    if (left) {
      const val = left.getAttributeNS(WORD_NS, "w");
      if (val) styles.push(`padding-left: ${parseInt(val) / 20}pt`);
    }
    if (right) {
      const val = right.getAttributeNS(WORD_NS, "w");
      if (val) styles.push(`padding-right: ${parseInt(val) / 20}pt`);
    }
  }

  if (conditionalFormatting.firstColumn && cellIndex === 0) {
    styles.push("font-weight: bold");
  }

  return styles;
};

const processVerticalMerges = (content: string[][]) => {
  const rowCount = content.length;
  const colCount = content[0].length;

  for (let col = 0; col < colCount; col++) {
    let currentRowspan = 1;
    let startRow = 0;

    for (let row = 0; row < rowCount; row++) {
      const cell = content[row][col];
      if (cell && cell.includes('rowspan="1"')) {
        if (currentRowspan > 1) {
          content[startRow][col] = content[startRow][col].replace(
            'rowspan="1"',
            `rowspan="${currentRowspan}"`,
          );
        }
        startRow = row;
        currentRowspan = 1;
      } else if (!cell) {
        currentRowspan++;
      }
    }

    if (currentRowspan > 1) {
      content[startRow][col] = content[startRow][col].replace(
        'rowspan="1"',
        `rowspan="${currentRowspan}"`,
      );
    }
  }
};

// ─── Wrapper: returns flat EditorJS data from a DOCX file ───────────────────
export async function parseDocxToEditorJS(file: File): Promise<{
  time: number;
  blocks: any[];
  version: string;
}> {
  const pages = await parseDocxWithJSZip(file);
  const allBlocks: any[] = [];

  Object.keys(pages)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((key) => {
      const page = (pages as any)[Number(key)];
      if (page?.main) allBlocks.push(...page.main.filter(Boolean));
    });

  return { time: Date.now(), blocks: allBlocks, version: "2.30.8" };
}

// ─── EditorJS blocks → HTML string ──────────────────────────────────────────
export function editorJsToHtml(data: { blocks: any[] }): string {
  if (!data?.blocks?.length) return "";

  const parts = data.blocks.map((block: any) => {
    const align = block.tunes?.alignment?.alignment || "left";
    const s = `style="text-align:${align}"`;

    switch (block.type) {
      case "header": {
        const lvl = block.data.level || 2;
        return `<h${lvl} ${s}>${block.data.text || ""}</h${lvl}>`;
      }
      case "paragraph":
        return `<p ${s}>${block.data.text || ""}</p>`;
      case "list": {
        const tag = block.data.style === "ordered" ? "ol" : "ul";
        const renderItems = (items: any[]): string =>
          items
            .map((item) => {
              const content =
                typeof item === "string" ? item : item.content || "";
              const nested =
                item.items?.length ? `<ul>${renderItems(item.items)}</ul>` : "";
              return `<li>${content}${nested}</li>`;
            })
            .join("");
        return `<${tag} ${s}>${renderItems(block.data.items || [])}</${tag}>`;
      }
      case "image": {
        const url = block.data.url || "";
        const cap = block.data.caption || "";
        return `<figure ${s}><img src="${url}" alt="${cap}" style="max-width:100%">${cap ? `<figcaption>${cap}</figcaption>` : ""}</figure>`;
      }
      case "table": {
        const rows: string[][] = block.data.content || [];
        const withHead = block.data.withHeadings;
        const trs = rows
          .map((row, ri) => {
            const cells = row
              .map((cell) => {
                const tag = withHead && ri === 0 ? "th" : "td";
                return `<${tag} style="border:1px solid #ccc;padding:6px 10px">${cell}</${tag}>`;
              })
              .join("");
            return `<tr>${cells}</tr>`;
          })
          .join("");
        return `<table style="border-collapse:collapse;width:100%">${trs}</table>`;
      }
      case "delimiter":
        return `<hr style="border:none;border-top:2px solid #ccc;margin:16px 0">`;
      case "quote":
        return `<blockquote style="border-left:4px solid #ccc;padding:4px 16px;margin:0 0 8px;font-style:italic">${block.data.text || ""}<footer style="font-style:normal;font-size:.85em;color:#666">${block.data.caption || ""}</footer></blockquote>`;
      default:
        return block.data?.text ? `<p ${s}>${block.data.text}</p>` : "";
    }
  });

  return `<div style="font-family:sans-serif;line-height:1.6;font-size:14px">${parts.filter(Boolean).join("\n")}</div>`;
}
