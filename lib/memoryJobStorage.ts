// Simple in-memory job storage for development when database is unavailable
interface Job {
  id: string;
  clerkId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  resultUrls?: string[];
  runpodJobId?: string;
  createdAt: Date;
  updatedAt: Date;
  type: string;
  params: any;
}

const inMemoryJobs = new Map<string, Job>();

export function addJobToMemory(job: Job) {
  inMemoryJobs.set(job.id, job);
  console.log('📝 Added job to memory storage:', job.id);
}

export function getJobFromMemory(jobId: string): Job | null {
  const job = inMemoryJobs.get(jobId);
  console.log('🔍 Getting job from memory:', jobId, job ? 'found' : 'not found');
  return job || null;
}

export function updateJobInMemory(jobId: string, updates: Partial<Job>): Job | null {
  const job = inMemoryJobs.get(jobId);
  if (!job) {
    console.log('❌ Job not found in memory for update:', jobId);
    return null;
  }

  const updatedJob = { ...job, ...updates, updatedAt: new Date() };
  inMemoryJobs.set(jobId, updatedJob);
  console.log('✅ Updated job in memory:', jobId, updates);
  return updatedJob;
}

export function getAllJobsFromMemory(clerkId: string): Job[] {
  const userJobs = Array.from(inMemoryJobs.values()).filter(job => job.clerkId === clerkId);
  console.log('📋 Getting all jobs from memory for user:', clerkId, 'found:', userJobs.length);
  return userJobs;
}
