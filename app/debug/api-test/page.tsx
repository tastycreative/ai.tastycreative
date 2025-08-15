"use client";

import { useApiClient } from '@/lib/apiClient';
import { useAuth } from '@clerk/nextjs';
import { useState } from 'react';

export default function ApiTestPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const apiClient = useApiClient();
  const { isSignedIn, userId, getToken } = useAuth();

  const testProcessBlob = async () => {
    setLoading(true);
    setResult('');
    
    try {
      console.log('=== API TEST START ===');
      console.log('User signed in:', isSignedIn);
      console.log('User ID:', userId);
      
      if (!apiClient) {
        setResult('❌ API client not ready');
        return;
      }
      
      // Get token for debugging
      const token = await getToken();
      console.log('Token available:', !!token);
      console.log('Token preview:', token?.substring(0, 20) + '...');
      
      // Test the API call
      const response = await apiClient.post('/api/user/influencers/process-blob', {
        test: true,
        timestamp: new Date().toISOString()
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      const data = await response.json();
      console.log('Response data:', data);
      
      setResult(`✅ Success: ${JSON.stringify(data, null, 2)}`);
      
    } catch (error) {
      console.error('❌ Test error:', error);
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const testDirectFetch = async () => {
    setLoading(true);
    setResult('');
    
    try {
      console.log('=== DIRECT FETCH TEST ===');
      
      const token = await getToken();
      
      const response = await fetch('/api/user/influencers/process-blob', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString()
        })
      });
      
      console.log('Direct fetch response status:', response.status);
      console.log('Direct fetch response headers:', Object.fromEntries(response.headers.entries()));
      
      const data = await response.json();
      console.log('Direct fetch response data:', data);
      
      setResult(`✅ Direct Fetch Success: ${JSON.stringify(data, null, 2)}`);
      
    } catch (error) {
      console.error('❌ Direct fetch error:', error);
      setResult(`❌ Direct Fetch Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">API Test Debug Page</h1>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="font-semibold mb-2">Auth Status:</h2>
        <p>Signed In: {isSignedIn ? '✅' : '❌'}</p>
        <p>User ID: {userId || 'None'}</p>
        <p>API Client Ready: {apiClient ? '✅' : '❌'}</p>
      </div>
      
      <div className="space-x-4 mb-6">
        <button
          onClick={testProcessBlob}
          disabled={loading || !apiClient}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test API Client'}
        </button>
        
        <button
          onClick={testDirectFetch}
          disabled={loading || !isSignedIn}
          className="bg-green-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Direct Fetch'}
        </button>
      </div>
      
      {result && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Result:</h3>
          <pre className="whitespace-pre-wrap text-sm">{result}</pre>
        </div>
      )}
    </div>
  );
}
