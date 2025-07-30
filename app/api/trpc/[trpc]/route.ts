import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { auth } from '@clerk/nextjs/server';
import { appRouter } from '../../../../server/router';

const handler = async (req: Request) => {
  const { userId } = await auth();
  
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ({ userId: userId || null }),
  });
};

export { handler as GET, handler as POST };