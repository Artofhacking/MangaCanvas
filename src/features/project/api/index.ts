export { episodesApi } from './episodes'
export { scenesApi } from './scenes'
export { charactersApi } from './characters'
export { objectsApi } from './objects'
export { workflowsApi } from './workflows'
export type { ApiResponse } from './shared'

import { charactersApi } from './characters'
import { episodesApi } from './episodes'
import { objectsApi } from './objects'
import { scenesApi } from './scenes'
import { workflowsApi } from './workflows'

export const projectApi = {
  episodes: episodesApi,
  scenes: scenesApi,
  characters: charactersApi,
  objects: objectsApi,
  workflows: workflowsApi,
}

export default projectApi
