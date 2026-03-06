import type { API, BlockToolData } from '@editorjs/editorjs'

export interface ConstructorArgs {
  data: BlockToolData
  api: API
  config?: Record<string, any>
  readOnly: boolean
}

export interface ToolConfig extends ConstructorArgs {
  data: BlockToolData
  api: API
}

export interface PasteEvent {
  type: 'tag' | 'file' | 'pattern'
  detail: {
    data?: any
    file?: File
  }
}

export interface ImageData {
  url: string
  caption: string
  withBorder: boolean
  withBackground: boolean
  stretched: boolean
}

export interface ListData {
  style: 'ordered' | 'unordered'
  items: string[]
}
