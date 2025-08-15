"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";

export default function BlobTestPage() {
  const [status, setStatus] = useState<string>("Ready to test");
  const [result, setResult] = useState<any>(null);

  const testAuth = async () => {
    setStatus("Testing authentication...");
    try {
      const response = await fetch("/api/debug/blob-token", {
        method: "POST",
      });
      const data = await response.json();
      setResult(data);
      setStatus(`Auth test ${data.success ? "successful" : "failed"}`);
    } catch (error) {
      setStatus(`Auth test failed: ${error}`);
      setResult({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const testServerUpload = async () => {
    setStatus("Testing server-side upload...");
    try {
      const response = await fetch("/api/debug/test-upload", {
        method: "POST",
      });
      const data = await response.json();
      setResult(data);
      setStatus(`Server upload ${data.success ? "successful" : "failed"}`);
    } catch (error) {
      setStatus(`Server upload failed: ${error}`);
      setResult({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const testServerFileUpload = async () => {
    setStatus("Testing server-side file upload...");
    try {
      // Create a test file
      const testContent = `Test LoRA file from server at ${new Date().toISOString()}`;
      const testFile = new File([testContent], "test-lora.safetensors", {
        type: "application/octet-stream",
      });

      const formData = new FormData();
      formData.append("file", testFile);
      formData.append("displayName", "Test LoRA");
      formData.append("description", "Test description");

      const response = await fetch("/api/user/influencers/server-upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setResult(data);
      setStatus(`Server file upload ${data.success ? "successful" : "failed"}`);
    } catch (error) {
      setStatus(`Server file upload failed: ${error}`);
      setResult({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const testDirectUpload = async () => {
    setStatus("Testing direct upload to ComfyUI...");
    try {
      // Create a test file
      const testContent = `Test LoRA file for direct upload at ${new Date().toISOString()}`;
      const testFile = new File([testContent], "test-direct.safetensors", {
        type: "application/octet-stream",
      });

      const formData = new FormData();
      formData.append("file", testFile);
      formData.append("displayName", "Test Direct Upload");
      formData.append(
        "description",
        "Test direct upload bypassing blob storage"
      );

      const response = await fetch("/api/user/influencers/direct-upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setResult(data);
      setStatus(`Direct upload ${data.success ? "successful" : "failed"}`);
    } catch (error) {
      setStatus(`Direct upload failed: ${error}`);
      setResult({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const testBlobComplete = async () => {
    setStatus("Testing blob-complete endpoint...");
    try {
      const response = await fetch("/api/debug/test-blob-complete", {
        method: "POST",
      });
      const data = await response.json();
      setResult(data);
      setStatus(`Blob-complete test ${data.success ? "successful" : "failed"}`);
    } catch (error) {
      setStatus(`Blob-complete test failed: ${error}`);
      setResult({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const testClientUpload = async () => {
    setStatus("Testing client-side upload...");
    try {
      // Create a simple test file
      const testContent = `Test file from client at ${new Date().toISOString()}`;
      const testFile = new File([testContent], "client-test.txt", {
        type: "text/plain",
      });

      console.log("Starting client upload...");
      const blob = await upload(`client-test-${Date.now()}.txt`, testFile, {
        access: "public",
        handleUploadUrl: "/api/user/influencers/upload-url",
      });

      setResult({ success: true, url: blob.url, method: "client-side" });
      setStatus("Client upload successful");
    } catch (error) {
      console.error("Client upload error:", error);
      setStatus(`Client upload failed: ${error}`);
      setResult({
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : "No stack trace",
      });
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Vercel Blob Test Page</h1>

      <div className="space-y-4">
        <div>
          <button
            onClick={testAuth}
            className="bg-blue-500 text-white px-4 py-2 rounded mr-4"
          >
            Test Authentication
          </button>
          <button
            onClick={testDirectUpload}
            className="bg-green-500 text-white px-4 py-2 rounded mr-4"
          >
            Test Direct Upload
          </button>
          <button
            onClick={testServerFileUpload}
            className="bg-yellow-500 text-white px-4 py-2 rounded mr-4"
          >
            Test Server File Upload
          </button>
          <button
            onClick={testBlobComplete}
            className="bg-orange-500 text-white px-4 py-2 rounded mr-4"
          >
            Test Blob Complete
          </button>
          <button
            onClick={testClientUpload}
            className="bg-purple-500 text-white px-4 py-2 rounded"
          >
            Test Client Upload
          </button>
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-semibold">Status:</h3>
          <p className="text-gray-700">{status}</p>
        </div>

        {result && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold">Result:</h3>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
