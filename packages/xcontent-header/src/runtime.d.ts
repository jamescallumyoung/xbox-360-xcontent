// The only runtime globals this package uses beyond ECMAScript 2024.
//
// They're declared here, rather than through the "dom" lib or Node's types, so
// that library code can't use any other browser- or Node-only global by mistake.
// Every runtime the package supports (browsers, Node 22+, Deno and Bun) provides
// both.

declare global {
  /** Decodes text, used for every text field in a header. */
  interface TextDecoder {
    decode(input?: Uint8Array): string
  }

  var TextDecoder: {
    prototype: TextDecoder
    new (label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean }): TextDecoder
  }

  /** Web Crypto, used only by verifyHeaderAsync to hash the header. */
  var crypto: {
    readonly subtle: {
      digest(algorithm: 'SHA-1', data: Uint8Array): Promise<ArrayBuffer>
    }
  }
}

export {}
