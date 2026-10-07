/** New unique ids for records created in the browser, e.g. "cmt-lx3f2a9k-4". */
let counter = 0

export function newId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}-${counter}`
}
