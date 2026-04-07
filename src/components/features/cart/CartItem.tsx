import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useProductTitle, useProductPrice, useProductImages, useProductStock } from '@/queries/products'
import { Skeleton } from '@/components/ui/skeleton'
import { ShippingSelector } from '@/components/shared/product/ShippingSelector'
import { cartActions, cartStore } from '@/lib/stores/cart'

interface CartItemProps {
	productId: string
	sellerPubkey: string
	amount: number
	onQuantityChange: (productId: string, newAmount: number) => void
	onRemove: (productId: string) => void
	hideShipping?: boolean
}

export default function CartItem({ productId, sellerPubkey, amount, onQuantityChange, onRemove, hideShipping = false }: CartItemProps) {
	const [quantity, setQuantity] = useState(amount)
	const [showShipping, setShowShipping] = useState(false)

	// Fetch product data - pass sellerPubkey to support d-tag lookups
	const { data: title, isLoading: isTitleLoading } = useProductTitle(productId, sellerPubkey)
	const { data: priceTag, isLoading: isPriceLoading } = useProductPrice(productId, sellerPubkey)
	const { data: images, isLoading: isImagesLoading } = useProductImages(productId, sellerPubkey)
	const { data: stockTag, isLoading: isStockLoading } = useProductStock(productId, sellerPubkey)

	const isLoading = isTitleLoading || isPriceLoading || isImagesLoading || isStockLoading

	// Parse data
	const price = priceTag ? parseFloat(priceTag[1]) : 0
	const currency = priceTag ? priceTag[2] : 'USD'
	const stockQuantity = stockTag ? parseInt(stockTag[1]) : 0
	const subtotal = price * amount

	// Get current shipping method
	const currentShippingId = cartActions.getShippingMethod(productId)
	const hasShipping = Boolean(currentShippingId)

	// Handle quantity input change
	const handleQuantityChange = (value: string) => {
		const newQuantity = parseInt(value)
		if (!isNaN(newQuantity)) {
			setQuantity(newQuantity)
		}
	}

	// Handle quantity blur to update cart
	const handleQuantityBlur = () => {
		if (quantity !== amount) {
			onQuantityChange(productId, quantity)
		}
	}

	// Handle immediate button-based quantity changes
	const handleIncrementClick = () => {
		const newAmount = Math.min(amount + 1, stockQuantity)
		if (newAmount !== amount) {
			onQuantityChange(productId, newAmount)
		}
	}

	const handleDecrementClick = () => {
		const newAmount = Math.max(1, amount - 1)
		if (newAmount !== amount) {
			onQuantityChange(productId, newAmount)
		}
	}

	// Update local state when prop changes
	useEffect(() => {
		setQuantity(amount)
	}, [amount])

	// Get shipping cost from the cart state
	const getShippingCost = () => {
		const cart = cartStore.state.cart
		const product = cart.products[productId]
		return product?.shippingCost || 0
	}

	if (isLoading) {
		return (
			<li className="flex gap-4 pb-4 border-gray-300 [.bg-gray-100_&]:border-white border-b">
				<Skeleton className="rounded-md w-20 h-20" />
				<div className="flex flex-col flex-1 justify-between">
					<div>
						<Skeleton className="mb-1 w-24 h-5" />
						<Skeleton className="w-16 h-4" />
					</div>
					<div className="flex justify-between items-center mt-2">
						<div className="flex items-center space-x-2">
							<Skeleton className="rounded w-8 h-8" />
							<Skeleton className="rounded w-12 h-8" />
							<Skeleton className="rounded w-8 h-8" />
						</div>
					</div>
				</div>
				<Skeleton className="self-center w-16 h-5" />
			</li>
		)
	}

	return (
		<li className="flex flex-col py-4 border-gray-300 [.bg-gray-100_&]:border-white border-b">
			<div className="flex sm:flex-row flex-col sm:items-center gap-4">
				{/* Product Image */}
				{images && images.length > 0 ? (
					<div className="flex-shrink-0 border rounded-md w-16 sm:w-20 h-16 sm:h-20 overflow-hidden">
						<img
							src={images[0][1]}
							alt={title || 'Product image'}
							className="w-full h-full object-center object-cover"
							style={{ maxWidth: '100%', maxHeight: '100%' }}
						/>
					</div>
				) : (
					<div className="flex flex-shrink-0 justify-center items-center bg-gray-100 border rounded-md w-16 sm:w-20 h-16 sm:h-20 overflow-hidden text-gray-400">
						<span className="px-1 text-xs text-center leading-tight" style={{ lineHeight: '1.1' }}>
							{title ? title.split(' ').slice(0, 2).join(' ') : 'No image'}
						</span>
					</div>
				)}

				{/* Product Details */}
				<div className="flex flex-col flex-1 justify-between">
					<div>
						<h3 className="font-medium text-base">{title || 'Untitled Product'}</h3>
						<p className="mt-1 text-muted-foreground text-sm">
							{currency.toLowerCase() === 'sats' || currency.toLowerCase() === 'sat'
								? `${Math.round(price).toLocaleString()} sats`
								: `${Math.round(price * 100).toLocaleString()} sats (${price.toFixed(2)} ${currency})`}
						</p>
					</div>

					{/* Quantity Controls */}
					<div className="flex items-center mt-2">
						<div className="flex items-center space-x-2">
							<Button variant="outline" size="icon" className="w-8 h-8" onClick={handleDecrementClick} disabled={amount <= 1}>
								<Minus size={14} />
							</Button>

							<Input
								type="number"
								className="p-0 w-12 h-8 text-center"
								value={quantity}
								onChange={(e) => handleQuantityChange(e.target.value)}
								onBlur={handleQuantityBlur}
								min={1}
								max={stockQuantity}
							/>

							<Button variant="outline" size="icon" className="w-8 h-8" onClick={handleIncrementClick} disabled={amount >= stockQuantity}>
								<Plus size={14} />
							</Button>
						</div>

						{/* Delete Button */}
						<Button
							variant="ghost"
							size="icon"
							className="self-start sm:self-center hover:bg-red-50 sm:ml-auto w-8 h-8 text-red-500 hover:text-red-700"
							onClick={() => onRemove(productId)}
						>
							<Trash2 size={16} />
						</Button>
					</div>
				</div>

				{/* Product Total removed per new design */}
			</div>

			{/* Shipping Section - only show if not hidden */}
			{!hideShipping && (
				<div className="flex flex-col gap-2 mt-3 ml-0 sm:ml-24">
					<button
						className={`text-sm ${
							!hasShipping ? 'text-red-600 hover:text-red-800 font-medium' : 'text-blue-600 hover:text-blue-800'
						} text-left w-fit flex items-center gap-2`}
						onClick={() => setShowShipping(!showShipping)}
					>
						{!hasShipping && <span className="w-4 h-4 i-warning" />}
						{showShipping ? 'Hide shipping options' : hasShipping ? 'Change shipping' : 'Select shipping (required)'}
					</button>

					{showShipping && (
						<div className={`flex flex-col gap-2 ${!hasShipping ? 'border-l-2 border-yellow-400 pl-2' : ''}`}>
							<ShippingSelector
								productId={productId}
								className="w-full max-w-xs"
								onSelect={() => {}} // No-op since we handle selection inside ShippingSelector
							/>

							{getShippingCost() > 0 && (
								<div className="text-muted-foreground text-sm">
									Shipping cost: {getShippingCost()} {currency}
								</div>
							)}
						</div>
					)}

					{!showShipping && currentShippingId && getShippingCost() > 0 && (
						<div className="text-muted-foreground text-sm">
							Shipping: {getShippingCost()} {currency}
						</div>
					)}
				</div>
			)}
		</li>
	)
}
