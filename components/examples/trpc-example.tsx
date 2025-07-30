'use client';

import { trpc } from '@/lib/trpc-client';
import { useState } from 'react';

export function TRPCExample() {
  const [name, setName] = useState('World');
  
  const { data: greeting, isLoading: greetingLoading } = trpc.hello.useQuery({ name });
  const { data: todos, isLoading: todosLoading } = trpc.getTodos.useQuery();

  return (
    <div className="p-6 max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">tRPC Example</h2>
      
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Name:
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Greeting:</h3>
        {greetingLoading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        ) : (
          <p className="text-green-600">{greeting?.greeting}</p>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Todos:</h3>
        {todosLoading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        ) : (
          <ul className="list-disc list-inside">
            {todos?.map((todo) => (
              <li key={todo.id} className={todo.completed ? 'line-through' : ''}>
                {todo.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}