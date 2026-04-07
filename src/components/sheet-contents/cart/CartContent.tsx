import CartItem from '@/components/features/cart/CartItem'
import { ShippingSelector } from '@/components/shared/product/ShippingSelector'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { RichShippingInfo } from '@/lib/stores/cart'
import { cartActions, cartStore } from '@/lib/stores/cart'
import { uiActions } from '@/lib/stores/ui'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useNavigate } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { useEffect, useMemo, useState } from 'react'
import { EmptyCartScreen } from './EmptyCartScreen'
import { UserCard } from '@/components/shared/user/UserCard'

export function CartContent({ className = '' }: { className?: string }) {
	const {
		cart,
		sellerData,
		productsBySeller,
		totalInSats,
		totalShippingInSats,
		totalByCurrency,
		shippingByCurrency,
		sellerShippingOptions,
	} = useStore(cartStore)

	const [parent, enableAnimations] = useAutoAnimate()
	const [selectedShippingByUser, setSelectedShippingByUser] = useState<Record<string, string>>({})
	const navigate = useNavigate()

	const totalItems = useMemo(() => {
		return Object.values(cart.products).reduce((sum, product) => sum + product.amount, 0)
	}, [cart.products])

	const hasAllShippingMethods = useMemo(() => {
		return Object.values(cart.products).every((product) => product.shippingMethodId !== null)
	}, [cart.products])

	const missingShippingCount = useMemo(() => {
		return Object.values(cart.products).filter((product) => !product.shippingMethodId).length
	}, [cart.products])

	const isCartEmpty = useMemo(() => {
		return Object.keys(cart.products).length === 0
	}, [cart.products])

	const formatSats = (sats: number): string => {
		return Math.round(sats).toLocaleString()
	}

	useEffect(() => {
		enableAnimations(true)
	}, [parent, enableAnimations])

	useEffect(() => {
		if (Object.keys(cart.products).length > 0) {
			cartActions.groupProductsBySeller()
			cartActions.updateSellerData()

			cartActions.fetchAndSetSellerShippingOptions()
		}

		const initialSelected: Record<string, string> = {}
		Object.values(cart.products).forEach((product) => {
			if (product.sellerPubkey && product.shippingMethodId && !initialSelected[product.sellerPubkey]) {
				initialSelected[product.sellerPubkey] = product.shippingMethodId
			}
		})
		setSelectedShippingByUser(initialSelected)
	}, [cart.products])

	const handleQuantityChange = (productId: string, newAmount: number) => {
		// Updated function signature - no longer needs buyerPubkey
		cartActions.handleProductUpdate('setAmount', productId, newAmount)
	}

	const handleRemoveProduct = (productId: string) => {
		// Updated function signature - no longer needs buyerPubkey
		cartActions.handleProductUpdate('remove', productId)
	}

	const handleShippingSelect = async (sellerPubkey: string, shippingOption: RichShippingInfo) => {
		setSelectedShippingByUser((prev) => ({
			...prev,
			[sellerPubkey]: shippingOption.id,
		}))

		const products = productsBySeller[sellerPubkey] || []
		for (const product of products) {
			await cartActions.setShippingMethod(product.id, shippingOption)
		}
		await cartActions.updateSellerData()
	}

	if (isCartEmpty) {
		return <EmptyCartScreen />
	}

	return (
		<div className={`flex flex-col h-full overflow-hidden px-4 sm:px-6 ${className}`}>
			{missingShippingCount > 0 && (
				<div className="bg-yellow-50 mb-4 p-4 border-yellow-400 border-l-4">
					<div className="flex">
						<div className="ml-3">
							<p className="text-yellow-700 text-sm">
								Please select shipping options for {missingShippingCount} {missingShippingCount === 1 ? 'item' : 'items'} before checkout.
							</p>
						</div>
					</div>
				</div>
			)}

			<ScrollArea className="flex-1 py-2 min-h-0 overflow-y-auto">
				<div className="space-y-6" ref={parent}>
					{Object.entries(productsBySeller)
						.filter(([sellerPubkey]) => sellerPubkey && sellerPubkey.length > 0 && sellerPubkey !== 'unknown')
						.map(([sellerPubkey, products]) => {
							const data = sellerData[sellerPubkey] || {
								satsTotal: 0,
								currencyTotals: {},
								shares: { sellerAmount: 0, communityAmount: 0, sellerPercentage: 90 },
								shippingSats: 0,
							}

							const optionsForThisSeller = sellerShippingOptions[sellerPubkey] || []

							return (
								<div key={sellerPubkey} className="bg-white shadow-md p-4 border rounded-lg">
									<div className="mb-3">
										<UserCard pubkey={sellerPubkey} size="sm" subtitle="nip-05" />
									</div>

									<ul className="space-y-4">
										{products.map((product, index) => (
											<div key={product.id} className={`p-3 rounded-lg ${index % 2 === 0 ? 'bg-gray-100' : 'bg-white'}`}>
												<CartItem
													productId={product.id}
													sellerPubkey={product.sellerPubkey}
													amount={product.amount}
													onQuantityChange={handleQuantityChange}
													onRemove={handleRemoveProduct}
													hideShipping={true}
												/>
											</div>
										))}
									</ul>

									<div className={`mt-4 ${!selectedShippingByUser[sellerPubkey] ? 'border-l-4 border-yellow-400 pl-2' : ''}`}>
										<ShippingSelector
											options={optionsForThisSeller}
											selectedId={selectedShippingByUser[sellerPubkey]}
											onSelect={(option) => handleShippingSelect(sellerPubkey, option)}
											className="w-full"
										/>
									</div>

									{Object.entries(data.currencyTotals).map(([currency, amount]) => (
										<div key={`${sellerPubkey}-${currency}`} className="flex justify-between mt-4">
											<p className="text-sm">Products ({currency}):</p>
											<p className="text-sm">
												{amount.toFixed(2)} {currency}
											</p>
										</div>
									))}

									<div className="flex justify-between mt-1">
										<p className="text-sm">Shipping:</p>
										<p className="font-semibold text-sm">{formatSats(data.shippingSats)} sat</p>
									</div>

									<div className="flex justify-between mt-1 font-semibold">
										<p className="text-sm">Total:</p>
										<p className="text-sm">{formatSats(data.satsTotal)} sat</p>
									</div>

									<div className="mt-3">
										<p className="font-semibold text-sm">Payment Breakdown</p>

										<div className="bg-gray-800 mt-1 rounded-full w-full h-2 overflow-hidden">
											<div className="bg-blue-500 h-full" style={{ width: `${data.shares.sellerPercentage}%` }} />
										</div>

										<div className="flex justify-between mt-1">
											<p className="text-sm">Merchant: </p>
											<p className="text-sm">
												{formatSats(data.shares.sellerAmount)} sat ({data.shares.sellerPercentage.toFixed(2)}%)
											</p>
										</div>

										{data.shares.communityAmount > 0 && (
											<div className="flex justify-between">
												<p className="text-sm">Community Share: </p>
												<p className="text-sm">
													{formatSats(data.shares.communityAmount)} sat ({(100 - data.shares.sellerPercentage).toFixed(2)}%)
												</p>
											</div>
										)}
									</div>
								</div>
							)
						})}
				</div>
			</ScrollArea>

			<div className="flex-shrink-0 mt-auto pt-4 pb-6 sm:pb-4">
				<div className="space-y-3 w-full">
					<div className="space-y-1 mb-2">
						<div className="flex justify-between">
							<p className="text-sm">Subtotal:</p>
							<p className="text-sm">{formatSats(totalInSats - totalShippingInSats)} sat</p>
						</div>
						<div className="flex justify-between">
							<p className="text-sm">Shipping:</p>
							<p className="text-sm">{formatSats(totalShippingInSats)} sat</p>
						</div>
						<div className="flex justify-between font-bold text-lg">
							<p>Total:</p>
							<p>{formatSats(totalInSats)} sat</p>
						</div>
					</div>

					{/* View Details temporarily hidden for design sync */}

					<div className="space-y-3 mt-4">
						<div className="flex gap-3">
							<Button
								variant="outline"
								className="flex-1 hover:bg-red-50 border-red-200 text-red-500 hover:text-red-600"
								onClick={() => cartActions.clearForUserIntent()}
								disabled={totalItems === 0}
							>
								Clear
							</Button>

							<Button
								className="flex-1 btn-product-banner"
								disabled={!hasAllShippingMethods || totalItems === 0}
								title={!hasAllShippingMethods ? 'Please select shipping options for all items' : ''}
								onClick={() => {
									uiActions.closeDrawer('cart')
									navigate({ to: '/checkout' })
								}}
							>
								Checkout
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
