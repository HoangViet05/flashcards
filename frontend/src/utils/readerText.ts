const TIMESTAMP_ONLY_LINE = /^[ \t]*(?:\*{1,2}|_{1,2})?\s*(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?\s*(?:\*{1,2}|_{1,2})?[ \t]*(?:\r?\n|$)/gm

/** Removes standalone timestamps copied from a video transcript. */
export const stripTranscriptTimestamps = (text: string) => text.replace(TIMESTAMP_ONLY_LINE, '')

export const sentenceParts = (text: string) => text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text]
export const splitSentences = (text: string) => sentenceParts(text).map(sentence => sentence.trim()).filter(Boolean)
