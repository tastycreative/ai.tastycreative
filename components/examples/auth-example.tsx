'use client';

import { useUser } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc-client';
import { useState } from 'react';

export function AuthExample() {
  const { isSignedIn, user } = useUser();
  const [newTodo, setNewTodo] = useState('');
  
  const { data: profile, isLoading: profileLoading } = trpc.getProfile.useQuery(
    undefined, 
    { enabled: isSignedIn }
  );
  
  const { data: userTodos, isLoading: todosLoading } = trpc.getUserTodos.useQuery(
    undefined,
    { enabled: isSignedIn }
  );

  const createTodoMutation = trpc.createTodo.useMutation({
    onSuccess: () => {
      setNewTodo('');
      // Optionally refetch todos here
    },
  });

  const handleCreateTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodo.trim()) {
      createTodoMutation.mutate({ text: newTodo });
    }
  };

  if (!isSignedIn) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
          Authentication Required
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Please sign in to view protected tRPC routes and user-specific data.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
        Protected tRPC Routes
      </h2>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Profile</h3>
          {profileLoading ? (
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          ) : profile ? (
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <p className="text-sm text-gray-600 dark:text-gray-400">User ID: {profile.userId}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Message: {profile.message}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Time: {new Date(profile.timestamp).toLocaleTimeString()}</p>
            </div>
          ) : null}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Private Todos</h3>
          {todosLoading ? (
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          ) : userTodos ? (
            <ul className="space-y-1">
              {userTodos.map((todo) => (
                <li key={todo.id} className={`text-sm ${todo.completed ? 'line-through text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                  {todo.text}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Create Todo</h3>
          <form onSubmit={handleCreateTodo} className="flex space-x-2">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="New todo..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm"
            />
            <button
              type="submit"
              disabled={createTodoMutation.isPending}
              className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {createTodoMutation.isPending ? 'Adding...' : 'Add'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}