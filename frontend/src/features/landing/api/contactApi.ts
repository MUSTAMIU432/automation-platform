/**
 * The website's contact form, sent to the backend's `sendContactMessage`
 * (backend/contact). A `success: true` answer means the message was stored
 * for the team; anything else is the backend's own reason, with `field`
 * naming the input at fault in camelCase, or null for the whole form.
 */

import { graphqlClient } from '../../../graphql/client'

export interface ContactMessageValues {
  name: string
  email: string
  subject: string
  message: string
}

export interface ContactResult {
  success: boolean
  message: string
  field: keyof ContactMessageValues | null
}

const SEND_CONTACT_MESSAGE_MUTATION = `
  mutation SendContactMessage($input: SendContactMessageInput!) {
    sendContactMessage(input: $input) {
      success
      message
      field
    }
  }
`

export async function sendContactMessageRequest(
  values: ContactMessageValues,
): Promise<ContactResult> {
  const data = await graphqlClient.request<{ sendContactMessage: ContactResult }>(
    SEND_CONTACT_MESSAGE_MUTATION,
    { input: values },
  )
  return data.sendContactMessage
}
