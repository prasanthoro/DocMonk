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
 * Handles HTML content encoded with encodeBase64.
 */
export function decodeBase64(b64: string): string {
  try {
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(b64), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
  } catch {
    try {
      return atob(b64)
    } catch {
      return ''
    }
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
