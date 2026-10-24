import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderAdminPage } from '../../test/renderAdmin'
import { AdminMarketIdeasPage } from '../administration/pages/AdminMarketIdeasPage'
import { AdminMarketPaymentsPage } from '../administration/pages/AdminMarketPaymentsPage'
import { AdminMarketEnquiriesPage } from '../administration/pages/AdminMarketEnquiriesPage'
import { AdminPaymentMethodsPage } from '../administration/pages/AdminPaymentMethodsPage'
import type * as Api from './api/marketplaceApi'
import { MarketIdeaPage } from './components/MarketIdeaPage'
import { MarketplacePage } from './components/MarketplacePage'

vi.mock('./api/marketplaceApi', async (importOriginal) => ({
  ...(await importOriginal<typeof Api>()),
  marketIdeasRequest: vi.fn(),
  marketIdeaRequest: vi.fn(),
  paymentMethodsRequest: vi.fn(),
  submitPayment: vi.fn(),
  adminMarketIdeasRequest: vi.fn(),
  adminPaymentMethodsRequest: vi.fn(),
  marketPaymentsRequest: vi.fn(),
  createMarketIdea: vi.fn(),
  updateMarketIdea: vi.fn(),
  publishMarketIdea: vi.fn(),
  unpublishMarketIdea: vi.fn(),
  createPaymentMethod: vi.fn(),
  updatePaymentMethod: vi.fn(),
  setPaymentMethodActive: vi.fn(),
  confirmPayment: vi.fn(),
  rejectPayment: vi.fn(),
  uploadMarketDocument: vi.fn(),
  removeMarketDocument: vi.fn(),
  downloadMarketDocument: vi.fn(),
  fetchMarketDocument: vi.fn(),
  startPushPayment: vi.fn(),
  marketPurchaseRequest: vi.fn(),
  pushAvailableRequest: vi.fn(),
  myEnquiryRequest: vi.fn(),
  sendEnquiry: vi.fn(),
  marketEnquiriesRequest: vi.fn(),
  replyEnquiry: vi.fn(),
  startCardPayment: vi.fn(),
  cardTokenizerRequest: vi.fn(),
}))
// jsdom cannot lay out a Word document; the test only needs to see it was handed over.
vi.mock('docx-preview', () => ({
  renderAsync: vi.fn(async (_blob: Blob, container: HTMLElement) => {
    container.textContent = 'Page one of the plan'
  }),
}))
const api = vi.mocked(await import('./api/marketplaceApi'))

const OK = { success: true, message: 'Done.', field: null }

const MPESA: Api.PaymentMethod = {
  id: '1',
  kind: 'mobile_money',
  collection: 'manual',
  provider: 'M-Pesa',
  accountName: 'Mustanet Ltd',
  accountNumber: '0754 000 000',
  instructions: 'Lipa na M-Pesa.',
  isActive: true,
}

function purchase(overrides: Partial<Api.Purchase> = {}): Api.Purchase {
  return {
    id: '7',
    ideaId: '3',
    ideaTitle: 'Automated tax collection',
    buyerName: 'Buyer Person',
    buyerEmail: 'buyer@example.com',
    amount: 50000,
    currency: 'TZS',
    method: MPESA,
    payerName: 'Buyer Person',
    payerAccount: '0712 345 678',
    transactionReference: 'QK7H2X9P1A',
    status: 'pending',
    reviewNote: '',
    decidedByName: null,
    decidedAt: null,
    createdAt: '2026-10-17T10:00:00Z',
    ...overrides,
  }
}

