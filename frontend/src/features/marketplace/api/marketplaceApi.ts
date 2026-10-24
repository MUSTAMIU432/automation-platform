/**
 * The marketplace: ideas the platform publishes, unlocked by a payment an administrator
 * confirms. Refusals are payloads (`success: false` and the field they name); only a
 * transport failure rejects. What is shown to whom is the server's decision - an idea's
 * `documentation` and `document` are null until the reader has paid.
 *
 * A document's bytes do not travel through GraphQL: they are uploaded and downloaded at
 * `/marketplace/ideas/<id>/document/` with the bearer token, like idea attachments.
 */

import { graphqlClient } from '../../../graphql/client'
import { getAccessToken } from '../../../graphql/tokenStore'
import { env } from '../../../lib/env'

export type PaymentKind = 'mobile_money' | 'bank'

/**
 * `push`: a payment prompt on the buyer's phone; `card`: Visa or Mastercard through the
 * gateway; `manual`: the buyer sends the money and an administrator confirms it.
 */
export type Collection = 'push' | 'card' | 'manual'

export interface PaymentMethod {
  id: string
  kind: PaymentKind
  collection: Collection
  provider: string
  accountName: string
  accountNumber: string
  instructions: string
  isActive: boolean
}

/** `awaiting`: a prompt is on the buyer's phone; `failed`: it was not approved in time. */
export type PurchaseStatus = 'awaiting' | 'pending' | 'confirmed' | 'rejected' | 'failed'

export interface Purchase {
  id: string
  ideaId: string
  ideaTitle: string
  buyerName: string
  buyerEmail: string
  amount: number
  currency: string
  method: PaymentMethod
  payerName: string
  payerAccount: string
  transactionReference: string
  status: PurchaseStatus
  reviewNote: string
  decidedByName: string | null
  decidedAt: string | null
  createdAt: string
}

export type MarketIdeaStatus = 'draft' | 'published' | 'unpublished'

/** The document an administrator uploaded for buyers to download. */
export interface MarketDocument {
  filename: string
  contentType: string
  size: number
  uploadedAt: string | null
  downloadPath: string
}

/** What the document is - never its content - shown before buying. */
export interface MarketDocumentInfo {
  filename: string
  format: 'PDF' | 'Word'
  size: number
}

export interface MarketIdea {
  id: string
  title: string
  summary: string
  price: number
  currency: string
  status: MarketIdeaStatus
  publishedAt: string | null
  updatedAt: string
  hasAccess: boolean
  /** The full documentation: null until the reader has paid for it. */
  documentation: string | null
  /** Whether a document comes with the idea; shown to everyone. */
  hasDocument: boolean
  /** The uploaded document: null until the reader has paid for it. */
  document: MarketDocument | null
  /** The document's name, format and size; shown to everyone. */
  documentInfo: MarketDocumentInfo | null
  /** Whether written documentation comes with the idea; shown to everyone. */
  hasWrittenDocumentation: boolean
  /** The reader's latest payment for this idea. */
  myPurchase: Purchase | null
  /** Administrators only: how many buyers have paid. */
  purchasesConfirmed: number
  /** Administrators only: what confirmed payments add up to, in whole TZS. */
  revenue: number
  /** Administrators only: payments waiting for confirmation. */
  paymentsWaiting: number
}

export interface Outcome {
  success: boolean
  message: string
  field: string | null
}

export type Payload<K extends string, T> = Outcome & { [P in K]: T | null }

export interface MarketIdeaInput {
  title: string
  summary: string
  documentation: string
  price: number
}

export interface PaymentMethodInput {
  kind: PaymentKind
  collection: Collection
  provider: string
  accountName: string
  accountNumber: string
  instructions: string
}

const METHOD = 'id kind collection provider accountName accountNumber instructions isActive'
const PURCHASE = `id ideaId ideaTitle buyerName buyerEmail amount currency method { ${METHOD} }
  payerName payerAccount transactionReference status reviewNote decidedByName decidedAt createdAt`
const DOCUMENT = 'filename contentType size uploadedAt downloadPath'
const IDEA = `id title summary price currency status publishedAt updatedAt hasAccess documentation
  hasDocument document { ${DOCUMENT} } documentInfo { filename format size }
  hasWrittenDocumentation purchasesConfirmed revenue paymentsWaiting myPurchase { ${PURCHASE} }`

async function query<T>(document: string, root: string, variables = {}): Promise<T> {
  const data = await graphqlClient.request<Record<string, T>>(document, variables)
  return data[root]
}

