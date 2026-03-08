'use client';

import { useState } from 'react';
import { useSpaceBySlug } from '@/lib/hooks/useSpaces.query';
import {
  useUpdateSpaceWebhook,
  useRegenerateWebhookSecret,
  type WebhookConfig,
} from '@/lib/hooks/useSpaceWebhook.query';
import { Loader2, Info, Copy, Check, Eye, EyeOff, RefreshCw } from 'lucide-react';

interface Props {
  slug: string;
}

export function SpaceWebhookSettings({ slug }: Props) {
  const { data: space, isLoading } = useSpaceBySlug(slug);

  const config = (space?.config as Record<string, unknown>) ?? {};
  const webhook = (config.webhook as WebhookConfig | undefined) ?? {
    enabled: false,
    secret: '',
  };

  const updateMutation = useUpdateSpaceWebhook(space?.id, config);
  const regenerateMutation = useRegenerateWebhookSecret(space?.id);

  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState<'url' | 'secret' | 'curl' | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const webhookUrl =
    typeof window !== 'undefined' && space?.id
      ? `${window.location.origin}/api/spaces/${space.id}/webhook/onboarding`
      : '';

  const handleToggle = async (enabled: boolean) => {
    if (enabled && !webhook.secret) {
      // First enable — generate a secret
      const result = await regenerateMutation.mutateAsync();
      updateMutation.mutate({ enabled: true, secret: result.secret });
    } else {
      updateMutation.mutate({ ...webhook, enabled });
    }
  };

  const handleRegenerate = async () => {
    const result = await regenerateMutation.mutateAsync();
    updateMutation.mutate({ ...webhook, secret: result.secret });
    setConfirmRegenerate(false);
    setShowSecret(true);
  };

  const copyToClipboard = (text: string, type: 'url' | 'secret' | 'curl') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-light-pink" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          Loading settings...
        </span>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-500 dark:text-gray-400">Space not found</p>
      </div>
    );
  }

  const maskedSecret = webhook.secret
    ? `${webhook.secret.slice(0, 10)}${'*'.repeat(Math.max(0, webhook.secret.length - 10))}`
    : '';

  const curlExample = `curl -X POST '${webhookUrl}' \\
  -H 'Content-Type: application/json' \\
  -H 'x-webhook-secret: YOUR_SECRET_HERE' \\
  -d '{
    "title": "New Model Onboarding - Jane Doe",
    "fields": {
      "Full Name": "Jane Doe",
      "Model Name? (if different from legal name)": "JD",
      "Email address": "jane@example.com",
      "When is your Birthday?": "1995-06-15",
      "What is your OnlyFans Free Profile?": "https://onlyfans.com/janedoe",
      "What is your Instagram @?": "@janedoe"
    }
  }'`;

  const isBusy = updateMutation.isPending || regenerateMutation.isPending;

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Webhook
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Allow external services to create onboarding tasks automatically via webhook
        </p>
      </div>

      {/* Enable/Disable toggle */}
      <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-2xl p-6 space-y-1">
        <div className="flex items-center justify-between py-2">
          <div className="pr-4">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Enable webhook
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Accept incoming requests to create onboarding tasks
            </p>
          </div>
          <Toggle
            checked={webhook.enabled}
            onChange={handleToggle}
            disabled={isBusy}
          />
        </div>
      </div>

      {/* Webhook URL + Secret — only visible when enabled */}
      {webhook.enabled && webhook.secret && (
        <>
          {/* Webhook URL */}
          <div className="mt-4 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-2xl p-6">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              Webhook URL
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Send POST requests to this endpoint
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 font-mono break-all">
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(webhookUrl, 'url')}
                className="shrink-0 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                title="Copy URL"
              >
                {copied === 'url' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Secret */}
          <div className="mt-4 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-2xl p-6">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              Webhook Secret
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Include this in the <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[11px]">x-webhook-secret</code> header
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 font-mono break-all">
                {showSecret ? webhook.secret : maskedSecret}
              </code>
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="shrink-0 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                title={showSecret ? 'Hide secret' : 'Show secret'}
              >
                {showSecret ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(webhook.secret, 'secret')}
                className="shrink-0 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                title="Copy secret"
              >
                {copied === 'secret' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>

            {/* Regenerate */}
            <div className="mt-3">
              {confirmRegenerate ? (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-red-500 dark:text-red-400">
                    This will invalidate the current secret. Continue?
                  </p>
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={isBusy}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {regenerateMutation.isPending ? 'Regenerating...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRegenerate(false)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRegenerate(true)}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate secret
                </button>
              )}
            </div>
          </div>

          {/* Usage Guide */}
          <div className="mt-4 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-brand-mid-pink/20 rounded-2xl p-6">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Usage Guide
            </p>

            <div className="space-y-4">
              {/* Headers */}
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Required Headers
                </p>
                <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                  <code className="text-xs text-gray-600 dark:text-gray-400 font-mono block">
                    Content-Type: application/json
                  </code>
                  <code className="text-xs text-gray-600 dark:text-gray-400 font-mono block">
                    x-webhook-secret: your_secret_here
                  </code>
                </div>
              </div>

              {/* Payload */}
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Request Body
                </p>
                <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 dark:text-gray-400 space-y-0.5">
                  <p><span className="text-brand-dark-pink dark:text-brand-light-pink">title</span> <span className="text-gray-400">(string, required)</span> — Task title</p>
                  <p><span className="text-brand-dark-pink dark:text-brand-light-pink">fields</span> <span className="text-gray-400">(object)</span> — Key-value pairs from your form/sheet</p>
                  <p className="pl-3 text-gray-500">Keys = column headers, values = responses</p>
                  <p className="pl-3 text-gray-500">Any fields added will auto-appear in the task</p>
                  <p className="mt-1"><span className="text-gray-500 dark:text-gray-400">tags</span> <span className="text-gray-400">(string[], optional)</span> — Tags</p>
                  <p><span className="text-gray-500 dark:text-gray-400">notes</span> <span className="text-gray-400">(string, optional)</span> — Additional notes</p>
                </div>
              </div>

              {/* Response */}
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Response (201)
                </p>
                <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                  <code className="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre">{`{ "success": true, "id": "...", "taskKey": "...", "itemNo": 1 }`}</code>
                </div>
              </div>

              {/* Curl example */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Example
                  </p>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(curlExample, 'curl')}
                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {copied === 'curl' ? (
                      <>
                        <Check className="h-3 w-3 text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-600 dark:text-gray-400 font-mono overflow-x-auto whitespace-pre">
                  {curlExample}
                </pre>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Info note */}
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-blue/5 dark:bg-brand-blue/10 border border-brand-blue/15 px-4 py-3">
        <Info className="h-4 w-4 text-brand-blue shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Tasks created via webhook will appear in the first column of the first board with the default onboarding checklist.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle switch                                                      */
/* ------------------------------------------------------------------ */

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-light-pink focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50',
        checked ? 'bg-brand-light-pink' : 'bg-gray-200 dark:bg-gray-700',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}
