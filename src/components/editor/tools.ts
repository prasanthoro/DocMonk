import InlineCode from "@editorjs/inline-code";
import EditorjsList from "@editorjs/list";
import Paragraph from "@editorjs/paragraph";
// @ts-ignore
import Marker from "@editorjs/marker";
import Underline from "@editorjs/underline";
import { TextColorTool } from "./TextStyleTools";
// @ts-ignore
import ChangeCase from "editorjs-change-case";
import IndentTune from "editorjs-indent-tune";
import Delimiter from "@editorjs/delimiter";
import CustomTableTool from "./CustomTableTool";
import AlignmentTune from "./CustomAlignmentTool";
import { CustomHeaderTool } from "./CustomHeaderTool";
import { HorizontalLineTool } from "./CustomHorizontalLineTool";
import SimpleImageTool from "./SimpleImageTool";
import DiffBlockTool from "./DiffBlockTool";

export function getEditorTools() {
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
      class: Paragraph,
      inlineToolbar: true,
      tunes: ["alignment", "indentTune"],
      config: {
        preserveBlank: true,
      },
    },
    list: {
      class: EditorjsList,
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
      class: Delimiter,
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
      class: ChangeCase,
      config: {
        showLocaleOption: true,
        locale: "en",
      },
    },
    indentTune: {
      class: IndentTune,
    },
    marker: {
      class: Marker,
    },
    inlineCode: {
      class: InlineCode,
    },
    alignment: {
      class: AlignmentTune,
    },
    diffBlock: {
      class: DiffBlockTool,
      config: {},
    },
  };
}
