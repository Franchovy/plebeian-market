import { CartSummary } from '@/components/features/cart/CartSummary'
import { CheckoutProgress } from '@/components/features/checkout/CheckoutProgress'
import { OrderFinalizeComponent } from '@/components/features/checkout/OrderFinalizeComponent'
import { PaymentContent, type PaymentContentRef } from '@/components/features/checkout/PaymentContent'
import { PaymentSummary } from '@/components/features/checkout/PaymentSummary'
import { ShippingAddressForm, type CheckoutFormData } from '@/components/features/checkout/ShippingAddressForm'
import { WalletSelector, type WalletOption } from '@/components/features/checkout/WalletSelector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { authStore } from '@/lib/stores/auth'
import { cartActions, cartStore } from '@/lib/stores/cart'
import { ndkStore } from '@/lib/stores/ndk'
import { parseNwcUri, useWallets } from '@/lib/stores/wallet'
import { persistInvoicesLocally, updatePersistedInvoiceLocally } from '@/lib/utils/invoiceStorage'
import type { OrderInvoiceSet } from '@/lib/utils/orderUtils'
import { publishOrderWithDependencies } from '@/publish/orders'
import { publishPaymentReceipt } from '@/publish/payment'
import type { PaymentInvoiceData } from '@/lib/types/invoice'
import { useGenerateInvoiceMutation, useAvailablePaymentOptions, type PaymentDetail } from '@/queries/payment'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useForm } from '@tanstack/react-form'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { ChevronLeft, ChevronRight, Loader2, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute('/checkout')({
	component: RouteComponent,
})

type CheckoutStep = 'shipping' | 'summary' | 'payment' | 'complete'

function RouteComponent() {
	const navigate = useNavigate()
	const { cart, totalInSats, totalShippingInSats, productsBySeller, sellerData, v4vShares } = useStore(cartStore)
	const { wallets, isInitialized: walletsInitialized, initialize: initializeWallets } = useWallets()
	const ndkState = useStore(ndkStore)
	const { user } = useStore(authStore)
	const [currentStep, setCurrentStep] = useState<CheckoutStep>('shipping')
	const [currentInvoiceIndex, setCurrentInvoiceIndex] = useState(0)
	const [invoices, setInvoices] = useState<PaymentInvoiceData[]>([])
	const [shippingData, setShippingData] = useState<CheckoutFormData | null>(null)
	const [mobileOrderSummaryOpen, setMobileOrderSummaryOpen] = useState(false)
	const [selectedWallets, setSelectedWallets] = useState<Record<string, string>>({}) // sellerPubkey -> paymentDetailId
	const [availableWalletsBySeller, setAvailableWalletsBySeller] = useState<Record<string, PaymentDetail[]>>({})
	const [isCreatingOrder, setIsCreatingOrder] = useState(false) // Loading state for order creation

	// Ref to control PaymentContent
	const paymentContentRef = useRef<PaymentContentRef>(null)

	// Reset checkout state when component mounts or cart changes
	useEffect(() => {
		setCurrentStep('shipping')
		setCurrentInvoiceIndex(0)
		setInvoices([])
		setShippingData(null)
		setOrderInvoiceSets({})
		setSpecOrderIds([])
	}, [Object.keys(cart.products).join(',')]) // Reset when cart products change

	// Initialize wallets on mount
	useEffect(() => {
		if (!walletsInitialized) {
			initializeWallets()
		}
	}, [walletsInitialized, initializeWallets])

	// Clear cart when component unmounts if checkout was completed
	useEffect(() => {
		return () => {
			if (currentStep === 'complete') {
				cartActions.clear()
			}
		}
	}, [currentStep])

	// Check for NWC availability based on configured wallets with valid URIs
	const nwcEnabled = useMemo(() => {
		if (!walletsInitialized) {
			return false
		}

		// Check for wallets with valid NWC URIs
		const validWallets = wallets.filter((wallet) => {
			if (!wallet.nwcUri) return false

			const parsed = parseNwcUri(wallet.nwcUri)
			return parsed !== null && parsed.pubkey && parsed.relay && parsed.secret
		})

		const hasValidWallets = validWallets.length > 0
		console.log(
			`NWC Status: initialized=${walletsInitialized}, total_wallets=${wallets.length}, valid_wallets=${validWallets.length}, enabled=${hasValidWallets}`,
		)

		if (validWallets.length > 0) {
			console.log(
				'Valid NWC wallets:',
				validWallets.map((w) => ({
					name: w.name,
					pubkey: w.pubkey.substring(0, 8) + '...',
					relay: w.relays[0] || 'unknown',
				})),
			)
		} else if (wallets.length > 0) {
			console.log(
				'Found wallets but none have valid NWC URIs:',
				wallets.map((w) => ({
					name: w.name,
					hasUri: !!w.nwcUri,
					uriValid: w.nwcUri ? parseNwcUri(w.nwcUri) !== null : false,
				})),
			)
		}

		return hasValidWallets
	}, [walletsInitialized, wallets])

	// Get the first valid NWC wallet URI to pass to payment processors
	const nwcWalletUri = useMemo(() => {
		if (!walletsInitialized) return null
		const validWallet = wallets.find((wallet) => {
			if (!wallet.nwcUri) return false
			const parsed = parseNwcUri(wallet.nwcUri)
			return parsed !== null && parsed.pubkey && parsed.relay && parsed.secret
		})
		return validWallet?.nwcUri || null
	}, [walletsInitialized, wallets])

	const [orderInvoiceSets, setOrderInvoiceSets] = useState<Record<string, OrderInvoiceSet>>({})
	const [specOrderIds, setSpecOrderIds] = useState<string[]>([])
	// Use auto-animate with error handling to prevent DOM manipulation errors
	const [animationParent] = (() => {
		try {
			return useAutoAnimate()
		} catch (error) {
			console.warn('Auto-animate not available:', error)
			return [null]
		}
	})()
	const { mutateAsync: generateInvoice, isPending: isGeneratingInvoices } = useGenerateInvoiceMutation()

	const isCartEmpty = useMemo(() => {
		return Object.keys(cart.products).length === 0
	}, [cart.products])

	const hasAllShippingMethods = useMemo(() => {
		return Object.values(cart.products).every((product) => product.shippingMethodId !== null)
	}, [cart.products])

	const sellers = useMemo(() => {
		return Object.keys(productsBySeller)
	}, [productsBySeller])

	const totalInvoicesNeeded = useMemo(() => {
		const total = sellers.reduce((total, sellerPubkey) => {
			// 1 invoice for the seller + 1 invoice for each V4V recipient
			const v4vRecipients = v4vShares[sellerPubkey] || []
			const sellerTotal = 1 + v4vRecipients.length
			console.log(`Seller ${sellerPubkey.substring(0, 8)}... needs ${sellerTotal} invoices (1 merchant + ${v4vRecipients.length} V4V)`)
			return total + sellerTotal
		}, 0)
		console.log(`Total invoices needed: ${total}`)
		return total
	}, [sellers, v4vShares])

	// Keep the progress bar stable even while invoices are being generated
	const invoiceStepCount = useMemo(() => {
		return invoices.length > 0 ? invoices.length : totalInvoicesNeeded
	}, [invoices.length, totalInvoicesNeeded])

	const totalSteps = useMemo(() => {
		// shipping + summary + (actual/expected invoices) + complete
		return 2 + invoiceStepCount + 1
	}, [invoiceStepCount])

	const isInvoiceCompleteForFlow = (invoice: PaymentInvoiceData) => {
		return invoice.status === 'paid' || invoice.status === 'skipped' || invoice.status === 'expired'
	}

	// Ensure currentInvoiceIndex stays within bounds
	const safeInvoiceIndex = useMemo(() => {
		if (invoices.length === 0) return 0
		return Math.min(currentInvoiceIndex, invoices.length - 1)
	}, [currentInvoiceIndex, invoices.length])

	const currentStepNumber = useMemo(() => {
		switch (currentStep) {
			case 'shipping':
				return 1
			case 'summary':
				return 2
			case 'payment':
				// When invoices are still generating, stay on the first payment step
				const paymentPosition = invoices.length > 0 ? safeInvoiceIndex : 0
				return 3 + paymentPosition
			case 'complete':
				return totalSteps
			default:
				return 1
		}
	}, [currentStep, invoices.length, safeInvoiceIndex, totalSteps])

	const progress = useMemo(() => {
		return ((currentStepNumber - 1) / (totalSteps - 1)) * 100
	}, [currentStepNumber, totalSteps])

	const stepDescription = useMemo(() => {
		switch (currentStep) {
			case 'shipping':
				return 'Enter shipping address'
			case 'summary':
				return 'Review your order'
			case 'payment':
				if (invoices.length === 0) {
					return 'Generating payment invoices...'
				}
				const currentInvoice = invoices[safeInvoiceIndex]
				if (currentInvoice) {
					const invoiceTypeLabel = currentInvoice.type === 'v4v' ? 'V4V Payment' : 'Payment'
					return `${invoiceTypeLabel} ${safeInvoiceIndex + 1} of ${invoices.length}: ${currentInvoice.recipientName}`
				}
				return `Processing Lightning payments (${safeInvoiceIndex + 1} of ${invoices.length})`
			case 'complete':
				return 'Order complete'
			default:
				return 'Checkout'
		}
	}, [currentStep, safeInvoiceIndex, invoices])

	// Fetch available payment options when entering payment step (before invoice generation)
	useEffect(() => {
		if (currentStep === 'payment' && Object.keys(availableWalletsBySeller).length === 0 && sellers.length > 0) {
			const fetchPaymentOptions = async () => {
				const walletsBySeller: Record<string, PaymentDetail[]> = {}

				for (const sellerPubkey of sellers) {
					const sellerProducts = productsBySeller[sellerPubkey] || []
					const productIds = sellerProducts.map((p) => p.id)

					try {
						const { getAvailablePaymentOptions } = await import('@/queries/payment')
						const options = await getAvailablePaymentOptions(productIds, sellerPubkey)
						walletsBySeller[sellerPubkey] = options

						// Auto-select first wallet
						if (options.length > 0 && !selectedWallets[sellerPubkey]) {
							setSelectedWallets((prev) => ({ ...prev, [sellerPubkey]: options[0].id }))
						}
					} catch (error) {
						console.error(`Error fetching payment options for seller ${sellerPubkey}:`, error)
						walletsBySeller[sellerPubkey] = []
					}
				}

				setAvailableWalletsBySeller(walletsBySeller)
			}

			fetchPaymentOptions()
		}
	}, [currentStep, sellers, productsBySeller, availableWalletsBySeller, selectedWallets])

	// Generate Lightning invoices when moving to payment step
	useEffect(() => {
		const hasAllOrderIds = specOrderIds.length >= sellers.length && sellers.length > 0
		if (currentStep === 'payment' && invoices.length === 0 && sellers.length > 0 && !isGeneratingInvoices) {
			if (!hasAllOrderIds) {
				console.warn('Waiting for order IDs before generating invoices...')
				return
			}

			const generateInvoices = async () => {
				const newInvoices: PaymentInvoiceData[] = []
				let invoiceIndex = 0

				try {
					let sellerPosition = 0
					for (const sellerPubkey of sellers) {
						const sellerProducts = productsBySeller[sellerPubkey] || []
						const data = sellerData[sellerPubkey]
						const totalAmount = data?.satsTotal || 0
						const shippingAmount = data?.shippingSats || 0
						const productSubtotal = totalAmount - shippingAmount
						const shares = data?.shares
						const v4vRecipients = v4vShares[sellerPubkey] || []

						// Create invoice for seller's share
						const sellerAmount = shares?.sellerAmount || totalAmount
						const sellerItems = sellerProducts.map((product) => ({
							productId: product.id,
							name: `Product ${product.id.substring(0, 8)}...`,
							amount: product.amount,
							price: Math.floor(sellerAmount / sellerProducts.length),
						}))

						console.log(`Generating invoice for seller ${sellerPubkey.substring(0, 8)}... (${sellerAmount} sats)`)

						// Get the selected wallet for this seller (if any)
						const selectedWalletId = selectedWallets[sellerPubkey]

						const sellerInvoice = await generateInvoice({
							sellerPubkey,
							amountSats: sellerAmount,
							description: `Seller payment for ${sellerProducts.length} items`,
							invoiceId: `invoice-${invoiceIndex++}`,
							items: sellerItems,
							type: 'seller',
							selectedPaymentDetailId: selectedWalletId,
						})

						const sellerOrderId = specOrderIds[sellerPosition] || specOrderIds[0] || 'temp-order'

						// Convert to PaymentInvoiceData format
						const paymentInvoice: PaymentInvoiceData = {
							id: sellerInvoice.id,
							orderId: sellerOrderId,
							recipientPubkey: sellerInvoice.sellerPubkey,
							recipientName: sellerInvoice.sellerName,
							amount: sellerInvoice.amount,
							description: `Seller payment for ${sellerProducts.length} items`,
							bolt11: sellerInvoice.bolt11 || null,
							lightningAddress: sellerInvoice.lightningAddress || null,
							expiresAt: sellerInvoice.expiresAt,
							status: sellerInvoice.status === 'failed' ? 'failed' : (sellerInvoice.status as 'pending' | 'paid' | 'expired'),
							type: 'merchant',
							createdAt: Date.now(),
							isZap: sellerInvoice.isZap,
						}
						newInvoices.push(paymentInvoice)

						// Create invoices for each V4V recipient
						for (const recipient of v4vRecipients) {
							// Calculate the recipient's amount based on their percentage
							const recipientPercentage = recipient.percentage > 1 ? recipient.percentage / 100 : recipient.percentage
							const calculatedAmount = productSubtotal * recipientPercentage

							// Round up to ensure minimum 1 sat for any V4V recipient with > 0% share
							const recipientAmount = recipientPercentage > 0 ? Math.max(1, Math.floor(calculatedAmount)) : 0

							console.log(
								`Processing V4V recipient ${recipient.name}: percentage=${recipient.percentage}%, calculated=${calculatedAmount.toFixed(2)}, final amount=${recipientAmount} sats`,
							)

							if (recipientAmount > 0) {
								console.log(`Generating V4V invoice for ${recipient.name} (${recipientAmount} sats)`)

								const recipientItems = [
									{
										productId: `v4v-${recipient.id}`,
										name: `V4V Share (${(recipientPercentage * 100).toFixed(1)}%)`,
										amount: 1,
										price: recipientAmount,
									},
								]

								try {
									const recipientInvoice = await generateInvoice({
										sellerPubkey: recipient.pubkey,
										amountSats: recipientAmount,
										description: `V4V payment to ${recipient.name}`,
										invoiceId: `invoice-${invoiceIndex++}`,
										items: recipientItems,
										type: 'v4v',
									})

									// Convert to PaymentInvoiceData format
									const v4vPaymentInvoice: PaymentInvoiceData = {
										id: recipientInvoice.id,
										orderId: sellerOrderId,
										recipientPubkey: recipient.pubkey,
										recipientName: recipient.name,
										amount: recipientAmount,
										description: `V4V payment to ${recipient.name}`,
										bolt11: recipientInvoice.bolt11 || null,
										lightningAddress: recipientInvoice.lightningAddress || null,
										expiresAt: recipientInvoice.expiresAt,
										status: recipientInvoice.status === 'failed' ? 'failed' : (recipientInvoice.status as 'pending' | 'paid' | 'expired'),
										type: 'v4v',
										createdAt: Date.now(),
										isZap: recipientInvoice.isZap ?? true,
									}
									newInvoices.push(v4vPaymentInvoice)
									console.log(`✅ Successfully generated V4V invoice for ${recipient.name}`)
								} catch (error) {
									console.error(`❌ Failed to generate V4V invoice for ${recipient.name}:`, error)
									// Continue processing other recipients instead of failing completely
								}
							} else {
								console.log(`⚠️ Skipping V4V recipient ${recipient.name} due to zero percentage`)
							}
						}
						sellerPosition += 1
					}

					console.log(`Generated ${newInvoices.length} invoices`)
					setInvoices(newInvoices)
					persistInvoicesLocally(newInvoices)
				} catch (error) {
					console.error('Failed to generate invoices:', error)
					// Fallback to empty invoices - the user can retry
					setInvoices([])
				}
			}

			generateInvoices()
		}
	}, [currentStep, sellers, productsBySeller, sellerData, v4vShares, invoices.length, isGeneratingInvoices, generateInvoice, specOrderIds])

	const form = useForm({
		defaultValues: {
			name: '',
			email: '',
			phone: '',
			firstLineOfAddress: '',
			zipPostcode: '',
			city: '',
			country: '',
			additionalInformation: '',
		} as CheckoutFormData,
		onSubmit: async ({ value }) => {
			if (!hasAllShippingMethods) return

			setShippingData(value)
			setCurrentStep('summary')
		},
	})

	const findNextPendingInvoiceIndex = (list: PaymentInvoiceData[], fromIndex: number) => {
		for (let i = fromIndex + 1; i < list.length; i++) {
			if (list[i].status === 'pending' || list[i].status === 'failed') {
				return i
			}
		}

		for (let i = 0; i <= fromIndex; i++) {
			if (list[i].status === 'pending' || list[i].status === 'failed') {
				return i
			}
		}

		return -1
	}

	const updateInvoiceStatus = (invoiceId: string, changes: Partial<PaymentInvoiceData>, options?: { skipAutoAdvance?: boolean }) => {
		let nextPendingIndex: number | null = null
		let allCompleted = false

		setInvoices((prevInvoices) => {
			const updated = prevInvoices.map((invoice) => (invoice.id === invoiceId ? { ...invoice, ...changes } : invoice))

			allCompleted = updated.length > 0 && updated.every(isInvoiceCompleteForFlow)

			if (!options?.skipAutoAdvance && !allCompleted) {
				const currentIndex = updated.findIndex((inv) => inv.id === invoiceId)
				nextPendingIndex = findNextPendingInvoiceIndex(updated, currentIndex === -1 ? safeInvoiceIndex : currentIndex)
			}

			return updated
		})

		if (allCompleted) {
			setCurrentStep('complete')
		} else if (!options?.skipAutoAdvance && nextPendingIndex !== null && nextPendingIndex !== -1) {
			// Small delay keeps UI transitions smooth
			setTimeout(() => setCurrentInvoiceIndex(nextPendingIndex!), 200)
		}
	}

	const handlePaymentComplete = async (invoiceId: string, preimage: string, skipAutoAdvance = false) => {
		console.log(`🎯 handlePaymentComplete called:`, {
			invoiceId,
			preimagePreview: preimage.substring(0, 16) + '...',
			currentInvoiceIndex: safeInvoiceIndex,
			totalInvoices: invoices.length,
			invoiceStatuses: invoices.map((inv, i) => `${i}: ${inv.id.substring(0, 8)}... = ${inv.status}`),
		})

		// Find the invoice to get bolt11 for receipt creation
		const invoice = invoices.find((inv) => inv.id === invoiceId)
		const resolvedOrderId = invoice?.orderId && invoice.orderId !== 'temp-order' ? invoice.orderId : specOrderIds[0] || 'unknown-order'

		// Create payment receipt
		if (invoice) {
			try {
				await publishPaymentReceipt({
					invoice: { ...invoice, orderId: resolvedOrderId },
					preimage,
					bolt11: invoice.bolt11 || '',
				})
				updatePersistedInvoiceLocally(resolvedOrderId, invoice.id, {
					status: 'paid',
					preimage,
				})
			} catch (error) {
				console.error('Failed to publish payment receipt:', error)
				toast.error(`Failed to create receipt: ${error instanceof Error ? error.message : 'Unknown error'}`)
			}
		}

		updateInvoiceStatus(
			invoiceId,
			{
				status: 'paid' as const,
				preimage,
			},
			{ skipAutoAdvance },
		)
	}

	const handlePaymentFailed = (invoiceId: string, error: string) => {
		console.error(`Payment failed for invoice ${invoiceId}:`, error)

		setInvoices((prev) =>
			prev.map((invoice) => {
				if (invoice.id === invoiceId) {
					const orderId = invoice.orderId !== 'temp-order' ? invoice.orderId : specOrderIds[0] || 'unknown-order'
					updatePersistedInvoiceLocally(orderId, invoice.id, {
						status: 'failed',
					})
					return {
						...invoice,
						status: 'failed' as const,
					}
				}
				return invoice
			}),
		)

		toast.error(`Payment failed: ${error}`)
	}

	const handleSkipPayment = (invoiceId: string) => {
		console.log(`⏭️ Payment skipped for invoice ${invoiceId}`)

		const invoice = invoices.find((inv) => inv.id === invoiceId)
		const resolvedOrderId = invoice?.orderId && invoice.orderId !== 'temp-order' ? invoice.orderId : specOrderIds[0] || 'unknown-order'

		if (invoice) {
			updatePersistedInvoiceLocally(resolvedOrderId, invoice.id, {
				status: 'skipped',
			})
		}

		// Mark invoice as skipped to allow checkout to proceed
		updateInvoiceStatus(invoiceId, { status: 'skipped' })

		toast.info('Payment skipped - you can pay this invoice later from your order history')
	}

	// Safety net: if all invoices are done, move to completion even if a handler was missed
	useEffect(() => {
		if (currentStep === 'payment' && invoices.length > 0) {
			const allCompleted = invoices.every(isInvoiceCompleteForFlow)
			if (allCompleted) {
				setCurrentStep('complete')
			}
		}
	}, [currentStep, invoices])

	// Simplified pay all function using PaymentContent ref
	const handlePayAllInvoices = async () => {
		if (!nwcEnabled) {
			toast.error('NWC not available for bulk payments')
			return
		}

		if (!paymentContentRef.current) {
			toast.error('Payment interface not ready')
			return
		}

		try {
			await paymentContentRef.current.payAllWithNwc()
		} catch (error) {
			console.error('Bulk payment failed:', error)
			toast.error('Bulk payment failed')
		}
	}

	// Regenerate invoice when wallet selection changes
	const handleWalletChange = async (sellerPubkey: string, newWalletId: string) => {
		console.log(`💳 Wallet changed for seller ${sellerPubkey.substring(0, 8)}: ${newWalletId}`)

		// Update selected wallet
		setSelectedWallets((prev) => ({ ...prev, [sellerPubkey]: newWalletId }))

		// Find the invoice for this seller
		const invoiceIndex = invoices.findIndex((inv) => inv.recipientPubkey === sellerPubkey && inv.type === 'merchant')
		if (invoiceIndex === -1) {
			console.warn(`No merchant invoice found for seller ${sellerPubkey}`)
			return
		}

		const oldInvoice = invoices[invoiceIndex]

		// Generate new invoice with selected wallet
		try {
			const sellerProducts = productsBySeller[sellerPubkey] || []
			const data = sellerData[sellerPubkey]
			const totalAmount = data?.satsTotal || 0
			const shares = data?.shares
			const sellerAmount = shares?.sellerAmount || totalAmount

			const sellerItems = sellerProducts.map((product) => ({
				productId: product.id,
				name: `Product ${product.id.substring(0, 8)}...`,
				amount: product.amount,
				price: Math.floor(sellerAmount / sellerProducts.length),
			}))

			console.log(`🔄 Regenerating invoice for seller ${sellerPubkey.substring(0, 8)}... (${sellerAmount} sats)`)

			const newInvoiceData = await generateInvoice({
				sellerPubkey,
				amountSats: sellerAmount,
				description: `Seller payment for ${sellerProducts.length} items`,
				invoiceId: oldInvoice.id, // Reuse same ID
				items: sellerItems,
				type: 'seller',
				selectedPaymentDetailId: newWalletId,
			})

			// Update the invoice in state
			setInvoices((prevInvoices) => {
				const updated = [...prevInvoices]
				updated[invoiceIndex] = {
					...oldInvoice,
					bolt11: newInvoiceData.bolt11,
					lightningAddress: newInvoiceData.lightningAddress,
					expiresAt: newInvoiceData.expiresAt,
					status: newInvoiceData.status === 'failed' ? 'failed' : (newInvoiceData.status as 'pending' | 'paid' | 'expired'),
					isZap: newInvoiceData.isZap ?? oldInvoice.isZap,
				}
				return updated
			})

			const resolvedOrderId = oldInvoice.orderId !== 'temp-order' ? oldInvoice.orderId : specOrderIds[0] || 'unknown-order'
			updatePersistedInvoiceLocally(resolvedOrderId, oldInvoice.id, {
				bolt11: newInvoiceData.bolt11 || undefined,
				lightningAddress: newInvoiceData.lightningAddress || undefined,
				expiresAt: newInvoiceData.expiresAt,
				isZap: newInvoiceData.isZap ?? oldInvoice.isZap,
				status: newInvoiceData.status === 'failed' ? 'failed' : (newInvoiceData.status as 'pending' | 'paid' | 'expired'),
			})

			console.log(`✅ Invoice regenerated successfully`)
		} catch (error) {
			console.error(`❌ Failed to regenerate invoice:`, error)
			toast.error('Failed to update payment wallet')
		}
	}

	const goBackToShopping = () => {
		// Clear cart when leaving checkout after completion
		if (currentStep === 'complete') {
			cartActions.clear()
		}
		navigate({ to: '/' })
	}

	const goToOrders = () => {
		// Clear cart when viewing orders after completion
		if (currentStep === 'complete') {
			cartActions.clear()
		}
		navigate({ to: '/dashboard/account/your-purchases' })
	}

	const goBackToPreviousStep = () => {
		if (currentStep === 'summary') {
			setCurrentStep('shipping')
		} else if (currentStep === 'payment') {
			if (currentInvoiceIndex > 0) {
				setCurrentInvoiceIndex((prev) => prev - 1)
			} else {
				setCurrentStep('summary')
			}
		} else if (currentStep === 'complete') {
			setCurrentStep('payment')
			setCurrentInvoiceIndex(invoices.length - 1)
		}
	}

	const handleBackClick = () => {
		if (currentStep === 'shipping') {
			goBackToShopping()
		} else {
			goBackToPreviousStep()
		}
	}

	const handleContinueToPayment = async () => {
		if (shippingData && sellers.length > 0 && specOrderIds.length === 0) {
			setIsCreatingOrder(true)
			try {
				const createdOrderIds = await publishOrderWithDependencies({
					shippingData,
					sellers,
					productsBySeller,
					sellerData,
					v4vShares,
				})
				setSpecOrderIds(createdOrderIds)
				console.log('\n🎉 Order creation process complete. Generated Order IDs:', createdOrderIds)
			} catch (error) {
				console.error('Failed to create spec-compliant orders:', error)
				toast.error(`Order creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
				setIsCreatingOrder(false)
				return
			}
		}

		// Move to payment step once orders exist
		setCurrentStep('payment')
		setIsCreatingOrder(false)
	}

	const formatSats = (sats: number): string => {
		return Math.round(sats).toLocaleString()
	}

	// Redirect to home if cart is empty (but allow complete step to show summary)
	if (isCartEmpty && currentStep !== 'complete') {
		return (
			<div className="flex justify-center items-center bg-gray-50 min-h-screen">
				<div className="mx-auto max-w-md text-center">
					<h1 className="mb-4 font-bold text-gray-900 text-2xl">Your cart is empty</h1>
					<p className="mb-6 text-gray-600">Add some products to your cart before checking out.</p>
					<Button onClick={goBackToShopping} className="btn-black">
						Continue Shopping
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col flex-grow">
			{/* Fixed Progress Bar */}
			<div className="top-[8.5rem] lg:top-[5rem] z-20 sticky bg-white border-gray-200 border-b">
				<CheckoutProgress
					currentStepNumber={currentStepNumber}
					totalSteps={totalSteps}
					progress={progress}
					stepDescription={stepDescription}
					onBackClick={handleBackClick}
				/>
			</div>

			{/* Main Content */}
			<div className="flex lg:flex-row flex-col lg:gap-4 px-4 py-8 w-full lg:h-[calc(100vh-10rem)]">
				{/* Mobile Order Summary / Invoices (collapsible) */}
				<div className="lg:hidden mb-4">
					<Card>
						<CardHeader>
							<CardTitle
								className="flex justify-between items-center cursor-pointer"
								onClick={() => setMobileOrderSummaryOpen(!mobileOrderSummaryOpen)}
							>
								<span>{currentStep === 'payment' ? 'Payment Details' : 'Cart Summary'}</span>
								<ChevronRight className={`w-5 h-5 transition-transform ${mobileOrderSummaryOpen ? 'rotate-90' : ''}`} />
							</CardTitle>
						</CardHeader>
						{mobileOrderSummaryOpen && (
							<CardContent>
								{currentStep === 'payment' && isGeneratingInvoices ? (
									<div className="flex justify-center items-center py-8">
										<div className="text-center">
											<div className="mx-auto mb-4 border-2 border-pink-500 border-t-transparent rounded-full w-8 h-8 animate-spin" />
											<p className="text-gray-600">Loading payment details...</p>
										</div>
									</div>
								) : currentStep === 'payment' && invoices.length > 0 ? (
									<>
										{/* NWC Status Indicator */}
										<div className="bg-gray-50 mb-4 p-3 border rounded-lg">
											<div className="flex justify-between items-center text-sm">
												<span className="font-medium text-gray-700">Wallet Status:</span>
												<div className="flex items-center gap-2">
													{nwcEnabled ? (
														<>
															<div className="bg-green-500 rounded-full w-2 h-2" />
															<span className="font-medium text-green-700">
																{wallets.filter((w) => w.nwcUri && parseNwcUri(w.nwcUri)).length} NWC wallet
																{wallets.filter((w) => w.nwcUri && parseNwcUri(w.nwcUri)).length !== 1 ? 's' : ''} connected
															</span>
														</>
													) : (
														<>
															<div className="bg-gray-400 rounded-full w-2 h-2" />
															<span className="text-gray-600">
																Fast Payments available with NWC, setup in{' '}
																<Link to="/dashboard/account/making-payments" className="text-blue-600 hover:underline">
																	settings
																</Link>
															</span>
														</>
													)}
												</div>
											</div>
											{nwcEnabled && <p className="mt-1 text-gray-500 text-xs">Use NWC to action all payments at once</p>}
										</div>

										<PaymentSummary invoices={invoices} currentIndex={safeInvoiceIndex} onSelectInvoice={setCurrentInvoiceIndex} />
									</>
								) : (
									<div className="max-h-[50vh] overflow-y-auto">
										<CartSummary
											allowQuantityChanges={currentStep === 'shipping'}
											allowShippingChanges={currentStep === 'shipping'}
											showExpandedDetails={false}
										/>
									</div>
								)}
							</CardContent>
						)}
					</Card>
				</div>
				{/* Main Content Area */}
				<Card className="flex flex-col flex-1 lg:order-2 shadow-md lg:w-1/2 lg:h-full">
					<CardHeader>
						<div className="flex justify-between items-center">
							<CardTitle>
								{currentStep === 'shipping' ? 'Shipping Address' : currentStep === 'payment' ? 'Invoices' : 'Order Summary'}
							</CardTitle>
							{currentStep === 'payment' && invoices.length > 1 && (
								<div className="hidden lg:flex items-center gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => setCurrentInvoiceIndex(Math.max(0, safeInvoiceIndex - 1))}
										disabled={safeInvoiceIndex === 0}
									>
										<ChevronLeft className="w-4 h-4" />
										Previous
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => setCurrentInvoiceIndex(Math.min(invoices.length - 1, safeInvoiceIndex + 1))}
										disabled={safeInvoiceIndex === invoices.length - 1}
									>
										Next
										<ChevronRight className="w-4 h-4" />
									</Button>
								</div>
							)}
						</div>
					</CardHeader>
					<CardContent className="flex-1 p-6 pt-0 lg:overflow-y-auto">
						<div ref={animationParent} className="lg:h-full lg:min-h-full">
							{currentStep === 'shipping' && (
								<div className="h-full">
									<ShippingAddressForm form={form} hasAllShippingMethods={hasAllShippingMethods} />
								</div>
							)}

							{currentStep === 'summary' && (
								<div className="flex flex-col h-full">
									<div className="flex-1 overflow-y-auto">
										<OrderFinalizeComponent
											shippingData={shippingData}
											invoices={[]} // No invoices yet in summary step
											totalInSats={totalInSats}
											onNewOrder={goBackToShopping}
											// Note: onContinueToPayment moved to footer
										/>
									</div>
									<div className="flex-shrink-0 bg-white pt-4 border-t">
										<Button onClick={handleContinueToPayment} className="w-full btn-black" disabled={isCreatingOrder}>
											{isCreatingOrder ? (
												<>
													<Loader2 className="mr-2 w-4 h-4 animate-spin" />
													Creating Order...
												</>
											) : (
												'Continue to Payment'
											)}
										</Button>
									</div>
								</div>
							)}

							{/* Loading State for Invoice Generation */}
							{currentStep === 'payment' && isGeneratingInvoices && (
								<div className="flex justify-center items-center h-full">
									<div className="text-center">
										<div className="mx-auto mb-4 border-2 border-pink-500 border-t-transparent rounded-full w-8 h-8 animate-spin" />
										<p className="text-gray-600">Generating Lightning invoices...</p>
									</div>
								</div>
							)}

							{/* Error State - No Invoices Generated */}
							{currentStep === 'payment' && !isGeneratingInvoices && invoices.length === 0 && (
								<div className="py-12 text-center">
									<div className="mb-6 text-gray-600">
										<Zap className="mx-auto mb-4 w-16 h-16 text-gray-400" />
										<h3 className="mb-2 font-medium text-lg">Unable to generate payment invoices</h3>
										<p className="mx-auto max-w-md text-gray-500 text-sm">
											There may be an issue with the seller's Lightning configuration, or the Lightning service may be temporarily
											unavailable.
										</p>
									</div>
									<div className="space-y-2">
										<Button
											onClick={() => {
												setInvoices([])
												// This will trigger the useEffect to regenerate invoices
											}}
											variant="outline"
											className="mr-2"
										>
											Try Again
										</Button>
										<Button onClick={goBackToPreviousStep} variant="ghost">
											Go Back
										</Button>
									</div>
								</div>
							)}

							{/* Payment Interface - Only show when invoices are ready */}
							{currentStep === 'payment' && !isGeneratingInvoices && invoices.length > 0 && (
								<div className="space-y-6">
									{/* desktop header nav exists; mobile under-QR nav is handled inside LightningPaymentProcessor */}

									{/* Pay All Button - Only show if NWC is enabled and there are unpaid invoices */}
									{nwcEnabled && invoices.filter((inv) => inv.status === 'pending' || inv.status === 'failed').length > 1 && (
										<div className="flex justify-center mb-4">
											<Button onClick={handlePayAllInvoices} className="px-6 py-2 font-medium btn-product-banner" size="lg">
												<Zap className="mr-2 w-4 h-4" />
												Pay All with NWC ({invoices.filter((inv) => inv.status === 'pending' || inv.status === 'failed').length} invoices)
											</Button>
										</div>
									)}

									{/* Payment Content - Inline instead of modal */}
									<PaymentContent
										ref={paymentContentRef}
										invoices={invoices}
										currentIndex={safeInvoiceIndex}
										onPaymentComplete={handlePaymentComplete}
										onPaymentFailed={handlePaymentFailed}
										onSkipPayment={handleSkipPayment}
										showNavigation={false} // We have our own navigation above
										nwcEnabled={nwcEnabled}
										nwcWalletUri={nwcWalletUri}
										onNavigate={setCurrentInvoiceIndex}
										availableWalletsBySeller={availableWalletsBySeller}
										selectedWallets={selectedWallets}
										onWalletChange={handleWalletChange}
										mode="checkout"
									/>
								</div>
							)}

							{currentStep === 'complete' && (
								<OrderFinalizeComponent
									shippingData={shippingData}
									invoices={invoices}
									totalInSats={totalInSats}
									onNewOrder={goBackToShopping}
									onViewOrders={goToOrders}
								/>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Right Sidebar */}
				<Card className="hidden lg:flex flex-col flex-1 lg:order-1 shadow-md lg:w-1/2 h-full">
					<CardHeader>
						<CardTitle>{currentStep === 'payment' ? 'Payment Details' : 'Cart Summary'}</CardTitle>
					</CardHeader>
					<CardContent className="flex-1 pb-0 overflow-y-auto">
						{currentStep === 'payment' && isGeneratingInvoices ? (
							<div className="flex justify-center items-center h-full">
								<div className="text-center">
									<div className="mx-auto mb-4 border-2 border-pink-500 border-t-transparent rounded-full w-8 h-8 animate-spin" />
									<p className="text-gray-600">Loading payment details...</p>
								</div>
							</div>
						) : currentStep === 'payment' && invoices.length > 0 ? (
							<>
								{/* NWC Status Indicator */}
								<div className="bg-gray-50 mb-4 p-3 border rounded-lg">
									<div className="flex justify-between items-center text-sm">
										<span className="font-medium text-gray-700">Wallet Status:</span>
										<div className="flex items-center gap-2">
											{nwcEnabled ? (
												<>
													<div className="bg-green-500 rounded-full w-2 h-2" />
													<span className="font-medium text-green-700">
														{wallets.filter((w) => w.nwcUri && parseNwcUri(w.nwcUri)).length} NWC wallet
														{wallets.filter((w) => w.nwcUri && parseNwcUri(w.nwcUri)).length !== 1 ? 's' : ''} connected
													</span>
												</>
											) : (
												<>
													<div className="bg-gray-400 rounded-full w-2 h-2" />
													<span className="text-gray-600">
														Fast Payments available with NWC, setup in{' '}
														<Link to="/dashboard/account/making-payments" className="text-blue-600 hover:underline">
															settings
														</Link>
													</span>
												</>
											)}
										</div>
									</div>
									{nwcEnabled && <p className="mt-1 text-gray-500 text-xs">Fast payments available • Configure more wallets in settings</p>}
								</div>

								<div className="pb-6">
									<PaymentSummary invoices={invoices} currentIndex={safeInvoiceIndex} onSelectInvoice={setCurrentInvoiceIndex} />
								</div>
							</>
						) : (
							<ScrollArea className="h-full">
								<CartSummary
									className="pb-6"
									allowQuantityChanges={currentStep === 'shipping'}
									allowShippingChanges={currentStep === 'shipping'}
									showExpandedDetails={false}
								/>
							</ScrollArea>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
