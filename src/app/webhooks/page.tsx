'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API } from '@/lib/api-client';
import type { Webhook } from '@/lib/types';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import ConfirmModal from '@/components/ConfirmModal';
import AsyncError from '@/components/AsyncError';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';

interface WebhookFormData {
  name: string;
  url: string;
  secret: string;
  isActive: boolean;
  triggerOnRun: boolean;
  triggerOnMessage: boolean;
  payloadTemplate: string;
}

interface ConfirmationRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

const emptyWebhookForm = (): WebhookFormData => ({
  name: '',
  url: '',
  secret: '',
  isActive: true,
  triggerOnRun: false,
  triggerOnMessage: false,
  payloadTemplate: '',
});

const webhookToFormData = (webhook: Webhook): WebhookFormData => ({
  name: webhook.name,
  url: webhook.url,
  secret: webhook.secret || '',
  isActive: webhook.isActive,
  triggerOnRun: webhook.triggerOnRun,
  triggerOnMessage: webhook.triggerOnMessage,
  payloadTemplate: webhook.payloadTemplate || '',
});

export default function WebhooksPage() {
  const router = useRouter();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<WebhookFormData>(() =>
    emptyWebhookForm(),
  );
  const [formBaseline, setFormBaseline] = useState<WebhookFormData>(() =>
    emptyWebhookForm(),
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] =
    useState<ConfirmationRequest | null>(null);

  const isDirty =
    (isCreating || isEditing) &&
    JSON.stringify(formData) !== JSON.stringify(formBaseline);

  useEffect(() => {
    loadData();
  }, []);

  const askToDiscardChanges = (onConfirm: () => void) => {
    setConfirmation({
      title: 'Discard unsaved changes?',
      message: 'Your changes will be lost if you continue.',
      confirmLabel: 'Discard changes',
      danger: true,
      onConfirm,
    });
  };

  const runWithDiscardCheck = (onConfirm: () => void) => {
    if (isDirty) {
      askToDiscardChanges(onConfirm);
    } else {
      onConfirm();
    }
  };

  useNavigationGuard(isDirty, (href) => {
    askToDiscardChanges(() => router.push(href));
  });

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await API.getWebhooks();
      setWebhooks(data);
    } catch (e: unknown) {
      const error = e as { message?: string };
      const message = error.message || 'Failed to load webhooks';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectWebhook = (webhook: Webhook) => {
    const nextFormData = webhookToFormData(webhook);
    setSelectedWebhook(webhook);
    setIsCreating(false);
    setIsEditing(false);
    setFormData(nextFormData);
    setFormBaseline(nextFormData);
    setError(null);
  };

  const handleSelectWebhook = (webhook: Webhook) => {
    runWithDiscardCheck(() => selectWebhook(webhook));
  };

  const startCreate = () => {
    const nextFormData = emptyWebhookForm();
    setSelectedWebhook(null);
    setIsCreating(true);
    setIsEditing(false);
    setFormData(nextFormData);
    setFormBaseline(nextFormData);
    setError(null);
  };

  const handleStartCreate = () => {
    runWithDiscardCheck(startCreate);
  };

  const handleStartEdit = () => {
    if (!selectedWebhook) return;
    const nextFormData = webhookToFormData(selectedWebhook);
    setIsEditing(true);
    setFormData(nextFormData);
    setFormBaseline(nextFormData);
  };

  const cancelForm = () => {
    const nextFormData = selectedWebhook
      ? webhookToFormData(selectedWebhook)
      : emptyWebhookForm();
    setIsCreating(false);
    setIsEditing(false);
    setFormData(nextFormData);
    setFormBaseline(nextFormData);
    setError(null);
  };

  const handleCancel = () => {
    runWithDiscardCheck(cancelForm);
  };

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      if (!formData.name.trim() || !formData.url.trim()) {
        throw new Error('Name and URL are required.');
      }

      if (isCreating) {
        const newWebhook = await API.createWebhook({
          name: formData.name,
          url: formData.url,
          secret: formData.secret,
          isActive: formData.isActive,
          triggerOnRun: formData.triggerOnRun,
          triggerOnMessage: formData.triggerOnMessage,
          payloadTemplate: formData.payloadTemplate,
        });
        await loadData();
        const nextFormData = webhookToFormData(newWebhook);
        setSelectedWebhook(newWebhook);
        setFormData(nextFormData);
        setFormBaseline(nextFormData);
        setIsCreating(false);
        toast.success('Webhook created successfully');
      } else if (isEditing && selectedWebhook) {
        const updated = await API.updateWebhook(selectedWebhook.id, {
          name: formData.name,
          url: formData.url,
          secret: formData.secret,
          isActive: formData.isActive,
          triggerOnRun: formData.triggerOnRun,
          triggerOnMessage: formData.triggerOnMessage,
          payloadTemplate: formData.payloadTemplate,
        });
        await loadData();
        const nextFormData = webhookToFormData(updated);
        setSelectedWebhook(updated);
        setFormData(nextFormData);
        setFormBaseline(nextFormData);
        setIsEditing(false);
        toast.success('Webhook updated successfully');
      }
    } catch (e: unknown) {
      const error = e as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      setError(
        error.response?.data?.error ||
          error.message ||
          'Failed to save webhook',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteWebhook = async () => {
    if (!selectedWebhook) return;

    setIsDeleting(true);
    try {
      await API.deleteWebhook(selectedWebhook.id);
      await loadData();
      const nextFormData = emptyWebhookForm();
      setSelectedWebhook(null);
      setIsCreating(false);
      setIsEditing(false);
      setFormData(nextFormData);
      setFormBaseline(nextFormData);
      toast.success('Webhook deleted successfully');
    } catch (e: unknown) {
      const error = e as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      setError(
        error.response?.data?.error ||
          error.message ||
          'Failed to delete webhook',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDelete = () => {
    if (!selectedWebhook) return;
    setConfirmation({
      title: 'Delete webhook?',
      message: `Are you sure you want to delete the webhook "${selectedWebhook.name}"?`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        void deleteWebhook();
      },
    });
  };

  return (
    <div className="container-fluid h-100 p-4 overflow-hidden d-flex flex-column">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="text-light fw-bold mb-0">
          <i className="fa-solid fa-satellite-dish me-3"></i>Webhooks
        </h2>
        <button className="btn btn-primary" onClick={handleStartCreate}>
          <i className="fa-solid fa-plus me-2"></i>New Webhook
        </button>
      </div>

      <div className="row flex-grow-1 overflow-hidden g-4">
        {/* List Column */}
        <div className="col-md-4 h-100 d-flex flex-column">
          <div className="card h-100 border-secondary bg-dark">
            <div className="card-header border-secondary fw-bold">
              Configured Webhooks
            </div>
            <div className="list-group list-group-flush overflow-auto h-100">
              {isLoading ? (
                <LoadingSpinner label="Loading webhooks..." className="p-4" />
              ) : loadError ? (
                <AsyncError
                  message={loadError}
                  onRetry={loadData}
                  retryLabel="Retry loading webhooks"
                  className="m-3"
                />
              ) : (
                webhooks.map((webhook) => (
                  <button
                    key={webhook.id}
                    onClick={() => handleSelectWebhook(webhook)}
                    className={`list-group-item list-group-item-action bg-dark text-light border-secondary ${
                      selectedWebhook?.id === webhook.id ? 'active' : ''
                    }`}
                  >
                    <div className="d-flex w-100 justify-content-between align-items-center">
                      <h6 className="mb-1 fw-bold">
                        {webhook.name}
                        {!webhook.isActive && (
                          <span className="badge bg-secondary ms-2 small">
                            Disabled
                          </span>
                        )}
                      </h6>
                    </div>
                    <small className="text-muted text-truncate d-block">
                      {webhook.url}
                    </small>
                  </button>
                ))
              )}
              {!isLoading && !loadError && webhooks.length === 0 && (
                <div className="p-3 text-center text-muted">
                  No webhooks found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detail/Edit Column */}
        <div className="col-md-8 h-100 d-flex flex-column overflow-auto">
          {error && (
            <div className="alert alert-danger mb-3">
              <i className="fa-solid fa-triangle-exclamation me-2"></i>
              {error}
            </div>
          )}

          {selectedWebhook || isCreating ? (
            <div className="card border-secondary bg-dark shadow-sm">
              <div className="card-header border-secondary d-flex justify-content-between align-items-center py-3">
                <span className="fw-bold fs-5">
                  {isCreating
                    ? 'Create New Webhook'
                    : isEditing
                      ? 'Editing Webhook'
                      : 'Webhook Details'}
                </span>
                <div>
                  {!isCreating && !isEditing && (
                    <>
                      <button
                        className="btn btn-outline-danger me-2"
                        onClick={handleDelete}
                        disabled={isDeleting || isSaving}
                      >
                        {isDeleting ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                            Deleting...
                          </>
                        ) : (
                          <><i className="fa-solid fa-trash me-2"></i>Delete</>
                        )}
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleStartEdit}
                      >
                        <i className="fa-solid fa-pen-to-square me-2"></i>Edit
                      </button>
                    </>
                  )}
                  {(isCreating || isEditing) && (
                    <>
                      <button
                        className="btn btn-secondary me-2"
                        onClick={handleCancel}
                        disabled={isSaving}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-success"
                        onClick={handleSave}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                            Saving...
                          </>
                        ) : (
                          <><i className="fa-solid fa-save me-2"></i>Save</>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label text-muted">Webook Name</label>
                  <input
                    type="text"
                    className="form-control bg-dark text-light border-secondary"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    disabled={!isCreating && !isEditing}
                    placeholder="e.g. Slack DAQ Channel"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label text-muted">Target URL</label>
                  <input
                    type="url"
                    className="form-control bg-dark text-light border-secondary text-monospace"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    disabled={!isCreating && !isEditing}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                  {(isCreating || isEditing) && (
                    <div className="form-text">
                      The full endpoint URL where POST requests will be sent.
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="form-label text-muted">
                    Secret / Token (Optional)
                  </label>
                  <input
                    type="password"
                    className="form-control bg-dark text-light border-secondary text-monospace"
                    value={formData.secret}
                    onChange={(e) =>
                      setFormData({ ...formData, secret: e.target.value })
                    }
                    disabled={!isCreating && !isEditing}
                    placeholder="Bearer xoxb-..."
                  />
                  {(isCreating || isEditing) && (
                    <div className="form-text">
                      Any Authorization header details or specific secrets
                      needed for the webhook. Sent as an 'Authorization' header.
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="form-label text-muted">
                    JSON Payload Template (Optional)
                  </label>
                  <textarea
                    className="form-control bg-dark text-light border-secondary text-monospace"
                    rows={5}
                    value={formData.payloadTemplate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        payloadTemplate: e.target.value,
                      })
                    }
                    disabled={!isCreating && !isEditing}
                    placeholder={`{\n  "text": "Run {id} started: {description}"\n}`}
                  />
                  {(isCreating || isEditing) && (
                    <div className="form-text">
                      Leave blank down to send the default generic JSON. Provide
                      a custom JSON structure to override the payload and use
                      literal placeholders like {`{id}`} or {`{description}`} to
                      inject variables.
                    </div>
                  )}
                </div>

                <h6 className="text-muted fw-bold mb-3 border-bottom border-secondary pb-2">
                  Trigger Conditions
                </h6>

                <div className="form-check form-switch mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="triggerOnRun"
                    checked={formData.triggerOnRun}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        triggerOnRun: e.target.checked,
                      })
                    }
                    disabled={!isCreating && !isEditing}
                  />
                  <label
                    className="form-check-label text-light"
                    htmlFor="triggerOnRun"
                  >
                    Trigger on Runs
                    <div className="text-muted small">
                      Send a webhook payload whenever a new DAQ run is started
                      or modified.
                    </div>
                  </label>
                </div>

                <div className="form-check form-switch mb-4">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="triggerOnMessage"
                    checked={formData.triggerOnMessage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        triggerOnMessage: e.target.checked,
                      })
                    }
                    disabled={!isCreating && !isEditing}
                  />
                  <label
                    className="form-check-label text-light"
                    htmlFor="triggerOnMessage"
                  >
                    Trigger on Messages
                    <div className="text-muted small">
                      Send a webhook payload whenever a manual or automated
                      system message is dispatched.
                    </div>
                  </label>
                </div>

                <h6 className="text-muted fw-bold mb-3 border-bottom border-secondary pb-2">
                  Status
                </h6>

                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    disabled={!isCreating && !isEditing}
                  />
                  <label
                    className="form-check-label text-light"
                    htmlFor="isActive"
                  >
                    Webhook Active
                    <div className="text-muted small">
                      If disabled, the webhook will not fire under any
                      circumstances.
                    </div>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-100 d-flex flex-column justify-content-center align-items-center text-muted opacity-50 border border-secondary rounded border-dashed">
              <i className="fa-solid fa-satellite-dish fa-4x mb-3"></i>
              <h4>Select a webhook to view details</h4>
            </div>
          )}
        </div>
      </div>

      {confirmation && (
        <ConfirmModal
          title={confirmation.title}
          message={confirmation.message}
          confirmLabel={confirmation.confirmLabel}
          danger={confirmation.danger}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            const action = confirmation.onConfirm;
            setConfirmation(null);
            action();
          }}
        />
      )}
    </div>
  );
}
