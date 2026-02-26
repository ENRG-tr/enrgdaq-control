'use client';

import React, { useState, useEffect } from 'react';
import { API } from '@/lib/api-client';
import type { Webhook } from '@/lib/types';
import toast from 'react-hot-toast';

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    url: string;
    secret: string;
    isActive: boolean;
    triggerOnRun: boolean;
    triggerOnMessage: boolean;
    payloadTemplate: string;
  }>({
    name: '',
    url: '',
    secret: '',
    isActive: true,
    triggerOnRun: false,
    triggerOnMessage: false,
    payloadTemplate: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await API.getWebhooks();
      setWebhooks(data);
    } catch (e: unknown) {
      const error = e as { message?: string };
      setError(error.message || 'Failed to load webhooks');
    }
  };

  const handleSelectWebhook = (webhook: Webhook) => {
    if (isCreating || isEditing) {
      if (!confirm('Discard changes?')) return;
    }
    setSelectedWebhook(webhook);
    setIsCreating(false);
    setIsEditing(false);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      secret: webhook.secret || '',
      isActive: webhook.isActive,
      triggerOnRun: webhook.triggerOnRun,
      triggerOnMessage: webhook.triggerOnMessage,
      payloadTemplate: webhook.payloadTemplate || '',
    });
    setError(null);
  };

  const handleStartCreate = () => {
    setSelectedWebhook(null);
    setIsCreating(true);
    setIsEditing(false);
    setFormData({
      name: '',
      url: '',
      secret: '',
      isActive: true,
      triggerOnRun: false,
      triggerOnMessage: false,
      payloadTemplate: '',
    });
    setError(null);
  };

  const handleStartEdit = () => {
    if (!selectedWebhook) return;
    setIsEditing(true);
    setFormData({
      name: selectedWebhook.name,
      url: selectedWebhook.url,
      secret: selectedWebhook.secret || '',
      isActive: selectedWebhook.isActive,
      triggerOnRun: selectedWebhook.triggerOnRun,
      triggerOnMessage: selectedWebhook.triggerOnMessage,
      payloadTemplate: selectedWebhook.payloadTemplate || '',
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    if (selectedWebhook) {
      setFormData({
        name: selectedWebhook.name,
        url: selectedWebhook.url,
        secret: selectedWebhook.secret || '',
        isActive: selectedWebhook.isActive,
        triggerOnRun: selectedWebhook.triggerOnRun,
        triggerOnMessage: selectedWebhook.triggerOnMessage,
        payloadTemplate: selectedWebhook.payloadTemplate || '',
      });
    } else {
      setFormData({
        name: '',
        url: '',
        secret: '',
        isActive: true,
        triggerOnRun: false,
        triggerOnMessage: false,
        payloadTemplate: '',
      });
    }
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
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
        setSelectedWebhook(newWebhook);
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
        setSelectedWebhook(updated);
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
    }
  };

  const handleDelete = async () => {
    if (!selectedWebhook) return;
    if (
      !confirm(
        `Are you sure you want to delete the webhook "${selectedWebhook.name}"?`,
      )
    )
      return;

    try {
      await API.deleteWebhook(selectedWebhook.id);
      await loadData();
      setSelectedWebhook(null);
      setIsEditing(false);
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
    }
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
              {webhooks.map((webhook) => (
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
              ))}
              {webhooks.length === 0 && (
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
                      >
                        <i className="fa-solid fa-trash me-2"></i>Delete
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
                      >
                        Cancel
                      </button>
                      <button className="btn btn-success" onClick={handleSave}>
                        <i className="fa-solid fa-save me-2"></i>Save
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
    </div>
  );
}