/** One mutation as a function: `root(args) { success message field <selection> }`. */
function action<K extends string, T>(root: string, decl: string, args: string, selection: string) {
  const document = `mutation (${decl}) { ${root}(${args}) { success message field ${selection} } }`
  return async (variables: Record<string, unknown>): Promise<Payload<K, T>> => {
    const data = await graphqlClient.request<Record<string, Payload<K, T>>>(document, variables)
    return data[root]
  }
}

// --- for everyone signed in ---------------------------------------------------------------

export const marketIdeasRequest = () =>
  query<MarketIdea[]>(`query { marketIdeas { ${IDEA} } }`, 'marketIdeas')
export const marketIdeaRequest = (id: string) =>
  query<MarketIdea | null>(`query($id: ID!) { marketIdea(id: $id) { ${IDEA} } }`, 'marketIdea', {
    id,
  })
export const paymentMethodsRequest = () =>
  query<PaymentMethod[]>(`query { marketPaymentMethods { ${METHOD} } }`, 'marketPaymentMethods')

/** Send a payment prompt to the buyer's phone; the purchase then waits for their PIN. */
export const startPushPayment = action<'purchase', Purchase>(
  'startMarketPushPayment',
  '$input: MarketPushPaymentInput!',
  'input: $input',
  `purchase { ${PURCHASE} }`,
)
/** One of the reader's own payments, brought up to date with the gateway. */
export const marketPurchaseRequest = (id: string) =>
  query<Purchase | null>(
    `query($id: ID!) { marketPurchase(id: $id) { ${PURCHASE} } }`,
    'marketPurchase',
    { id },
  )
/**
 * Pay by card with a token from the gateway's tokenizer - never the card's own details,
 * which do not travel to this server.
 */
export const startCardPayment = action<'purchase', Purchase>(
  'startMarketCardPayment',
  '$input: MarketCardPaymentInput!',
  'input: $input',
  `purchase { ${PURCHASE} }`,
)
/** Which card tokenizer to use (`utils/cardTokenizers`), or null when cards are off. */
export const cardTokenizerRequest = () =>
  query<string | null>('query { marketCardTokenizer }', 'marketCardTokenizer')
export const pushAvailableRequest = () =>
  query<boolean>('query { marketPushAvailable }', 'marketPushAvailable')

export const submitPayment = action<'purchase', Purchase>(
  'submitMarketPayment',
  '$input: MarketPaymentInput!',
  'input: $input',
  `purchase { ${PURCHASE} }`,
)

// --- administrators -------------------------------------------------------------------------

export const adminMarketIdeasRequest = () =>
  query<MarketIdea[]>(`query { adminMarketIdeas { ${IDEA} } }`, 'adminMarketIdeas')
export const adminPaymentMethodsRequest = () =>
  query<PaymentMethod[]>(`query { adminPaymentMethods { ${METHOD} } }`, 'adminPaymentMethods')
export const marketPaymentsRequest = (status?: PurchaseStatus) =>
  query<Purchase[]>(
    `query($status: String) { marketPayments(status: $status) { ${PURCHASE} } }`,
    'marketPayments',
    { status: status ?? null },
  )

export const createMarketIdea = action<'idea', MarketIdea>(
  'createMarketIdea',
  '$input: MarketIdeaInput!',
  'input: $input',
  `idea { ${IDEA} }`,
)
export const updateMarketIdea = action<'idea', MarketIdea>(
  'updateMarketIdea',
  '$id: ID!, $input: MarketIdeaInput!',
  'id: $id, input: $input',
  `idea { ${IDEA} }`,
)
export const publishMarketIdea = action<'idea', MarketIdea>(
  'publishMarketIdea',
  '$id: ID!',
  'id: $id',
  `idea { ${IDEA} }`,
)
export const unpublishMarketIdea = action<'idea', MarketIdea>(
  'unpublishMarketIdea',
  '$id: ID!',
  'id: $id',
  `idea { ${IDEA} }`,
)
export const createPaymentMethod = action<'method', PaymentMethod>(
  'createPaymentMethod',
  '$input: PaymentMethodInput!',
  'input: $input',
  `method { ${METHOD} }`,
)
export const updatePaymentMethod = action<'method', PaymentMethod>(
  'updatePaymentMethod',
  '$id: ID!, $input: PaymentMethodInput!',
  'id: $id, input: $input',
  `method { ${METHOD} }`,
)
export const setPaymentMethodActive = action<'method', PaymentMethod>(
  'setPaymentMethodActive',
  '$id: ID!, $active: Boolean!',
  'id: $id, active: $active',
  `method { ${METHOD} }`,
)
export const confirmPayment = action<'purchase', Purchase>(
  'confirmMarketPayment',
  '$id: ID!, $note: String',
  'id: $id, note: $note',
  `purchase { ${PURCHASE} }`,
)
export const rejectPayment = action<'purchase', Purchase>(
  'rejectMarketPayment',
  '$id: ID!, $note: String!',
  'id: $id, note: $note',
  `purchase { ${PURCHASE} }`,
)

