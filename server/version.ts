// The app version from package.json (bundled into the server build) and the User-Agent sent to every API.
import { version } from '../package.json'

export const VERSION: string = version
export const USER_AGENT = `Paperfox/${VERSION}`
