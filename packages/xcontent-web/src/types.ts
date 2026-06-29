import type { SigningMagic, ContentTypeName } from 'xcontent'

export type TitleXContent = {
  titleId: number
  titleIdHex: string
  displayName: string
  signingTypes: Set<SigningMagic>
  contentTypes: Set<ContentTypeName>
  gameIsPresent: boolean
  hasTitleUpdate: boolean
  hasDlc: boolean
  hasSaves: boolean
  hasOtherContent: boolean
  hasCorruptContent: boolean
  hasInternalError: boolean
}

export type PartitionScanResult = {
  titles: TitleXContent[]
}
