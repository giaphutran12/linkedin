4 hours into my n8n clone:
finishing up prisma orm, neon, and trpc settings for end to end type safety. Trpc is definitely painful to setup at first, but it's definitely necessary if you want to build serious project.
Refreshing my memory on hydration and how to send data from server to client
The fastest way to fetch data is to prefetch it in page.tsx (keep it a server component), then suspense query it in the client component. This way, you get the best of both worlds: the ability to use the all the hooks in the client component, and the speed in server component.
