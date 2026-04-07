import { postsQueryOptions } from '@/queries/posts'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { PostView } from '@/components/features/posts/PostView'

export const Route = createFileRoute('/posts/')({
	loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(postsQueryOptions),
	component: PostsRoute,
})

function PostsRoute() {
	const postsQuery = useSuspenseQuery(postsQueryOptions)
	const posts = postsQuery.data

	return (
		<div className="p-4">
			<h1 className="mb-4 font-bold text-2xl">Nostr Posts</h1>
			<div className="space-y-4">
				{posts.map((post) => (
					<PostView key={post.id} post={post} />
				))}
			</div>
		</div>
	)
}