function idea(overrides: Partial<Api.MarketIdea> = {}): Api.MarketIdea {
  return {
    id: '3',
    title: 'Automated tax collection',
    summary: 'Collect and reconcile taxes without paper.',
    price: 50000,
    currency: 'TZS',
    status: 'published',
    publishedAt: '2026-10-17T09:00:00Z',
    updatedAt: '2026-10-17T09:00:00Z',
    hasAccess: false,
    documentation: null,
    hasDocument: false,
    document: null,
    documentInfo: null,
    hasWrittenDocumentation: false,
    myPurchase: null,
    purchasesConfirmed: 0,
    revenue: 0,
    paymentsWaiting: 0,
    ...overrides,
  }
}

function renderIdea() {
  return render(
    <MemoryRouter initialEntries={['/app/marketplace/3']}>
      <Routes>
        <Route path="/app/marketplace/:ideaId" element={<MarketIdeaPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // Answers queued with `mockResolvedValueOnce` must not outlive the test that queued them.
  api.marketIdeaRequest.mockReset()
  api.paymentMethodsRequest.mockResolvedValue([MPESA])
  api.adminPaymentMethodsRequest.mockResolvedValue([MPESA])
  api.pushAvailableRequest.mockResolvedValue(true)
  api.myEnquiryRequest.mockResolvedValue(null)
  api.cardTokenizerRequest.mockResolvedValue('sandbox')
})

function enquiry(overrides: Partial<Api.Enquiry> = {}): Api.Enquiry {
  return {
    id: '11',
    ideaId: '3',
    ideaTitle: 'Automated tax collection',
    buyerName: 'Buyer Person',
    buyerEmail: 'buyer@example.com',
    awaitingReply: true,
    latestMessageAt: '2026-10-17T10:00:00Z',
    messages: [
      {
        id: '1',
        body: 'What exactly is in the document?',
        fromTeam: false,
        authorName: 'Buyer Person',
        createdAt: '2026-10-17T10:00:00Z',
      },
    ],
    ...overrides,
  }
}

describe('the marketplace', () => {
  it('lists published ideas, without their price, and whether the reader has unlocked them', async () => {
    api.marketIdeasRequest.mockResolvedValue([
      idea(),
      idea({ id: '4', title: 'Leave requests', hasAccess: true, price: 0 }),
      idea({ id: '5', title: 'Payroll', myPurchase: purchase() }),
    ])
    render(
      <MemoryRouter>
        <MarketplacePage />
      </MemoryRouter>,
    )

    const list = within(await screen.findByRole('list', { name: 'Ideas for sale' }))
    const [tax, leave, payroll] = list.getAllByRole('listitem')
    expect(tax).not.toHaveTextContent('TZS 50,000')
    expect(tax).toHaveTextContent('Locked')
    expect(within(tax).getByRole('link')).toHaveAttribute('href', '/app/marketplace/3')
    expect(leave).toHaveTextContent('Unlocked')
    expect(payroll).toHaveTextContent('Payment being confirmed')
  })

  it('shows what is included, and takes a payment in the checkout', async () => {
    const locked = idea({
      hasDocument: true,
      documentInfo: { filename: 'tax-plan.pdf', format: 'PDF', size: 2048 },
      hasWrittenDocumentation: true,
    })
    api.marketIdeaRequest
      .mockResolvedValueOnce(locked)
      .mockResolvedValueOnce({ ...locked, myPurchase: purchase() })
    api.submitPayment.mockResolvedValue({ ...OK, purchase: purchase() })
    renderIdea()

    // What comes with the idea is shown before buying; clicking a locked file opens checkout.
    const included = within(await screen.findByRole('list', { name: 'Included' }))
    expect(included.getByText('PDF document · 2.0 KB')).toBeInTheDocument()
    fireEvent.click(included.getByRole('button', { name: 'tax-plan.pdf, locked' }))

    const checkout = within(await screen.findByRole('dialog', { name: 'Checkout' }))
    // The only method is chosen already, with where and how much to pay.
    expect(await checkout.findByText('0754 000 000')).toBeInTheDocument()
    expect(checkout.getByRole('radio', { name: 'M-Pesa, Mobile money' })).toBeChecked()
    fireEvent.click(checkout.getByRole('button', { name: 'I have paid →' }))

    fireEvent.change(checkout.getByLabelText('Name on the payment'), {
      target: { value: 'Buyer Person' },
    })
    fireEvent.change(checkout.getByLabelText('Phone number you paid from'), {
      target: { value: '0712 345 678' },
    })
    fireEvent.change(checkout.getByLabelText('Transaction reference'), {
      target: { value: 'qk7h2x9p1a' },
    })
    fireEvent.click(checkout.getByRole('button', { name: 'Confirm payment of TZS 50,000' }))

    await waitFor(() =>
      expect(api.submitPayment).toHaveBeenCalledWith({
        input: {
          ideaId: '3',
          methodId: '1',
          payerName: 'Buyer Person',
          payerAccount: '0712 345 678',
          transactionReference: 'QK7H2X9P1A',
        },
      }),
    )
    expect(await checkout.findByText('Payment submitted')).toBeInTheDocument()
    fireEvent.click(checkout.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByText('We are confirming your payment')).toBeInTheDocument()
  })

  it('opens the written documentation in the viewer once the payment is confirmed', async () => {
    api.marketIdeaRequest.mockResolvedValue(
      idea({
        hasAccess: true,
        documentation: '- Architecture\n- Rollout plan',
        hasWrittenDocumentation: true,
      }),
    )
    renderIdea()

    expect(await screen.findByText('✓ Unlocked')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Unlock/ })).toBeNull()
    // Read in the viewer, not on the page.
    expect(screen.queryByText('Architecture')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Read' }))

    const viewer = within(
      await screen.findByRole('dialog', { name: 'Written implementation plan' }),
    )
    expect(viewer.getByText('Architecture').tagName).toBe('LI')
    fireEvent.click(viewer.getByRole('button', { name: 'Close preview' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('lets a buyer preview and download the document once unlocked', async () => {
    const doc: Api.MarketDocument = {
      filename: 'tax-plan.pdf',
      contentType: 'application/pdf',
      size: 2048,
      uploadedAt: '2026-10-17T09:00:00Z',
      downloadPath: '/marketplace/ideas/3/document/',
    }
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
    api.marketIdeaRequest.mockResolvedValue(
      idea({
        hasAccess: true,
        documentation: '',
        hasDocument: true,
        document: doc,
        documentInfo: { filename: 'tax-plan.pdf', format: 'PDF', size: 2048 },
      }),
    )
    api.downloadMarketDocument.mockResolvedValue(undefined)
    api.fetchMarketDocument.mockResolvedValue(new Blob(['%PDF']))
    renderIdea()

    fireEvent.click(await screen.findByRole('button', { name: 'Download' }))
    await waitFor(() => expect(api.downloadMarketDocument).toHaveBeenCalledWith(doc))

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'tax-plan.pdf' }))
    expect(await dialog.findByLabelText('Preview of tax-plan.pdf')).toHaveAttribute(
      'data',
      'blob:preview',
    )
  })

  it('folds what is included away to a summary, and opens it again with Read it', async () => {
    api.marketIdeaRequest.mockResolvedValue(
      idea({
        hasAccess: true,
        documentation: 'The plan.',
        hasWrittenDocumentation: true,
        hasDocument: true,
        documentInfo: { filename: 'tax-plan.pdf', format: 'PDF', size: 2048 },
      }),
    )
    renderIdea()

    const included = within(await screen.findByRole('region', { name: 'What’s included' }))
    fireEvent.click(included.getByRole('button', { name: 'Hide' }))
    expect(included.queryByRole('list', { name: 'Included' })).not.toBeInTheDocument()
    expect(
      included.getByText('A PDF document and a written implementation plan.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Collect and reconcile taxes without paper.')).toBeInTheDocument()

    fireEvent.click(included.getByRole('button', { name: 'Read it →' }))
    expect(included.getByRole('list', { name: 'Included' })).toHaveTextContent('tax-plan.pdf')
    expect(included.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('sends a payment prompt to the phone and unlocks when it is approved', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const MIXX: Api.PaymentMethod = {
      ...MPESA,
      id: '2',
      collection: 'push',
      provider: 'Mixx by Yas (Tigo Pesa)',
      accountName: 'Automation Platform',
      accountNumber: '',
    }
    const onPhone = purchase({
      status: 'awaiting',
      method: MIXX,
      payerAccount: '255712345678',
      transactionReference: '',
    })
    api.paymentMethodsRequest.mockResolvedValue([MIXX])
    api.marketIdeaRequest.mockResolvedValue(idea())
    api.startPushPayment.mockResolvedValue({ ...OK, purchase: onPhone })
    api.marketPurchaseRequest.mockResolvedValue({
      ...onPhone,
      status: 'confirmed',
      transactionReference: 'MX123',
    })
    renderIdea()

    fireEvent.click(await screen.findByRole('button', { name: 'Unlock everything · TZS 50,000' }))
    const checkout = within(await screen.findByRole('dialog', { name: 'Checkout' }))
    // No number of ours to type in: only the buyer's own.
    await checkout.findByText('Approve on your phone')
    expect(checkout.queryByText('Pay to')).toBeNull()
    const pay = checkout.getByRole('button', { name: 'Pay TZS 50,000' })
    expect(pay).toBeDisabled()
    fireEvent.change(checkout.getByLabelText('Mixx by Yas (Tigo Pesa) number'), {
      target: { value: '712 345 678' },
    })
    fireEvent.click(pay)

    await waitFor(() =>
      expect(api.startPushPayment).toHaveBeenCalledWith({
        input: { ideaId: '3', methodId: '2', phoneNumber: '712 345 678' },
      }),
    )
    expect(await checkout.findByText('Check your phone')).toBeInTheDocument()
    expect(checkout.getByText('0712 345 678')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100)
    })
    expect(await checkout.findByText('Payment received')).toBeInTheDocument()
    expect(api.marketPurchaseRequest).toHaveBeenCalledWith('7')
    vi.useRealTimers()
  })

  it('lets a buyer ask the team a question before buying', async () => {
    api.marketIdeaRequest.mockResolvedValue(idea())
    api.sendEnquiry.mockResolvedValue({ ...OK, enquiry: enquiry() })
    renderIdea()

    // The conversation is a chat icon until the buyer opens it.
    expect(screen.queryByRole('form', { name: 'Message the team' })).toBeNull()
    const launcher = await screen.findByRole('button', { name: 'Ask the team a question' })
    fireEvent.click(launcher)
    expect(launcher).toHaveAttribute('aria-expanded', 'true')
    expect(
      await screen.findByRole('heading', { name: 'Have a question before you buy?' }),
    ).toBeInTheDocument()
    const form = within(screen.getByRole('form', { name: 'Message the team' }))
    expect(form.getByRole('button', { name: 'Send' })).toBeDisabled()
    // A suggested question fills the box; the buyer can change it before sending.
    fireEvent.click(await screen.findByRole('button', { name: 'What exactly is in the document?' }))
    fireEvent.click(form.getByRole('button', { name: 'Send' }))

    await waitFor(() =>
      expect(api.sendEnquiry).toHaveBeenCalledWith({
        ideaId: '3',
        body: 'What exactly is in the document?',
      }),
    )
    const conversation = within(await screen.findByRole('list', { name: 'Conversation' }))
    expect(conversation.getByText('What exactly is in the document?')).toBeInTheDocument()
    expect(conversation.getByText(/The team will answer here/)).toBeInTheDocument()

    // A second click on the icon hides it again.
    fireEvent.click(launcher)
    expect(screen.queryByRole('form', { name: 'Message the team' })).toBeNull()
  })

  it('takes a card payment without the card details ever reaching the server', async () => {
    const CARD: Api.PaymentMethod = {
      ...MPESA,
      id: '5',
      kind: 'bank',
      collection: 'card',
      provider: 'Visa / Mastercard',
      accountName: 'Automation Platform',
      accountNumber: '',
    }
    api.paymentMethodsRequest.mockResolvedValue([CARD])
    api.marketIdeaRequest.mockResolvedValue(idea())
    api.startCardPayment.mockResolvedValue({
      ...OK,
      purchase: purchase({
        status: 'confirmed',
        method: CARD,
        payerAccount: 'Visa •••• 4242',
        transactionReference: 'SC1234ABCD',
      }),
    })
    renderIdea()

    fireEvent.click(await screen.findByRole('button', { name: 'Unlock everything · TZS 50,000' }))
    const checkout = within(await screen.findByRole('dialog', { name: 'Checkout' }))
    const form = within(await checkout.findByRole('form', { name: 'Pay by card' }))
    // Nothing is sent while the details are incomplete; each field says what is wrong.
    fireEvent.click(checkout.getByRole('button', { name: 'Pay TZS 50,000' }))
    expect(await form.findByText('We take Visa and Mastercard.')).toBeInTheDocument()
    expect(api.startCardPayment).not.toHaveBeenCalled()

    fireEvent.change(form.getByLabelText(/Cardholder name/), { target: { value: 'Buyer Person' } })
    fireEvent.change(form.getByLabelText(/Card number/), {
      target: { value: '4242424242424242' },
    })
    expect(form.getByLabelText(/Card number/)).toHaveValue('4242 4242 4242 4242')
    fireEvent.change(form.getByLabelText(/Expiry date/), { target: { value: '0839' } })
    fireEvent.change(form.getByLabelText(/CVV/), { target: { value: '123' } })
    fireEvent.click(checkout.getByRole('button', { name: 'Pay TZS 50,000' }))

    await waitFor(() =>
      expect(api.startCardPayment).toHaveBeenCalledWith({
        input: {
          ideaId: '3',
          methodId: '5',
          cardToken: 'sbx_card_4242',
          cardholderName: 'Buyer Person',
          cardLabel: 'Visa •••• 4242',
        },
      }),
    )
    const sent = JSON.stringify(api.startCardPayment.mock.calls)
    expect(sent).not.toContain('4242424242424242')
    expect(sent).not.toContain('"123"')
    expect(await checkout.findByText('Payment received')).toBeInTheDocument()
  })

  it('says why a payment was rejected, and lets the buyer try again', async () => {
    api.marketIdeaRequest.mockResolvedValue(
      idea({
        myPurchase: purchase({
          status: 'rejected',
          reviewNote: 'No such transaction.',
        }),
      }),
    )
    renderIdea()

    expect(await screen.findByText('No such transaction.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('dialog', { name: 'Checkout' })).toBeInTheDocument()
  })
})

describe('the console', () => {
  it('writes an idea for sale and publishes it', async () => {
    api.adminMarketIdeasRequest.mockResolvedValue([idea({ status: 'draft' })])
    api.createMarketIdea.mockResolvedValue({
      ...OK,
      idea: idea({ status: 'draft' }),
    })
    api.publishMarketIdea.mockResolvedValue({ ...OK, idea: idea() })
    renderAdminPage(<AdminMarketIdeasPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'New idea' }))
    const form = within(screen.getByRole('form', { name: 'New platform idea' }))
    // What buyers will see is drawn beside the form as it is typed.
    const preview = within(screen.getByRole('complementary', { name: 'How buyers will see it' }))
    fireEvent.change(form.getByLabelText('Title'), {
      target: { value: 'Payroll' },
    })
    fireEvent.change(form.getByLabelText(/^Summary/), {
      target: { value: 'Pay people on time.' },
    })
    fireEvent.change(form.getByLabelText(/^Written documentation/), {
      target: { value: '- Plan' },
    })
    fireEvent.change(form.getByLabelText(/^Price/), {
      target: { value: '75000' },
    })
    expect(preview.getByText('Payroll')).toBeInTheDocument()
    expect(preview.getByText('TZS 75,000')).toBeInTheDocument()
    fireEvent.click(form.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(api.createMarketIdea).toHaveBeenCalledWith({
        input: {
          title: 'Payroll',
          summary: 'Pay people on time.',
          documentation: '- Plan',
          price: 75000,
        },
      }),
    )
    expect(await screen.findByText('Idea saved as a draft.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Publish Automated tax collection' }))
    await waitFor(() => expect(api.publishMarketIdea).toHaveBeenCalledWith({ id: '3' }))
    expect(
      await screen.findByText(/is on sale: everyone signed in can now see it/),
    ).toBeInTheDocument()
  })

  it('uploads the chosen document once the idea is saved', async () => {
    api.adminMarketIdeasRequest.mockResolvedValue([])
    api.createMarketIdea.mockResolvedValue({
      ...OK,
      idea: idea({ id: '9', status: 'draft' }),
    })
    api.uploadMarketDocument.mockResolvedValue({ ...OK, document: null })
    renderAdminPage(<AdminMarketIdeasPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'New idea' }))
    const form = within(screen.getByRole('form', { name: 'New platform idea' }))
    fireEvent.change(form.getByLabelText('Title'), {
      target: { value: 'Payroll' },
    })
    fireEvent.change(form.getByLabelText(/^Summary/), {
      target: { value: 'Pay people on time.' },
    })
    const file = new File(['%PDF-1.4'], 'payroll.pdf', {
      type: 'application/pdf',
    })
    fireEvent.change(form.getByLabelText('Upload a document'), {
      target: { files: [file] },
    })
    // The buyer's view already names the file.
    const preview = within(screen.getByRole('complementary', { name: 'How buyers will see it' }))
    expect(preview.getByText(/payroll\.pdf/)).toBeInTheDocument()

    fireEvent.click(form.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() => expect(api.uploadMarketDocument).toHaveBeenCalledWith('9', file))
    expect(await screen.findByText('Idea saved as a draft.')).toBeInTheDocument()
  })

  it('refuses a file that is not a document before sending anything', async () => {
    api.adminMarketIdeasRequest.mockResolvedValue([])
    renderAdminPage(<AdminMarketIdeasPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'New idea' }))
    const form = within(screen.getByRole('form', { name: 'New platform idea' }))
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    fireEvent.change(form.getByLabelText('Upload a document'), {
      target: { files: [file] },
    })

    expect(form.getByRole('alert')).toHaveTextContent('Choose a PDF or a Word document')
  })

  it('previews a chosen PDF before it is uploaded', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
    api.adminMarketIdeasRequest.mockResolvedValue([])
    renderAdminPage(<AdminMarketIdeasPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'New idea' }))
    const form = within(screen.getByRole('form', { name: 'New platform idea' }))
    const file = new File(['%PDF-1.4'], 'payroll.pdf', { type: 'application/pdf' })
    fireEvent.change(form.getByLabelText('Upload a document'), { target: { files: [file] } })
    fireEvent.click(form.getByRole('button', { name: 'Preview' }))

    const dialog = within(await screen.findByRole('dialog', { name: 'payroll.pdf' }))
    expect(dialog.getByText('Not uploaded yet')).toBeInTheDocument()
    expect(await dialog.findByLabelText('Preview of payroll.pdf')).toHaveAttribute(
      'data',
      'blob:preview',
    )
    fireEvent.click(dialog.getByRole('button', { name: 'Close preview' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('previews a saved Word document', async () => {
    const doc: Api.MarketDocument = {
      filename: 'plan.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 4096,
      uploadedAt: '2026-10-17T09:00:00Z',
      downloadPath: '/marketplace/ideas/3/document/',
    }
    api.adminMarketIdeasRequest.mockResolvedValue([idea({ hasDocument: true, document: doc })])
    api.fetchMarketDocument.mockResolvedValue(new Blob(['PK']))
    renderAdminPage(<AdminMarketIdeasPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Automated tax collection' }))
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    const dialog = within(await screen.findByRole('dialog', { name: 'plan.docx' }))
    expect(await dialog.findByText('Page one of the plan')).toBeInTheDocument()
    expect(api.fetchMarketDocument).toHaveBeenCalledWith(doc)
  })

  it('shows the pipeline: how many ideas are at each stage, and what they have earned', async () => {
    api.adminMarketIdeasRequest.mockResolvedValue([
      idea({ id: '1', title: 'Drafted', status: 'draft' }),
      idea({ id: '2', title: 'Fresh on sale' }),
      idea({
        id: '3',
        title: 'Selling',
        purchasesConfirmed: 2,
        revenue: 100000,
        paymentsWaiting: 1,
      }),
      idea({ id: '4', title: 'Pulled', status: 'unpublished' }),
    ])
    renderAdminPage(<AdminMarketIdeasPage />)

    const pipeline = within(await screen.findByRole('region', { name: 'Pipeline' }))
    expect(pipeline.getByRole('button', { name: /1\. Draft\s*1/ })).toBeInTheDocument()
    expect(pipeline.getByRole('button', { name: /2\. On sale\s*1/ })).toBeInTheDocument()
    expect(pipeline.getByRole('button', { name: /3\. Sold\s*1/ })).toBeInTheDocument()
    expect(pipeline.getByText('TZS 100,000')).toBeInTheDocument()

    const selling = within(screen.getByRole('listitem', { name: 'Selling' }))
    expect(selling.getByText('Sold')).toBeInTheDocument()
    expect(selling.getByRole('link', { name: '1' })).toHaveAttribute(
      'href',
      '/app/admin/marketplace/payments',
    )

    // A stage filters the ideas.
    fireEvent.click(pipeline.getByRole('button', { name: /Draft/ }))
    const list = screen.getByRole('list', { name: 'Platform ideas' })
    expect(list.children).toHaveLength(1)
    expect(within(list).getByText('Drafted')).toBeInTheDocument()
  })

  it('warns that a priced idea needs a payment method before it can be published', async () => {
    api.adminMarketIdeasRequest.mockResolvedValue([])
    api.adminPaymentMethodsRequest.mockResolvedValue([])
    renderAdminPage(<AdminMarketIdeasPage />)

    expect(await screen.findByText(/There is no payment method yet/)).toBeInTheDocument()
  })

  it('confirms a payment and shows that it happened', async () => {
    api.marketPaymentsRequest.mockResolvedValue([purchase()])
    api.confirmPayment.mockResolvedValue({
      ...OK,
      purchase: purchase({ status: 'confirmed' }),
    })
    renderAdminPage(<AdminMarketPaymentsPage />)

    const payment = within(
      await screen.findByRole('listitem', {
        name: 'Payment from Buyer Person for Automated tax collection',
      }),
    )
    expect(payment.getByText('QK7H2X9P1A')).toBeInTheDocument()
    expect(payment.getByText('TZS 50,000')).toBeInTheDocument()
    fireEvent.click(payment.getByRole('button', { name: 'Confirm payment' }))

    await waitFor(() => expect(api.confirmPayment).toHaveBeenCalledWith({ id: '7', note: '' }))
    const decided = within(await screen.findByRole('list', { name: 'Decided just now' }))
    expect(decided.getByText('Payment confirmed')).toBeInTheDocument()
    expect(decided.getByText(/Buyer Person can now read/)).toBeInTheDocument()
  })

  it('refuses a rejection without a reason, in the server’s words', async () => {
    api.marketPaymentsRequest.mockResolvedValue([purchase()])
    api.rejectPayment.mockResolvedValue({
      success: false,
      message: 'Say why the payment cannot be confirmed.',
      field: 'note',
      purchase: null,
    })
    renderAdminPage(<AdminMarketPaymentsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }))
    expect(await screen.findByText('Say why the payment cannot be confirmed.')).toBeInTheDocument()
  })

  it('adds a mobile money method that prompts the buyer’s phone', async () => {
    api.adminPaymentMethodsRequest.mockResolvedValue([])
    api.createPaymentMethod.mockResolvedValue({ ...OK, method: MPESA })
    renderAdminPage(<AdminPaymentMethodsPage />)

    const form = within(await screen.findByRole('form', { name: 'Add a payment method' }))
    fireEvent.click(form.getByRole('button', { name: 'Mixx by Yas (Tigo Pesa)' }))
    fireEvent.change(form.getByLabelText('Merchant name'), {
      target: { value: 'Automation Platform' },
    })
    // A prompt needs no number of ours.
    expect(form.queryByLabelText('Phone, till or Lipa number')).toBeNull()
    expect(await form.findByText('✓ Connected to the payment gateway.')).toBeInTheDocument()
    fireEvent.click(form.getByRole('button', { name: 'Add payment method' }))

    await waitFor(() =>
      expect(api.createPaymentMethod).toHaveBeenCalledWith({
        input: {
          kind: 'mobile_money',
          collection: 'push',
          provider: 'Mixx by Yas (Tigo Pesa)',
          accountName: 'Automation Platform',
          accountNumber: '',
          instructions: '',
        },
      }),
    )
    expect(await screen.findByText(/Payment method added/)).toBeInTheDocument()
  })

  it('adds a method the buyer pays by hand', async () => {
    api.adminPaymentMethodsRequest.mockResolvedValue([])
    api.createPaymentMethod.mockResolvedValue({ ...OK, method: MPESA })
    renderAdminPage(<AdminPaymentMethodsPage />)

    const form = within(await screen.findByRole('form', { name: 'Add a payment method' }))
    fireEvent.click(form.getByLabelText(/Buyer sends the money/))
    fireEvent.change(form.getByLabelText('Mobile money provider'), {
      target: { value: 'M-Pesa' },
    })
    fireEvent.change(form.getByLabelText('Account name'), {
      target: { value: 'Mustanet Ltd' },
    })
    fireEvent.change(form.getByLabelText('Phone, till or Lipa number'), {
      target: { value: '0754 000 000' },
    })
    fireEvent.click(form.getByRole('button', { name: 'Add payment method' }))

    await waitFor(() =>
      expect(api.createPaymentMethod).toHaveBeenCalledWith({
        input: {
          kind: 'mobile_money',
          collection: 'manual',
          provider: 'M-Pesa',
          accountName: 'Mustanet Ltd',
          accountNumber: '0754 000 000',
          instructions: '',
        },
      }),
    )
  })

  it('answers a buyer from the enquiries inbox', async () => {
    api.marketEnquiriesRequest.mockResolvedValue([enquiry()])
    api.replyEnquiry.mockResolvedValue({ ...OK, enquiry: enquiry({ awaitingReply: false }) })
    renderAdminPage(<AdminMarketEnquiriesPage />)

    const list = within(await screen.findByRole('list', { name: 'Conversations' }))
    expect(list.getByText('Needs a reply')).toBeInTheDocument()
    const reply = within(screen.getByRole('form', { name: 'Reply to Buyer Person' }))
    fireEvent.change(reply.getByLabelText('Your answer'), {
      target: { value: 'A 6-section implementation guide.' },
    })
    fireEvent.click(reply.getByRole('button', { name: 'Send answer' }))

    await waitFor(() =>
      expect(api.replyEnquiry).toHaveBeenCalledWith({
        id: '11',
        body: 'A 6-section implementation guide.',
      }),
    )
  })
})
