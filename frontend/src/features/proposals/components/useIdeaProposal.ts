import { proposalStateRequest } from '../api/proposalsApi'
import { useAsyncKey } from './useAsyncKey'

/** The proposal's state for one idea, fetched once for every part of the page that shows it. */
export function useIdeaProposal(ideaId: string) {
  return useAsyncKey(() => proposalStateRequest(ideaId), ideaId)
}
