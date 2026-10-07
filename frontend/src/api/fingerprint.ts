/**
 * SHA-256 fingerprints for signed versions (SPEC.md "Signing").
 *
 * The real app hashes the exact PDF bytes. The prototype hashes the stored copy of the
 * document text and the signature page text, using the browser's built-in Web Crypto.
 */
import type { Signature } from '../types'

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The document exactly as signed, in a fixed text form. */
export function canonicalDocument(snapshot: Signature['snapshot']): string {
  return [`${snapshot.title}`, `Version ${snapshot.versionNumber}`, '', ...snapshot.sections.flatMap((s) => [`## ${s.title}`, s.content.trim(), ''])].join('\n')
}

export function signaturePageText(args: { title: string; versionNumber: number; signer: string; actingFor?: string; signedAt: string; ip: string; method: string; docHash: string }): string {
  return [
    'CERTIFICATE OF COMPLETION — electronic approval record',
    `Document: ${args.title}, version ${args.versionNumber}`,
    `Signed by: ${args.signer}${args.actingFor ? ` (deputy, acting for ${args.actingFor})` : ''}`,
    `Signed at: ${args.signedAt}`,
    `IP address: ${args.ip}`,
    `Re-authentication: ${args.method === 'password' ? 'password' : 'email one-time code'}`,
    `Document fingerprint (SHA-256): ${args.docHash}`,
  ].join('\n')
}
