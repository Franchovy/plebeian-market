import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Link, useNavigate } from '@tanstack/react-router'
import {
	useProductSearch,
	getProductTitle,
	getProductId,
	getProductImages,
	getProductPubkey,
	productQueryOptions,
} from '@/queries/products'
import { useQueryClient } from '@tanstack/react-query'
import { UserCard } from '../../shared/user/UserCard'

const DEBOUNCE_MS = 500

export function ProductSearch() {
	const [search, setSearch] = useState('')
	const [showResults, setShowResults] = useState(false)
	const searchContainerRef = useRef<HTMLDivElement>(null)
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const navigate = useNavigate()
	const queryClient = useQueryClient()

	const { data: results = [], isFetching, refetch } = useProductSearch(search, { enabled: false, limit: 20 })

	const handleFocus = () => {
		if (search.trim()) setShowResults(true)
	}

	const clearSearch = () => {
		setSearch('')
		setShowResults(false)
		if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
	}

	// Handle clicks outside the search container
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
				setShowResults(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
			if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
		}
	}, [])

	// Debounce search input and trigger query
	useEffect(() => {
		if (!search.trim()) {
			setShowResults(false)
			return
		}
		if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
		debounceTimerRef.current = setTimeout(() => {
			refetch()
			setShowResults(true)
		}, DEBOUNCE_MS)
	}, [search])

	const onShowResultsPage = () => {
		if (!search.trim()) return
		navigate({ to: '/search/products', search: { q: search } })
		setShowResults(false)
	}

	return (
		<div className="relative w-full" ref={searchContainerRef}>
			<Input
				type="search"
				placeholder="Search Products"
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				onFocus={handleFocus}
				className="bg-primary/90 px-4 border-none rounded-[999px] focus:ring-2 focus:ring-secondary focus-visible:ring-offset-0 w-full text-gray-100 text-md placeholder:text-gray-300 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
			/>

			<div className="top-1/2 right-4 absolute flex gap-2 -translate-y-1/2">
				{search ? (
					<button onClick={clearSearch} className="text-white/50 hover:text-white transition-colors">
						<span className="w-5 h-5 text-secondary i-close" />
					</button>
				) : (
					<span className="w-5 h-5 text-secondary i-search" />
				)}
			</div>

			{showResults && (
				<div className="top-full lg:right-0 lg:left-auto z-40 absolute flex flex-col gap-2 bg-[#1c1c1c] shadow-lg mt-2 p-2 rounded-lg w-full lg:w-[480px]">
					{results.length === 0 ? (
						<div className="p-4 text-white text-center">{isFetching ? 'Searching...' : 'No products found'}</div>
					) : (
						<div className="divide-y divide-white/10 max-h-[320px] overflow-y-auto">
							{results.map((ev) => {
								const title = getProductTitle(ev)
								const id = getProductId(ev)
								const images = getProductImages(ev)
								const sellerPubkey = getProductPubkey(ev)
								const mainImage = images?.[0]?.[1] // First image URL

								return (
									<Link
										to="/products/$productId"
										params={{ productId: ev.id }}
										key={ev.id}
										className="flex items-center gap-3 hover:bg-white/5 p-2 rounded"
										onClick={() => {
											queryClient.setQueryData(productQueryOptions(ev.id).queryKey, ev)
											setShowResults(false)
										}}
									>
										{/* Product Image */}
										{mainImage && <img src={mainImage} alt={title || 'Product'} className="rounded w-8 h-8 object-cover shrink-0" />}

										{/* Content Section */}
										<div className="flex flex-1 items-center gap-2 min-w-0">
											<span className="text-white text-sm truncate">{title || id || ev.id}</span>
											{sellerPubkey && (
												<>
													<span className="text-gray-400 text-xs">by</span>
													<UserCard pubkey={sellerPubkey} size="xs" onPress="none" />
												</>
											)}
										</div>

										<span className="w-4 h-4 text-secondary i-external-link shrink-0" />
									</Link>
								)
							})}
						</div>
					)}
					<div className="pt-1">
						<button
							onClick={onShowResultsPage}
							className="py-2 w-full font-medium text-secondary hover:text-white text-xs text-center transition-colors"
						>
							Show search results in page
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
