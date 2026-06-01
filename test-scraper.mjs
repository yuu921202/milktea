// Run with: node test-scraper.mjs
import { generateKeyPair, exportJWK } from 'jose'

const MERCARI_AUTH_URL = 'https://api.mercari.jp/auth/token/refresh'
const MERCARI_SEARCH_URL = 'https://api.mercari.jp/v2/entities:search'

function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Mercari's exact DPoP proof format (reverse-engineered from their JS bundle)
async function createMercariDpopProof(privateKey, publicKeyJwk, method, url, sessionUuid) {
  const header = JSON.stringify({ typ: 'dpop+jwt', alg: 'ES256', jwk: publicKeyJwk })
  const payload = JSON.stringify({
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomUUID(),
    htu: url,
    htm: method,
    uuid: sessionUuid,   // Mercari-specific field
  })

  const enc = (s) => new TextEncoder().encode(s)
  const signingInput = base64url(enc(header)) + '.' + base64url(enc(payload))

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    enc(signingInput)
  )
  return signingInput + '.' + base64url(sig)
}

const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
const rawJwk = await exportJWK(publicKey)
delete rawJwk.d

const sessionUuid = crypto.randomUUID()
console.log('Session UUID:', sessionUuid)

console.log('Getting Mercari anonymous token...')
const dpop = await createMercariDpopProof(privateKey, rawJwk, 'POST', MERCARI_AUTH_URL, sessionUuid)

const res = await fetch(MERCARI_AUTH_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Platform': 'web',
    'DPoP': dpop,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': 'https://jp.mercari.com',
  },
  body: JSON.stringify({ grant_type: 'anonymous', uuid: sessionUuid }),
})

console.log('Status:', res.status)
const nonce = res.headers.get('dpop-nonce') || res.headers.get('DPoP-Nonce')
console.log('DPoP-Nonce:', nonce)
const text = await res.text()
console.log('Response:', text.slice(0, 400))
