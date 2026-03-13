/**
 * Safely encode a UTF-8 string to base64.
 * Works around the limitation that btoa() only handles Latin-1.
 */
export function encodeBase64(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)))
  } catch {
    return btoa(str)
  }
}

/**
 * Decode a base64 string back to UTF-8 text.
 * Uses native operations for efficient decoding.
 */
export function decodeBase64(b64: string): string {
  try {
    const binaryStr = atob(b64)
    // Use native Uint8Array.from instead of JS loop for better performance
    const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    try {
      return atob(b64)
    } catch {
      return ''
    }
  }
}

/**
 * Decode base64 asynchronously without blocking the main thread.
 * Uses fetch() with a data URL — the browser decodes base64 natively in C++,
 * completely off the main thread. No manual chunking or yielding needed.
 * Falls back to sync decodeBase64() if fetch fails (e.g. SSR).
 */
export async function decodeBase64Async(b64: string): Promise<string> {
  try {
    const res = await fetch(`data:text/plain;charset=utf-8;base64,${b64}`)
    return await res.text()
  } catch {
    return decodeBase64(b64)
  }
}

/**
 * Read a File as a data URL, then return just the base64 portion.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] || result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