// --- enquiries: buyers asking the team about an idea -----------------------------------------

export interface EnquiryMessage {
  id: string
  body: string
  fromTeam: boolean
  authorName: string
  createdAt: string
}

/** A buyer's conversation with the marketplace team about one idea. */
export interface Enquiry {
  id: string
  ideaId: string
  ideaTitle: string
  buyerName: string
  buyerEmail: string
  /** The buyer spoke last: the team owes an answer. */
  awaitingReply: boolean
  latestMessageAt: string
  messages: EnquiryMessage[]
}

const ENQUIRY = `id ideaId ideaTitle buyerName buyerEmail awaitingReply latestMessageAt
  messages { id body fromTeam authorName createdAt }`

export const myEnquiryRequest = (ideaId: string) =>
  query<Enquiry | null>(
    `query($ideaId: ID!) { myMarketEnquiry(ideaId: $ideaId) { ${ENQUIRY} } }`,
    'myMarketEnquiry',
    { ideaId },
  )
export const sendEnquiry = action<'enquiry', Enquiry>(
  'sendMarketEnquiry',
  '$ideaId: ID!, $body: String!',
  'ideaId: $ideaId, body: $body',
  `enquiry { ${ENQUIRY} }`,
)
/** Administrators: every conversation, those waiting for an answer first. */
export const marketEnquiriesRequest = () =>
  query<Enquiry[]>(`query { marketEnquiries { ${ENQUIRY} } }`, 'marketEnquiries')
export const replyEnquiry = action<'enquiry', Enquiry>(
  'replyMarketEnquiry',
  '$id: ID!, $body: String!',
  'id: $id, body: $body',
  `enquiry { ${ENQUIRY} }`,
)

// --- the document's bytes ------------------------------------------------------------------

export interface DocumentOutcome extends Outcome {
  document: MarketDocument | null
}

async function documentRequest(
  ideaId: string,
  method: 'POST' | 'DELETE',
  body?: FormData,
): Promise<DocumentOutcome> {
  const token = getAccessToken()
  const response = await fetch(`${env.apiBaseUrl}/marketplace/ideas/${ideaId}/document/`, {
    method,
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  })
  // Not every failure is our JSON (a proxy's 413 or 502, say), so a bad body is reported.
  let payload: Partial<DocumentOutcome> = {}
  try {
    payload = await response.json()
  } catch {
    /* handled below */
  }
  return {
    success: response.ok && payload.success === true,
    message: payload.message ?? 'We could not save the document. Please try again.',
    field: payload.field ?? null,
    document: payload.document ?? null,
  }
}

/** Administrator: upload the idea's document (PDF or Word .docx), replacing any earlier one. */
export function uploadMarketDocument(ideaId: string, file: File): Promise<DocumentOutcome> {
  const body = new FormData()
  body.append('file', file)
  return documentRequest(ideaId, 'POST', body)
}

/** Administrator: take the document off the idea. */
export function removeMarketDocument(ideaId: string): Promise<DocumentOutcome> {
  return documentRequest(ideaId, 'DELETE')
}

/** How long a download's blob URL is kept; the same 40 s the attachment downloads use. */
const BLOB_URL_LIFETIME_MS = 40_000

/**
 * The document's bytes, fetched with the bearer token - a plain link or an `<iframe src>`
 * cannot carry it. Typed by the server's own `Content-Type`.
 */
export async function fetchMarketDocument(document_: MarketDocument): Promise<Blob> {
  const token = getAccessToken()
  const response = await fetch(`${env.apiBaseUrl}${document_.downloadPath}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error('Could not fetch the document.')
  return response.blob()
}

/** Download the document: fetched, then handed to the browser as a blob. */
export async function downloadMarketDocument(document_: MarketDocument): Promise<void> {
  const url = URL.createObjectURL(await fetchMarketDocument(document_))
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = document_.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_LIFETIME_MS)
  }
}

/** The file types an administrator may upload as the document. */
export const DOCUMENT_ACCEPT = '.pdf,.docx'

/** "255712345678" as a Tanzanian reads it: "0712 345 678". */
export function formatPhone(msisdn: string): string {
  const local = msisdn.startsWith('255') ? `0${msisdn.slice(3)}` : msisdn
  return local.length === 10 ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : local
}

/** "TZS 50,000". */
export function formatPrice(amount: number, currency = 'TZS'): string {
  return amount === 0 ? 'Free' : `${currency} ${amount.toLocaleString('en-US')}`
}

export const PAYMENT_KIND_WORDS: Record<PaymentKind, string> = {
  mobile_money: 'Mobile money',
  bank: 'Bank transfer',
}
