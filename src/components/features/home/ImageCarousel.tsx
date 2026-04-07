import { cn } from '@/lib/utils'
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel'
import { ImageOff } from 'lucide-react'
import { useState, useEffect } from 'react'

interface ProductImage {
	url: string
	dimensions?: string
	order?: number
}

interface ImageCarouselProps {
	images: ProductImage[]
	title: string
	className?: string
	onImageChange?: (index: number) => void
	onImageClick?: (index: number) => void
}

export function ImageCarousel({ images, title, className, onImageChange, onImageClick }: ImageCarouselProps) {
	const [currentIndex, setCurrentIndex] = useState(0)
	const [api, setApi] = useState<CarouselApi>()
	const [previewApiVertical, setPreviewApiVertical] = useState<CarouselApi>()

	useEffect(() => {
		if (!api) return

		api.on('select', () => {
			const newIndex = api.selectedScrollSnap()
			setCurrentIndex(newIndex)
			previewApiVertical?.scrollTo(newIndex)
			onImageChange?.(newIndex)
		})
	}, [api, onImageChange, previewApiVertical])

	// Call onImageChange when component mounts or images change
	useEffect(() => {
		if (images.length > 0) {
			onImageChange?.(0)
		}
	}, [images, onImageChange])

	const handlePreviewClick = (index: number) => {
		api?.scrollTo(index)
		setCurrentIndex(index)
		onImageChange?.(index)
	}

	if (!images || images.length === 0) {
		return (
			<div className={cn('relative bg-zinc-900 w-full h-full', className)}>
				<div className="flex justify-center items-center w-full h-full">
					<ImageOff className="w-12 h-12 text-zinc-500" />
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-4 h-full">
			{/* Main Carousel */}
			<Carousel setApi={setApi} className="w-full aspect-square">
				<CarouselContent>
					{images.map((image, index) => (
						<CarouselItem key={index} className="relative flex justify-center items-center bg-black aspect-square">
							{index === currentIndex && <div className="z-0 absolute inset-0 bg-dots-image-overlay pointer-events-none" />}
							<button
								onClick={() => onImageClick?.(index)}
								className="z-10 relative flex justify-center items-center w-full h-full cursor-pointer"
								aria-label={`View ${title} - Image ${index + 1} in full size`}
							>
								<img src={image.url} alt={`${title} - Image ${index + 1}`} className="max-w-full max-h-full object-contain" />
							</button>
						</CarouselItem>
					))}
				</CarouselContent>
			</Carousel>

			{/* Preview Images - horizontal row below main image */}
			{images.length > 1 && (
				<Carousel
					setApi={setPreviewApiVertical}
					opts={{
						align: 'start',
					}}
					className="w-full"
				>
					<CarouselContent className="ml-1">
						{images.map((image, index) => (
							<CarouselItem key={index} className="p-2 basis-1/4 sm:basis-1/5 md:basis-1/6 lg:basis-1/6">
								<button
									className={cn(
										'relative flex-shrink-0 p-1 w-full transition-all',
										index === currentIndex ? 'ring-2 ring-secondary' : 'hover:ring-1 hover:ring-primary/50',
									)}
									onClick={() => handlePreviewClick(index)}
								>
									<div className="relative bg-black border border-gray-800 w-full aspect-square overflow-hidden">
										<img className="w-full h-full object-cover" src={image.url} alt={`${title} thumbnail ${index + 1}`} />
									</div>
									{index === currentIndex && <div className="right-1 bottom-1 absolute bg-primary rounded-full w-2 h-2" />}
								</button>
							</CarouselItem>
						))}
					</CarouselContent>
				</Carousel>
			)}
		</div>
	)
}
