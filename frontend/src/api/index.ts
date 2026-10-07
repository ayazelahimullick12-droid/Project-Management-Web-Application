/**
 * The api layer: the only way screens read or change data.
 *
 * Grouped like the real backend's endpoints. Today every function works on the browser copy
 * of the data; later each one becomes an HTTP call to FastAPI with the same name and shape.
 */
import * as admin from './admin'
import * as changes from './changes'
import * as chat from './chat'
import * as documents from './documents'
import * as intake from './intake'
import * as notifications from './notifications'
import * as projects from './projects'
import * as testing from './testing'

export const api = { admin, changes, chat, documents, intake, notifications, projects, testing }
export { ApiError } from './core'
