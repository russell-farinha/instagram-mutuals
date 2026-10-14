export type ExportErrorKind =
  | 'not-an-export'
  | 'html-format'
  | 'missing-followers'
  | 'missing-following'
  | 'unreadable-zip'
  | 'invalid-json'
  | 'unexpected-shape'

const messages: Record<ExportErrorKind, string> = {
  'not-an-export':
    "We couldn't find Instagram follower or following files here. Select your Instagram data export, or the followers_and_following folder from it.",
  'html-format':
    'It looks like this export was requested in HTML format. Request a new one and choose JSON.',
  'missing-followers':
    'We found your export, but the list of your followers is missing. Request a new JSON export from Instagram and try again.',
  'missing-following':
    'We found your export, but the list of accounts you follow is missing. Request a new JSON export from Instagram and try again.',
  'unreadable-zip':
    "We couldn't open that ZIP file. Download the Instagram export again and make sure the download finished.",
  'invalid-json':
    "One of the Instagram export files isn't valid JSON. Request a new JSON export from Instagram and try again.",
  'unexpected-shape':
    "This export's follower data has an unfamiliar format. Request a fresh JSON export from Instagram and try again.",
}

export class ExportError extends Error {
  readonly name = 'ExportError'

  constructor(readonly kind: ExportErrorKind) {
    super(messages[kind])
  }
}

export function exportErrorMessage(kind: ExportErrorKind): string {
  return messages[kind]
}
