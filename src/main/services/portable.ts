/**
 * Crow Companion only ships as a portable Windows build: the single-file exe (electron-builder's
 * portable target sets PORTABLE_EXECUTABLE_DIR) or the unzipped folder (resources/crow-portable is
 * the marker). Either way the data, including Tallow's downloaded model, lives in a
 * "CrowCompanion-Data" folder next to the exe.
 */
import * as fs from 'fs'
import * as path from 'path'

export const PORTABLE_DATA_DIR = 'CrowCompanion-Data'

function hasMarker(): boolean {
  try {
    return !!process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'crow-portable'))
  } catch {
    return false
  }
}

/** The folder the user put the app in, or null for a normal (non-portable) run */
export function portableRoot(): string | null {
  if (process.platform !== 'win32') return null
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR
  if (hasMarker()) return path.dirname(process.execPath)
  return null
}

export function isPortable(): boolean {
  return portableRoot() !== null
}
