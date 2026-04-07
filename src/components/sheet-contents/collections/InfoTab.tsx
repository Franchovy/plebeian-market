import { ImageUploader } from '@/components/shared/ImageUploader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { collectionFormStore, collectionFormActions } from '@/lib/stores/collection'
import { useForm } from '@tanstack/react-form'
import { useStore } from '@tanstack/react-store'

export function InfoTab() {
	const { name, summary, description, headerImageUrl } = useStore(collectionFormStore)

	const form = useForm({
		defaultValues: {
			name: name,
			summary: summary,
			description: description,
		},
		onSubmit: async ({ value }) => {
			collectionFormActions.updateValues({
				name: value.name,
				summary: value.summary,
				description: value.description,
			})
		},
	})

	const handleSaveImage = ({ url }: { url: string }) => {
		collectionFormActions.updateValues({ headerImageUrl: url })
	}

	const handleDeleteImage = () => {
		collectionFormActions.updateValues({ headerImageUrl: '' })
	}

	return (
		<div className="space-y-4">
			<div className="space-y-4">
				<div className="space-y-2">
					<Label>Header Image</Label>
					<p className="text-gray-600 text-sm">We recommend using images of 1500x500 and under 2mb.</p>

					<ImageUploader
						src={headerImageUrl || null}
						index={0}
						imagesLength={1}
						onSave={handleSaveImage}
						onDelete={handleDeleteImage}
						initialUrl=""
						data-testid="collection-header-image-uploader"
					/>
				</div>
			</div>

			<form.Field
				name="name"
				validators={{
					onChange: (field) => (!field.value ? 'Collection name is required' : undefined),
				}}
			>
				{(field) => (
					<div className="gap-1.5 grid w-full">
						<Label htmlFor={field.name}>
							<span className="after:ml-0.5 after:text-red-500 after:content-['*']">Collection Name</span>
						</Label>
						<Input
							id={field.name}
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => {
								field.handleChange(e.target.value)
								collectionFormActions.updateValues({ name: e.target.value })
							}}
							className="border-2"
							placeholder="e.g. Clothes Collection"
							required
							data-testid="collection-name-input"
						/>
						{field.state.meta.errors?.length > 0 && field.state.meta.isTouched && (
							<div className="mt-1 text-red-500 text-sm">{field.state.meta.errors.join(', ')}</div>
						)}
					</div>
				)}
			</form.Field>

			<form.Field name="summary">
				{(field) => (
					<div className="gap-1.5 grid w-full">
						<Label htmlFor={field.name}>Summary (Optional)</Label>
						<Input
							id={field.name}
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => {
								field.handleChange(e.target.value)
								collectionFormActions.updateValues({ summary: e.target.value })
							}}
							className="border-2"
							placeholder="A short summary of your collection"
							data-testid="collection-summary-input"
						/>
						<p className="text-gray-500 text-xs">A brief one-line summary displayed in collection listings</p>
					</div>
				)}
			</form.Field>

			<form.Field
				name="description"
				validators={{
					onChange: (field) => (!field.value ? 'Description is required' : undefined),
				}}
			>
				{(field) => (
					<div className="gap-1.5 grid w-full">
						<Label htmlFor={field.name}>
							<span className="after:ml-0.5 after:text-red-500 after:content-['*']">Description</span>
						</Label>
						<textarea
							id={field.name}
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => {
								field.handleChange(e.target.value)
								collectionFormActions.updateValues({ description: e.target.value })
							}}
							className="p-2 border-2 rounded-md min-h-24"
							placeholder="Bitaxe Miners"
							required
							data-testid="collection-description-input"
						/>
						{field.state.meta.errors?.length > 0 && field.state.meta.isTouched && (
							<div className="mt-1 text-red-500 text-sm">{field.state.meta.errors.join(', ')}</div>
						)}
					</div>
				)}
			</form.Field>
		</div>
	)
}
