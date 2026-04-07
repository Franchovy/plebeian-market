import { CurrencyDropdown } from '@/components/features/header/CurrencyDropdown'
import { Pattern } from '@/components/pattern'
import { authActions, authStore } from '@/lib/stores/auth'
import { uiActions, uiStore } from '@/lib/stores/ui'
import { cn } from '@/lib/utils'
import { useConfigQuery } from '@/queries/config'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { Link, useMatchRoute } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { useEffect } from 'react'

export function MobileMenu() {
	const { mobileMenuOpen } = useStore(uiStore)
	const { isAuthenticated } = useStore(authStore)
	const { data: config } = useConfigQuery()
	const matchRoute = useMatchRoute()
	const [animationParent] = useAutoAnimate<HTMLDivElement>()

	// Close menu on escape key
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && mobileMenuOpen) {
				uiActions.closeMobileMenu()
			}
		}

		document.addEventListener('keydown', handleEscape)
		return () => document.removeEventListener('keydown', handleEscape)
	}, [mobileMenuOpen])

	// Prevent body scroll when menu is open
	useEffect(() => {
		if (mobileMenuOpen) {
			document.body.style.overflow = 'hidden'
		} else {
			document.body.style.overflow = 'unset'
		}

		return () => {
			document.body.style.overflow = 'unset'
		}
	}, [mobileMenuOpen])

	const handleLinkClick = () => {
		uiActions.closeMobileMenu()
	}

	const handleLogout = () => {
		authActions.logout()
		uiActions.closeMobileMenu()
	}

	const menuItems = [
		{ to: '/', label: 'Home' },
		{ to: '/products', label: 'Products' },
		{ to: '/community', label: 'Community' },
		...(config?.appSettings?.showNostrLink ? [{ to: '/nostr', label: 'Nostr' }] : []),
		...(isAuthenticated ? [{ to: '/dashboard', label: 'Dashboard' }] : []),
	]

	return (
		<div ref={animationParent}>
			{mobileMenuOpen && (
				<div className={cn('top-16 right-0 bottom-0 left-0 z-40 fixed bg-black/90')} onClick={() => uiActions.closeMobileMenu()}>
					{/* Dots Pattern Overlay */}
					<Pattern pattern="dots" className="opacity-30" />

					{/* Menu Content */}
					<div className="z-10 relative flex flex-col justify-center items-center h-full" onClick={(e) => e.stopPropagation()}>
						<nav className="flex flex-col items-stretch gap-4 w-full max-w-sm">
							{menuItems.map((item) => {
								const isActive = matchRoute({ to: item.to, fuzzy: item.to !== '/' })
								return (
									<Link
										key={item.to}
										to={item.to}
										className={cn(
											'px-6 py-3 rounded-lg font-normal text-lg text-center uppercase tracking-wider transition-colors',
											isActive ? 'bg-black text-secondary' : 'text-white hover:text-secondary',
										)}
										onClick={handleLinkClick}
									>
										{item.label}
									</Link>
								)
							})}
							{isAuthenticated && (
								<div className="px-8 py-3">
									<button
										onClick={handleLogout}
										className="w-full font-normal text-white hover:text-secondary text-lg text-center uppercase tracking-wider transition-colors"
									>
										Log out
									</button>
								</div>
							)}

							{/* Currency Dropdown for mobile */}
							<div className="flex justify-center px-6 py-3">
								<CurrencyDropdown />
							</div>
						</nav>
					</div>
				</div>
			)}
		</div>
	)
}
