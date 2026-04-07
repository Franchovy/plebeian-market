import { cartActions, useCart } from '@/lib/stores/cart'
import { ndkActions } from '@/lib/stores/ndk'
import { uiActions } from '@/lib/stores/ui'
import {
	getProductImages,
	getProductPrice,
	getProductStock,
	getProductTitle,
	getProductVisibility,
	isNSFWProduct,
	productQueryOptions,
} from '@/queries/products'
import { NDKEvent } from '@nostr-dev-kit/ndk'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PriceDisplay } from './PriceDisplay'
import { Button } from '@/components/ui/button'
import { authStore, useAuth } from '@/lib/stores/auth'
import { ZapButton } from '@/components/shared/social/ZapButton'

export interface ProductCardProps {
	product: NDKEvent
}

export function ProductCard({ product }: ProductCardProps) {
	const title = getProductTitle(product)
	const images = getProductImages(product)
	const price = getProductPrice(product)
	const stockTag = getProductStock(product)
	const stockQuantity = stockTag ? parseInt(stockTag[1]) : undefined
	const visibilityTag = getProductVisibility(product)
	const visibility = visibilityTag?.[1] || 'on-sale'
	const isNSFW = isNSFWProduct(product)
	// Out of stock if stock is explicitly 0 or undefined (no stock tag), but not for pre-order items
	const isOutOfStock = visibility !== 'pre-order' && (stockQuantity === undefined || stockQuantity === 0)
	const [isAddingToCart, setIsAddingToCart] = useState(false)
	const [showConfirmation, setShowConfirmation] = useState(false)
	const location = useLocation()
	const cart = useCart()
	const queryClient = useQueryClient()
	const { user, isAuthenticated } = useAuth()

	const isOwnProduct = isAuthenticated && user?.pubkey === product.author.pubkey

	// Check if product is already in cart
	const isInCart = !!cart.cart.products[product.id]
	const cartQuantity = isInCart ? cart.cart.products[product.id]?.amount || 0 : 0

	const handleAddToCart = async () => {
		if (isOwnProduct || visibility === 'hidden' || isOutOfStock) return // Don't allow adding own products, hidden products, or out of stock items

		// Check if adding would exceed available stock
		if (stockQuantity !== undefined && cartQuantity >= stockQuantity) return

		setIsAddingToCart(true)
		try {
			await cartActions.addProduct(product)
			setShowConfirmation(true)
			setTimeout(() => setShowConfirmation(false), 1200)
		} finally {
			setIsAddingToCart(false)
		}
	}

	const handleProductClick = () => {
		// Seed the product details cache so the product page can render immediately on navigation.
		queryClient.setQueryData(productQueryOptions(product.id).queryKey, product)

		// Store the current path as the source path
		// This will also store it as originalResultsPath if not already set
		uiActions.setProductSourcePath(location.pathname)
	}

	const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
		e.preventDefault()
		e.stopPropagation()
		action()
	}

	return (
		<Link
			to={`/products/${product.id}`}
			onClick={handleProductClick}
			className="flex flex-col bg-white shadow-sm hover:shadow-md border border-zinc-800 rounded-lg w-full max-w-full overflow-hidden transition-shadow duration-200 cursor-pointer"
			data-testid="product-card"
		>
			{/* Square aspect ratio container for image */}
			<div className="block relative border-zinc-800 border-b aspect-square overflow-hidden">
				{images && images.length > 0 ? (
					<img
						src={images[0][1]}
						alt={title}
						className="rounded-t-[calc(var(--radius)-1px)] w-full h-full object-cover hover:scale-105 transition-transform duration-200"
					/>
				) : (
					<div className="flex justify-center items-center bg-gray-100 hover:bg-gray-200 rounded-lg w-full h-full text-gray-400 transition-colors duration-200">
						No image
					</div>
				)}
				{/* NSFW badge */}
				{isNSFW && <div className="top-2 left-2 absolute bg-amber-500 px-1.5 py-0.5 rounded font-bold text-[10px] text-white">NSFW</div>}
			</div>

			<div className="flex flex-col flex-grow gap-2 p-2">
				{/* Product title */}
				<h2 className="pb-2 border-[var(--light-gray)] border-b overflow-hidden font-medium text-sm text-ellipsis whitespace-nowrap">
					{title}
				</h2>

				{/* Pricing section */}
				<div className="flex justify-between items-center">
					{price && <PriceDisplay priceValue={parseFloat(price[1])} originalCurrency={price[2] || 'SATS'} />}

					{/* Stock/Pre-order indicator - right aligned */}
					{visibility === 'pre-order' ? (
						<div className="bg-blue-100 px-4 py-1 rounded-full font-medium text-blue-800 text-xs">Pre-order</div>
					) : isOutOfStock ? (
						<div className="bg-red-100 px-4 py-1 rounded-full font-medium text-red-800 text-xs">Out of stock</div>
					) : stockQuantity !== undefined ? (
						<div className="bg-[var(--light-gray)] px-4 py-1 rounded-full font-medium text-xs">{stockQuantity} in stock</div>
					) : null}
				</div>

				{/* Add a flex spacer to push the button to the bottom */}
				<div className="flex-grow"></div>

				{/* Add to cart button */}
				<div className="flex gap-2">
					<div className="flex-grow transition-all duration-300 ease-in-out">
						{isOwnProduct ? (
							<Button
								className="bg-black disabled:bg-gray-400 px-4 py-3 rounded-lg w-full font-medium text-white transition-all duration-300 disabled:cursor-not-allowed"
								disabled={true}
							>
								Your Product
							</Button>
						) : isInCart ? (
							<div className="flex gap-2 w-full">
								{/* Show current quantity */}
								<div className="flex justify-center items-center bg-pink-100 px-2 border-2 border-pink-300 rounded-lg h-10 font-medium text-pink-800 text-sm transition-all duration-200 ease-in-out">
									{cartQuantity}
								</div>
								{/* Add more button */}
								<Button
									className="flex-grow bg-black disabled:bg-gray-400 px-4 py-3 rounded-lg font-medium text-white transition-all duration-200 ease-in-out disabled:cursor-not-allowed"
									onClick={(e) => handleButtonClick(e, handleAddToCart)}
									disabled={isAddingToCart || visibility === 'hidden' || (stockQuantity !== undefined && cartQuantity >= stockQuantity)}
								>
									{isAddingToCart ? (
										'Adding...'
									) : showConfirmation ? (
										<>
											<Check className="mr-2 w-4 h-4" /> Added
										</>
									) : stockQuantity !== undefined && cartQuantity >= stockQuantity ? (
										'Max'
									) : (
										'Add'
									)}
								</Button>
							</div>
						) : (
							<Button
								className={`py-3 px-4 rounded-lg w-full font-medium transition-all duration-300 bg-black text-white disabled:bg-gray-400 disabled:cursor-not-allowed ${
									isAddingToCart ? 'opacity-75 scale-95' : ''
								}`}
								onClick={(e) => handleButtonClick(e, handleAddToCart)}
								disabled={isOwnProduct || isAddingToCart || visibility === 'hidden' || isOutOfStock}
							>
								{visibility === 'hidden' ? (
									'Not Available'
								) : isOutOfStock ? (
									'Out of Stock'
								) : showConfirmation ? (
									<>
										<Check className="mr-2 w-4 h-4" /> Added!
									</>
								) : isAddingToCart ? (
									'Adding...'
								) : visibility === 'pre-order' ? (
									'Pre-order'
								) : (
									'Add to Cart'
								)}
							</Button>
						)}
					</div>
					<div>
						<ZapButton event={product} />
					</div>
				</div>
			</div>
		</Link>
	)
}
