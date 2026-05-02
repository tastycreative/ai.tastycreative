import { auth } from "@/lib/clerk-compat";

export interface Context {
  userId?: string | null;
}

export async function createTRPCContext(): Promise<Context> {
  try {
    const { userId } = await auth();
    return {
      userId,
    };
  } catch (error) {
    console.error('Error creating tRPC context:', error);
    return {
      userId: null,
    };
  }
}