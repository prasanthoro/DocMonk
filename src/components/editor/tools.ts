// All imports are dynamically loaded inside getEditorTools() to prevent SSR crashes

export async function getEditorTools() {
  const [
    { default: InlineCode },
    { default: EditorjsList },
    { default: Paragraph },
    { default: Marker },
    { default: Underline },
    { TextColorTool },
    { default: ChangeCase },
    { default: IndentTune },
    { default: Delimiter },
    { default: CustomTableTool },
    { default: AlignmentTune },
    { CustomHeaderTool },
    { HorizontalLineTool },
    { default: SimpleImageTool },
    { default: DiffBlockTool },
  ] = await Promise.all([
    import("@editorjs/inline-code"),
    import("@editorjs/list"),
    import("@editorjs/paragraph"),
    // @ts-ignore
    import("@editorjs/marker"),
    import("@editorjs/underline"),
    import("./TextStyleTools"),
    // @ts-ignore
    import("editorjs-change-case"),
    import("editorjs-indent-tune"),
    import("@editorjs/delimiter"),
    import("./CustomTableTool"),
    import("./CustomAlignmentTool"),
    import("./CustomHeaderTool"),
    import("./CustomHorizontalLineTool"),
    import("./SimpleImageTool"),
    import("./DiffBlockTool"),
  ]);

  return {
    header: {
      class: CustomHeaderTool,
      inlineToolbar: true,
      tunes: ["alignment", "indentTune"],
      config: {
        placeholder: "Enter a header",
        levels: [1, 2, 3, 4, 5, 6],
        defaultLevel: 2,
        preserveBlank: true,
      },
    },
    paragraph: {
      class: Paragraph as any,
      inlineToolbar: true,
      tunes: ["alignment", "indentTune"],
      config: {
        preserveBlank: true,
      },
    },
    list: {
      class: EditorjsList as any,
      inlineToolbar: true,
      tunes: ["alignment"],
      config: {
        defaultStyle: "unordered",
      },
    },
    image: {
      class: SimpleImageTool,
      inlineToolbar: false,
    },
    table: {
      class: CustomTableTool,
      inlineToolbar: false,
      config: {},
    },
    delimiter: {
      class: Delimiter as any,
      tunes: ["alignment", "indentTune"],
    },
    horizontalLine: {
      class: HorizontalLineTool,
      tunes: ["indentTune"],
      config: {
        defaultStyle: "solid",
        defaultThickness: 2,
        defaultColor: "#000000",
        defaultAlignment: "center",
        preserveBlank: true,
      },
    },
    textStyles: {
      class: TextColorTool,
    },
    underline: Underline,
    changeCase: {
      class: ChangeCase as any,
      config: {
        showLocaleOption: true,
        locale: "en",
      },
    },
    indentTune: {
      class: IndentTune as any,
    },
    marker: {
      class: Marker as any,
    },
    inlineCode: {
      class: InlineCode as any,
    },
    alignment: {
      class: AlignmentTune as any,
    },
    diffBlock: {
      class: DiffBlockTool,
      config: {},
    },
  };
}
