import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('.', import.meta.url))

function load(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(dir, 'fixtures', name)).buffer)
}

export const godDeadIslandRiptide = load('god-dead-island-riptide')
export const godSouthParkTsot = load('god-south-park-tsot')
export const dlcHaloWars = load('dlc-halo-wars')
export const dlcHaloReachAnniversary = load('dlc-halo-reach-anniversary')
